/**
 * CropLayer: a clipped wrapper holding ONE element that shows a CSS crop of a
 * painted plate (design: Art-extension technique).
 *
 * - The wrapper is `data-decor-clip`, `aria-hidden`, `inert`, never holds a
 *   focusable element and is never an ancestor of a Creature (Req 3.4, 19.4).
 * - It sits on `--color-night-sky`, so a slow-loading or failed plate never
 *   shows the page behind it. `onError` hides ONLY the image; the wrapper
 *   fill stays (Req 16.7).
 * - The crop comes from `computeCrop`: one uniform scale for both axes
 *   (Req 19.1). The element is `background-size: Wpx Hpx` at
 *   `-rect.x*scale, -rect.y*scale`, never `repeat` (Req 19.4).
 * - An edge mask softens each outer edge so no plate edge shows (Req 19.3).
 *
 * Requirements: 3.4, 16.7, 19.1, 19.3, 19.4
 */
"use client";

import { useState, type CSSProperties } from "react";

import {
  PLATE_SIZE,
  computeCrop,
  type CropInput,
  type PlateId,
} from "@/lib/world-art";
import { themeArt, type Theme } from "@/lib/theme-art";

export interface CropLayerProps {
  plate: PlateId;
  /** Art theme; day plates fall back to night art when unmapped (default "night"). */
  theme?: Theme;
  /** The layer box including Bleed, in px. */
  element: { w: number; h: number };
  focal: { fx: number; fy: number };
  anchor: { ax: number; ay: number };
  flip?: { h: boolean; v: boolean };
  offset?: { x: number; y: number };
  /** Static CSS filter (brightness, tint). */
  filter?: string;
  /** Fill the wrapper with `--color-night-sky` (default true; mist turns it off). */
  backdrop?: boolean;
  /** Edge mask fraction per side, 0 disables it (default 0.06). */
  edgeMask?: number;
  /**
   * Radial feather: an elliptical mask that reaches zero at the middle of all
   * four sides, with an eased falloff, instead of the linear edge strips.
   * Used by the ground mist so no rectangle of fog ever shows its border.
   */
  feather?: boolean;
  className?: string;
  /** Classes on the cropped element (e.g. the mist sway class). */
  layerClassName?: string;
  style?: CSSProperties;
  layerStyle?: CSSProperties;
  "data-testid"?: string;
  "data-place"?: string;
}

const NO_FLIP = { h: false, v: false } as const;

/** Eased radial falloff; zero at the middle of every side, so all four edges are soft. */
export const FEATHER_MASK =
  "radial-gradient(ellipse closest-side at 50% 50%, black 0%, black 50%, color-mix(in srgb, black 75%, transparent) 68%, color-mix(in srgb, black 35%, transparent) 84%, transparent 100%)";

export default function CropLayer({
  plate,
  theme = "night",
  element,
  focal,
  anchor,
  flip = NO_FLIP,
  offset,
  filter,
  backdrop = true,
  edgeMask = 0.06,
  feather = false,
  className = "pointer-events-none absolute inset-0 overflow-clip",
  layerClassName,
  style,
  layerStyle,
  "data-testid": testId,
  "data-place": place,
}: CropLayerProps) {
  const [failed, setFailed] = useState(false);

  const input: CropInput = {
    plate: PLATE_SIZE[plate],
    element,
    focal,
    anchor,
    flip,
    offset,
  };
  const crop = computeCrop(input);

  const src = themeArt(theme, `/art/${plate}.webp`);
  const bgW = crop.plate.w * crop.scale;
  const bgH = crop.plate.h * crop.scale;

  const edge = Math.min(0.25, Math.max(0, edgeMask)) * 100;
  const mask = feather
    ? FEATHER_MASK
    : edge > 0
      ? `linear-gradient(to bottom, transparent, black ${edge}%, black ${100 - edge}%, transparent), linear-gradient(to right, transparent, black ${edge}%, black ${100 - edge}%, transparent)`
      : undefined;

  const scaleX = flip.h ? -1 : 1;
  const scaleY = flip.v ? -1 : 1;

  const inner: CSSProperties = {
    width: element.w,
    height: element.h,
    backgroundImage: failed ? "none" : `url(${src})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${bgW}px ${bgH}px`,
    backgroundPosition: `${-crop.rect.x * crop.scale}px ${-crop.rect.y * crop.scale}px`,
    filter,
    transform: flip.h || flip.v ? `scale(${scaleX}, ${scaleY})` : undefined,
    ...layerStyle,
  };

  const wrapper: CSSProperties = {
    backgroundColor: backdrop ? "var(--color-night-sky)" : undefined,
    maskImage: mask,
    WebkitMaskImage: mask,
    maskComposite: mask ? "intersect" : undefined,
    WebkitMaskComposite: mask ? "source-in" : undefined,
    ...style,
  };

  return (
    <div
      data-decor-clip=""
      data-testid={testId}
      data-place={place}
      aria-hidden="true"
      inert
      className={className}
      style={wrapper}
    >
      <div
        data-testid={testId ? `${testId}-image` : undefined}
        data-crop-plate={plate}
        data-crop-failed={failed ? "true" : "false"}
        className={`absolute left-0 top-0 ${layerClassName ?? ""}`.trim()}
        style={inner}
      />
      {/* Load probe: a div background cannot report errors, so a hidden img
          for the same URL does. Hides the image only; the fill stays. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        hidden
        data-testid={testId ? `${testId}-probe` : undefined}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
