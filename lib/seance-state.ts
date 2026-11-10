/**
 * Séance client state machine. Pure and client-safe; timers and the request
 * live in the `useSeance` hook.
 */

import type { SeanceOutcome, SeanceResult } from "./seance-schema";

export type Phase =
  | "idle"
  | "ritual"
  | "revealing"
  | "settled"
  | "veil"
  | "weak"
  | "silent";

export interface SeanceState {
  phase: Phase;
  /** Increments on START and RETRY. */
  attemptId: number;
  /** True from START/RETRY until an outcome arrives or CLOSE. */
  inFlight: boolean;
  /** 2 s floor reached (true immediately under reduced motion). */
  minElapsed: boolean;
  skipped: boolean;
  outcome: SeanceOutcome | null;
  result: SeanceResult | null;
}

export type SeanceEvent =
  | { type: "START"; reduced: boolean }
  | { type: "MIN_ELAPSED" }
  | { type: "SKIP" }
  | { type: "OUTCOME"; attemptId: number; outcome: SeanceOutcome }
  | { type: "FAILURE"; attemptId: number }
  | { type: "SETTLE" }
  | { type: "RETRY"; reduced: boolean }
  | { type: "CLOSE" };

export const initialSeanceState: SeanceState = {
  phase: "idle",
  attemptId: 0,
  inFlight: false,
  minElapsed: false,
  skipped: false,
  outcome: null,
  result: null,
};

function begin(state: SeanceState, reduced: boolean): SeanceState {
  return {
    phase: "ritual",
    attemptId: state.attemptId + 1,
    inFlight: true,
    minElapsed: reduced,
    skipped: false,
    outcome: null,
    result: null,
  };
}

/** Moves a ritual with an `ok` outcome to revealing once the floor or a skip allows. */
function maybeReveal(state: SeanceState): SeanceState {
  if (
    state.phase === "ritual" &&
    state.outcome?.kind === "ok" &&
    (state.minElapsed || state.skipped)
  ) {
    return { ...state, phase: "revealing", result: state.outcome.result };
  }
  return state;
}

export function seanceReducer(
  state: SeanceState,
  event: SeanceEvent,
): SeanceState {
  switch (event.type) {
    case "START":
      return state.phase === "idle" ? begin(state, event.reduced) : state;

    case "RETRY":
      return state.phase === "silent" && !state.inFlight
        ? begin(state, event.reduced)
        : state;

    case "MIN_ELAPSED":
      return state.phase === "ritual"
        ? maybeReveal({ ...state, minElapsed: true })
        : state;

    case "SKIP":
      return state.phase === "ritual"
        ? maybeReveal({ ...state, skipped: true })
        : state;

    case "OUTCOME": {
      if (
        event.attemptId !== state.attemptId ||
        state.phase !== "ritual" ||
        !state.inFlight
      ) {
        return state;
      }
      const base: SeanceState = {
        ...state,
        inFlight: false,
        outcome: event.outcome,
      };
      switch (event.outcome.kind) {
        case "ok":
          return maybeReveal(base);
        case "veil":
          return { ...base, phase: "veil" };
        case "weak":
          return { ...base, phase: "weak" };
        case "silent":
          return { ...base, phase: "silent" };
      }
    }

    case "FAILURE":
      if (
        event.attemptId !== state.attemptId ||
        state.phase !== "ritual" ||
        !state.inFlight
      ) {
        return state;
      }
      return {
        ...state,
        phase: "silent",
        inFlight: false,
        outcome: { kind: "silent" },
      };

    case "SETTLE":
      return state.phase === "revealing" ? { ...state, phase: "settled" } : state;

    case "CLOSE":
      return initialSeanceState;
  }
}
