"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  seanceResponseSchema,
  seanceResultSchema,
} from "@/lib/seance-schema";
import {
  initialSeanceState,
  seanceReducer,
  type SeanceState,
} from "@/lib/seance-state";

/** Ritual floor before a result may be revealed (10.1). */
export const RITUAL_FLOOR_MS = 2000;
/** Client-side request deadline (9.4). */
export const REQUEST_TIMEOUT_MS = 30_000;

export interface UseSeanceOptions {
  owner: string;
  repo: string;
  /** Sample-estate entry (unvalidated). When defined, no network call is made. */
  fixture?: unknown;
  /** True on the sample estate even if the repo has no fixture entry. */
  isFixture?: boolean;
  reduced: boolean;
}

export interface UseSeance {
  state: SeanceState;
  start: () => void;
  retry: () => void;
  skip: () => void;
  settle: () => void;
  close: () => void;
}

export function useSeance({
  owner,
  repo,
  fixture,
  isFixture,
  reduced,
}: UseSeanceOptions): UseSeance {
  const [state, dispatch] = useReducer(seanceReducer, initialSeanceState);

  // Latest inputs, read by the attempt effect without re-triggering it.
  const latest = useRef({ owner, repo, fixture, isFixture, reduced });
  useEffect(() => {
    latest.current = { owner, repo, fixture, isFixture, reduced };
  });

  const start = useCallback(
    () => dispatch({ type: "START", reduced: latest.current.reduced }),
    [],
  );
  const retry = useCallback(
    () => dispatch({ type: "RETRY", reduced: latest.current.reduced }),
    [],
  );
  const skip = useCallback(() => dispatch({ type: "SKIP" }), []);
  const settle = useCallback(() => dispatch({ type: "SETTLE" }), []);
  const close = useCallback(() => dispatch({ type: "CLOSE" }), []);

  const { attemptId } = state;

  // One effect run per attempt. CLOSE (attemptId -> 0) and unmount run the
  // cleanup, which aborts the request and clears every timer.
  useEffect(() => {
    if (attemptId === 0) return;

    let cancelled = false;
    const controller = new AbortController();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cur = latest.current;

    if (!cur.reduced) {
      timers.push(
        setTimeout(() => {
          if (!cancelled) dispatch({ type: "MIN_ELAPSED" });
        }, RITUAL_FLOOR_MS),
      );
    }

    if (cur.fixture !== undefined || cur.isFixture) {
      // Fixture path: no fetch (2.1).
      const parsed = seanceResultSchema.safeParse(cur.fixture);
      queueMicrotask(() => {
        if (cancelled) return;
        dispatch({
          type: "OUTCOME",
          attemptId,
          outcome: parsed.success
            ? { kind: "ok", result: parsed.data }
            : { kind: "silent" },
        });
      });
    } else {
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          controller.abort();
          dispatch({ type: "FAILURE", attemptId });
        }, REQUEST_TIMEOUT_MS),
      );

      void (async () => {
        try {
          const res = await fetch("/api/seance", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ owner: cur.owner, repo: cur.repo }),
            signal: controller.signal,
          });
          if (!res.ok) throw new Error("bad status");
          const parsed = seanceResponseSchema.safeParse(await res.json());
          if (!parsed.success) throw new Error("bad response");
          if (!cancelled) {
            dispatch({ type: "OUTCOME", attemptId, outcome: parsed.data });
          }
        } catch {
          if (!cancelled) dispatch({ type: "FAILURE", attemptId });
        }
      })();
    }

    return () => {
      cancelled = true;
      controller.abort();
      timers.forEach(clearTimeout);
    };
  }, [attemptId]);

  return { state, start, retry, skip, settle, close };
}
