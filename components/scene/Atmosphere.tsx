"use client";

/**
 * Atmosphere set dressing (presentational).
 *
 * Layers the non-data-encoding set dressing over the backdrop: a vignette, an
 * SVG-noise film-grain overlay at 7–8% opacity, cobwebs in both top corners,
 * and 2–5 bats (Req 3.6, 3.7). Moon, fog, and lightning are separate components
 * because they each encode a real fact; this layer is the ambient darkness that
 * surrounds them.
 *
 * All colors come from `@theme` tokens (no hardcoded hex). All set dressing is
 * drawn in code — the grain is an inline SVG `feTurbulence` data URI, the
 * cobwebs and bats are token-tinted shapes — so nothing here loads an image
 * asset or any audio module (Req 13.4).
 *
 * Determinism / hydration: bat and grain positions are fixed constants, never
 * `Math.random()` at render time, so the server and client markup match and
 * there is no hydration mismatch. Bat motion is a CSS keyframe (`.bat-flap`,
 * defined alongside the other scene motion) which the globals.css reduced-
 * motion rule stops; this component only places the shapes and tags them with
 * the motion class, so under reduced motion the cobwebs/vignette/grain stay
 * static and the bats stop moving (Req 3.9). The component itself is a pure
 * function of its (empty) props, so it stays a shared/server component.
 *
 * Brightness ≤0.6 (Req 3.8) is applied to the whole layer so the set dressing
 * stays darker and lower-contrast than the creatures.
 *
 * Requirements: 3.6, 3.7, 3.9
 */

import type { CSSProperties } from "react";

import { useTheme } from "@/components/scene/ThemeProvider";
import { effectProps } from "@/lib/world-effects";

/** Film-grain overlay opacity, inside the required 7–8% band (Req 3.7). */
const GRAIN_OPACITY = 0.075;

/** Brightness cap for all set dressing so it stays darker than creatures (Req 3.8). */
const SET_DRESSING_BRIGHTNESS = 0.6;

/**
 * Inline SVG `feTurbulence` noise as a data URI for the film grain. Drawn in
 * code (no raster asset), monochrome fractal noise tiled across the viewport.
 */
const GRAIN_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">' +
      '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>' +
      '<feColorMatrix type="saturate" values="0"/></filter>' +
      '<rect width="100%" height="100%" filter="url(#n)"/></svg>',
  );

/**
 * Deterministic bat placements (viewport percentages) with a per-bat animation
 * delay for a staggered flight. Count is 4 — inside the required 2–5 band (Req
 * 3.6). Fixed values, never random, to keep SSR and client markup identical.
 */
const BATS: ReadonlyArray<{ left: number; top: number; scale: number; delaySeconds: number }> =
  [
    { left: 18, top: 16, scale: 0.8, delaySeconds: 0 },
    { left: 42, top: 10, scale: 1, delaySeconds: 1.3 },
    { left: 63, top: 20, scale: 0.7, delaySeconds: 2.1 },
    { left: 80, top: 13, scale: 0.9, delaySeconds: 0.7 },
  ];

/**
 * A single code-drawn bat: a small token-tinted silhouette tagged with the
 * `.bat-flap` motion class (stopped under reduced motion via globals.css).
 */
function Bat({
  left,
  top,
  scale,
  delaySeconds,
}: {
  left: number;
  top: number;
  scale: number;
  delaySeconds: number;
}) {
  return (
    <span
      {...effectProps("bats")}
      className="bat-flap absolute block"
      style={
        {
          left: `${left}%`,
          top: `${top}%`,
          // Scale is passed as a CSS variable so the `.bat-flap` keyframe (which
          // owns `transform`) can fold it into its own transform rather than
          // fighting an inline `transform`. Under reduced motion the keyframe is
          // disabled and the bat rests at its placed position.
          "--bat-scale": scale,
          animationDelay: `${delaySeconds}s`,
        } as CSSProperties
      }
    >
      <svg
        width="34"
        height="16"
        viewBox="0 0 34 16"
        aria-hidden="true"
        fill="currentColor"
        style={{ color: "var(--color-night-sky-top)" }}
      >
        {/* A simple bat silhouette: two wings and a body, drawn in code. */}
        <path d="M17 6c-1.5-3-4-5-6.5-5 .5 1.5 0 3-1 4C7 3.5 4 3 1 5c2 .5 3 2 3.5 4C6 11 9 12 11 10c1.5 1.5 4 1.5 6 0 2 2 5 1 6.5-1 .5-2 1.5-3.5 3.5-4-3-2-6-1.5-8.5 0-1-1-1.5-2.5-1-4C15 1 12.5 3 11 6" />
      </svg>
    </span>
  );
}

export type AtmosphereProps = Record<string, never>;

export default function Atmosphere(_props: AtmosphereProps) {
  void _props;
  const { theme } = useTheme();

  // Daytime: no vignette haze, grain, cobwebs or bats over the bright art.
  if (theme === "day") return null;

  return (
    <div
      aria-hidden="true"
      data-testid="scene-atmosphere"
      className="pointer-events-none absolute inset-0"
      style={{ filter: `brightness(${SET_DRESSING_BRIGHTNESS})` }}
    >
      {/* Vignette: a radial darkening toward the edges, drawn with the night-sky
          token so the corners sink into shadow. */}
      <div
        data-testid="scene-vignette"
        {...effectProps("vignette")}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, color-mix(in srgb, var(--color-night-sky) 85%, transparent) 100%)",
        }}
      />

      {/* Film grain: tiled SVG noise at 7–8% opacity (Req 3.7). */}
      <div
        data-testid="scene-grain"
        {...effectProps("grain")}
        className="absolute inset-0"
        style={{
          backgroundImage: `url("${GRAIN_DATA_URI}")`,
          backgroundRepeat: "repeat",
          opacity: GRAIN_OPACITY,
          mixBlendMode: "overlay",
        }}
      />

      {/* Cobwebs in both top corners, drawn in code with the bone token. */}
      <CobwebCorner corner="left" />
      <CobwebCorner corner="right" />

      {/* 2–5 bats (here 4), deterministically placed (Req 3.6). */}
      {BATS.map((bat, index) => (
        <Bat key={index} {...bat} />
      ))}
    </div>
  );
}

/**
 * A code-drawn cobweb anchored in a top corner. Mirrored horizontally for the
 * right corner. Strands are token-tinted strokes — no raster asset.
 */
function CobwebCorner({ corner }: { corner: "left" | "right" }) {
  const isLeft = corner === "left";
  return (
    <svg
      data-testid={`scene-cobweb-${corner}`}
      {...effectProps("cobwebs")}
      width="140"
      height="140"
      viewBox="0 0 140 140"
      aria-hidden="true"
      className="absolute top-0"
      style={{
        [isLeft ? "left" : "right"]: 0,
        transform: isLeft ? undefined : "scaleX(-1)",
        color: "var(--color-bone)",
        opacity: 0.22,
      }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      {/* Radial anchor strands fanning out from the corner. */}
      <path d="M0 0 L140 60 M0 0 L120 120 M0 0 L60 140 M0 0 L30 0 M0 0 L0 30" />
      {/* Concentric web rings bridging the strands. */}
      <path d="M22 0 Q30 30 0 22 M55 0 Q70 70 0 55 M95 0 Q110 110 0 95" />
    </svg>
  );
}
