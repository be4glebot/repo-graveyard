/**
 * The staged ritual plan: stage timing, held final stage, skip, the 2 s minimum
 * and the candle sequence. Pure; no DOM.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { RITUAL_FLOOR_MS } from "@/components/seance/useSeance";
import {
  RITUAL_CANDLE_COUNT,
  RITUAL_EXIT_MS,
  RITUAL_FINAL_STAGE,
  RITUAL_MIN_MS,
  RITUAL_STAGE_STARTS_MS,
  ritualCandles,
  ritualGeometry,
  ritualNextStageStartMs,
  ritualStageAt,
  ritualStageText,
  ritualVisuals,
} from "@/lib/seance-ritual";
import { initialSeanceState, seanceReducer } from "@/lib/seance-state";

describe("stage timing", () => {
  it("stages begin at 0, 1.2, 2.5 and 4.5 seconds", () => {
    expect([...RITUAL_STAGE_STARTS_MS]).toEqual([0, 1200, 2500, 4500]);
    const cases: [number, number][] = [
      [0, 0],
      [1199, 0],
      [1200, 1],
      [2499, 1],
      [2500, 2],
      [4499, 2],
      [4500, 3],
    ];
    for (const [ms, stage] of cases) expect(ritualStageAt(ms), `${ms} ms`).toBe(stage);
  });

  it("holds the final stage for any later time (until the response resolves)", () => {
    for (const ms of [4500, 6000, 30_000, 10 ** 9]) {
      expect(ritualStageAt(ms)).toBe(RITUAL_FINAL_STAGE);
    }
    expect(ritualNextStageStartMs(RITUAL_FINAL_STAGE)).toBeNull();
  });

  it("is total: negative, NaN and infinite times never throw or leave 0..3", () => {
    for (const ms of [-1, -1e9, Number.NaN, Number.POSITIVE_INFINITY]) {
      const s = ritualStageAt(ms);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(RITUAL_FINAL_STAGE);
    }
  });

  it("is monotonic in elapsed time and bounded (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60_000 }), fc.integer({ min: 0, max: 60_000 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(ritualStageAt(lo)).toBeLessThanOrEqual(ritualStageAt(hi));
        expect(ritualStageAt(hi)).toBeLessThanOrEqual(RITUAL_FINAL_STAGE);
      }),
      { numRuns: 200 },
    );
  });

  it("next-stage delays chain through the stage starts", () => {
    expect([0, 1, 2].map((s) => ritualNextStageStartMs(s))).toEqual([1200, 2500, 4500]);
  });
});

describe("skip goes to the held final stage", () => {
  it("at any elapsed time", () => {
    for (const ms of [0, 100, 1300, 3000, 99_999]) {
      expect(ritualStageAt(ms, true)).toBe(RITUAL_FINAL_STAGE);
    }
  });
});

describe("stage text and visuals", () => {
  it("stage 0 has no text; the others read as specified", () => {
    expect(ritualStageText(0, "crypt-keeper")).toBeNull();
    expect(ritualStageText(1, "crypt-keeper")).toBe("Calling crypt-keeper back…");
    expect(ritualStageText(2, "crypt-keeper")).toBe("Reading its last words…");
    expect(ritualStageText(3, "crypt-keeper")).toBe("Something is answering…");
  });

  it("the visuals build up stage by stage", () => {
    const v = (s: number) => ritualVisuals(s, "r");
    expect(v(0)).toMatchObject({ dim: true, smoke: false, frost: false, lean: false, holding: false, text: null });
    expect(v(1)).toMatchObject({ dim: true, smoke: true, frost: false, lean: false, holding: false });
    expect(v(2)).toMatchObject({ smoke: true, frost: true, lean: true, holding: false });
    expect(v(3)).toMatchObject({ smoke: true, frost: true, lean: true, holding: true });
  });

  it("clamps unknown stages", () => {
    expect(ritualVisuals(-5, "r")).toEqual(ritualVisuals(0, "r"));
    expect(ritualVisuals(99, "r")).toEqual(ritualVisuals(3, "r"));
    expect(ritualVisuals(Number.NaN, "r")).toEqual(ritualVisuals(0, "r"));
  });
});

describe("five candles, one at a time", () => {
  const candles = ritualCandles();

  it("there are five, deterministic, all lit by the end of stage 0", () => {
    expect(RITUAL_CANDLE_COUNT).toBe(5);
    expect(candles).toHaveLength(5);
    expect(ritualCandles()).toEqual(candles);
    const last = candles[candles.length - 1];
    expect(last.igniteAtMs).toBeLessThan(RITUAL_STAGE_STARTS_MS[1]);
    for (let i = 1; i < candles.length; i += 1) {
      expect(candles[i].igniteAtMs).toBeGreaterThan(candles[i - 1].igniteAtMs);
    }
    expect(candles[0].igniteAtMs).toBe(0);
  });

  it("flames lean toward the portrait (right-hand candles tilt left, left-hand right)", () => {
    for (const c of candles) {
      const cos = Math.cos((c.angleDeg * Math.PI) / 180);
      if (cos > 0.2) expect(c.leanDeg).toBeLessThan(0);
      if (cos < -0.2) expect(c.leanDeg).toBeGreaterThan(0);
      expect(Math.abs(c.leanDeg)).toBeLessThanOrEqual(14);
    }
  });
});

describe("2 second minimum before the transcript, even when the response is instant", () => {
  it("the minimum is 2 s and the hook uses the same number", () => {
    expect(RITUAL_MIN_MS).toBe(2000);
    expect(RITUAL_FLOOR_MS).toBe(RITUAL_MIN_MS);
  });

  it("an early ok outcome keeps the ritual until the minimum has elapsed", () => {
    const ok = { kind: "ok" as const, result: {
      voice: "a b. c d.", causeOfDeath: "x y.", verdict: "revive" as const, verdictReason: "z.",
      unfinishedBusiness: [{ title: "t", detail: "d.", evidence: "open issues: 0" }],
    } };
    let s = seanceReducer(initialSeanceState, { type: "START", reduced: false });
    s = seanceReducer(s, { type: "OUTCOME", attemptId: s.attemptId, outcome: ok });
    expect(s.phase).toBe("ritual");
    s = seanceReducer(s, { type: "MIN_ELAPSED" });
    expect(s.phase).toBe("revealing");
  });
});

describe("exit timing", () => {
  it("gutter is short, snuffing candles one by one takes longer", () => {
    expect(RITUAL_EXIT_MS.resolved).toBeLessThan(RITUAL_EXIT_MS.silent);
    expect(RITUAL_EXIT_MS.resolved).toBeGreaterThanOrEqual(400);
  });
});

describe("uneven candle heights and ring", () => {
  it("heights differ but stay near the base, and the ring surrounds the ritual centre", () => {
    const scales = ritualCandles().map((c) => c.heightScale);
    expect(new Set(scales).size).toBeGreaterThan(1);
    for (const s of scales) {
      expect(s).toBeGreaterThan(0.7);
      expect(s).toBeLessThan(1.3);
    }
    // The ring is laid out in pixels around the portrait (see seance-ritual-geometry.test.ts).
    const g = ritualGeometry();
    expect(g.candles).toHaveLength(RITUAL_CANDLE_COUNT);
    expect(g.portrait.cx).toBe(g.box.width / 2);
  });
});