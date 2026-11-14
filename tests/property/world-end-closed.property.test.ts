// Feature: explorable-worlds, task 24.1: the end of every world is closed and
// the native scrollbar is hidden (depth marker is the progress cue).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { cryptBandGeometry } from "@/components/world/CryptArt";
import { groundBandGeometry } from "@/components/world/GroundArt";
import { skyBandGeometry } from "@/components/world/SkyArt";
import { bottomTailPx, computeWorldLayout, type WorldPlace } from "@/lib/world-layout";

const ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");

/** Parallax lag of the slowest band at the very end of the scroll (px). */
const LAG_RATE = 0.12;
const POINTER_MAX = 26;

const places: WorldPlace[] = ["sky", "ground", "crypt"];

describe("world scroller scrollbar is hidden (24.1)", () => {
  it("hides the native bar in Firefox and WebKit/Blink on the world scroller", () => {
    expect(css).toMatch(/\[data-world-scroller\]\s*\{[^}]*scrollbar-width:\s*none/);
    expect(css).toMatch(/\[data-world-scroller\]::-webkit-scrollbar[^{]*\{[^}]*display:\s*none/);
  });

  it("keeps the scroller natively scrollable", () => {
    const src = readFileSync(join(ROOT, "components/world/WorldScroller.tsx"), "utf8");
    expect(src).toContain("overflow-y-auto");
  });

  it("also hides the bar on the Hub and the gate view", () => {
    expect(css).toMatch(/\[data-testid="estate-map"\][^{]*\{[^}]*scrollbar-width:\s*none/);
  });
});

describe("the last stratum's art reaches the world bottom (24.1)", () => {
  it("stage clips parallax overflow so scrolling ends on the stage bottom", () => {
    const src = readFileSync(join(ROOT, "components/world/WorldStage.tsx"), "utf8");
    expect(src).toMatch(/contain:\s*"paint"/);
  });

  it("property: even with the end-of-scroll parallax lag, the last art band covers the stage bottom", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...places),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 320, max: 1920 }),
        fc.integer({ min: 600, max: 1400 }),
        (place, n, w, h) => {
          const names = Array.from({ length: n }, (_, i) => `repo-${i}`);
          const layout = computeWorldLayout({ place, names, viewportW: w, viewportH: h });
          const last = layout.strata[layout.strata.length - 1];
          const bands =
            place === "sky"
              ? skyBandGeometry(layout, w, false)
              : place === "ground"
                ? groundBandGeometry(layout)
                : cryptBandGeometry(layout);
          const b = bands[bands.length - 1];
          const bottom = b.top + b.height;
          const lag = Math.max(0, layout.viewportH - (last.bottom - last.top)) * LAG_RATE + POINTER_MAX;
          // Lagging up by `lag` still leaves the band at or below the stage bottom.
          expect(bottom - lag).toBeGreaterThanOrEqual(layout.heightPx);
        },
      ),
      { numRuns: 120 },
    );
  });

  it("bottomTailPx is finite, positive and bounded for any strata and viewport", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5000 }), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: -10, max: 4000 }),
        (heights, vh) => {
          let y = 0;
          const strata = heights.map((hh) => ({ top: y, bottom: (y += hh) }));
          const t = bottomTailPx(strata, vh);
          expect(Number.isFinite(t)).toBe(true);
          expect(t).toBeGreaterThan(0);
          expect(t).toBeLessThan(600);
        },
      ),
      { numRuns: 100 },
    );
    expect(bottomTailPx([], 900)).toBe(0);
  });
});
