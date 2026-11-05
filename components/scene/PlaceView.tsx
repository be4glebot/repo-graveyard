"use client";

/**
 * Place view (client component) — the in-place scene.
 *
 * Shows one place's creatures laid out in depth rows across paginated plots,
 * with the decay-word filter chips, the plot pager, and the return-to-the-gate
 * control. It reuses the shared backdrop stack (`Backdrop` / `Sky` / `Moon` /
 * `Atmosphere`) so a place reads like the same painted estate as the map, then
 * composites the place chrome over it.
 *
 * ## Gate atmosphere layers
 *
 * The gate is the zombie/risen place, so it — and only it — carries the
 * data-encoding `Fog` (density = the gate's zombie count, Req 3.3) and
 * `Lightning` (cadence = the gate's ancient-zombie count, Req 3.4/3.5), driven
 * by the place's own rows and placed in the old scene's band order (fog on a
 * z-30 wrapper under the depth rows / over the backdrop, lightning in the z-40
 * atmosphere band). `Lightning` self-hides when the ancient count is 0, so it
 * is rendered unconditionally for the gate; both are suppressed entirely for
 * the other places. Whispers stay map-only and are never rendered here. `Fog`
 * is motion-agnostic and `Lightning` reads `prefers-reduced-motion` itself, so
 * neither takes a `reducedMotion` prop.
 *
 * ## Derivation pipeline
 *
 * The rows for the place (already `placeOf`-filtered by `SceneView`) flow
 * through three pure steps, in this order:
 *
 *   1. apply the active filter (a decay word, the gate's "Risen", or "all");
 *   2. `orderForPlace(place, filtered)` — the place's narrative ordering;
 *   3. `paginate(ordered, PLOT_SIZE)` — fixed-size plots (Req 5.4).
 *
 * The clamped plot is handed to `DepthRows`, which lays it across up to three
 * depth rows (front largest/brightest, back smaller/dimmer, Req 5.1/5.2) using
 * the reused `creatureScale` for per-row sizing (Req 5.3). Every creature in
 * the plot is rendered individually — no "+N more" collapse (Req 5.5).
 *
 * The decay word of a row is read from its existing `decayLevel` (the index
 * into the place's decay-word array) — no decay threshold is recomputed here.
 *
 * ## Focus on arrival
 *
 * On mount the view moves keyboard focus to the `PlaceHeading` (a
 * `tabIndex={-1}` target) so screen-reader and keyboard users land on the
 * place's name (Req 9.3 / 13.5). The travel transition (task 10) performs the
 * same move on `done`; this mount focus covers the reduced-motion / no-travel
 * path and deep-link arrivals.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1–8.11, 9.1, 9.2, 9.3
 */

import { useEffect, useMemo, useRef } from "react";

import Atmosphere from "@/components/scene/Atmosphere";
import Backdrop from "@/components/scene/Backdrop";
import Fog from "@/components/scene/Fog";
import Lightning from "@/components/scene/Lightning";
import Moon from "@/components/scene/Moon";
import Sky from "@/components/scene/Sky";
import DepthRows from "@/components/scene/DepthRows";
import FilterChips from "@/components/scene/FilterChips";
import Pager from "@/components/scene/Pager";
import PlaceHeading from "@/components/scene/PlaceHeading";
import ReturnToGate from "@/components/scene/ReturnToGate";

import { type GraveyardRow } from "@/lib/graveyard-view";
import {
  GHOST_DECAY_WORDS,
  ZOMBIE_DECAY_WORDS,
  PLACES,
  PLOT_SIZE,
  orderForPlace,
  paginate,
  plaqueCopy,
  type PlaceFilter,
  type PlaceId,
} from "@/lib/estate-view";
import { ancientZombieCount, summaryCounts } from "@/lib/scene-view";

export interface PlaceViewProps {
  /** Which place this view shows. */
  place: PlaceId;
  /** All rows for this place (already `placeOf`-filtered by SceneView). */
  rows: GraveyardRow[];
  /** The active filter; `"risen"` is only meaningful for the gate. */
  activeFilter: PlaceFilter;
  /** The current 0-based plot index (clamped into range before use). */
  plotIndex: number;
  /** The currently selected creature's repo name, or `null`. */
  selectedName: string | null;
  /** Raised when a filter chip is activated. */
  onFilterChange: (filter: PlaceFilter) => void;
  /** Raised with the next 0-based plot index when the pager is activated. */
  onPlotChange: (index: number) => void;
  /** Raised with a repo name when a creature is activated. */
  onSelect: (name: string) => void;
  /** Raised when the return-to-the-gate control is activated. */
  onReturn: () => void;
  /** Names allowed the expensive filter effects (from `pickFilterHeroes`). */
  filterHeroes?: Set<string>;
  /** Whether reduced motion is active (threaded to shared layers). */
  reducedMotion?: boolean;
}

/**
 * Applies the active filter to a place's rows. `"all"` keeps every row;
 * `"risen"` (gate only) keeps the risen rows; a decay word keeps the rows whose
 * existing `decayLevel` equals that word's band index in the place's decay-word
 * array (ghost words for `sky`, zombie words for `gate`, matching only zombie
 * rows). An unknown decay word for the place leaves the set unfiltered. The
 * decay word is read from `decayLevel` — no threshold is recomputed.
 */
function applyFilter(
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

export default function PlaceView({
  place,
  rows,
  activeFilter,
  plotIndex,
  selectedName,
  onFilterChange,
  onPlotChange,
  onSelect,
  onReturn,
  filterHeroes,
}: PlaceViewProps) {
  const meta = PLACES[place];

  // Derivation pipeline: filter → order → paginate. Memoized on the inputs so
  // the plots are recomputed only when the rows/filter actually change.
  const plots = useMemo(() => {
    const filtered = applyFilter(place, rows, activeFilter);
    const ordered = orderForPlace(place, filtered);
    return paginate(ordered, PLOT_SIZE);
  }, [place, rows, activeFilter]);

  // Clamp the incoming plot index into range so a stale/out-of-range value can
  // never index past the plots (Req 8.3). `paginate` always returns ≥ 1 plot.
  const plotCount = plots.length;
  const clampedIndex = Math.min(Math.max(0, plotIndex), plotCount - 1);
  const currentPlot = plots[clampedIndex] ?? [];

  // Plaque count line for the heading. The gate reports its zombies and risen
  // separately via `plaqueCopy("gate", zombieCount, risenCount)`; the other
  // three places report their single population.
  const copy = useMemo(() => {
    if (place === "gate") {
      const counts = summaryCounts(rows);
      return plaqueCopy("gate", counts.zombie, counts.risen);
    }
    return plaqueCopy(place, rows.length);
  }, [place, rows]);

  // Gate-only atmosphere inputs, derived from the gate's own rows (the gate's
  // placeOf-filtered rows include zombie + risen; `summaryCounts.zombie` counts
  // only zombies, which is exactly the fog driver). Both collapse to a benign 0
  // for the other places, but the layers are gate-gated in the render anyway.
  const isGate = place === "gate";
  const zombieCount = isGate ? summaryCounts(rows).zombie : 0;
  const ancientCount = isGate ? ancientZombieCount(rows) : 0;

  // Move focus to the heading on arrival so keyboard/screen-reader users land
  // on the place's name (Req 9.3 / 13.5). Runs once per place entry.
  const headingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [place]);

  return (
    <div
      data-testid="place-view"
      data-place={place}
      className="relative h-dvh w-full overflow-hidden"
      style={{ backgroundColor: "var(--color-night-sky)" }}
    >
      {/* --- Reused backdrop stack (same painted estate as the map). --- */}
      <div className="absolute inset-0 z-0">
        <Sky />
      </div>
      <div className="absolute inset-0 z-0">
        <Backdrop />
      </div>
      <div className="absolute inset-0 z-10">
        <Moon rows={rows} />
      </div>

      {/* --- Gate-only fog: density encodes the gate's zombie count (Req 3.3).
          Placed on a z-30 wrapper under the depth rows and over the backdrop,
          matching the old scene's band order; suppressed for other places. --- */}
      {isGate ? (
        <div className="absolute inset-0 z-30">
          <Fog zombieCount={zombieCount} />
        </div>
      ) : null}

      {/* --- Atmosphere (+ gate-only lightning) in the z-40 band. Lightning
          cadence encodes the gate's ancient-zombie count (Req 3.4/3.5) and
          self-hides at count 0; it renders only for the gate. --- */}
      <div className="absolute inset-0 z-40">
        <Atmosphere />
        {isGate ? <Lightning ancientCount={ancientCount} /> : null}
      </div>

      {/* --- Place chrome: heading + return control (top band). --- */}
      <div className="absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-4 p-6">
        <ReturnToGate onReturn={onReturn} />
        <PlaceHeading ref={headingRef} name={meta.name} copy={copy} />
        {/* Spacer so the heading stays centered between the return control and
            this edge; the real lights/sound chrome rides SceneView's wrapper. */}
        <div aria-hidden className="h-11 w-[160px]" />
      </div>

      {/* --- Filter chips (below the heading). --- */}
      <div className="absolute inset-x-0 top-28 z-40 flex justify-center px-6">
        <FilterChips
          place={place}
          rows={rows}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </div>

      {/* --- Depth rows for the current plot (center stage). --- */}
      <div className="absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center px-6">
        <DepthRows
          plot={currentPlot}
          selectedName={selectedName}
          onSelect={onSelect}
          filterHeroes={filterHeroes}
        />
      </div>

      {/* --- Pager (bottom band). --- */}
      <div className="absolute inset-x-0 bottom-16 z-40 flex justify-center px-6">
        <Pager
          plotIndex={clampedIndex}
          plotCount={plotCount}
          onPlotChange={onPlotChange}
        />
      </div>
    </div>
  );
}
