/**
 * DOM test for `GroundArt` (task 11.1).
 * Requirements: 8.3, 8.4, 8.5, 8.9, 18.2, 19.4, 19.5, 19.7, 19.8
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import GroundArt, {
  fenceHeightFor,
  groundSpecFor,
  lanternIndices,
  pathSpan,
  ribbonStones,
} from "@/components/world/GroundArt";
import { WORLD_ART } from "@/lib/world-art";
import { WORLD_CONFIG, computeWorldLayout } from "@/lib/world-layout";

afterEach(() => cleanup());

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `repo-${i}`);
const layoutFor = (n: number, viewportW = 1280, viewportH = 800) =>
  computeWorldLayout({ place: "ground", names: names(n), viewportW, viewportH });

describe("GroundArt", () => {
  it("renders one place-ground Crop per Stratum", () => {
    for (const n of [0, 1, 4, 20, 60]) {
      const layout = layoutFor(n);
      const { getAllByTestId, unmount } = render(
        <GroundArt layout={layout} viewportW={1280} />,
      );
      expect(getAllByTestId("ground-crop")).toHaveLength(layout.strata.length);
      getAllByTestId("ground-crop-image").forEach((img) =>
        expect(img.getAttribute("data-crop-plate")).toBe("place-ground"),
      );
      unmount();
    }
  });

  it("flips the grass mid-path Crop with focal fy of at least 0.48", () => {
    const mid = WORLD_ART.ground.find((c) => c.stratumId === "mid-path")!;
    expect(mid.flip.h).toBe(true);
    expect(mid.focal.fy).toBeGreaterThanOrEqual(0.48);
    for (let n = 1; n <= 6; n++) {
      expect(groundSpecFor(`mid-path-${n}`).focal.fy).toBeGreaterThanOrEqual(0.48);
    }
  });

  it("repeats only mg-fence-tile, horizontally, and renders landmarks once", () => {
    const { container, getAllByTestId, getByTestId } = render(
      <GroundArt layout={layoutFor(40)} viewportW={1280} />,
    );
    expect(getAllByTestId("ground-fence-gate")).toHaveLength(1);
    expect(getAllByTestId("ground-mausoleum")).toHaveLength(1);
    expect(getAllByTestId("ground-fence-tile")).toHaveLength(1);
    expect(getByTestId("ground-fence-tile").style.backgroundRepeat).toBe("repeat-x");
    expect(getByTestId("ground-fence-tile").getAttribute("data-art")).toBe("mg-fence-tile");
    expect(getByTestId("ground-fence-gate").style.backgroundRepeat).toBe("no-repeat");
    expect(getByTestId("ground-mausoleum").style.backgroundRepeat).toBe("no-repeat");
    container
      .querySelectorAll<HTMLElement>('[data-testid$="crop-image"]')
      .forEach((img) => expect(img.style.backgroundRepeat).toBe("no-repeat"));
    expect(container.querySelector(".bg-repeat, .bg-repeat-x")).toBeNull();
  });

  // Task 21.1: the stone grid is still every 90 px (at most ceil(H / 90)), but
  // stones are clamped to the span below the fence and above the mausoleum, so
  // the old "exactly ceil(H / 90) stones" assertion no longer holds (stones
  // above the fence or behind the heading are gone by design).
  it("draws the 90 px stones that fall inside the path span, across the bands", () => {
    for (const n of [0, 3, 20, 60]) {
      const layout = layoutFor(n);
      const { getAllByTestId, unmount } = render(
        <GroundArt layout={layout} viewportW={1280} />,
      );
      const total = getAllByTestId("ground-path").reduce(
        (sum, el) => sum + Number(el.getAttribute("data-stones")),
        0,
      );
      expect(total).toBe(ribbonStones(layout, 1280).length);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(Math.max(1, Math.ceil(layout.heightPx / 90)));
      unmount();
    }
  });

  it("ends the path just before the fence: no stone on the fence or behind the heading", () => {
    for (const [n, w, h] of [
      [0, 1280, 800],
      [1, 1440, 900],
      [4, 1440, 900],
      [12, 390, 844],
      [30, 1280, 700],
    ] as const) {
      const layout = layoutFor(n, w, h);
      const span = pathSpan(layout);
      const gate = layout.features.find((f) => f.kind === "entry-gate")!;
      const fenceBottom = gate.y + fenceHeightFor(layout.viewportH) / 2;
      const cfg = layout.compact ? WORLD_CONFIG.compact : WORLD_CONFIG.desktop;
      expect(span.top).toBeGreaterThan(fenceBottom);
      expect(span.top).toBeGreaterThanOrEqual(cfg.TOP_CLEAR);
      expect(span.bottom).toBeLessThan(layout.heightPx);
      const stones = ribbonStones(layout, w);
      for (const s of stones) {
        expect(s.y).toBeGreaterThan(fenceBottom);
        expect(s.y).toBeGreaterThanOrEqual(cfg.TOP_CLEAR);
        expect(s.y).toBeLessThanOrEqual(span.bottom);
      }
    }
  });

  it("feathers the ground mist on all four sides with a uniform crop", () => {
    const { getAllByTestId } = render(<GroundArt layout={layoutFor(12)} viewportW={1280} />);
    const mist = getAllByTestId("place-mist-far")[0];
    expect(mist.style.maskImage || mist.style.webkitMaskImage).toContain("radial-gradient");
  });

  it("places path lanterns with a registered data-effect and a lantern list", () => {
    const { container, getAllByTestId } = render(
      <GroundArt layout={layoutFor(30)} viewportW={1280} />,
    );
    expect(getAllByTestId("path-lantern").length).toBeGreaterThanOrEqual(2);
    expect(
      container.querySelectorAll('[data-effect="path-lantern-flicker"]').length,
    ).toBe(getAllByTestId("path-lantern").length);
    expect(lanternIndices(0)).toEqual([]);
    expect(lanternIndices(1)).toEqual([0]);
  });

  it("mounts EnvMist at the ground token and tags ground-mist", () => {
    const { container } = render(<GroundArt layout={layoutFor(30)} viewportW={1280} />);
    const mist = container.querySelectorAll('[data-effect="ground-mist"]');
    expect(mist.length).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid="place-mist-far"][data-place="ground"]')).not.toBeNull();
  });

  it("uses the band rates classes: background, mid-ground, foreground", () => {
    const { container } = render(<GroundArt layout={layoutFor(30)} viewportW={1280} />);
    expect(container.querySelector(".world-band-bg")).not.toBeNull();
    expect(container.querySelector(".world-band-mid")).not.toBeNull();
    expect(container.querySelector(".world-band-fg")).not.toBeNull();
    expect(container.querySelector('[data-testid="ground-fg-crop-image"][data-crop-plate="fg-frame"]')).not.toBeNull();
  });

  it("keeps every Crop distinct (flip or offset), per band family", () => {
    const { getAllByTestId } = render(<GroundArt layout={layoutFor(60)} viewportW={1280} />);
    for (const id of ["ground-crop-image", "ground-fg-crop-image"]) {
      const imgs = getAllByTestId(id);
      const keys = new Set(
        imgs.map((i) => `${i.style.transform}|${i.style.backgroundPosition}`),
      );
      expect(keys.size).toBe(imgs.length);
    }
  });

  it("marks every layer aria-hidden and inert with nothing focusable", () => {
    const layout = layoutFor(20);
    const { container } = render(<GroundArt layout={layout} viewportW={1280} />);
    container
      .querySelectorAll(
        '[data-testid="ground-band"], [data-testid="ground-mid-band"], [data-testid="ground-fg-band"], [data-blend-zone]',
      )
      .forEach((el) => {
        expect(el.getAttribute("aria-hidden")).toBe("true");
        expect(el.hasAttribute("inert")).toBe(true);
      });
    expect(container.querySelectorAll("[data-blend-zone]").length).toBe(layout.blendZones.length);
    expect(container.querySelector("button, a, input, [tabindex]")).toBeNull();
  });

  it("drops lantern flicker and mist sway under reduced motion", () => {
    const { container } = render(
      <GroundArt layout={layoutFor(30)} viewportW={1280} reducedMotion />,
    );
    expect(container.querySelector(".lantern-flicker")).toBeNull();
    expect(container.querySelector(".env-mist, .env-mist-near")).toBeNull();
  });
});


