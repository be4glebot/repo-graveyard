import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const start = css.indexOf("Daytime Lights On");
const end = css.indexOf("The Séance (Spec 4, task 11.1)");
const daySection = css.slice(start, end);

/** Reads `--name: #hex;` from the day section (day tokens and the data-theme block). */
function token(name: string): string {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`).exec(daySection);
  if (!m) throw new Error(`Day token ${name} not found as a hex value in app/globals.css`);
  return m[1];
}

/** [text token, background token] pairs that must reach WCAG AA for body text. */
const PAIRS: Array<[string, string]> = [
  ["--color-day-ink", "--color-day-parchment"],
  ["--color-day-ink-muted", "--color-day-parchment"],
  ["--color-day-gold-ink", "--color-day-gold-bg"],
  ["--color-day-wordmark-ink", "--color-day-haze"],
  ["--color-day-wordmark-ink", "--color-night-sky-top"],
  ["--color-day-wordmark-ink", "--color-night-sky-mid"],
  ["--color-scene-fg", "--color-night-sky"],
  ["--color-scene-fg", "--color-night-sky-top"],
  ["--color-scene-fg", "--color-night-sky-bottom"],
  ["--color-scene-fg-muted", "--color-night-sky"],
  ["--color-scene-fg-muted", "--color-night-sky-bottom"],
  ["--color-scene-fg-faint", "--color-night-sky"],
  ["--color-scene-fg-faint", "--color-night-sky-bottom"],
  ["--color-day-ink", "--color-day-haze"],
  // Day chrome (task 12.6): buttons, plates, panels, chips, focus ring.
  ["--color-day-ink", "--color-day-chrome-hover"],
  ["--color-day-ink-muted", "--color-day-chrome-hover"],
  ["--color-day-ink-muted", "--color-day-gold-bg"],
  ["--color-day-candle-ring", "--color-day-parchment"],
  ["--color-day-candle-ring", "--color-day-chrome-hover"],
  ["--color-day-crimson-ink", "--color-day-parchment"],
  ["--color-day-gold-ink", "--color-day-parchment"],
];

describe("day text/background contrast (>= 4.5:1)", () => {
  it("finds the day section in globals.css above the séance block", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  it("every day text/background pair meets 4.5:1", () => {
    const failures: string[] = [];
    for (const [fg, bg] of PAIRS) {
      const ratio = contrastRatio(token(fg), token(bg));
      if (ratio < 4.5) {
        failures.push(
          `${fg} (${token(fg)}) on ${bg} (${token(bg)}) = ${ratio.toFixed(2)}:1, needs 4.5:1`,
        );
      }
    }
    expect(failures, `Day contrast failures:\n${failures.join("\n")}`).toEqual([]);
  });
});
