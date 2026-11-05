"use client";

/**
 * Coffin creature (client component).
 *
 * A thin wrapper over the shared `Creature` shell for a coffin row. A coffin is
 * a sealed, settled repository: it has no looping decay motion, so this wrapper
 * applies no `animationClassName` and supplies no inner motion `children`. It
 * renders the coffin art through the shell, which still owns the focusable
 * button, accessible name, and selection. The hover/focus lean + glow the shell
 * applies on interaction is the only motion a coffin shows.
 *
 * Requirements: 6.1
 */

import Creature, { type CreatureProps } from "./Creature";

type CoffinProps = Omit<CreatureProps, "children" | "animationClassName">;

export default function Coffin({ row, ...rest }: CoffinProps) {
  return <Creature row={row} {...rest} />;
}
