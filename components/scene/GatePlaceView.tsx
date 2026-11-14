"use client";

/**
 * Place view (client component) — the in-place scene.
 *
 * Shows one place's creatures laid out as an organic seeded scatter across
 * paginated plots, with the decay-word filter chips, the plot pager, and the
 * return-to-the-gate control. The 2C polish pass replaces the old reused
 * `Sky`/`Backdrop`/`Moon` stack with a per-place painted `PlaceBackground`
 * (the Sky `Moon` nested inside it on the sky place), straddles the creatures
 * with a two-site `Fog`, swaps the flex `DepthRows` flow for the absolute
 * `DepthScatter`, and overlays the lights-off `LanternCursor`, all driven by
 * pointer `useParallax` on the scene root.
 *
 * ## Scene-root band stack (back → front, matching design.md's depth table)
 *
 * The root `div` carries `data-scene-root` + a `ref` and runs
 * `useParallax(rootRef, { reducedMotion })`, which writes `--px`/`--py` (each in
 * `[-1, 1]`) on the root. Each band reads those vars through a `translate3d`
 * `calc()` with the pinned per-band maxima — background moves least, near fog
 * most — so a farther layer never out-travels a nearer one (Req 2.5). The
 * chrome and the lantern take NO parallax transform.
 *
 *   | Band        | z  | Contents                              | Max offset |
 *   | ----------- | -- | ------------------------------------- | ---------- |
 *   | Background  | 0  | `PlaceBackground` (+ nested Sky `Moon`)| ≈ 8px      |
 *   | Far fog     | 10 | `Fog layer="dense"` (below creatures) | ≈ 16px     |
 *   | Creatures   | 20 | `DepthScatter` creatures (internal)   | ≈ 16px     |
 *   | Near fog    | 25 | `Fog layer="thin"` (above creatures)  | ≈ 26px     |
 *   | Plaques     | 30 | `DepthScatter` plaques (internal)     | ≈ 16px     |
 *   | Lantern     | 35 | `LanternCursor` (below chrome)        | none       |
 *   | Chrome      | 40+| chips / pager / return / heading      | none       |
 *
 * `DepthScatter` paints its own creatures (z 20) and plaque (z 30) sub-layers,
 * so the creatures and plaques bands above are a single `DepthScatter` wrapper
 * carrying the ≈16px creature-band transform; the near fog is a separate z-25
 * sibling between them.
 *
 * ## Fog (two sites, data-encoded)
 *
 * Fog encodes the zombie population and renders at the gate and on hallowed
 * ground (Req 6.1); the sky and crypt carry no fog. Both the far (`dense`,
 * z 10, below creatures) and near (`thin`, z 25, above creatures) layers derive
 * their opacity from the SAME `fogDensity(zombieCount)` call and are null iff
 * the zombie count is 0 — so on hallowed ground (0 zombies) both collapse to
 * nothing while the band structure stays uniform. The gate keeps its
 * ancient-zombie `Lightning` in the atmosphere band (self-hiding at count 0).
 *
 * ## Derivation pipeline
 *
 * The rows for the place (already `placeOf`-filtered by `SceneView`) flow
 * through three pure steps: apply the active filter (a decay word, the gate's
 * "Risen", or "all"); `orderForPlace(place, filtered)`; `paginate(ordered,
 * PLOT_SIZE)`. The clamped plot is handed to `DepthScatter`, which scatters it
 * (Req 5.1). Every creature in the plot is rendered individually — no "+N more"
 * collapse. The decay word of a row is read from its existing `decayLevel`.
 *
 * ## Focus on arrival
 *
 * On mount the view moves keyboard focus to the `PlaceHeading` (a
 * `tabIndex={-1}` target) so screen-reader and keyboard users land on the
 * place's name (Req 9.3 / 13.5). The travel transition performs the same move
 * on `done`; this mount focus covers the reduced-motion / no-travel path and
 * deep-link arrivals.
 *
 * Requirements: 2.1, 2.5, 3.1, 3.7, 4.1, 4.2, 4.3, 4.4, 4.9, 5.1, 6.1, 8.2, 8.3
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useIsCompact } from "@/components/ui/useIsCompact";

import Atmosphere from "@/components/scene/Atmosphere";
import DepthScatter from "@/components/scene/DepthScatter";
import Fog from "@/components/scene/Fog";
import LanternCursor from "@/components/scene/LanternCursor";
import Lightning from "@/components/scene/Lightning";
import PlaceBackground from "@/components/scene/PlaceBackground";
import useParallax from "@/components/scene/useParallax";
import FilterChips from "@/components/scene/FilterChips";
import Pager from "@/components/scene/Pager";
import PlaceHeading from "@/components/scene/PlaceHeading";
import ReturnToGate from "@/components/scene/ReturnToGate";

import { type GraveyardRow } from "@/lib/graveyard-view";
import type { Theme } from "@/lib/theme-art";
import { dayCopy, placeNameKey } from "@/lib/day-copy";
import { placePlots } from "@/lib/place-pipeline";
import {
  PLOT_SIZE,
  COMPACT_CHROME_FALLBACK_PX,
  compactPlotSize,
  stageBand,
  plaqueCopy,
  type PlaceFilter,
  type PlaceId,
} from "@/lib/estate-view";
import { ancientZombieCount, summaryCounts } from "@/lib/scene-view";

/**
 * Per-band parallax transforms, pinned to the design's depth maxima (Req 2.5):
 * the background moves ≈8px, the creatures / plaques / far fog ≈16px, and the
 * near fog ≈26px at `|--px| = 1`. Each is a GPU-friendly `translate3d` reading
 * `--px`/`--py` (default 0 so SSR/first paint is neutral); only `transform`
 * animates, keeping the parallax on the compositor (Req 9.1). The chrome and
 * the lantern deliberately carry none.
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

/**
 * Fallback chrome bottom (px from the scene top) used until the chrome rect is
 * measured: `--site-header-h` (7rem = 112px, see globals.css) plus a typical
 * title block (heading + subtitle + chips, ~150px).
 */
const CHROME_BOTTOM_FALLBACK_PX = 112 + 150;

/** Fallback top-chrome bottom (px) for the compact layout before measuring. */
const COMPACT_TOP_FALLBACK_PX =
  COMPACT_CHROME_FALLBACK_PX.header +
  COMPACT_CHROME_FALLBACK_PX.returnLink +
  COMPACT_CHROME_FALLBACK_PX.titleBlock +
  COMPACT_CHROME_FALLBACK_PX.chips;

export interface PlaceViewProps {
  /** Which place this view shows. */
  place: PlaceId;
  /** All rows for this place (already `placeOf`-filtered by SceneView). */
  rows: GraveyardRow[];
  /** The active filter; `"risen"` is only meaningful for the gate. */
  activeFilter: PlaceFilter;
  /** The current 0-based plot index (clamped into range before use). */
  plotIndex: number;
  /** The currently selected creature's repo name, or `null`. */
  selectedName: string | null;
  /** Raised when a filter chip is activated. */
  onFilterChange: (filter: PlaceFilter) => void;
  /** Raised with the next 0-based plot index when the pager is activated. */
  onPlotChange: (index: number) => void;
  /** Raised with a repo name when a creature is activated. */
  onSelect: (name: string) => void;
  /** Raised when the return-to-the-gate control is activated. */
  onReturn: () => void;
  /** Names allowed the expensive filter effects (from `pickFilterHeroes`). */
  filterHeroes?: Set<string>;
  /** Whether reduced motion is active (threaded to the polish layers). */
  reducedMotion?: boolean;
  /**
   * Mirror of `SceneView`'s lights state. Threaded to `LanternCursor`, which
   * renders nothing while the lights are on (Req 3.7). Defaults to lights-off
   * (the readable lantern mode) when omitted so standalone renders/tests still
   * get the overlay.
   */
  theme?: Theme;
  /**
   * Travel-transition hint (visual fix r3 travel). While `active`, the place
   * pauses its pointer parallax (so the zoom origin can't drift) and fades its
   * chrome (heading / chips / pager / plaques) in via `--travel-chrome-fade`,
   * so the chrome arrives LAST after the destination zoom settles. Absent when
   * no travel is running.
   */
  travel?: { active: boolean };
  /**
   * True while the detail panel is open. Used by the explorable world to keep
   * its scroll offset and return focus; the Gate stage ignores it.
   */
  panelOpen?: boolean;
  /**
   * A request to bring one creature into view without a pointer activation
   * (turning-soon jump, `?repo=` open). Consumed by the explorable world; the
   * Gate stage ignores it.
   */
  revealRequest?: RevealRequest | null;
  /** Reports a reveal request as handled (by `id`). Ignored by the Gate stage. */
  onRevealHandled?: (id: number) => void;
}

/** A one-shot request to scroll a creature into the central part of the view. */
export interface RevealRequest {
  name: string;
  id: number;
}

export default function GatePlaceView({
  place,
  rows,
  activeFilter,
  plotIndex,
  selectedName,
  onFilterChange,
  onPlotChange,
  onSelect,
  onReturn,
  filterHeroes,
  reducedMotion = false,
  theme = "night",
  travel,
}: PlaceViewProps) {
  // Compact (< 768px) layout. `useIsCompact` (the CSS breakpoint's media
  // query) is the ONLY decider; measured sizes are used for layout math only.
  const compact = useIsCompact();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const layoutW =
    box.w > 0
      ? box.w
      : typeof window !== "undefined" && window.innerWidth > 0
        ? window.innerWidth
        : 375;
  const pageSize = compact ? compactPlotSize(layoutW) : PLOT_SIZE;

  // Derivation pipeline: filter → order → paginate. Memoized on the inputs so
  // the plots are recomputed only when the rows/filter actually change.
  const plots = useMemo(() => {
    return placePlots(place, rows, activeFilter, pageSize);
  }, [place, rows, activeFilter, pageSize]);

  // Clamp the incoming plot index into range so a stale/out-of-range value can
  // never index past the plots (Req 8.3). `paginate` always returns ≥ 1 plot.
  const plotCount = plots.length;
  const clampedIndex = Math.min(Math.max(0, plotIndex), plotCount - 1);
  const currentPlot = plots[clampedIndex] ?? [];

  // Plaque count line for the heading. The gate reports its zombies and risen
  // separately via `plaqueCopy("gate", zombieCount, risenCount)`; the other
  // three places report their single population.
  const copy = useMemo(() => {
    if (place === "gate") {
      const counts = summaryCounts(rows);
      return plaqueCopy("gate", counts.zombie, counts.risen, theme);
    }
    return plaqueCopy(place, rows.length, undefined, theme);
  }, [place, rows, theme]);

  // Fog renders at the gate AND on hallowed ground (Req 6.1); sky/crypt get no
  // fog. The fog density is the place's zombie count (`summaryCounts.zombie`),
  // which is the gate's zombie population and 0 on the ground — so both fog
  // layers there collapse to null while the band structure stays uniform.
  const hasFog = place === "gate" || place === "ground";
  const zombieCount = hasFog ? summaryCounts(rows).zombie : 0;

  // Gate-only lightning cadence, derived from the gate's ancient-zombie count;
  // it self-hides at 0 and renders only for the gate.
  const isGate = place === "gate";
  const ancientCount = isGate ? ancientZombieCount(rows) : 0;

  // Scene root for pointer parallax: `useParallax` writes `--px`/`--py` here on
  // a coalesced rAF tick, which the band transforms below read through calc().
  const rootRef = useRef<HTMLDivElement>(null);
  // Pause parallax during a travel transition so the zoom origin stays put.
  useParallax(rootRef, { reducedMotion, paused: travel?.active ?? false });

  // During a travel transition the place chrome fades in LAST, driven by the
  // `--travel-chrome-fade` var the `travel-stage` sets (visual fix r3 travel).
  // Idle (no travel) the chrome is fully opaque.
  const chromeFadeStyle: CSSProperties = travel?.active
    ? { opacity: "var(--travel-chrome-fade, 1)" }
    : {};

  // Move focus to the heading on arrival so keyboard/screen-reader users land
  // on the place's name (Req 9.3 / 13.5). Runs once per place entry.
  const headingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [place]);

  // Measure the chrome rect (union of `place-chrome` and `place-title-block`)
  // so creatures and plaques can be kept below it. `chromeBottomPx` is relative
  // to the scene root's top; it starts at a fallback derived from
  // `--site-header-h` (7rem) plus the typical title block height and is
  // replaced by the measured value once layout is available.
  const chromeRef = useRef<HTMLDivElement>(null);
  const titleBlockRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [chromeBottomPx, setChromeBottomPx] = useState(CHROME_BOTTOM_FALLBACK_PX);
  const [barTopPx, setBarTopPx] = useState<number | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    const els = [chromeRef.current, titleBlockRef.current].filter(
      (el): el is HTMLDivElement => el !== null,
    );
    if (root === null || els.length === 0) {
      return;
    }
    const measure = (): void => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      const barEl = barRef.current;
      if (barEl !== null) {
        const barTop =
          barEl.getBoundingClientRect().top - root.getBoundingClientRect().top;
        if (barTop > 0) {
          setBarTopPx((prev) => (prev === barTop ? prev : barTop));
        }
      }
      const rootTop = root.getBoundingClientRect().top;
      let bottom = 0;
      for (const el of els) {
        bottom = Math.max(bottom, el.getBoundingClientRect().bottom - rootTop);
      }
      // jsdom (no layout) reports 0: keep the fallback rather than collapsing.
      if (bottom > 0) {
        setChromeBottomPx((prev) => (prev === bottom ? prev : bottom));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    for (const el of els) {
      observer.observe(el);
    }
    observer.observe(root);
    if (barRef.current !== null) {
      observer.observe(barRef.current);
    }
    return () => observer.disconnect();
  }, [place, compact]);

  // Compact stage band from the measured chrome column bottom and bar top,
  // using the fallback heights until a measurement lands.
  const compactBand = useMemo(() => {
    if (!compact) return undefined;
    const sceneH =
      box.h > 0 ? box.h : typeof window !== "undefined" ? window.innerHeight : 0;
    const measured = chromeBottomPx !== CHROME_BOTTOM_FALLBACK_PX;
    const top = measured ? chromeBottomPx : COMPACT_TOP_FALLBACK_PX;
    const barTop = barTopPx ?? sceneH - COMPACT_CHROME_FALLBACK_PX.bottomBar;
    return stageBand(sceneH, top, barTop);
  }, [compact, box.h, chromeBottomPx, barTopPx]);

  return (
    <div
      ref={rootRef}
      data-scene-root
      data-testid="place-view"
      data-place={place}
      // Under 720px tall the place keeps a 720px board and the page scrolls, so
      // the chrome, creatures and pager never share the same few pixels (25.3).
      className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto [@media(max-height:719px)]:min-h-[720px] min-[768px]:max-[1099px]:[@media(max-height:779px)]:min-h-[780px]"
      style={{ backgroundColor: "var(--color-night-sky)" }}
    >
      {/* --- Background band (z 0): the per-place painted cover with its top/
          bottom legibility gradients and solid fallback fill. On the sky place
          the data `Moon` is nested INSIDE `PlaceBackground` so it shares the
          painting's transform and stays locked over the painted moon. The band
          moves least under parallax (≈8px). Decorative, so the layer is
          `pointer-events-none` (handled inside PlaceBackground). --- */}
      <div className="pointer-events-none absolute inset-0 z-0" style={BG_PARALLAX}>
        <PlaceBackground place={place} rows={rows} />
      </div>

      {/* --- Far fog (z 10): the dense layer behind the creatures, density =
          the place's zombie count (gate/ground only; null iff 0 zombies).
          Shares the creature-band ≈16px offset. Decorative/pointer-events-none
          (the Fog root sets that itself). --- */}
      {hasFog ? (
        <div className="pointer-events-none absolute inset-0 z-10" style={CREATURE_PARALLAX}>
          <Fog zombieCount={zombieCount} layer="dense" reducedMotion={reducedMotion} />
        </div>
      ) : null}

      {/* --- Creatures + plaques band (z 20): the organic seeded scatter.
          `DepthScatter` paints its own creatures (z 20) and plaque (z 30)
          sub-layers; the near fog (z 25) is a sibling between them. The band
          carries the ≈16px creature-band parallax offset. It is centred and
          sized so the scatter has room to spread (the old depth-rows wrapper
          sat at the vertical centre; the scatter fills a generous box). --- */}
      <div
        // Desktop: on short viewports the scatter box gives up its bottom
        // slice, so the creature ground line (85% of the box) stays above the
        // pager instead of running under it (25.3). Zero at 1023px and taller.
        className="absolute inset-x-0 top-0 z-20 h-full min-[1100px]:h-[calc(100%-max(0px,150px-18%))] min-[768px]:max-[1099px]:h-[calc(100%-max(0px,180px-17.6%))]"
        style={CREATURE_PARALLAX}
      >
        <div className="relative mx-auto h-full w-full max-w-[1440px] px-6">
          <DepthScatter
            place={place}
            plot={currentPlot}
            selectedName={selectedName}
            onSelect={onSelect}
            filterHeroes={filterHeroes}
            reducedMotion={reducedMotion}
            // Scatter box top == scene top, so the chrome bottom is directly
            // comparable. DepthScatter folds in sceneH / 3 via max().
            topLimitPx={chromeBottomPx}
            compact={compact}
            compactBand={compactBand}
            // The plaque layer fades in with the rest of the chrome during a
            // travel transition; creatures underneath keep animating in.
            plaqueStyle={travel?.active ? chromeFadeStyle : undefined}
          />
        </div>
      </div>

      {/* --- Near fog (z 25): the thin layer in front of the creatures' feet
          and below the plaques, a quarter of the dense opacity from the SAME
          `fogDensity` call (null iff 0 zombies). Moves most under parallax
          (≈26px). --- */}
      {hasFog ? (
        <div className="pointer-events-none absolute inset-0 z-[25]" style={NEAR_FOG_PARALLAX}>
          <Fog zombieCount={zombieCount} layer="thin" reducedMotion={reducedMotion} />
        </div>
      ) : null}

      {/* --- Lantern band (z 35): the lights-off lantern cursor / static
          vignette, BELOW all chrome so it dims only the scene and creatures,
          never the controls. Renders nothing while the lights are on. No
          parallax transform. --- */}
      <LanternCursor theme={theme} reducedMotion={reducedMotion} />

      {/* --- Atmosphere (+ gate-only lightning) in the z-40 chrome band.
          Lightning cadence encodes the gate's ancient-zombie count and
          self-hides at count 0; it renders only for the gate. This layer sits
          above the scene, so it MUST be `pointer-events-none` or it swallows
          every click in the place. --- */}
      <div className="pointer-events-none absolute inset-0 z-40">
        <Atmosphere />
        {isGate ? <Lightning ancientCount={ancientCount} /> : null}
      </div>

      {compact ? (
        <>
          {/* --- Compact chrome: ONE flow column (return link, heading, chips
              in a single horizontally scrolling row) below the site header. --- */}
          <div
            ref={chromeRef}
            data-testid="place-chrome"
            className="pointer-events-none absolute inset-x-0 z-50 flex flex-col items-stretch gap-2 px-4 py-2"
            style={{ top: "var(--site-header-h)", ...chromeFadeStyle }}
          >
            <div className="flex justify-start">
              <ReturnToGate onReturn={onReturn} />
            </div>
            <div
              data-testid="place-compact-heading"
              className="flex flex-col items-center gap-2"
            >
              <PlaceHeading ref={headingRef} name={dayCopy(theme, placeNameKey(place))} copy={copy} />
            </div>
            <div
              data-testid="place-chips-row"
              className="pointer-events-auto overflow-x-auto [&>div]:w-max [&>div]:flex-nowrap [&>div]:justify-start"
            >
              <FilterChips
                place={place}
                rows={rows}
                activeFilter={activeFilter}
                onFilterChange={onFilterChange}
              />
            </div>
          </div>

          {/* --- Bottom bar: the pager, fixed to the bottom with safe-area
              padding. --- */}
          <div
            ref={barRef}
            data-testid="place-bottom-bar"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pt-2 [@media(max-height:719px)]:absolute"
            style={{
              // Lifted above the footer row (sample-estate notice) so they never overlap.
              paddingBottom: "calc(2.75rem + env(safe-area-inset-bottom, 0px))",
              ...chromeFadeStyle,
            }}
          >
            <Pager
              plotIndex={clampedIndex}
              plotCount={plotCount}
              onPlotChange={onPlotChange}
            />
          </div>
        </>
      ) : (
        <>      {/* --- Return control: pinned top-left, in its own row below the site
          header band (never over the stats line, visual fix 2C). --- */}
      <div
        ref={chromeRef}
        data-testid="place-chrome"
        className="pointer-events-none absolute left-0 z-50 p-6"
        style={{ top: "var(--site-header-h)", ...chromeFadeStyle }}
      >
        <ReturnToGate onReturn={onReturn} />
      </div>

      {/* --- Place title block: the heading, its subtitle, and the filter chips
          are ONE centered flow column (title, then subtitle, then chips) with a
          16px gap — normal flow, never absolutely stacked over each other, at
          every width >= 360 (visual fix r3 #1). The whole column is positioned
          below the site header; `PlaceHeading` renders the title + subtitle and
          the chips follow it in the same column. --- */}
      <div
        ref={titleBlockRef}
        data-testid="place-title-block"
        className="place-title-clear pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center gap-4 px-6"
        style={{ top: "var(--site-header-h)", ...chromeFadeStyle }}
      >
        <PlaceHeading ref={headingRef} name={dayCopy(theme, placeNameKey(place))} copy={copy} />
        <FilterChips
          place={place}
          rows={rows}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </div>

      {/* --- Pager (bottom band). --- */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex justify-center px-6 min-[768px]:max-[1099px]:bottom-24"
        style={chromeFadeStyle}
      >
        <Pager
          plotIndex={clampedIndex}
          plotCount={plotCount}
          onPlotChange={onPlotChange}
        />
      </div>
        </>
      )}
    </div>
  );
}
