/**
 * Night sky: the base gradient plus a field of stars.
 *
 * Draws the night-sky gradient from the `--color-night-sky*` tokens and a
 * field of small twinkling dots over it. The sky sits at the very back of the
 * Scene, behind the backdrop plates, and is the base `WHEN the Scene renders`
 * layer the moon and backdrop composite over (Req 3.1 context).
 *
 * Hydration safety: the star positions are computed from a fixed seed with a
 * small deterministic pseudo-random generator (the same approach as
 * `docs/design-canvas/ArtPreview.dc.html`). Because the sequence is a pure
 * function of the constant seed, the server and the client produce byte-for-byte
 * identical markup — there is no `Math.random()` at module scope or during
 * render, so there is no hydration mismatch.
 *
 * This component is purely presentational: no state, no clock, no I/O. Colors
 * come from `@theme` tokens; no hardcoded hex appears here.
 *
 * Requirements: 3.1
 */

"use client";

import DayPalette from "@/components/scene/DayPalette";
import { useTheme } from "@/components/scene/ThemeProvider";

/** How many stars to scatter across the sky band. */
const STAR_COUNT = 60;

/** Fixed seed for the deterministic star layout (matches the art preview). */
const STAR_SEED = 11;

interface Star {
  /** Horizontal position as a viewport percentage. */
  leftPct: number;
  /** Vertical position as a viewport percentage (upper sky band). */
  topPct: number;
  /** Dot diameter in pixels. */
  size: number;
  /** Twinkle animation offset in seconds. */
  delay: number;
}

/**
 * Deterministically generates the star field from a fixed seed. A linear
 * congruential generator gives a stable, repeatable sequence so server and
 * client renders match exactly. Computed once at module load, never from the
 * system clock or `Math.random()`.
 */
function buildStars(): Star[] {
  let seed = STAR_SEED;
  const rand = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    stars.push({
      leftPct: Number((rand() * 100).toFixed(2)),
      // Keep stars in the upper ~45% band where the night sky shows.
      topPct: Number((8 + rand() * 38).toFixed(2)),
      size: rand() < 0.15 ? 3 : 2,
      delay: Number((rand() * 3).toFixed(2)),
    });
  }
  return stars;
}

/** Stable star layout, computed once (deterministic, SSR-safe). */
const STARS: Star[] = buildStars();

export interface SkyProps {
  /** Extra classes for the sky wrapper (e.g. positioning within the Scene). */
  className?: string;
}

export default function Sky({ className }: SkyProps) {
  const { theme } = useTheme();
  // Day: warm sky and soft meadow from day tokens, no night gradient or stars.
  if (theme === "day") {
    return <DayPalette variant="full" className={className} />;
  }
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0${
        className ? ` ${className}` : ""
      }`}
      style={{
        // Top-to-bottom night-sky gradient from the sky tokens (back to front).
        background:
          "linear-gradient(to bottom, var(--color-night-sky-top) 0%, var(--color-night-sky-mid) 55%, var(--color-night-sky-bottom) 100%)",
      }}
    >
      {STARS.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${star.leftPct}%`,
            top: `${star.topPct}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            backgroundColor: "var(--color-scene-fg)",
            opacity: 0.5,
            // Kept for later wiring of a twinkle keyframe; harmless with no
            // matching animation class so it stays a static starfield today.
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
