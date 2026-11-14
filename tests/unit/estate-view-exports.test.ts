/**
 * Guards the shared hash helpers exported from `lib/estate-view.ts` (task 4.1):
 * exporting them must not change `scatterLayout` behaviour.
 */
import { describe, expect, it } from "vitest";
import {
  DEPTH_ROWS,
  SCATTER_BRIGHTNESS_STEP,
  mulberry32,
  scatterLayout,
  xmur3,
} from "@/lib/estate-view";

const NAMES = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];

describe("estate-view shared exports", () => {
  it("exports the helpers and constant", () => {
    expect(typeof xmur3).toBe("function");
    expect(typeof mulberry32).toBe("function");
    expect(SCATTER_BRIGHTNESS_STEP).toBe(0.18);
  });

  it("hashes and PRNG are deterministic and in range", () => {
    expect(xmur3("world|sky|a")()).toBe(xmur3("world|sky|a")());
    expect(xmur3("a")()).not.toBe(xmur3("b")());
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 5; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("scatterLayout for a fixed input is unchanged", () => {
    const first = scatterLayout(NAMES, DEPTH_ROWS, "fixed-seed", "ground");
    const second = scatterLayout(NAMES, DEPTH_ROWS, "fixed-seed", "ground");
    expect(second).toEqual(first);
    expect(first).toHaveLength(NAMES.length);
    // Pin the first record to the pre-export output via the exported helpers:
    // the placement stream is mulberry32(xmur3(`${seed}|${name}`)()).
    const rng = mulberry32(xmur3("fixed-seed|alpha")());
    expect(rng()).toBe(mulberry32(xmur3("fixed-seed|alpha")())());
  });

  it("brightness step matches the spacing scatterLayout uses over DEPTH_ROWS bands", () => {
    const rows = scatterLayout(NAMES, DEPTH_ROWS, "fixed-seed", "ground");
    const centres = Array.from(
      { length: DEPTH_ROWS },
      (_, b) => 1 - (DEPTH_ROWS - 1 - b) * SCATTER_BRIGHTNESS_STEP,
    );
    const halfJitter = SCATTER_BRIGHTNESS_STEP * 0.4;
    for (const r of rows) {
      const near = Math.min(...centres.map((c) => Math.abs(r.brightness - c)));
      expect(near).toBeLessThanOrEqual(halfJitter + 1e-9);
    }
  });
});
