import { describe, expect, it } from "vitest";
import { LIFECYCLE_CONFIG } from "@/lib/lifecycle";
import {
  MAX_AMBIENT_PER_PLACE,
  WORLD_EFFECTS,
  effectProps,
  freshEarth,
  ghostLanternLevel,
} from "@/lib/world-effects";

describe("WORLD_EFFECTS", () => {
  it("has at most 4 ambient effects per place", () => {
    for (const place of ["sky", "ground", "crypt"] as const) {
      const n = WORLD_EFFECTS.filter((e) => e.ambient && e.places.includes(place)).length;
      expect(n).toBeLessThanOrEqual(MAX_AMBIENT_PER_PLACE);
    }
  });

  it("has unique ids", () => {
    const ids = WORLD_EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every row a kind and a description", () => {
    for (const e of WORLD_EFFECTS) {
      expect(["data", "story", "blend"]).toContain(e.kind);
      expect(e.description.length).toBeGreaterThan(0);
      expect(e.places.length).toBeGreaterThan(0);
    }
  });
});

describe("helpers", () => {
  it("effectProps tags known ids and throws on unknown", () => {
    expect(effectProps("bats")).toEqual({ "data-effect": "bats" });
    expect(() => effectProps("nope")).toThrow();
  });

  it("freshEarth uses the active threshold", () => {
    const t = LIFECYCLE_CONFIG.ghostMaxDaysQuiet;
    expect(freshEarth(0)).toBe(true);
    expect(freshEarth(t - 1)).toBe(true);
    expect(freshEarth(t)).toBe(false);
    expect(freshEarth(Number.NaN)).toBe(false);
  });

  it("ghostLanternLevel clamps to 0..3", () => {
    expect(ghostLanternLevel(-2)).toBe(0);
    expect(ghostLanternLevel(2)).toBe(2);
    expect(ghostLanternLevel(9)).toBe(3);
    expect(ghostLanternLevel(null)).toBe(0);
  });
});
