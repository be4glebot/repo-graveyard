/**
 * Regression: PlaceView and DepthScatter must agree with the CSS breakpoint.
 *
 * `useIsCompact()` (matchMedia `(max-width: 767px)`) is the single decider.
 * At 375 and 700 px with that query matching, the real PlaceView + real
 * DepthScatter must render the compact flow column, the bottom bar holding
 * only the pager, no `place-title-block`, and creatures/plaques placed by
 * `compactStackLayout` clear of the chrome. With the query not matching at
 * 1024 px the desktop chrome and scatter render.
 *
 * Requirements: 5.4, 5.6, 5.11, 9.7
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import PlaceView from "@/components/scene/PlaceView";
import {
  COMPACT_CHROME_FALLBACK_PX,
  DEPTH_ROWS,
  compactPlotSize,
  compactStackLayout,
  layoutCompactChrome,
  rectsIntersect,
  scatterLayout,
  stageBand,
  type SceneRect,
} from "@/lib/estate-view";
import type { GraveyardRow } from "@/lib/graveyard-view";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const EPS = 1e-6;

function ghostRows(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `ghost-${i}`,
    url: `https://github.com/octocat/ghost-${i}`,
    state: "ghost" as const,
    daysQuiet: i + 1,
    decayLevel: 0,
  }));
}

function stubMatchMedia(compact: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 767px)" ? compact : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function setViewport(w: number, h: number): void {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
}

/** Realistic sizes: scene w x h; chrome column and bar from the fallbacks. */
function stubLayout(w: number, h: number): void {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(w);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(h);
  const chrome = layoutCompactChrome(w, h, COMPACT_CHROME_FALLBACK_PX);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const id = this.getAttribute("data-testid");
      let top = 0;
      let bottom = 0;
      if (id === "place-view") {
        bottom = h;
      } else if (id === "place-chrome") {
        bottom = chrome.chips.bottom;
      } else if (id === "place-bottom-bar") {
        top = chrome.bottomBar.top;
        bottom = h;
      }
      return {
        x: 0,
        y: top,
        left: 0,
        right: w,
        top,
        bottom,
        width: w,
        height: bottom - top,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
  class FakeResizeObserver {
    private readonly cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element): void {
      this.cb(
        [
          {
            target,
            contentRect: { width: w, height: h } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver as unknown as typeof ResizeObserver);
}

function renderPlace(rows: GraveyardRow[]) {
  return render(
    <PlaceView
      place="sky"
      rows={rows}
      activeFilter="all"
      plotIndex={0}
      selectedName={null}
      onFilterChange={() => {}}
      onPlotChange={() => {}}
      onSelect={() => {}}
      onReturn={() => {}}
      reducedMotion
    />,
  );
}

function rect(cx: number, top: number, bottom: number, halfW: number): SceneRect {
  return {
    cx,
    cy: (top + bottom) / 2,
    left: cx - halfW,
    right: cx + halfW,
    top,
    bottom,
  };
}

const shrink = (r: SceneRect): SceneRect => ({
  ...r,
  left: r.left + EPS,
  right: r.right - EPS,
  top: r.top + EPS,
  bottom: r.bottom - EPS,
});

describe.each([
  { w: 375, h: 812 },
  { w: 700, h: 1024 },
])("compact PlaceView at $w x $h (matchMedia matches)", ({ w, h }) => {
  function setup() {
    stubMatchMedia(true);
    setViewport(w, h);
    stubLayout(w, h);
    return renderPlace(ghostRows(20));
  }

  it("renders the compact column, bottom bar with pager, and no title block", () => {
    setup();
    const column = screen.getByTestId("place-chrome");
    expect(column.className).not.toContain("left-0");
    expect(column.className).not.toContain("p-6");
    expect(within(column).getByTestId("return-to-gate")).toBeTruthy();
    expect(within(column).getByTestId("place-heading")).toBeTruthy();
    expect(within(column).getByTestId("filter-chips")).toBeTruthy();
    expect(screen.queryByTestId("place-title-block")).toBeNull();

    const bar = screen.getByTestId("place-bottom-bar");
    expect(within(bar).getByTestId("pager")).toBeTruthy();
    expect(within(bar).queryByTestId("filter-chips")).toBeNull();
    expect(within(bar).queryByTestId("return-to-gate")).toBeNull();
  });

  it("positions creatures and plaques with compactStackLayout, clear of the chrome", () => {
    setup();
    const scatter = screen.getByTestId("depth-scatter");
    expect(scatter.getAttribute("data-layout")).toBe("two-column");

    const creatures = screen.getAllByTestId("scatter-creature");
    const plaques = screen.getAllByTestId("scatter-plaque");
    expect(creatures).toHaveLength(compactPlotSize(w));
    expect(plaques).toHaveLength(creatures.length);

    const chrome = layoutCompactChrome(w, h, COMPACT_CHROME_FALLBACK_PX);
    const band = stageBand(h, chrome.chips.bottom, chrome.bottomBar.top);
    const names = creatures.map((el) => el.getAttribute("data-name") ?? "");
    const expected = compactStackLayout(
      scatterLayout(names, DEPTH_ROWS, "sky", "sky"),
      w,
      band,
      h,
    );

    const column = rect(w / 2, 0, chrome.chips.bottom, w / 2);
    const bar = rect(w / 2, chrome.bottomBar.top, h, w / 2);

    creatures.forEach((el, i) => {
      const e = expected[i];
      const feetX = (parseFloat(el.style.left) / 100) * w;
      const feetY = (parseFloat(el.style.top) / 100) * h;
      expect(feetX).toBeCloseTo(e.x * w, 3);
      expect(feetY).toBeCloseTo(e.y * h, 3);

      const side = e.creatureHeightPx;
      const creatureRect = rect(feetX, feetY - side, feetY, side / 2);
      expect(rectsIntersect(shrink(creatureRect), column)).toBe(false);
      expect(rectsIntersect(shrink(creatureRect), bar)).toBe(false);

      const pl = plaques[i];
      const pcx = (parseFloat(pl.style.left) / 100) * w;
      const pcy = (parseFloat(pl.style.top) / 100) * h;
      expect(pcx).toBeCloseTo(e.plaque.cx, 3);
      expect(pcy).toBeCloseTo(e.plaque.cy, 3);
      const pw = parseFloat(pl.style.width);
      expect(pw).toBeCloseTo(e.plaque.right - e.plaque.left, 3);
      const plaqueRect = rect(
        pcx,
        pcy - (e.plaque.bottom - e.plaque.top) / 2,
        pcy + (e.plaque.bottom - e.plaque.top) / 2,
        pw / 2,
      );
      expect(rectsIntersect(shrink(plaqueRect), column)).toBe(false);
      expect(rectsIntersect(shrink(plaqueRect), bar)).toBe(false);
    });
  });
});

describe("desktop PlaceView at 1024 px (matchMedia does not match)", () => {
  it("renders the desktop chrome and the scatter layout", () => {
    stubMatchMedia(false);
    setViewport(1024, 768);
    stubLayout(1024, 768);
    renderPlace(ghostRows(9));

    const chrome = screen.getByTestId("place-chrome");
    expect(chrome.className).toContain("absolute left-0 z-50 p-6");
    expect(screen.getByTestId("place-title-block")).toBeTruthy();
    expect(screen.queryByTestId("place-bottom-bar")).toBeNull();
    expect(screen.queryByTestId("place-compact-heading")).toBeNull();
    expect(screen.getByTestId("depth-scatter").getAttribute("data-layout")).toBe(
      "scatter",
    );
  });
});
