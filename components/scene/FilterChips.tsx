"use client";

/**
 * Decay-word filter chips (client component).
 *
 * Renders the selectable filter chips for a place and reports selection through
 * `onFilterChange`. Only `sky` and `gate` carry decay chips (the two states
 * with a decay band); `ground` and `crypt` render nothing (Req 8.11).
 *
 *   sky  → one chip per ghost decay word, in band order:
 *          healthy, fading, flickering, about to turn (Req 8.4).
 *   gate → one chip per zombie decay word, in band order:
 *          fresh, rotting, decayed, skeletal, ancient, PLUS a dedicated
 *          "Risen" chip for the risen population (Req 8.5).
 *
 * An "All" chip leads both rows and clears the filter (Req 8.10). Each chip
 * shows the count of place rows that match its band/state (Req 8.6); a chip
 * whose count is 0 is dimmed and disabled so it cannot be selected (Req 8.7).
 *
 * The decay word of a row is read straight from its existing `decayLevel`
 * (the index into the band's word array) — this component recomputes no decay
 * threshold. A row whose `decayLevel` falls outside the band is counted under
 * no decay chip (it still appears under "All").
 *
 * Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11
 */

import { type GraveyardRow } from "@/lib/graveyard-view";
import {
  GHOST_DECAY_WORDS,
  ZOMBIE_DECAY_WORDS,
  type PlaceFilter,
  type PlaceId,
} from "@/lib/estate-view";

export interface FilterChipsProps {
  /** Which place these chips belong to; selects the chip set. */
  place: PlaceId;
  /** All rows for this place (already `placeOf`-filtered, unpaginated). */
  rows: GraveyardRow[];
  /** The currently active filter (`"all"`, a decay word, or `"risen"`). */
  activeFilter: PlaceFilter;
  /** Raised with the next filter when a chip is activated. */
  onFilterChange: (filter: PlaceFilter) => void;
}

/** A single chip's rendered model: its filter value, label, and count. */
interface ChipModel {
  /** The filter this chip selects. */
  filter: PlaceFilter;
  /** The human-readable label (capitalized decay word, "Risen", or "All"). */
  label: string;
  /** The number of place rows this chip matches. */
  count: number;
}

/** Capitalizes the first letter of a decay word for the chip label. */
function capitalize(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1);
}

/**
 * Counts rows whose `decayLevel` equals `band`. The decay word is derived from
 * the existing `decayLevel` (never recomputed); a null/non-finite level matches
 * no band.
 */
function countAtBand(rows: GraveyardRow[], band: number): number {
  let count = 0;
  for (const row of rows) {
    if (row.decayLevel === band) {
      count += 1;
    }
  }
  return count;
}

/** Builds the ordered chip models for a place, or `null` when it has no chips. */
function buildChips(place: PlaceId, rows: GraveyardRow[]): ChipModel[] | null {
  // Ground and crypt have no decay band, so they render no decay chips.
  if (place === "sky") {
    // One chip per ghost decay word (bands 0..3), led by "All".
    return [
      { filter: "all", label: "All", count: rows.length },
      ...GHOST_DECAY_WORDS.map((word, band) => ({
        filter: word as PlaceFilter,
        label: capitalize(word),
        count: countAtBand(rows, band),
      })),
    ];
  }

  if (place === "gate") {
    // One chip per zombie decay word (bands 0..4) over the zombie rows, a
    // dedicated "Risen" chip over the risen rows, led by "All".
    const zombieRows = rows.filter((row) => row.state === "zombie");
    const risenCount = rows.filter((row) => row.state === "risen").length;
    return [
      { filter: "all", label: "All", count: rows.length },
      ...ZOMBIE_DECAY_WORDS.map((word, band) => ({
        filter: word as PlaceFilter,
        label: capitalize(word),
        count: countAtBand(zombieRows, band),
      })),
      { filter: "risen", label: "Risen", count: risenCount },
    ];
  }

  return null;
}

export default function FilterChips({
  place,
  rows,
  activeFilter,
  onFilterChange,
}: FilterChipsProps) {
  const chips = buildChips(place, rows);

  // Ground/crypt: no decay filter chips (Req 8.11).
  if (chips === null) {
    return null;
  }

  return (
    <div
      data-testid="filter-chips"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {chips.map((chip) => {
        // The "All" chip is always enabled; a decay/risen chip with a zero
        // count is dimmed and disabled (Req 8.7).
        const disabled = chip.filter !== "all" && chip.count === 0;
        const active = chip.filter === activeFilter;
        return (
          <button
            key={chip.filter}
            type="button"
            data-testid={`filter-chip-${chip.filter}`}
            data-active={active ? "true" : undefined}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onFilterChange(chip.filter)}
            className={[
              // Bevelled plaque chip from the boards (.chip2); the active
              // filter adds .chip2.on for the crimson, visually-distinct state
              // (Req 7.2, 7.3). The base class owns the box, font, border, and
              // background; the utilities below carry only interaction state
              // (focus ring, hover, disabled) and the inner count gap.
              "chip2 pointer-events-auto gap-2 transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-candle-400",
              active ? "on" : null,
              disabled
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer hover:border-candle-400",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>{chip.label}</span>
            <span className="font-fact text-xs text-scene-fg-muted">
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
