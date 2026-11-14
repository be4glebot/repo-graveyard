/**
 * World hydration regression (explorable-worlds task 23.1).
 *
 * The ground path's inline gradient once carried an unrounded float from
 * `Math.sin`, which differs in the last digit between the Node server and the
 * browser, so React reported a hydration mismatch on `ground-path`. These tests
 * pin: (1) the first client render hydrates the server markup without a warning
 * at several window sizes, for sky, ground and crypt; (2) coordinates are
 * rounded to 2 decimals; (3) a 1-ulp difference in `Math.sin` no longer changes
 * the markup.
 */
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import GroundArt, { ribbonStones, stoneGradient } from "@/components/world/GroundArt";
import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { computeWorldLayout } from "@/lib/world-layout";

const noop = () => {};

function rowsFor(state: "ghost" | "tombstone" | "coffin", n: number): GraveyardRow[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `${state}-${i}`,
    url: `https://github.com/octocat/${state}-${i}`,
    state,
    daysQuiet: 5 + i * 40,
    decayLevel: state === "ghost" ? i % 4 : null,
  })) as GraveyardRow[];
}

const CASES = [
  { place: "sky", rows: rowsFor("ghost", 7) },
  { place: "ground", rows: rowsFor("tombstone", 9) },
  { place: "crypt", rows: rowsFor("coffin", 6) },
] as const;

function props(place: WorldPlaceViewProps["place"], rows: GraveyardRow[]): WorldPlaceViewProps {
  return {
    place,
    rows,
    activeFilter: "all",
    plotIndex: 0,
    selectedName: null,
    onFilterChange: noop,
    onPlotChange: noop,
    onSelect: noop,
    onReturn: noop,
    reducedMotion: true,
  };
}

function setWindow(w: number, h: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("world hydration", () => {
  for (const { place, rows } of CASES) {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
      [3840, 2160],
    ]) {
      it(`${place}: hydrating the server markup warns nothing at ${w}x${h}`, async () => {
        setWindow(w, h);
        const element = <WorldPlaceView {...props(place, [...rows])} />;
        const html = renderToString(element);
        const container = document.createElement("div");
        container.innerHTML = html;
        document.body.appendChild(container);

        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        let root!: ReturnType<typeof hydrateRoot>;
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        const text = errors.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
        expect(text).not.toMatch(/hydrat|didn't match|did not match/i);
        act(() => root.unmount());
      });
    }
  }

  it("rounds ground coordinates to at most 2 decimals", () => {
    const layout = computeWorldLayout({
      place: "ground",
      names: rowsFor("tombstone", 9).map((r) => r.name),
      viewportW: 1337,
      viewportH: 777,
    });
    const decimals = (n: number): number => (String(n).split(".")[1] ?? "").length;
    for (const p of layout.path ?? []) expect(decimals(p.x)).toBeLessThanOrEqual(2);
    for (const s of ribbonStones(layout, 1337)) {
      expect(decimals(s.x)).toBeLessThanOrEqual(2);
    }
    const gradient = stoneGradient(475.34064963459684, 76.9000000001);
    for (const m of gradient.matchAll(/at (-?[\d.]+)px (-?[\d.]+)px/g)) {
      expect(decimals(Number(m[1]))).toBeLessThanOrEqual(2);
      expect(decimals(Number(m[2]))).toBeLessThanOrEqual(2);
    }
  });

  it("markup is identical when Math.sin differs by one ulp", () => {
    const names = rowsFor("tombstone", 9).map((r) => r.name);
    const render = (): string => {
      const layout = computeWorldLayout({ place: "ground", names, viewportW: 1024, viewportH: 812 });
      return renderToString(<GroundArt layout={layout} viewportW={1024} reducedMotion />);
    };
    const baseline = render();
    const realSin = Math.sin;
    vi.spyOn(Math, "sin").mockImplementation((x) => {
      const v = realSin(x);
      return v + Math.abs(v) * 2 ** -52;
    });
    expect(render()).toBe(baseline);
  });
});
