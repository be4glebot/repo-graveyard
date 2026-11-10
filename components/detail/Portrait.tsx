"use client";

/**
 * Decorative portrait of the open repo's creature (Req 10.2, 17.2).
 *
 * Reuses the shared `Creature` shell in `decorative` mode: aria-hidden, no
 * button, no tab stop. While the séance ritual runs the creature carries the
 * ritual surge class (ghosts drift, everything else twitches); under reduced
 * motion the global rules stop that animation.
 */

import Creature from "@/components/creatures/Creature";
import { ritualSurgeClass } from "@/components/seance/Ritual";
import type { LifecycleState } from "@/lib/lifecycle";

export interface PortraitProps {
  name: string;
  state: LifecycleState;
  decayLevel: number | null;
  /** True while the séance ritual is running. */
  ritual?: boolean;
}

export default function Portrait({
  name,
  state,
  decayLevel,
  ritual = false,
}: PortraitProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="detail-portrait"
      className="flex justify-center px-4 pt-1"
    >
      <Creature
        decorative
        row={{ name, url: "", state, daysQuiet: 0, decayLevel }}
        animationClassName={ritual ? ritualSurgeClass(state) : undefined}
      />
    </div>
  );
}
