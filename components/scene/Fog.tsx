/**
 * Fog overlay (presentational).
 *
 * Encodes the zombie population as fog density (design.md's "every effect
 * encodes data" rule). `fogDensity(zombieCount)` returns a value in `[0,100]`:
 * 0 iff the zombie count is 0, 100 iff it is ≥20, and strictly interior /
 * monotonic non-decreasing for 1–19 (Req 3.3). This component maps that density
 * to the overlay's opacity — an empty graveyard shows no fog, a zombie-heavy
 * one is nearly socked in.
 *
 * The fog tint comes from the `--color-fog` theme token (no hardcoded hex). A
 * single full-bleed layer is enough: the density alone carries the data, so the
 * component stays a pure function of its props with no timers or client state.
 * It is therefore a server/shared component (no `"use client"`); the CSS drift
 * keyframe (gated under reduced motion in `app/globals.css`) can be layered on
 * later without changing this contract.
 *
 * Requirements: 3.3
 */

import { fogDensity } from "@/lib/scene-view";

/**
 * Density (0–100) at which the fog reaches its tasteful maximum on-screen
 * opacity. A fully pinned fog (density 100) stays translucent so the backdrop
 * and creatures read through it rather than being blanked out.
 */
const MAX_FOG_OPACITY = 0.55;

export interface FogProps {
  /**
   * Number of zombie creatures in the scene. Mapped through `fogDensity` to the
   * overlay opacity; defaults to 0 (no fog) when omitted.
   */
  zombieCount: number;
}

export default function Fog({ zombieCount }: FogProps) {
  // Density is a pure function of the zombie count (Req 3.3). Map the 0..100
  // density onto a 0..MAX_FOG_OPACITY opacity so a full house still reads as
  // atmospheric haze rather than an opaque wall.
  const density = fogDensity(zombieCount);
  const opacity = (density / 100) * MAX_FOG_OPACITY;

  // A fully transparent fog layer contributes nothing; skip it so the zero
  // case leaves the scene untouched (density 0 ⇔ zombieCount 0).
  if (opacity <= 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="scene-fog"
      data-fog-density={density}
      className="pointer-events-none absolute inset-0"
      style={{
        opacity,
        // The tint is the single `--color-fog` token; a soft vertical gradient
        // keeps the fog denser toward the ground where the zombies shamble.
        backgroundImage:
          "linear-gradient(to top, var(--color-fog) 0%, color-mix(in srgb, var(--color-fog) 45%, transparent) 55%, transparent 100%)",
        mixBlendMode: "screen",
      }}
    />
  );
}
