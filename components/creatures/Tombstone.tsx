"use client";

/**
 * Tombstone creature (client component).
 *
 * A thin wrapper over the shared `Creature` shell for a tombstone row. The
 * tombstone's one looping behavior is the gentle one-shot `tombstone-settle`
 * on mount (Req 6.1 motion table), applied directly via the shell's
 * `animationClassName` (in `app/globals.css` `.tombstone-settle` is applied to
 * the element itself, not a `> child`, so no inner `children` layer is needed).
 *
 * The darkness + tilt treatment derived from `daysQuiet`
 * (`tombstoneTreatment`) is a positional/filter concern the Zone supplies via
 * `style`; this wrapper only owns the settle motion and passes `style`
 * straight through.
 *
 * Requirements: 6.1
 */

import Creature, { type CreatureProps } from "./Creature";

type TombstoneProps = Omit<CreatureProps, "children" | "animationClassName">;

export default function Tombstone({ row, ...rest }: TombstoneProps) {
  return (
    <Creature row={row} animationClassName="tombstone-settle" {...rest} />
  );
}
