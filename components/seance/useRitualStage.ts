"use client";

import { useEffect, useState } from "react";
import { RITUAL_FINAL_STAGE, RITUAL_STAGE_STARTS_MS } from "@/lib/seance-ritual";

/**
 * The ritual's stage clock. Advances on fixed timers while `active` (never in
 * step with the server), resets on a new attempt, and keeps the last stage
 * after the ritual ends so the exit layer can show where it got to. A skip
 * jumps straight to the held final stage.
 */
export function useRitualStage(active: boolean, attemptId: number, skipped: boolean): number {
  const [timed, setTimed] = useState({ attemptId, stage: 0 });
  if (timed.attemptId !== attemptId) setTimed({ attemptId, stage: 0 });

  useEffect(() => {
    if (!active) return undefined;
    const ids = RITUAL_STAGE_STARTS_MS.slice(1).map((ms, i) =>
      window.setTimeout(() => setTimed({ attemptId, stage: i + 1 }), ms),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [active, attemptId]);

  if (skipped) return RITUAL_FINAL_STAGE;
  return timed.attemptId === attemptId ? timed.stage : 0;
}