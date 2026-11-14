import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");
const rule = (sel: string) => {
  const i = css.indexOf(`${sel} {`);
  expect(i, sel).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("seance candle visuals", () => {
  it("flame has a gradient body, bright core and glow", () => {
    expect(rule(".ritual-flame::before")).toMatch(/linear-gradient\(135deg/);
    expect(rule(".ritual-flame::before")).toMatch(/box-shadow:[^;]*var\(--color-ember-500\)/);
    expect(rule(".ritual-flame::after")).toMatch(/var\(--color-moon-100\)/);
  });

  it("wax has highlight and drips; holder and light spill exist", () => {
    expect(rule(".ritual-wax::before")).toContain("linear-gradient");
    expect(rule(".ritual-wax::after")).toContain("no-repeat");
    expect(rule(".ritual-holder")).toContain("var(--color-brass-surface");
    expect(rule(".ritual-holder::before")).toMatch(/radial-gradient\(ellipse, var\(--color-ember-500\)/);
  });

  it("flame, glow and spill flicker slower than 3 per second and use transform/opacity", () => {
    for (const name of ["ritual-flame-flicker", "ritual-glow-breathe"]) {
      const body = new RegExp(`@keyframes ${name}\\s*\\{[\\s\\S]*?\\n\\}`).exec(css)?.[0] ?? "";
      expect(body, name).toBeTruthy();
      expect(body.replace(/opacity|transform/g, "")).not.toMatch(/(filter|width|height|top|left):/);
    }
    expect(rule(".ritual-holder::before")).toMatch(/ritual-glow-breathe 1\.7s/);
  });

  it("reduced motion stops the new animations", () => {
    const block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toContain('.ritual-flame:not([data-holding="true"])');
    expect(block).toContain(".ritual-glow,");
    expect(block).toContain(".ritual-holder::before");
  });
});
