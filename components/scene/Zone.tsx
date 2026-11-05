"use client";

/**
 * One lifecycle zone of the scene (client component).
 *
 * A zone owns the placement of every creature of a single lifecycle state. It
 * reads its rectangle from the single `ZONE_RECTS` source of truth and
 * absolutely positions itself with percentage bounds, so it scales with the
 * viewport and never overlaps a sibling zone (Req 11.1/11.2). Within the rect
 * it spaces its creatures evenly across the width, caps the visible count via
 * `capZone(rows.length)` (Req 11.3), shrinks each creature via
 * `creatureScale(rows.length)` so a crowded zone still fits (Req 11.6), and
 * rolls the overflow into a single `MoreGroup` "+N more" affordance (Req
 * 11.4/11.5). A zombie zone orders its creatures with `orderZombies` so the
 * lowest-decay (newest) zombie sits nearest the gate (Req 5.3); every other
 * zone keeps the loader's input order.
 *
 * Why a client component: it renders interactive `Creature` buttons and passes
 * selection/hover state through, so it cannot be a server component.
 *
 * The concrete creature components (`Ghost`/`Risen`/`Zombie`/`Tombstone`/
 * `Coffin`, task 14.2) are landing in parallel. This file imports them by their
 * expected paths and keys them off `row.state`; each one composes the shared
 * `Creature` shell.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 5.3
 */

import { type ComponentType, type CSSProperties } from "react";

import { type GraveyardRow } from "@/lib/graveyard-view";
import { type LifecycleState } from "@/lib/lifecycle";
import {
  capZone,
  creatureScale,
  orderZombies,
  ZONE_RECTS,
  type ZoneName,
} from "@/lib/scene-view";

import Ghost from "@/components/creatures/Ghost";
import Risen from "@/components/creatures/Risen";
import Zombie from "@/components/creatures/Zombie";
import Tombstone from "@/components/creatures/Tombstone";
import Coffin from "@/components/creatures/Coffin";

import MoreGroup from "./MoreGroup";

/**
 * Shared prop shape the five concrete creature components expose. Each composes
 * the `Creature` shell (task 14.2) and accepts the same selection / filter /
 * layout props, so the Zone can address them uniformly through one map.
 */
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

export interface ZoneProps {
  /** Which lifecycle zone this is; selects the rect and the creature component. */
  state: ZoneName;
  /** The creatures belonging to this zone (already grouped by the caller). */
  rows: GraveyardRow[];
  /** Raised with a repo name when one of this zone's creatures is activated. */
  onSelect?: (name: string) => void;
  /** The currently selected repo name, if any; marks the matching creature. */
  selectedName?: string;
  /** Names allowed to use the expensive filter effects (from `pickFilterHeroes`). */
  filterHeroes?: Set<string>;
}

/**
 * Evenly spaced left offset (as a percentage of the zone rect width) for the
 * `index`-th of `count` creatures. One creature sits centered; N creatures are
 * distributed across the rect with equal gaps on either side, so the cluster
 * always stays inside the rect regardless of count.
 */
function spacedLeftPercent(index: number, count: number): number {
  if (count <= 1) {
    return 50;
  }
  // Equal gaps: slot centers at (i + 0.5) / count of the rect width. This keeps
  // the first and last creatures a half-slot in from the edges so nothing rides
  // the boundary (Req 11.1/11.2).
  return ((index + 0.5) / count) * 100;
}

export default function Zone({
  state,
  rows,
  onSelect,
  selectedName,
  filterHeroes,
}: ZoneProps) {
  const rect = ZONE_RECTS[state];

  // Zombies are ordered so distance-from-gate is monotonic in decay level
  // (lowest decay nearest the gate); every other zone keeps the loader's input
  // order (Req 5.3).
  const ordered = state === "zombie" ? orderZombies(rows) : rows;

  // Cap the visible creatures; the remainder rolls up into the MoreGroup
  // (Req 11.3). Scale is a function of the *full* zone count so a crowded zone
  // shrinks even the visible dozen (Req 11.6).
  const { rendered, more } = capZone(ordered.length);
  const scale = creatureScale(ordered.length);

  const visible = ordered.slice(0, rendered);
  const overflow = ordered.slice(rendered);

  // Total slots across the rect: the visible creatures plus, when present, one
  // slot for the "+N more" group so the group is spaced in with the cluster.
  const slotCount = visible.length + (more > 0 ? 1 : 0);

  return (
    <div
      aria-hidden={false}
      data-testid={`scene-zone-${state}`}
      className="pointer-events-none absolute"
      style={{
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
      }}
    >
      {visible.map((row, index) => {
        const Creature = CREATURE_BY_STATE[row.state];
        const leftPercent = spacedLeftPercent(index, slotCount);
        return (
          <div
            key={row.name}
            className="pointer-events-auto absolute top-1/2"
            style={{
              left: `${leftPercent}%`,
              transform: `translate(-50%, -50%) scale(${scale})`,
            }}
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

      {more > 0 ? (
        <div
          className="pointer-events-auto absolute top-1/2"
          style={{
            left: `${spacedLeftPercent(visible.length, slotCount)}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <MoreGroup more={more} names={overflow.map((row) => row.name)} />
        </div>
      ) : null}
    </div>
  );
}
