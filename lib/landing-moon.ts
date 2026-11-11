/**
 * Pure landing-page moon geometry. The Moon sits in the upper-right corner of
 * the gate scene, clear of the centred text block (h1, tagline, scrim).
 *
 * The same constants drive the CSS (via the `*Css` helpers, used by
 * `GateScene`) and the numeric rects (used by the geometry test), so the test
 * reasons about exactly what the page renders.
 *
 * Narrow viewports (< WIDE_MIN_PX): the text block is too close horizontally,
 * so the text starts below the moon's bottom edge (plus parallax and a gap).
 * Wide viewports: the moon sits in the corner beside the centred block.
 */

/** Disc diameter: clamp(MIN, VW_PCT of the viewport, MAX), in px. */
export const MOON_SIZE_MIN_PX = 72;
export const MOON_SIZE_VW_PCT = 9;
export const MOON_SIZE_MAX_PX = 120;

/** Inset from the top edge, px. */
export const MOON_TOP_PX = 32;
/** Inset from the right edge: clamp(MIN, VW_PCT, MAX), px. */
export const MOON_RIGHT_MIN_PX = 24;
export const MOON_RIGHT_VW_PCT = 3;
export const MOON_RIGHT_MAX_PX = 48;

/** The moon layer's pointer-parallax travel (matches PARALLAX_BANDS_PX.front). */
export const MOON_PARALLAX_PX = 24;
/** Breathing room kept between the moon (with parallax) and the text block. */
export const MOON_TEXT_GAP_PX = 16;

/** Text block (scrim): max width and side padding of the landing `main`. */
export const TEXT_BLOCK_MAX_W_PX = 576;
export const TEXT_BLOCK_SIDE_PX = 24;
/** Top padding of the landing `main` when no moon clearance is needed. */
export const TEXT_BLOCK_BASE_TOP_PX = 64;

/** From this width up the moon is beside the text block, not above it. */
export const WIDE_MIN_PX = 960;

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function moonDiameter(vw: number): number {
  return clamp((vw * MOON_SIZE_VW_PCT) / 100, MOON_SIZE_MIN_PX, MOON_SIZE_MAX_PX);
}

export function moonRightInset(vw: number): number {
  return clamp((vw * MOON_RIGHT_VW_PCT) / 100, MOON_RIGHT_MIN_PX, MOON_RIGHT_MAX_PX);
}

/** The moon disc rect (no parallax) for a viewport width. */
export function moonRect(vw: number): Rect {
  const d = moonDiameter(vw);
  const right = vw - moonRightInset(vw);
  return { left: right - d, top: MOON_TOP_PX, right, bottom: MOON_TOP_PX + d };
}

/** The moon rect grown by its parallax travel: the worst case on screen. */
export function moonRectWithParallax(vw: number): Rect {
  const r = moonRect(vw);
  const p = MOON_PARALLAX_PX;
  return { left: r.left - p, top: r.top - p, right: r.right + p, bottom: r.bottom + p };
}

/** Minimum top of the text block (scrim) for a viewport width. */
export function textBlockTop(vw: number): number {
  if (vw >= WIDE_MIN_PX) return TEXT_BLOCK_BASE_TOP_PX;
  return Math.max(
    TEXT_BLOCK_BASE_TOP_PX,
    moonRect(vw).bottom + MOON_PARALLAX_PX + MOON_TEXT_GAP_PX,
  );
}

/** The text block's horizontal extent (height is open-ended downward). */
export function textBlockRect(vw: number): Rect {
  const w = Math.min(TEXT_BLOCK_MAX_W_PX, vw - 2 * TEXT_BLOCK_SIDE_PX);
  const left = (vw - w) / 2;
  return { left, top: textBlockTop(vw), right: left + w, bottom: Number.POSITIVE_INFINITY };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/* ---- CSS strings built from the same constants ---- */

export const moonSizeCss = () =>
  `clamp(${MOON_SIZE_MIN_PX}px, ${MOON_SIZE_VW_PCT}vw, ${MOON_SIZE_MAX_PX}px)`;

export const moonRightCss = () =>
  `clamp(${MOON_RIGHT_MIN_PX}px, ${MOON_RIGHT_VW_PCT}vw, ${MOON_RIGHT_MAX_PX}px)`;

/** Top padding for the landing `main` below WIDE_MIN_PX. */
export const textClearanceCss = () =>
  `calc(${MOON_TOP_PX}px + ${moonSizeCss()} + ${MOON_PARALLAX_PX + MOON_TEXT_GAP_PX}px)`;
