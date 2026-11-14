import type { ReactNode } from "react";

export interface WorldStageProps {
  /** Stage height in px (`layout.heightPx`). */
  heightPx: number;
  /** Art layers, the creature layer and the near mist, in paint order. */
  children?: ReactNode;
}

/**
 * The tall stage inside the World_Scroller. Relative, no overflow utility:
 * clipping lives on sibling decor wrappers, never on an ancestor of a creature.
 *
 * Requirements: 3.7, 5.2
 */
export function WorldStage({ heightPx, children }: WorldStageProps) {
  return (
    <div
      data-testid="world-stage"
      className="relative w-full"
      // Paint containment clips the parallax bands (which lag or lead by a few
      // px and carry a bottom tail) to the stage, so the scroll ends exactly at
      // the stage bottom with art under it: no empty band, no extra scroll room.
      style={{ height: `${heightPx}px`, contain: "paint" }}
    >
      {children}
    </div>
  );
}

export default WorldStage;
