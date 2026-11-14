/**
 * Crypt world DOM tests (explorable-worlds task 14.6).
 *
 * Requirements: 9.1, 9.3, 9.5, 9.10, 9.12
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import WorldPlaceView, {
  type WorldPlaceViewProps,
} from "@/components/world/WorldPlaceView";
import { contrastRatio, parseHex, type Rgb } from "@/lib/contrast";
import type { GraveyardRow } from "@/lib/graveyard-view";
import { placePlots } from "@/lib/place-pipeline";
import { ambientBrightness } from "@/lib/world-motion";
import { computeWorldLayout } from "@/lib/world-layout";

afterEach(() => cleanup());

const noop = () => {};

function coffins(count: number): GraveyardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `coffin-${i}`,
    url: `https://github.com/octocat/coffin-${i}`,
    state: "coffin",
    daysQuiet: 400 + i * 30,
    decayLevel: null,
  })) as GraveyardRow[];
}

function props(rows: GraveyardRow[], over: Partial<WorldPlaceViewProps> = {}): WorldPlaceViewProps {
  return {
    place: "crypt",
    rows,
    activeFilter: "all",
    plotIndex: 0,
    selectedName: null,
    onFilterChange: noop,
    onPlotChange: noop,
    onSelect: noop,
    onReturn: noop,
    ...over,
  };
}

function layoutFor(rows: GraveyardRow[], plotIndex = 0) {
  const plot = placePlots("crypt", rows, "all", 12)[plotIndex] ?? [];
  return computeWorldLayout({
    place: "crypt",
    names: plot.map((r) => r.name),
    viewportW: window.innerWidth > 0 ? window.innerWidth : 1024,
    viewportH: window.innerHeight > 0 ? window.innerHeight : 812,
  });
}

/** Coffin counts of the populated Strata (chambers), read from the DOM. */
function chamberSizes(): number[] {
  return Array.from(screen.getByTestId("depth-scatter").querySelectorAll("ol"))
    .map((ol) => ol.querySelectorAll("li").length)
    .filter((n) => n > 0);
}

function tokens(): Map<string, string> {
  const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

describe("crypt world chambers", () => {
  it.each([
    [1, [1]],
    [2, [2]],
    [4, [4]],
    [5, [4, 1]],
    [8, [4, 4]],
    [9, [4, 4, 1]],
    [12, [4, 4, 4]],
  ])("%i coffins fill chambers %j (every chamber but the last holds 4)", (n, sizes) => {
    render(<WorldPlaceView {...props(coffins(n))} />);
    expect(screen.getAllByTestId("scatter-creature")).toHaveLength(n);
    expect(chamberSizes()).toEqual(sizes);
    const layout = layoutFor(coffins(n));
    expect(layout.chambers).toHaveLength(Math.ceil(n / 4));
    expect(layout.chambers!.map((c) => c.length)).toEqual(sizes);
    // entry stratum plus one per chamber (a single coffin uses the one-Stratum layout)
    expect(layout.strata).toHaveLength(n === 1 ? 1 : Math.ceil(n / 4) + 1);
  });

  it.each([2, 3, 4])("%i coffins use a length of 1.25 to 1.5 with one chamber", (n) => {
    const layout = layoutFor(coffins(n));
    expect(layout.lengthVh).toBeGreaterThanOrEqual(1.25);
    expect(layout.lengthVh).toBeLessThanOrEqual(1.5);
    expect(layout.chambers).toHaveLength(1);
  });

  it("recomputes chambers when the Plot changes", () => {
    const rows = coffins(14); // plot 0 holds 12, plot 1 holds 2
    const view = render(<WorldPlaceView {...props(rows, { plotIndex: 0 })} />);
    expect(chamberSizes()).toEqual([4, 4, 4]);
    view.rerender(<WorldPlaceView {...props(rows, { plotIndex: 1 })} />);
    expect(chamberSizes()).toEqual([2]);
    expect(screen.getAllByTestId("scatter-creature")).toHaveLength(2);
  });

  it("recomputes chambers when the filtered set changes", () => {
    const view = render(<WorldPlaceView {...props(coffins(9))} />);
    expect(chamberSizes()).toEqual([4, 4, 1]);
    view.rerender(<WorldPlaceView {...props(coffins(5), { activeFilter: "fresh" })} />);
    expect(chamberSizes()).toEqual([4, 1]);
  });
});

describe("crypt world plaque contrast (Req 9.5)", () => {
  const css = tokens();
  const hex = (k: string): Rgb => {
    const v = parseHex(css.get(k) ?? "");
    expect(v, k).not.toBeNull();
    return v!;
  };
  const dim = (c: Rgb, over: Rgb, alpha: number): Rgb => ({
    r: c.r * (1 - alpha) + over.r * alpha,
    g: c.g * (1 - alpha) + over.g * alpha,
    b: c.b * (1 - alpha) + over.b * alpha,
  });

  it("keeps plaque name and sub text at 4.5:1 or more at depth 1", () => {
    // CryptArt paints the overlay with `var(--color-night-sky)`, a declared
    // token; read its real value so the contrast check uses what is painted.
    const night: Rgb = hex("--color-night-sky");
    const src = readFileSync(join(process.cwd(), "components", "world", "CryptArt.tsx"), "utf8");
    expect(src).toContain("var(--color-night-sky)");
    expect(src).not.toContain("night-950");
    const alpha = 1 - ambientBrightness(1);
    for (const bgKey of ["--color-plaque-bg-top", "--color-plaque-bg-bottom"]) {
      for (const textKey of ["--color-plaque-name", "--color-plaque-sub"]) {
        const text = dim(hex(textKey), night, alpha);
        const bg = dim(hex(bgKey), night, alpha);
        expect(contrastRatio(text, bg), `${textKey} on ${bgKey}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("stacks the plaque layer above the darkness overlay and keeps coffins opaque", () => {
    render(<WorldPlaceView {...props(coffins(6))} />);
    const dark = screen.getByTestId("crypt-darkness");
    const layer = screen.getByTestId("depth-scatter");
    expect(dark.className).toContain("z-[12]");
    expect(layer.className).toContain("z-20");
    expect(parseFloat(dark.getAttribute("data-max-opacity") ?? "NaN")).toBeLessThanOrEqual(0.2 + 1e-9);
    for (const li of screen.getAllByTestId("scatter-creature")) {
      expect(li.style.opacity === "" || parseFloat(li.style.opacity) === 1).toBe(true);
    }
  });
});

describe("crypt world fog and mist", () => {
  it("renders no scene-fog or scene-fog-near", () => {
    render(<WorldPlaceView {...props(coffins(7))} />);
    expect(screen.queryByTestId("scene-fog")).toBeNull();
    expect(screen.queryByTestId("scene-fog-near")).toBeNull();
    expect(document.querySelector(".scene-fog, .scene-fog-near")).toBeNull();
  });

  it("keeps the mist token at or under 0.2 and tags it for the crypt", () => {
    expect(parseFloat(tokens().get("--world-mist-crypt") ?? "NaN")).toBeLessThanOrEqual(0.2);
    render(<WorldPlaceView {...props(coffins(7))} />);
    const mist = document.querySelectorAll<HTMLElement>(
      '[data-testid="place-mist-far"], [data-testid="place-mist-near"]',
    );
    expect(mist.length).toBeGreaterThan(0);
    mist.forEach((el) => {
      expect(el.getAttribute("data-place")).toBe("crypt");
      expect(el.outerHTML).toContain("var(--env-mist-opacity, 0)");
    });
  });
});
