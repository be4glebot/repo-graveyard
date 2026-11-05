"use client";

/**
 * Shared creature shell (client component).
 *
 * Every creature in the scene — ghost, risen, zombie, tombstone, coffin — is
 * rendered through this one shell so the accessibility contract and the
 * interaction model live in a single place. The five concrete creature
 * components (task 14.2) compose this shell: each one picks its art via
 * `creatureImage(state, decayLevel)`, wraps the per-decay motion layers in
 * `children`, and lets this shell own the focusable button, the accessible
 * name, the deterministic stagger, and selection.
 *
 * Why a client component: the shell handles pointer and keyboard interaction
 * (click / Enter / Space) and raises selection, so it cannot be a server
 * component.
 *
 * Art path convention: `creatureImage` returns a `CreatureBasename` (e.g.
 * `ghost-2`, `tomb-arch-fresh`, `coffin`) and the painted assets live in
 * `public/art/<basename>.webp` (see the existing files under `public/art`), so
 * the image src is `/art/${basename}.webp`.
 *
 * Requirements: 4.1, 6.8, 9.1, 9.2, 9.3, 9.4
 */

import Image from "next/image";
import {
  useCallback,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { type GraveyardRow } from "@/lib/graveyard-view";
import {
  animationDelay,
  creatureAccessibleName,
  creatureImage,
} from "@/lib/scene-view";

/** Intrinsic pixel box the creature art is drawn into before layout scaling. */
const CREATURE_ART_SIZE = 140;

export interface CreatureProps {
  /** The classified repository this creature represents. */
  row: GraveyardRow;
  /** Raised with `row.name` when the creature is activated (click / Enter / Space). */
  onSelect?: (name: string) => void;
  /** Whether this creature is the currently selected one. Reflected via `aria-pressed`. */
  selected?: boolean;
  /**
   * Whether this creature is allowed to use the expensive filter effects
   * (ghost shroud ripple, ghost red/cyan split glitch). The Zone/Scene decides
   * the heroes via `pickFilterHeroes`; concrete creatures read this to gate
   * their filter layers. The shell only carries it through.
   */
  filterHero?: boolean;
  /**
   * Per-creature animated inner layers supplied by the concrete creature
   * component (e.g. the breathing/ripple layers for a decay-0 ghost). They sit
   * on top of the base image inside the staggered animation wrapper.
   */
  children?: ReactNode;
  /**
   * Optional motion utility class (from `app/globals.css`, e.g. `ghost-decay-0`
   * or `zombie-lurch-1`) applied to the staggered wrapper. The concrete
   * creature chooses it; the shell applies the deterministic delay to it.
   */
  animationClassName?: string;
  /** Layout positioning supplied by the Zone (absolute placement, scale, etc.). */
  style?: CSSProperties;
}

/**
 * Focusable `<button>` shell for a single creature. Renders the state's art via
 * `creatureImage`, applies the deterministic `animationDelay(row.name)` stagger
 * so no two creatures in a zone start their cycle together (Req 6.8), exposes
 * `creatureAccessibleName(row)` as the accessible name (Req 9.1/9.2), and
 * raises selection on click and on Enter/Space (Space prevents the default page
 * scroll). A `candle-400` focus ring marks the focused creature (Req 9.4).
 */
export default function Creature({
  row,
  onSelect,
  selected = false,
  children,
  animationClassName,
  style,
}: CreatureProps) {
  const basename = creatureImage(row.state, row.decayLevel);
  const accessibleName = creatureAccessibleName(row);
  // Deterministic, name-stable stagger in seconds (Req 6.8).
  const delaySeconds = animationDelay(row.name);

  const activate = useCallback(() => {
    onSelect?.(row.name);
  }, [onSelect, row.name]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      // A native button already fires click on Enter/Space, but we handle the
      // keys explicitly so selection is raised consistently and Space never
      // scrolls the page out from under the scene (Req 9 interaction).
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        activate();
      }
    },
    [activate],
  );

  return (
    <button
      type="button"
      aria-label={accessibleName}
      aria-pressed={selected}
      data-selected={selected ? "true" : undefined}
      onClick={activate}
      onKeyDown={handleKeyDown}
      style={style}
      className={[
        // Reset the native button chrome; the creature art is the visual.
        "group relative cursor-pointer border-0 bg-transparent p-0",
        // Hover/focus lean + glow transition, kept fast (<=200ms) and
        // translation-free so it satisfies Req 9.3. Concrete creatures layer
        // their own motion on the inner wrapper.
        "transition-[transform,filter] duration-200 ease-out",
        "motion-safe:hover:rotate-2 motion-safe:focus-visible:rotate-2",
        "hover:drop-shadow-[0_0_12px_var(--color-candle-400)] focus-visible:drop-shadow-[0_0_12px_var(--color-candle-400)]",
        // Candle-400 focus ring, >=2px, continuously visible while focused
        // (Req 9.4). No hardcoded hex — the ring color is the candle token.
        "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-candle-400)] focus-visible:ring-offset-0",
      ].join(" ")}
    >
      <span
        className={animationClassName}
        style={{ animationDelay: `${delaySeconds}s` }}
      >
        <Image
          src={`/art/${basename}.webp`}
          alt=""
          aria-hidden
          width={CREATURE_ART_SIZE}
          height={CREATURE_ART_SIZE}
          draggable={false}
          className="pointer-events-none select-none"
        />
        {children}
      </span>
    </button>
  );
}
