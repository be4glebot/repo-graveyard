// Feature: the-seance, Property 18: The client reducer never has two requests in flight and never shows results early
//
// Model-based command list against seanceReducer. Every step checks the
// invariants and compares against a small independent model.
//
// **Validates: Requirements 1.5, 1.6, 1.8, 9.8, 9.9, 10.1, 10.12, 10.13**

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  seanceReducer,
  initialSeanceState,
  type SeanceEvent,
  type SeanceState,
} from "@/lib/seance-state";
import type { SeanceOutcome, SeanceResult } from "@/lib/seance-schema";

const RESULT: SeanceResult = {
  voice: "I was left. Quietly.",
  causeOfDeath: "Attention moved on.",
  unfinishedBusiness: [],
  verdict: "revive",
  verdictReason: "Worth another look.",
};

type Kind = SeanceOutcome["kind"];

// Abstract commands; attempt ids are resolved against the live state so stale
// ids (delta < 0) and future ids (delta > 0) are both exercised.
type Command =
  | { type: "START"; reduced: boolean }
  | { type: "MIN_ELAPSED" }
  | { type: "SKIP" }
  | { type: "OUTCOME"; delta: number; kind: Kind }
  | { type: "FAILURE"; delta: number }
  | { type: "SETTLE" }
  | { type: "RETRY"; reduced: boolean }
  | { type: "RESTART"; reduced: boolean }
  | { type: "CLOSE" };

const delta = fc.constantFrom(-2, -1, 0, 0, 0, 1);
const commandArb: fc.Arbitrary<Command> = fc.oneof(
  fc.record({ type: fc.constant("START" as const), reduced: fc.boolean() }),
  fc.constant({ type: "MIN_ELAPSED" as const }),
  fc.constant({ type: "SKIP" as const }),
  fc.record({
    type: fc.constant("OUTCOME" as const),
    delta,
    kind: fc.constantFrom<Kind>("ok", "ok", "veil", "weak", "silent"),
  }),
  fc.record({ type: fc.constant("FAILURE" as const), delta }),
  fc.constant({ type: "SETTLE" as const }),
  fc.record({ type: fc.constant("RETRY" as const), reduced: fc.boolean() }),
  fc.record({ type: fc.constant("RESTART" as const), reduced: fc.boolean() }),
  fc.constant({ type: "CLOSE" as const }),
);

function toEvent(cmd: Command, s: SeanceState): SeanceEvent {
  switch (cmd.type) {
    case "OUTCOME": {
      const outcome: SeanceOutcome =
        cmd.kind === "ok" ? { kind: "ok", result: RESULT } : { kind: cmd.kind };
      return { type: "OUTCOME", attemptId: s.attemptId + cmd.delta, outcome };
    }
    case "FAILURE":
      return { type: "FAILURE", attemptId: s.attemptId + cmd.delta };
    default:
      return cmd;
  }
}

// Independent model of the expected state.
interface Model {
  phase: SeanceState["phase"];
  attemptId: number;
  inFlight: boolean;
  floor: boolean; // minElapsed
  skipped: boolean;
  okArrived: boolean;
}
const initialModel: Model = {
  phase: "idle",
  attemptId: 0,
  inFlight: false,
  floor: false,
  skipped: false,
  okArrived: false,
};

function step(m: Model, e: SeanceEvent): Model {
  const reveal = (n: Model): Model =>
    n.phase === "ritual" && n.okArrived && (n.floor || n.skipped)
      ? { ...n, phase: "revealing" }
      : n;
  switch (e.type) {
    case "START":
    case "RETRY":
    case "RESTART": {
      const allowed =
        e.type === "START"
          ? m.phase === "idle"
          : e.type === "RETRY"
            ? m.phase === "silent" && !m.inFlight
            : // RESTART (Hold another séance): only once a result or fallback is showing.
              (m.phase === "settled" ||
                m.phase === "veil" ||
                m.phase === "weak" ||
                m.phase === "silent") &&
              !m.inFlight;
      return allowed
        ? {
            phase: "ritual",
            attemptId: m.attemptId + 1,
            inFlight: true,
            floor: e.reduced,
            skipped: false,
            okArrived: false,
          }
        : m;
    }
    case "MIN_ELAPSED":
      return m.phase === "ritual" ? reveal({ ...m, floor: true }) : m;
    case "SKIP":
      return m.phase === "ritual" ? reveal({ ...m, skipped: true }) : m;
    case "OUTCOME": {
      if (e.attemptId !== m.attemptId || m.phase !== "ritual" || !m.inFlight) return m;
      const base = { ...m, inFlight: false };
      if (e.outcome.kind === "ok") return reveal({ ...base, okArrived: true });
      return { ...base, phase: e.outcome.kind };
    }
    case "FAILURE":
      if (e.attemptId !== m.attemptId || m.phase !== "ritual" || !m.inFlight) return m;
      return { ...m, phase: "silent", inFlight: false };
    case "SETTLE":
      return m.phase === "revealing" ? { ...m, phase: "settled" } : m;
    case "CLOSE":
      return initialModel;
  }
}

describe("Property 18: The client reducer never has two requests in flight and never shows results early", () => {
  it("holds after every step of any command sequence", () => {
    fc.assert(
      fc.property(fc.array(commandArb, { maxLength: 60 }), (cmds) => {
        let s = initialSeanceState;
        let m = initialModel;
        for (const cmd of cmds) {
          const e = toEvent(cmd, s);
          const prev = s;
          s = seanceReducer(prev, e);
          m = step(m, e);

          // Agreement with the independent model.
          expect(s.phase).toBe(m.phase);
          expect(s.attemptId).toBe(m.attemptId);
          expect(s.inFlight).toBe(m.inFlight);

          // At most one request in flight, and only during the ritual.
          if (s.inFlight) {
            expect(s.phase).toBe("ritual");
            expect(s.outcome).toBeNull();
          }
          // Attempt ids only grow by one per START/RETRY (or reset on CLOSE).
          if (e.type === "CLOSE") expect(s).toEqual(initialSeanceState);
          else expect(s.attemptId - prev.attemptId).toBeGreaterThanOrEqual(0);
          expect(s.attemptId - prev.attemptId).toBeLessThanOrEqual(1);

          // START only acts from idle; RETRY only from silent and idle-flight.
          if (e.type === "START" && prev.phase !== "idle") expect(s).toBe(prev);
          if (e.type === "RETRY" && !(prev.phase === "silent" && !prev.inFlight)) {
            expect(s).toBe(prev);
          }
          if (e.type === "RETRY" && prev.phase === "silent" && !prev.inFlight) {
            expect(s.phase).toBe("ritual");
            expect(s.inFlight).toBe(true);
          }
          // Stale attempt ids change nothing.
          if (
            (e.type === "OUTCOME" || e.type === "FAILURE") &&
            e.attemptId !== prev.attemptId
          ) {
            expect(s).toBe(prev);
          }
          // Never reveal early.
          if (s.phase === "revealing" || s.phase === "settled") {
            expect(s.outcome?.kind).toBe("ok");
            expect(s.result).not.toBeNull();
          }
          if (s.phase === "revealing") {
            expect(s.minElapsed || s.skipped).toBe(true);
          }
          // Ritual persists while no outcome has arrived.
          if (
            prev.phase === "ritual" &&
            prev.outcome === null &&
            e.type !== "CLOSE" &&
            e.type !== "OUTCOME" &&
            e.type !== "FAILURE"
          ) {
            expect(s.phase).toBe("ritual");
          }
          // From silent, RETRY is available when nothing is in flight.
          if (s.phase === "silent" && !s.inFlight) {
            expect(seanceReducer(s, { type: "RETRY", reduced: false }).inFlight).toBe(true);
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
