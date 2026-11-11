import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CSS-text checks for the séance visual pass: the primary control and the
 * building ritual. (The general rules - allowed animated properties, no hex,
 * flicker rate - are enforced for the whole séance block in seance-css.test.ts.)
 */
const raw = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

function rule(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(css);
  if (!m) throw new Error(`missing rule ${selector}`);
  return m[1];
}

describe("primary control styles", () => {
  it("ember border, ghost-300 text on night-800, full width", () => {
    const body = rule(".seance-primary");
    expect(body).toMatch(/border:\s*1px solid var\(--color-ember-500\)/);
    expect(body).toMatch(/color:\s*var\(--color-ghost-300\)/);
    expect(body).toMatch(/background:\s*var\(--color-night-800\)/);
    expect(body).toMatch(/width:\s*100%/);
  });

  it("is not full width from 768px up", () => {
    const m = /@media \(min-width: 768px\)\s*\{\s*\.seance-primary\s*\{([^}]*)\}/.exec(css);
    expect(m?.[1]).toMatch(/width:\s*auto/);
  });

  it("has a slow inner glow that appears on hover and focus", () => {
    expect(rule(".seance-primary::after")).toMatch(/box-shadow:\s*inset[^;]*var\(--color-ember-500\)/);
    expect(rule(".seance-primary::after")).toMatch(/transition:\s*opacity var\(--motion-seance-glow\)/);
    const dur = /--motion-seance-glow:\s*(\d+)ms/.exec(css);
    expect(Number(dur?.[1])).toBeGreaterThanOrEqual(500);
    expect(css).toMatch(/\.seance-primary:hover::after,\s*\.seance-primary:focus-visible::after\s*\{[^}]*opacity:\s*0\.85/);
  });

  it("has a disabled style and keeps the visible focus ring class", () => {
    expect(rule('.seance-primary[aria-disabled="true"]')).toMatch(/cursor:\s*default/);
    expect(rule(".seance-focus:focus-visible")).toMatch(/3px solid var\(--color-candle-400\)/);
  });
});

describe("ritual styles", () => {
  it("the ember colour is a token, defined once outside the séance block", () => {
    expect(css.match(/--color-ember-500:/g)).toHaveLength(1);
    expect(css.indexOf("--color-ember-500:")).toBeLessThan(css.indexOf("[data-seance-region] :focus-visible"));
  });

  it("frost uses ghost-300 and creeps in over seconds, the held stage breathes slowly", () => {
    expect(rule(".ritual-frost")).toMatch(/var\(--color-ghost-300\)/);
    expect(rule(".ritual-frost")).toMatch(/transition:\s*opacity 2000ms[^;]*,\s*transform 2600ms/);
    const breathe = /--motion-ritual-breathe:\s*(\d+(?:\.\d+)?)s/.exec(css);
    const flicker = /--motion-ritual-flicker:\s*(\d+(?:\.\d+)?)s/.exec(css);
    expect(Number(breathe?.[1])).toBeGreaterThanOrEqual(4);
    expect(Number(flicker?.[1])).toBeGreaterThanOrEqual(2);
  });

  it("one candle ignites at a time (240 ms each, five fit inside 1.2 s)", () => {
    expect(/--motion-ritual-candle:\s*(\d+)ms/.exec(css)?.[1]).toBe("240");
    expect(5 * 240).toBeLessThanOrEqual(1200);
  });

  it("exit animations exist for gutter, dissolve and recede", () => {
    for (const name of ["ritual-gutter", "ritual-dissolve", "ritual-recede"]) {
      expect(css).toContain(`@keyframes ${name}`);
    }
    expect(rule(".ritual-exit-silent .ritual-flame")).toMatch(/animation-delay:\s*var\(--snuff-delay/);
  });

  it("reduced motion: no animation or transform on the new classes, text fades in 200 ms", () => {
    const start = css.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    const block = css.slice(start);
    expect(block).toMatch(/\.ritual-flame\[data-holding="true"\][\s\S]*?animation:\s*none/);
    expect(block).toMatch(/\.ritual-frost\[data-holding="true"\][\s\S]*?animation:\s*none/);
    expect(block).toMatch(/\.ritual-lean\[data-lean="true"\][\s\S]*?transform:\s*none/);
    expect(block).toMatch(/\.ritual-smoke-rise\[data-on="true"\][\s\S]*?transform:\s*none/);
    expect(block).toMatch(/\.ritual-text\[data-visible="true"\]\s*\{\s*animation:\s*ritual-text-fade var\(--motion-ritual-fade-reduced\) linear both/);
    expect(block).toMatch(/\.seance-primary::after\s*\{\s*transition:\s*opacity var\(--motion-ritual-fade-reduced\) linear/);
    const fade = /@keyframes ritual-text-fade\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(fade).not.toMatch(/transform|filter/);
  });
});