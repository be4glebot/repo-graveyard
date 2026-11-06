/**
 * DOM test for the two-site `Fog` overlay (`components/scene/Fog.tsx`, task 7.1).
 *
 * `Fog` renders the atmospheric haze that encodes the zombie population. It is
 * mounted at two render sites straddling the creature band (Req 6.2/6.3):
 *
 *   - `layer="dense"` → the far fog behind the creatures, keeping the existing
 *     `scene-fog` root (same `data-testid`, same `data-fog-density`) so the
 *     frozen fog contract and its tests keep passing;
 *   - `layer="thin"` → the near fog in front of the creatures' feet / below the
 *     plaques, a separate `data-testid="scene-fog-near"` sibling.
 *
 * Both layers are null iff the zombie count is 0, and both derive their opacity
 * from the SAME `fogDensity(zombieCount)` call (Req 6.4/6.7): the dense layer
 * uses the full `Fog_Opacity`, the thin layer a quarter of it. The drift is a
 * `transform: translateX` on a double-width tiled strip (Req 9.2), applied via
 * the `fog-wisps` / `fog-wisps-thin` classes — never `background-position`. The
 * `reducedMotion` prop drops the drift class so the strip holds at a fixed
 * offset (Req 6.5).
 *
 * This test asserts the behaviours above against the real rendered DOM. The
 * expected opacities are recomputed here from the imported, frozen
 * `fogDensity` (never a duplicated density formula) so the test tracks the
 * contract rather than a hardcoded constant.
 *
 * `@testing-library/jest-dom` is not installed, so assertions use plain DOM /
 * vitest checks, matching the other `tests/dom/*.test.tsx` files.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5, 8.1
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import Fog from "@/components/scene/Fog";
import { fogDensity } from "@/lib/scene-view";

afterEach(() => {
  cleanup();
});

// The opacity contract, recomputed from the frozen `fogDensity` so the test
// tracks the single density function rather than duplicating its math. These
// mirror the component's `MAX_FOG_OPACITY` / `THIN_OPACITY_FACTOR` constants.
const MAX_FOG_OPACITY = 0.55;
const THIN_OPACITY_FACTOR = 0.25;

/** Expected dense-layer opacity for a zombie count, from the frozen density. */
function expectedDenseOpacity(zombieCount: number): number {
  return (fogDensity(zombieCount) / 100) * MAX_FOG_OPACITY;
}

/** The drifting strip is the inner child of the fog root. */
function driftStrip(root: HTMLElement): HTMLElement {
  const strip = root.firstElementChild as HTMLElement | null;
  if (strip === null) {
    throw new Error("fog root has no drift strip child");
  }
  return strip;
}

describe("Fog — presence: both layers null iff zombieCount === 0 (Req 6.1)", () => {
  it("renders nothing for either layer when there are no zombies", () => {
    const dense = render(<Fog zombieCount={0} layer="dense" />);
    expect(dense.queryByTestId("scene-fog")).toBeNull();
    cleanup();

    const thin = render(<Fog zombieCount={0} layer="thin" />);
    expect(thin.queryByTestId("scene-fog-near")).toBeNull();
  });

  it("renders both layers once at least one zombie is present", () => {
    const dense = render(<Fog zombieCount={1} layer="dense" />);
    expect(dense.queryByTestId("scene-fog")).not.toBeNull();
    cleanup();

    const thin = render(<Fog zombieCount={1} layer="thin" />);
    expect(thin.queryByTestId("scene-fog-near")).not.toBeNull();
  });

  it("keeps the thin layer present whenever the dense layer is present (shared density gate)", () => {
    // A low zombie count whose thin opacity is a small positive number must not
    // round down to a null layer: both gate on the same `fogDensity` call.
    for (const zombieCount of [1, 2, 5, 19, 20, 50]) {
      const dense = render(<Fog zombieCount={zombieCount} layer="dense" />);
      const thin = render(<Fog zombieCount={zombieCount} layer="thin" />);
      expect(dense.queryByTestId("scene-fog")).not.toBeNull();
      expect(thin.queryByTestId("scene-fog-near")).not.toBeNull();
      cleanup();
    }
  });
});

describe("Fog — opacity encodes the zombie count from the frozen density (Req 6.2/6.3)", () => {
  it("the dense layer carries Fog_Opacity derived from fogDensity", () => {
    for (const zombieCount of [1, 3, 10, 19, 20, 100]) {
      const { getByTestId } = render(
        <Fog zombieCount={zombieCount} layer="dense" />,
      );
      const root = getByTestId("scene-fog") as HTMLElement;
      expect(Number(root.style.opacity)).toBeCloseTo(
        expectedDenseOpacity(zombieCount),
        10,
      );
      // The density is also surfaced on the root for the frozen contract.
      expect(root.getAttribute("data-fog-density")).toBe(
        String(fogDensity(zombieCount)),
      );
      cleanup();
    }
  });

  it("the thin layer's opacity is exactly a quarter of the dense layer's for the same count", () => {
    for (const zombieCount of [1, 3, 10, 19, 20, 100]) {
      const dense = render(<Fog zombieCount={zombieCount} layer="dense" />);
      const denseOpacity = Number(
        (dense.getByTestId("scene-fog") as HTMLElement).style.opacity,
      );
      cleanup();

      const thin = render(<Fog zombieCount={zombieCount} layer="thin" />);
      const thinOpacity = Number(
        (thin.getByTestId("scene-fog-near") as HTMLElement).style.opacity,
      );
      cleanup();

      // Thin == dense * 0.25, and both trace back to the same density call.
      expect(thinOpacity).toBeCloseTo(denseOpacity * THIN_OPACITY_FACTOR, 10);
      expect(thinOpacity).toBeCloseTo(
        expectedDenseOpacity(zombieCount) * THIN_OPACITY_FACTOR,
        10,
      );
    }
  });
});

describe("Fog — drift is translateX on a double-width strip, never background-position (Req 9.2)", () => {
  it("the dense layer applies the fog-wisps drift class to a w-[200%] strip", () => {
    const { getByTestId } = render(<Fog zombieCount={5} layer="dense" />);
    const strip = driftStrip(getByTestId("scene-fog") as HTMLElement);

    // The drift keyframe (fog-wisps) animates transform: translateX — the class
    // is present on the double-width strip.
    expect(strip.classList.contains("fog-wisps")).toBe(true);
    expect(strip.classList.contains("w-[200%]")).toBe(true);

    // The strip never animates background-position: it sets a static repeating
    // background image, not a positioned/animated one.
    expect(strip.style.backgroundPosition).toBe("");
    expect(strip.style.animationName).not.toContain("background-position");
  });

  it("the thin layer applies the fog-wisps-thin drift class to a w-[200%] strip", () => {
    const { getByTestId } = render(<Fog zombieCount={5} layer="thin" />);
    const strip = driftStrip(getByTestId("scene-fog-near") as HTMLElement);

    expect(strip.classList.contains("fog-wisps-thin")).toBe(true);
    expect(strip.classList.contains("w-[200%]")).toBe(true);
    expect(strip.style.backgroundPosition).toBe("");
  });
});

describe("Fog — reducedMotion pauses the drift by dropping the drift class (Req 6.5)", () => {
  it("drops the fog-wisps class on the dense layer under reduced motion", () => {
    const { getByTestId } = render(
      <Fog zombieCount={5} layer="dense" reducedMotion />,
    );
    const strip = driftStrip(getByTestId("scene-fog") as HTMLElement);
    expect(strip.classList.contains("fog-wisps")).toBe(false);
    // The strip itself is still rendered (the fog is still visible, just held).
    expect(strip.classList.contains("w-[200%]")).toBe(true);
  });

  it("drops the fog-wisps-thin class on the thin layer under reduced motion", () => {
    const { getByTestId } = render(
      <Fog zombieCount={5} layer="thin" reducedMotion />,
    );
    const strip = driftStrip(getByTestId("scene-fog-near") as HTMLElement);
    expect(strip.classList.contains("fog-wisps-thin")).toBe(false);
    expect(strip.classList.contains("w-[200%]")).toBe(true);
  });
});


describe("Fog — uses the painted art, not a flat linear-gradient band (visual fix 2C)", () => {
  it("the dense strip paints fog-wisps.webp (no linear-gradient)", () => {
    const { getByTestId } = render(<Fog zombieCount={6} layer="dense" />);
    const strip = driftStrip(getByTestId("scene-fog") as HTMLElement);

    // The drift strip is painted with the dense fog artwork …
    expect(strip.style.backgroundImage).toContain("fog-wisps.webp");
    // … tiled horizontally at the strip height, not a flat gradient wash.
    expect(strip.style.backgroundImage).not.toContain("linear-gradient");
    expect(strip.style.backgroundRepeat).toBe("repeat-x");
    expect(strip.style.backgroundSize).toBe("auto 100%");
  });

  it("the thin strip paints fog-wisps-thin.webp (no linear-gradient)", () => {
    const { getByTestId } = render(<Fog zombieCount={6} layer="thin" />);
    const strip = driftStrip(getByTestId("scene-fog-near") as HTMLElement);

    expect(strip.style.backgroundImage).toContain("fog-wisps-thin.webp");
    expect(strip.style.backgroundImage).not.toContain("linear-gradient");
    expect(strip.style.backgroundRepeat).toBe("repeat-x");
    expect(strip.style.backgroundSize).toBe("auto 100%");
  });

  it("covers only the bottom band of the scene with a soft top mask (no hard edge)", () => {
    const dense = render(<Fog zombieCount={6} layer="dense" />);
    const denseRoot = dense.getByTestId("scene-fog") as HTMLElement;
    // Dense bank reaches the bottom 55% of the scene …
    expect(denseRoot.style.height).toBe("55%");
    expect(denseRoot.className).toContain("bottom-0");
    // … and fades at its top edge via a mask, so there is no hard line.
    expect(denseRoot.style.maskImage).toContain("linear-gradient");
    expect(denseRoot.style.maskImage).toContain("to top");
    dense.unmount();

    const thin = render(<Fog zombieCount={6} layer="thin" />);
    const thinRoot = thin.getByTestId("scene-fog-near") as HTMLElement;
    // The near fog is the shallower bottom 30% band.
    expect(thinRoot.style.height).toBe("30%");
    expect(thinRoot.style.maskImage).toContain("linear-gradient");
  });
});
