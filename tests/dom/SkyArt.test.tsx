/**
 * DOM test for `SkyArt` (task 8.1).
 * Requirements: 7.5, 7.6, 7.12, 19.1, 19.5, 19.7, 19.8
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import SkyArt, { skyBandGeometry, skyMoonPlacement } from "@/components/world/SkyArt";
import { PAINTED_MOON } from "@/lib/estate-view";
import { PLATE_SIZE, computeCrop, plateToStage } from "@/lib/world-art";
import { computeWorldLayout } from "@/lib/world-layout";

afterEach(() => cleanup());

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `repo-${i}`);
const layoutFor = (n: number, viewportW = 1280, viewportH = 800) =>
  computeWorldLayout({ place: "sky", names: names(n), viewportW, viewportH });

describe("SkyArt", () => {
  it("renders one Crop per Stratum", () => {
    for (const n of [0, 1, 4, 20, 60]) {
      const layout = layoutFor(n);
      const { getAllByTestId, unmount } = render(
        <SkyArt layout={layout} rows={[]} viewportW={1280} />,
      );
      expect(getAllByTestId("sky-crop")).toHaveLength(layout.strata.length);
      expect(getAllByTestId("sky-band")).toHaveLength(layout.strata.length);
      unmount();
    }
  });

  it("locks the data Moon onto the painted moon within 2 px", () => {
    for (const [w, h] of [[360, 780], [1280, 800], [1920, 1080]] as const) {
      const layout = layoutFor(20, w, h);
      const { getByTestId, getAllByTestId, unmount } = render(
        <SkyArt layout={layout} rows={[]} viewportW={w} />,
      );
      const band = skyBandGeometry(layout, w, false)[0];
      // Independent recomputation of the painted moon centre from the Crop.
      const crop = computeCrop({
        plate: PLATE_SIZE[band.spec.plate],
        element: band.element,
        focal: band.spec.focal,
        anchor: band.spec.anchor,
        flip: band.spec.flip,
        offset: band.spec.offset,
      });
      const painted = plateToStage(crop, band.element, PAINTED_MOON.fx, PAINTED_MOON.fy);
      const wrapper = getByTestId("sky-moon");
      const disc = wrapper.firstElementChild as HTMLElement;
      expect(Math.abs(parseFloat(disc.style.left) - (painted.x - band.bleed.x))).toBeLessThanOrEqual(2);
      expect(Math.abs(parseFloat(disc.style.top) - (painted.y - band.bleed.y))).toBeLessThanOrEqual(2);
      expect(skyMoonPlacement(band).cx).toBeCloseTo(painted.x - band.bleed.x, 5);
      // Same wrapper as the painted Crop.
      expect(wrapper.parentElement).toBe(getAllByTestId("sky-crop")[0].parentElement);
      unmount();
    }
  });

  it("renders only one moon per world", () => {
    const { getAllByTestId } = render(
      <SkyArt layout={layoutFor(30)} rows={[]} viewportW={1280} />,
    );
    expect(getAllByTestId("sky-moon")).toHaveLength(1);
  });

  it("marks every layer aria-hidden and inert", () => {
    const { container } = render(
      <SkyArt layout={layoutFor(20)} rows={[]} viewportW={1280} />,
    );
    const bands = container.querySelectorAll('[data-testid="sky-band"]');
    expect(bands.length).toBeGreaterThan(1);
    bands.forEach((b) => {
      expect(b.getAttribute("aria-hidden")).toBe("true");
      expect(b.hasAttribute("inert")).toBe(true);
    });
    const zones = container.querySelectorAll("[data-blend-zone]");
    expect(zones.length).toBe(layoutFor(20).blendZones.length);
    zones.forEach((z) => {
      expect(z.getAttribute("aria-hidden")).toBe("true");
      expect(z.hasAttribute("inert")).toBe(true);
    });
    expect(container.querySelector("button, a, input, [tabindex]")).toBeNull();
  });

  it("never repeats a Plate: no repeat, and no two Crops are identical", () => {
    const layout = layoutFor(60);
    const { getAllByTestId } = render(
      <SkyArt layout={layout} rows={[]} viewportW={1280} />,
    );
    const images = getAllByTestId("sky-crop-image");
    const keys = new Set<string>();
    images.forEach((img) => {
      expect(img.style.backgroundRepeat).toBe("no-repeat");
      const flip = (img.style.transform ?? "") + "|" + img.style.backgroundPosition;
      keys.add(flip);
    });
    expect(keys.size).toBe(images.length);
  });
});
