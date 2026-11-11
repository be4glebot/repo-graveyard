/**
 * Decorative building blocks shared by the live ritual and its exit layer:
 * the creature portrait with its cold halo, the candle ring, smoke and frost.
 * Everything is aria-hidden and pointer-transparent; the styling lives in
 * app/globals.css (tokens only, dim and slow).
 *
 * Requirements: 10.2-10.8
 */

import { useMemo, type CSSProperties } from "react";
import Creature from "@/components/creatures/Creature";
import type { LifecycleState } from "@/lib/lifecycle";
import { RITUAL_CENTER, RITUAL_RING, ritualCandles } from "@/lib/seance-ritual";

const CORNERS = ["tl", "tr", "bl", "br"] as const;

/** Base wax height in px; each candle scales it a little (uneven heights). */
const WAX_HEIGHT_PX = 48;

export interface RitualCandlesProps {
  /** Flames lit (fade in). */
  lit: boolean;
  /** Flames tilted toward the portrait. */
  lean: boolean;
  /** Final stage: slow flame flicker. */
  holding: boolean;
  /** Ignite one at a time using each candle's ignition time as the delay. */
  sequenced: boolean;
  /** When set, candle i is snuffed i * gap ms after the exit begins. */
  snuffGapMs?: number;
}

export function RitualCandles({ lit, lean, holding, sequenced, snuffGapMs = 0 }: RitualCandlesProps) {
  const candles = useMemo(() => ritualCandles(), []);
  return (
    <>
      {candles.map((c) => {
        const rad = (c.angleDeg * Math.PI) / 180;
        const style = {
          left: `${RITUAL_CENTER.x + Math.cos(rad) * RITUAL_RING.rx}%`,
          top: `${RITUAL_CENTER.y + Math.sin(rad) * RITUAL_RING.ry}%`,
          ...(sequenced ? { transitionDelay: `${c.igniteAtMs}ms` } : {}),
          ...(snuffGapMs > 0 ? { "--snuff-delay": `${c.index * snuffGapMs}ms` } : {}),
        } as CSSProperties;
        return (
          <div
            key={c.index}
            aria-hidden="true"
            data-ritual-candle=""
            data-lit={lit ? "true" : "false"}
            className="ritual-candle pointer-events-none absolute"
            style={style}
          >
            {/* A faint warm glow on the smoke behind the flame. */}
            <div className="ritual-glow" />
            <div
              className="ritual-lean"
              data-lean={lean ? "true" : undefined}
              style={
                {
                  "--lean": `${c.leanDeg}deg`,
                  "--wax-h": `${Math.round(WAX_HEIGHT_PX * c.heightScale)}px`,
                } as CSSProperties
              }
            >
              <div className="ritual-flame" data-holding={holding ? "true" : undefined} />
              <div className="ritual-wax" />
            </div>
          </div>
        );
      })}
    </>
  );
}

export interface RitualPortraitProps {
  name: string;
  state: string;
  decayLevel?: number | null;
}

/**
 * The repo's own creature (the same art as the panel Portrait) at the centre
 * of the ritual, dimmed, over a faint cold halo (a blurred radial glow, never
 * a solid shape).
 */
export function RitualPortrait({ name, state, decayLevel = null }: RitualPortraitProps) {
  return (
    <div
      aria-hidden="true"
      data-ritual-portrait=""
      className="ritual-portrait-anchor pointer-events-none absolute"
      style={{ left: `${RITUAL_CENTER.x}%`, top: `${RITUAL_CENTER.y}%` }}
    >
      <div className="ritual-halo" />
      <div className="ritual-portrait">
        <Creature
          decorative
          row={{ name, url: "", state: state as LifecycleState, daysQuiet: 0, decayLevel }}
        />
      </div>
    </div>
  );
}

export function RitualSmoke({ on }: { on: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-ritual-smoke=""
      data-on={on ? "true" : "false"}
      className="ritual-smoke-rise pointer-events-none absolute inset-x-0 top-[4%] h-[48%] bg-cover bg-center"
      style={{ backgroundImage: "url(/art/fog-wisps.webp)" }}
    />
  );
}

export function RitualFrost({ on, holding }: { on: boolean; holding: boolean }) {
  return (
    <>
      {CORNERS.map((corner) => (
        <div
          key={corner}
          aria-hidden="true"
          data-ritual-frost=""
          data-corner={corner}
          data-on={on ? "true" : "false"}
          data-holding={on && holding ? "true" : undefined}
          className="ritual-frost pointer-events-none"
        />
      ))}
    </>
  );
}