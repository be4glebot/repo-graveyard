/**
 * Geometry and compact-layout tests (landing-mobile-states, task 7.3).
 *
 * Pure geometry: for every width below 768 px, every height and every place,
 * the compact chrome boxes and the compact creature/plaque rects stay clear of
 * each other, inside the stage band and inside the edge margins. Plus a
 * `DepthScatter` regression at 700 px with a `compactBand`, and a check that
 * the retired `mobilePosition` helper is no longer exported.
 *
 * Requirements: 5.4, 5.6, 5.11, 9.7
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import DepthScatter from "@/components/scene/DepthScatter";
import * as depthScatterModule from "@/components/scene/DepthScatter";
import * as estateView from "@/lib/estate-view";
import {
  COMPACT_CHROME_FALLBACK_PX,
  DEPTH_ROWS,
  SCENE_EDGE_MARGIN_PX,
  compactColumns,
  compactPlotSize,
  compactStackLayout,
  layoutCompactChrome,
  rectsIntersect,
  scatterLayout,
  stageBand,
  type PlaceId,
  type SceneRect,
} from "@/lib/estate-view";
import type { GraveyardRow } from "@/lib/graveyard-view";
import type { LifecycleState } from "@/lib/lifecycle";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const EPS = 1e-6;
const WIDTHS = [375, 430, 431, 600, 700, 767];
const HEIGHTS = [667, 812, 1024];
const PLACES: PlaceId[] = ["sky", "gate", "ground", "crypt"];

/** Shrinks a rect by float-noise epsilon so edge-touching counts as clear. */
const shrink = (r: SceneRect): SceneRect => ({
  ...r,
  left: r.left + EPS,
  right: r.right - EPS,
  top: r.top + EPS,
  bottom: r.bottom - EPS,
});

function layoutFor(place: PlaceId, width: number, height: number, count?: number) {
  const n = count ?? compactPlotSize(width);
  const names = Array.from({ length: n }, (_, i) => `${place}-repo-${i}`);
  const placements = scatterLayout(names, DEPTH_ROWS, place, place);
  const chrome = layoutCompactChrome(width, height, COMPACT_CHROME_FALLBACK_PX);
  const band = stageBand(height, chrome.chips.bottom, chrome.bottomBar.top);
  const out = compactStackLayout(placements, width, band, height);
  return { chrome, band, out };
}

describe("compact geometry matrix", () => {
  for (const place of PLACES) {
    for (const width of WIDTHS) {
      for (const height of HEIGHTS) {
        it(`${place} @ ${width}x${height}: no overlaps, inside band and margins`, () => {
          const { chrome, band, out } = layoutFor(place, width, height);
          const boxes = Object.values(chrome);

          // Zero chrome pairs intersect.
          for (let a = 0; a < boxes.length; a++) {
            for (let b = a + 1; b < boxes.length; b++) {
              expect(rectsIntersect(boxes[a], boxes[b])).toBe(false);
            }
          }

          expect(out).toHaveLength(compactPlotSize(width));
          for (const r of out) {
            for (const rect of [r.creature, r.plaque]) {
              for (const box of boxes) {
                expect(rectsIntersect(shrink(rect), box)).toBe(false);
              }
              expect(rect.top).toBeGreaterThanOrEqual(band.top - EPS);
              expect(rect.bottom).toBeLessThanOrEqual(band.bottom + EPS);
              expect(rect.left).toBeGreaterThanOrEqual(SCENE_EDGE_MARGIN_PX - EPS);
              expect(rect.right).toBeLessThanOrEqual(
                width - SCENE_EDGE_MARGIN_PX + EPS,
              );
            }
          }
        });
      }
    }
  }

  it("375x812 named example: a full page fits the band for every place", () => {
    for (const place of PLACES) {
      const { band, out } = layoutFor(place, 375, 812);
      expect(band.bottom).toBeGreaterThan(band.top);
      expect(out).toHaveLength(8);
    }
  });
});

describe("compact columns at 700 px", () => {
  it("uses more than two columns and more than two distinct column centres", () => {
    expect(compactColumns(700)).toBeGreaterThan(2);
    for (const place of PLACES) {
      const { out } = layoutFor(place, 700, 812);
      const centres = new Set(out.map((r) => Math.round(r.plaque.cx * 1e6) / 1e6));
      expect(centres.size).toBeGreaterThan(2);
    }
  });
});

describe("mobilePosition is retired", () => {
  it("is not exported from lib/estate-view or DepthScatter", () => {
    expect("mobilePosition" in estateView).toBe(false);
    expect("mobilePosition" in depthScatterModule).toBe(false);
    const src = readFileSync(
      join(process.cwd(), "components", "scene", "DepthScatter.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/export\s+(async\s+)?(function|const)\s+mobilePosition/);
  });
});

describe("DepthScatter compact path at 700 px", () => {
  function installResizeObserver(width: number, height: number): void {
    class FakeResizeObserver {
      private readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element): void {
        const entry = {
          target,
          contentRect: { width, height } as DOMRectReadOnly,
        } as ResizeObserverEntry;
        this.callback([entry], this as unknown as ResizeObserver);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal(
      "ResizeObserver",
      FakeResizeObserver as unknown as typeof ResizeObserver,
    );
  }

  function rows(count: number, state: LifecycleState): GraveyardRow[] {
    return Array.from({ length: count }, (_, i) => ({
      name: `${state}-${i}`,
      url: `https://github.com/octocat/${state}-${i}`,
      state,
      daysQuiet: i + 1,
      decayLevel: 0,
    }));
  }

  it("uses the compact layout with more than two columns of creatures", () => {
    installResizeObserver(700, 812);
    const chrome = layoutCompactChrome(700, 812, COMPACT_CHROME_FALLBACK_PX);
    const compactBand = stageBand(812, chrome.chips.bottom, chrome.bottomBar.top);
    const plot = rows(compactPlotSize(700), "ghost");
    const { getByTestId, getAllByTestId } = render(
      <DepthScatter
        place="sky"
        plot={plot}
        selectedName={null}
        onSelect={() => {}}
        reducedMotion
        compactBand={compactBand}
      />,
    );
    expect(getByTestId("depth-scatter").getAttribute("data-layout")).toBe(
      "two-column",
    );
    const creatures = getAllByTestId("scatter-creature");
    expect(creatures).toHaveLength(plot.length);
    const lefts = new Set(creatures.map((el) => el.style.left));
    expect(lefts.size).toBeGreaterThan(2);
    // Every creature's feet sit inside the band.
    for (const el of creatures) {
      const feetY = (parseFloat(el.style.top) / 100) * 812;
      expect(feetY).toBeGreaterThanOrEqual(compactBand.top - 1e-3);
      expect(feetY).toBeLessThanOrEqual(compactBand.bottom + 1e-3);
    }
  });
});
