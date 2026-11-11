import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Landing token contrast (landing-mobile-states 11.2).
 * Requirements: 1.4, 1.8, 9.2
 *
 * Parses app/globals.css and resolves the colour formats the landing uses:
 * #rgb/#rrggbb, rgb()/rgba(), var(--color-*) and
 * color-mix(in srgb, <color> N%, transparent).
 */

const CSS = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

type RGB = [number, number, number];

const tokens = new Map<string, string>();
for (const m of CSS.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
  // Later @theme blocks never redefine these, but keep the first anyway.
  if (!tokens.has(m[1])) tokens.set(m[1], m[2].replace(/\/\*.*?\*\//g, "").trim());
}

function parseColor(value: string): RGB {
  const v = value.trim();
  const varMatch = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  if (varMatch) {
    const resolved = tokens.get(varMatch[1]);
    if (!resolved) throw new Error(`Unknown token ${varMatch[1]}`);
    return parseColor(resolved);
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(v);
  if (fn) {
    const [r, g, b] = fn[1].split(",").map((p) => parseFloat(p));
    return [r, g, b];
  }
  throw new Error(`Unsupported colour format: ${value}`);
}

function tokenColor(name: string): RGB {
  const v = tokens.get(`--color-${name}`);
  if (!v) throw new Error(`Missing token --color-${name}`);
  return parseColor(v);
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Opaque colour of each color-mix(...) stop in the .landing-scrim gradient. */
function scrimStops(): RGB[] {
  const block = /\.landing-scrim\s*\{([^}]*)\}/.exec(CSS);
  if (!block) throw new Error(".landing-scrim rule not found");
  const stops: RGB[] = [];
  for (const m of block[1].matchAll(
    /color-mix\(\s*in srgb\s*,\s*(var\(--[a-z0-9-]+\)|#[0-9a-f]{3,6})\s+\d+%\s*,\s*transparent\s*\)/gi,
  )) {
    stops.push(parseColor(m[1]));
  }
  return stops;
}

// Text colours used by app/page.tsx, UsernameForm, HowItWorks, LandingFooter.
const TEXT_TOKENS = [
  "scene-fg", // h1, tagline, label, input text, step titles, footer
  "scene-fg-muted", // input placeholder
  "crimson-200", // validation error
];

describe("landing token contrast", () => {
  const stops = scrimStops();
  const bgs: Array<[string, RGB]> = [
    ["solid fallback --color-night-sky", tokenColor("night-sky")],
    ...stops.map((s, i): [string, RGB] => [`scrim stop ${i + 1}`, s]),
  ];

  it("finds the scrim gradient stops", () => {
    expect(stops.length).toBeGreaterThanOrEqual(2);
  });

  for (const text of TEXT_TOKENS) {
    for (const [label, bg] of bgs) {
      it(`--color-${text} on ${label} >= 4.5`, () => {
        expect(contrast(tokenColor(text), bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("button labels meet 4.5 on their plaque fills", () => {
    const pairs: Array<[string, string]> = [
      ["iron-label", "iron-bg-top"],
      ["iron-label", "iron-bg-bottom"],
      ["moon-100", "crimson-700"],
      ["moon-100", "crimson-500"],
    ];
    for (const [fg, bg] of pairs) {
      expect(contrast(tokenColor(fg), tokenColor(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("candle-400 focus ring meets 3.0 against the adjacent backgrounds", () => {
    const ring = tokenColor("candle-400");
    for (const [label, bg] of bgs) {
      expect(contrast(ring, bg), label).toBeGreaterThanOrEqual(3);
    }
  });
});
