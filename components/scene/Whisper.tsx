"use client";

/**
 * Whisper scheduler (client component).
 *
 * A thin display scheduler over the pure `composeWhispers(rows, repos, now)`
 * output: the parent computes the ordered whisper strings once from the
 * injected `now` and passes them in as `whispers`, so this component reads no
 * clock and invents no text — it only schedules and fades the strings it is
 * given. When the list is empty (no qualifying data), it renders nothing
 * (Req 8.3).
 *
 * Scheduling (Req 8.1/8.4/8.5):
 * - At most one whisper is visible at a time; the list is cycled in order.
 * - A whisper is shown for 8s, then fades out over a 1s transition.
 * - Successive whispers start no sooner than 20s apart (the 8s visible + 1s
 *   fade + an idle gap sum to the 20s cadence), so the region is quiet between
 *   whispers rather than a constant ticker.
 *
 * Accessibility (Req 8.6): the region is `role="status"` with `aria-live`
 * polite so assistive tech announces each whisper without interrupting.
 *
 * Reduced motion (Req 8.2/8.7/8.8): the component reads
 * `prefers-reduced-motion: reduce` via `window.matchMedia` in a mount effect
 * (SSR-guarded). Under reduced motion it does NOT cycle or fade — it shows a
 * single static whisper (the first) with visibility toggled instantly, no
 * transition. If the preference flips to reduced while a whisper is animating,
 * the cycling effect tears down (clearing its timers) within its next tick and
 * the transition is removed, so no fade is left running. The sound toggle has
 * no effect here — this component never touches audio.
 *
 * Hydration safety: the visible index starts at a deterministic 0 and the first
 * whisper is shown on the server and first client paint; only the *cycling*
 * (advancing the index) begins after mount, so there is no hydration mismatch.
 *
 * All type is the IM Fell English narrative face via the `--font-narrative`
 * token; color is the scene foreground token — no hardcoded hex (Req 8.2).
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

import { useEffect, useState } from "react";

/** Milliseconds a whisper stays fully visible before it begins to fade (Req 8.5). */
const VISIBLE_MS = 8_000;
/** Milliseconds the fade-out transition runs (Req 8.5). */
const FADE_MS = 1_000;
/** Minimum milliseconds between the start of successive whispers (Req 8.4). */
const MIN_INTERVAL_MS = 20_000;
/** Idle gap after a whisper fully fades before the next one starts. */
const IDLE_GAP_MS = MIN_INTERVAL_MS - VISIBLE_MS - FADE_MS;

export interface WhisperProps {
  /**
   * The precomputed, ordered whisper strings from `composeWhispers(rows, repos,
   * now)`. Passing the precomputed list (rather than raw rows/repos/now) keeps
   * this component from reading the clock. An empty list renders nothing
   * (Req 8.3).
   */
  whispers: string[];
}

export default function Whisper({ whispers }: WhisperProps) {
  // Index of the whisper currently in the rotation. Starts at a deterministic 0
  // so server and first client render agree (no hydration mismatch); only
  // advanced by the cycling effect after mount.
  const [index, setIndex] = useState(0);
  // Whether the current whisper is visible (vs. faded out / idle between
  // whispers). Starts visible so the first whisper shows immediately.
  const [visible, setVisible] = useState(true);

  // Reduced-motion state. Default `true` so that, before the media-query
  // listener attaches on mount, we never start cycling or animating — matching
  // the scene's "reduced motion is first-class" default-true-on-server stance.
  const [reducedMotion, setReducedMotion] = useState(true);

  // Subscribe to the reduced-motion media query (client-only, SSR-guarded).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(query.matches);
      // Entering or leaving reduced motion resets the rotation to a clean,
      // visible state so a cycle never resumes mid-fade with a hidden whisper.
      setVisible(true);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const count = whispers.length;

  // Drive the rotation. Guarded so NO timers run under reduced motion or when
  // there is nothing to cycle (0 or 1 whisper). Under reduced motion we fall
  // through to a single static whisper (handled in render); here we simply
  // schedule nothing, which also tears down any in-flight cycle if the
  // preference flips to reduced (Req 8.7/8.8). Each tick: show for VISIBLE_MS,
  // fade over FADE_MS, idle for the remainder of the 20s cadence, then advance.
  useEffect(() => {
    if (reducedMotion || count <= 1) {
      return;
    }

    // A cycle always begins visible: the first cycle starts from the initial
    // `visible = true` state, and every later cycle's advance timer flips
    // visibility back on (below) before advancing `index`, which re-runs this
    // effect — so no synchronous state reset is needed here.

    // After the visible window, begin the 1s fade.
    const fadeTimer = setTimeout(() => {
      setVisible(false);
    }, VISIBLE_MS);

    // After visible + fade + idle gap (= MIN_INTERVAL_MS total), make the next
    // whisper visible and advance to it. Advancing `index` re-runs this effect,
    // scheduling the next cycle.
    const advanceTimer = setTimeout(() => {
      setVisible(true);
      setIndex((i) => (i + 1) % count);
    }, VISIBLE_MS + FADE_MS + IDLE_GAP_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(advanceTimer);
    };
  }, [index, count, reducedMotion]);

  // Nothing to say → render nothing (Req 8.3).
  if (count === 0) {
    return null;
  }

  // Under reduced motion show a single static whisper (the first) with an
  // instant visibility treatment and NO transition (Req 8.7). Otherwise show
  // the rotating whisper with a 1s opacity transition for the fade (Req 8.5).
  const text = reducedMotion ? whispers[0] : whispers[index % count];
  const shown = reducedMotion ? true : visible;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="scene-whisper"
      className={[
        "pointer-events-none select-none",
        "font-[family-name:var(--font-narrative)] italic",
      ].join(" ")}
      style={{
        color: "var(--color-scene-fg)",
        opacity: shown ? 1 : 0,
        // No transition under reduced motion (instant toggle); a 1s fade
        // otherwise. The duration is the FADE_MS constant kept in sync here.
        transition: reducedMotion ? "none" : `opacity ${FADE_MS}ms ease-in-out`,
        textShadow: "0 1px 6px var(--color-night-sky)",
      }}
    >
      {text}
    </div>
  );
}
