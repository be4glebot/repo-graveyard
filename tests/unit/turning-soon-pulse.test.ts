import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { PULSE_HZ_MAX, PULSE_HZ_MIN, turningPulseHz, turningPulseSeconds } from "@/lib/turning-pulse";

const css = readFileSync("app/globals.css", "utf8");

describe("turning-soon pulse rate", () => {
  it("is ~0.6 Hz at 30 days and ~1.4 Hz at 3 days or fewer", () => {
    expect(turningPulseHz(30)).toBeCloseTo(0.6, 5);
    expect(turningPulseHz(3)).toBeCloseTo(1.4, 5);
    expect(turningPulseHz(0)).toBeCloseTo(1.4, 5);
  });

  it("stays within the Hz cap, is monotonic in urgency, and never NaN", () => {
    expect(PULSE_HZ_MAX).toBeLessThanOrEqual(1.5);
    fc.assert(
      fc.property(fc.integer({ min: -5, max: 60 }), fc.integer({ min: -5, max: 60 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const hz = turningPulseHz(lo);
        expect(hz).toBeGreaterThanOrEqual(PULSE_HZ_MIN);
        expect(hz).toBeLessThanOrEqual(PULSE_HZ_MAX);
        expect(hz).toBeGreaterThanOrEqual(turningPulseHz(hi));
        expect(turningPulseSeconds(lo)).toBeGreaterThanOrEqual(1 / 1.5);
      }),
    );
    expect(Number.isNaN(turningPulseHz(Number.NaN))).toBe(false);
  });

  it("CSS: opacity/transform-only glow keyframes, static under reduced motion", () => {
    const kf = /@keyframes turning-soon-glow\s*\{([\s\S]*?\n\})/.exec(css)?.[1] ?? "";
    expect(kf).toContain("opacity");
    expect(kf.replace(/opacity|transform/g, "")).not.toMatch(/(filter|box-shadow|width|height|top|left):/);
    const rm = css.slice(css.indexOf(".turning-soon-pulse::after", css.indexOf("@keyframes turning-soon-glow")));
    expect(rm).toMatch(/animation:\s*none/);
  });
});

describe("turning-soon whole-notice beat (task 25.1)", () => {
  it("animates the container itself with scale + opacity, opacity never below 0.85", () => {
    const rule = /\.turning-soon-pulse\s*\{[^}]*animation:\s*turning-soon-beat var\(--pulse-period/.test(css);
    expect(rule).toBe(true);
    const kf = /@keyframes turning-soon-beat\s*\{([\s\S]*?\n\})/.exec(css)?.[1] ?? "";
    expect(kf).toContain("scale(1.04)");
    const opacities = [...kf.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.85);
  });
  it("is static with a stronger glow under reduced motion", () => {
    const rm = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)", css.indexOf("/* ===== end Explorable Worlds")));
    expect(rm).toMatch(/\.turning-soon-pulse\s*\{[^}]*animation:\s*none[^}]*box-shadow/);
  });
});
