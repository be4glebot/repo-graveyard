"use client";

/**
 * The summoning ritual: a build-up that runs while the request is in flight.
 * Stages are timed (see lib/seance-ritual.ts), never tied to server progress:
 * candles light one at a time, smoke gathers, frost creeps in, and the final
 * stage is held (slow flame flicker, frost breathing) until the response
 * arrives. The parent owns the stage clock (so the stage text can be
 * announced in the live region) and unmounts this component when the ritual
 * ends; the exit animation is a separate layer (RitualExit).
 *
 * Only transform, opacity and filter animate. Every decorative layer and the
 * stage text are aria-hidden; the Skip button is the only exposed element.
 * Under Reduced_Motion nothing moves: the candles are simply lit and the
 * stage text changes with 200 ms fades.
 *
 * Requirements: 10.2-10.9, 10.12, 10.14-10.16, 18.7, 18.10
 */

import { useEffect, useRef, useState } from "react";
import { ritualVisuals } from "@/lib/seance-ritual";
import { RitualCandles, RitualFrost, RitualPortrait, RitualSmoke } from "./RitualParts";
import { useRitualGeometry } from "./useRitualBox";

export type RitualCreature = "ghost" | "zombie" | string;

export interface RitualProps {
  /** Skips the build-up to the held final stage (Skip control or click). */
  onSkip: () => void;
  /** Reduced_Motion: lit candles and fading text only. */
  reduced: boolean;
  /** Repo name, used in the "Calling {repo} back…" line. */
  repo: string;
  /** Creature state of the open repo (also selects the portrait art). */
  creature: RitualCreature;
  /** Decay level of the open repo, for the portrait art. */
  decayLevel?: number | null;
  /** Current stage (0 to 3), from the parent's stage clock. */
  stage: number;
  /** True once the visitor has skipped: show the held stage with no build-up. */
  skipped: boolean;
}

/** Surge class for the portrait creature; ghosts drift, everything else twitches. */
export function ritualSurgeClass(creature: RitualCreature): string {
  return creature === "ghost" ? "ritual-surge-ghost" : "ritual-surge-zombie";
}

export default function Ritual({ onSkip, reduced, repo, creature, decayLevel = null, stage, skipped }: RitualProps) {
  const visuals = ritualVisuals(stage, repo);
  const [shown, setShown] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const geometry = useRitualGeometry(rootRef);

  // Start the opacity transitions one frame after mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const skipButton = (
    <button
      type="button"
      className="btn2 seance-focus absolute bottom-3 right-3 z-10"
      onClick={(event) => {
        event.stopPropagation();
        onSkip();
      }}
    >
      Skip
    </button>
  );

  const text = (
    <p
      key={stage}
      aria-hidden="true"
      data-ritual-whisper=""
      data-visible={visuals.text === null ? "false" : "true"}
      className="ritual-text pointer-events-none absolute inset-x-0 m-0 px-4 text-center font-narrative text-[16px] italic text-moon-300"
      style={{ top: geometry.textTop }}
    >
      {visuals.text}
    </p>
  );

  return (
    <div
      ref={rootRef}
      data-seance-ritual=""
      data-reduced={reduced ? "true" : undefined}
      data-ritual-stage={stage}
      data-instant={skipped ? "true" : undefined}
      className="ritual-root absolute inset-0 cursor-pointer overflow-hidden"
      onClick={onSkip}
    >
      <div
        aria-hidden="true"
        className="ritual-vignette pointer-events-none absolute inset-0"
        data-on={shown ? "true" : "false"}
      />

      {reduced ? null : (
        <>
          <RitualSmoke on={shown && visuals.smoke} />
          <RitualFrost on={shown && visuals.frost} holding={visuals.holding} />
        </>
      )}

      {/* The repo's own creature at the centre, dimmed, over a cold halo. */}
      <RitualPortrait name={repo} state={creature} decayLevel={decayLevel} placement={geometry.portrait} />

      <RitualCandles
        positions={geometry.candles}
        lit={reduced ? true : shown}
        lean={!reduced && visuals.lean}
        holding={!reduced && visuals.holding}
        sequenced={!reduced}
      />

      {text}
      {skipButton}
    </div>
  );
}