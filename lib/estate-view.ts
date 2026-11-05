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
