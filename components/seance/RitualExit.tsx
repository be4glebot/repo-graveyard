"use client";

/**
 * The ritual's exit, played over the result as the ritual unmounts.
 *
 * - resolved: the flames gutter out together and the smoke text dissolves.
 * - silent:   the candles are snuffed out one by one and the frost recedes.
 *
 * Purely decorative (aria-hidden, no pointer events) and short-lived; the
 * parent removes it after RITUAL_EXIT_MS. Not rendered under Reduced_Motion.
 *
 * Requirements: 10.7, 10.8, 10.14
 */

import { useRef } from "react";
import { RITUAL_SNUFF_GAP_MS, ritualVisuals, type RitualExitKind } from "@/lib/seance-ritual";
import { RitualCandles, RitualFrost, RitualPortrait, RitualSmoke } from "./RitualParts";
import { useRitualGeometry } from "./useRitualBox";

export interface RitualExitProps {
  kind: RitualExitKind;
  /** The stage the ritual had reached when it ended. */
  stage: number;
  repo: string;
  /** Creature state and decay level, so the portrait fades out where it stood. */
  creature: string;
  decayLevel?: number | null;
}

export default function RitualExit({ kind, stage, repo, creature, decayLevel = null }: RitualExitProps) {
  const v = ritualVisuals(stage, repo);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const geometry = useRitualGeometry(rootRef);
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-seance-ritual-exit={kind}
      className={`ritual-exit ritual-exit-${kind} pointer-events-none absolute inset-0 overflow-hidden`}
    >
      <div className="ritual-vignette absolute inset-0" data-on="true" />
      <RitualSmoke on={v.smoke} />
      <RitualFrost on={v.frost} holding={false} />
      <RitualPortrait name={repo} state={creature} decayLevel={decayLevel} placement={geometry.portrait} />
      <RitualCandles
        positions={geometry.candles}
        lit
        lean={v.lean}
        holding={false}
        sequenced={false}
        snuffGapMs={kind === "silent" ? RITUAL_SNUFF_GAP_MS : 0}
      />
      <p
        data-visible={v.text === null ? "false" : "true"}
        className="ritual-text absolute inset-x-0 m-0 px-4 text-center font-narrative text-[16px] italic text-moon-300"
        style={{ top: geometry.textTop }}
      >
        {v.text}
      </p>
    </div>
  );
}