import { describe, expect, it } from "vitest";
import {
  REVIEW_CASES,
  buildReviewRows,
  type ReviewCase,
} from "@/lib/review-cases";

const EXPECTED: Record<ReviewCase, { count: number; state?: string }> = {
  "ghosts-3": { count: 3, state: "ghost" },
  "ghosts-12": { count: 12, state: "ghost" },
  "tombstones-3": { count: 3, state: "tombstone" },
  "tombstones-12": { count: 12, state: "tombstone" },
  "coffins-3": { count: 3, state: "coffin" },
  "coffins-12": { count: 12, state: "coffin" },
  empty: { count: 0 },
};

describe("buildReviewRows", () => {
  for (const c of REVIEW_CASES) {
    it(`${c}: row count and state`, () => {
      const rows = buildReviewRows(c);
      expect(rows).toHaveLength(EXPECTED[c].count);
      for (const r of rows) expect(r.state).toBe(EXPECTED[c].state);
    });

    it(`${c}: deterministic and unique names`, () => {
      expect(buildReviewRows(c)).toEqual(buildReviewRows(c));
      const names = buildReviewRows(c).map((r) => r.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it(`${c}: finite non-negative days, decay level only on ghosts`, () => {
      for (const r of buildReviewRows(c)) {
        expect(Number.isFinite(r.daysQuiet)).toBe(true);
        expect(r.daysQuiet).toBeGreaterThanOrEqual(0);
        if (r.state === "ghost") {
          expect(r.daysQuiet).toBeLessThan(90);
          expect(r.decayLevel).toBeGreaterThanOrEqual(0);
          expect(r.decayLevel).toBeLessThanOrEqual(3);
        } else {
          expect(r.decayLevel).toBeNull();
          expect(r.daysQuiet).toBeGreaterThanOrEqual(90);
        }
      }
    });
  }

  it("ghosts-12 covers decay levels 0 to 3", () => {
    const levels = new Set(buildReviewRows("ghosts-12").map((r) => r.decayLevel));
    expect([...levels].sort()).toEqual([0, 1, 2, 3]);
  });

  it("12-sets of tombstones and coffins span a wide range of days quiet", () => {
    for (const c of ["tombstones-12", "coffins-12"] as const) {
      const days = buildReviewRows(c).map((r) => r.daysQuiet);
      expect(Math.max(...days) - Math.min(...days)).toBeGreaterThan(1000);
    }
  });

  it("returns fresh arrays so callers cannot mutate shared state", () => {
    const a = buildReviewRows("ghosts-3");
    a[0].name = "mutated";
    expect(buildReviewRows("ghosts-3")[0].name).not.toBe("mutated");
  });
});
