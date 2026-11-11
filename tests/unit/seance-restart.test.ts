import { describe, expect, it } from "vitest";
import { initialSeanceState, seanceReducer, type SeanceState } from "@/lib/seance-state";

const RESULT = {
  voice: "a b. c d.",
  causeOfDeath: "x y.",
  verdict: "revive" as const,
  verdictReason: "z.",
  unfinishedBusiness: [{ title: "t", detail: "d.", evidence: "open issues: 0" }],
};

function settled(): SeanceState {
  let s = seanceReducer(initialSeanceState, { type: "START", reduced: false });
  s = seanceReducer(s, { type: "OUTCOME", attemptId: s.attemptId, outcome: { kind: "ok", result: RESULT } });
  s = seanceReducer(s, { type: "MIN_ELAPSED" });
  return seanceReducer(s, { type: "SETTLE" });
}
function after(kind: "veil" | "weak" | "silent"): SeanceState {
  const s = seanceReducer(initialSeanceState, { type: "START", reduced: false });
  return seanceReducer(s, { type: "OUTCOME", attemptId: s.attemptId, outcome: { kind } });
}

describe("RESTART (Hold another séance)", () => {
  it.each([
    ["settled", settled()],
    ["veil", after("veil")],
    ["weak", after("weak")],
    ["silent", after("silent")],
  ])("starts a new attempt from %s", (phase, s) => {
    expect(s.phase).toBe(phase);
    const next = seanceReducer(s, { type: "RESTART", reduced: false });
    expect(next.phase).toBe("ritual");
    expect(next.attemptId).toBe(s.attemptId + 1);
    expect(next.inFlight).toBe(true);
    expect(next.result).toBeNull();
    expect(next.skipped).toBe(false);
    expect(next.minElapsed).toBe(false);
    expect(seanceReducer(s, { type: "RESTART", reduced: true }).minElapsed).toBe(true);
  });

  it("is ignored while idle, in the ritual and while revealing", () => {
    expect(seanceReducer(initialSeanceState, { type: "RESTART", reduced: false })).toBe(initialSeanceState);
    const running = seanceReducer(initialSeanceState, { type: "START", reduced: false });
    expect(seanceReducer(running, { type: "RESTART", reduced: false })).toBe(running);
    let revealing = seanceReducer(running, { type: "OUTCOME", attemptId: running.attemptId, outcome: { kind: "ok", result: RESULT } });
    revealing = seanceReducer(revealing, { type: "MIN_ELAPSED" });
    expect(revealing.phase).toBe("revealing");
    expect(seanceReducer(revealing, { type: "RESTART", reduced: false })).toBe(revealing);
  });

  it("START still only works from idle", () => {
    const s = settled();
    expect(seanceReducer(s, { type: "START", reduced: false })).toBe(s);
  });
});