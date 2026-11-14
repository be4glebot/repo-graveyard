/**
 * Placement of the Hub's turning-soon notice. Pure: all rects are passed in
 * (relative to the map root), nothing is read from the DOM or the clock.
 *
 * The notice must never cover a place plaque or the header. Preferred spot is a
 * lane to the RIGHT of the Sky place (beside its ghost sprites, in the empty
 * moon sky), starting below the header. When that lane is too narrow the notice
 * sits directly above the Sky plaque instead, clamped below the header.
 */

export interface NoticeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface NoticePlacementInput {
  /** Map root width in px. */
  vw: number;
  /** Bottom edge of the header (0 when there is none). */
  headerBottom: number;
  /** The whole Sky place button (sprites + plaque). */
  sky: NoticeRect;
  /** The Sky plaque only. */
  plaque: NoticeRect;
  /** Measured notice height (single-line fallback when 0). */
  noticeH?: number;
}

export interface NoticePlacement {
  left: number;
  top: number;
  maxWidth: number;
  anchor: "lane" | "above";
}

/** Widest the notice grows (one line). */
export const NOTICE_MAX_W = 440;
/** Narrowest lane worth using before falling back to "above the plaque". */
export const NOTICE_MIN_LANE_W = 260;
/** Narrowest lane (px) the notice may wrap into when there is no room above the plaque. */
export const NOTICE_MIN_WRAP_LANE_W = 180;
/** Clearance from the viewport edge. */
export const NOTICE_EDGE = 12;
/** Clearance below the header / above the plaque. */
export const NOTICE_GAP = 10;
/** Clearance from the Sky button; covers the pointer-parallax drift (≤16px). */
export const NOTICE_LANE_GAP = 24;

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

export function noticePlacement(input: NoticePlacementInput): NoticePlacement {
  const vw = Math.max(0, finite(input.vw));
  const headerBottom = Math.max(0, finite(input.headerBottom));
  const noticeH = Math.max(40, finite(input.noticeH ?? 0));
  const minTop = headerBottom + NOTICE_GAP;

  const laneLeft = finite(input.sky.right) + NOTICE_LANE_GAP;
  const laneW = vw - NOTICE_EDGE - laneLeft;
  if (laneW >= NOTICE_MIN_LANE_W) {
    return {
      left: laneLeft,
      top: Math.max(minTop, finite(input.sky.top)),
      maxWidth: Math.min(NOTICE_MAX_W, laneW),
      anchor: "lane",
    };
  }

  // Above the plaque needs `noticeH + NOTICE_GAP` of room under the header. On a
  // short viewport there is none, and clamping below the header would land the
  // notice ON the plaque; a narrower lane (the notice wraps to two lines) is
  // better than that, so use it down to NOTICE_MIN_WRAP_LANE_W.
  const roomAbove = finite(input.plaque.top) - NOTICE_GAP - noticeH - minTop;
  if (roomAbove < 0) {
    // Beside the Sky button first, then (the sprites above the plaque may be
    // wider than the plaque) beside the plaque itself, which is all that must
    // stay clear.
    const plaqueLaneLeft = finite(input.plaque.right) + NOTICE_LANE_GAP;
    const plaqueLaneW = vw - NOTICE_EDGE - plaqueLaneLeft;
    const left = laneW >= NOTICE_MIN_WRAP_LANE_W ? laneLeft : plaqueLaneLeft;
    const width = laneW >= NOTICE_MIN_WRAP_LANE_W ? laneW : plaqueLaneW;
    if (width >= NOTICE_MIN_WRAP_LANE_W) {
      return {
        left,
        top: Math.max(minTop, finite(input.sky.top)),
        maxWidth: Math.min(NOTICE_MAX_W, width),
        anchor: "lane",
      };
    }
  }

  const maxWidth = Math.max(0, Math.min(NOTICE_MAX_W, vw - 2 * NOTICE_EDGE));
  const centre = (finite(input.plaque.left) + finite(input.plaque.right)) / 2;
  const left = Math.min(
    Math.max(NOTICE_EDGE, centre - maxWidth / 2),
    Math.max(NOTICE_EDGE, vw - NOTICE_EDGE - maxWidth),
  );
  return {
    left,
    top: Math.max(minTop, finite(input.plaque.top) - NOTICE_GAP - noticeH),
    maxWidth,
    anchor: "above",
  };
}
