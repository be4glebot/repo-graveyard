/**
 * Pure scene view-model functions for the haunted graveyard scene.
 *
 * This module is the property-test target for the scene feature. Like
 * `lib/graveyard-view.ts`, it imports no `server-only`, no React, and performs
 * no I/O: it takes `now` as an explicit parameter wherever time matters and
 * never reads the system clock. It consumes the existing lifecycle
 * classification unchanged — it recomputes no lifecycle threshold.
 *
 * Numeric knobs that tune the scene live here as named constants (no magic
 * numbers elsewhere). `TURNING_SOON_DAYS` is a scene-level constant — a window
 * for the turning-soon notice, not a lifecycle threshold; the lifecycle
 * threshold it is compared against (`ghostMaxDaysQuiet`) is still read from
 * `LIFECYCLE_CONFIG`.
 */

import {
  LIFECYCLE_CONFIG,
  type LifecycleState,
  type RepoFacts,
} from "./lifecycle";
import { type GraveyardRow } from "./graveyard-view";
import { normalizeUsername } from "./username";

// ---------------------------------------------------------------------------
// Scene constants (single source of truth for every numeric knob)
// ---------------------------------------------------------------------------

/**
 * Scene-level window, in whole days, within which a ghost is called out as
 * "turning soon". This is a presentation constant, NOT a lifecycle threshold;
 * the lifecycle boundary itself is `LIFECYCLE_CONFIG.ghostMaxDaysQuiet`.
 */
export const TURNING_SOON_DAYS = 30;

/** Zombie count at or above which fog density is pinned to its maximum. */
export const FOG_FULL_ZOMBIES = 20;

/** Base lightning interval in seconds for a single ancient zombie. */
export const LIGHTNING_BASE_SECONDS = 16;

/** Seconds the lightning interval shortens per additional ancient zombie. */
export const LIGHTNING_STEP_SECONDS = 3;

/** Floor on the lightning interval in seconds (photosensitivity safety). */
export const LIGHTNING_FLOOR_SECONDS = 7;

/** Maximum number of creatures rendered in a single zone before "+N more". */
export const ZONE_CAP = 12;

/** Smallest display scale a creature may shrink to as a zone fills up. */
export const CREATURE_SCALE_FLOOR = 0.6;

/** Maximum number of creatures that may use the expensive filter effects. */
export const FILTER_HERO_BUDGET = 4;

/**
 * Exclusive upper bound, in seconds, on the per-creature animation delay. The
 * stagger is drawn from the half-open range [0, ANIMATION_DELAY_MAX_SECONDS).
 */
export const ANIMATION_DELAY_MAX_SECONDS = 6;

/**
 * Days-quiet at which the tombstone darkness factor reaches its half-max. The
 * darkness curve saturates asymptotically toward 1, so this sets how quickly a
 * fresh tombstone sinks toward its darkest safe treatment.
 */
export const TOMBSTONE_DARKNESS_HALF_LIFE_DAYS = 120;

/**
 * Days-quiet at which the tombstone tilt factor reaches its half-max. Tilt
 * leans in more slowly than darkness so an old tombstone reads as settled
 * rather than toppling.
 */
export const TOMBSTONE_TILT_HALF_LIFE_DAYS = 200;

// ---------------------------------------------------------------------------
// Pure view-model functions (stubs — implemented in later tasks)
// ---------------------------------------------------------------------------

/** Art basename set the creature-image map is closed over (Req 4.6 / Property 1). */
export type CreatureBasename =
  | "ghost-0"
  | "ghost-1"
  | "ghost-2"
  | "ghost-3"
  | "zombie-0"
  | "zombie-1"
  | "zombie-2"
  | "zombie-3"
  | "zombie-4"
  | "risen"
  | "tomb-arch-fresh"
  | "coffin";

/**
 * Total map from (state, decayLevel) → art basename. Clamps decayLevel into the
 * valid band for defence, reads only state+decayLevel, never recomputes a
 * threshold, never throws. (Req 4.1–4.8 / Property 1)
 */
export function creatureImage(
  state: LifecycleState,
  decayLevel: number | null,
): CreatureBasename {
  // Clamp a (possibly null, possibly out-of-band) decay level into an
  // integer within [min, max] for defence. `null` and non-finite inputs
  // collapse to `min` so the map stays total and never throws (Req 4.6/4.8).
  const clampDecay = (value: number | null, max: number): number => {
    if (value === null || !Number.isFinite(value)) {
      return 0;
    }
    const level = Math.trunc(value);
    if (level < 0) {
      return 0;
    }
    if (level > max) {
      return max;
    }
    return level;
  };

  switch (state) {
    case "ghost": {
      // Ghost decay band is 0–3 (Req 4.1).
      const n = clampDecay(decayLevel, 3);
      return (`ghost-${n}`) as CreatureBasename;
    }
    case "zombie": {
      // Zombie decay band is 0–4 (Req 4.2).
      const n = clampDecay(decayLevel, 4);
      return (`zombie-${n}`) as CreatureBasename;
    }
    case "risen":
      return "risen"; // Req 4.3
    case "tombstone":
      return "tomb-arch-fresh"; // Req 4.4
    case "coffin":
      return "coffin"; // Req 4.5
  }
}

/** Per-state counts + total "souls"; non-negative, partition the input. (Req 7.3 / Property 4) */
export interface SummaryCounts {
  souls: number;
  ghost: number;
  risen: number;
  zombie: number;
  tombstone: number;
  coffin: number;
}

export function summaryCounts(rows: GraveyardRow[]): SummaryCounts {
  // Partition rows by lifecycle state. Every row lands in exactly one bucket,
  // so the per-state counts sum to rows.length and `souls` equals that total
  // (Req 7.3 / Property 4). Zero categories stay 0 rather than being dropped
  // (Req 7.4).
  const counts: SummaryCounts = {
    souls: rows.length,
    ghost: 0,
    risen: 0,
    zombie: 0,
    tombstone: 0,
    coffin: 0,
  };
  for (const row of rows) {
    counts[row.state] += 1;
  }
  return counts;
}

/** "blood-red" iff (zombie+risen) > (ghost+tombstone), else "pale". (Req 3.2 / Property 3) */
export function moonTreatment(rows: GraveyardRow[]): "blood-red" | "pale" {
  // Compare the "undead" population against the "settled" population. The moon
  // turns blood-red strictly when the undead outnumber the settled; ties and
  // the settled majority stay pale (Req 3.2 / Property 3).
  const { zombie, risen, ghost, tombstone } = summaryCounts(rows);
  return zombie + risen > ghost + tombstone ? "blood-red" : "pale";
}

/**
 * Fog density in [0,100]: 0 iff zombieCount==0, 100 iff zombieCount>=20,
 * strictly between and monotonic non-decreasing for 1..19. (Req 3.3 / Property 5)
 */
export function fogDensity(zombieCount: number): number {
  // Normalize the input into a non-negative integer count so the function is
  // total: null/NaN/negative/fractional inputs collapse to a well-defined
  // count rather than producing NaN or throwing.
  const count =
    Number.isFinite(zombieCount) && zombieCount > 0
      ? Math.trunc(zombieCount)
      : 0;

  // Endpoints are exact: empty graveyard clears the fog, a full house (>= 20
  // ancient-ish zombies) pins it to max.
  if (count === 0) {
    return 0;
  }
  if (count >= FOG_FULL_ZOMBIES) {
    return 100;
  }

  // Interior (1..FOG_FULL_ZOMBIES-1): scale linearly to [0,100] and round.
  // Because count is strictly between 0 and FOG_FULL_ZOMBIES here, the raw
  // value is strictly between 0 and 100; clamp away from the endpoints so a
  // rounding edge can never land exactly on 0 or 100, keeping 1..19 strictly
  // interior and monotonic non-decreasing.
  const raw = Math.round((100 * count) / FOG_FULL_ZOMBIES);
  return Math.min(99, Math.max(1, raw));
}

/**
 * Lightning interval in seconds, or null when ancientCount==0.
 * interval = max(7, 16 − 3 × (ancientCount − 1)). (Req 3.4/3.5 / Property 6)
 */
export function lightningIntervalSeconds(ancientCount: number): number | null {
  // Normalize into a non-negative integer so the function is total: null/NaN/
  // negative/fractional inputs collapse to a well-defined count. Zero ancient
  // zombies means no lightning at all (Req 3.5).
  const count =
    Number.isFinite(ancientCount) && ancientCount > 0
      ? Math.trunc(ancientCount)
      : 0;
  if (count === 0) {
    return null;
  }

  // interval = max(floor, base − step × (count − 1)): starts at the base for a
  // single ancient zombie and shortens by one step per additional ancient,
  // never dropping below the photosensitivity floor (Req 3.4).
  const raw =
    LIGHTNING_BASE_SECONDS - LIGHTNING_STEP_SECONDS * (count - 1);
  return Math.max(LIGHTNING_FLOOR_SECONDS, raw);
}

/** Number of zombie rows at decay level 4 (ancient). */
export function ancientZombieCount(rows: GraveyardRow[]): number {
  // An "ancient" zombie is a zombie row pinned at the top of its decay band
  // (decay level 4). Count exactly those rows (Req 3.4).
  let count = 0;
  for (const row of rows) {
    if (row.state === "zombie" && row.decayLevel === 4) {
      count += 1;
    }
  }
  return count;
}

/**
 * Orders zombie rows so distance-from-gate is monotonic non-decreasing in decay
 * level (newest/lowest decay nearest the gate); ties within a decay level keep
 * input order (pushed-at desc). Stable sort by decayLevel. (Req 5.3/5.4 / Property 2)
 */
export function orderZombies(zombieRows: GraveyardRow[]): GraveyardRow[] {
  // Copy first so the caller's array is never mutated; sort operates on the
  // copy. Array.prototype.sort is stable in modern JS engines, so rows that
  // compare equal keep their relative input order — which is pushed-at
  // descending as produced by the loader (Req 5.4).
  //
  // The sort key is decay level ascending, so the lowest decay (newest) ends
  // up first (nearest the gate) and the highest decay last (farthest), making
  // distance-from-gate monotonic non-decreasing in decay level (Req 5.3). A
  // null decay level is treated defensively as 0 so the function is total and
  // never produces NaN comparisons.
  const decayOf = (row: GraveyardRow): number =>
    row.decayLevel === null || !Number.isFinite(row.decayLevel)
      ? 0
      : row.decayLevel;

  return zombieRows.slice().sort((a, b) => decayOf(a) - decayOf(b));
}

/**
 * Tombstone darkness and tilt, each monotonic non-decreasing in daysQuiet and
 * clamped to safe display ranges. Returns normalized 0..1 factors the component
 * maps to filter brightness and rotation. (Req 5.5 / Property 7)
 */
export interface TombstoneTreatment {
  darkness: number;
  tilt: number;
}

export function tombstoneTreatment(daysQuiet: number): TombstoneTreatment {
  // Normalize the input defensively: null/NaN/negative/non-finite days collapse
  // to 0 so the function is total and never produces NaN. A fresh tombstone
  // (daysQuiet 0) therefore yields the minimum darkness and tilt.
  const days =
    Number.isFinite(daysQuiet) && daysQuiet > 0 ? daysQuiet : 0;

  // Saturating curve: f(days) = days / (days + halfLife). This is strictly
  // monotonic non-decreasing in days, equals 0 at days 0, stays within [0,1)
  // for every finite input, and approaches (saturates at) 1 as days grow — so
  // each factor is naturally clamped to the safe [0,1] display range without a
  // separate clamp. The half-life constant is the days-quiet at which the
  // factor reaches 0.5.
  const saturate = (halfLifeDays: number): number =>
    days / (days + halfLifeDays);

  return {
    darkness: saturate(TOMBSTONE_DARKNESS_HALF_LIFE_DAYS),
    tilt: saturate(TOMBSTONE_TILT_HALF_LIFE_DAYS),
  };
}

/**
 * Zone capping: rendered = min(count, 12); more = max(0, count − 12).
 * (Req 11.3 / Property 8)
 */
export interface ZoneCap {
  rendered: number;
  more: number;
}

export function capZone(count: number, cap: number = ZONE_CAP): ZoneCap {
  // Normalize defensively so the function is total: null/NaN/negative/
  // fractional inputs collapse to a well-defined non-negative integer count,
  // and a non-finite or negative cap falls back to the module default. This
  // keeps `rendered`/`more` as clean integers rather than producing NaN.
  const safeCount =
    Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
  const safeCap =
    Number.isFinite(cap) && cap >= 0 ? Math.trunc(cap) : ZONE_CAP;

  // rendered = min(count, cap); more = max(0, count − cap). The two partition
  // the zone's creatures: `rendered` are drawn individually and `more` roll up
  // into the "+N more" group (Req 11.3 / Property 8).
  const rendered = Math.min(safeCount, safeCap);
  const more = Math.max(0, safeCount - safeCap);
  return { rendered, more };
}

/** Scales creature display size down to >= 0.6 as zone count grows. (Req 11.6) */
export function creatureScale(zoneCount: number): number {
  // Normalize defensively: null/NaN/negative/fractional counts collapse to a
  // non-negative integer so the function is total and never produces NaN.
  const count =
    Number.isFinite(zoneCount) && zoneCount > 0 ? Math.trunc(zoneCount) : 0;

  // At or below the visible cap every creature is drawn at full size — a zone
  // that fits within its cap never shrinks (Req 11.6).
  if (count <= ZONE_CAP) {
    return 1;
  }

  // Beyond the cap, shrink toward the floor as the count grows. A saturating
  // curve on the overflow keeps the result monotonic non-increasing in count,
  // starts just below full size at the first creature past the cap, and
  // approaches (but never reaches) the floor as the count grows without bound.
  // The result therefore always lies in (CREATURE_SCALE_FLOOR, 1), well within
  // the required [0.6, 1.0] band. Clamp as a final guard so the floor is never
  // crossed even under extreme inputs.
  const overflow = count - ZONE_CAP;
  const range = 1 - CREATURE_SCALE_FLOOR;
  const scale = CREATURE_SCALE_FLOOR + range * (ZONE_CAP / (ZONE_CAP + overflow));
  return Math.min(1, Math.max(CREATURE_SCALE_FLOOR, scale));
}

/**
 * Zone rectangles as viewport percentages, taken from
 * docs/design-canvas/ArtPreview.dc.html. One exported constant is the single
 * source of truth for every zone's bounds; because the values are percentages,
 * zones scale with viewport width (Req 11.1/11.2). Zone.tsx reads the rect for
 * its state and spaces its creatures evenly across it.
 *
 *   ghost     → sky band (upper-middle, spanning most of the width)
 *   risen     → left-edge grave (small rect at the lower-left)
 *   tombstone → in front of the fence (mid band, inside the fence line)
 *   zombie    → foreground outside the fence (lower band across the width)
 *   coffin    → the crypt at the mausoleum door (right edge)
 */
export type ZoneName = "ghost" | "risen" | "tombstone" | "zombie" | "coffin";

export interface ZoneRect {
  /** percentage */
  left: number;
  /** percentage */
  top: number;
  /** percentage */
  width: number;
  /** percentage */
  height: number;
}

export const ZONE_RECTS: Record<ZoneName, ZoneRect> = {
  // Percentages read off ArtPreview.dc.html (scene canvas 1440 × 1100).
  //
  // Ghosts drift in the sky band: lefts 15–59% with ~170px (≈12%) wide art at
  // tops 196–300px dropping ~176px, so the band runs the upper-middle width
  // and sits above the fence line (top 470px ≈ 43%).
  ghost: { left: 10, top: 15, width: 72, height: 29 },
  // The risen climbs out of a small grave at the left edge: left 3%, top 720px
  // (≈65%), 120 × 150px art (≈8 × 14%).
  risen: { left: 2, top: 63, width: 14, height: 20 },
  // Tombstones stand in front of the fence: lefts 17–57% at tops ~626–636px
  // (≈57%), inside the fence line, as a mid band.
  tombstone: { left: 14, top: 54, width: 50, height: 14 },
  // Zombies shamble in the foreground outside the fence: lefts 13–67.5% at
  // tops 770–832px (≈70–76%), a lower band across most of the width.
  zombie: { left: 10, top: 68, width: 70, height: 20 },
  // Coffins sit in the crypt at the mausoleum door on the right edge: the crypt
  // container is left 75%, top 700px (≈64%), width 22%, height 300px (≈27%).
  coffin: { left: 75, top: 62, width: 22, height: 28 },
};

/** Accessible name: "name, state, humanized-days-quiet", omitting unavailable fields. (Req 9.1/9.2) */
export function creatureAccessibleName(row: Partial<GraveyardRow>): string {
  // Compose "name, state, humanized-time-quiet" (e.g. "weather-app, zombie,
  // abandoned 8 months"), omitting ONLY the fields that are unavailable while
  // keeping the rest, then joining the surviving parts with ", " (Req 9.1/9.2).
  // The function is total and never throws: every field is probed defensively
  // and a missing one simply drops out of the list rather than producing an
  // error or the literal "undefined".
  const parts: string[] = [];

  // --- name ----------------------------------------------------------------
  // Available only when it is a non-empty (post-trim) string. A null/undefined
  // or whitespace-only name is treated as unavailable and omitted.
  if (typeof row.name === "string" && row.name.trim().length > 0) {
    parts.push(row.name.trim());
  }

  // --- state ---------------------------------------------------------------
  // The lifecycle state word is what makes the creature's state fully
  // determinable from the accessible-name text, independent of color or motion
  // (Req 9.5). Include it verbatim when present as a non-empty string.
  if (typeof row.state === "string" && row.state.trim().length > 0) {
    parts.push(row.state.trim());
  }

  // --- humanized time-quiet ------------------------------------------------
  // `daysQuiet` is "available" when it is a finite, non-negative number. A
  // null/undefined/NaN/negative value is unavailable and omitted. The inline
  // humanizer turns a whole-day count into a readable phrase such as
  // "abandoned 8 months" / "quiet 3 days" using the largest natural unit.
  if (
    typeof row.daysQuiet === "number" &&
    Number.isFinite(row.daysQuiet) &&
    row.daysQuiet >= 0
  ) {
    parts.push(humanizeTimeQuiet(Math.trunc(row.daysQuiet)));
  }

  return parts.join(", ");
}

/**
 * Turns a whole-day count into a readable "time quiet" phrase for the
 * accessible name, e.g. "quiet 0 days", "quiet 3 days", "abandoned 8 months",
 * "abandoned 2 years". Uses the largest natural unit (years ≥ 365d, months ≥
 * 30d, otherwise days) and switches the lead verb from "quiet" to "abandoned"
 * once the gap reaches a month, so the phrase reads naturally in either range.
 * Pure and total: a non-finite or negative input collapses to 0 days.
 */
function humanizeTimeQuiet(days: number): string {
  const d = Number.isFinite(days) && days > 0 ? Math.trunc(days) : 0;

  const unit = (value: number, name: string): string =>
    `${value} ${name}${value === 1 ? "" : "s"}`;

  if (d >= 365) {
    return `abandoned ${unit(Math.floor(d / 365), "year")}`;
  }
  if (d >= 30) {
    return `abandoned ${unit(Math.floor(d / 30), "month")}`;
  }
  return `quiet ${unit(d, "day")}`;
}

/** Turning-soon selection: fewest whole days to turn, tie-break latest pushedAt. (Req 7.8) */
export interface TurningSoon {
  name: string;
  daysLeft: number;
}

export function pickTurningSoon(
  repos: RepoFacts[],
  rows: GraveyardRow[],
  now: string,
): TurningSoon | null {
  // `now` is part of the signature so this helper stays uniform with the other
  // time-aware view-model functions; every value it needs is already carried on
  // the rows (daysQuiet) and the repos (pushedAt), so it reads no clock. The
  // reference is a defensive no-op, not a clock read.
  void now;

  // The lifecycle boundary a ghost crosses to become a zombie is read from the
  // config — never hardcoded as 90. The notice window is the scene-level
  // TURNING_SOON_DAYS constant above (a presentation knob, not a threshold).
  const ghostMax = LIFECYCLE_CONFIG.ghostMaxDaysQuiet;

  // Index each repo's pushed-at timestamp by name for the tie-break. A missing
  // repo, a null pushedAt, or an unparseable timestamp carries no recency and
  // sorts last among its peers (−∞), so a parseable push always beats it.
  const pushedMsByName = new Map<string, number>();
  for (const repo of repos) {
    if (repo.pushedAt === null) {
      continue;
    }
    const ms = Date.parse(repo.pushedAt);
    if (!Number.isNaN(ms)) {
      pushedMsByName.set(repo.name, ms);
    }
  }
  const pushedMsOf = (name: string): number =>
    pushedMsByName.get(name) ?? Number.NEGATIVE_INFINITY;

  // Scan the ghost rows and keep the best candidate: fewest whole days left,
  // tie-broken by the most recent push, then earliest input order. Walking in
  // input order and only replacing on a STRICT improvement keeps the earliest
  // row on a full tie (Req 7.8).
  let best: GraveyardRow | null = null;
  let bestDaysLeft = 0;
  for (const row of rows) {
    if (row.state !== "ghost") {
      continue;
    }
    if (!Number.isFinite(row.daysQuiet)) {
      continue;
    }

    // Whole days until this ghost crosses the ghost→zombie boundary. A ghost
    // that has not yet turned has daysLeft >= 0; it qualifies only when it also
    // sits inside the TURNING_SOON_DAYS notice window.
    const daysLeft = ghostMax - row.daysQuiet;
    if (daysLeft < 0 || daysLeft > TURNING_SOON_DAYS) {
      continue;
    }

    if (best === null) {
      best = row;
      bestDaysLeft = daysLeft;
      continue;
    }
    if (daysLeft < bestDaysLeft) {
      best = row;
      bestDaysLeft = daysLeft;
    } else if (
      daysLeft === bestDaysLeft &&
      pushedMsOf(row.name) > pushedMsOf(best.name)
    ) {
      best = row;
      bestDaysLeft = daysLeft;
    }
  }

  return best === null ? null : { name: best.name, daysLeft: bestDaysLeft };
}

/** Deep-link: exact case-insensitive match of initialRepo to a row name. (Req 1.2/1.3) */
export function selectInitialCreature(
  rows: GraveyardRow[],
  initialRepo?: string,
): string | null {
  // No deep-link target (undefined, or empty/whitespace-only) → nothing is
  // pre-selected (Req 1.3). We compare against the trimmed, lowercased form so
  // the match is exact and case-insensitive.
  if (typeof initialRepo !== "string") {
    return null;
  }
  const target = normalizeUsername(initialRepo.trim());
  if (target.length === 0) {
    return null;
  }

  // Return the first row whose name matches by exact, case-insensitive
  // comparison, preserving the row's ORIGINAL (non-lowercased) name (Req 1.2).
  // No match leaves the selection empty (Req 1.3).
  for (const row of rows) {
    if (normalizeUsername(row.name) === target) {
      return row.name;
    }
  }
  return null;
}

/**
 * Chooses which creatures may use the expensive SVG/CSS filter effects (ghost
 * decay-0 shroud ripple, ghost decay-3 red/cyan split glitch). Returns a Set of
 * at most 4 repo names, in priority order: the hovered/focused creature first,
 * then the turning-soon ghost, then the selected creature, then remaining rows
 * in deterministic input order until the budget of 4 is reached. Dedupes names
 * and never exceeds 4. (Req 6.9)
 */
export interface FilterHeroHints {
  /** repo name currently hovered/focused */
  hovered?: string | null;
  /** repo name currently selected */
  selected?: string | null;
  /** repo name of the turning-soon ghost */
  turningSoon?: string | null;
}

export function pickFilterHeroes(
  rows: GraveyardRow[],
  hints: FilterHeroHints,
): Set<string> {
  // The set of names that actually exist on screen. A hint pointing at a name
  // not present in `rows` carries no creature to apply a filter to, so it is
  // ignored — the result is always drawn from the input rows (Req 6.9).
  const present = new Set(rows.map((row) => row.name));

  const heroes = new Set<string>();

  // Honor the priority order hovered → turning-soon → selected, taking each
  // hint only when it names a present creature and the budget still has room.
  // `heroes` is a Set, so adding a name already chosen is a no-op (dedupe).
  const consider = (name: string | null | undefined): void => {
    if (heroes.size >= FILTER_HERO_BUDGET) {
      return;
    }
    if (name && present.has(name)) {
      heroes.add(name);
    }
  };

  consider(hints.hovered);
  consider(hints.turningSoon);
  consider(hints.selected);

  // Deterministic fill: walk the rows in their given input order, adding any
  // not already chosen, until the budget is reached. Identical inputs yield an
  // identical result because both the hint order and the row order are fixed.
  for (const row of rows) {
    if (heroes.size >= FILTER_HERO_BUDGET) {
      break;
    }
    heroes.add(row.name);
  }

  return heroes;
}

/**
 * Builds the ordered list of whisper strings strictly from loaded repo data.
 * Each entry is a verifiable fact about a currently loaded repository. Returns
 * an empty list when no qualifying data exists (Req 8.2, 8.3). Pure and
 * deterministic for the same (rows, repos, now); never invents a name or fact.
 */
export function composeWhispers(
  rows: GraveyardRow[],
  repos: RepoFacts[],
  now: string,
): string[] {
  // `now` is part of the signature so the function stays uniform with the other
  // time-aware view-model helpers and remains free to incorporate time-derived
  // facts later; every whisper below is already derived strictly from the
  // loaded `rows`/`repos`, so the result is pure and deterministic for the same
  // (rows, repos, now). The reference is a no-op guard, not a clock read.
  void now;

  // Index each repo's pushed-at timestamp by name so we can break ties by
  // recency. A name with no matching repo, a null pushedAt, or an unparseable
  // timestamp simply has no recency fact and sorts last among its peers — we
  // never invent one.
  const pushedMsByName = new Map<string, number>();
  for (const repo of repos) {
    if (repo.pushedAt === null) {
      continue;
    }
    const ms = Date.parse(repo.pushedAt);
    if (!Number.isNaN(ms)) {
      pushedMsByName.set(repo.name, ms);
    }
  }
  const pushedMsOf = (name: string): number =>
    pushedMsByName.get(name) ?? Number.NEGATIVE_INFINITY;

  const whispers: string[] = [];

  // --- Freshest zombie -----------------------------------------------------
  // The freshest zombie is the one nearest to still being alive: lowest decay
  // level first, then most recently pushed, then earliest input order. A null
  // decay level is treated defensively as 0 so the comparison is total. Picking
  // from `rows` guarantees the name is real.
  const decayOf = (row: GraveyardRow): number =>
    row.decayLevel === null || !Number.isFinite(row.decayLevel)
      ? 0
      : row.decayLevel;

  let freshestZombie: GraveyardRow | null = null;
  for (const row of rows) {
    if (row.state !== "zombie") {
      continue;
    }
    if (freshestZombie === null) {
      freshestZombie = row;
      continue;
    }
    const d = decayOf(row);
    const best = decayOf(freshestZombie);
    if (d < best) {
      freshestZombie = row;
    } else if (d === best && pushedMsOf(row.name) > pushedMsOf(freshestZombie.name)) {
      freshestZombie = row;
    }
    // On a full tie (same decay, same recency) the earlier input row wins,
    // which is the current `freshestZombie`, so we leave it untouched.
  }
  if (freshestZombie !== null) {
    whispers.push(`${freshestZombie.name} is still waiting for you…`);
  }

  // --- Turning-soon ghost --------------------------------------------------
  // A ghost is "turning soon" when it is within the scene's TURNING_SOON_DAYS
  // window of crossing the ghost→zombie boundary (LIFECYCLE_CONFIG
  // .ghostMaxDaysQuiet). We select the ghost with the fewest whole days left,
  // tie-broken by the most recent push, then earliest input order — mirroring
  // `pickTurningSoon` but derived inline here so this function never couples to
  // that (possibly still-stub) helper. `daysLeft` is read straight from the
  // row's `daysQuiet`; no threshold is recomputed beyond this comparison.
  const ghostMax = LIFECYCLE_CONFIG.ghostMaxDaysQuiet;
  let turningSoonGhost: GraveyardRow | null = null;
  let turningSoonDaysLeft = 0;
  for (const row of rows) {
    if (row.state !== "ghost") {
      continue;
    }
    if (!Number.isFinite(row.daysQuiet)) {
      continue;
    }
    const daysLeft = ghostMax - row.daysQuiet;
    // Only ghosts that have not yet turned and sit inside the notice window
    // qualify.
    if (daysLeft < 0 || daysLeft > TURNING_SOON_DAYS) {
      continue;
    }
    if (turningSoonGhost === null) {
      turningSoonGhost = row;
      turningSoonDaysLeft = daysLeft;
      continue;
    }
    if (daysLeft < turningSoonDaysLeft) {
      turningSoonGhost = row;
      turningSoonDaysLeft = daysLeft;
    } else if (
      daysLeft === turningSoonDaysLeft &&
      pushedMsOf(row.name) > pushedMsOf(turningSoonGhost.name)
    ) {
      turningSoonGhost = row;
      turningSoonDaysLeft = daysLeft;
    }
  }
  if (turningSoonGhost !== null) {
    whispers.push(`${turningSoonGhost.name} grows cold…`);
  }

  // No qualifying data → empty list (Req 8.3). The list is ordered: freshest
  // zombie first, turning-soon ghost second.
  return whispers;
}

/**
 * Deterministic per-creature animation stagger. Hashes the repo name to a
 * stable fractional-second delay within a bounded range
 * ([0, ANIMATION_DELAY_MAX_SECONDS) seconds) so no two creatures in a zone
 * begin their cycle at the same instant and the delay is identical across
 * renders for the same name. Pure, total, never throws. (Req 6.8)
 */
export function animationDelay(name: string): number {
  // Defensive coercion keeps the function total: a non-string argument (under
  // loose callers) or an empty string collapses to the empty string, which
  // hashes to the FNV-1a offset basis and maps to a well-defined delay rather
  // than throwing or producing NaN.
  const text = typeof name === "string" ? name : "";

  // FNV-1a 32-bit rolling hash. We fold in each UTF-16 code unit, keeping the
  // accumulator inside the unsigned 32-bit range via `Math.imul` for the prime
  // multiply and `>>> 0` to coerce back to an unsigned integer. This is a pure
  // function of the input characters, so the same name always hashes to the
  // same value across renders.
  const FNV_OFFSET_BASIS = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  const unsigned = hash >>> 0;

  // Map the 32-bit hash into the half-open range [0, max) seconds. Dividing by
  // 2^32 yields a fraction in [0, 1); scaling by the max keeps the result in
  // [0, ANIMATION_DELAY_MAX_SECONDS). The value is fractional-second precise so
  // distinct names land on distinct delays and stagger their cycles (Req 6.8).
  const fraction = unsigned / 0x1_0000_0000;
  return fraction * ANIMATION_DELAY_MAX_SECONDS;
}
