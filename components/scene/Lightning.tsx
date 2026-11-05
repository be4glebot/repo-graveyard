"use client";

/**
 * Lightning overlay (client component).
 *
 * Encodes the ancient-zombie population as lightning cadence (design.md's
 * "every effect encodes data" rule). `lightningIntervalSeconds(ancientCount)`
 * returns `max(7, 16 − 3 × (ancientCount − 1))` seconds, or `null` when there
 * are no ancient zombies — in which case no flashes ever render (Req 3.4, 3.5).
 *
 * Each flash is a brief dim overlay whose peak opacity is capped at ≤70% by the
 * `.lightning-flash` keyframe in `app/globals.css` (photosensitivity safety,
 * not a style choice); this component only toggles that class on and off and
 * never sets opacity above what the keyframe allows. At most one flash renders
 * per interval.
 *
 * Reduced motion (Req 3.9): no flashes. The component reads
 * `prefers-reduced-motion: reduce` via `window.matchMedia` in a mount effect
 * (SSR-guarded) and schedules no timers while it is active. The globals.css
 * reduced-motion rule also pins `.lightning-flash` to opacity 0 as a belt-and-
 * braces guard, but we additionally avoid scheduling the timers at all.
 *
 * Hydration safety: the flash state is purely client-side. The first (server)
 * render and the first client paint both render the overlay at rest (no flash
 * class), so there is no hydration mismatch; flashing only begins after mount.
 *
 * Requirements: 3.4, 3.5, 3.9
 */

import { useEffect, useRef, useState } from "react";

import { lightningIntervalSeconds } from "@/lib/scene-view";

export interface LightningProps {
  /**
   * Number of ancient zombie creatures (zombie decay level 4). Mapped through
   * `lightningIntervalSeconds` to the flash cadence; 0 (the default) disables
   * lightning entirely.
   */
  ancientCount: number;
}

export default function Lightning({ ancientCount }: LightningProps) {
  // The flash cadence is a pure function of the ancient-zombie count (Req
  // 3.4); `null` means "no lightning at all" (Req 3.5).
  const intervalSeconds = lightningIntervalSeconds(ancientCount);

  // `flashing` toggles the `.lightning-flash` class. It starts false so the
  // server HTML and the first client paint match (no hydration mismatch); a
  // flash is a transient client-only state.
  const [flashing, setFlashing] = useState(false);

  // Reduced-motion state. Default `true` so that, before the media-query
  // listener attaches on mount, we never schedule a flash — matching the
  // design's "reduced motion is first-class / default to true on the server"
  // stance and avoiding a flash before we know the user's preference.
  const [reducedMotion, setReducedMotion] = useState(true);

  // Subscribe to the reduced-motion media query (client-only, SSR-guarded).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Hold the clear-flash timeout so cleanup can cancel a flash in flight.
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule the periodic flashes. Guarded so NO timer is attached when there
  // is no interval (ancient count 0) or when reduced motion is active (Req 3.5,
  // 3.9). Re-runs whenever the interval or the reduced-motion preference
  // changes, tearing down the previous schedule first.
  useEffect(() => {
    if (reducedMotion || intervalSeconds === null) {
      return;
    }

    const intervalMs = intervalSeconds * 1000;

    // One flash per interval tick: toggle the class on, then clear it after the
    // keyframe's envelope so the next tick starts from rest. The keyframe caps
    // peak opacity at ≤0.7; we only toggle the class, never the opacity.
    const tick = () => {
      setFlashing(true);
      flashTimeoutRef.current = setTimeout(() => {
        setFlashing(false);
      }, intervalMs);
    };

    const scheduled = setInterval(tick, intervalMs);
    return () => {
      clearInterval(scheduled);
      if (flashTimeoutRef.current !== null) {
        clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
      // Leave the overlay at rest on teardown so a route/prop change never
      // strands a visible flash.
      setFlashing(false);
    };
  }, [intervalSeconds, reducedMotion]);

  // Nothing to render when lightning is disabled — keeps the DOM clean when
  // there are no ancient zombies (Req 3.5).
  if (intervalSeconds === null) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="scene-lightning"
      data-lightning-interval={intervalSeconds}
      className={`pointer-events-none absolute inset-0${
        flashing ? " lightning-flash" : ""
      }`}
      style={{
        // Peak opacity is governed by the `.lightning-flash` keyframe (≤0.7);
        // at rest the overlay is fully transparent. The flash tint is the
        // `--color-lightning` token — no hardcoded hex.
        backgroundColor: "var(--color-lightning)",
        opacity: 0,
      }}
    />
  );
}
