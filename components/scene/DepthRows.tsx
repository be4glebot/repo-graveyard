"use client";

/**
 * Depth rows (client component).
 *
 * Lays the current plot's creatures out across up to three rows of depth so a
 * crowded plot stays legible (Req 5.1). The front row is the largest and
 * brightest; each further-back row is drawn at a scale no larger and a
 * brightness no greater than the row in front of it (Req 5.2). Per the mock
 * (`PlaceBeyondGate.dc.html`) the nearest (front) row holds the freshest /
 * most-relevant creatures, so the plot's leading items — already ordered by
 * `orderForPlace` in `PlaceView` — fill the front row first.
 *
 * Per-row creature sizing reuses the existing `creatureScale` helper (Req 5.3):
 * each row's scale is `creatureScale` evaluated at a count that grows for the
 * further-back rows, so the returned scale is monotonically non-increasing from
 * front to back. Brightness steps down by a fixed factor per row behind the
 * front.
 *
 * Every creature in the plot is rendered individually — there is no "+N more"
 * collapse and no cap-driven omission inside a place (Req 5.5); pagination
 * (`PLOT_SIZE`) already bounds the plot to at most 12 creatures.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */

import { type ComponentType, type CSSProperties } from "react";

import { type GraveyardRow } from "@/lib/graveyard-view";
import { type LifecycleState } from "@/lib/lifecycle";
import { creatureScale, ZONE_CAP } from "@/lib/scene-view";
import { DEPTH_ROWS } from "@/lib/estate-view";

import Ghost from "@/components/creatures/Ghost";
import Risen from "@/components/creatures/Risen";
import Zombie from "@/components/creatures/Zombie";
import Tombstone from "@/components/creatures/Tombstone";
import Coffin from "@/components/creatures/Coffin";

/** Shared prop shape the five concrete creature components expose. */
interface ConcreteCreatureProps {
  row: GraveyardRow;
  onSelect?: (name: string) => void;
  selected?: boolean;
  filterHero?: boolean;
  style?: CSSProperties;
}

/** Maps a lifecycle state to the concrete creature component that renders it. */
const CREATURE_BY_STATE: Record<
  LifecycleState,
  ComponentType<ConcreteCreatureProps>
> = {
  ghost: Ghost,
  risen: Risen,
  zombie: Zombie,
  tombstone: Tombstone,
  coffin: Coffin,
};

/** Brightness of the front (nearest) row. */
const FRONT_ROW_BRIGHTNESS = 1;

/** Brightness removed per row stepped back from the front. */
const BRIGHTNESS_STEP = 0.22;

/** Floor on a row's brightness so the back row never goes fully dark. */
const MIN_ROW_BRIGHTNESS = 0.55;

export interface DepthRowsProps {
  /** The current plot's creatures, pre-ordered by `orderForPlace`. */
  plot: GraveyardRow[];
  /** The currently selected creature's repo name, or `null`. */
  selectedName: string | null;
  /** Raised with a repo name when a creature is activated. */
  onSelect: (name: string) => void;
  /** Names allowed the expensive filter effects (from `pickFilterHeroes`). */
  filterHeroes?: Set<string>;
}

/**
 * Splits `plot` into at most `DEPTH_ROWS` contiguous rows. The front row (first
 * in the returned array) takes the leading, most-relevant creatures; remaining
 * creatures fill the rows behind it. Rows are sized so the front holds at least
 * as many as the rows behind, which (with `creatureScale` keyed off a per-row
 * count that grows toward the back) keeps scale non-increasing front-to-back.
 * An empty plot yields no rows.
 */
function splitIntoRows(plot: GraveyardRow[]): GraveyardRow[][] {
  if (plot.length === 0) {
    return [];
  }
  const rowCount = Math.min(DEPTH_ROWS, plot.length);
  // Ceil-sized front-loaded chunks: the front row is never smaller than a row
  // behind it, so the front stays the densest and the split is contiguous.
  const perRow = Math.ceil(plot.length / rowCount);
  const rows: GraveyardRow[][] = [];
  for (let i = 0; i < plot.length; i += perRow) {
    rows.push(plot.slice(i, i + perRow));
  }
  return rows;
}

export default function DepthRows({
  plot,
  selectedName,
  onSelect,
  filterHeroes,
}: DepthRowsProps) {
  const rows = splitIntoRows(plot);

  return (
    <div
      data-testid="depth-rows"
      className="flex w-full flex-col items-center gap-8"
    >
      {/* Render back-to-front so the nearer (front) rows paint over the
          further ones, matching the mock's stacking. `rows[0]` is the front
          row; iterate it last. */}
      {rows
        .map((rowCreatures, rowIndex) => ({ rowCreatures, rowIndex }))
        .reverse()
        .map(({ rowCreatures, rowIndex }) => {
          // Per-row scale from the reused `creatureScale`. Keying it off a count
          // that grows for the further-back rows (front row keyed at the cap so
          // it stays full-size, each back row keyed higher) makes the returned
          // scale monotonically non-increasing front-to-back (Req 5.2, 5.3).
          const scale = creatureScale(ZONE_CAP + rowIndex * ZONE_CAP);
          // Brightness steps down per row behind the front, floored so the back
          // row stays visible (Req 5.2).
          const brightness = Math.max(
            MIN_ROW_BRIGHTNESS,
            FRONT_ROW_BRIGHTNESS - rowIndex * BRIGHTNESS_STEP,
          );
          return (
            <div
              key={rowIndex}
              data-testid={`depth-row-${rowIndex}`}
              data-row-scale={scale.toFixed(4)}
              data-row-brightness={brightness.toFixed(4)}
              className="flex flex-wrap items-end justify-center gap-10"
              style={{ filter: `brightness(${brightness})` }}
            >
              {rowCreatures.map((row) => {
                const Creature = CREATURE_BY_STATE[row.state];
                return (
                  <div
                    key={row.name}
                    className="flex flex-col items-center gap-1"
                    style={{ transform: `scale(${scale})` }}
                  >
                    <Creature
                      row={row}
                      onSelect={onSelect}
                      selected={row.name === selectedName}
                      filterHero={filterHeroes?.has(row.name) ?? false}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}
