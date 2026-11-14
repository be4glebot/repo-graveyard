"use client";

/**
 * Travel transition (controller hook + fog overlay) \u2014 the "pulled in" transition
 * that animates the REAL scenes between the estate map and a place.
 *
 * ## Why a controller, not an overlay of copies
 *
 * The earlier version animated empty copy layers OVER an already-switched
 * scene, so the destination was visible under the overlay before any zoom and
 * the "zoom" layer had no real content. This version inverts that: `SceneView`
 * keeps the SOURCE view mounted and applies the zoom transform to the real
 * view's wrapper (`travel-stage`), switches `view` to the destination only at
 * the CUT (while the fog fully covers the screen), then animates the real
 * DESTINATION view in. Nothing is a copy; every value is exactly at rest before
 * the overlay is removed, so there is no end jump.
 *
 * `useTravel` owns the clock (rAF + a safety-net timer so it is deterministic
 * under fake timers) and exposes the phase-driven `stageStyle` (applied by
 * `SceneView` to the mounted real view), the `cut` flag (SceneView switches the
 * rendered view when it flips), per-scene fade hints (`othersFade` for the map's
 * non-target places, `chromeFade` for the destination chrome), and the `fog`
 * state consumed by `<TravelFog>`. It calls `onCut` once at the cut and `onDone`
 * once at the end (or on a skip).
 *
 * ## Timeline (forward, map -> place; total ~2.2s; transform/opacity/filter only)
 *
 *   - 0\u2013900ms   source map zooms `scale 1 -> 3.2`, origin at the place centre,
 *                ease-in (accelerating, like being pulled in); blur `0 -> 6px`
 *                from 450ms; the OTHER three places fade to 0 by 600ms.
 *   - 650\u20131100  fog rush rises `opacity 0 -> 1` (art `scale 1.4 -> 2.2`), fully
 *                opaque 1050\u20131250.
 *   - 1150       the CUT (hidden under the fog): `SceneView` switches to the place.
 *   - 1150\u20132000  destination place `scale 1.25 -> 1`, blur `4px -> 0`, ease-out;
 *                fog fades `1 -> 0` over 1250\u20131700.
 *   - 1700\u20132200  destination chrome fades in; focus moves to PlaceHeading at 2200.
 *
 * Reverse (place -> map) mirrors it: the source place `scale 1 -> 0.8` + chrome
 * fades, fog covers, cut to the map at 1150, the map starts `scale 3.2 -> 1`
 * (origin at the place we left) and pulls back out.
 *
 * Skip (click/Esc) jumps straight to the end state. Reduced motion replaces the
 * whole thing with a 300ms crossfade, cut at 150ms.
 *
 * Requirements: 13.1\u201313.7, 9.1, 9.4
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  TRAVEL_CROSSFADE_MS,
  PLACE_CENTERS,
  type PlaceId,
} from "@/lib/estate-view";
import { themeArt, type Theme } from "@/lib/theme-art";
import { dayCopy, placeNameKey } from "@/lib/day-copy";

/** Which way the pull runs: into a place, or back out to the map. */
export type TravelDirection = "in" | "out";

/** Total forward/reverse motion-path duration (ms). */
export const TRAVEL_FULL_MS = 2200;
/** The cut instant (ms): when `SceneView` swaps the mounted view, under the fog. */
export const TRAVEL_CUT_MS = 1150;
/** Reduced-motion cut instant (ms), mid-crossfade. */
export const TRAVEL_REDUCED_CUT_MS = 150;

/** Ease-in (accelerate) for the inward pull; ease-out (decelerate) for arrival. */
const EASE_IN = "cubic-bezier(.55,0,1,.45)";
const EASE_OUT = "cubic-bezier(0,.55,.45,1)";

export interface UseTravelOptions {
  /** Art theme for the destination preload only (default night). */
  theme?: Theme;
  /** The place being entered ("in") or left ("out"); drives the zoom origin. */
  place: PlaceId;
  /** Pull direction. */
  direction: TravelDirection;
  /** When true, use the 300ms crossfade instead of the full motion path. */
  reducedMotion: boolean;
  /** Called exactly once at the cut, so `SceneView` swaps the mounted view. */
  onCut: () => void;
  /** Called exactly once at the end (or on a skip). */
  onDone: () => void;
}

export interface TravelState {
  /** Has the cut happened? Before: source is mounted. After: destination. */
  cut: boolean;
  /** Transform/filter/opacity to apply to the mounted real view (`travel-stage`). */
  stageStyle: CSSProperties;
  /** 0..1 fade of the map's NON-target places (1 = fully visible, 0 = gone). */
  othersFade: number;
  /** 0..1 fade-in of the destination chrome (heading/chips/pager/plaques). */
  chromeFade: number;
  /** Fog overlay state consumed by `<TravelFog>`. */
  fog: { opacity: number; scale: number };
  /** True on the reduced-motion crossfade path. */
  reduced: boolean;
}

/** Linear 0..1 progress of `elapsed` across `[start, end]` (clamped). */
function phase(elapsed: number, start: number, end: number): number {
  if (elapsed <= start) return 0;
  if (elapsed >= end) return 1;
  return (elapsed - start) / (end - start);
}

/** Accelerating ease-in (slow start, fast finish) — the "being pulled in"
 *  feel for the source zoom. Cubic. */
function easeIn(t: number): number {
  return t * t * t;
}

/** Decelerating ease-out (fast start, gentle settle) — the arrival feel for the
 *  destination zoom. Cubic. */
function easeOut(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/**
 * The travel clock + phase model. Returns the current `TravelState` for
 * `SceneView` to apply to the real scenes, and drives `onCut` / `onDone`.
 */
export function useTravel(options: UseTravelOptions): TravelState {
  const { place, direction, reducedMotion, onCut, onDone } = options;
  const theme = options.theme ?? "night";
  const durationMs = reducedMotion ? TRAVEL_CROSSFADE_MS : TRAVEL_FULL_MS;
  const cutAt = reducedMotion ? TRAVEL_REDUCED_CUT_MS : TRAVEL_CUT_MS;

  const [elapsed, setElapsed] = useState(0);
  const [cut, setCut] = useState(false);

  // Single-fire guards for the two one-shot callbacks.
  const cutRef = useRef(false);
  const doneRef = useRef(false);

  const doCut = useCallback(() => {
    if (cutRef.current) return;
    cutRef.current = true;
    setCut(true);
    onCut();
  }, [onCut]);

  const finish = useCallback(() => {
    doCut(); // ensure the cut has happened if we jumped straight to the end
    if (doneRef.current) return;
    doneRef.current = true;
    setElapsed(durationMs);
    onDone();
  }, [doCut, durationMs, onDone]);

  // Preload the destination place's painting (fire-and-forget, SSR-guarded).
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.Image === "undefined") {
      return;
    }
    const img = new window.Image();
    img.src = themeArt(theme, `/art/place-${place}.webp`);
  }, [place, theme]);

  // The clock: advance `elapsed` on a ~60fps interval, fire the cut at `cutAt`,
  // finish at the end. Using `setInterval` + `Date.now()` (rather than rAF +
  // performance.now) keeps the whole timeline deterministically advanceable
  // under vitest fake timers, so the ORDER tests (source vs destination mounted,
  // fog fully opaque at 1100ms) are reliable. The cut/end also have their own
  // safety-net timers so they fire exactly on time regardless of interval drift.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const start = Date.now();
    const tick = (): void => {
      const e = Date.now() - start;
      if (e >= cutAt) {
        doCut();
      }
      if (e >= durationMs) {
        setElapsed(durationMs);
        finish();
        return;
      }
      setElapsed(e);
    };
    const interval = window.setInterval(tick, 16);
    const cutTimer = window.setTimeout(doCut, cutAt);
    const endTimer = window.setTimeout(() => {
      setElapsed(durationMs);
      finish();
    }, durationMs);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(cutTimer);
      window.clearTimeout(endTimer);
    };
  }, [cutAt, durationMs, doCut, finish]);

  // Skippable: any key (incl. Esc) or pointer press jumps to the end state.
  useEffect(() => {
    const onSkip = (): void => finish();
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", onSkip);
    window.addEventListener("pointerdown", onSkip);
    return () => {
      window.removeEventListener("keydown", onSkip);
      window.removeEventListener("pointerdown", onSkip);
    };
  }, [finish]);

  const centre = PLACE_CENTERS[place];
  const originCss = `${centre.x * 100}% ${centre.y * 100}%`;

  // --- Reduced-motion crossfade: the stage just fades; cut at 150ms. --------
  if (reducedMotion) {
    // Before the cut the source fades out; after, the destination fades in.
    const p = phase(elapsed, 0, durationMs);
    const done = elapsed >= durationMs;
    const stageOpacity = cut
      ? Math.min(1, (elapsed - cutAt) / Math.max(1, durationMs - cutAt))
      : 1 - p;
    return {
      cut,
      reduced: true,
      stageStyle: {
        opacity: done ? 1 : Math.max(0, Math.min(1, stageOpacity)),
        transition: "opacity 120ms linear",
      },
      othersFade: 1,
      chromeFade: cut ? 1 : 0,
      fog: { opacity: 0, scale: 1 },
    };
  }

  // --- Full motion path -----------------------------------------------------
  if (!cut) {
    // Source half (0\u2013cut): zoom the real source view.
    const zoomP = easeIn(phase(elapsed, 0, 900));
    const blurFrom = phase(elapsed, 450, 900);
    let scale: number;
    let blur: number;
    if (direction === "in") {
      scale = 1 + 2.2 * zoomP; // map 1 -> 3.2
      blur = blurFrom * 6;
    } else {
      scale = 1 - 0.2 * zoomP; // place 1 -> 0.8
      blur = blurFrom * 6;
    }
    const othersFade = 1 - phase(elapsed, 0, 600); // other places gone by 600ms
    return {
      cut,
      reduced: false,
      stageStyle: {
        transformOrigin: originCss,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        willChange: "transform, filter",
      },
      othersFade: direction === "in" ? othersFade : 1,
      // On "out" the leaving place's chrome fades with the zoom.
      chromeFade: direction === "out" ? 1 - zoomP : 1,
      fog: fogState(elapsed),
    };
  }

  // Destination half (cut\u2013end): animate the real destination view in.
  const enterP = easeOut(phase(elapsed, TRAVEL_CUT_MS, 2000));
  let scale: number;
  if (direction === "in") {
    scale = 1.25 - 0.25 * enterP; // place 1.25 -> 1
  } else {
    scale = 3.2 - 2.2 * enterP; // map 3.2 -> 1, pulling back out
  }
  const blur = (1 - enterP) * 4; // 4px -> 0
  const chromeFade = phase(elapsed, 1700, 2200); // chrome fades in last
  // At the very end, pin everything exactly at rest so there is no jump.
  const atRest = elapsed >= durationMs;
  return {
    cut,
    reduced: false,
    stageStyle: {
      transformOrigin: originCss,
      transform: atRest ? "none" : `scale(${scale})`,
      filter: atRest ? "none" : `blur(${blur}px)`,
      willChange: "transform, filter",
    },
    othersFade: 1,
    chromeFade: atRest ? 1 : chromeFade,
    fog: fogState(elapsed),
  };
}

/** Fog opacity/scale across the transition: rise 650\u20131100, hold opaque
 *  1050\u20131250, fall 1250\u20131700; art scales 1.4 -> 2.2 as it rises. */
function fogState(elapsed: number): { opacity: number; scale: number } {
  // Rise to full by 1050, hold opaque 1050-1250, then fall 1250-1700, so the
  // cut at 1150 happens under a fully opaque fog (visual fix r3 travel).
  const rise = phase(elapsed, 650, 1050);
  const fall = phase(elapsed, 1250, 1700);
  const opacity = Math.max(0, Math.min(1, rise) - fall);
  const scale = 1.4 + 0.8 * phase(elapsed, 650, 1700);
  return { opacity, scale };
}

export interface TravelFogProps {
  /** Fog state from `useTravel` (opacity/scale). */
  fog: { opacity: number; scale: number };
  /** The destination's display NAME, shown only on the reduced-motion card.
   *  Never the place we left on "out" \u2014 the caller passes the arrival name. */
  destinationName?: string;
  /** True on the reduced-motion crossfade path (renders the name card). */
  reduced: boolean;
  /** Direction + place for test hooks. */
  direction: TravelDirection;
  place: PlaceId;
  /** Visual theme only; never affects timing or travel state. */
  theme?: Theme;
}

/**
 * The fog-rush overlay (and, on the reduced-motion path, a centred destination
 * name card). `aria-hidden` + `pointer-events-none`. This is the ONLY overlay;
 * the scenes themselves are the real, animated views beneath it.
 */
export function TravelFog({
  fog,
  destinationName,
  reduced,
  direction,
  place,
  theme = "night",
}: TravelFogProps) {
  const day = theme === "day";
  if (reduced) {
    return (
      <div
        aria-hidden="true"
        data-testid="travel-transition"
        data-direction={direction}
        data-place={place}
        data-reduced-motion="true"
        className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
        style={{
          backgroundColor: day
            ? "color-mix(in srgb, var(--color-day-haze) 80%, transparent)"
            : "color-mix(in srgb, var(--color-night-sky) 80%, transparent)",
        }}
      >
        {destinationName ? (
          <h2
            data-testid="travel-title"
            className="m-0 font-heading text-3xl font-bold uppercase tracking-[5px] text-scene-fg"
          >
            {destinationName}
          </h2>
        ) : null}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-testid="travel-transition"
      data-direction={direction}
      data-place={place}
      data-reduced-motion="false"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      {/* Night veil under the wisps: it hides the view swap at the cut with a
          dark wash (not a bright white flash) and follows the fog opacity. */}
      <div
        data-testid="travel-veil"
        className="absolute inset-0"
        style={{
          opacity: fog.opacity,
          backgroundColor: day
            ? "var(--color-day-haze)"
            : "var(--color-night-sky)",
        }}
      />
      <div
        data-testid="travel-fog"
        className="absolute inset-0"
        style={
          day
            ? {
                // Day: a warm wash instead of the dark fog art.
                opacity: fog.opacity,
                transform: `scale(${fog.scale})`,
                transformOrigin: "center",
                backgroundImage: "var(--day-wash)",
              }
            : {
                opacity: fog.opacity,
                transform: `scale(${fog.scale})`,
                transformOrigin: "center",
                backgroundImage: `url(${themeArt(theme, "/art/fog-wisps.webp")})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                // Dim the plate so the mist reads as dark fog, not a white-grey flash.
                filter: "brightness(0.45)",
              }
        }
      />
    </div>
  );
}

/** Convenience: the display name a direction arrives at (estate on "out"). */
export function travelDestinationName(
  direction: TravelDirection,
  place: PlaceId,
  theme: Theme = "night",
): string {
  return direction === "in"
    ? dayCopy(theme, placeNameKey(place))
    : dayCopy(theme, "travel.estate");
}


export interface TravelRunnerProps {
  /** The place being entered ("in") or left ("out"). */
  place: PlaceId;
  direction: TravelDirection;
  reducedMotion: boolean;
  /** Visual theme only; never a dependency of timers or travel state. */
  theme?: Theme;
  /** The REAL source view (mounted before the cut). */
  from: ReactNode;
  /** The REAL destination view (mounted after the cut). */
  to: ReactNode;
  /** Switch the committed nav view at the cut (under the fog). */
  onCut: () => void;
  /** Clear the travel + move arrival focus at the end. */
  onDone: () => void;
  /**
   * Lets `SceneView` observe the live travel state each frame (e.g. to thread
   * `othersFade` / `chromeFade` into the mounted view). Called on every render.
   */
  onState?: (state: TravelState) => void;
}

/**
 * Runs a travel transition: owns the clock via `useTravel`, mounts the REAL
 * source view until the cut and the REAL destination after it, wraps whichever
 * is mounted in the `travel-stage` element carrying the zoom transform, and
 * renders the fog overlay above. The stage wraps ONLY the scene \u2014 never the
 * site header / Lights-Sound chrome, which `SceneView` renders outside it.
 */
export function TravelRunner({
  place,
  direction,
  reducedMotion,
  theme = "night",
  from,
  to,
  onCut,
  onDone,
  onState,
}: TravelRunnerProps) {
  const state = useTravel({
    place,
    direction,
    reducedMotion,
    theme,
    onCut,
    onDone,
  });
  onState?.(state);

  return (
    <>
      <div
        data-testid="travel-stage"
        className="absolute inset-0"
        // The transform/filter/opacity live on the stage wrapper around the
        // REAL mounted view (it always has the scene as children, never an
        // empty copy). The per-frame value comes from the rAF clock in
        // `useTravel`, with the easing baked into the value curve there — so no
        // CSS `transition` is used (that would smooth/lag the exact values).
        style={
          {
            ...state.stageStyle,
            ["--travel-others-fade" as string]: String(state.othersFade),
            ["--travel-chrome-fade" as string]: String(state.chromeFade),
          } as CSSProperties
        }
      >
        {state.cut ? to : from}
      </div>
      <TravelFog
        fog={state.fog}
        reduced={state.reduced}
        direction={direction}
        place={place}
        theme={theme}
        destinationName={
          state.reduced ? travelDestinationName(direction, place, theme) : undefined
        }
      />
    </>
  );
}

export { EASE_IN, EASE_OUT };
