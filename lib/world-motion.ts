/**
 * Pure motion helpers for the explorable worlds: scroll rates, depth,
 * stratum lookup, parallax offsets, ambient brightness and gesture
 * classification. No DOM, clock or randomness.
 */
import type { WorldLayout, WorldSlot } from "./world-layout";

export const BAND_RATES = {
  background: 0.88,
  midground: 0.94,
  creature: 1,
  nearMist: 1.06,
  foreground: 1.12,
} as const;

export type BandName = keyof typeof BAND_RATES;

/** Maximum pointer parallax per band, in px (creature band never follows the pointer). */
export const PARALLAX_MAX: Record<BandName, number> = {
  background: 8,
  midground: 16,
  creature: 0,
  nearMist: 26,
  foreground: 26,
};

/** Movement (px) at or under which a pointer gesture is a tap. */
export const GESTURE_TAP_MAX_PX = 8;

export type GestureClass = "tap" | "scroll";

/** Darkest ambient brightness, reached at the deepest point. */
const MIN_AMBIENT = 0.8;

function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Scroll depth in [0, 1]. 0 for an empty range or any non-finite input. */
export function depthPosition(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  if (
    !Number.isFinite(scrollTop) ||
    !Number.isFinite(scrollHeight) ||
    !Number.isFinite(clientHeight) ||
    clientHeight <= 0
  ) {
    return 0;
  }
  const range = scrollHeight - clientHeight;
  if (!(range > 0)) return 0;
  const r = scrollTop / range;
  return Number.isFinite(r) ? clamp(r, 0, 1) : 0;
}

/**
 * Index of the stratum under the viewport centre. Always a valid index
 * (0 when there are no strata or the inputs are unusable).
 */
export function stratumAt(
  layout: Pick<WorldLayout, "strata">,
  scrollTop: number,
  viewportH: number,
): number {
  const strata = layout.strata;
  if (strata.length === 0) return 0;
  const y = Math.max(0, finite(scrollTop)) + Math.max(0, finite(viewportH)) / 2;
  for (let i = 0; i < strata.length; i++) {
    if (y < strata[i].bottom) return i;
  }
  return strata.length - 1;
}

/**
 * Pixel offset of a band: scroll term plus pointer term, additive.
 * The creature band has rate 1 (no scroll term) and no pointer term.
 * Everything is zero in reduced motion.
 */
export function bandOffset(
  band: BandName,
  input: { px: number; py: number; scroll: number; anchor: number; reduced: boolean },
): { x: number; y: number } {
  if (input.reduced) return { x: 0, y: 0 };
  const k = 1 - BAND_RATES[band];
  const max = PARALLAX_MAX[band];
  const scrollTerm = (finite(input.scroll) - finite(input.anchor)) * k;
  return {
    x: finite(input.px) * max,
    y: scrollTerm + finite(input.py) * max,
  };
}

/** 1 at depth 0, never increases with depth, at least 0.8 at depth 1. */
export function ambientBrightness(depth: number): number {
  const d = clamp(finite(depth), 0, 1);
  return 1 - (1 - MIN_AMBIENT) * d;
}

/** scrollTop that centres a slot, clamped to the scrollable range. */
export function scrollTargetFor(
  slot: Pick<WorldSlot, "cy">,
  heightPx: number,
  viewportH: number,
): number {
  // Extreme finite inputs can overflow to Infinity; finite() keeps the result usable.
  const max = finite(Math.max(0, finite(heightPx) - finite(viewportH)), Number.MAX_VALUE);
  return finite(clamp(finite(slot.cy) - finite(viewportH) / 2, 0, max), max);
}

/** Movement of at most 8 px is a tap; anything further is a scroll. */
export function classifyGesture(dxPx: number, dyPx: number): GestureClass {
  const d = Math.hypot(finite(dxPx), finite(dyPx));
  return d <= GESTURE_TAP_MAX_PX ? "tap" : "scroll";
}
