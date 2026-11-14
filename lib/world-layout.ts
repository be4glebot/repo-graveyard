/**
 * World layout (explorable-worlds, tasks 4.4 / 4.9 / 4.10).
 *
 * One pure function, `computeWorldLayout`, turns a place, an ordered list of
 * names and the viewport size into World_Length, creature slots, strata,
 * features and blend zones. No clock, DOM, storage or randomness other than the
 * seeded per-name hash (`mulberry32(xmur3("world|" + place + "|" + name))`).
 *
 * Structure (so later parts slot in without reshaping the file):
 *   - Part A (this task): types, `WORLD_CONFIG`, viewport normalisation,
 *     `worldLength`, column rules, per-name look, 0 and 1 name layouts.
 *   - Part B (task 4.9): real slot placement for 2+ names (`placeSlots`).
 *   - Part C (task 4.10): ground path, crypt chambers, strata, features,
 *     blends for 2+ names (`buildStructure`).
 */

import {
  CREATURE_BASE_SIZE,
  MOBILE_BREAKPOINT,
  PLAQUE_H,
  PLAQUE_W,
  SCATTER_BRIGHTNESS_STEP,
  SCATTER_SCALE_MAX,
  SCATTER_SCALE_MIN,
  TOMBSTONE_TILT_DEG,
  mulberry32,
  plaqueLiftPx,
  xmur3,
} from "@/lib/estate-view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorldPlace = "sky" | "ground" | "crypt";

export interface WorldInput {
  place: WorldPlace;
  /** Names of the current Plot, already in orderForPlace order (urgency first). */
  names: readonly string[];
  /** Scroller client width, px. */
  viewportW: number;
  /** Scroller client height, px; <= 0 or non-finite falls back to 812. */
  viewportH: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

export interface WorldSlot {
  /** Index into the input names (urgency order). */
  index: number;
  /** Body-box centre in stage px. */
  cx: number;
  cy: number;
  /** Rendered creature box side, px (CREATURE_BASE_SIZE * scale). */
  size: number;
  scale: number;
  /** Depth band from the name hash only (0 back, 2 front). */
  band: 0 | 1 | 2;
  brightness: number;
  /** Sky only mirrors. */
  mirrored: boolean;
  /** Ground tilt in [-6, 6] degrees; 0 elsewhere. */
  tilt: number;
  body: Rect;
  plaque: Rect;
  /** Index into `strata`. */
  stratum: number;
  /** Ground: -1 left of the path, +1 right, 0 centred. */
  side: -1 | 0 | 1;
}

export type FeatureKind =
  | "moon"
  | "cloud-bank"
  | "entry-gate"
  | "mausoleum"
  | "crypt-entry"
  | "stairs"
  | "far-wall";

export interface WorldFeature {
  kind: FeatureKind;
  y: number;
  stratum: number;
}

export interface Stratum {
  id: string;
  label: string;
  /** Contiguous; the strata partition [0, heightPx]. */
  top: number;
  bottom: number;
  /** Rule-of-thirds target in the stratum's screen frame (fractions). */
  focal: { fx: number; fy: number };
}

export interface BlendZone {
  y: number;
  height: number;
  kind: "gradient" | "haze" | "crossfade" | "stairs" | "arch";
}

export interface WorldLayout {
  place: WorldPlace;
  compact: boolean;
  lengthVh: number;
  heightPx: number;
  /** Viewport height after the 812 fallback (not the 700 floor). */
  viewportH: number;
  columns: number;
  /** Index-aligned with the input names. */
  slots: WorldSlot[];
  /** Slot indices sorted by (cy, cx): visual order for DOM and tab sequence. */
  domOrder: number[];
  strata: Stratum[];
  features: WorldFeature[];
  blendZones: BlendZone[];
  /** Ground only: centreline samples. */
  path?: { x: number; y: number }[];
  /** Crypt only: slot indices per chamber. */
  chambers?: number[][];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Smallest viewport height the layout math assumes (px). */
export const LAYOUT_MIN_VH = 700;

/** Height used when the reported viewport height is unusable (px). */
export const FALLBACK_VH = 812;

interface ModeConfig {
  /** Chrome clearance above the first creature row (px). */
  TOP_CLEAR: number;
  /** Chrome clearance below the last creature row (px). */
  BOTTOM_CLEAR: number;
  ROW_PITCH: number;
  COL_MIN: number;
  /** Largest World_Length for this mode, in Vh. */
  LENGTH_CAP: number;
}

export const WORLD_CONFIG = {
  desktop: {
    TOP_CLEAR: 280,
    BOTTOM_CLEAR: 120,
    ROW_PITCH: 240,
    COL_MIN: 200,
    LENGTH_CAP: 3,
  } satisfies ModeConfig,
  compact: {
    TOP_CLEAR: 284,
    BOTTOM_CLEAR: 80,
    ROW_PITCH: 200,
    COL_MIN: 140,
    LENGTH_CAP: 4,
  } satisfies ModeConfig,
  /** Slot centre is at least this far from each chrome edge. */
  SLOT_EDGE: CREATURE_BASE_SIZE,
  /** Plaques stay inside [SIDE_MARGIN, W - SIDE_MARGIN]. */
  SIDE_MARGIN: 16,
  /** Horizontal padding used by the column rules (each side). */
  COLUMN_PAD: 16,
  /** Maximum desktop columns. */
  MAX_DESKTOP_COLUMNS: 4,
  /** World_Length for small counts (2-3, crypt 2-4). */
  SMALL_LENGTH: 1.5,
  /** Crypt chamber size. */
  CHAMBER_SIZE: 4,
  /** Extra length per crypt chamber beyond the first. */
  CHAMBER_STEP: 0.7,
  /** Largest count that uses the small length (crypt uses CHAMBER_SIZE). */
  SMALL_MAX: { sky: 3, ground: 3, crypt: 4 } satisfies Record<WorldPlace, number>,
  /** Blend zone height as a fraction of Vh_eff. */
  BLEND_VH: 0.15,
  /**
   * Ground: narrowest clear walking corridor between the plaques of the two
   * sides of the path (px). Honoured whenever the width allows it; below that
   * the layout degrades to one lane per side pressed to the edges (it never
   * invents overlap, the plaque non-overlap property still holds).
   */
  GROUND_CORRIDOR_MIN: 160,
  /** Ground: horizontal gap between the inner and outer lane plaques (px). */
  GROUND_LANE_GAP: 12,
  /** Ground: design width (px) above which the corridor scales with the screen. */
  GROUND_DESIGN_W: 1920,
  /** Ground: largest corridor scale factor on very wide screens. */
  GROUND_SPREAD_MAX: 2,
  /** Ground: path sway left over before two lanes per side are given up (px). */
  GROUND_TWO_LANE_AMP_MIN: 24,
  /** Ground: a single lane sits this far beyond the corridor edge when room allows (px). */
  GROUND_SINGLE_LANE_EXTRA: 48,
  /** Ground: counts up to this use only the inner lane (sparse plots look full). */
  GROUND_INNER_ONLY_MAX: 4,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Pointer drift of the deepest parallax bands (px, see `.world-band-*`). */
const TAIL_POINTER_PX = 26;

/**
 * Extra px the LAST stratum's art bands extend below the stage. Parallax bands
 * are anchored to their stratum's top, so at the end of the scroll they lag
 * behind the stage bottom by `0.12 * (viewportH - stratumH)` plus the pointer
 * drift; the tail keeps art under the bottom edge so the world ends closed.
 * The stage clips the excess (`contain: paint`), so it never adds scroll room.
 */
export function bottomTailPx(strata: readonly Pick<Stratum, "top" | "bottom">[], viewportH: number): number {
  const last = strata[strata.length - 1];
  if (!last) return 0;
  const lag = Math.max(0, normalizeViewportH(viewportH) - (last.bottom - last.top)) * 0.12;
  return Math.ceil(lag + TAIL_POINTER_PX + 4);
}

/** Viewport height after the fallback: <= 0 or non-finite -> 812. */
export function normalizeViewportH(viewportH: number): number {
  return Number.isFinite(viewportH) && viewportH > 0 ? viewportH : FALLBACK_VH;
}

function normalizeViewportW(viewportW: number): number {
  return Math.max(0, finiteOr(viewportW, 0));
}

function normalizeCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function isCompact(viewportW: number): boolean {
  return normalizeViewportW(viewportW) < MOBILE_BREAKPOINT;
}

function ceil20(x: number): number {
  return Math.ceil(x * 20 - 1e-9) / 20;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

function rect(cx: number, cy: number, halfW: number, halfH: number): Rect {
  return {
    left: cx - halfW,
    top: cy - halfH,
    right: cx + halfW,
    bottom: cy + halfH,
    cx,
    cy,
  };
}

// ---------------------------------------------------------------------------
// Columns and length
// ---------------------------------------------------------------------------

/**
 * Column count. Desktop: min(ceil(count / 2), 4, floor(availW / 200)).
 * Compact: min(count, floor(availW / 140)). Always at least 1.
 */
export function worldColumns(count: number, viewportW: number): number {
  const n = normalizeCount(count);
  const w = normalizeViewportW(viewportW);
  const availW = w - 2 * WORLD_CONFIG.COLUMN_PAD;
  if (isCompact(w)) {
    const fit = Math.floor(availW / WORLD_CONFIG.compact.COL_MIN);
    return Math.max(1, Math.min(n, fit));
  }
  const fit = Math.floor(availW / WORLD_CONFIG.desktop.COL_MIN);
  return Math.max(
    1,
    Math.min(Math.ceil(n / 2), WORLD_CONFIG.MAX_DESKTOP_COLUMNS, fit),
  );
}

/**
 * World_Length in Vh. 0-1 names: exactly 1. Small counts: 1.5. Larger counts
 * grow with the number of rows (crypt: with chambers), capped at 3 (desktop)
 * or 4 (compact). Non-decreasing in `count`.
 */
export function worldLength(
  place: WorldPlace,
  count: number,
  viewportW: number,
  viewportH: number,
): number {
  const n = normalizeCount(count);
  if (n <= 1) return 1;
  if (n <= WORLD_CONFIG.SMALL_MAX[place]) return WORLD_CONFIG.SMALL_LENGTH;

  const cfg = isCompact(viewportW) ? WORLD_CONFIG.compact : WORLD_CONFIG.desktop;
  const vhEff = Math.max(normalizeViewportH(viewportH), LAYOUT_MIN_VH);
  const columns = worldColumns(n, viewportW);
  const rows = Math.ceil(n / columns);
  const B = CREATURE_BASE_SIZE;
  // Ground is ONE winding path with tombstones alternating sides, so each
  // side repeats every second tombstone: consecutive stones need half a row
  // pitch, and the row count is the tombstone count, not a grid row count.
  // (A grid estimate packed 12 stones into 1.5 Vh and stones covered the
  // name tags of the stones above them; found in the ground visual review.)
  const contentPx =
    place === "ground"
      ? cfg.TOP_CLEAR + B + (n - 1) * (cfg.ROW_PITCH / 2) + B + cfg.BOTTOM_CLEAR
      : cfg.TOP_CLEAR + B + (rows - 1) * cfg.ROW_PITCH + B + cfg.BOTTOM_CLEAR;
  const fromContent = ceil20(contentPx / vhEff);

  if (place === "crypt") {
    const chambers = Math.ceil(n / WORLD_CONFIG.CHAMBER_SIZE);
    const floor =
      WORLD_CONFIG.SMALL_LENGTH + WORLD_CONFIG.CHAMBER_STEP * (chambers - 1);
    return Math.min(cfg.LENGTH_CAP, Math.max(floor, fromContent));
  }
  return Math.min(cfg.LENGTH_CAP, Math.max(WORLD_CONFIG.SMALL_LENGTH, fromContent));
}

// ---------------------------------------------------------------------------
// Per-name look
// ---------------------------------------------------------------------------

export interface NameLook {
  band: 0 | 1 | 2;
  scale: number;
  brightness: number;
  mirrored: boolean;
  tilt: number;
}

/**
 * A name's look depends only on `(place, name)`, never on the other names.
 * Draw order is fixed: band, mirror, tilt, scale jitter.
 */
export function nameLook(place: WorldPlace, name: string): NameLook {
  const rng = mulberry32(xmur3(`world|${place}|${name}`)());
  const u1 = rng();
  const u2 = rng();
  const u3 = rng();
  const u4 = rng();

  const band = Math.min(2, Math.floor(u1 * 3)) as 0 | 1 | 2;
  const span = (SCATTER_SCALE_MAX - SCATTER_SCALE_MIN) / 3;
  const scale =
    SCATTER_SCALE_MIN + span * (band + 0.5) + (u4 * 2 - 1) * span * 0.4;
  const brightness = 1 - SCATTER_BRIGHTNESS_STEP * (2 - band);
  const mirrored = place === "sky" && u2 < 1 / 3;
  const tilt = place === "ground" ? (u3 * 2 - 1) * TOMBSTONE_TILT_DEG : 0;
  return { band, scale, brightness, mirrored, tilt };
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

function makeSlot(
  place: WorldPlace,
  name: string,
  index: number,
  cx: number,
  cy: number,
  viewportW: number,
  stratum: number,
  side: -1 | 0 | 1,
): WorldSlot {
  const look = nameLook(place, name);
  const size = CREATURE_BASE_SIZE * look.scale;
  const plaqueW = PLAQUE_W * look.scale;
  const plaqueH = PLAQUE_H * look.scale;
  // Keep body and plaque inside the side margins (centre x only).
  const half = Math.max(size, plaqueW) / 2 + WORLD_CONFIG.SIDE_MARGIN;
  const x =
    viewportW - 2 * half >= 0 ? clamp(cx, half, viewportW - half) : viewportW / 2;
  const feet = cy + size / 2;
  const plaqueCy = feet - plaqueLiftPx(size, plaqueH);
  return {
    index,
    cx: x,
    cy,
    size,
    scale: look.scale,
    band: look.band,
    brightness: look.brightness,
    mirrored: look.mirrored,
    tilt: look.tilt,
    body: rect(x, cy, size / 2, size / 2),
    plaque: rect(x, plaqueCy, plaqueW / 2, plaqueH / 2),
    stratum,
    side,
  };
}

function sortDomOrder(slots: readonly WorldSlot[]): number[] {
  return slots
    .map((_, i) => i)
    .sort((a, b) => slots[a].cy - slots[b].cy || slots[a].cx - slots[b].cx || a - b);
}

// ---------------------------------------------------------------------------
// Strata helpers (Part C will replace the generic version)
// ---------------------------------------------------------------------------

interface StratumSpec {
  id: string;
  label: string;
  focal: { fx: number; fy: number };
}

/** Single-screen stratum for each place (0 and 1 name worlds). */
const SINGLE_STRATUM: Record<WorldPlace, StratumSpec> = {
  sky: { id: "high-air", label: "Altitude: high", focal: { fx: 2 / 3, fy: 1 / 3 } },
  ground: { id: "gate-path", label: "The gate path", focal: { fx: 1 / 3, fy: 2 / 3 } },
  crypt: { id: "entry", label: "The entry", focal: { fx: 1 / 3, fy: 2 / 3 } },
};

const SINGLE_FEATURE: Record<WorldPlace, { kind: FeatureKind; fy: number }> = {
  sky: { kind: "moon", fy: 0.22 },
  ground: { kind: "entry-gate", fy: 0.25 },
  crypt: { kind: "crypt-entry", fy: 0.3 },
};

function singleScreenLayout(
  input: WorldInput,
  names: readonly string[],
  vh: number,
  vhEff: number,
  w: number,
): WorldLayout {
  const compact = isCompact(w);
  const cfg = compact ? WORLD_CONFIG.compact : WORLD_CONFIG.desktop;
  const columns = worldColumns(names.length, w);
  const heightPx = vhEff;

  const slots: WorldSlot[] = [];
  if (names.length === 1) {
    const B = WORLD_CONFIG.SLOT_EDGE;
    const cy = clamp(0.5 * vhEff, cfg.TOP_CLEAR + B, vhEff - cfg.BOTTOM_CLEAR - B);
    slots.push(makeSlot(input.place, names[0], 0, w / 2, cy, w, 0, 0));
  }

  const spec = SINGLE_STRATUM[input.place];
  const feature = SINGLE_FEATURE[input.place];
  return {
    place: input.place,
    compact,
    lengthVh: 1,
    heightPx,
    viewportH: vh,
    columns,
    slots,
    domOrder: sortDomOrder(slots),
    strata: [{ ...spec, top: 0, bottom: heightPx }],
    features: [{ kind: feature.kind, y: feature.fy * vhEff, stratum: 0 }],
    blendZones: [],
    ...(input.place === "ground"
      ? {
          path: [
            { x: w / 2, y: 0 },
            { x: w / 2, y: heightPx },
          ],
        }
      : {}),
    ...(input.place === "crypt" ? { chambers: names.length === 1 ? [[0]] : [] } : {}),
  };
}

/** Seeded jitter pair in [-1, 1], depending only on `(place, name)`. */
function nameJitter(place: WorldPlace, name: string): { jx: number; jy: number } {
  const rng = mulberry32(xmur3(`world|${place}|${name}|jitter`)());
  return { jx: rng() * 2 - 1, jy: rng() * 2 - 1 };
}

/** Vertical jitter amplitude when x separation is guaranteed (px). */
const JITTER_Y = 24;
/** Smaller amplitude when adjacent plaques may overlap in x (narrow cells). */
const JITTER_Y_TIGHT = 4;

interface Placement {
  cx: number;
  cy: number;
}

/**
 * Part B: slot centres for 2+ names, in input (urgency) order.
 *  - Small counts: centres lerp from `yA` (first screen) to `yB` (just below
 *    the first screen boundary), alternating between two columns.
 *  - Larger counts: `columns x rows` grid filled row by row, odd columns
 *    offset by half a pitch (zigzag), seeded jitter, rows kept inside the
 *    chrome clearances so urgency order fills the first screen first.
 */
function placeSlots(
  input: WorldInput,
  names: readonly string[],
  vhEff: number,
  heightPx: number,
  w: number,
  columns: number,
): Placement[] {
  const cfg = isCompact(w) ? WORLD_CONFIG.compact : WORLD_CONFIG.desktop;
  const B = WORLD_CONFIG.SLOT_EDGE;
  const count = names.length;
  const minY = cfg.TOP_CLEAR + B;
  const maxY = heightPx - cfg.BOTTOM_CLEAR - B;

  if (count <= WORLD_CONFIG.SMALL_MAX[input.place]) {
    const yA = Math.max(minY, 0.5 * vhEff);
    const yB = clamp(1.06 * vhEff, vhEff + 1, maxY);
    const last = Math.max(1, count - 1);
    return names.map((_, i) => ({
      cx: (w * (i % 2 === 0 ? 1 : 2)) / 3,
      cy: yA + ((yB - yA) * i) / last,
    }));
  }

  const pad = WORLD_CONFIG.COLUMN_PAD;
  const cell = Math.max(0, w - 2 * pad) / columns;
  const plaqueSpan = PLAQUE_W * SCATTER_SCALE_MAX;
  const jitterX = Math.max(0, (cell - plaqueSpan) / 2 - 4);
  const ampY = cell >= plaqueSpan + 8 ? JITTER_Y : JITTER_Y_TIGHT;

  // The grid spans the whole usable range [minY, maxY] (the zigzag offset of
  // the last row lands on maxY), so the first and the last stratum both hold
  // creatures (Req 7.1) and gaps stay small. When the world is longer than the
  // content needs, rows spread out instead of leaving a blank tail.
  const rows = Math.ceil(count / columns);
  const zigRows = columns > 1 ? 0.5 : 0;
  const span = Math.max(0, maxY - minY);
  const pitch = span / (rows - 1 + zigRows || 1);

  return names.map((name, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const { jx, jy } = nameJitter(input.place, name);
    const zig = col % 2 === 1 ? pitch / 2 : 0;
    const rawY = minY + row * pitch + zig + jy * ampY;
    return {
      cx: pad + cell * (col + 0.5) + jx * jitterX,
      cy: Math.max(minY, Math.min(maxY, rawY)),
    };
  });
}

// ---------------------------------------------------------------------------
// Part C: strata, features, blends, ground path, crypt chambers
// ---------------------------------------------------------------------------

/** Crypt stratum heights in Vh: entry, chamber 1, later chambers. */
const CRYPT_ENTRY_VH = 0.5;
const CRYPT_FIRST_CHAMBER_VH = 0.9;
const CRYPT_LATER_CHAMBER_VH = 0.7;
/** No stratum is taller than this many Vh_eff. */
const STRATUM_MAX_VH = 1;
/** Landmark features are inserted when a gap would exceed this many Vh_eff
 *  (Req 6.5 allows 0.6; the margin absorbs float noise). */
const GAP_LIMIT_VH = 0.55;
/** Distance between ground path samples (px). */
const PATH_SAMPLE_PX = 90;
/** Slots in a crypt chamber stay this far inside the chamber's strata edges. */
const CHAMBER_INSET = 40;

interface Placed {
  cx: number;
  cy: number;
  side: -1 | 0 | 1;
  /** Set when the placement already knows its stratum (crypt chambers). */
  stratum?: number;
}

/** `k + 1` edges splitting `[0, heightPx]` evenly; the last edge is exact. */
function evenEdges(heightPx: number, k: number): number[] {
  const edges: number[] = [];
  for (let s = 0; s < k; s++) edges.push((heightPx * s) / k);
  edges.push(heightPx);
  return edges;
}

/**
 * Crypt edges: entry 0.5 Vh, chamber 1 0.9 Vh, later chambers 0.7 Vh. The
 * World_Length is usually a little longer than that sum (1.5 against 1.4 for
 * one chamber), so the surplus is shared out evenly among the chambers, then
 * the entry, never pushing a stratum past 1.0 Vh_eff.
 */
function cryptEdges(
  chambers: number,
  lengthVh: number,
  vhEff: number,
  heightPx: number,
): number[] {
  const heights = [
    CRYPT_ENTRY_VH,
    CRYPT_FIRST_CHAMBER_VH,
    ...Array.from({ length: chambers - 1 }, () => CRYPT_LATER_CHAMBER_VH),
  ];
  let remaining = lengthVh - heights.reduce((a, b) => a + b, 0);
  for (const pool of [
    heights.map((_, i) => i).slice(1),
    [0],
  ]) {
    while (remaining > 1e-12) {
      const open = pool.filter((i) => heights[i] < STRATUM_MAX_VH - 1e-12);
      if (open.length === 0) break;
      const share = remaining / open.length;
      for (const i of open) {
        const add = Math.min(share, STRATUM_MAX_VH - heights[i]);
        heights[i] += add;
        remaining -= add;
      }
    }
  }
  const edges = [0];
  let acc = 0;
  for (let i = 0; i < heights.length - 1; i++) {
    acc += heights[i];
    edges.push(acc * vhEff);
  }
  edges.push(heightPx);
  return edges;
}

function skyStratumInfo(s: number, k: number): { id: string; label: string } {
  if (s === 0) return { id: "high-air", label: "Altitude: high" };
  if (s === k - 1) return { id: "cloud-bank", label: "Cloud bank" };
  const mids = k - 2;
  return mids === 1
    ? { id: "mid-sky", label: "Altitude: middle" }
    : { id: `mid-sky-${s}`, label: `Altitude: middle ${s} of ${mids}` };
}

function groundStratumInfo(s: number, k: number): { id: string; label: string } {
  if (s === 0) return { id: "gate-path", label: "The gate path" };
  if (s === k - 1) return { id: "mausoleum-approach", label: "The mausoleum approach" };
  const mids = k - 2;
  return mids === 1
    ? { id: "mid-path", label: "The cemetery path" }
    : { id: `mid-path-${s}`, label: `The cemetery path ${s} of ${mids}` };
}

function buildStrata(place: WorldPlace, edges: readonly number[]): Stratum[] {
  const k = edges.length - 1;
  const chambers = k - 1;
  return Array.from({ length: k }, (_, s) => {
    const info =
      place === "sky"
        ? skyStratumInfo(s, k)
        : place === "ground"
          ? groundStratumInfo(s, k)
          : s === 0
            ? { id: "entry", label: "The entry" }
            : { id: `chamber-${s}`, label: `Chamber ${s} of ${chambers}` };
    return {
      ...info,
      top: edges[s],
      bottom: edges[s + 1],
      focal: SINGLE_STRATUM[place].focal,
    };
  });
}

function stratumIndexAt(strata: readonly Stratum[], y: number): number {
  const i = strata.findIndex((st) => y >= st.top && y < st.bottom);
  if (i >= 0) return i;
  return y >= strata[strata.length - 1].bottom ? strata.length - 1 : 0;
}

function nearestThird(v: number): number {
  return Number.isFinite(v) && v < 0.5 ? 1 / 3 : 2 / 3;
}

/**
 * Rule-of-thirds focal per stratum (Req 18.1): the nearest thirds intersection
 * to the stratum's most urgent creature (lowest input index); a stratum with
 * no creature keeps the place default (moon, mausoleum or stairs).
 */
function assignFocals(strata: Stratum[], slots: readonly WorldSlot[], w: number): void {
  strata.forEach((st, s) => {
    const first = slots.find((slot) => slot.stratum === s);
    if (!first) return;
    const frameH = st.bottom - st.top;
    st.focal = {
      fx: nearestThird(w > 0 ? first.cx / w : 0.5),
      fy: nearestThird(frameH > 0 ? (first.cy - st.top) / frameH : 0.5),
    };
  });
}

/** Sky grid (part B), spanning the whole usable range. */
function placeSky(
  input: WorldInput,
  names: readonly string[],
  vhEff: number,
  heightPx: number,
  w: number,
  columns: number,
): Placed[] {
  return placeSlots(input, names, vhEff, heightPx, w, columns).map((p) => ({
    ...p,
    side: 0 as const,
  }));
}

/**
 * Ground: one column along a winding path. `cy` strictly increases, sides
 * alternate, and the offset `s` is the largest that keeps a plaque inside the
 * side margins. The wobble amplitude `A` shrinks on narrow screens so that
 * neighbouring plaques stay at least one plaque width apart in x even when
 * the centreline moves between them (below 400 px the pitch separates them
 * in y instead).
 */
function placeGround(
  input: WorldInput,
  names: readonly string[],
  vhEff: number,
  heightPx: number,
  w: number,
  columns: number,
): { placed: Placed[]; path: { x: number; y: number }[] } {
  const cfg = isCompact(w) ? WORLD_CONFIG.compact : WORLD_CONFIG.desktop;
  const B = WORLD_CONFIG.SLOT_EDGE;
  const count = names.length;
  const minY = cfg.TOP_CLEAR + B;
  const maxY = heightPx - cfg.BOTTOM_CLEAR - B;

  const ampMax = Math.min(0.12 * w, 120);
  const ampBase = clamp((w - 404) / 4, 0, ampMax);
  const plaqueHalf = (PLAQUE_W * SCATTER_SCALE_MAX) / 2;
  const edge = plaqueHalf + WORLD_CONFIG.SIDE_MARGIN;
  // Two lanes per side (inner, outer) when the width holds the corridor, both
  // lanes and a little sway; otherwise one lane per side (compact columns).
  // Beyond the 1920 px design width (browser zoom-out) the corridor widens with
  // the screen, clamped, so the group keeps flanking the (scaled) painted path.
  const spread = clamp(w / WORLD_CONFIG.GROUND_DESIGN_W, 1, WORLD_CONFIG.GROUND_SPREAD_MAX);
  const inner = (WORLD_CONFIG.GROUND_CORRIDOR_MIN / 2) * spread + plaqueHalf;
  const outer = inner + 2 * plaqueHalf + WORLD_CONFIG.GROUND_LANE_GAP;
  const swayRoom = w / 2 - edge - outer;
  const twoLanes = swayRoom >= WORLD_CONFIG.GROUND_TWO_LANE_AMP_MIN;
  const amp = twoLanes ? Math.min(ampBase, swayRoom) : ampBase;
  const farthest = Math.max(0, w / 2 - edge - amp);
  const laneOffsets = twoLanes
    ? [inner, outer]
    : [Math.min(farthest, inner + WORLD_CONFIG.GROUND_SINGLE_LANE_EXTRA)];
  const wavelength = 1.2 * vhEff;
  // Math.sin is not bit-identical between the Node server and the browser's
  // V8 (they can differ in the last digit), and these px values are written
  // into inline styles, so they are rounded to 2 decimals: the server HTML and
  // the first client render then serialise to the same string (hydration).
  const centreline = (y: number): number =>
    Math.round((w / 2 + amp * Math.sin((2 * Math.PI * y) / wavelength)) * 100) / 100;

  let ys: number[];
  if (count <= WORLD_CONFIG.SMALL_MAX.ground) {
    ys = placeSlots(input, names, vhEff, heightPx, w, columns).map((p) => p.cy);
  } else {
    ys = names.map((_, i) => minY + ((maxY - minY) * i) / (count - 1));
  }

  const placed = ys.map((cy, i) => {
    // Sides alternate; every second PAIR steps to the outer lane, so each side
    // holds two staggered rows. Sparse plots stay in the inner lane.
    const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
    const lane =
      laneOffsets.length > 1 && count > WORLD_CONFIG.GROUND_INNER_ONLY_MAX
        ? Math.floor(i / 2) % 2
        : 0;
    return { cx: centreline(cy) + side * laneOffsets[lane], cy, side };
  });

  const path: { x: number; y: number }[] = [];
  for (let y = 0; y < heightPx; y += PATH_SAMPLE_PX) {
    path.push({ x: centreline(y), y });
  }
  path.push({ x: centreline(heightPx), y: heightPx });
  return { placed, path };
}

/**
 * Crypt chambers of 4 in Plot order. Within a chamber, coffins sit 2 x 2 (one
 * column below 312 px): columns alternate with a half-step stagger so
 * neighbouring plaques never share a row, `cy` rises in Plot order, and every
 * slot stays inside its chamber stratum and clear of the chrome.
 */
function placeChambers(
  names: readonly string[],
  w: number,
  heightPx: number,
  edges: readonly number[],
): Placed[] {
  const cfg = isCompact(w) ? WORLD_CONFIG.compact : WORLD_CONFIG.desktop;
  const B = WORLD_CONFIG.SLOT_EDGE;
  const minY = cfg.TOP_CLEAR + B;
  const maxY = heightPx - cfg.BOTTOM_CLEAR - B;
  const cols = Math.min(2, worldColumns(WORLD_CONFIG.CHAMBER_SIZE, w));
  const pad = WORLD_CONFIG.COLUMN_PAD;
  const cell = Math.max(0, w - 2 * pad) / cols;
  const plaqueSpan = PLAQUE_W * SCATTER_SCALE_MAX;
  const jitterX = Math.max(0, (cell - plaqueSpan) / 2 - 4);

  return names.map((name, i) => {
    const chamber = Math.floor(i / WORLD_CONFIG.CHAMBER_SIZE);
    const m = i % WORLD_CONFIG.CHAMBER_SIZE;
    const top = edges[chamber + 1];
    const bottom = edges[chamber + 2];
    const lo = Math.max(top + CHAMBER_INSET, minY);
    const hi = Math.max(lo, Math.min(bottom - CHAMBER_INSET, maxY));
    const step = (hi - lo) / (WORLD_CONFIG.CHAMBER_SIZE - 1);
    const col = cols === 2 ? m % 2 : 0;
    const { jx } = nameJitter("crypt", name);
    return {
      cx: pad + cell * (col + 0.5) + jx * jitterX,
      cy: lo + m * step,
      side: 0 as const,
      stratum: chamber + 1,
    };
  });
}

function buildFeatures(
  place: WorldPlace,
  strata: readonly Stratum[],
  vhEff: number,
  heightPx: number,
  compact: boolean,
): WorldFeature[] {
  const cfg = compact ? WORLD_CONFIG.compact : WORLD_CONFIG.desktop;
  const at = (kind: FeatureKind, y: number): WorldFeature => ({
    kind,
    y,
    stratum: stratumIndexAt(strata, y),
  });
  if (place === "sky") {
    return [at("moon", 0.22 * vhEff), at("cloud-bank", heightPx - 0.25 * vhEff)];
  }
  if (place === "ground") {
    // The path ends at the far mausoleum (Req 8.1): its base sits half the
    // bottom chrome clearance above the world's end, which is always below the
    // last tombstone (slots stop at heightPx - BOTTOM_CLEAR - SLOT_EDGE).
    return [
      at("entry-gate", 0.25 * vhEff),
      at("mausoleum", heightPx - cfg.BOTTOM_CLEAR / 2),
    ];
  }
  const features = [at("crypt-entry", 0.3 * vhEff)];
  for (let s = 1; s < strata.length; s++) features.push(at("stairs", strata[s].top));
  features.push(at("far-wall", heightPx - 0.2 * vhEff));
  return features;
}

/**
 * Safety net for Req 6.5: if the slots and landmarks still leave a stretch
 * longer than GAP_LIMIT_VH, add evenly spaced landmarks of the place's
 * waypoint kind (cloud banks, the path, stairs). The normal placements already
 * meet the rule, so this only fires for unusual shapes (for example a one-row
 * grid on a tall viewport).
 */
function fillGaps(
  place: WorldPlace,
  features: WorldFeature[],
  slots: readonly WorldSlot[],
  strata: readonly Stratum[],
  vhEff: number,
  heightPx: number,
): void {
  const limit = GAP_LIMIT_VH * vhEff;
  const kind: FeatureKind =
    place === "sky" ? "cloud-bank" : place === "ground" ? "mausoleum" : "stairs";
  const ys = [0, heightPx, ...slots.map((s) => s.cy), ...features.map((f) => f.y)].sort(
    (a, b) => a - b,
  );
  for (let i = 0; i + 1 < ys.length; i++) {
    const gap = ys[i + 1] - ys[i];
    if (!(gap > limit)) continue;
    const parts = Math.ceil(gap / limit);
    for (let q = 1; q < parts; q++) {
      const y = ys[i] + (gap * q) / parts;
      features.push({ kind, y, stratum: stratumIndexAt(strata, y) });
    }
  }
  features.sort((a, b) => a.y - b.y);
}

function buildBlendZones(
  place: WorldPlace,
  strata: readonly Stratum[],
  vhEff: number,
): BlendZone[] {
  const height = WORLD_CONFIG.BLEND_VH * vhEff;
  const zones: BlendZone[] = [];
  for (let s = 1; s < strata.length; s++) {
    const last = s === strata.length - 1;
    const kind: BlendZone["kind"] =
      place === "crypt"
        ? s % 2 === 1
          ? "stairs"
          : "arch"
        : last
          ? "haze"
          : place === "sky"
            ? "gradient"
            : "crossfade";
    // `y` is the top of the zone; the zone is centred on the join.
    zones.push({ y: strata[s].top - height / 2, height, kind });
  }
  return zones;
}

/** Layout for 2+ names: real slots (part B) plus strata, features, blends. */
function multiSlotLayout(
  input: WorldInput,
  names: readonly string[],
  vh: number,
  vhEff: number,
  w: number,
): WorldLayout {
  const { place } = input;
  const compact = isCompact(w);
  const lengthVh = worldLength(place, names.length, w, vh);
  const heightPx = lengthVh * vhEff;
  const columns = worldColumns(names.length, w);

  const chamberCount = Math.ceil(names.length / WORLD_CONFIG.CHAMBER_SIZE);
  const edges =
    place === "crypt"
      ? cryptEdges(chamberCount, lengthVh, vhEff, heightPx)
      : evenEdges(heightPx, Math.max(2, Math.ceil(lengthVh)));
  const strata = buildStrata(place, edges);

  let placed: Placed[];
  let path: { x: number; y: number }[] | undefined;
  if (place === "ground") {
    const ground = placeGround(input, names, vhEff, heightPx, w, columns);
    placed = ground.placed;
    path = ground.path;
  } else if (place === "crypt" && names.length > WORLD_CONFIG.SMALL_MAX.crypt) {
    placed = placeChambers(names, w, heightPx, edges);
  } else {
    placed = placeSky(input, names, vhEff, heightPx, w, columns);
  }

  const slots = names.map((name, i) => {
    const p = placed[i];
    const stratum = p.stratum ?? stratumIndexAt(strata, p.cy);
    return makeSlot(place, name, i, p.cx, p.cy, w, stratum, p.side);
  });

  assignFocals(strata, slots, w);
  const features = buildFeatures(place, strata, vhEff, heightPx, compact);
  fillGaps(place, features, slots, strata, vhEff, heightPx);

  const chambers =
    place === "crypt"
      ? Array.from({ length: chamberCount }, (_, j) =>
          names
            .map((_, i) => i)
            .slice(
              j * WORLD_CONFIG.CHAMBER_SIZE,
              (j + 1) * WORLD_CONFIG.CHAMBER_SIZE,
            ),
        )
      : undefined;

  return {
    place,
    compact,
    lengthVh,
    heightPx,
    viewportH: vh,
    columns,
    slots,
    domOrder: sortDomOrder(slots),
    strata,
    features,
    blendZones: buildBlendZones(place, strata, vhEff),
    ...(path ? { path } : {}),
    ...(chambers ? { chambers } : {}),
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function computeWorldLayout(input: WorldInput): WorldLayout {
  const names = input.names;
  const vh = normalizeViewportH(input.viewportH);
  const vhEff = Math.max(vh, LAYOUT_MIN_VH);
  const w = normalizeViewportW(input.viewportW);

  if (names.length <= 1) return singleScreenLayout(input, names, vh, vhEff, w);
  return multiSlotLayout(input, names, vh, vhEff, w);
}
