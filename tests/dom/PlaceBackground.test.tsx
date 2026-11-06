/**
 * DOM test for the per-place painted backdrop (`components/scene/PlaceBackground.tsx`,
 * tasks 6.1 + 6.2).
 *
 * `PlaceBackground` draws one place's painted WebP to cover the viewport with
 * the exact brightness filter the boards pin (sky 0.8, gate 0.85, ground 0.55,
 * crypt 0.7, Req 4.1-4.4), top and bottom dark legibility gradients each
 * spanning ≥15% of the viewport height (Req 4.5), an always-present solid dark
 * fallback fill so a failed image load still leaves a readable ground with the
 * creatures + header intact (Req 4.6), and the whole layer is
 * `pointer-events: none` (Req 7.5).
 *
 * This test pins that presentational contract against the real rendered DOM:
 *
 *   - each place carries `filter: brightness(<exact value>)` on the bleed box;
 *   - both legibility gradients are present with a height of ≥15vh;
 *   - the root layer is `pointer-events: none`;
 *   - firing the painted image's `onError` keeps the solid fallback fill
 *     present (and does not throw), while sibling creatures/header content
 *     passed alongside the background keeps rendering.
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks, matching the other `tests/dom/*.test.tsx` files. `next/image`
 * works unmocked here (as it does in `Creature.test.tsx`).
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import PlaceBackground from "@/components/scene/PlaceBackground";
import type { PlaceId } from "@/lib/estate-view";

afterEach(() => {
  cleanup();
});

/** The exact brightness filter each place pins (Req 4.1-4.4). */
const PLACE_BRIGHTNESS: Record<PlaceId, number> = {
  sky: 0.8,
  gate: 0.85,
  ground: 0.55,
  crypt: 0.7,
};

/** Minimum legibility-gradient band height as a fraction of viewport height. */
const MIN_GRADIENT_VH = 15;

/** Parses the `brightness(X)` argument out of a `filter` style string. */
function parseBrightness(filter: string): number {
  const match = /brightness\(\s*([0-9]*\.?[0-9]+)\s*\)/.exec(filter);
  if (match === null) {
    throw new Error(`no brightness() in filter: "${filter}"`);
  }
  return Number(match[1]);
}

/** Parses the numeric `vh` height off an inline `height: NNvh` style. */
function parseVh(height: string): number {
  const match = /([0-9]*\.?[0-9]+)vh/.exec(height);
  if (match === null) {
    throw new Error(`expected a vh height, got: "${height}"`);
  }
  return Number(match[1]);
}

describe("PlaceBackground — each place draws its painting at the pinned brightness (Req 4.1-4.4)", () => {
  for (const place of ["sky", "gate", "ground", "crypt"] as const) {
    it(`${place} renders the painted image with brightness ${PLACE_BRIGHTNESS[place]}`, () => {
      const { getByTestId } = render(<PlaceBackground place={place} />);

      // The brightness filter lives on the `-3%` bleed box that holds the
      // painted image; it must equal the board value within ±0.02.
      const bleed = getByTestId("place-background-bleed") as HTMLElement;
      expect(parseBrightness(bleed.style.filter)).toBeCloseTo(
        PLACE_BRIGHTNESS[place],
        2,
      );

      // The painting is drawn to cover (object-cover), and the rendered src is
      // the place's `.webp` under /art (next/image rewrites the path through
      // its loader, so assert the basename is present rather than the raw src).
      const img = bleed.querySelector("img");
      expect(img).not.toBeNull();
      const src = img?.getAttribute("src") ?? "";
      expect(src).toContain(`place-${place}`);
      expect(src).toContain("webp");
      expect(img?.getAttribute("class") ?? "").toContain("object-cover");
    });
  }
});

describe("PlaceBackground — top + bottom legibility gradients each span ≥15vh (Req 4.5)", () => {
  for (const place of ["sky", "gate", "ground", "crypt"] as const) {
    it(`${place} renders both gradients, each at least 15vh tall`, () => {
      const { getByTestId } = render(<PlaceBackground place={place} />);

      const top = getByTestId("place-background-gradient-top") as HTMLElement;
      const bottom = getByTestId(
        "place-background-gradient-bottom",
      ) as HTMLElement;

      // Both bands are present and each spans at least 15% of viewport height.
      expect(parseVh(top.style.height)).toBeGreaterThanOrEqual(MIN_GRADIENT_VH);
      expect(parseVh(bottom.style.height)).toBeGreaterThanOrEqual(
        MIN_GRADIENT_VH,
      );

      // They are dark gradients painted with linear-gradient (token-based), not
      // flat fills — the inline backgroundImage carries a linear-gradient.
      expect(top.style.backgroundImage).toContain("linear-gradient");
      expect(bottom.style.backgroundImage).toContain("linear-gradient");
    });
  }
});

describe("PlaceBackground — the whole layer never intercepts pointer events (Req 7.5)", () => {
  for (const place of ["sky", "gate", "ground", "crypt"] as const) {
    it(`${place} root is pointer-events: none`, () => {
      const { getByTestId } = render(<PlaceBackground place={place} />);
      const root = getByTestId("place-background") as HTMLElement;
      // The pointer-events-none utility is applied on the root layer.
      expect(root.className).toContain("pointer-events-none");
    });
  }
});

describe("PlaceBackground — a failed image load keeps the solid fallback + sibling content (Req 4.6)", () => {
  it("keeps the solid fallback fill present after the image onError fires", () => {
    const { getByTestId, queryByTestId } = render(
      <PlaceBackground place="ground" />,
    );

    // Before the error the painted image is rendered and the fallback fill is
    // already present behind it (always rendered, Req 4.6).
    const bleed = getByTestId("place-background-bleed") as HTMLElement;
    const img = bleed.querySelector("img");
    expect(img).not.toBeNull();
    expect(queryByTestId("place-background-fallback")).not.toBeNull();

    // Firing the image load error must not throw, must hide the broken image,
    // and must leave the solid fallback fill in place.
    expect(() => fireEvent.error(img as HTMLImageElement)).not.toThrow();

    const fallback = getByTestId("place-background-fallback") as HTMLElement;
    expect(fallback).not.toBeNull();
    // The fallback is a solid night-sky fill, not a transparent hole.
    expect(fallback.style.backgroundColor).toContain("--color-night-sky");
    // The broken image is removed rather than left as a broken-image box.
    expect(bleed.querySelector("img")).toBeNull();
  });

  it("continues to render sibling creatures + header content after the image fails", () => {
    const { getByTestId, queryByText } = render(
      <PlaceBackground place="gate">
        <div data-testid="scene-creatures">a zombie</div>
        <header data-testid="scene-header">The estate header</header>
      </PlaceBackground>,
    );

    const bleed = getByTestId("place-background-bleed") as HTMLElement;
    const img = bleed.querySelector("img");
    expect(img).not.toBeNull();

    // The children (standing in for the creatures/header mounted alongside the
    // background in the real scene) render before the failure.
    expect(queryByText("a zombie")).not.toBeNull();
    expect(queryByText("The estate header")).not.toBeNull();

    // After the image fails the children keep rendering without error.
    fireEvent.error(img as HTMLImageElement);

    expect(queryByText("a zombie")).not.toBeNull();
    expect(queryByText("The estate header")).not.toBeNull();
    expect(queryByText(/estate header/i)).not.toBeNull();
  });
});
