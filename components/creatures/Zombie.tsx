"use client";

/**
 * Zombie creature (client component).
 *
 * A thin wrapper over the shared `Creature` shell that selects the per-decay
 * motion variant for a zombie row (decay band 0–4, Req 6.5–6.6). Decay 0–2
 * lurch in place with progressively longer cycles; decay 3–4 stay mostly still
 * with a sudden twitch. The wrapper maps the row's decay level to the matching
 * `app/globals.css` keyframe class applied on the shell's staggered wrapper:
 *
 *   decay 0 → `zombie-lurch-0`
 *   decay 1 → `zombie-lurch-1`
 *   decay 2 → `zombie-lurch-2`
 *   decay 3 → `zombie-twitch-3`
 *   decay 4 → `zombie-twitch-4`
 *
 * Zombie motion is transform-only and uses no hero-gated filter layer, so no
 * inner `children` are needed — the shell renders the art alone.
 *
 * Requirements: 6.5, 6.6
 */

import Creature, { type CreatureProps } from "./Creature";

type ZombieProps = Omit<CreatureProps, "children" | "animationClassName">;

/** Highest valid zombie decay band (Req 6.5–6.6). */
const ZOMBIE_DECAY_MAX = 4;

/** Zombie decay level → motion utility class (from `app/globals.css`). */
const ZOMBIE_MOTION_CLASS: readonly string[] = [
  "zombie-lurch-0",
  "zombie-lurch-1",
  "zombie-lurch-2",
  "zombie-twitch-3",
  "zombie-twitch-4",
];

/**
 * Clamp a (possibly null / out-of-band) decay level into the zombie band
 * [0, 4]. Mirrors `creatureImage`'s defensive clamping so the motion variant
 * and the chosen art always agree; null / non-finite collapses to 0.
 */
function clampZombieDecay(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }
  const level = Math.trunc(value);
  if (level <= 0) {
    return 0;
  }
  if (level >= ZOMBIE_DECAY_MAX) {
    return ZOMBIE_DECAY_MAX;
  }
  return level;
}

export default function Zombie({ row, ...rest }: ZombieProps) {
  const decay = clampZombieDecay(row.decayLevel);
  return (
    <Creature
      row={row}
      animationClassName={ZOMBIE_MOTION_CLASS[decay]}
      {...rest}
    />
  );
}
