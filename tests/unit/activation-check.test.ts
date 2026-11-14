import { describe, expect, it } from "vitest";
import {
  CASES,
  casesFor,
  exitCodeFor,
  formatTable,
  judge,
} from "../../docs/design-review/tools/activation-lib.mjs";

describe("activation-check helpers", () => {
  it("mouse scroll-gap cases must open; touch momentum and drags must not", () => {
    for (const gap of [0, 30, 60, 100]) {
      expect(CASES.find((c) => c.id === `mouse-scroll-${gap}`)?.expectOpen).toBe(true);
    }
    expect(CASES.find((c) => c.id === "touch-tap-during-momentum")?.expectOpen).toBe(false);
    expect(CASES.find((c) => c.id === "mouse-drag-12px")?.expectOpen).toBe(false);
  });

  it("drops scroll cases when there is no scroller", () => {
    expect(casesFor("mouse", false).some((c) => c.needsScroller)).toBe(false);
    expect(casesFor("touch", true).length).toBeGreaterThan(casesFor("touch", false).length);
  });

  it("judges and exits non-zero on failure or empty", () => {
    const ok = judge(CASES[0], true);
    const bad = judge(CASES[0], false);
    expect(exitCodeFor([ok])).toBe(0);
    expect(exitCodeFor([ok, bad])).toBe(1);
    expect(exitCodeFor([])).toBe(2);
    expect(formatTable([{ place: "sky", viewport: "1440x900", ...bad }])).toContain("FAIL");
  });
});
