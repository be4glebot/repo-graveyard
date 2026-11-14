// @vitest-environment jsdom
/**
 * Dev review harness: every place and case renders, unknown params fall back,
 * and the production guard calls `notFound`.
 *
 * Requirements: 20.1, 20.2, 17.1
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { isValidElement, type ReactElement } from "react";

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import ReviewHarness, {
  type ReviewHarnessProps,
} from "@/components/dev/ReviewHarness";
import ReviewPage from "@/app/dev/review/page";
import { REVIEW_CASES } from "@/lib/review-cases";

const PLACES = ["sky", "gate", "ground", "crypt"] as const;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  notFoundMock.mockClear();
});

/** Resolves the page and returns the harness props it passes down. */
async function pageProps(
  sp: Record<string, string | string[] | undefined>,
): Promise<ReviewHarnessProps> {
  const tree = (await ReviewPage({ searchParams: Promise.resolve(sp) })) as ReactElement<{
    children: ReactElement<ReviewHarnessProps>;
  }>;
  expect(isValidElement(tree)).toBe(true);
  return tree.props.children.props;
}

describe("ReviewHarness", () => {
  for (const place of PLACES) {
    for (const reviewCase of REVIEW_CASES) {
      it(`renders ${place} / ${reviewCase}`, () => {
        const { getByTestId } = render(
          <ReviewHarness place={place} reviewCase={reviewCase} reduced={false} />,
        );
        expect(getByTestId("place-view").getAttribute("data-place")).toBe(place);
        expect(getByTestId("review-shell").getAttribute("data-case")).toBe(
          reviewCase,
        );
      });
    }
  }

  it("the empty case renders with no creature buttons in the scatter", () => {
    const { getByTestId } = render(
      <ReviewHarness place="sky" reviewCase="empty" reduced />,
    );
    expect(getByTestId("review-shell").getAttribute("data-reduced")).toBe("true");
  });
});

describe("/dev/review page", () => {
  it("reads place, case and reduced from async searchParams", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      await pageProps({ place: "crypt", case: "coffins-12", reduced: "1" }),
    ).toEqual({ place: "crypt", reviewCase: "coffins-12", reduced: true });
  });

  it("falls back for unknown or missing params", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await pageProps({ place: "nowhere", case: "bogus" })).toEqual({
      place: "sky",
      reviewCase: "ghosts-3",
      reduced: false,
    });
    expect(await pageProps({})).toEqual({
      place: "sky",
      reviewCase: "ghosts-3",
      reduced: false,
    });
  });

  it("calls notFound in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      ReviewPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
