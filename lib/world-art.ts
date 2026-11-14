/**
 * Pure Crop geometry and the Plate and Crop table for the Explorable_Worlds.
 *
 * Every extended world is built from CSS crops of the existing plates (Req
 * 19.1, 19.2, 19.7). This module holds the numbers only: no DOM, no clock, no
 * randomness, no new image file (Req 19.9).
 *
 * - `computeCrop` picks a source rectangle of a plate that covers an element
 *   with ONE uniform scale (Req 19.1), always inside the plate (Req 19.10).
 * - `bleedPx` sizes the overscan that hides a moving layer's plate edges
 *   (Req 19.3).
 * - `plateToStage` maps a plate fraction (the focal point, the painted moon)
 *   to element pixels so data art can be locked onto painted art (Req 7.6).
 */

import { PAINTED_MOON } from "./estate-view";

export type PlateId =
  | "place-sky"
  | "place-ground"
  | "place-crypt"
  | "mg-fence"
  | "mg-fence-tile"
  | "mausoleum"
  | "fog-wisps"
  | "fg-frame"
  | "coffin";

/** Native pixel sizes, read from the WebP headers in `public/art`. */
export const PLATE_SIZE: Record<PlateId, { w: number; h: number }> = {
  "place-sky": { w: 1536, h: 1024 },
  "place-ground": { w: 1536, h: 1024 },
  "place-crypt": { w: 1536, h: 1024 },
  "mg-fence": { w: 1536, h: 595 },
  "mg-fence-tile": { w: 266, h: 595 },
  mausoleum: { w: 440, h: 600 },
  "fog-wisps": { w: 1536, h: 1024 },
  "fg-frame": { w: 1536, h: 1024 },
  coffin: { w: 600, h: 318 },
};

/** Maximum effective upscale of any Crop at a 1920 px wide viewport (Req 19.2). */
export const MAX_UPSCALE = 1.75;

/** Minimum overscan in CSS px, and the exact bleed under reduced motion (Req 19.3). */
export const REDUCED_OVERSCAN_PX = 8;

export interface CropInput {
  plate: { w: number; h: number };
  /** The layer box including Bleed, in px. */
  element: { w: number; h: number };
  /** Point of the plate to keep, as plate fractions. */
  focal: { fx: number; fy: number };
  /** Where in the element the focal point lands, as element fractions. */
  anchor: { ax: number; ay: number };
  flip: { h: boolean; v: boolean };
  /**
   * Optional horizontal/vertical shift of the source rectangle as a fraction
   * of the Crop size (Req 19.5 variation by offset). Applied before clamping.
   */
  offset?: { x: number; y: number };
}

export interface CropResult {
  /** One value for both axes. */
  scale: number;
  /** Source rectangle in plate px, always inside the plate. */
  rect: { x: number; y: number; w: number; h: number };
  /** Scale relative to native pixels for this element (callers pass the 1920 px element). */
  upscale: number;
  plate: { w: number; h: number };
  flip: { h: boolean; v: boolean };
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/** Finite number or the fallback. */
const fin = (v: number, fallback: number): number =>
  Number.isFinite(v) ? v : fallback;

/**
 * Cover crop: `scale = max(ew/pw, eh/ph)`; the source rectangle has the
 * element's aspect ratio, places the focal point at the anchor, then is clamped
 * inside the plate. Horizontal and vertical scale are therefore equal.
 */
export function computeCrop(input: CropInput): CropResult {
  const pw = Math.max(1, fin(input.plate.w, 1));
  const ph = Math.max(1, fin(input.plate.h, 1));
  const ew = Math.max(1, fin(input.element.w, 1));
  const eh = Math.max(1, fin(input.element.h, 1));

  const scale = Math.max(ew / pw, eh / ph);
  // Cover guarantees both are <= the plate; min() absorbs float rounding.
  const rw = Math.min(pw, ew / scale);
  const rh = Math.min(ph, eh / scale);

  const fx = clamp(fin(input.focal.fx, 0.5), 0, 1);
  const fy = clamp(fin(input.focal.fy, 0.5), 0, 1);
  const ax = clamp(fin(input.anchor.ax, 0.5), 0, 1);
  const ay = clamp(fin(input.anchor.ay, 0.5), 0, 1);
  const { h: flipH, v: flipV } = input.flip;

  // A mirrored display puts the anchor at (1 - a) of the source rectangle.
  const sx = flipH ? 1 - ax : ax;
  const sy = flipV ? 1 - ay : ay;
  const ox = fin(input.offset?.x ?? 0, 0) * rw;
  const oy = fin(input.offset?.y ?? 0, 0) * rh;

  const x = clamp(fx * pw - sx * rw + ox, 0, pw - rw);
  const y = clamp(fy * ph - sy * rh + oy, 0, ph - rh);

  return {
    scale,
    rect: { x, y, w: rw, h: rh },
    upscale: scale,
    plate: { w: pw, h: ph },
    flip: { h: flipH, v: flipV },
  };
}

/**
 * Element-pixel position of a plate fraction (`fx`, `fy`) under a Crop,
 * including flips. For the Crop's own focal point this is the anchor position
 * (unless clamping or an offset moved the rectangle).
 */
export function plateToStage(
  crop: CropResult,
  element: { w: number; h: number },
  fx: number,
  fy: number,
): { x: number; y: number } {
  const px = fin(fx, 0.5) * crop.plate.w;
  const py = fin(fy, 0.5) * crop.plate.h;
  let x = (px - crop.rect.x) * crop.scale;
  let y = (py - crop.rect.y) * crop.scale;
  if (crop.flip.h) x = element.w - x;
  if (crop.flip.v) y = element.h - y;
  return { x, y };
}

/**
 * Bleed (per side, px) for a moving layer. The largest visible stratum-local
 * offset is `|scroll - anchor| <= (Vh + Hs + blend) / 2`, scaled by
 * `|1 - rate|`, plus the pointer and drift maxima. Reduced motion collapses it
 * to the 8 px overscan (Req 19.3, 5.8).
 */
export function bleedPx(args: {
  viewportH: number;
  stratumH: number;
  blendH: number;
  rate: number;
  maxPointer: number;
  drift: number;
  reduced: boolean;
}): { x: number; y: number } {
  if (args.reduced) {
    return { x: REDUCED_OVERSCAN_PX, y: REDUCED_OVERSCAN_PX };
  }
  const vh = Math.max(0, fin(args.viewportH, 0));
  const hs = Math.max(0, fin(args.stratumH, 0));
  const blend = Math.max(0, fin(args.blendH, 0));
  const pointer = Math.max(0, fin(args.maxPointer, 0));
  const drift = Math.max(0, fin(args.drift, 0));
  const rate = fin(args.rate, 1);

  const scrollTerm = (Math.abs(1 - rate) * (vh + hs + blend)) / 2;
  return {
    x: Math.max(REDUCED_OVERSCAN_PX, Math.ceil(pointer + drift)),
    y: Math.max(REDUCED_OVERSCAN_PX, Math.ceil(scrollTerm + pointer + drift)),
  };
}

export type WorldArtPlace = "sky" | "ground" | "crypt";

export interface WorldCropSpec {
  stratumId: string;
  plate: PlateId;
  focal: { fx: number; fy: number };
  anchor: { ax: number; ay: number };
  flip: { h: boolean; v: boolean };
  /** Fraction of the Crop size to shift the source rectangle (Req 19.5). */
  offset?: { x: number; y: number };
  /** CSS `filter` (static, no per-frame cost). */
  filter: string;
  /** Optional tint token name (no hex in components). */
  tint?: "warm" | "cool";
}

const NO_FLIP = { h: false, v: false } as const;
const FLIP_H = { h: true, v: false } as const;

/**
 * The Plate and Crop table (design, "Plate and Crop table"). Only croppable
 * base-plate strata are listed; once-per-world landmarks, `mg-fence*`,
 * `mausoleum`, `fog-wisps`, `fg-frame` and `coffin` are placed by their own
 * components. The sky `high-air` focal point is the existing `PAINTED_MOON`.
 */
export const WORLD_ART: Record<WorldArtPlace, WorldCropSpec[]> = {
  sky: [
    {
      stratumId: "high-air",
      plate: "place-sky",
      focal: { fx: PAINTED_MOON.fx, fy: PAINTED_MOON.fy },
      anchor: { ax: 0.75, ay: 0.22 },
      flip: NO_FLIP,
      filter: "brightness(0.8)",
    },
    {
      stratumId: "mid-sky",
      plate: "place-sky",
      focal: { fx: 0.3, fy: 0.5 },
      anchor: { ax: 0.5, ay: 0.5 },
      flip: FLIP_H,
      filter: "brightness(0.75)",
    },
    {
      stratumId: "cloud-bank",
      plate: "place-sky",
      focal: { fx: 0.35, fy: 0.86 },
      anchor: { ax: 0.35, ay: 0.66 },
      flip: NO_FLIP,
      offset: { x: 0.3, y: 0 },
      filter: "brightness(0.8)",
    },
  ],
  ground: [
    {
      stratumId: "gate-path",
      plate: "place-ground",
      focal: { fx: 0.4, fy: 0.38 },
      anchor: { ax: 0.4, ay: 0.45 },
      flip: NO_FLIP,
      filter: "brightness(0.55)",
    },
    {
      stratumId: "mid-path",
      plate: "place-ground",
      focal: { fx: 0.5, fy: 0.78 },
      anchor: { ax: 0.5, ay: 0.5 },
      flip: FLIP_H,
      filter: "brightness(0.55)",
    },
    {
      stratumId: "mausoleum-approach",
      plate: "place-ground",
      focal: { fx: 0.62, fy: 0.55 },
      anchor: { ax: 0.6, ay: 0.55 },
      flip: NO_FLIP,
      offset: { x: 0.3, y: 0 },
      filter: "brightness(0.55)",
    },
  ],
  crypt: [
    {
      stratumId: "entry",
      plate: "place-crypt",
      focal: { fx: 0.47, fy: 0.42 },
      anchor: { ax: 0.5, ay: 0.55 },
      flip: NO_FLIP,
      filter: "brightness(0.7)",
    },
    {
      stratumId: "chamber-1",
      plate: "place-crypt",
      focal: { fx: 0.5, fy: 0.6 },
      anchor: { ax: 0.5, ay: 0.55 },
      flip: NO_FLIP,
      offset: { x: -0.3, y: 0 },
      filter: "none",
      tint: "warm",
    },
    {
      stratumId: "chamber-2",
      plate: "place-crypt",
      focal: { fx: 0.5, fy: 0.6 },
      anchor: { ax: 0.5, ay: 0.55 },
      flip: FLIP_H,
      filter: "brightness(0.85)",
      tint: "cool",
    },
    {
      stratumId: "chamber-3",
      plate: "place-crypt",
      focal: { fx: 0.3, fy: 0.62 },
      anchor: { ax: 0.4, ay: 0.55 },
      flip: NO_FLIP,
      offset: { x: 0.25, y: 0 },
      filter: "brightness(0.7)",
    },
  ],
};
