import { describe, expect, it } from "vitest";
import { selectDecayProfile } from "@/lib/seance-decay";

const ghost = (level: number) => selectDecayProfile("ghost", level);

describe("decay profile numbers", () => {
  it("12.1: ghost level 0 has no jitter, no split, baseline glow", () => {
    const p = ghost(0);
    expect(p.jitterPx).toBe(0);
    expect(p.splitPx).toBe(0);
    expect(p.glowScale).toBe(1);
  });

  it("12.2: ghost level 1 has no jitter or split and glow 20-40% lower", () => {
    const p = ghost(1);
    expect(p.jitterPx).toBe(0);
    expect(p.splitPx).toBe(0);
    const drop = 1 - p.glowScale / ghost(0).glowScale;
    expect(drop).toBeGreaterThanOrEqual(0.2);
    expect(drop).toBeLessThanOrEqual(0.4);
  });

  it.each([2, 3])("12.3: ghost level %i has jitter 0.1-1 px and split 1-2 px", (level) => {
    const p = ghost(level);
    expect(p.jitterPx).toBeGreaterThanOrEqual(0.1);
    expect(p.jitterPx).toBeLessThanOrEqual(1);
    expect(p.splitPx).toBeGreaterThanOrEqual(1);
    expect(p.splitPx).toBeLessThanOrEqual(2);
  });

  it("12.4: zombie is rougher, darker and red", () => {
    const z = selectDecayProfile("zombie", 0);
    const base = ghost(0);
    expect(z.roughness).toBeGreaterThan(base.roughness);
    expect(z.brightness).toBeLessThan(base.brightness);
    expect(z.glowHue).toBe("red");
  });

  it("12.5: risen matches ghost 0 numbers with a cyan glow", () => {
    const r = selectDecayProfile("risen", 0);
    const base = ghost(0);
    expect(r.jitterPx).toBe(base.jitterPx);
    expect(r.splitPx).toBe(base.splitPx);
    expect(r.glowScale).toBe(base.glowScale);
    expect(r.glowHue).toBe("cyan");
  });

  it.each(["tombstone", "coffin"])("12.6: %s is grey, darker, motion at most 10%%", (state) => {
    const p = selectDecayProfile(state, 0);
    const base = ghost(0);
    expect(p.glowHue).toBe("grey");
    expect(p.brightness).toBeLessThan(base.brightness);
    expect(p.motionScale).toBeLessThanOrEqual(0.1 * base.motionScale);
  });
});
