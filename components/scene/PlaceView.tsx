"use client";

/**
 * Place view dispatcher (client component).
 *
 * Hooks cannot be branched, so `PlaceView` only chooses which stage to mount.
 * Places listed in `WORLD_PLACES` render the explorable world; every other
 * place renders the original stage, `GatePlaceView` (the former `PlaceView`
 * body, moved unchanged). `WORLD_PLACES` currently holds `sky`, `ground` and `crypt`.
 *
 * Requirements: 1.8, 17.3, 17.13
 */

import GatePlaceView, {
  type PlaceViewProps,
} from "@/components/scene/GatePlaceView";
import WorldPlaceView from "@/components/world/WorldPlaceView";
import type { PlaceId } from "@/lib/estate-view";

export type { PlaceViewProps };
export type { RevealRequest } from "@/components/scene/GatePlaceView";

/** Places that render the explorable world. Each place is added as it is switched. */
export const WORLD_PLACES: ReadonlySet<PlaceId> = new Set<PlaceId>([
  "sky",
  "ground",
  "crypt",
]);

export default function PlaceView(props: PlaceViewProps) {
  const { place } = props;
  if (place !== "gate" && WORLD_PLACES.has(place)) {
    return <WorldPlaceView {...props} place={place} />;
  }
  return <GatePlaceView {...props} />;
}
