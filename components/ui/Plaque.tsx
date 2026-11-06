/**
 * Creature name plaque (presentational).
 *
 * Renders the boards' `.plq` bevelled-iron slab — exactly one Cinzel name line
 * (`.plq b`) and exactly one monospace sub-line (`.plq i`) — for a single
 * creature (Req 7.4). It is the `DepthScatter` plaque-layer unit: one `Plaque`
 * sits above every creature (CHANGE 4), and because a plaque is never mirrored
 * even when its creature image is flipped, names always read left-to-right.
 *
 * Fixed width (CHANGE 4): the plaque never grows wider than `PLAQUE_W`, the
 * single source of truth shared with the scatter layout's no-overlap rectangle
 * (`lib/estate-view.ts`). A long name does not widen the slab — the name line
 * clips with an ellipsis (`white-space: nowrap` + `overflow: hidden` +
 * `text-overflow: ellipsis`). The full, untruncated name is always exposed via
 * both the `title` attribute (pointer hover tooltip) and `aria-label` (so
 * assistive tech reads the whole name even when it is visually clipped).
 *
 * An optional `scale` multiplies the plaque's rendered size (and, in lockstep,
 * its max width) so a plaque tracks the depth-row scale of the creature it
 * labels while still honoring the fixed `PLAQUE_W` cap at `scale` 1.
 *
 * Pure and side-effect free: no clock, no DOM reads, no state. Shareable by
 * server and client code.
 *
 * Requirements: 7.4, 5.11
 */

import { PLAQUE_W } from "@/lib/estate-view";

export interface PlaqueProps {
  /** The creature's full name (shown on the Cinzel name line, may ellipsize). */
  name: string;
  /** The monospace sub-line beneath the name (e.g. a decay word / fact). */
  sub: string;
  /** Optional render scale; multiplies size and the fixed max width. Default 1. */
  scale?: number;
}

export default function Plaque({ name, sub, scale = 1 }: PlaqueProps) {
  // A non-finite or non-positive scale collapses to 1 so the plaque is always
  // laid out at a sensible, well-defined size.
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  // PLAQUE_W is the single source of truth for the fixed max width (Req 7.4);
  // the plaque never renders wider than this at scale 1, so the scatter
  // no-overlap guarantee derived from PLAQUE_W holds for any name length.
  const maxWidth = PLAQUE_W * s;

  return (
    <span
      className="plq"
      data-testid="plaque"
      style={{ maxWidth: `${maxWidth}px` }}
    >
      {/* Exactly one Cinzel name line. It ellipsizes rather than widening the
          slab; the full name stays available via title + aria-label so it is
          never lost visually or to assistive tech. The name is never mirrored
          even when the labelled creature image is flipped. */}
      <b
        data-testid="plaque-name"
        title={name}
        aria-label={name}
        style={{
          display: "block",
          maxWidth: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </b>
      {/* Exactly one monospace sub-line. */}
      <i data-testid="plaque-sub">{sub}</i>
    </span>
  );
}
