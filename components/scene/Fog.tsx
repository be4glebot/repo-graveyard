"use client";

/**
 * Fog overlay (presentational, two render sites).
 *
 * Encodes the zombie population as fog density (design.md's "every effect
 * encodes data" rule). `fogDensity(zombieCount)` returns a value in `[0,100]`:
 * 0 iff the zombie count is 0, 100 iff it is ≥20, and strictly interior /
 * monotonic non-decreasing for 1–19 (Req 3.3 / 6.4). This component maps that
 * single density to the overlay's opacity — an empty graveyard shows no fog, a
 * zombie-heavy one is nearly socked in.
 *
 * The density contract is frozen (Req 6.7 / 8.4): `fogDensity` stays the single
 * density function (no second density fn is introduced), and the opacity of
 * BOTH layers derives from the SAME `fogDensity(zombieCount)` call. Because the
 * `opacity <= 0 → return null` early-out gates on that one density, every layer
 * is null iff the zombie count is 0.
 *
 * Two render sites straddle the creature band (Req 6.2/6.3). The parent slots
 * one instance into each z-band:
 *
 *   - `layer="dense"` → **Fog_Dense**: the far fog, rendered behind the
 *     creatures. Keeps the EXISTING `scene-fog` root (same `data-testid`, same
 *     `data-fog-density`, same null-iff-0-zombies early-out) so the frozen fog
 *     tests keep passing. Opacity = `Fog_Opacity`, painted from `fog-wisps`,
 *     drifting one direction on a ~90s loop.
 *   - `layer="thin"` → **Fog_Thin**: a SEPARATE sibling element
 *     (`data-testid="scene-fog-near"`), the near fog rendered in front of the
 *     creatures' feet. Also null iff the zombie count is 0 (same density gate).
 *     Opacity = `Fog_Opacity * 0.25`, painted from `fog-wisps-thin`, drifting
 *     the OPPOSITE direction on a ~55s loop.
 *
 * Drift is `transform: translateX` on a double-width tiled strip (Req 9.2) — the
 * `.fog-wisps` / `.fog-wisps-thin` keyframes in `app/globals.css` animate
 * `translateX(0 → -50%)` / `translateX(0 → 50%)` so the tiling wraps with no
 * visible seam. It is NEVER `background-position`. `reducedMotion` pauses both
 * drifts at a fixed offset (via the reduced-motion media query in globals.css,
 * reinforced here by omitting the drift class), and every layer is
 * `pointer-events: none` (Req 7.5) so clicks and focus pass through.
 *
 * The fog tint comes from the `--color-fog` theme token (no hardcoded hex). The
 * component stays a pure function of its props with no timers or client state,
 * so it remains a server/shared component (no `"use client"`).
 *
 * Requirements: 3.3, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.5, 9.1, 9.2
 */

import { useTheme } from "@/components/scene/ThemeProvider";
import { fogDensity } from "@/lib/scene-view";
import { themeArt } from "@/lib/theme-art";

/**
 * Density (0–100) at which the fog reaches its tasteful maximum on-screen
 * opacity. A fully pinned fog (density 100) stays translucent so the backdrop
 * and creatures read through it rather than being blanked out.
 */
const MAX_FOG_OPACITY = 0.55;

/**
 * The near (thin) fog reads as a fainter wash in front of the creatures' feet:
 * its opacity is a quarter of the dense layer's for the same zombie count
 * (Req 6.3). Both layers still derive from the SAME `fogDensity` call.
 */
const THIN_OPACITY_FACTOR = 0.25;

/** Which of the two fog render sites this instance paints. */
export type FogLayer = "dense" | "thin";

export interface FogProps {
  /**
   * Number of zombie creatures in the scene. Mapped through `fogDensity` to the
   * overlay opacity; defaults to 0 (no fog) when omitted.
   */
  zombieCount: number;
  /**
   * Which render site to paint: `"dense"` is the far fog behind the creatures
   * (the existing `scene-fog` root), `"thin"` is the near fog in front of them
   * (the sibling `scene-fog-near` element).
   */
  layer: FogLayer;
  /**
   * When true, the drift animation is held at a fixed horizontal offset so no
   * motion advances (Req 6.5). Defaults to false; clearing it resumes the
   * drift (Req 6.6). The reduced-motion media query in `app/globals.css` also
   * pauses the keyframes, so this is belt-and-suspenders.
   */
  reducedMotion?: boolean;
}

export default function Fog({
  zombieCount,
  layer,
  reducedMotion = false,
}: FogProps) {
  const { theme } = useTheme();
  // Daytime has no data fog.
  if (theme === "day") {
    return null;
  }

  // Density is a pure function of the zombie count (Req 3.3 / 6.4). Both layers
  // derive their opacity from this SAME single `fogDensity` call — no second
  // density function (Req 6.7). Map the 0..100 density onto a 0..MAX_FOG_OPACITY
  // base so a full house still reads as atmospheric haze, not an opaque wall.
  const density = fogDensity(zombieCount);
  const baseOpacity = (density / 100) * MAX_FOG_OPACITY;

  // The dense layer uses the full opacity; the thin layer a quarter of it.
  const opacity =
    layer === "thin" ? baseOpacity * THIN_OPACITY_FACTOR : baseOpacity;

  // A fully transparent fog layer contributes nothing; skip it so the zero
  // case leaves the scene untouched. Because both layers gate on the same
  // `density`, each is null iff the zombie count is 0 (Req 6.4 / 6.7). Guard on
  // `baseOpacity` (not the per-layer value) so the thin layer's quarter scaling
  // can never round a positive density down to a null layer.
  if (baseOpacity <= 0) {
    return null;
  }

  const isThin = layer === "thin";

  // Painted fog art, not a flat gradient band: the dense layer uses the
  // `fog-wisps` painting, the thin layer `fog-wisps-thin`, each tiled across the
  // double-width drifting strip (visual fix 2C). `background-size: auto 100%`
  // keeps the art at the strip's height and lets it repeat horizontally.
  const fogArt = isThin
    ? `url(${themeArt(theme, "/art/fog-wisps-thin.webp")})`
    : `url(${themeArt(theme, "/art/fog-wisps.webp")})`;

  // Each layer covers only the bottom of the scene where the ground fog sits
  // — the dense bank reaches higher (55%) than the thin near-fog (30%) — and a
  // top-fading mask keeps neither with a hard top edge (visual fix 2C).
  const bandHeight = isThin ? "30%" : "55%";
  const fadeMask = "linear-gradient(to top, black 60%, transparent)";

  // Drift class: `.fog-wisps` (~90s, translateX 0 → -50%) for the dense layer,
  // `.fog-wisps-thin` (~55s, translateX 0 → +50%, opposite direction) for the
  // thin layer. Both live on a double-width strip so the tiling wraps with no
  // seam (Req 9.2). Under reduced motion we omit the drift class entirely so the
  // strip holds at its fixed offset (the media query in globals.css also pauses
  // it); clearing reduced motion restores the class and the drift resumes.
  const driftClass = reducedMotion
    ? ""
    : isThin
      ? "fog-wisps-thin"
      : "fog-wisps";

  return (
    <div
      aria-hidden="true"
      data-testid={isThin ? "scene-fog-near" : "scene-fog"}
      data-fog-density={density}
      className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
      style={{
        height: bandHeight,
        opacity,
        mixBlendMode: "screen",
        // Soften the top edge so the painted bank fades into the scene rather
        // than ending in a hard line.
        maskImage: fadeMask,
        WebkitMaskImage: fadeMask,
      }}
    >
      {/*
        The drifting strip is TWICE the container width (`w-[200%]`) so the
        `translateX(±50%)` keyframe scrolls exactly one strip width and the
        painted art tiles across the seam. Only `transform` animates (Req 9.1),
        keeping the drift on the compositor.
      */}
      <div
        className={`absolute inset-y-0 left-0 w-[200%] ${driftClass}`}
        style={{
          backgroundImage: fogArt,
          backgroundSize: "auto 100%",
          backgroundRepeat: "repeat-x",
        }}
      />
    </div>
  );
}
