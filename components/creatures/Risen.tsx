"use client";

/**
 * Risen creature (client component).
 *
 * A thin wrapper over the shared `Creature` shell for a risen row. The risen
 * has a single motion variant — a cyan opacity pulse (Req 6.7) — driven by the
 * `risen-pulse` keyframe class. In `app/globals.css` `.risen-pulse` is applied
 * directly (it is not a `> child` selector), so it is passed as the wrapper's
 * `animationClassName` with no inner `children` layer.
 *
 * Requirements: 6.7
 */

import Creature, { type CreatureProps } from "./Creature";

type RisenProps = Omit<CreatureProps, "children" | "animationClassName">;

export default function Risen({ row, ...rest }: RisenProps) {
  return <Creature row={row} animationClassName="risen-pulse" {...rest} />;
}
