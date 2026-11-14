/**
 * Tests for `DepthMarker`.
 *
 * Requirements: 11.6, 11.7, 11.8, 11.9, 11.10, 12.8, 12.9
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DepthMarker from "@/components/world/DepthMarker";
import type { Stratum } from "@/lib/world-layout";

const strata: Stratum[] = [0, 1, 2].map((i) => ({
  id: `s${i}`,
  label: `Chamber ${i + 1} of 3`,
  top: i * 800,
  bottom: (i + 1) * 800,
  focal: { fx: 0.5, fy: 0.4 },
}));

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubReduced(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  );
}

describe("DepthMarker", () => {
  it("renders a nav with an ol of native buttons and aria-current on the current step", () => {
    render(<DepthMarker strata={strata} lengthVh={3} current={1} />);
    const nav = screen.getByRole("navigation");
    const buttons = nav.querySelectorAll("ol > li > button");
    expect(buttons).toHaveLength(3);
    expect(buttons[1].getAttribute("aria-current")).toBe("true");
    expect(buttons[0].hasAttribute("aria-current")).toBe(false);
    expect(screen.getByRole("button", { name: /Chamber 2 of 3/ })).toBe(buttons[1]);
    expect(screen.getByTestId("depth-marker-label").textContent).toBe("Chamber 2 of 3");
  });

  it("renders nothing when lengthVh is 1", () => {
    const { container } = render(<DepthMarker strata={strata.slice(0, 1)} lengthVh={1} current={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("scrolls the stratum anchor into view at the start, smooth by default", async () => {
    stubReduced(false);
    const anchor = document.createElement("div");
    render(<DepthMarker strata={strata} lengthVh={3} current={0} getAnchor={() => anchor} />);
    const spy = vi.fn();
    anchor.scrollIntoView = spy;
    await userEvent.click(screen.getByRole("button", { name: /Chamber 3/ }));
    expect(spy).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
  });

  it("uses behavior auto under reduced motion", async () => {
    stubReduced(true);
    const anchor = document.createElement("div");
    const spy = vi.fn();
    anchor.scrollIntoView = spy;
    render(<DepthMarker strata={strata} lengthVh={3} current={0} getAnchor={() => anchor} />);
    await userEvent.click(screen.getByRole("button", { name: /Chamber 2/ }));
    expect(spy).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
  });

  it("announces only on Stratum change, at most once per second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 0, 1));
    const { rerender } = render(
      <DepthMarker strata={strata} lengthVh={3} current={0} placeName="Sky" />,
    );
    const live = () => screen.getByTestId("depth-marker-live").textContent;
    expect(live()).toBe("");

    // Same Stratum: still nothing.
    rerender(<DepthMarker strata={strata} lengthVh={3} current={0} placeName="Sky" />);
    expect(live()).toBe("");

    rerender(<DepthMarker strata={strata} lengthVh={3} current={1} placeName="Sky" />);
    expect(live()).toBe("Sky: Chamber 2 of 3");

    // A second change inside one second is deferred.
    vi.advanceTimersByTime(200);
    rerender(<DepthMarker strata={strata} lengthVh={3} current={2} placeName="Sky" />);
    expect(live()).toBe("Sky: Chamber 2 of 3");
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(live()).toBe("Sky: Chamber 3 of 3");
  });
});
