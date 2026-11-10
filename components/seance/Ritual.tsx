"use client";

/**
 * The summoning ritual: candles, smoke, creature surge and cycling whispers.
 * The parent mounts it while the phase is "ritual" and removes it when the
 * ritual ends (within 500 ms), so this component only reports Skip.
 *
 * Only transform, opacity and filter animate. Every decorative layer and the
 * whispers are aria-hidden; the Skip button is the only exposed element.
 * Under Reduced_Motion it renders a single 200 ms opacity fade.
 *
 * Requirements: 10.2-10.9, 10.12, 10.14-10.16, 18.7, 18.10
 */

import { useEffect, useMemo, useState } from "react";
import { buildRitualPlan } from "@/lib/seance-ritual";

export type RitualCreature = "ghost" | "zombie" | string;

export interface RitualProps {
  /** Skips the ritual (Skip control or click on the ritual area). */
  onSkip: () => void;
  /** Reduced_Motion: a single 200 ms opacity fade, nothing else. */
  reduced: boolean;
  /** Seed for the deterministic candle plan. */
  seed: string;
  /** Creature state of the open repo; selects the surge class. */
  creature: RitualCreature;
}

const MIN_LINE_MS = 1000;
const MAX_LINE_MS = 2000;
const WHISPER_OPACITY = 0.4; // inside 0.3 to 0.5

/** Surge class for the portrait creature; ghosts drift, everything else twitches. */
export function ritualSurgeClass(creature: RitualCreature): string {
  return creature === "ghost" ? "ritual-surge-ghost" : "ritual-surge-zombie";
}

/** Deterministic 1 to 2 s dwell per whisper line, derived from the plan. */
function lineDurationMs(index: number, count: number, seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const span = MAX_LINE_MS - MIN_LINE_MS;
  const frac = (Math.abs(h + index * 7919) % (count * 101 + 1)) / (count * 101);
  return Math.round(MIN_LINE_MS + frac * span);
}

export default function Ritual({ onSkip, reduced, seed, creature }: RitualProps) {
  const plan = useMemo(() => buildRitualPlan(seed), [seed]);
  const [lineIndex, setLineIndex] = useState(0);
  const [shown, setShown] = useState(false);

  // Reduced motion: one 200 ms opacity fade in.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Whisper cycling. Loops indefinitely, so a result later than 4 s keeps
  // the ritual alive (Req 10.9); the parent decides when it ends.
  useEffect(() => {
    if (reduced || plan.whispers.length === 0) return undefined;
    const id = window.setTimeout(
      () => setLineIndex((i) => (i + 1) % plan.whispers.length),
      lineDurationMs(lineIndex, plan.whispers.length, seed),
    );
    return () => window.clearTimeout(id);
  }, [lineIndex, plan, reduced, seed]);

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

  if (reduced) {
    return (
      <div
        data-seance-ritual
        data-reduced="true"
        className="absolute inset-0 cursor-pointer"
        onClick={onSkip}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-night-sky"
          style={{
            opacity: shown ? 0.5 : 0,
            transition: "opacity var(--motion-ritual-fade-reduced) linear",
          }}
        />
        {skipButton}
      </div>
    );
  }

  return (
    <div
      data-seance-ritual
      className="absolute inset-0 cursor-pointer overflow-hidden"
      onClick={onSkip}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-night-sky"
        style={{
          opacity: shown ? 0.35 : 0,
          transition: "opacity 300ms ease",
        }}
      />

      {/* Smoke rising from the bottom edge. */}
      <div
        aria-hidden="true"
        className="ritual-smoke pointer-events-none absolute inset-x-0 bottom-0 h-full bg-cover bg-bottom"
        style={{ backgroundImage: "url(/art/fog-wisps.webp)", opacity: 0 }}
      />

      {/* Creature surge: a glow layer that carries the surge class. */}
      <div
        aria-hidden="true"
        data-ritual-creature={creature}
        className={`${ritualSurgeClass(creature)} pointer-events-none absolute left-1/2 top-1/3 h-24 w-24 -translate-x-1/2 rounded-full bg-candle-300`}
        style={{ opacity: 0.12 }}
      />

      {/* Candles placed around the portrait, igniting from the plan. */}
      {plan.candles.map((candle, i) => {
        const rad = (candle.angleDeg * Math.PI) / 180;
        const left = 50 + Math.cos(rad) * 38;
        const top = 40 + Math.sin(rad) * 30;
        return (
          <div
            key={i}
            aria-hidden="true"
            data-ritual-candle
            className="pointer-events-none absolute"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              opacity: shown ? 1 : 0,
              transition: `opacity ${candle.fadeMs}ms ease-out ${candle.igniteAtMs}ms`,
            }}
          >
            <div className="ritual-candle-flame h-3 w-2 rounded-full bg-candle-400" />
            <div className="mx-auto h-6 w-1.5 bg-candle-tan" style={{ opacity: 0.6 }} />
          </div>
        );
      })}

      {/* Whisper_Text. */}
      <p
        aria-hidden="true"
        data-ritual-whisper
        className="pointer-events-none absolute inset-x-0 top-2/3 m-0 px-4 text-center font-narrative text-[17px] italic text-moon-300"
        style={{ opacity: WHISPER_OPACITY }}
      >
        {plan.whispers[lineIndex]}
      </p>

      {skipButton}
    </div>
  );
}
