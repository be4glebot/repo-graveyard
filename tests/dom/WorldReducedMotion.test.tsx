/**
 * Reduced-motion DOM tests for an explorable world (`WorldPlaceView`).
 *
 * jsdom does not evaluate CSS, so the checks are on the rendered DOM (inline
 * transforms, class tokens, attributes, listeners) plus one source assertion
 * that pins the `@media (prefers-reduced-motion: reduce)` rules in
 * `app/globals.css`. Each negative assertion has a counter-check with motion on,
 * so none of them is vacuous.
 *
 * Requirements: 5.8, 10.3, 10.4, 11.10, 12.8
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import WorldPlaceView from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_QUERY = "(hover: hover) and (pointer: fine)";

function stubMedia(reduce: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    ((query: string): MediaQueryList =>
      ({
        matches: (query === REDUCE_QUERY && reduce) || query === FINE_QUERY,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof matchMedia,
  );
}

let frames: Array<FrameRequestCallback | null> = [];
function flushFrames(): void {
  act(() => {
    for (let pass = 0; pass < 3; pass++) {
      const queued = frames;
      frames = [];
      for (const cb of queued) cb?.(0);
    }
  });
}

let observers = 0;
class FakeIntersectionObserver {
  constructor() {
    observers += 1;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const scrollIntoView = vi.fn();

beforeEach(() => {
  frames = [];
  observers = 0;
  scrollIntoView.mockReset();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames[id - 1] = null;
  });
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  // jsdom has no CSS.escape; stratum ids are plain slugs.
  vi.stubGlobal("CSS", { escape: (s: string) => s });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: scrollIntoView,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
});

const rows: GraveyardRow[] = Array.from({ length: 6 }, (_, i) => ({
  name: `sky-repo-${i}`,
  url: `https://github.com/octocat/sky-repo-${i}`,
  state: "ghost",
  daysQuiet: 10 + i,
  decayLevel: i % 4,
}));

function renderWorld(reducedMotion: boolean) {
  stubMedia(reducedMotion);
  return render(
    <WorldPlaceView
      place="sky"
      rows={rows}
      activeFilter="all"
      plotIndex={0}
      selectedName={null}
      onFilterChange={() => {}}
      onPlotChange={() => {}}
      onSelect={() => {}}
      onReturn={() => {}}
      reducedMotion={reducedMotion}
      art={<div data-reveal="" data-testid="reveal-probe" />}
    />,
  );
}

function classTokens(container: HTMLElement): string[] {
  const out: string[] = [];
  container.querySelectorAll("[class]").forEach((el) => {
    const cls = el.getAttribute("class");
    if (cls) out.push(...cls.split(/\s+/).filter(Boolean));
  });
  return out;
}

function movePointer(root: HTMLElement): void {
  root.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800, x: 0, y: 0, toJSON() {} }) as DOMRect;
  fireEvent.pointerMove(root, { clientX: 900, clientY: 100 });
  flushFrames();
}

describe("WorldPlaceView under Reduced_Motion", () => {
  it("applies no inline transform to any band and writes no pointer offset", () => {
    const { container } = renderWorld(true);
    const bands = container.querySelectorAll<HTMLElement>(".world-band");
    expect(bands.length).toBeGreaterThan(0);
    for (const band of bands) expect(band.style.transform).toBe("");

    const root = screen.getByTestId("place-view");
    movePointer(root);
    expect(root.style.getPropertyValue("--px")).toBe("");
    expect(root.style.getPropertyValue("--py")).toBe("");
  });

  it("counter-check: pointer parallax is written when motion is allowed", () => {
    renderWorld(false);
    const root = screen.getByTestId("place-view");
    movePointer(root);
    expect(root.style.getPropertyValue("--px")).not.toBe("");
  });

  it("keeps the creature band at rate 1 and zeroes every other band in CSS", () => {
    const { container } = renderWorld(true);
    expect(screen.getByTestId("depth-scatter").getAttribute("data-band-rate")).toBe("1");
    expect(container.querySelector(".world-band-creatures, [data-band-rate]")).not.toBeNull();

    const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
    const reduce = css.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.camera-drift,[\s\S]*?\n\}/,
    );
    expect(reduce).not.toBeNull();
    const block = reduce![0];
    for (const band of ["bg", "mid", "near", "fg"]) {
      expect(block).toContain(`.world-band-${band}`);
    }
    expect(block).toMatch(/\.world-band-fg\s*\{\s*transform:\s*none/);
    expect(block).toMatch(/\.world-reveal[\s\S]*opacity:\s*1[\s\S]*transform:\s*none[\s\S]*transition:\s*none/);
  });

  it("still scrolls natively to the same offsets, writing --world-scroll in both modes", () => {
    for (const reduced of [true, false]) {
      const { unmount } = renderWorld(reduced);
      const scroller = screen.getByTestId("world-scroller");
      Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 300 });
      fireEvent.scroll(scroller);
      flushFrames();
      expect(screen.getByTestId("place-view").style.getPropertyValue("--world-scroll")).toBe("300");
      unmount();
    }
  });

  it("presets every reveal and creates no observer", () => {
    renderWorld(true);
    expect(screen.getByTestId("reveal-probe").getAttribute("data-revealed")).toBe("true");
    expect(observers).toBe(0);
  });

  it("counter-check: reveals stay pending behind an observer when motion is allowed", () => {
    renderWorld(false);
    expect(observers).toBeGreaterThan(0);
    expect(screen.getByTestId("reveal-probe").getAttribute("data-revealed")).toBeNull();
  });

  it("renders no ambient animation classes", () => {
    const { container } = renderWorld(true);
    const tokens = classTokens(container);
    for (const t of ["env-mist", "env-mist-near", "camera-drift", "lantern-flicker"]) {
      expect(tokens).not.toContain(t);
    }
    expect(container.querySelector("[data-testid='place-mist-far']")).not.toBeNull();
  });

  it("counter-check: ambient sway classes are present when motion is allowed", () => {
    const { container } = renderWorld(false);
    const tokens = classTokens(container);
    expect(tokens).toContain("env-mist");
    expect(tokens).toContain("env-mist-near");
  });

  it("programmatic scroll (depth marker) uses behavior auto", () => {
    renderWorld(true);
    fireEvent.click(screen.getByTestId("depth-step-1"));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ behavior: "auto" });
  });

  it("counter-check: programmatic scroll is smooth when motion is allowed", () => {
    renderWorld(false);
    fireEvent.click(screen.getByTestId("depth-step-1"));
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ behavior: "smooth" });
  });
});
