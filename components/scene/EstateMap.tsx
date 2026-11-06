"use client";

/**
 * The estate map: the default view of the estate (client component).
 *
 * `EstateMap` composites the reused painted stack — `Backdrop`, `Sky`, `Moon`,
 * `Atmosphere` — exactly as `Scene` does, then renders the reused `TurningSoon`
 * notice (only when `pickTurningSoon` named a ghost, Req 1.3/1.4) and the four
 * `Place` links in the fixed display order sky, gate, ground, crypt (Req 1.2).
 * Each `Place` is a single keyboard-focusable link that opens its place through
 * `onEnterPlace` (Req 1.5); an empty place stays visible but quieter (Req 1.6,
 * handled inside `Place`).
 *
 * The map also carries the data-encoding atmosphere layers over the WHOLE
 * estate, exactly as the old `Scene` did (design.md's "every effect encodes
 * data" rule): `Fog` (density = zombie count across the estate, Req 3.3),
 * `Lightning` (flash cadence = ancient-zombie count, Req 3.4/3.5), and the
 * `Whisper` region (data-driven narrative lines, Req 8.x). These are derived
 * from the FULL `rows` and placed in the old scene's band order — fog on a
 * z-30 wrapper (over the place links, under the atmosphere), lightning in the
 * z-40 atmosphere band alongside `Atmosphere`, and whispers in the z-40 chrome
 * band near the turning-soon notice. The whisper strings are precomputed by
 * `SceneView` via `composeWhispers(rows, repos, renderedAt)` and passed in as
 * `whispers`, so the map reads no clock. `Fog` is motion-agnostic and
 * `Lightning`/`Whisper` read `prefers-reduced-motion` themselves, so none takes
 * a `reducedMotion` prop.
 *
 * The map owns no data derivation beyond the cheap, pure grouping it needs to
 * hand each `Place` only the rows that belong to it: it groups the classified
 * `rows` by `placeOf`, so every row lands under exactly one place and the four
 * place groups partition the input (Req 3.7). Clock-dependent values
 * (`turningSoon`) are precomputed by `SceneView` and threaded in, so this
 * component reads no clock — mirroring the `Scene`/`SceneView` seam.
 *
 * The header/footer chrome and the parallax wiring are threaded by `SceneView`
 * in later integration (tasks 13/14); this task delivers the map surface and
 * the four place links over the reused backdrop stack.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import Atmosphere from "@/components/scene/Atmosphere";
import Backdrop from "@/components/scene/Backdrop";
import Fog from "@/components/scene/Fog";
import Lightning from "@/components/scene/Lightning";
import Moon from "@/components/scene/Moon";
import Sky from "@/components/scene/Sky";
import TurningSoon from "@/components/scene/TurningSoon";
import Whisper from "@/components/scene/Whisper";
import Place from "@/components/scene/Place";

import { type GraveyardRow } from "@/lib/graveyard-view";
import { placeOf, PLACE_ORDER, type PlaceId } from "@/lib/estate-view";
import {
  ancientZombieCount,
  summaryCounts,
  type TurningSoon as TurningSoonResult,
} from "@/lib/scene-view";

/** Map render modes; carried for parity with the scene chrome. */
export type EstateMapMode = "live" | "estate";

export interface EstateMapProps {
  /** The classified rows; grouped by `placeOf` to feed each place. */
  rows: GraveyardRow[];
  /** The graveyard owner's username (chrome, threaded by SceneView later). */
  username: string;
  /** Live graveyard vs the bundled sample estate. */
  mode: EstateMapMode;
  /**
   * Precomputed turning-soon selection (`pickTurningSoon(...)` in SceneView),
   * or `null` when no ghost qualifies. The notice renders iff this is non-null
   * (Req 1.3/1.4). Passed precomputed so the map reads no clock.
   */
  turningSoon: TurningSoonResult | null;
  /**
   * Precomputed, ordered whisper strings from `composeWhispers(rows, repos,
   * renderedAt)` in `SceneView`. Passed in precomputed (rather than raw
   * rows/repos/now) so the map — and the `Whisper` component it renders — reads
   * no clock. Empty when no qualifying data exists (renders nothing).
   */
  whispers: string[];
  /**
   * Opens the given place: SceneView runs the travel transition and the
   * client-only `history.pushState` (Req 1.5). Called by each `Place` on
   * activation.
   */
  onEnterPlace: (place: PlaceId) => void;
  /**
   * Activates the turning-soon notice's "Go to it" action (estate-map Req
   * 12.1–12.5): raised with the turning-soon ghost's repo name so SceneView can
   * jump into The Restless Sky on the exact plot holding that ghost, with it
   * selected and the filter cleared to "all". Optional so the map still renders
   * the notice (which itself only renders when a ghost qualifies, Req 12.6)
   * even if a caller omits the jump wiring.
   */
  onGoToTurningSoon?: (name: string) => void;
  /** Whether reduced motion is active (threaded for parity; unused here yet). */
  reducedMotion: boolean;
}

/**
 * Per-place absolute position classes, matching `EstateMap.dc.html`'s board
 * arrangement (a ~1440x900 canvas). Each entry positions the place's root
 * `<button>` absolutely and gives the gate a higher stacking context so it
 * reads in front of the others. The canvas pixel coords map to % of the board:
 *
 *   sky    `left:44%; top:168px` → `left-[44%] top-[18%]`   (top-centre)
 *   ground `left:14%; top:420px` → `left-[14%] top-[46%]`   (left, above fence)
 *   crypt  `left:72%; top:400px` → `left-[72%] top-[44%]`   (right, mausoleum)
 *   gate   `left:38%; top:610px` → `left-[38%] top-[66%]`   (bottom-centre, front)
 *
 * The lower band sits at z-20; the gate rides z-30 so it overlaps cleanly.
 */
const PLACE_POSITIONS: Record<PlaceId, string> = {
  sky: "absolute left-[44%] top-[18%] z-20",
  ground: "absolute left-[14%] top-[46%] z-20",
  crypt: "absolute left-[72%] top-[44%] z-20",
  gate: "absolute left-[38%] top-[66%] z-30",
};

/**
 * Groups rows by `placeOf` into the four place buckets. Every place key is
 * present (possibly empty) so an empty place still renders (Req 1.6), and the
 * input order is preserved within each bucket for stable per-place ordering.
 */
function groupByPlace(rows: GraveyardRow[]): Record<PlaceId, GraveyardRow[]> {
  const grouped: Record<PlaceId, GraveyardRow[]> = {
    sky: [],
    gate: [],
    ground: [],
    crypt: [],
  };
  for (const row of rows) {
    grouped[placeOf(row)].push(row);
  }
  return grouped;
}

export default function EstateMap({
  rows,
  mode,
  turningSoon,
  whispers,
  onEnterPlace,
  onGoToTurningSoon,
}: EstateMapProps) {
  const grouped = groupByPlace(rows);

  // Data-encoding inputs derived from the FULL estate rows (pure reads, same as
  // the old Scene): fog density tracks the zombie population and lightning
  // cadence tracks the ancient-zombie population.
  const zombieCount = summaryCounts(rows).zombie;
  const ancientCount = ancientZombieCount(rows);

  return (
    <div
      data-testid="estate-map"
      data-mode={mode}
      className="relative h-dvh w-full overflow-hidden"
      style={{ backgroundColor: "var(--color-night-sky)" }}
    >
      {/* --- Reused painted stack, same back-to-front order as Scene. These are
          decorative full-cover layers, so each is `pointer-events-none` — only
          the real controls (the place buttons, the chrome) take clicks. --- */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <Sky />
      </div>
      <div className="pointer-events-none absolute inset-0 z-0">
        <Backdrop />
      </div>
      <div className="pointer-events-none absolute inset-0 z-10">
        <Moon rows={rows} />
      </div>

      {/* --- Band: fog over the place links, matching the old scene's z-30
          intent (density encodes the estate's zombie count, Req 3.3). `Fog`
          is itself inset-0 absolute, so it rides this full-bleed z-30 wrapper
          placed over the Moon/Backdrop stack and under the z-40 atmosphere.
          Decorative, so `pointer-events-none` — otherwise it would swallow the
          clicks meant for the place buttons beneath it. --- */}
      <div className="pointer-events-none absolute inset-0 z-30">
        <Fog zombieCount={zombieCount} />
      </div>

      {/* --- Band: atmosphere + lightning, over everything but the chrome
          (lightning cadence encodes the ancient-zombie count, Req 3.4/3.5).
          `Lightning` is inset-0 absolute and self-hides at ancient count 0.
          This z-40 layer sits above the places band, so it MUST be
          `pointer-events-none` or it swallows every click on the map. --- */}
      <div className="pointer-events-none absolute inset-0 z-40">
        <Atmosphere />
        <Lightning ancientCount={ancientCount} />
      </div>

      {/* --- Band: whisper chrome, a bottom-ish centered pointer-events-none
          region matching the old scene (role=status, so it never collides with
          the interactive chrome). Renders nothing when `whispers` is empty. --- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[16%] z-40 flex justify-center px-6 text-center">
        <Whisper whispers={whispers} />
      </div>

      {/* --- Map heading: a programmatic focus target (`tabIndex={-1}`) so
          returning from a place can move focus back to the map when the
          originating place link cannot be found (Req 13.7). Rendered `sr-only`
          so it carries the map's accessible name and stays focusable in the
          a11y tree WITHOUT painting a visible title that overlaps the summary /
          turning-soon chrome (the painted board has no "THE ESTATE" title). --- */}
      <h1 data-testid="map-heading" tabIndex={-1} className="sr-only">
        The Estate
      </h1>

      {/* --- Turning-soon notice: rendered iff pickTurningSoon named a ghost
          (Req 1.3/1.4). Its "Go to it" action jumps into the sky place on the
          exact plot holding the ghost (estate-map Req 12.1–12.6), wired through
          `onGoToTurningSoon`. --- */}
      <div className="pointer-events-none absolute inset-x-0 top-[14%] z-40 flex justify-center">
        <div className="pointer-events-auto">
          <TurningSoon turningSoon={turningSoon} onGoTo={onGoToTurningSoon} />
        </div>
      </div>

      {/* --- The four place links in display order sky, gate, ground, crypt
          (Req 1.2). Each place gets only its own rows (grouped by placeOf).

          Layout matches `docs/design-canvas/EstateMap.dc.html` (a ~1440x900
          board): the places are positioned ABSOLUTELY rather than flowed in a
          row — the sky top-centre, hallowed ground to the left above the fence,
          the crypt to the right at the mausoleum, and the gate bottom-centre in
          front of the gate (a higher z so it reads in front). The band itself
          is a full-cover `pointer-events-none` wrapper so it never swallows a
          click; each `Place` gets `pointer-events-auto` so only the place
          buttons are clickable. Canvas pixel coords are converted to % of the
          1440x900 board: e.g. sky `left:44%; top:168px` → `left-[44%]
          top-[18%]`. --- */}
      <div
        data-testid="estate-map-places"
        className="pointer-events-none absolute inset-0 z-20"
      >
        {PLACE_ORDER.map((place) => (
          <Place
            key={place}
            place={place}
            rows={grouped[place]}
            onEnter={onEnterPlace}
            className={`pointer-events-auto ${PLACE_POSITIONS[place]}`}
          />
        ))}
      </div>
    </div>
  );
}
