/**
 * Pure estate view-model functions for the estate map & places feature.
 *
 * This module is a sibling of `lib/scene-view.ts` and `lib/graveyard-view.ts`
 * and the property-test target for this feature. Like those modules it imports
 * no `server-only`, no React, performs no I/O, and reads no clock: every piece
 * of new domain logic is a pure mapping on top of already-classified
 * `GraveyardRow`s. Lifecycle classification (`lib/lifecycle.ts`) is frozen and
 * untouched — this module recomputes no lifecycle threshold.
 *
 * The five lifecycle states collapse onto four places. `PLACES` is the single
 * source of truth for the place model and its display order (sky, gate,
 * ground, crypt). Numeric knobs that tune the map/place views live here as
 * named constants (no magic numbers elsewhere).
 */

import { type LifecycleState } from "./lifecycle";
import { type GraveyardRow } from "./graveyard-view";
import { selectInitialCreature } from "./scene-view";

// ---------------------------------------------------------------------------
// Place model (single source of truth for the four places)
// ---------------------------------------------------------------------------

/**
 * The four places the five lifecycle states collapse onto. `gate` is the only
 * place that aggregates two states (`zombie` + `risen`).
 */
export type PlaceId = "sky" | "gate" | "ground" | "crypt";

/** Static metadata describing one place on the estate map. */
export interface PlaceMeta {
  id: PlaceId;
  /** Cinzel display name, e.g. "The Restless Sky". */
  name: string;
  /** Which lifecycle states live in this place. */
  states: LifecycleState[];
  /** Plaque accent colour. */
  accent: "gold" | "crimson";
  /** Call to action rendered on the plaque, e.g. "Open the gate →". */
  cta: string;
}

/**
 * The single source of truth for the place model. Iterating the keys in
 * declaration order yields the map's display order: sky, gate, ground, crypt.
 */
export const PLACES: Record<PlaceId, PlaceMeta> = {
  sky: {
    id: "sky",
    name: "The Restless Sky",
    states: ["ghost"],
    accent: "gold",
    cta: "Rise to them →",
  },
  gate: {
    id: "gate",
    name: "Beyond the Gate",
    states: ["zombie", "risen"],
    accent: "crimson",
    cta: "Open the gate →",
  },
  ground: {
    id: "ground",
    name: "Hallowed Ground",
    states: ["tombstone"],
    accent: "gold",
    cta: "Walk the ground →",
  },
  crypt: {
    id: "crypt",
    name: "The Crypt",
    states: ["coffin"],
    accent: "gold",
    cta: "Descend to the crypt →",
  },
};

/** The four place ids in display order (sky, gate, ground, crypt). */
export const PLACE_ORDER: PlaceId[] = ["sky", "gate", "ground", "crypt"];

// ---------------------------------------------------------------------------
// Decay-word label maps (filter chips)
// ---------------------------------------------------------------------------

/**
 * Ghost decay-word labels, indexed by `decayLevel` 0..3 (from
 * `LIFECYCLE_CONFIG.ghostDecayBounds`). Only `sky` renders ghost decay chips.
 */
export const GHOST_DECAY_WORDS = [
  "healthy",
  "fading",
  "flickering",
  "about to turn",
] as const;

/**
 * Zombie decay-word labels, indexed by `decayLevel` 0..4 (from
 * `LIFECYCLE_CONFIG.zombieDecayBounds`). Only `gate` renders zombie decay
 * chips (plus a dedicated "Risen" chip).
 */
export const ZOMBIE_DECAY_WORDS = [
  "fresh",
  "rotting",
  "decayed",
  "skeletal",
  "ancient",
] as const;

/**
 * The gate filter space: the five zombie decay words, a dedicated `risen`
 * chip, or `all` (no filter). The gate is the only place that aggregates two
 * states, so it is the only place whose filter includes `risen`.
 */
export type GateFilter = (typeof ZOMBIE_DECAY_WORDS)[number] | "risen" | "all";

/**
 * The full place filter space, spanning BOTH decay bands. `sky` filters by the
 * ghost decay words and `gate` by the zombie decay words (plus the dedicated
 * `risen` chip); `ground`/`crypt` carry no decay chips. Components that type
 * their active-filter prop/state against any place use this broader union so a
 * ghost decay word (e.g. `"fading"`) is representable, not just `GateFilter`
 * (zombie words only). The runtime filter logic already indexes the correct
 * band per place; this type simply matches that behavior.
 */
export type PlaceFilter =
  | (typeof GHOST_DECAY_WORDS)[number]
  | (typeof ZOMBIE_DECAY_WORDS)[number]
  | "risen"
  | "all";

// ---------------------------------------------------------------------------
// Constants (single source of truth for every numeric knob)
// ---------------------------------------------------------------------------

/** Creatures per plot inside a place (replaces the zone cap / "+N more"). */
export const PLOT_SIZE = 12;

/** Maximum number of depth rows rendered per plot. */
export const DEPTH_ROWS = 3;

/** Total travel-transition duration in milliseconds (motion path). */
export const TRAVEL_MS = 1200;

/** Reduced-motion crossfade duration in milliseconds. */
export const TRAVEL_CROSSFADE_MS = 300;

// --- Scatter layout (DepthScatter) -----------------------------------------

/**
 * Minimum per-creature scale in a scatter plot — the back depth row sits at the
 * bottom of the 0.7..1.15 band so every back record is strictly smaller than
 * every middle record (Req 5.5). (`scatterLayout`, task 1.3.)
 */
export const SCATTER_SCALE_MIN = 0.7;

/**
 * Maximum per-creature scale in a scatter plot — the front depth row sits at
 * the top of the 0.7..1.15 band so every front record is strictly larger than
 * every middle record (Req 5.5).
 */
export const SCATTER_SCALE_MAX = 1.15;

/**
 * Half-range, in degrees, of a ground tombstone's seeded tilt: the rotation is
 * drawn deterministically from the per-name stream into `[-6, 6]` degrees
 * (Req 5.8). Only the `ground` place applies this tilt.
 */
export const TOMBSTONE_TILT_DEG = 6;

/**
 * Plaque bounding-box width in px at `scale` 1. Single source of truth for BOTH
 * the `Plaque` component's fixed max render width (CHANGE 4 — long names
 * ellipsize rather than growing wider) AND the no-overlap rectangle width used
 * by the scatter layout / Property 2 (Req 5.9, 7.4). Because a plaque can never
 * render wider than this, the no-overlap guarantee computed from `PLAQUE_W`
 * holds for any repo name regardless of length. Matches the existing place
 * plaque's compact slab (~80–150px on the boards).
 */
export const PLAQUE_W = 160;

/** Plaque bounding-box height in px at `scale` 1 (one Cinzel name line + one
 * mono sub-line). Used alongside `PLAQUE_W` for the no-overlap rectangle
 * (Req 5.9). Matches the real rendered plaque (≈ 40px); the boards' plaques are
 * compact ~80–150px slabs, so 160×40 is the single source of truth and long
 * names ellipsize with the full name in `title`/`aria-label` (visual fix r3 #1). */
export const PLAQUE_H = 40;

/**
 * Viewport width in px that switches a plot between the scatter layout (≥ this)
 * and the two-column staggered mobile layout (< this) (Req 5.9, 5.10).
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * Per-place vertical "stage" band, as fractions of the scene height, that
 * `scatterLayout` maps every creature's `y` into so creatures stand on their
 * place's ground instead of floating across the whole scene (visual fix 2C).
 * `top` is the back-row baseline (higher on screen), `bottom` the front-row
 * baseline (the ground line). Ghosts float, so the sky band starts higher and
 * ends above the very bottom; the gate/ground/crypt bands hug the lower scene
 * where the painted ground sits. `x` is unaffected (stays in 0.08–0.92).
 *
 * Every `top` is >= 0.36 (keeps feet out of the title area; the resolved
 * creature/plaque tops are additionally held under `resolvePlacement`'s
 * `topLimitPx`), and every `bottom` is <= 0.85 so feet stay above the pager
 * (pager top is ~0.856 of a 720px scene).
 */
export const STAGE_BANDS: Record<PlaceId, { top: number; bottom: number }> = {
  sky: { top: 0.38, bottom: 0.85 },
  gate: { top: 0.46, bottom: 0.85 },
  ground: { top: 0.42, bottom: 0.85 },
  // Crypt was widened to 0.45 in visual fix r3 #2: a narrow band is too tight
  // to stack three rows of coffins (+ their plaques) without crowding. The
  // bottom moved 0.88 → 0.85 to clear the pager.
  crypt: { top: 0.45, bottom: 0.85 },
};

/** The narrowest stage band height across all places, used to pin the y-jitter
 *  and inter-row spacing so the no-overlap guarantee (Req 5.9, Property 2)
 *  survives mapping into the tightest band (gate, 0.46–0.85 → 0.39 tall). */
export const STAGE_BAND_MIN_HEIGHT = Math.min(
  ...Object.values(STAGE_BANDS).map((b) => b.bottom - b.top),
);

/**
 * Each place's CENTRE on the estate map, as fractions of the map box. Single
 * source of truth shared by `EstateMap`'s `PLACE_POSITIONS` (where each place
 * link is anchored) and the travel transition (the zoom `transform-origin` when
 * pulling into / out of a place). Matches the board arrangement: sky top-centre,
 * ground left, crypt right, gate bottom-centre (visual fix r3 #4).
 */
export const PLACE_CENTERS: Record<PlaceId, { x: number; y: number }> = {
  sky: { x: 0.46, y: 0.2 },
  ground: { x: 0.2, y: 0.5 },
  crypt: { x: 0.78, y: 0.48 },
  gate: { x: 0.46, y: 0.78 },
};

// --- Painted-moon placement + per-layer parallax maxima (CHANGE 5) ---------

/**
 * Where the moon is baked into the `place-sky` painting, in source-image
 * fractions: `fx`/`fy` are the moon's centre (x 75%, y 14%) and `diamFrac` its
 * diameter as a fraction of image width (≈6.5%). Fed with the measured
 * background box to `coverRect` so the code-drawn `Moon` lands exactly over the
 * painted moon (Req 2.5, 4.7, 4.8).
 */
export const PAINTED_MOON = { fx: 0.75, fy: 0.14, diamFrac: 0.065 };

/**
 * Per-layer maximum parallax offset in px at `|--px| = 1`, depth-ordered
 * background < creatures < near fog (CHANGE 5). `PARALLAX_MAX_BG` (8 px) is
 * strictly less than the `PlaceBackground` `-3%` inset bleed so the parallaxed
 * painting never exposes an edge.
 */
export const PARALLAX_MAX_BG = 8;

/** Per-layer maximum parallax offset in px for the creatures / far-fog band
 * (`--d` 0.3) at `|--px| = 1` (CHANGE 5). */
export const PARALLAX_MAX_CREATURES = 16;

/** Per-layer maximum parallax offset in px for the near-fog band
 * (`Fog_Thin`, `--d` 0.5) at `|--px| = 1` (CHANGE 5). */
export const PARALLAX_MAX_NEAR_FOG = 26;

// ---------------------------------------------------------------------------
// Cover-math (coverRect) — pure value objects + helper
// ---------------------------------------------------------------------------

/**
 * Input to `coverRect`: an image's intrinsic size, the painted element's own
 * box (the `PlaceBackground` element box *including* its `-3%` bleed — not the
 * viewport), a point given in source-image fractions, and the diameter of an
 * element sized as a fraction of the image width. Pure value object — holds no
 * DOM references. (Req 4.7, 4.8.)
 */
export interface CoverInput {
  /** Intrinsic image width (px). */
  imageW: number;
  /** Intrinsic image height (px). */
  imageH: number;
  /** Painted element box width (px), including the `-3%` bleed. */
  viewW: number;
  /** Painted element box height (px), including the `-3%` bleed. */
  viewH: number;
  /** Point x as a fraction of image width, in `[0, 1]`. */
  fx: number;
  /** Point y as a fraction of image height, in `[0, 1]`. */
  fy: number;
  /** Element diameter as a fraction of image width. */
  diamFrac: number;
}

/**
 * Output of `coverRect`: an on-screen centre and diameter, in pixels, in the
 * `PlaceBackground` element's coordinate space (so a `Moon` rendered inside
 * that element shares the painting's transform). Pure value object. (Req 4.7,
 * 4.8.)
 */
export interface CoverRect {
  /** Centre x (px) in the element's coordinate space. */
  cx: number;
  /** Centre y (px) in the element's coordinate space. */
  cy: number;
  /** On-screen diameter (px). */
  diameter: number;
}

/**
 * Pure cover-math: maps a point given in source-image fractions to on-screen
 * pixels for a container painted `background-size: cover`, and returns a
 * diameter for an element sized as a fraction of the image width (Req 4.7,
 * 4.8).
 *
 * Standard `cover` fit: `scale = max(viewW / imageW, viewH / imageH)`, so the
 * drawn image is `imageW*scale × imageH*scale`, centered in the element. The
 * centering offsets are `offsetX = (viewW - imageW*scale) / 2` (and `offsetY`
 * similarly), and the point maps to
 * `cx = offsetX + fx * imageW * scale`, `cy = offsetY + fy * imageH * scale`,
 * with `diameter = diamFrac * imageW * scale`.
 *
 * Pure and total: any zero/negative image or element dimension (e.g. a 0×0
 * pre-layout container) makes the cover scale undefined, so we fall back to a
 * centered default — the element's own centre with a zero diameter — rather
 * than emitting `NaN`/`Infinity`. The fractional inputs (`fx`/`fy`/`diamFrac`)
 * are used as given; only the dimensions are guarded.
 */
export function coverRect(input: CoverInput): CoverRect {
  const { imageW, imageH, viewW, viewH, fx, fy, diamFrac } = input;

  // Guard: a non-positive image or element dimension makes the cover scale
  // undefined (division by zero or a negative scale), so return a centered
  // default. `viewW`/`viewH` fall back to 0 when non-finite so `cx`/`cy` are
  // always finite numbers and never `NaN`/`Infinity`.
  const safeViewW = Number.isFinite(viewW) ? viewW : 0;
  const safeViewH = Number.isFinite(viewH) ? viewH : 0;
  if (
    !Number.isFinite(imageW) ||
    !Number.isFinite(imageH) ||
    imageW <= 0 ||
    imageH <= 0 ||
    safeViewW <= 0 ||
    safeViewH <= 0
  ) {
    return { cx: safeViewW / 2, cy: safeViewH / 2, diameter: 0 };
  }

  // Standard `cover` fit: scale so the image fully covers the element, then
  // center the (overflowing) image and map the fractional point into it.
  const scale = Math.max(safeViewW / imageW, safeViewH / imageH);
  const drawnW = imageW * scale;
  const drawnH = imageH * scale;
  const offsetX = (safeViewW - drawnW) / 2;
  const offsetY = (safeViewH - drawnH) / 2;

  return {
    cx: offsetX + fx * drawnW,
    cy: offsetY + fy * drawnH,
    diameter: diamFrac * drawnW,
  };
}

// ---------------------------------------------------------------------------
// Pure view-model functions (stubs — implemented in later tasks)
// ---------------------------------------------------------------------------

/**
 * Maps a row's lifecycle state to exactly one place. Exhaustive and total over
 * all five states; never returns undefined and never throws. Reads only
 * `row.state`. (Implemented in task 2.1.)
 */
export function placeOf(row: Pick<GraveyardRow, "state">): PlaceId {
  switch (row.state) {
    case "ghost":
      return "sky";
    case "zombie":
      return "gate";
    case "risen":
      return "gate";
    case "tombstone":
      return "ground";
    case "coffin":
      return "crypt";
    default: {
      // Exhaustiveness guard: if `LifecycleState` ever gains a new member,
      // this assignment fails to compile, forcing the mapping to be updated.
      const _exhaustive: never = row.state;
      return _exhaustive;
    }
  }
}

/**
 * Stable, place-specific ordering of the rows in a place. Copies the input
 * (never mutates), is total on null/NaN keys, and is monotonic in the place's
 * ordering key. (Req 6.1–6.9 / Property 2)
 *
 * Each place tells a different story, so each has its own ordering rule:
 *  - `sky`           — most URGENT first: `decayLevel` desc, then `daysQuiet` desc.
 *  - `gate`          — every risen before every zombie, then the zombie block by
 *                      `decayLevel` asc (freshest/most savable first), using the
 *                      same decay-ascending idea as `orderZombies` in
 *                      `lib/scene-view.ts`, specialized here for the gate.
 *  - `ground`/`crypt`— newest at rest first: `daysQuiet` asc.
 *
 * All four orderings copy first (never mutate the caller's array), rely on the
 * stability of `Array.prototype.sort` so equal keys keep input order (pushed-at
 * descending from the loader), and are total: a null/NaN `decayLevel` or
 * `daysQuiet` is treated as `0` so no comparison ever produces NaN.
 */
export function orderForPlace(
  place: PlaceId,
  rows: GraveyardRow[],
): GraveyardRow[] {
  // Defensive key readers: a null or non-finite key collapses to 0 so the
  // comparisons below are total and never yield NaN. This mirrors the `decayOf`
  // helper in `orderZombies` (lib/scene-view.ts), extended to `daysQuiet`.
  const decay = (row: GraveyardRow): number =>
    row.decayLevel === null || !Number.isFinite(row.decayLevel)
      ? 0
      : row.decayLevel;
  const quiet = (row: GraveyardRow): number =>
    Number.isFinite(row.daysQuiet) ? row.daysQuiet : 0;

  // Copy first so the caller's array is never mutated; every sort below runs on
  // this copy. Array.prototype.sort is stable in modern engines, so rows that
  // compare equal keep their relative input order.
  const copy = rows.slice();

  switch (place) {
    case "sky":
      // Most urgent ghosts first: decay descending, then days-quiet descending.
      // On equal decay the longer-quiet ghost (closer to turning) sorts ahead.
      return copy.sort((a, b) => decay(b) - decay(a) || quiet(b) - quiet(a));

    case "gate": {
      // Primary key `rank` puts every risen (0) ahead of every zombie (1)
      // regardless of decay. The secondary key orders only the zombie block by
      // decay ascending (freshest first) — the same idea as `orderZombies`;
      // risen rows all share secondary key 0, so stability keeps them in input
      // order.
      const rank = (row: GraveyardRow): number => (row.state === "risen" ? 0 : 1);
      const zombieKey = (row: GraveyardRow): number =>
        row.state === "risen" ? 0 : decay(row);
      return copy.sort(
        (a, b) => rank(a) - rank(b) || zombieKey(a) - zombieKey(b),
      );
    }

    case "ground":
    case "crypt":
      // Newest at rest first: days-quiet ascending.
      return copy.sort((a, b) => quiet(a) - quiet(b));

    default: {
      // Exhaustiveness guard: a new `PlaceId` member fails to compile here,
      // forcing the ordering rule to be defined for it.
      const _exhaustive: never = place;
      return _exhaustive;
    }
  }
}

/**
 * Splits rows into fixed-size plots that partition the input in order. Empty
 * input yields exactly one empty plot (`[[]]`); `size` is normalized to
 * `max(1, trunc(size))`. (Implemented in task 4.1.)
 */
export function paginate<T>(rows: T[], size: number): T[][] {
  // Normalize the plot size: a non-finite, zero, or negative size collapses to
  // 1 so pagination is always well-defined. `Math.trunc` drops any fractional
  // part toward zero before the `max(1, …)` floor.
  const n = Math.max(1, Number.isFinite(size) ? Math.trunc(size) : 1);

  // Empty input returns exactly one empty plot so the pager always has a
  // "Plot 1 of 1" to render.
  if (rows.length === 0) {
    return [[]];
  }

  // Slice into fixed-size plots in order. Every plot except possibly the last
  // has exactly `n` items; the last has 1..n. Concatenating the plots in order
  // reproduces the input exactly.
  const plots: T[][] = [];
  for (let i = 0; i < rows.length; i += n) {
    plots.push(rows.slice(i, i + n));
  }
  return plots;
}

/**
 * Shared pluralization helper: the noun suffix for a count. Yields `""` for a
 * count of exactly 1 and `"s"` for every other (non-negative integer) count,
 * so `"ghost" + plural(c)` reads "ghost" at 1 and "ghosts" at 0 or many. The
 * `SummaryLine` chrome reuses this so counts there agree with the plaques.
 */
export function plural(count: number): string {
  return count === 1 ? "" : "s";
}

/**
 * Shared subject-verb-agreement helper: returns `singular` when the count is
 * exactly 1 and `plural` otherwise. Used for verbs whose form is irregular
 * (e.g. "wanders"/"wander", "has"/"have") rather than a simple "+s" suffix.
 */
export function verb(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** Clamp to a non-negative integer, mapping NaN/±∞ to 0. (Defensive normalize.) */
function toCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/**
 * Count line for a place's plaque / summary, singular/plural correct for 0, 1,
 * and many. `risenCount` is honored only for the `gate` (reported as a
 * separate clause) and ignored elsewhere. Always returns a non-empty string
 * and never throws.
 *
 * `count`/`risenCount` are normalized to non-negative integers first (clamp to
 * ≥ 0, truncate toward zero, treat NaN/±∞ as 0), so any finite, negative, or
 * fractional input still yields a well-formed, non-empty string. (Req 4.1–4.9 /
 * Property 4)
 */
export function plaqueCopy(
  place: PlaceId,
  count: number,
  risenCount?: number,
): string {
  const c = toCount(count);
  const r = toCount(risenCount ?? 0);

  switch (place) {
    case "sky":
      return c === 0
        ? "No ghosts linger"
        : `${c} ghost${plural(c)} still ${verb(c, "wanders", "wander")}`;

    case "gate": {
      // Base clause describes the zombies ("the undead") at the gate.
      const base =
        c === 0
          ? "The gate stands empty"
          : `${c} undead ${verb(c, "shambles", "shamble")} here, waiting for a verdict`;
      // The risen are reported as a separate clause, only when any are present.
      if (r === 0) {
        return base;
      }
      const risenClause = `${r} ${verb(r, "has", "have")} risen`;
      // Only risen present: the standalone risen clause is the whole line.
      // Both present: append the risen clause after the zombie base clause.
      return c === 0 ? risenClause : `${base} · ${risenClause}`;
    }

    case "ground":
      return c === 0
        ? "No finished works at rest"
        : `${c} finished work${plural(c)} at rest`;

    case "crypt":
      return c === 0 ? "No one sealed away yet" : `${c} sealed away`;

    default: {
      // Exhaustiveness guard: a new `PlaceId` member fails to compile here,
      // forcing the copy to be defined for it.
      const _exhaustive: never = place;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Organic seeded creature placement: `scatterLayout` (pure, DOM-free)
// ---------------------------------------------------------------------------

/**
 * One per-name placement record produced by {@link scatterLayout}. Every field
 * is derived deterministically from `(names, rows, seed)` so equal inputs yield
 * field-by-field equal records in the same order (Req 5.1, 5.2).
 */
export interface ScatterPlacement {
  /** Horizontal centre, a fraction of plot width in `[0, 1]`. */
  x: number;
  /** Vertical centre, a fraction of plot height in `[0, 1]`. */
  y: number;
  /**
   * Per-creature scale in `[SCATTER_SCALE_MIN, SCATTER_SCALE_MAX]` (0.7..1.15).
   * Strictly ordered across rows: every front-row record is greater than every
   * middle-row record, which is greater than every back-row record (Req 5.5).
   */
  scale: number;
  /**
   * Per-creature brightness multiplier. Strictly ordered across rows the same
   * way as `scale`: front > middle > back for *every* pair (Req 5.6).
   */
  brightness: number;
  /** Whether the creature image is horizontally mirrored (Req 5.7). */
  mirrored: boolean;
  /** Depth band: `0` = back … `rows - 1` = front (Req 5.4). */
  row: number;
  /**
   * Seeded tilt in `[-TOMBSTONE_TILT_DEG, TOMBSTONE_TILT_DEG]` degrees, applied
   * only by the ground place to its tombstones (Req 5.8). Present on every
   * record so the value is deterministic and ignorable by the other places.
   */
  tilt: number;
}

/**
 * `xmur3` string hash — a tiny, well-known pure 32-bit string hasher used to
 * fold `seed + "|" + name` into a seed for `mulberry32`. No RNG library and no
 * `Math.random`: the returned closure yields the successive 32-bit avalanche
 * values of the classic `xmur3` construction. Only the first value is consumed
 * here (as the PRNG seed), but the closure form matches the canonical snippet.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * `mulberry32` PRNG — a tiny, well-known pure generator seeded by a 32-bit
 * integer. Returns a closure producing successive floats in `[0, 1)`. Pure and
 * deterministic: a given seed always yields the same stream.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Slot-grid geometry (the no-overlap guarantee, Req 5.9) -----------------
//
// The placement is a `DEPTH_ROWS × MAX_SCATTER_COLS` grid of slots. Two plaque
// rectangles can only overlap if their x-intervals AND their y-intervals both
// overlap, so the grid eliminates overlap on each axis independently:
//
//  * Horizontal — each column owns a cell of width `1 / MAX_SCATTER_COLS` of the
//    plot. A plaque is centred at the cell centre plus a bounded x-jitter chosen
//    so that `maxPlaqueHalfWidth + maxJitter <= halfCell` at the *narrowest*
//    supported plot width. Because a plaque's px width (`PLAQUE_W * scale`) is
//    absolute while the cell's px width (`cellFrac * plotWidth`) shrinks with the
//    plot, the narrowest width (1280) is the binding case; satisfying it there
//    satisfies 1440 too. Same-row plaques therefore never share x-overlap.
//
//  * Vertical — each row owns a y-band centre, bands evenly spaced across
//    `[SCATTER_BAND_MIN, SCATTER_BAND_MAX]`. A plaque is centred at its band plus
//    a bounded y-jitter chosen so that two plaques in adjacent bands (the only
//    pairs that could collide vertically — same-row pairs are already x-disjoint)
//    stay height-separated even at a deliberately short plot height. Different-row
//    plaques therefore never share y-overlap unless they are also in different
//    columns (already x-disjoint).
//
// Every pair of distinct records is thus x-disjoint (same row), y-disjoint
// (same column, different row), or both-different (x-disjoint by column) — so no
// two plaque rectangles ever intersect, for 1..PLOT_SIZE names at 1440 and 1280
// px (Req 5.9, Property 2). `PLAQUE_W`/`PLAQUE_H` are the single source of truth
// for the rectangle size (see the constants above).

/**
 * Columns in the scatter grid: enough to hold the fullest row of a full plot
 * (`ceil(PLOT_SIZE / DEPTH_ROWS)` = 4). Fixed for every row so the column pitch
 * is uniform and maximal regardless of how many names actually land in a row.
 */
export const MAX_SCATTER_COLS = Math.ceil(PLOT_SIZE / DEPTH_ROWS);

/** Narrowest plot width (px) the no-overlap guarantee is pinned against. */
const SCATTER_MIN_PLOT_WIDTH = 1280;

/**
 * Deliberately short plot-height-to-width ratio used as the *worst case* for
 * vertical separation. The real place plots are taller (≈0.56–0.625 of width),
 * so proving no-overlap at this shorter height proves it for the real plots and
 * lets the property test derive height from width alone.
 */
const SCATTER_MIN_PLOT_ASPECT = 0.5;

/** Upper bound on x-jitter as a fraction of plot width, kept within the cell. */
const SCATTER_X_JITTER_FRAC = (() => {
  // Cell pitch matches the `(cols + 0.5)` grid used in `scatterLayout` (the
  // extra half-cell reserves the odd-row stagger headroom). Jitter is bounded to
  // half the slack between the cell width and the widest plaque, minus a small
  // margin, so two SAME-ROW plaques (one cell pitch apart) can never overlap
  // even at both their jitter extremes and max scale (visual fix r3 #2).
  const cellPx = SCATTER_MIN_PLOT_WIDTH / (MAX_SCATTER_COLS + 0.5);
  const maxPlaquePx = PLAQUE_W * SCATTER_SCALE_MAX;
  const roomPx = Math.max(0, (cellPx - maxPlaquePx) / 2 - 4);
  return roomPx / SCATTER_MIN_PLOT_WIDTH;
})();

/**
 * The default ("legacy") stage band used when `scatterLayout` is called without
 * a `place`: the full-height band the layout used before per-place stage bands
 * existed. Named callers (`PlaceView`/`DepthScatter`) always pass a place, so
 * this only backs place-agnostic callers and tests.
 */
const LEGACY_STAGE_BAND = { top: 0.18, bottom: 0.82 };

/**
 * Upper bound on y-jitter as a fraction of the STAGE BAND height (not the whole
 * plot). It is capped small enough that two creatures in adjacent depth rows
 * never overlap vertically even in the narrowest stage band (gate, 0.39 tall)
 * at the worst-case short plot height ? preserving the no-overlap guarantee
 * (Req 5.9) after the per-place remap. See the derivation below.
 *
 * Worst case: narrowest band height `STAGE_BAND_MIN_HEIGHT` (0.31), `DEPTH_ROWS`
 * (3) rows, plot height = `plotWidth * SCATTER_MIN_PLOT_ASPECT` at the narrowest
 * width 1280 → 640px. Adjacent row centres are `bandH / (rows - 1)` apart in
 * fraction; the max plaque is `PLAQUE_H * SCATTER_SCALE_MAX` tall. The jitter
 * half-range (in fraction of plot height) must leave a full plaque height of
 * clearance between adjacent row centres, so this cap sits safely under that.
 */
const SCATTER_Y_JITTER_BAND_FRAC = 0.06;

/**
 * Centre (fraction of plot height) of depth `band` within a `stage` band: band
 * 0 (back) sits at the band top, the front band at the band bottom; a single
 * band sits at the band mid-line. Shared by `scatterLayout` and `plaqueRect` so
 * the pixel model the no-overlap property checks is the production model.
 */
function stageRowCentre(
  stage: { top: number; bottom: number },
  band: number,
  bandCount: number,
): number {
  if (bandCount <= 1) {
    return (stage.top + stage.bottom) / 2;
  }
  return stage.top + (stage.bottom - stage.top) * (band / (bandCount - 1));
}

/** Brightness assigned to the front row; each row behind steps down by a band. */
const SCATTER_FRONT_BRIGHTNESS = 1;
const SCATTER_BRIGHTNESS_STEP = 0.18;

/**
 * Draws a float in `[min, max)` from a per-name stream, mapping a `[0, 1)` draw
 * linearly onto the half-open interval. A `min === max` interval returns `min`.
 */
function drawRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Organic, seeded, deterministic placement for a plot of creatures — the single
 * layout function for all four places (Req 5.1). Pure: reads no clock, no DOM,
 * and no external state, so equal `(names, rows, seed)` always produce
 * field-by-field equal records in the same input order (Req 5.2).
 *
 * Each name is folded with `seed` into a 32-bit hash via `xmur3(seed + "|" +
 * name)` that seeds a `mulberry32` stream; all per-name randomness (jitter,
 * tilt) is drawn from that stream so it is reproducible. The records are
 * returned one-per-name in input order with no additions, omissions, or
 * duplicates (Req 5.1); empty `names` yields `[]` (Req 5.3).
 *
 * Names are distributed across `rows` depth bands front-first (the nearest band
 * fills first, matching the boards' "nearest holds the freshest"). Each band
 * owns a disjoint `scale` sub-range within `[SCATTER_SCALE_MIN,
 * SCATTER_SCALE_MAX]` and a disjoint `brightness` sub-range, so *every*
 * front-row record is strictly greater than *every* middle-row record, which is
 * strictly greater than *every* back-row record, for both fields (Req 5.5,
 * 5.6). Exactly `round(n / 3)` records are marked `mirrored`, chosen
 * deterministically by ranking the per-name hashes (Req 5.7). `x`/`y` come from
 * the per-row jittered slot grid that guarantees no two plaque rectangles
 * overlap at 1440 or 1280 px (Req 5.9; see the slot-grid notes above).
 *
 * `rows` is normalised to `max(1, trunc(rows))`; the caller passes `DEPTH_ROWS`.
 */
export function scatterLayout(
  names: string[],
  rows: number,
  seed: number | string,
  place?: PlaceId,
): ScatterPlacement[] {
  const n = names.length;
  if (n === 0) {
    return [];
  }

  // Normalise the band count and the seed to a stable string prefix.
  const bandCount = Math.max(1, Number.isFinite(rows) ? Math.trunc(rows) : 1);
  const seedPrefix = String(seed);

  // Per-name PRNG stream: xmur3 folds the combined string into a 32-bit seed for
  // mulberry32. One stream per name keeps each record independent of the others.
  const streams = names.map((name) =>
    mulberry32(xmur3(`${seedPrefix}|${name}`)()),
  );

  // --- Mirroring (Req 5.7): exactly round(n / 3) records marked, chosen by a
  // deterministic ranking of per-name hashes so the count is exact and stable.
  // We rank by a dedicated hash (independent of the placement stream) and mark
  // the lowest-ranked `mirrorCount` indices.
  const mirrorCount = Math.round(n / 3);
  const mirrorKeys = names.map((name, index) => ({
    index,
    key: xmur3(`mirror|${seedPrefix}|${name}`)(),
  }));
  // Sort by hash, break ties by original index so the ranking is total/stable.
  mirrorKeys.sort((a, b) => a.key - b.key || a.index - b.index);
  const mirrored = new Array<boolean>(n).fill(false);
  for (let i = 0; i < mirrorCount && i < n; i++) {
    mirrored[mirrorKeys[i].index] = true;
  }

  // --- Row assignment (Req 5.4): distribute names across the bands front-first.
  // Band index `0` is the back; `bandCount - 1` is the front. We assign the
  // leading (most-relevant) names to the front band, filling backwards. Each
  // band gets `ceil(remaining / remainingBands)` names so the front is never
  // smaller than a band behind it.
  const bandOfIndex = new Array<number>(n);
  {
    let assigned = 0;
    for (let b = bandCount - 1; b >= 0; b--) {
      const remainingBands = b + 1; // bands still to fill, including this one
      const take = Math.ceil((n - assigned) / remainingBands);
      for (let k = 0; k < take && assigned < n; k++) {
        bandOfIndex[assigned] = b;
        assigned++;
      }
    }
  }

  // Per-band disjoint sub-ranges for scale and brightness. The full scale band
  // [SCATTER_SCALE_MIN, SCATTER_SCALE_MAX] is split into `bandCount` equal
  // sub-intervals; jitter stays strictly inside a sub-interval so the strict
  // cross-band ordering can never be violated (Req 5.5, 5.6). Brightness uses a
  // fixed per-band step with a matching intra-band jitter cap.
  const scaleSpan = (SCATTER_SCALE_MAX - SCATTER_SCALE_MIN) / bandCount;
  // Keep jitter to 80% of a sub-interval, centred, so adjacent bands never meet.
  const scaleJitterHalf = (scaleSpan * 0.8) / 2;
  const brightJitterHalf = (SCATTER_BRIGHTNESS_STEP * 0.8) / 2;

  // Per-row column counters so slots fill left-to-right as names land in a band.
  const colCursor = new Array<number>(bandCount).fill(0);

  // Plot-level lanes for rows that are NOT full: `L = min(n, MAX_SCATTER_COLS)`
  // evenly spaced lanes with centres `(j + 0.5) / L`. A row holding `k` names
  // takes `k` distinct lanes spaced as evenly as possible across the `L`, then
  // rotated by the row's front-rank so single-creature rows land in different
  // lanes (3 names -> lanes 0, 1, 2). Lanes are sorted so names fill left to
  // right. Full rows (k === MAX_SCATTER_COLS) keep the staggered grid below.
  const laneCount = Math.min(n, MAX_SCATTER_COLS);
  const rowSize = new Array<number>(bandCount).fill(0);
  for (let i = 0; i < n; i++) rowSize[bandOfIndex[i]]++;
  const rowLanes: number[][] = rowSize.map((k, band) => {
    if (k === 0 || k >= MAX_SCATTER_COLS) return [];
    const rotation = bandCount - 1 - band;
    const lanes: number[] = [];
    for (let s = 0; s < k; s++) {
      const base = Math.floor(((s + 0.5) * laneCount) / k);
      lanes.push((base + rotation) % laneCount);
    }
    return lanes.sort((a, b) => a - b);
  });

  // Y-row centres map into the place's stage band so creatures stand on their
  // place's ground instead of floating across the whole scene (visual fix 2C).
  // Back (band 0) sits at the band top, the front band at the band bottom
  // (`stageYForBand`, shared with `plaqueRect` so the pixel model matches).
  const stage = place ? STAGE_BANDS[place] : LEGACY_STAGE_BAND;

  const placements: ScatterPlacement[] = [];
  for (let i = 0; i < n; i++) {
    const rng = streams[i];
    const band = bandOfIndex[i];

    // Scale: band centre is the sub-interval midpoint; jitter stays inside it.
    const scaleCentre = SCATTER_SCALE_MIN + scaleSpan * (band + 0.5);
    const scale = scaleCentre + drawRange(rng, -scaleJitterHalf, scaleJitterHalf);

    // Brightness: front band at SCATTER_FRONT_BRIGHTNESS, stepping down per band
    // behind it; jitter stays inside the per-band step so ordering holds.
    const brightCentre =
      SCATTER_FRONT_BRIGHTNESS - (bandCount - 1 - band) * SCATTER_BRIGHTNESS_STEP;
    const brightness =
      brightCentre + drawRange(rng, -brightJitterHalf, brightJitterHalf);

    // Column slot within the band: centre of the next free cell, plus x-jitter.
    // Adjacent depth rows are STAGGERED by half a column pitch (odd rows shift
    // right by half a cell) so a nearer row's creatures sit in the GAPS between
    // the farther row's, letting each plaque drop into a gap rather than over
    // the next row's creature (visual fix r3 #2.1). The stagger is folded into
    // the cell centre and kept inside [0,1]; the per-creature x-clamp (fix r3
    // #3, applied at render via `clampPlacementX`) pulls any edge case that
    // leaves the 16px scene margins back in.
    const col = colCursor[band] % MAX_SCATTER_COLS;
    const lane = rowLanes[band][colCursor[band]];
    colCursor[band]++;
    // Cell grid with a half-cell STAGGER on odd rows, mapped into [0,1] WITHOUT
    // a post-hoc clamp: dividing by (cols + 0.5) reserves exactly half a cell of
    // headroom so the odd-row phase (+0.5) never pushes the last column past the
    // right edge. Same-row cells therefore stay a full cell pitch apart (so same
    // -row plaques never collide) while adjacent rows read as organically offset
    // rather than a rigid grid (visual fix r3 #2.1).
    const rowPhase = (band % 2) * 0.5;
    const cellCentre =
      lane !== undefined
        ? (lane + 0.5) / laneCount
        : (col + 0.5 + rowPhase) / (MAX_SCATTER_COLS + 0.5);
    const x =
      cellCentre + drawRange(rng, -SCATTER_X_JITTER_FRAC, SCATTER_X_JITTER_FRAC);

    // Y within the stage band, jittered inside the band's safe vertical room.
    // The jitter is a fraction of the BAND height (capped so adjacent rows
    // never overlap even in the narrowest band at the worst-case plot height),
    // so the no-overlap guarantee survives the per-place remap (Req 5.9).
    const bandHeight = stage.bottom - stage.top;
    const yJitter =
      drawRange(rng, -SCATTER_Y_JITTER_BAND_FRAC, SCATTER_Y_JITTER_BAND_FRAC) *
      bandHeight;
    const y = stageRowCentre(stage, band, bandCount) + yJitter;

    // Tilt for ground tombstones, drawn from the same stream (Req 5.8).
    const tilt = drawRange(rng, -TOMBSTONE_TILT_DEG, TOMBSTONE_TILT_DEG);

    placements.push({ x, y, scale, brightness, mirrored: mirrored[i], row: band, tilt });
  }

  return placements;
}

/** An axis-aligned plaque rectangle in plot pixels (centre + half extents). */
export interface PlaqueRect {
  /** Centre x in px. */
  cx: number;
  /** Centre y in px. */
  cy: number;
  /** Left edge in px. */
  left: number;
  /** Right edge in px. */
  right: number;
  /** Top edge in px. */
  top: number;
  /** Bottom edge in px. */
  bottom: number;
}

/**
 * Projects a {@link ScatterPlacement} to its on-screen plaque rectangle, the
 * shared pixel model the no-overlap property (Req 5.9, Property 2) is verified
 * against. The rectangle is `PLAQUE_W × PLAQUE_H` scaled by the record's
 * `scale`, centred at `(x * plotWidthPx, y * plotHeightPx)`.
 *
 * `plotHeightPx` defaults to `plotWidthPx * SCATTER_MIN_PLOT_ASPECT` — a
 * deliberately short plot, the worst case for vertical separation — so a caller
 * (and the property test) can supply width alone and still exercise the binding
 * case. The real place plots are taller, so no-overlap at this height implies
 * no-overlap for them.
 */
export function plaqueRect(
  placement: ScatterPlacement,
  plotWidthPx: number,
  plotHeightPx: number = plotWidthPx * SCATTER_MIN_PLOT_ASPECT,
): PlaqueRect {
  const w = PLAQUE_W * placement.scale;
  const h = PLAQUE_H * placement.scale;
  const cx = placement.x * plotWidthPx;
  const cy = placement.y * plotHeightPx;
  return {
    cx,
    cy,
    left: cx - w / 2,
    right: cx + w / 2,
    top: cy - h / 2,
    bottom: cy + h / 2,
  };
}

// ---------------------------------------------------------------------------
// Feet-anchored creature + plaque geometry (visual fixes r3 #2, #3) \u2014 pure
//
// `DepthScatter` anchors each creature by its FEET at (x*W, y*H) via
// `translate(-50%, -100%)` (body ABOVE the feet line) and drops the plaque just
// BELOW the feet (`top = y*H + CREATURE_PLAQUE_GAP`, centred in x). These pure
// helpers reproduce that exact pixel model so the component and the no-overlap
// property share one source of truth \u2014 no DOM re-derivation that could drift.
// ---------------------------------------------------------------------------

/** Intrinsic creature art box (px), square, before `scale`. Mirrors
 *  `CREATURE_ART_SIZE` in `components/creatures/Creature.tsx`. */
export const CREATURE_BASE_SIZE = 140;

/** Required clear margin (px) between any creature/plaque and the scene edge
 *  (fix r3 #3). */
export const SCENE_EDGE_MARGIN_PX = 16;

/** Vertical gap (px) from the feet line down to the plaque top (matches the
 *  `+ 6px` the plaque wrapper uses, rounded into the budget as 8px). */
export const CREATURE_PLAQUE_GAP_PX = 8;

/**
 * Shared plaque lift rule: how many px the plaque's vertical centre sits above
 * its creature's feet line. The bottom-quarter midpoint (`creatureH * 0.125`)
 * for small creatures, clamped to a thin feet-hugging strip
 * (`plaqueH / 2 + CREATURE_PLAQUE_GAP_PX`) for tall ones. Used by
 * `resolvePlacement` and the compact layout so the two paths cannot drift.
 */
export function plaqueLiftPx(creatureH: number, plaqueH: number): number {
  return Math.min(creatureH * 0.125, plaqueH / 2 + CREATURE_PLAQUE_GAP_PX);
}

// --- Compact (< MOBILE_BREAKPOINT) layout constants -------------------------

/** Widest viewport (px) that uses the compact layout; derived from the
 *  breakpoint so the two cannot drift. */
export const COMPACT_MAX_WIDTH_PX = MOBILE_BREAKPOINT - 1;

/** Slot rows per compact page (plaque rows need ~50px each). */
export const COMPACT_SLOT_ROWS = 4;

/** Minimum column width (px) before another compact column is added. */
export const COMPACT_COLUMN_MIN_PX = 160;

/** Maximum number of compact columns. */
export const COMPACT_MAX_COLUMNS = 4;

/** Gap (px) between compact slots. */
export const COMPACT_SLOT_GAP_PX = 4;

/** Smallest creature height (px) the compact layout will render. */
export const COMPACT_CREATURE_MIN_PX = 64;

/** Max px a plaque rect extends below its creature's feet: half the tallest
 *  plaque (`PLAQUE_H * SCATTER_SCALE_MAX / 2`), reached when the lift is 0. */
export const PLAQUE_BELOW_FEET_MAX_PX = (PLAQUE_H * SCATTER_SCALE_MAX) / 2;

/**
 * Fallback chrome heights (px) used before anything is measured (first paint,
 * jsdom). Each is at least the real rendered height so no creature sits under
 * chrome on first paint.
 */
export const COMPACT_CHROME_FALLBACK_PX = {
  header: 64,
  returnLink: 44,
  titleBlock: 120,
  chips: 56,
  bottomBar: 80,
};

/** A vertical stage band in scene px. */
export interface StageBandPx {
  top: number;
  bottom: number;
}

/**
 * Compact stage band from measured chrome. Non-finite inputs coerce to 0 and
 * the scene height to `max(0, finite)`; `top` is clamped into `[0, H]` and
 * `bottom` into `[top, H]`, so the band is never negative and stays inside the
 * scene. `bottom` is the bar top minus the max plaque overhang below the feet.
 */
export function stageBand(
  sceneHeightPx: number,
  topChromeBottomPx: number,
  bottomBarTopPx: number,
): StageBandPx {
  const fin = (n: number): number => (Number.isFinite(n) ? n : 0);
  const h = Math.max(0, fin(sceneHeightPx));
  const top = Math.min(h, Math.max(0, fin(topChromeBottomPx)));
  const rawBottom = fin(bottomBarTopPx) - PLAQUE_BELOW_FEET_MAX_PX;
  const bottom = Math.min(h, Math.max(top, rawBottom));
  return { top, bottom };
}

// --- Compact columns, plot size, chrome boxes and stack layout (Decision D) --

/** Coerces a non-finite number to 0. */
function finiteOrZero(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * Number of compact columns for a scene width: as many `COMPACT_COLUMN_MIN_PX`
 * wide columns as fit between the edge margins, clamped to `2..4`. Total: a
 * non-finite or tiny width yields 2.
 */
export function compactColumns(sceneWidthPx: number): number {
  const usable = finiteOrZero(sceneWidthPx) - 2 * SCENE_EDGE_MARGIN_PX;
  const fit = Math.floor(
    (usable + COMPACT_SLOT_GAP_PX) / (COMPACT_COLUMN_MIN_PX + COMPACT_SLOT_GAP_PX),
  );
  return Math.min(COMPACT_MAX_COLUMNS, Math.max(2, fit));
}

/** Creatures per compact page: `min(columns * COMPACT_SLOT_ROWS, PLOT_SIZE)`. */
export function compactPlotSize(sceneWidthPx: number): number {
  return Math.min(compactColumns(sceneWidthPx) * COMPACT_SLOT_ROWS, PLOT_SIZE);
}

/** Heights (px) of the compact chrome pieces. */
export type CompactChromeHeights = typeof COMPACT_CHROME_FALLBACK_PX;

/** The compact chrome boxes in top-to-bottom order. */
export interface CompactChromeBoxes {
  header: SceneRect;
  returnLink: SceneRect;
  titleBlock: SceneRect;
  chips: SceneRect;
  bottomBar: SceneRect;
}

/**
 * Pure model of the compact chrome: header, return link, title block and chips
 * stacked full width from y = 0 in that order, and the bottom bar anchored to
 * the viewport bottom. Non-finite or negative inputs coerce to 0. Boxes are
 * returned in order even when the stack is taller than the viewport.
 */
export function layoutCompactChrome(
  viewportW: number,
  viewportH: number,
  heights: CompactChromeHeights,
): CompactChromeBoxes {
  const w = Math.max(0, finiteOrZero(viewportW));
  const vh = Math.max(0, finiteOrZero(viewportH));
  const hOf = (n: number): number => Math.max(0, finiteOrZero(n));
  const box = (top: number, height: number): SceneRect => ({
    cx: w / 2,
    cy: top + height / 2,
    left: 0,
    right: w,
    top,
    bottom: top + height,
  });
  const header = box(0, hOf(heights.header));
  const returnLink = box(header.bottom, hOf(heights.returnLink));
  const titleBlock = box(returnLink.bottom, hOf(heights.titleBlock));
  const chips = box(titleBlock.bottom, hOf(heights.chips));
  const barH = hOf(heights.bottomBar);
  const bottomBar = box(Math.max(0, vh - barH), barH);
  return { header, returnLink, titleBlock, chips, bottomBar };
}

/**
 * Compact (< `MOBILE_BREAKPOINT`) layout: a column grid of creatures stacked in
 * slot rows inside the stage `band`. Returns one {@link ResolvedPlacement} per
 * input, in order, and never throws (non-finite inputs are coerced).
 *
 * Only each placement's `scale` is used. Columns are equal cells between the
 * edge margins; a plaque is as wide as `PLAQUE_W * scale` capped to its cell,
 * so same-row plaques never overlap. Creature heights are capped so the rows
 * fit the band, and row feet lines are spaced so creature tops and plaque rects
 * stay inside `[band.top, band.bottom]` and plaques of adjacent rows stay
 * `COMPACT_SLOT_GAP_PX` apart, whenever the band is tall enough to allow it.
 *
 * `y` is a fraction of `sceneHeightPx`, which defaults to `band.bottom`.
 */
export function compactStackLayout(
  placements: readonly ScatterPlacement[],
  sceneWidthPx: number,
  band: StageBandPx,
  sceneHeightPx?: number,
): ResolvedPlacement[] {
  const n = placements.length;
  if (n === 0) {
    return [];
  }
  const W = Math.max(0, finiteOrZero(sceneWidthPx));
  const top = Math.max(0, finiteOrZero(band.top));
  const bottom = Math.max(top, finiteOrZero(band.bottom));
  const H = Math.max(
    1,
    sceneHeightPx === undefined ? bottom : finiteOrZero(sceneHeightPx),
  );

  const cols = compactColumns(W);
  const rows = Math.ceil(n / cols);
  const gap = COMPACT_SLOT_GAP_PX;
  const cellW = Math.max(
    0,
    (W - 2 * SCENE_EDGE_MARGIN_PX - (cols - 1) * gap) / cols,
  );

  const scales = placements.map((p) => {
    const s = finiteOrZero(p.scale) || 1;
    return Math.min(SCATTER_SCALE_MAX, Math.max(SCATTER_SCALE_MIN, s));
  });

  // Worst-case plaque extents relative to the feet line.
  const maxPlaqueH = PLAQUE_H * SCATTER_SCALE_MAX;
  const worstLift = plaqueLiftPx(CREATURE_BASE_SIZE * SCATTER_SCALE_MAX, maxPlaqueH);
  const bestLift = plaqueLiftPx(
    COMPACT_CREATURE_MIN_PX,
    PLAQUE_H * SCATTER_SCALE_MIN,
  );
  const overhang = Math.max(0, maxPlaqueH / 2 - bestLift);
  const minPitch = maxPlaqueH + gap + Math.max(0, worstLift - bestLift);

  // Creature height cap so all rows fit the band.
  const usable = bottom - overhang - top;
  const maxH = Math.max(
    COMPACT_CREATURE_MIN_PX,
    usable - (rows - 1) * minPitch,
  );
  const heights = scales.map((s) => Math.min(CREATURE_BASE_SIZE * s, maxH));

  // Per-row extents: how far plaques reach above (up) and below (down) the feet,
  // and the tallest creature.
  const up = new Array<number>(rows).fill(0);
  const down = new Array<number>(rows).fill(0);
  const tall = new Array<number>(rows).fill(0);
  for (let i = 0; i < n; i++) {
    const j = Math.floor(i / cols);
    const ph = PLAQUE_H * scales[i];
    const lift = plaqueLiftPx(heights[i], ph);
    up[j] = Math.max(up[j], lift + ph / 2);
    down[j] = Math.max(down[j], ph / 2 - lift);
    tall[j] = Math.max(tall[j], heights[i]);
  }

  // Minimal feet lines, top to bottom, then spread any slack evenly.
  const feet = new Array<number>(rows).fill(0);
  feet[0] = top + Math.max(tall[0], up[0]);
  for (let j = 1; j < rows; j++) {
    feet[j] = Math.max(
      feet[j - 1] + Math.max(0, down[j - 1]) + gap + up[j],
      top + Math.max(tall[j], up[j]),
    );
  }
  if (rows > 1) {
    const lastLimit = bottom - Math.max(0, down[rows - 1]);
    const slack = lastLimit - feet[rows - 1];
    if (slack > 0) {
      for (let j = 1; j < rows; j++) {
        feet[j] += (slack * j) / (rows - 1);
      }
    }
  } else {
    // A single row is centred on the band's vertical midpoint: the row extent
    // is [feet - extUp, feet + extDown], so its midpoint sits at the band
    // midpoint when feet = mid + (extUp - extDown) / 2. Then clamp so the
    // extent stays inside the band (the top bound wins in a too-short band).
    const extUp = Math.max(tall[0], up[0]);
    const extDown = Math.max(0, down[0]);
    const centred = (top + bottom) / 2 + (extUp - extDown) / 2;
    const lo = top + extUp;
    const hi = bottom - extDown;
    feet[0] = Math.max(lo, Math.min(hi, centred));
  }

  return placements.map((_, i) => {
    const j = Math.floor(i / cols);
    const col = i % cols;
    const scale = scales[i];
    const h = heights[i];
    const plaqueW = Math.min(PLAQUE_W * scale, cellW);
    const plaqueH = PLAQUE_H * scale;
    const cellCx = SCENE_EDGE_MARGIN_PX + cellW / 2 + col * (cellW + gap);
    const plaqueCx = W > 0 && cellW > 0 ? cellCx : W / 2;
    const feetX = clampFeetX(cellCx, h / 2, W);
    const feetY = feet[j];
    return {
      x: W > 0 ? feetX / W : 0.5,
      y: feetY / H,
      creatureHeightPx: h,
      creature: rectFrom(feetX, feetY - h / 2, h / 2, h / 2),
      plaque: rectFrom(
        plaqueCx,
        feetY - plaqueLiftPx(h, plaqueH),
        plaqueW / 2,
        plaqueH / 2,
      ),
    };
  });
}

/** Creature-height floor as a fraction of scene height when a creature must be
 *  shrunk to clear a plaque (\u2248 96px @ 900, \u2248 77px @ 720) \u2014 fix r3 #2.3. */
export const CREATURE_HEIGHT_FLOOR_FRAC = 0.107;

/** Row pitch in px: the vertical slice one depth row owns within a place's
 *  stage band (`stageBandHeight * sceneH / rows`). (fix r3 #2) */
export function rowPitchPx(
  place: PlaceId,
  sceneHeightPx: number,
  rows: number = DEPTH_ROWS,
): number {
  const band = STAGE_BANDS[place];
  const bandCount = Math.max(1, Number.isFinite(rows) ? Math.trunc(rows) : 1);
  return ((band.bottom - band.top) * sceneHeightPx) / bandCount;
}

/** An axis-aligned rectangle in scene px (centre + edges), shared by the
 *  creature and plaque rect helpers. */
export interface SceneRect {
  cx: number;
  cy: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** True iff two axis-aligned rects share interior area (edge-touch = clear). */
export function rectsIntersect(a: ChromeRect, b: ChromeRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * The resolved on-screen geometry for one creature: its feet point, the creature
 * image rectangle (body above the feet), the plaque rectangle (below the feet),
 * the final clamped/ nudged `x`, and the rendered creature height. Produced by
 * {@link resolvePlacement}; consumed by `DepthScatter` (to size/position the
 * creature + plaque) and the no-overlap / margin properties.
 */
export interface ResolvedPlacement {
  /** Final x fraction after the edge clamp + any plaque nudge feedback. */
  x: number;
  /** y fraction (the feet line); equals the input `y` unless the top limit
   *  lowered it. */
  y: number;
  /** Rendered creature height in px (\u2264 base*scale; floored when shrunk). */
  creatureHeightPx: number;
  /** The creature image rect (square: width === height), body above the feet. */
  creature: SceneRect;
  /** The plaque rect (PLAQUE_W\u00d7scale wide, PLAQUE_H\u00d7scale tall), below the feet. */
  plaque: SceneRect;
}

/** Builds an axis-aligned rect from a centre and half extents. */
function rectFrom(cx: number, cy: number, halfW: number, halfH: number): SceneRect {
  return {
    cx,
    cy,
    left: cx - halfW,
    right: cx + halfW,
    top: cy - halfH,
    bottom: cy + halfH,
  };
}

/**
 * Clamps a feet x (px) so a box of half-width `halfW` stays within the scene's
 * [margin, sceneW - margin] safe area. Pure/total: a box wider than the safe
 * area is centred (best effort) rather than producing a negative range.
 */
function clampFeetX(
  feetXPx: number,
  halfW: number,
  sceneWidthPx: number,
): number {
  const lo = SCENE_EDGE_MARGIN_PX + halfW;
  const hi = sceneWidthPx - SCENE_EDGE_MARGIN_PX - halfW;
  if (hi < lo) {
    return sceneWidthPx / 2;
  }
  return Math.min(hi, Math.max(lo, feetXPx));
}

/**
 * Resolves one placement's final creature + plaque geometry at a concrete scene
 * size, applying the resolution order (visual fixes r3 #2, #3). The column
 * stagger (fix #2.1) is already baked into `placement.x` by `scatterLayout`, so
 * this step only adds the size/clamp/nudge feedback that depends on scene px:
 *
 *   - creature height (fix #2.2/2.3): capped at `rowPitch - PLAQUE_H - gap` so a
 *     body never reaches into the next row's plaque band, defaulting to
 *     `CREATURE_BASE_SIZE*scale`, and floored at `CREATURE_HEIGHT_FLOOR_FRAC *
 *     sceneH` so a tight band still renders a readable creature;
 *   - x-clamp (fix #3): the feet x is clamped so BOTH the (possibly shrunk)
 *     creature box and the plaque box stay inside the 16px scene margins;
 *   - plaque nudge (fix #2.4): if the plaque still overlaps a NEARER-row
 *     creature (passed in via `nearerCreatures`), it is slid sideways within
 *     +/-PLAQUE_W/2 to drop into a gap.
 *
 * `nearerCreatures` are the already-resolved creature rects of rows IN FRONT of
 * this one (larger `row` index) \u2014 the only ones whose bodies can hang into this
 * plaque \u2014 so callers resolve front rows first. Pass `[]` for the frontmost row.
 *
 *   - top limit: when `topLimitPx > 0` (default 0 = off), the creature and
 *     plaque rect tops are kept >= `topLimitPx` by lowering the feet line, and
 *     shrinking toward the height floor if the band's ground line is reached.
 *
 * Pure and deterministic in its inputs; reads no DOM.
 */
export function resolvePlacement(
  placement: ScatterPlacement,
  place: PlaceId,
  sceneWidthPx: number,
  sceneHeightPx: number,
  obstacles: readonly SceneRect[] = [],
  topLimitPx: number = 0,
): ResolvedPlacement {
  const scale = placement.scale;
  const plaqueW = PLAQUE_W * scale;
  const plaqueH = PLAQUE_H * scale;
  const baseCreatureH = CREATURE_BASE_SIZE * scale;
  // Mutable: the top-limit step below may lower the feet line.
  let feetYPx = placement.y * sceneHeightPx;

  // Creatures render at full size by default (visual fix r3 #2: no shrinking
  // unless a plaque genuinely cannot be placed clear). The floor is the
  // fallback size when that happens (~96px @ 900 / ~77px @ 720).
  const floorH = Math.min(baseCreatureH, CREATURE_HEIGHT_FLOOR_FRAC * sceneHeightPx);

  // The plaque sits over the BOTTOM QUARTER of its OWN creature's body (Option
  // A, visual fix r3 #2): body spans [feetY - cH, feetY]; the plaque's vertical
  // centre lands at feetY - cH*0.125 (the middle of the bottom 25%), covering
  // the feet/legs of a creature, the base of a tombstone (below the RIP text),
  // or the lower lid of a coffin \u2014 never the head/chest. Its y therefore depends
  // on the creature height, so both are resolved together below.
  const plaqueRectFor = (centreX: number, creatureH: number): SceneRect =>
    rectFrom(
      centreX,
      // Bottom-quarter midpoint for small/medium creatures, but clamped to a
      // thin feet-hugging strip (<= plaqueH/2 + gap above the feet) for tall
      // creatures so the plaque never rides up into the row above (fix r3 #2).
      feetYPx - plaqueLiftPx(creatureH, plaqueH),
      plaqueW / 2,
      plaqueH / 2,
    );

  // 1. Edge clamp (fix #3): clamp the feet x so BOTH the creature box and the
  //    plaque box stay inside the 16px margins; the wider half-width bounds it.
  const halfWiden = Math.max(baseCreatureH, plaqueW) / 2;
  const feetXPx = clampFeetX(placement.x * sceneWidthPx, halfWiden, sceneWidthPx);

  const safeLo = SCENE_EDGE_MARGIN_PX + plaqueW / 2;
  const safeHi = sceneWidthPx - SCENE_EDGE_MARGIN_PX - plaqueW / 2;
  const clampCx = (cx: number): number =>
    safeHi < safeLo ? sceneWidthPx / 2 : Math.min(safeHi, Math.max(safeLo, cx));

  // A plaque for THIS creature may legitimately overlap its OWN creature body
  // (that is where it sits), so the obstacle set a candidate plaque must clear
  // is every ALREADY-PLACED plaque/creature in `obstacles` (other rows), never
  // its own creature. `hits` tests exactly that.
  const hits = (pq: SceneRect): boolean =>
    obstacles.some((o) => rectsIntersect(pq, o));

  // 4. Plaque placement (fix #2.4): prefer the plaque centred on the creature x,
  //    then NUDGE within +/-PLAQUE_W/2, then \u2014 only if that cannot clear \u2014 widen
  //    the search across the whole safe x-range so the plaque never lands on
  //    ANOTHER plaque or creature. Deterministic symmetric scan.
  const findClearCx = (creatureH: number): number => {
    const centred = clampCx(feetXPx);
    if (!hits(plaqueRectFor(centred, creatureH))) {
      return centred;
    }
    const nudge = plaqueW / 2;
    const span = Math.max(nudge, safeHi - safeLo);
    const steps = 64;
    for (let k = 1; k <= steps; k++) {
      const delta = (span * k) / steps;
      const right = clampCx(feetXPx + delta);
      if (!hits(plaqueRectFor(right, creatureH))) {
        return right;
      }
      const left = clampCx(feetXPx - delta);
      if (!hits(plaqueRectFor(left, creatureH))) {
        return left;
      }
    }
    return centred; // best effort
  };

  // Full size first; if no clear plaque x exists at full size, shrink this
  // creature to the floor (which lifts the plaque higher \u2014 feetY - floorH*0.125
  // \u2014 away from the row ahead and shrinks the obstacle it leaves for nearer
  // rows) and re-search (fix #2.3).
  // Height cap (fix r3 #2.2/#2.3): keep a creature's body within about one row
  // pitch so its UPPER 60% (head + torso, the part the property protects)
  // cannot reach up into the plaque band of the row behind it. Prefer the
  // base size when the band is loose; floor it so a tight band still renders a
  // readable creature (~96px @ 900 / ~77px @ 720).
  const pitch = rowPitchPx(place, sceneHeightPx);
  const capH = pitch - plaqueH - CREATURE_PLAQUE_GAP_PX;
  let creatureH = Math.max(floorH, Math.min(baseCreatureH, capH));

  // 2. Top limit: no creature or plaque rect may rise above `topLimitPx`. The
  //    creature top is `feet - creatureH`; the plaque top is
  //    `feet - plaqueLift(creatureH) - plaqueH/2`. So the lowest acceptable feet
  //    line for a given height is `limit + max(creatureH, plaqueLift + plaqueH/2)`.
  //    First lower the feet toward that line (down to the band's ground line);
  //    if that line lies below the band bottom, shrink the creature toward the
  //    height floor before moving it any further. The limit is always honoured.
  const limitPx = Number.isFinite(topLimitPx) ? Math.max(0, topLimitPx) : 0;
  const plaqueLift = (h: number): number => plaqueLiftPx(h, plaqueH);
  // The tiny epsilon keeps floating-point rounding in the rect math (centre
  // +/- half extent) from landing a hair above the limit.
  const lowestFeet = (h: number): number =>
    limitPx + 1e-6 + Math.max(h, plaqueLift(h) + plaqueH / 2);
  if (limitPx > 0 && feetYPx < lowestFeet(creatureH)) {
    const groundLinePx = STAGE_BANDS[place].bottom * sceneHeightPx;
    if (lowestFeet(creatureH) > groundLinePx) {
      creatureH = Math.min(creatureH, Math.max(floorH, groundLinePx - limitPx));
    }
    feetYPx = lowestFeet(creatureH);
  }

  let plaqueCx = findClearCx(creatureH);
  if (hits(plaqueRectFor(plaqueCx, creatureH)) && floorH < creatureH) {
    creatureH = floorH;
    plaqueCx = findClearCx(creatureH);
  }

  const creatureW = creatureH; // square art box
  const creature = rectFrom(
    feetXPx,
    feetYPx - creatureH / 2,
    creatureW / 2,
    creatureH / 2,
  );

  return {
    x: feetXPx / sceneWidthPx,
    y: feetYPx / sceneHeightPx,
    creatureHeightPx: creatureH,
    creature,
    plaque: plaqueRectFor(plaqueCx, creatureH),
  };
}

/**
 * Clamps a placement's `x` so its plaque and creature stay within the 16px
 * scene margins at a concrete scene size (fix r3 #3), returning a new placement
 * (never mutating the input). A thin wrapper over {@link resolvePlacement}'s
 * clamp for callers that only need the corrected `x`.
 */
export function clampPlacementX(
  placement: ScatterPlacement,
  place: PlaceId,
  sceneWidthPx: number,
  sceneHeightPx: number,
): ScatterPlacement {
  const resolved = resolvePlacement(placement, place, sceneWidthPx, sceneHeightPx);
  return { ...placement, x: resolved.x };
}

// ---------------------------------------------------------------------------
// Routing: ?at= validation + deep-link resolution (pure)
// ---------------------------------------------------------------------------

/**
 * Validates the raw `?at=` query value into a `PlaceId` or `null`.
 *
 * Returns the matching place id only when `at` is exactly one of the four
 * place identifiers (`sky`, `gate`, `ground`, `crypt`); every other value —
 * `undefined`, the empty string, whitespace, or an unknown word — resolves to
 * `null` so the caller falls back to the map. Pure and total: never throws.
 * (Req 10.2, 10.3)
 */
export function parsePlaceId(at?: string): PlaceId | null {
  if (typeof at !== "string") {
    return null;
  }
  // Exact match only — no trimming or case-folding. The `at` values are
  // produced by this app's own client-side `pushState`, so an inexact value is
  // an unknown place and silently resolves to the map (Req 10.3).
  return (PLACE_ORDER as string[]).includes(at) ? (at as PlaceId) : null;
}

/**
 * The initial view resolved for the first client render, plus the creature (if
 * any) that should start selected. `view` is the estate map or one of the four
 * places; `selected` is the deep-linked creature's original-cased name, or
 * `null` when nothing is pre-selected.
 */
export interface InitialView {
  view: "map" | PlaceId;
  selected: string | null;
}

/**
 * Resolves the initial view for `SceneView` from the server-provided `?at=`
 * query value and the deep-linked `[repo]` segment, applying the design's
 * precedence (Req 11.1–11.4):
 *
 *   1. a valid `?at=` place always wins (Req 11.2);
 *   2. else the place containing the deep-linked `[repo]`, when that segment
 *      matches a row (case-insensitive via the reused `selectInitialCreature`),
 *      with that creature pre-selected (Req 11.1, 11.3);
 *   3. else the estate map with nothing selected (Req 11.4).
 *
 * The deep-linked creature's name is resolved with `selectInitialCreature`
 * (the same case-insensitive match used by the scene feature) and its place
 * with `placeOf`, so no matching or mapping logic is duplicated here. Pure and
 * total: reads no clock, performs no I/O, and never throws.
 */
export function resolveInitialView(
  rows: GraveyardRow[],
  at?: string,
  initialRepo?: string,
): InitialView {
  // 1. An explicit, valid `?at=` wins over everything else. The creature
  //    selection still honors the deep-linked `[repo]` when it matches a row,
  //    so a shared `?at=` link that also names a repo keeps that repo selected.
  const atPlace = parsePlaceId(at);
  const selected = selectInitialCreature(rows, initialRepo);
  if (atPlace !== null) {
    return { view: atPlace, selected };
  }

  // 2. No valid `?at=`: fall back to the place containing the deep-linked repo.
  //    `selectInitialCreature` returns the row's original-cased name on a match
  //    (or null); we locate that row to map it to its place with `placeOf`.
  if (selected !== null) {
    const matched = rows.find((row) => row.name === selected);
    if (matched !== undefined) {
      return { view: placeOf(matched), selected };
    }
  }

  // 3. Neither a valid `?at=` nor a matching deep link: the estate map, with
  //    nothing pre-selected (Req 11.4).
  return { view: "map", selected: null };
}

// ---------------------------------------------------------------------------
// Whisper lane (polish pass 2e)
// ---------------------------------------------------------------------------

/** An axis-aligned rectangle in viewport px. */
export interface ChromeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Place link width (px): the plaque's `max-w-[260px]`. */
export const PLACE_CARD_W_PX = 260;

/**
 * Place link height (px) on the board: 140px representatives + 12px gap + a
 * plaque of up to ~116px (padding, name, a count line that may wrap, CTA).
 */
export const PLACE_CARD_H_PX = 140 + 12 + 116;

/** Header band height (px): `--site-header-h` (7rem) in `app/globals.css`. */
export const HEADER_H_PX = 112;

/** Footer legend: tallest wrapped height (px) incl. footer padding. */
export const LEGEND_H_PX = 80;

/** Footer legend: widest extent (px), right-aligned with a 16px edge margin. */
export const LEGEND_MAX_W_PX = 640;

/** Clear gap (px) kept between the whisper lane and the nearest place card. */
export const WHISPER_GAP_PX = 8;

/** Whisper lane height (px): two clamped lines of text. */
export const WHISPER_H_PX = 56;

/**
 * Whisper lane top, as a percentage of the map height. It sits in the central
 * column between the sky card (bottom edge 0.20h + half card) and the gate
 * card (top edge 0.78h - half card), which stays clear for every height from
 * 600px up.
 */
export const WHISPER_TOP_PCT = 44;

/** Whisper lane horizontal centre, as a percentage of the map width: midway
 *  between the ground (0.20) and crypt (0.78) card centres. */
export const WHISPER_CENTER_PCT = 49;

/** Whisper lane width as a CSS `calc()` (percent of map width minus the two
 *  card half-widths plus 2 x 16px margin): fits between ground and crypt. */
export const WHISPER_WIDTH_CSS = `calc(58% - ${PLACE_CARD_W_PX + 32}px)`;

/**
 * Rectangles for the four place cards (display order sky, gate, ground, crypt),
 * the header band and the footer legend at the given viewport size. Non-finite
 * inputs are coerced to 0.
 */
export function estateChromeRects(
  vw: number,
  vh: number,
): { placeCards: ChromeRect[]; header: ChromeRect; legend: ChromeRect } {
  const w = Math.max(0, finiteOrZero(vw));
  const h = Math.max(0, finiteOrZero(vh));
  const placeCards = PLACE_ORDER.map((id): ChromeRect => {
    const c = PLACE_CENTERS[id];
    return {
      left: c.x * w - PLACE_CARD_W_PX / 2,
      right: c.x * w + PLACE_CARD_W_PX / 2,
      top: c.y * h - PLACE_CARD_H_PX / 2,
      bottom: c.y * h + PLACE_CARD_H_PX / 2,
    };
  });
  const legendW = Math.min(LEGEND_MAX_W_PX, Math.max(0, w - 32));
  return {
    placeCards,
    header: { left: 0, top: 0, right: w, bottom: HEADER_H_PX },
    legend: {
      left: w - 16 - legendW,
      right: w - 16,
      top: h - LEGEND_H_PX,
      bottom: h,
    },
  };
}

/**
 * The whisper's bounding rectangle at the given viewport size, mirroring the
 * CSS in `EstateMap` (`WHISPER_TOP_PCT`, `WHISPER_CENTER_PCT`,
 * `WHISPER_WIDTH_CSS`, `WHISPER_H_PX`). Non-finite inputs are coerced to 0.
 */
export function whisperLane(vw: number, vh: number): ChromeRect {
  const w = Math.max(0, finiteOrZero(vw));
  const h = Math.max(0, finiteOrZero(vh));
  const width = Math.max(0, 0.58 * w - (PLACE_CARD_W_PX + 32));
  const centre = (WHISPER_CENTER_PCT / 100) * w;
  const top = (WHISPER_TOP_PCT / 100) * h;
  return {
    left: centre - width / 2,
    right: centre + width / 2,
    top,
    bottom: top + WHISPER_H_PX,
  };
}
