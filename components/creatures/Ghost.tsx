"use client";

/**
 * Ghost creature (client component).
 *
 * A thin wrapper over the shared `Creature` shell that selects the per-decay
 * motion variant for a ghost row (decay band 0–3, Req 6.1–6.4). It maps the
 * row's decay level to the matching `app/globals.css` keyframe class applied on
 * the shell's staggered wrapper, and supplies the per-decay inner motion layers
 * through the shell's `children` slot:
 *
 *   decay 0 → `ghost-decay-0` wrapper + `ghost-breathe` inner layer
 *             (+ `ghost-ripple` shroud layer, hero-gated)
 *   decay 1 → `ghost-decay-1` wrapper + `ghost-lung` inner layer
 *   decay 2 → `ghost-decay-2` wrapper (no inner layer)
 *   decay 3 → `ghost-decay-3` wrapper
 *             (+ `ghost-glitch` red/cyan split layer, hero-gated)
 *
 * The expensive filter layers (the decay-0 shroud ripple and the decay-3
 * red/cyan split glitch) are GATED behind `filterHero`: they render only when
 * this ghost is one of the at-most-four filter heroes the Zone/Scene picks via
 * `pickFilterHeroes` (Req 6.9). The CSS nests `.ghost-decay-0 > .ghost-breathe`
 * and `.ghost-decay-1 > .ghost-lung`, so the inner layers are passed as direct
 * children of the wrapper the shell applies the decay class to.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.9
 */

import Creature, { type CreatureProps } from "./Creature";

/** Props a concrete creature accepts: the shell's interactive props, minus the
 * shell-owned `children` / `animationClassName` which this wrapper supplies. */
type GhostProps = Omit<CreatureProps, "children" | "animationClassName">;

/** Highest valid ghost decay band (Req 6.1–6.4). */
const GHOST_DECAY_MAX = 3;

/**
 * Clamp a (possibly null / out-of-band) decay level into the ghost band [0, 3].
 * Mirrors the defensive clamping `creatureImage` uses so the motion variant and
 * the chosen art always agree; null / non-finite collapses to 0.
 */
function clampGhostDecay(value: number | null): 0 | 1 | 2 | 3 {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }
  const level = Math.trunc(value);
  if (level <= 0) {
    return 0;
  }
  if (level >= GHOST_DECAY_MAX) {
    return GHOST_DECAY_MAX;
  }
  return level as 1 | 2;
}

export default function Ghost({ row, filterHero = false, ...rest }: GhostProps) {
  const decay = clampGhostDecay(row.decayLevel);

  // Per-decay wrapper class + inner motion layers. The inner layers are direct
  // children of the wrapper so the nested CSS selectors
  // (`.ghost-decay-0 > .ghost-breathe`, `.ghost-decay-1 > .ghost-lung`) match.
  // The filter layers are only rendered when this ghost is a filter hero.
  switch (decay) {
    case 0:
      return (
        <Creature
          row={row}
          filterHero={filterHero}
          animationClassName="ghost-decay-0"
          {...rest}
        >
          <span className="ghost-breathe" aria-hidden />
          {filterHero ? <span className="ghost-ripple" aria-hidden /> : null}
        </Creature>
      );
    case 1:
      return (
        <Creature
          row={row}
          filterHero={filterHero}
          animationClassName="ghost-decay-1"
          {...rest}
        >
          <span className="ghost-lung" aria-hidden />
        </Creature>
      );
    case 2:
      return (
        <Creature
          row={row}
          filterHero={filterHero}
          animationClassName="ghost-decay-2"
          {...rest}
        />
      );
    case 3:
      return (
        <Creature
          row={row}
          filterHero={filterHero}
          animationClassName="ghost-decay-3"
          {...rest}
        >
          {filterHero ? <span className="ghost-glitch" aria-hidden /> : null}
        </Creature>
      );
  }
}
