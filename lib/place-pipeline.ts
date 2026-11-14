/**
 * Pure place derivation pipeline shared by the place views:
 * filter → order → paginate. No I/O, no clock.
 */
import type { GraveyardRow } from "@/lib/graveyard-view";
import {
  GHOST_DECAY_WORDS,
  ZOMBIE_DECAY_WORDS,
  orderForPlace,
  paginate,
  type PlaceFilter,
  type PlaceId,
} from "@/lib/estate-view";

/**
 * Applies the active filter to a place's rows. `"all"` keeps every row;
 * `"risen"` (gate only) keeps the risen rows; a decay word keeps the rows whose
 * existing `decayLevel` equals that word's band index in the place's decay-word
 * array (ghost words for `sky`, zombie words for `gate`, matching only zombie
 * rows). An unknown decay word for the place leaves the set unfiltered. The
 * decay word is read from `decayLevel` — no threshold is recomputed.
 */
export function applyFilter(
  place: PlaceId,
  rows: GraveyardRow[],
  filter: PlaceFilter,
): GraveyardRow[] {
  if (filter === "all") {
    return rows;
  }
  if (filter === "risen") {
    return rows.filter((row) => row.state === "risen");
  }

  if (place === "sky") {
    const band = (GHOST_DECAY_WORDS as readonly string[]).indexOf(filter);
    if (band === -1) {
      return rows;
    }
    return rows.filter((row) => row.decayLevel === band);
  }

  if (place === "gate") {
    const band = (ZOMBIE_DECAY_WORDS as readonly string[]).indexOf(filter);
    if (band === -1) {
      return rows;
    }
    return rows.filter(
      (row) => row.state === "zombie" && row.decayLevel === band,
    );
  }

  // Ground/crypt have no decay chips, so a decay-word filter is a no-op.
  return rows;
}

/** filter → order → paginate. Always returns at least one plot. */
export function placePlots(
  place: PlaceId,
  rows: GraveyardRow[],
  filter: PlaceFilter,
  pageSize: number,
): GraveyardRow[][] {
  const filtered = applyFilter(place, rows, filter);
  const ordered = orderForPlace(place, filtered);
  return paginate(ordered, pageSize);
}
