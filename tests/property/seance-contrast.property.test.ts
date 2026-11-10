/**
 * Property 15: Transcript contrast holds for every profile.
 *
 * Reads app/globals.css as text and parses `--name: value;` lines, so the
 * test follows the real tokens.
 *
 * **Validates: Requirements 11.3, 13.1, 13.2, 13.8, 14.7, 15.12, 20.13**
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  compositeOver,
  contrastRatio,
  parseColor,
  relativeLuminance,
} from "../../lib/seance-contrast";
import { DECAY_PROFILES } from "../../lib/seance-decay";

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

/** Last declaration wins, as in the cascade. Comments are stripped first. */
function parseTokens(source: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /(--[a-z0-9-]+)\s*:\s*([^;{}]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) tokens.set(m[1], m[2].trim());
  return tokens;
}

const tokens = parseTokens(css);

function token(name: string): string {
  const v = tokens.get(name);
  if (v === undefined) throw new Error(`Token ${name} not found in globals.css`);
  return v;
}

const night800 = parseColor(token("--color-night-800"));
const moon100 = parseColor(token("--color-moon-100"));
const alphaMin = parseFloat(token("--smoke-alpha-min"));
const alphaMax = parseFloat(token("--smoke-alpha-max"));

const profiles = Object.values(DECAY_PROFILES);

describe("Property 15: transcript contrast holds for every profile", () => {
  it("parses the séance tokens", () => {
    expect(alphaMin).toBeGreaterThan(0);
    expect(alphaMax).toBeLessThanOrEqual(1);
    expect(alphaMin).toBeLessThanOrEqual(alphaMax);
  });

  for (const profile of profiles) {
    it(`profile ${profile.id}: moon-100 on smoke over night-800 is >= 4.5:1 for any alpha`, () => {
      const smoke = parseColor(token(profile.smokeToken));
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constantFrom(alphaMin, alphaMax),
            fc.double({ min: alphaMin, max: alphaMax, noNaN: true }),
          ),
          (alpha) => {
            const bg = compositeOver(smoke, alpha, night800);
            const ratio = contrastRatio(moon100, bg);
            expect(
              ratio,
              `profile ${profile.id} (${profile.smokeToken}) at alpha ${alpha}: contrast ${ratio.toFixed(2)}`,
            ).toBeGreaterThanOrEqual(4.5);
          },
        ),
        { numRuns: 100 },
      );
    });

    it(`profile ${profile.id}: smoke token luminance is at most 0.2`, () => {
      const lum = relativeLuminance(parseColor(token(profile.smokeToken)));
      expect(
        lum,
        `profile ${profile.id} (${profile.smokeToken}) luminance ${lum}`,
      ).toBeLessThanOrEqual(0.2);
    });
  }

  it("contrast function is symmetric, within [1, 21], and 1 for equal colours", () => {
    const rgb = fc.record({
      r: fc.integer({ min: 0, max: 255 }),
      g: fc.integer({ min: 0, max: 255 }),
      b: fc.integer({ min: 0, max: 255 }),
    });
    fc.assert(
      fc.property(rgb, rgb, (a, b) => {
        const ab = contrastRatio(a, b);
        expect(ab).toBeCloseTo(contrastRatio(b, a), 10);
        expect(ab).toBeGreaterThanOrEqual(1);
        expect(ab).toBeLessThanOrEqual(21 + 1e-9);
        expect(contrastRatio(a, a)).toBe(1);
      }),
      { numRuns: 100 },
    );
  });

  describe("accent and evidence colours against night-800", () => {
    const accents: Array<[string, string]> = [
      ["revive", "--color-ghost-300"],
      ["finish", "--color-candle-400"],
      ["seal", "--color-crimson-200"],
    ];
    for (const [verdict, name] of accents) {
      it(`verdict ${verdict} accent ${name} is >= 4.5:1`, () => {
        const ratio = contrastRatio(parseColor(token(name)), night800);
        expect(
          ratio,
          `verdict ${verdict} accent ${name}: contrast ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    }

    it("ledger evidence colour (--color-moon-300) is >= 4.5:1", () => {
      const ratio = contrastRatio(parseColor(token("--color-moon-300")), night800);
      expect(
        ratio,
        `ledger evidence --color-moon-300: contrast ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  });
});
