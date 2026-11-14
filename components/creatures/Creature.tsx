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

import { useTheme } from "@/components/scene/ThemeProvider";
import { type GraveyardRow } from "@/lib/graveyard-view";
import { themeArt } from "@/lib/theme-art";
import { type LifecycleState } from "@/lib/lifecycle";
import {
  animationDelay,
  creatureAccessibleName,
  creatureImage,
} from "@/lib/scene-view";

/** Intrinsic pixel box the creature art is drawn into before layout scaling. */
const CREATURE_ART_SIZE = 140;

/**
 * Decorative art box (px), sized per the estate-map canvas: the "at rest"
 * states (tombstone/coffin) read as small ~90px markers, while the active
 * creatures (ghost/risen/zombie) read a touch larger at ~135px. Used only on
 * the decorative path (the estate-map representatives); the interactive path
 * keeps the full `CREATURE_ART_SIZE`.
 */
function decorativeArtSize(state: LifecycleState): number {
  return state === "tombstone" || state === "coffin" ? 90 : 135;
}

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
   * Render as a non-interactive, decorative creature instead of a focusable
   * button. When true the shell renders the SAME art, motion wrapper, and glow
   * inside an `aria-hidden` `<div>` with no accessible name, no `tabIndex`,
   * and no click/key handlers — so it can sit inside another interactive
   * control (e.g. a `Place` link on the estate map) without nesting a
   * `<button>` inside a `<button>` (an invalid-DOM / hydration error). The
   * enclosing control owns the accessible name and the interaction. Defaults to
   * `false` (the normal interactive creature).
   */
  decorative?: boolean;
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
  /** Hover-card intents (interactive path only). Anchor is the button. */
  onHoverStart?: (name: string, anchor: HTMLElement) => void;
  onHoverEnd?: (name: string) => void;
  onFocusStart?: (name: string, anchor: HTMLElement) => void;
  onBlurEnd?: (name: string) => void;
  /** DOM id of the hover tooltip, referenced via `aria-describedby`. */
  hoverCardId?: string;
  /** World mode: art box in px, overriding the default. Absent = unchanged. */
  size?: number;
  /** World mode: a `CreatureTag` mounted inside the button (absolute, no layout). */
  tag?: ReactNode;
  /** World mode: a `CreatureShadow` mounted under the feet (absolute, no layout). */
  shadow?: ReactNode;
  /** World mode: flip the ART only (never the tag or shadow). */
  mirror?: boolean;
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
  decorative = false,
  children,
  animationClassName,
  style,
  onHoverStart,
  onHoverEnd,
  onFocusStart,
  onBlurEnd,
  hoverCardId,
  size,
  tag,
  shadow,
  mirror,
}: CreatureProps) {
  const { theme } = useTheme();
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

  // The art + per-decay motion wrapper is identical in both modes; only the
  // enclosing element (interactive button vs. decorative div) differs, and the
  // decorative path draws a smaller box so the estate-map representatives read
  // as the small markers the canvas calls for (tombstones/coffins smallest).
  const artSize =
    size ?? (decorative ? decorativeArtSize(row.state) : CREATURE_ART_SIZE);
  const inner = (
    <span
      className={animationClassName}
      style={{
        animationDelay: `${delaySeconds}s`,
        ...(mirror ? { transform: "scaleX(-1)" } : null),
      }}
    >
      <Image
        src={themeArt(theme, `/art/${basename}.webp`)}
        alt=""
        aria-hidden
        width={artSize}
        height={artSize}
        draggable={false}
        className="pointer-events-none select-none"
      />
      {children}
    </span>
  );

  // Decorative mode: same art, motion, and glow, but NON-interactive. It is an
  // `aria-hidden` `<div>` with no accessible name, no `tabIndex`, and no
  // click/key handlers, so it never takes focus and never nests a `<button>`
  // inside an enclosing interactive control (e.g. a `Place` link). The glow is
  // kept as a group-hover/focus-within effect so the creature still lifts when
  // the surrounding control is hovered/focused, but it is never a tab stop.
  if (decorative) {
    return (
      <div
        aria-hidden="true"
        data-decorative="true"
        data-name={row.name}
        style={style}
        className={[
          "group relative border-0 bg-transparent p-0",
          "pointer-events-none",
          "transition-[transform,filter] duration-200 ease-out",
        ].join(" ")}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={accessibleName}
      aria-pressed={selected}
      aria-describedby={hoverCardId}
      onPointerEnter={
        onHoverStart ? (e) => onHoverStart(row.name, e.currentTarget) : undefined
      }
      onPointerLeave={onHoverEnd ? () => onHoverEnd(row.name) : undefined}
      onFocus={
        onFocusStart ? (e) => onFocusStart(row.name, e.currentTarget) : undefined
      }
      onBlur={onBlurEnd ? () => onBlurEnd(row.name) : undefined}
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
      {shadow}
      {inner}
      {tag}
    </button>
  );
}
