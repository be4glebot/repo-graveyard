/**
 * EnvMist: Environmental_Mist for the explorable worlds (design: Environmental
 * Mist vs Data Fog).
 *
 * One non-tiled, uniform crop of `fog-wisps`, edge-masked, wider than the
 * viewport so the slow sway never shows an edge (Req 19.4). Opacity is a fixed
 * token chosen by `data-place` (`--world-mist-sky|ground|crypt`, all <= 0.25,
 * crypt <= 0.2; Req 15.9) through the `.env-mist` class. It never reads a
 * zombie count (Req 8.13) and never renders the Data_Fog test ids.
 * Sway is `transform` only and is dropped under reduced motion (Req 12.12).
 *
 * Requirements: 3.4, 8.13, 12.12, 15.9, 19.1, 19.3, 19.4
 */
"use client";

import { useTheme } from "@/components/scene/ThemeProvider";
import CropLayer from "./CropLayer";
import type { WorldArtPlace } from "@/lib/world-art";

export interface EnvMistProps {
  /** Picks the opacity token. */
  place: WorldArtPlace;
  /** `far` sits behind the creatures, `near` in front of their feet. */
  layer: "far" | "near";
  reducedMotion?: boolean;
  /** Layer box in px; wider than the viewport plus sway. Defaults from iewportW. */
  width?: number;
  /** Stage width in px; sizes the default layer so wide screens are fully covered. */
  viewportW?: number;
  height?: number;
  /**
   * Radial-feathered mist: the box extends past the viewport edges (so the
   * soft falloff lands outside the visible area's hard edge) and the mask
   * fades all four sides. Off by default so sky and crypt keep their look.
   */
  feather?: boolean;
}

/** Each side the feathered mist box extends past its container (fraction). */
export const MIST_FEATHER_OVERSCAN = 0.12;

/** Narrowest mist layer (px); the original fixed width. */
export const MIST_MIN_WIDTH = 2048;

/**
 * Mist layer width for a stage `viewportW` px wide: at least the stage (plus
 * the feathered overscan) with 20 percent spare for the +-2 percent sway, and
 * never below the original 2048 px, so zoomed-out screens stay covered edge to
 * edge and normal screens keep their look.
 */
export function mistLayerWidth(viewportW: number, feather = false): number {
  const w = Number.isFinite(viewportW) ? Math.max(0, viewportW) : 0;
  const box = w * (feather ? 1 + 2 * MIST_FEATHER_OVERSCAN : 1);
  return Math.round(Math.max(MIST_MIN_WIDTH, box * 1.2));
}

export default function EnvMist({
  place,
  layer,
  reducedMotion = false,
  width: widthProp,
  viewportW = 0,
  height = 420,
  feather = false,
}: EnvMistProps) {
  const { theme } = useTheme();
  // Daytime has no mist or fog wisps.
  if (theme === "day") return null;
  const near = layer === "near";
  const width = widthProp ?? mistLayerWidth(viewportW, feather);
  const base = near ? "env-mist-near" : "env-mist";
  // Dropping the class removes the sway animation; the CSS reduced-motion
  // block does the same, this keeps the DOM honest too.
  const swayClass = reducedMotion ? "" : base;

  return (
    <CropLayer
      plate="fog-wisps"
      data-testid={near ? "place-mist-near" : "place-mist-far"}
      data-place={place}
      element={{ w: width, h: height }}
      // Bottom 40 percent band of the plate. The near layer is shifted by an
      // offset (not flipped: the sway keyframe owns `transform`) so the two
      // never line up.
      focal={{ fx: 0.5, fy: 0.8 }}
      anchor={{ ax: 0.5, ay: 0.5 }}
      offset={near ? { x: 0.3, y: 0 } : undefined}
      backdrop={false}
      edgeMask={0.06}
      feather={feather}
      className="pointer-events-none absolute inset-x-0 bottom-0 overflow-clip"
      style={
        feather
          ? {
              height,
              left: `${-MIST_FEATHER_OVERSCAN * 100}%`,
              right: `${-MIST_FEATHER_OVERSCAN * 100}%`,
            }
          : { height }
      }
      layerClassName={swayClass}
      layerStyle={{
        opacity: "var(--env-mist-opacity, 0)",
        left: "50%",
        marginLeft: -width / 2,
      }}
    />
  );
}
