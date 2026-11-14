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
  compactPlotSize,
  layoutCompactChrome,
} from "@/lib/estate-view";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { placePlots } from "@/lib/place-pipeline";
import { computeWorldLayout, worldColumns } from "@/lib/world-layout";

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
    // Sky is a world now (Req 17.5): the chrome is `world-chrome-top`, a
    // sticky zero-height host inside the scroller, instead of `place-chrome`.
    const top = screen.getByTestId("world-chrome-top");
    const column = screen.getByTestId("place-chips-row").parentElement as HTMLElement;
    expect(top.contains(column)).toBe(true);
    // Compact column: full-width stack, not the desktop centred title layout.
    expect(column.className).toContain("items-stretch");
    expect(column.className).not.toContain("place-title-clear");
    expect(column.className).not.toContain("px-6");
    expect(within(top).getByTestId("return-to-gate")).toBeTruthy();
    expect(within(top).getByTestId("place-heading")).toBeTruthy();
    expect(within(top).getByTestId("filter-chips")).toBeTruthy();
    // Chips scroll horizontally on compact.
    expect(screen.getByTestId("place-chips-row").style.touchAction).toBe("pan-x");
    expect(screen.queryByTestId("place-title-block")).toBeNull();

    const bar = screen.getByTestId("place-bottom-bar");
    expect(within(bar).getByTestId("pager")).toBeTruthy();
    expect(within(bar).queryByTestId("filter-chips")).toBeNull();
    expect(within(bar).queryByTestId("return-to-gate")).toBeNull();
    // The bottom bar clears the home indicator.
    expect(bar.style.paddingBottom).toContain("safe-area-inset-bottom");
    expect(screen.getByTestId("world-scroller")).toBeTruthy();
  });

  it("positions creatures with the world layout, inside the width", () => {
    setup();
    // Sky is a world now (Req 17.5): there is no `data-layout` on the scatter;
    // the world layout's `columns` and slot rectangles replace it.
    const creatures = screen.getAllByTestId("scatter-creature");
    expect(creatures).toHaveLength(compactPlotSize(w));

    const plot = placePlots("sky", ghostRows(20), "all", compactPlotSize(w))[0];
    const layout = computeWorldLayout({
      place: "sky",
      names: plot.map((r) => r.name),
      viewportW: w,
      viewportH: h,
    });
    expect(layout.columns).toBe(worldColumns(plot.length, w));

    creatures.forEach((el) => {
      const slot = layout.slots[plot.findIndex((r) => r.name === el.getAttribute("data-name"))];
      // World slots are `left %`, `top px` (centre of the creature box).
      const cx = (parseFloat(el.style.left) / 100) * w;
      const cy = parseFloat(el.style.top);
      expect(cx).toBeCloseTo(slot.cx, 3);
      expect(cy).toBeCloseTo(slot.cy, 3);
      expect(parseFloat(el.style.width)).toBeCloseTo(slot.size, 3);

      const half = slot.size / 2;
      expect(cx - half).toBeGreaterThanOrEqual(-EPS);
      expect(cx + half).toBeLessThanOrEqual(w + EPS);
    });
  });
});

describe("desktop PlaceView at 1024 px (matchMedia does not match)", () => {
  it("renders the desktop chrome and the scatter layout", () => {
    stubMatchMedia(false);
    setViewport(1024, 768);
    stubLayout(1024, 768);
    renderPlace(ghostRows(9));

    // Sky is a world now (Req 17.5): desktop chrome is the centred title
    // layout inside `world-chrome-top`; the pager bar exists on every
    // viewport, and there is no `data-layout` (the world layout replaces it).
    const top = screen.getByTestId("world-chrome-top");
    const column = screen.getByTestId("place-chips-row").parentElement as HTMLElement;
    expect(top.contains(column)).toBe(true);
    expect(column.className).toContain("place-title-clear");
    expect(column.className).toContain("items-center");
    expect(column.className).not.toContain("items-stretch");
    expect(screen.getByTestId("place-chips-row").style.touchAction).toBe("");
    expect(screen.queryByTestId("place-title-block")).toBeNull();
    expect(within(top).getByTestId("place-heading")).toBeTruthy();
    expect(within(screen.getByTestId("place-bottom-bar")).getByTestId("pager")).toBeTruthy();
    expect(screen.queryByTestId("place-compact-heading")).toBeNull();
    expect(screen.getByTestId("world-scroller")).toBeTruthy();
    expect(screen.getByTestId("depth-scatter").getAttribute("data-layout")).toBeNull();
  });
});
