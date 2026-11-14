import { describe, expect, it } from "vitest";
import {
  LIGHT_SOURCES,
  rimFor,
  shadowFor,
  type LightPlace,
} from "@/lib/world-light";

const PLACES: LightPlace[] = ["sky", "ground", "crypt"];

describe("LIGHT_SOURCES (Req 18.6)", () => {
  it("has exactly one entry, with one finite (sx, sy), per place", () => {
    expect(Object.keys(LIGHT_SOURCES).sort()).toEqual([...PLACES].sort());
    for (const p of PLACES) {
      const s = LIGHT_SOURCES[p];
      expect(s.place).toBe(p);
      expect(Number.isFinite(s.sx)).toBe(true);
      expect(Number.isFinite(s.sy)).toBe(true);
    }
  });

  it("uses token names only, no hex", () => {
    for (const p of PLACES) {
      const s = LIGHT_SOURCES[p];
      expect(s.rimToken).toMatch(/^--light-/);
      expect(s.shadowToken).toMatch(/^--light-/);
      expect(JSON.stringify(s)).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
});

describe("shadowFor (Req 18.6)", () => {
  it("offset follows the place's (sx, sy) scaled by 0.35 * size", () => {
    for (const p of PLACES) {
      const sh = shadowFor(p, 1, 100);
      expect(sh.offsetX).toBeCloseTo(LIGHT_SOURCES[p].sx * 35);
      expect(sh.offsetY).toBeCloseTo(LIGHT_SOURCES[p].sy * 35);
    }
  });

  it("opacity follows band brightness (back is fainter)", () => {
    const back = shadowFor("ground", 0.64).opacity;
    const mid = shadowFor("ground", 0.82).opacity;
    const front = shadowFor("ground", 1).opacity;
    expect(back).toBeLessThan(mid);
    expect(mid).toBeLessThan(front);
  });

  it("handles missing and out-of-range data", () => {
    for (const bad of [undefined, null, NaN, Infinity]) {
      const sh = shadowFor("crypt", bad as number);
      expect(Number.isFinite(sh.opacity)).toBe(true);
      expect(sh.opacity).toBeGreaterThanOrEqual(0);
    }
    expect(shadowFor("crypt", -5).opacity).toBe(0);
    expect(shadowFor("crypt", 5).opacity).toBe(shadowFor("crypt", 1).opacity);
    expect(Number.isFinite(shadowFor("crypt", 1, NaN).offsetX)).toBe(true);
  });
});

describe("rimFor (Req 18.7, 18.12)", () => {
  it("glow alpha differs for different daysQuiet, fresher is brighter", () => {
    const fresh = rimFor("sky", { daysQuiet: 2 });
    const stale = rimFor("sky", { daysQuiet: 70 });
    expect(fresh.alpha).toBeGreaterThan(stale.alpha);
    expect(fresh.filter).not.toBe(stale.filter);
  });

  it("offset follows the key direction and colour is a token", () => {
    for (const p of PLACES) {
      const r = rimFor(p, { daysQuiet: 10 });
      expect(Math.sign(r.offsetX)).toBe(Math.sign(LIGHT_SOURCES[p].sx));
      expect(Math.sign(r.offsetY)).toBe(Math.sign(LIGHT_SOURCES[p].sy));
      expect(r.token).toBe(LIGHT_SOURCES[p].rimToken);
      expect(r.filter).toContain(`var(${r.token})`);
      expect(r.filter).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });

  it("handles missing data with the dimmest finite glow", () => {
    const dim = rimFor("ground", { daysQuiet: 1000 }).alpha;
    for (const row of [undefined, null, {}, { daysQuiet: null }, { daysQuiet: NaN }]) {
      const r = rimFor("ground", row as { daysQuiet?: number | null });
      expect(Number.isFinite(r.alpha)).toBe(true);
      expect(r.alpha).toBeCloseTo(dim);
    }
    expect(rimFor("ground", { daysQuiet: -4 }).alpha).toBe(rimFor("ground", { daysQuiet: 0 }).alpha);
  });
});
