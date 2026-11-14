/**
 * Deterministic data for the Visual_Review cases (dev harness and capture
 * tooling). Pure: no I/O, no clock, no randomness. Names and `daysQuiet` are
 * fixed tables so the same case always yields the same rows.
 *
 * Decay levels follow `LIFECYCLE_CONFIG` (ghost bounds 14/30/60, ghost < 90
 * days quiet); tombstones and coffins carry no decay level.
 *
 * Requirements: 20.3, 20.1
 */

import { type GraveyardRow } from "./graveyard-view";
import { LIFECYCLE_CONFIG, type LifecycleState } from "./lifecycle";

export type ReviewCase =
  | "ghosts-3"
  | "ghosts-12"
  | "tombstones-3"
  | "tombstones-12"
  | "coffins-3"
  | "coffins-12"
  | "empty";

export const REVIEW_CASES: readonly ReviewCase[] = [
  "ghosts-3",
  "ghosts-12",
  "tombstones-3",
  "tombstones-12",
  "coffins-3",
  "coffins-12",
  "empty",
];

/** Invented repo names, long and short, so labels exercise wrapping. */
const NAMES_12: readonly string[] = [
  "lantern-api",
  "moss",
  "bramble-ui",
  "night-owl-cli",
  "quill",
  "hollow-sync",
  "thistle-notes",
  "ember-board",
  "wren",
  "cobweb-scheduler-service",
  "dusk-tracker",
  "marrow-docs",
];

const NAMES_3: readonly string[] = [NAMES_12[0], NAMES_12[2], NAMES_12[5]];

/** Ghost days quiet: spans decay levels 0 to 3 within the ghost window. */
const GHOST_DAYS_12: readonly number[] = [
  2, 6, 11, 16, 22, 28, 35, 44, 55, 64, 77, 88,
];
const GHOST_DAYS_3: readonly number[] = [6, 33, 84];

/** Tombstone and coffin days quiet: well past the ghost window. */
const SETTLED_DAYS_12: readonly number[] = [
  95, 140, 200, 290, 400, 520, 700, 900, 1100, 1400, 1800, 2400,
];
const SETTLED_DAYS_3: readonly number[] = [120, 480, 1500];

/** Decay level for a ghost: count of bounds <= days quiet (0..3). */
function ghostDecay(daysQuiet: number): number {
  return LIFECYCLE_CONFIG.ghostDecayBounds.filter((b) => b <= daysQuiet).length;
}

function rowsFor(
  state: LifecycleState,
  names: readonly string[],
  days: readonly number[],
): GraveyardRow[] {
  return names.map((name, i) => ({
    name,
    url: `https://github.com/review-estate/${name}`,
    state,
    daysQuiet: days[i],
    decayLevel: state === "ghost" ? ghostDecay(days[i]) : null,
  }));
}

/** Returns fresh, deterministic rows for a Review_Case (empty for `empty`). */
export function buildReviewRows(reviewCase: ReviewCase): GraveyardRow[] {
  switch (reviewCase) {
    case "ghosts-3":
      return rowsFor("ghost", NAMES_3, GHOST_DAYS_3);
    case "ghosts-12":
      return rowsFor("ghost", NAMES_12, GHOST_DAYS_12);
    case "tombstones-3":
      return rowsFor("tombstone", NAMES_3, SETTLED_DAYS_3);
    case "tombstones-12":
      return rowsFor("tombstone", NAMES_12, SETTLED_DAYS_12);
    case "coffins-3":
      return rowsFor("coffin", NAMES_3, SETTLED_DAYS_3);
    case "coffins-12":
      return rowsFor("coffin", NAMES_12, SETTLED_DAYS_12);
    case "empty":
      return [];
  }
}
