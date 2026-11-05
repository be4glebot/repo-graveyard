"use client";

/**
 * Travel transition overlay (client component).
 *
 * The short, skippable parallax-zoom-plus-fog transition that plays when the
 * user travels from the estate map into a place (`onEnterPlace`). It is an
 * `aria-hidden` overlay owned by `SceneView`, mounted only during the
 * transition window and unmounted when it reports `done`. It is purely a
 * visual flourish over the already-committed navigation: `SceneView` has
 * already pushed `?at=place` and set `view` by the time this mounts, so the
 * overlay never changes application state — it only runs the motion and then
 * calls `onDone` so the owner can clear the transitioning flag and move focus
 * to the place heading.
 *
 * ## Two paths
 *
 * **Motion path (≈`TRAVEL_MS` = 1200 ms, ±100).** Four overlapping beats from
 * `Travel.dc.html`:
 *   1. parallax-zoom — two backdrop plates (`layer-bg-far` and
 *      `layer-fg-frame`) scale toward the place at *distinct* rates, so the
 *      foreground rushes past faster than the far plate (depth);
 *   2. fog wipe — a radial fog layer rises to full occlusion (opacity 1) before
 *      the content swap, hiding the map→place cut;
 *   3. title fade — the place name fades in;
 *   4. creature raise — stand-in motes rise on a fixed per-creature stagger
 *      computed from the reused `animationDelay`, scaled so every raise *starts*
 *      (and so finishes) before the end of the window.
 *
 * **Reduced-motion path (`TRAVEL_CROSSFADE_MS` = 300 ms).** A single opacity
 * crossfade with no zoom, no fog, and no stagger — consistent with the scene's
 * reduced-motion discipline and the global `prefers-reduced-motion` CSS rule.
 *
 * ## Skippable
 *
 * While the window is open, a `keydown`/`pointerdown` anywhere jumps straight
 * to the arrived state and calls `onDone` once. The same single-fire guard
 * covers the natural timer completion, so `onDone` fires exactly once whether
 * the user skips or lets it play out.
 *
 * ## Accessibility
 *
 * The overlay is `aria-hidden` and `pointer-events-none`, so it is invisible to
 * assistive tech and never receives or traps focus. The arrival focus move
 * (to the `PlaceHeading`) is performed by `SceneView` in the `onDone` handler,
 * not here — this component only reports completion.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { TRAVEL_CROSSFADE_MS, TRAVEL_MS, type PlaceId, PLACES } from "@/lib/estate-view";
import { animationDelay, ANIMATION_DELAY_MAX_SECONDS } from "@/lib/scene-view";

export interface TravelTransitionProps {
  /** The place being travelled to; drives the title and zoom target. */
  place: PlaceId;
  /**
   * Representative repo names for the stagger. Each name is hashed through the
   * reused `animationDelay` so motes rise on a stable, spread-out stagger. May
   * be empty (empty place) — then no motes render and only the zoom/fog/title
   * play. Ignored entirely on the reduced-motion path.
   */
  creatureNames?: string[];
  /** When true, play the 300 ms crossfade with no zoom/fog/stagger. */
  reducedMotion: boolean;
  /** Called exactly once when the transition finishes (or is skipped). */
  onDone: () => void;
}

/**
 * Fraction of `TRAVEL_MS` reserved as a tail after the last creature raise
 * begins, so every raise has started before the window closes (the raises
 * themselves are short CSS fades). The per-creature `animationDelay` range
 * ([0, ANIMATION_DELAY_MAX_SECONDS)) is compressed into the leading part of the
 * window so "all raises finish before the end" (Req 13.2).
 */
const STAGGER_WINDOW_FRACTION = 0.6;

export default function TravelTransition({
  place,
  creatureNames = [],
  reducedMotion,
  onDone,
}: TravelTransitionProps) {
  const meta = PLACES[place];

  // Duration is the full motion window, or the short crossfade under reduced
  // motion.
  const durationMs = reducedMotion ? TRAVEL_CROSSFADE_MS : TRAVEL_MS;

  // `arrived` flips on once, at the end of the window or on a skip, and drives
  // the final (fully zoomed / fully faded) visual state.
  const [arrived, setArrived] = useState(false);

  // Single-fire guard: `onDone` must run exactly once whether the timer elapses
  // or the user skips. A ref avoids a stale-closure double fire across the
  // timer and the event listeners.
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    setArrived(true);
    onDone();
  }, [onDone]);

  // Natural completion: end the transition when the window elapses.
  useEffect(() => {
    const timer = window.setTimeout(finish, durationMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [durationMs, finish]);

  // Skippable: any key or pointer press finishes immediately (Req 13.4). The
  // listeners live only for the transition window (cleaned up on unmount) and
  // are passive — they never block the key/pointer from its normal behavior.
  useEffect(() => {
    const onSkip = (): void => {
      finish();
    };
    window.addEventListener("keydown", onSkip);
    window.addEventListener("pointerdown", onSkip);
    return () => {
      window.removeEventListener("keydown", onSkip);
      window.removeEventListener("pointerdown", onSkip);
    };
  }, [finish]);

  // --- Reduced-motion crossfade -------------------------------------------
  // A single opacity layer, no zoom/fog/stagger (Req 13.6). The layer starts
  // transparent and fades to opaque over the crossfade, masking the swap.
  if (reducedMotion) {
    return (
      <div
        aria-hidden="true"
        data-testid="travel-transition"
        data-place={place}
        data-reduced-motion="true"
        className="pointer-events-none fixed inset-0 z-[100]"
        style={{
          backgroundColor: "var(--color-night-sky)",
          opacity: arrived ? 1 : 0,
          transition: `opacity ${TRAVEL_CROSSFADE_MS}ms ease-in-out`,
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: arrived ? 1 : 0,
            transition: `opacity ${TRAVEL_CROSSFADE_MS}ms ease-in-out`,
          }}
        >
          <h2 className="m-0 font-heading text-3xl font-bold uppercase tracking-[5px] text-scene-fg">
            {meta.name}
          </h2>
        </div>
      </div>
    );
  }

  // --- Motion path ---------------------------------------------------------
  // The stagger compresses each name's `animationDelay` (a value in
  // [0, ANIMATION_DELAY_MAX_SECONDS) seconds) into the leading
  // STAGGER_WINDOW_FRACTION of the travel window, so every raise begins — and
  // thus finishes — before the end (Req 13.2). Dividing by the max normalizes
  // to [0, 1); scaling by the window keeps all delays inside it.
  const staggerWindowMs = TRAVEL_MS * STAGGER_WINDOW_FRACTION;
  const delayMsFor = (name: string): number =>
    (animationDelay(name) / ANIMATION_DELAY_MAX_SECONDS) * staggerWindowMs;

  return (
    <div
      aria-hidden="true"
      data-testid="travel-transition"
      data-place={place}
      data-reduced-motion="false"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      style={{ backgroundColor: "transparent" }}
    >
      {/* --- Parallax zoom: two plates scaling toward the place at distinct
          rates. The far plate drifts (1.15×), the foreground frame rushes
          (1.6×), reading as depth as the view dives into the place. --- */}
      <div
        data-testid="travel-zoom-far"
        className="absolute inset-0"
        style={{
          transformOrigin: "50% 45%",
          transform: arrived ? "scale(1.15)" : "scale(1)",
          transition: `transform ${TRAVEL_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
          backgroundColor: "var(--color-night-sky)",
          opacity: 0.9,
        }}
      />
      <div
        data-testid="travel-zoom-fg"
        className="absolute inset-0"
        style={{
          transformOrigin: "50% 60%",
          transform: arrived ? "scale(1.6)" : "scale(1)",
          transition: `transform ${TRAVEL_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
          backgroundImage:
            "radial-gradient(circle at 50% 55%, transparent 40%, color-mix(in srgb, var(--color-night-sky) 70%, transparent) 100%)",
        }}
      />

      {/* --- Fog wipe: a radial fog layer rising to FULL occlusion (opacity 1)
          before the content swap, hiding the map→place cut (Req 13.2). It
          completes well inside the window so the title can read through on the
          far side. --- */}
      <div
        data-testid="travel-fog"
        className="absolute inset-0"
        style={{
          opacity: arrived ? 1 : 0,
          transition: `opacity ${Math.round(TRAVEL_MS * 0.5)}ms ease-in ${Math.round(
            TRAVEL_MS * 0.4,
          )}ms`,
          backgroundImage:
            "radial-gradient(circle at 50% 50%, var(--color-fog) 0%, var(--color-night-sky) 75%)",
        }}
      />

      {/* --- Title fade: the place name fades in near the end. --- */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: arrived ? 1 : 0,
          transition: `opacity ${Math.round(TRAVEL_MS * 0.3)}ms ease-out ${Math.round(
            TRAVEL_MS * 0.6,
          )}ms`,
        }}
      >
        <h2
          data-testid="travel-title"
          className="m-0 font-heading text-4xl font-bold uppercase tracking-[6px] text-scene-fg"
          style={{ textShadow: "0 1px 8px var(--color-night-sky)" }}
        >
          {meta.name}
        </h2>
      </div>

      {/* --- Creature raise: stand-in motes rising on the per-creature stagger
          from `animationDelay`, every raise starting before the window end
          (Req 13.2). Empty places render no motes. --- */}
      {creatureNames.length > 0 ? (
        <div
          data-testid="travel-raise"
          className="absolute inset-x-0 bottom-[18%] flex items-end justify-center gap-6"
        >
          {creatureNames.map((name) => (
            <span
              key={name}
              data-testid="travel-raise-mote"
              className="block h-10 w-6 rounded-full bg-candle-400/70"
              style={{
                opacity: arrived ? 1 : 0,
                transform: arrived ? "translateY(0)" : "translateY(28px)",
                transition: [
                  `opacity ${Math.round(TRAVEL_MS * 0.3)}ms ease-out`,
                  `transform ${Math.round(TRAVEL_MS * 0.3)}ms ease-out`,
                ].join(", "),
                transitionDelay: `${Math.round(delayMsFor(name))}ms`,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
