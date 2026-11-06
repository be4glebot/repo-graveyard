"use client";

/**
 * One place link on the estate map (client component).
 *
 * A `Place` is a single keyboard-focusable control that opens its place on
 * activation (mouse click or the Enter key, Req 1.5). It paints the place's
 * glowing plaque — the Cinzel place name, the IM Fell italic count line from
 * `plaqueCopy`, and the place's call-to-action — plus the first 2–3
 * representative creatures taken from the head of `orderForPlace(place, rows)`
 * (Req 2.1–2.5). The representatives fall directly out of each place's ordering
 * rule, so no separate representative-picking logic is needed: `sky` surfaces
 * the most urgent ghosts, `gate` the risen then the freshest zombies, and
 * `ground`/`crypt` the newest at rest.
 *
 * An empty place (zero rows) stays visible but quieter: it renders no
 * representatives, shows the place's empty copy on the plaque, and drops to a
 * lower opacity than any populated place (Req 1.6).
 *
 * The creatures are rendered through the same concrete creature components the
 * scene uses (`Ghost`/`Risen`/`Zombie`/`Tombstone`/`Coffin`), keyed off
 * `row.state`. The representatives are decorative inside the place link, so
 * their own button chrome is suppressed with `pointer-events-none` and the
 * group is `aria-hidden` — the place link carries the accessible name and the
 * interaction (Req 1.5).
 *
 * Why a client component: the place is an interactive control that raises
 * selection through a prop callback, so it cannot be a server component.
 *
 * Requirements: 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { type ComponentType, type KeyboardEvent } from "react";

import { type GraveyardRow } from "@/lib/graveyard-view";
import { type LifecycleState } from "@/lib/lifecycle";
import {
  orderForPlace,
  plaqueCopy,
  PLACES,
  type PlaceId,
} from "@/lib/estate-view";

import Ghost from "@/components/creatures/Ghost";
import Risen from "@/components/creatures/Risen";
import Zombie from "@/components/creatures/Zombie";
import Tombstone from "@/components/creatures/Tombstone";
import Coffin from "@/components/creatures/Coffin";

/**
 * Shared prop shape the five concrete creature components expose (identical to
 * the one `Zone` addresses them through). Each composes the `Creature` shell.
 */
interface ConcreteCreatureProps {
  row: GraveyardRow;
  /**
   * Render the creature as a non-interactive, `aria-hidden` decorative element
   * instead of a focusable button. The representatives on a `Place` plaque use
   * this so they do not nest a `<button>` inside the `Place` link's own
   * `<button>` (an invalid-DOM / hydration error); the `Place` stays the single
   * focusable control and owns the accessible name.
   */
  decorative?: boolean;
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

/** Maximum representative creatures shown on a place plaque (Req 2.4). */
const MAX_REPRESENTATIVES = 3;

/** Opacity for a populated place vs. an empty one (Req 1.6). */
const POPULATED_OPACITY = 1;
const EMPTY_OPACITY = 0.45;

export interface PlaceProps {
  /** Which of the four places this link represents. */
  place: PlaceId;
  /** The rows belonging to this place (already `placeOf`-filtered by the map). */
  rows: GraveyardRow[];
  /** Raised with the place id when the link is activated (click / Enter). */
  onEnter: (place: PlaceId) => void;
  /**
   * Extra classes appended to the root `<button>`. The map uses this to carry
   * the per-place absolute positioning (`absolute left-[..] top-[..] z-..`) and
   * `pointer-events-auto`, so each place button is the only clickable element
   * within the otherwise `pointer-events-none` places band.
   */
  className?: string;
}

export default function Place({ place, rows, onEnter, className }: PlaceProps) {
  const meta = PLACES[place];
  const hasRows = rows.length > 0;

  // Representatives are the head of the place's own ordering; the count is
  // min(3, rowCount), so a populated place always shows at least one and an
  // empty place shows none (Req 2.4, 2.5).
  const ordered = orderForPlace(place, rows);
  const representatives = ordered.slice(0, MAX_REPRESENTATIVES);

  // Count line. The gate is the only place that reports two populations: its
  // zombies in the primary count and the risen in a separate clause, so split
  // the place's rows by state. Every other place ignores the risen count.
  const countLine =
    place === "gate"
      ? plaqueCopy(
          "gate",
          rows.filter((row) => row.state === "zombie").length,
          rows.filter((row) => row.state === "risen").length,
        )
      : plaqueCopy(place, rows.length);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    // A native button fires click on Enter already, but handle it explicitly so
    // activation is consistent and raised exactly once (Req 1.5).
    if (event.key === "Enter") {
      event.preventDefault();
      onEnter(place);
    }
  };

  // The accent drives the plaque border/glow token so the gate reads crimson
  // and the other three gold (no hardcoded hex — tokens only).
  const accentColor =
    meta.accent === "crimson"
      ? "var(--color-crimson-400)"
      : "var(--color-candle-400)";
  const accentGlow =
    meta.accent === "crimson"
      ? "var(--color-crimson-glow)"
      : "var(--color-moon-glow-pale)";

  return (
    <button
      type="button"
      data-testid={`estate-place-${place}`}
      data-place={place}
      data-empty={hasRows ? undefined : "true"}
      aria-label={`${meta.name}. ${countLine}. ${meta.cta}`}
      onClick={() => onEnter(place)}
      onKeyDown={handleKeyDown}
      style={{ opacity: hasRows ? POPULATED_OPACITY : EMPTY_OPACITY }}
      className={[
        "group relative flex cursor-pointer flex-col items-center gap-3",
        "border-0 bg-transparent p-0 text-center",
        "transition-[transform,filter] duration-200 ease-out",
        "motion-safe:hover:scale-[1.02] motion-safe:focus-visible:scale-[1.02]",
        "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-candle-400)] focus-visible:ring-offset-0",
        className ?? "",
      ].join(" ")}
    >
      {/* Representatives: decorative inside the place link, so the group is
          aria-hidden and the creature buttons cannot steal focus/clicks. */}
      <span
        aria-hidden
        data-testid={`estate-place-${place}-representatives`}
        className="pointer-events-none flex min-h-[140px] items-end justify-center gap-2"
      >
        {representatives.map((row) => {
          const Creature = CREATURE_BY_STATE[row.state];
          // Decorative: non-interactive and aria-hidden, so the representatives
          // never nest a <button> inside this Place link's <button>.
          return <Creature key={row.name} row={row} decorative />;
        })}
      </span>

      {/* Plaque: Cinzel name, IM Fell italic count line, the place CTA. */}
      <span
        data-testid={`estate-place-${place}-plaque`}
        className="flex w-full max-w-[260px] flex-col items-center gap-1 rounded-md border px-4 py-3"
        style={{
          borderColor: accentColor,
          boxShadow: `0 0 16px ${accentGlow}`,
          backgroundColor: "var(--color-night-sky-mid)",
        }}
      >
        <span
          data-testid={`estate-place-${place}-name`}
          className="font-[family-name:var(--font-heading)] text-lg uppercase tracking-[2px]"
          style={{ color: "var(--color-scene-fg)" }}
        >
          {meta.name}
        </span>
        <span
          data-testid={`estate-place-${place}-count`}
          className="font-[family-name:var(--font-narrative)] text-sm italic leading-snug"
          style={{ color: "var(--color-scene-fg-muted)" }}
        >
          {countLine}
        </span>
        <span
          data-testid={`estate-place-${place}-cta`}
          className="font-[family-name:var(--font-heading)] text-xs uppercase tracking-[1.5px]"
          style={{ color: accentColor }}
        >
          {meta.cta}
        </span>
      </span>
    </button>
  );
}
