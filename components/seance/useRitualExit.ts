"use client";

import { useEffect, useState } from "react";
import { RITUAL_EXIT_MS, type RitualExitKind } from "@/lib/seance-ritual";
import type { Phase } from "@/lib/seance-state";

/**
 * Which exit animation to play when the ritual ends: "resolved" when a result
 * is revealed, "silent" for a veil, weak ghost or silent fallback. Closing the
 * panel plays nothing, and neither does Reduced_Motion. Clears itself after
 * RITUAL_EXIT_MS.
 */
export function useRitualExit(phase: Phase, reduced: boolean): RitualExitKind | null {
  const [prev, setPrev] = useState<Phase>(phase);
  const [exit, setExit] = useState<RitualExitKind | null>(null);

  if (prev !== phase) {
    setPrev(phase);
    if (phase === "ritual") {
      setExit(null);
    } else if (prev === "ritual" && phase !== "idle" && !reduced) {
      setExit(phase === "revealing" || phase === "settled" ? "resolved" : "silent");
    }
  }

  useEffect(() => {
    if (!exit) return undefined;
    const id = window.setTimeout(() => setExit(null), RITUAL_EXIT_MS[exit]);
    return () => window.clearTimeout(id);
  }, [exit]);

  return exit;
}