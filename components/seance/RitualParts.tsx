/**
 * Decorative building blocks shared by the live ritual and its exit layer:
 * the creature portrait with its cold halo, the candles, smoke and frost.
 * Portrait and candle positions come from ritualGeometry (pixels), so the
 * candles always sit outside the portrait.
 * Everything is aria-hidden and pointer-transparent; the styling lives in
 * app/globals.css (tokens only, dim and slow).
 *
 * Requirements: 10.2-10.8
 */

import { useMemo, type CSSProperties } from "react";
import Creature from "@/components/creatures/Creature";
import type { LifecycleState } from "@/lib/lifecycle";
import {
  RITUAL_WAX_BASE_PX,
  ritualCandles,
  ritualGeometry,
  type RitualGeometry,
} from "@/lib/seance-ritual";

const CORNERS = ["tl", "tr", "bl", "br"] as const;

const DEFAULT_GEOMETRY = ritualGeometry();

export interface RitualCandlesProps {
  /** Pixel positions from ritualGeometry(). Defaults to the default-size layout until the ritual has been measured. */
  positions?: RitualGeometry["candles"];
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

export function RitualCandles({ positions = DEFAULT_GEOMETRY.candles, lit, lean, holding, sequenced, snuffGapMs = 0 }: RitualCandlesProps) {
  const stages = useMemo(() => ritualCandles(), []);
  return (
    <>
      {positions.map((pos) => {
        const c = stages[pos.index];
        const style = {
          left: `${pos.x}px`,
          top: `${pos.y}px`,
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
                  "--wax-h": `${Math.round(RITUAL_WAX_BASE_PX * c.heightScale)}px`,
                } as CSSProperties
              }
            >
              <div className="ritual-flame" data-holding={holding ? "true" : undefined} />
              <div className="ritual-wick" />
              <div className="ritual-wax" />
            </div>
          </div>
        );
      })}
    </>
  );
}

export interface RitualPortraitProps {
  /** Pixel placement from ritualGeometry(). Defaults to the default-size layout until the ritual has been measured. */
  placement?: RitualGeometry["portrait"];
  name: string;
  state: string;
  decayLevel?: number | null;
}

/**
 * The repo's own creature (the same art as the panel Portrait) at the centre
 * of the ritual, dimmed, over a faint cold halo (a blurred radial glow, never
 * a solid shape).
 */
export function RitualPortrait({ placement = DEFAULT_GEOMETRY.portrait, name, state, decayLevel = null }: RitualPortraitProps) {
  return (
    <div
      aria-hidden="true"
      data-ritual-portrait=""
      className="ritual-portrait-anchor pointer-events-none absolute"
      style={
        {
          left: `${placement.cx}px`,
          top: `${placement.cy}px`,
          "--portrait-size": `${placement.size}px`,
        } as CSSProperties
      }
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