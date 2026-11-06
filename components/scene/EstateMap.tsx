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
 * The 2C polish pass wires the map's scene root to the shared polish layers,
 * matching `PlaceView`: the root carries `data-scene-root` + a `ref` and runs
 * `useParallax(rootRef, { reducedMotion })`, writing `--px`/`--py` on a
 * coalesced rAF tick (Req 2.1–2.7). Each band reads those vars through a
 * `translate3d` `calc()` with the pinned per-band maxima — the reused
 * backdrop/`Sky`/map-`Moon` stack moves least (≈8px), the place links and far
 * fog ≈16px, the near fog most (≈26px) — so a farther layer never out-travels
 * a nearer one (Req 2.5); the chrome and the lantern take no parallax. The fog
 * is now the two-site `Fog` (`layer="dense"` far at z-10, `layer="thin"` near
 * at z-25), both driven by the estate zombie count from the SAME `fogDensity`
 * call, and the lights-off `LanternCursor` sits in the z-35 band below all
 * chrome.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1,
 * 3.7, 6.1, 6.2, 6.3
 */

import { useRef, type CSSProperties } from "react";

import Atmosphere from "@/components/scene/Atmosphere";
import Backdrop from "@/components/scene/Backdrop";
import Fog from "@/components/scene/Fog";
import LanternCursor from "@/components/scene/LanternCursor";
import Lightning from "@/components/scene/Lightning";
import Moon from "@/components/scene/Moon";
import Sky from "@/components/scene/Sky";
import TurningSoon from "@/components/scene/TurningSoon";
import useParallax from "@/components/scene/useParallax";
import Whisper from "@/components/scene/Whisper";
import Place from "@/components/scene/Place";

import { type GraveyardRow } from "@/lib/graveyard-view";
import { placeOf, PLACE_ORDER, type PlaceId } from "@/lib/estate-view";
import {
  ancientZombieCount,
  summaryCounts,
  type TurningSoon as TurningSoonResult,
} from "@/lib/scene-view";

/**
 * Per-band parallax transforms, pinned to the design's depth maxima (Req 2.5),
 * identical to the scheme `PlaceView` uses: the reused backdrop/`Sky`/map-`Moon`
 * stack moves ≈8px, the place links and far fog ≈16px, and the near fog ≈26px
 * at `|--px| = 1`. Each is a GPU-friendly `translate3d` reading `--px`/`--py`
 * (default 0 so SSR/first paint is neutral); only `transform` animates, keeping
 * the parallax on the compositor (Req 9.1). The chrome and the lantern
 * deliberately carry none.
 */
const BG_PARALLAX: CSSProperties = {
  transform:
    "translate3d(calc(var(--px,0) * 8px), calc(var(--py,0) * 8px), 0)",
};
const CREATURE_PARALLAX: CSSProperties = {
  transform:
    "translate3d(calc(var(--px,0) * 16px), calc(var(--py,0) * 16px), 0)",
};
const NEAR_FOG_PARALLAX: CSSProperties = {
  transform:
    "translate3d(calc(var(--px,0) * 26px), calc(var(--py,0) * 26px), 0)",
};

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
  /**
   * Whether reduced motion is active. Threaded into `useParallax` (disables
   * pointer parallax, Req 2.6), the two `Fog` layers (holds the drift, Req
   * 6.5), and `LanternCursor` (holds the flicker, Req 3.5).
   */
  reducedMotion: boolean;
  /**
   * Mirror of `SceneView`'s lights state, threaded through for the polish
   * layers (notably `LanternCursor`, which renders nothing while the lights are
   * on). Optional so existing callers/tests that predate the polish wiring
   * still type-check; the map's own polish wiring lands in task 9.2.
   */
  lightsOn?: boolean;
  /**
   * Travel-transition hint (visual fix r3 travel). While `active`, the map
   * pauses its pointer parallax (so the zoom origin can't drift) and fades its
   * NON-target place links to 0 (the `targetPlace` stays, since the view is
   * zooming into it). Absent when no travel is running.
   */
  travel?: { active: boolean; targetPlace: PlaceId };
}

/**
 * Per-place absolute position classes, matching `EstateMap.dc.html`'s board
 * arrangement. The four places are anchored by their CENTRE (each `Place`
 * button is `-translate-x-1/2 -translate-y-1/2` via the shared class below),
 * so the top/left percentages are the centre point, not the top-left corner.
 * Centring lets the whole band fit inside the SHORTER reference viewport
 * (1280×720) as well as 1440×900 without any place's painted stack (its ~230px
 * tall representatives + plaque) spilling past the viewport bottom — the gate,
 * the tallest and lowest, now centres at 78% so its bottom edge lands well
 * inside 720px (Req 1.1). The old top-left anchoring put the gate at y≈843px,
 * which overflowed; centred percentages keep every place reachable without
 * scrolling (Req 1.1, 1.2).
 *
 *   sky    centre `left-[46%] top-[20%]`   (top-centre)
 *   ground centre `left-[20%] top-[50%]`   (left, above fence)
 *   crypt  centre `left-[78%] top-[48%]`   (right, mausoleum)
 *   gate   centre `left-[46%] top-[78%]`   (bottom-centre, front)
 *
 * The lower band sits at z-20; the gate rides z-30 so it overlaps cleanly.
 *
 * Below the mobile breakpoint (<768px) these absolute classes are suppressed
 * and the band switches to a single-column vertical flow (see the render), so
 * narrow viewports stack the four places top-to-bottom instead of using the
 * board arrangement (Req 1.1, 5.10-adjacent).
 */
// NOTE: these percentages mirror `PLACE_CENTERS` in lib/estate-view.ts (the
// shared source the travel transition reads for its zoom origin). They are
// kept as literal Tailwind arbitrary-value classes here because Tailwind only
// extracts STATIC class strings — a computed `left-[${x}%]` would not be built.
// If a centre changes, update it in BOTH places.
const PLACE_POSITIONS: Record<PlaceId, string> = {
  sky: "md:absolute md:left-[46%] md:top-[20%] md:-translate-x-1/2 md:-translate-y-1/2 md:z-20",
  ground:
    "md:absolute md:left-[20%] md:top-[50%] md:-translate-x-1/2 md:-translate-y-1/2 md:z-20",
  crypt:
    "md:absolute md:left-[78%] md:top-[48%] md:-translate-x-1/2 md:-translate-y-1/2 md:z-20",
  gate: "md:absolute md:left-[46%] md:top-[78%] md:-translate-x-1/2 md:-translate-y-1/2 md:z-30",
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
  reducedMotion = false,
  lightsOn = false,
  travel,
}: EstateMapProps) {
  const grouped = groupByPlace(rows);

  // Data-encoding inputs derived from the FULL estate rows (pure reads, same as
  // the old Scene): fog density tracks the zombie population and lightning
  // cadence tracks the ancient-zombie population.
  const zombieCount = summaryCounts(rows).zombie;
  const ancientCount = ancientZombieCount(rows);

  // Scene root for pointer parallax: `useParallax` writes `--px`/`--py` here on
  // a coalesced rAF tick, which the band transforms below read through calc().
  // No React state is touched per frame (Req 2.1–2.7).
  const rootRef = useRef<HTMLDivElement>(null);
  // Pause parallax during a travel transition so the zoom origin stays put.
  useParallax(rootRef, { reducedMotion, paused: travel?.active ?? false });

  // During a travel transition the stage sets `--travel-others-fade` (1 -> 0 as
  // the view zooms into the target place). Every place EXCEPT the destination,
  // plus the map heading and the map-only decorations (turning-soon notice,
  // whisper region), fade with it; the target place stays at full opacity so
  // the zoom reads as diving INTO it (visual fix r3 travel). Idle (no travel)
  // every style defaults to opacity 1. `othersFadeStyle(place)` returns the
  // fade for a given place (empty for the target or when idle).
  const othersFade: CSSProperties = { opacity: "var(--travel-others-fade, 1)" };
  const othersFadeStyle = (place: PlaceId): CSSProperties | undefined =>
    travel?.active && place !== travel.targetPlace ? othersFade : undefined;
  const decorFadeStyle: CSSProperties | undefined = travel?.active
    ? othersFade
    : undefined;

  return (
    <div
      ref={rootRef}
      data-scene-root
      data-testid="estate-map"
      data-mode={mode}
      className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto"
      style={{ backgroundColor: "var(--color-night-sky)" }}
    >
      {/* --- Reused painted stack, same back-to-front order as Scene. These are
          decorative full-cover layers, so each is `pointer-events-none` — only
          the real controls (the place buttons, the chrome) take clicks. The
          whole backdrop/`Sky`/map-`Moon` stack rides the Background band's
          ≈8px parallax offset (the least of any band, Req 2.5), so it shifts
          as a single matte painting behind the place links. --- */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={BG_PARALLAX}
      >
        <Sky />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={BG_PARALLAX}
      >
        <Backdrop />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={BG_PARALLAX}
      >
        <Moon rows={rows} />
      </div>

      {/* --- Far fog (z 10): the dense layer behind the place links, density =
          the estate's zombie count across every place (Req 3.3 / 6.1 / 6.2;
          null iff 0 zombies). It keeps the existing `scene-fog` root (same
          testid / `data-fog-density` / null-iff-0 gate), shares the ≈16px
          creature-band parallax offset, and threads `reducedMotion` so the
          drift holds under reduced motion. Decorative/pointer-events-none — it
          would otherwise swallow the clicks meant for the place buttons. --- */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={CREATURE_PARALLAX}
      >
        <Fog zombieCount={zombieCount} layer="dense" reducedMotion={reducedMotion} />
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
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[16%] z-40 flex justify-center px-6 text-center"
        style={decorFadeStyle}
      >
        <Whisper whispers={whispers} />
      </div>

      {/* --- Map heading: a programmatic focus target (`tabIndex={-1}`) so
          returning from a place can move focus back to the map when the
          originating place link cannot be found (Req 13.7). Rendered `sr-only`
          so it carries the map's accessible name and stays focusable in the
          a11y tree WITHOUT painting a visible title that overlaps the summary /
          turning-soon chrome (the painted board has no "THE ESTATE" title). --- */}
      <h1
        data-testid="map-heading"
        tabIndex={-1}
        className="sr-only"
        style={decorFadeStyle}
      >
        The Estate
      </h1>

      {/* --- Turning-soon notice: rendered iff pickTurningSoon named a ghost
          (Req 1.3/1.4). Its "Go to it" action jumps into the sky place on the
          exact plot holding the ghost (estate-map Req 12.1–12.6), wired through
          `onGoToTurningSoon`. --- */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[14%] z-40 flex justify-center"
        style={decorFadeStyle}
      >
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
        className={[
          "pointer-events-none z-20",
          // Mobile (<768px): single-column vertical flow in the document so
          // every place stacks top-to-bottom and the map simply scrolls — no
          // absolute board arrangement, nothing clipped (Req 1.1, 1.5).
          "relative flex flex-col items-center gap-10 px-6 pb-24 pt-40",
          // Desktop (>=768px): the full-cover absolute board the places are
          // positioned onto via PLACE_POSITIONS; clear the mobile flow spacing.
          "md:absolute md:inset-0 md:block md:gap-0 md:p-0",
        ].join(" ")}
        // The place links ride the creature-band ≈16px parallax offset (Req
        // 2.5), applied via inline style so it composes with the responsive
        // `md:absolute` classes above. The translate3d on this wrapper does not
        // conflict with each `Place`'s own `-translate-x/y` centring, which
        // lives on the child buttons via PLACE_POSITIONS.
        style={CREATURE_PARALLAX}
      >
        {PLACE_ORDER.map((place) => (
          <Place
            key={place}
            place={place}
            rows={grouped[place]}
            onEnter={onEnterPlace}
            className={`pointer-events-auto ${PLACE_POSITIONS[place]}`}
            // Non-target places fade out during an inward travel (the target
            // stays); undefined (opacity 1) when idle (visual fix r3 travel).
            style={othersFadeStyle(place)}
          />
        ))}
      </div>

      {/* --- Near fog (z 25): the thin layer in front of the place links and
          below the chrome, a quarter of the dense opacity from the SAME
          `fogDensity(zombieCount)` call (`scene-fog-near`, null iff 0 zombies).
          It drifts the opposite direction on a ~55s loop and moves most under
          parallax (≈26px). Decorative/pointer-events-none. --- */}
      <div
        className="pointer-events-none absolute inset-0 z-[25]"
        style={NEAR_FOG_PARALLAX}
      >
        <Fog zombieCount={zombieCount} layer="thin" reducedMotion={reducedMotion} />
      </div>

      {/* --- Lantern band (z 35): the lights-off lantern cursor / static
          vignette, BELOW all chrome (atmosphere / whisper / turning-soon at
          z-40) so it dims only the scene and place links, never the controls.
          Renders nothing while the lights are on (Req 3.1 / 3.7). No parallax
          transform. --- */}
      <LanternCursor lightsOn={lightsOn} reducedMotion={reducedMotion} />
    </div>
  );
}
