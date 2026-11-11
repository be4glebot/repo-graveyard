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
describe("visual fixes from the browser check", () => {
  it("candles are about twice as large, with a teardrop flame and a warm glow", () => {
    const flame = rule(".ritual-flame");
    expect(flame).toMatch(/width:\s*18px/);
    expect(flame).toMatch(/height:\s*28px/);
    expect(flame).toMatch(/filter:\s*blur\(/);
    const drop = rule(".ritual-flame::before");
    expect(drop).toMatch(/border-radius:\s*0 50% 50% 50%/);
    expect(drop).toMatch(/transform:\s*rotate\(45deg\)/);
    const wax = rule(".ritual-wax");
    expect(wax).toMatch(/width:\s*(10|11|12)px/);
    expect(wax).toMatch(/height:\s*var\(--wax-h/);
    expect(wax).toContain("linear-gradient(to bottom, var(--color-moon-300), var(--color-night-sky))");
    expect(wax).toMatch(/border-radius:\s*45% 55% 0 0/);
    const wick = rule(".ritual-wick");
    expect(wick).toMatch(/width:\s*2px/);
    expect(wick).toMatch(/height:\s*7px/);
    expect(wick).toMatch(/background:\s*var\(--color-night-sky\)/);
    const glow = rule(".ritual-glow");
    expect(glow).toMatch(/radial-gradient\([^;]*var\(--color-ember-500\)/);
    expect(glow).toMatch(/filter:\s*blur\(/);
  });

  it("the portrait is dimmed to 60% over a blurred, low-opacity cold halo", () => {
    expect(rule(".ritual-portrait")).toMatch(/opacity:\s*0\.6/);
    const halo = rule(".ritual-halo");
    expect(halo).toMatch(/radial-gradient\([^;]*var\(--color-ghost-300\)[^;]*transparent/);
    expect(halo).toMatch(/filter:\s*blur\(/);
    expect(Number(/opacity:\s*([\d.]+)/.exec(halo)?.[1])).toBeLessThanOrEqual(0.25);
    expect(halo).not.toMatch(/background:\s*var\(/);
  });

  it("frost is soft: a blurred radial tint masked by fractal noise, no straight lines, peak 0.4", () => {
    expect(rule('.ritual-frost[data-on="true"]')).toMatch(/opacity:\s*0\.4\b/);
    const frost = rule(".ritual-frost");
    expect(frost).not.toMatch(/repeating-|conic-gradient|linear-gradient/);
    expect(frost).toMatch(/radial-gradient\([^;]*var\(--color-ghost-300\)[^;]*transparent/);
    expect(frost).toMatch(/filter:\s*blur\(/);
    const noise = /--frost-noise:\s*([^;]*);/.exec(frost)?.[1] ?? "";
    expect(noise).toContain("feTurbulence");
    expect(noise).toContain("fractalNoise");
    expect(noise).toContain("numOctaves");
    expect(noise).not.toContain("#");
    expect(frost).toMatch(/(^|[\s;])mask-image:\s*var\(--frost-noise\)/);
    expect(frost).toMatch(/-webkit-mask-image:\s*var\(--frost-noise\)/);
    expect(css).not.toContain("repeating-conic-gradient");
    expect(css).not.toContain("conic-gradient");
    expect(css).toMatch(
      /@keyframes ritual-frost-breathe\s*\{\s*0%,\s*100%\s*\{\s*opacity:\s*0\.4;[^}]*\}\s*50%\s*\{\s*opacity:\s*0\.32/,
    );
    for (const c of ["tl", "tr", "bl", "br"]) {
      const body = rule(`.ritual-frost[data-corner="${c}"]`);
      expect(body).toMatch(/--mx:/);
      expect(body).toMatch(/--my:/);
    }
  });

  it("smoke fades at its top and bottom edge", () => {
    const smoke = rule(".ritual-smoke-rise");
    const grad = "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)";
    expect(smoke).toContain(`mask-image: ${grad}`);
    expect(smoke).toContain(`-webkit-mask-image: ${grad}`);
  });

  it("portrait is sized from --portrait-size", () => {
    const portrait = rule(".ritual-portrait");
    expect(portrait).toMatch(/width:\s*var\(--portrait-size, 168px\)/);
    expect(portrait).toMatch(/opacity:\s*0\.6/);
    expect(rule(".ritual-halo")).toMatch(/width:\s*calc\(var\(--portrait-size, 168px\) \* 1\.8\)/);
    expect(css).toMatch(/\.ritual-portrait img\s*\{[^}]*object-fit:\s*contain/);
  });

  it("ritual layer sits below the header and the box fits the screen", () => {
    expect(rule(".ritual-layer")).toMatch(/top:\s*var\(--site-header-h\)/);
    expect(rule(".ritual-box")).toMatch(/max-height:\s*calc\(100dvh - var\(--site-header-h\) - 96px\)/);
  });

  it("stage text reads over smoke: a soft text-shadow and a brighter peak", () => {
    expect(rule(".ritual-text")).toMatch(/text-shadow:[^;]*var\(--color-night-sky\)/);
    expect(css).toMatch(/@keyframes ritual-text-in[\s\S]*?100%\s*\{\s*opacity:\s*0\.85/);
  });

  it("the cause line is sentence case in the narrative font", () => {
    const cause = rule(".cause-engraved");
    expect(cause).toMatch(/font-family:\s*var\(--font-narrative\)/);
    expect(cause).toMatch(/text-transform:\s*none/);
    expect(cause).not.toMatch(/uppercase|--font-heading/);
  });

  it("scroll targets clear the fixed site header", () => {
    expect(rule(".seance-scroll-target")).toMatch(/scroll-margin-top:\s*var\(--site-header-h\)/);
  });
});