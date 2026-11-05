"use client";

/**
 * Scene entry point (client component).
 *
 * `SceneView` is the stateful shell that owns every piece of interactive scene
 * state and every clock-dependent derivation, then hands the already-derived
 * view-model values down to the presentational `Scene` layout (and, when the
 * lights are on, the `LightsOnTable`). This is the React/I-O seam the design
 * calls out: "SceneView owns state and derivations, Scene lays out." The pure
 * view-model functions it calls (`buildRows`, `selectInitialCreature`,
 * `pickTurningSoon`, `composeWhispers`, `pickFilterHeroes`) read no clock — the
 * server-captured `renderedAt` is threaded through as the `now` argument.
 *
 * ## What SceneView owns
 *
 *   - `view: "map" | PlaceId` — the two-level navigation state: the estate map
 *     or one of the four places. Resolved ONCE from the server-provided `?at=`
 *     and the deep-linked `[repo]` via `resolveInitialView` (precedence: a valid
 *     `?at=` wins, else the deep-linked repo's place, else the map — Req
 *     11.1–11.4), then driven only by client interactions and the browser
 *     back/forward `popstate` listener (Req 10.1–10.8). Navigation is entirely
 *     client-side: `onEnterPlace`/`onReturn` call `window.history.pushState`
 *     directly (not the Next router), so there is no server re-run, no refetch,
 *     no new `renderedAt`, and no state reset.
 *   - `plotIndex: number` / `activeFilter: PlaceFilter` — the current plot page
 *     and decay/risen filter inside a place. Both survive map↔place navigation
 *     (Req 10.7); `plotIndex` is clamped into `0..plots.length-1` before render
 *     (Req 8.3).
 *   - `selected: string | null` — the single selected creature's repo name.
 *     Resolved once together with `view` via `resolveInitialView` for
 *     case-insensitive deep-link pre-selection (Req 1.2/1.3); set by a creature
 *     activation or the turning-soon notice; single-select, so choosing another
 *     replaces the previous (Req 9.6, 7.9). The resolver runs against the
 *     FIRST-render rows so first paint is hydration-stable.
 *   - `reducedMotion: boolean` — defaults to `true` on the server so there is no
 *     motion flash before hydration, then tracks the live
 *     `prefers-reduced-motion` media query via a mount effect (Req 2.6).
 *   - `lightsOn: boolean` — defaults to `false`; when `true` the readable
 *     Lights-on table is shown instead of the scene (Req 10.1, 10.6).
 *   - `soundOn: boolean` — defaults to `false`; display-only, loads/plays no
 *     audio (Req 13.1, 13.2, 13.3).
 *   - overrides — LIVE routes read the per-device overrides from
 *     `lib/overrides.ts` in a mount effect, exactly as `GraveyardView` does
 *     (empty on first paint for hydration safety). ESTATE uses the in-memory
 *     `estateOverrides` and never touches `localStorage`.
 *
 * ## Overrides and `rows`
 *
 * The server passes an initial `rows` (classified with no overrides), but
 * `SceneView` recomputes `rows = buildRows(repos, overrides, renderedAt)` during
 * render so overrides actually take effect, mirroring `GraveyardView`. Hydration
 * stays stable because the first render uses an empty override map (live) or the
 * fixed `estateOverrides` (estate) — identical to the server output.
 *
 * ## Lights-on presentation
 *
 * The Header's Lights-on toggle lives inside `Scene`. When `lightsOn` is `true`
 * this component renders the `LightsOnTable` **instead of** the scene (Req 10.1)
 * — the scene's parallax/atmosphere/motion/whispers are gone entirely, which is
 * exactly the "lights on" readable register. Because the table itself carries no
 * toggle, SceneView draws a thin control bar above it holding the same Lights-on
 * `Toggle`, so the reader can turn the lights back off and return to the scene
 * showing the same data (Req 10.6). The sound toggle rides the same bar for
 * parity. This keeps `Scene` and `LightsOnTable` cleanly mutually exclusive
 * rather than stacking overlays with fragile z-order.
 *
 * Importing `lib/overrides` here is intentional and allowed: that module is
 * client-only and this is a client component; the `no-restricted-imports` rule
 * only blocks SERVER modules from importing it (mirrors `GraveyardView`).
 *
 * Requirements: 1.2, 1.3, 6.9, 7.8, 8.2, 8.3, 10.1, 10.2, 10.3, 10.4, 10.5,
 * 10.6, 10.7, 10.8, 13.1, 13.2, 13.3
 */

import { useCallback, useEffect, useRef, useState } from "react";

import EstateMap from "@/components/scene/EstateMap";
import Footer from "@/components/scene/Footer";
import LightsOnTable from "@/components/scene/LightsOnTable";
import PlaceView from "@/components/scene/PlaceView";
import TravelTransition from "@/components/scene/TravelTransition";
import Header from "@/components/ui/Header";
import Toggle from "@/components/ui/Toggle";

import {
  type PlaceFilter,
  type PlaceId,
  orderForPlace,
  paginate,
  parsePlaceId,
  placeOf,
  PLOT_SIZE,
  resolveInitialView,
} from "@/lib/estate-view";
import { buildRows, type GraveyardRow } from "@/lib/graveyard-view";
import type { Override, RepoFacts } from "@/lib/lifecycle";
import { readOverrides, type OverrideMap } from "@/lib/overrides";
import {
  composeWhispers,
  pickFilterHeroes,
  pickTurningSoon,
} from "@/lib/scene-view";

export interface SceneViewProps {
  /**
   * The server's initial classified rows (no overrides). Kept on the props for
   * parity with the loader contract, but `SceneView` recomputes the displayed
   * rows via `buildRows(repos, overrides, renderedAt)` so live/estate overrides
   * take effect. The initial render reproduces this exactly (empty overrides
   * live, `estateOverrides` for estate), so hydration stays stable.
   */
  rows: GraveyardRow[];
  /**
   * Raw repository facts, in pushed-at-descending order. Used for live-route
   * override reclassification (`buildRows`) and the turning-soon / whisper
   * timing derivations.
   */
  repos: RepoFacts[];
  /** Whether the owner's repositories were capped at the 300-repo limit. */
  truncated: boolean;
  /** The graveyard owner's username; `null` on `/estate`. Keys the override store. */
  username: string | null;
  /** ISO 8601 timestamp captured once on the server, threaded in as `now`. */
  renderedAt: string;
  /** Live graveyard vs the bundled sample estate. */
  mode: "live" | "estate";
  /** The `[repo]` deep-link segment, for case-insensitive pre-selection. */
  initialRepo?: string;
  /**
   * The raw `?at=` query value forwarded by the server page **for the initial
   * render only** (Req 10.4). It is validated through the pure `parsePlaceId`
   * and, together with `initialRepo`, resolves the initial `view`/`selected`
   * once via `resolveInitialView`. After hydration the view is pure client
   * state driven by `onEnterPlace`/`onReturn` and the `popstate` listener; this
   * prop is never read again.
   */
  at?: string;
  /**
   * Estate-only, in-memory overrides resolved from the fixture. Never persisted
   * and never read from `localStorage`.
   */
  estateOverrides?: Record<string, Override>;
}

export default function SceneView({
  rows: initialRows,
  repos,
  truncated,
  username,
  renderedAt,
  mode,
  initialRepo,
  at,
  estateOverrides,
}: SceneViewProps) {
  // `truncated` is part of the loader contract and the props shape but is not
  // surfaced by the scene chrome yet (the scene has no 300-repo notice of its
  // own). Reference it defensively so the prop stays wired without an unused
  // warning; the Lights-on register already shows the full capped set.
  void truncated;

  const isEstate = mode === "estate";

  // --- Overrides -----------------------------------------------------------
  // LIVE: start with an empty override map so the client's first paint matches
  // the server HTML exactly (the server has no localStorage). A mount effect
  // swaps in the stored overrides. ESTATE: overrides are the fixed, in-memory
  // `estateOverrides`; localStorage is never read or written (Req 12.x).
  const [liveOverrides, setLiveOverrides] = useState<OverrideMap>({});

  useEffect(() => {
    if (isEstate || !username) {
      return;
    }
    const stored = readOverrides(username);
    if (Object.keys(stored).length > 0) {
      // Reading localStorage (an external system unavailable during SSR and
      // first paint) and committing it must happen in a mount effect to keep
      // hydration stable. This one-shot setState is the intended pattern, not a
      // cascading-render smell — same as GraveyardView.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveOverrides(stored);
    }
  }, [isEstate, username]);

  // Derive the displayed rows during render. On the first render this uses an
  // empty map (live) or the fixed estate overrides, reproducing the server
  // output; after the effect loads live overrides it yields the override-aware
  // classification. All against the single injected `renderedAt`.
  const overrides: Record<string, Override> = isEstate
    ? estateOverrides ?? {}
    : liveOverrides;
  const rows = buildRows(repos, overrides, renderedAt);

  // --- Initial view + selection (resolved once) ----------------------------
  // The initial `view` and `selected` are resolved together, once, from the
  // server-provided `?at=` and the deep-linked `[repo]`, against the FIRST-render
  // rows (lazy initializer) so the deep link resolves against hydration-stable
  // markup. Precedence (Req 11.1–11.4): a valid `?at=` place wins, else the
  // place containing the deep-linked repo, else the map. `renderedAt` is read
  // once by the server and never changes, and neither `at` nor `initialRepo` is
  // consulted again after this first render — all later navigation is pure
  // client state (Req 10.4, 10.7).
  const [initialView] = useState(() =>
    resolveInitialView(initialRows, at, initialRepo),
  );

  // `view` is "map" or one of the four place ids. After the initial resolution
  // it is driven only by client interactions (`onEnterPlace`/`onReturn`) and the
  // browser back/forward `popstate` listener — never by a server re-run.
  const [view, setView] = useState<"map" | PlaceId>(initialView.view);

  // Single-select: activating a creature or the turning-soon notice replaces the
  // previous selection (Req 9.6, 7.9).
  const [selected, setSelected] = useState<string | null>(
    initialView.selected,
  );

  const handleSelect = (name: string): void => {
    setSelected(name);
  };

  // --- Place navigation state ----------------------------------------------
  // The 0-based plot index within the current place and the active decay/risen
  // filter. Both are client-only and survive map↔place navigation (they are not
  // reset on `onEnterPlace`/`onReturn`, Req 10.7). The wider `PlaceFilter` type
  // ("all" | decay word | "risen") covers every place; non-gate places use only
  // "all" and their own decay words.
  const [plotIndex, setPlotIndex] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<PlaceFilter>("all");

  // --- Reduced motion ------------------------------------------------------
  // Default `true` on the server to avoid a motion flash before hydration, then
  // track the live preference via a matchMedia listener (Req 2.6).
  const [reducedMotion, setReducedMotion] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      setReducedMotion(event.matches);
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, []);

  // --- Client-only history navigation --------------------------------------
  // Entering or leaving a place updates the URL with the browser History API
  // directly (NOT the Next router), so there is no server re-run, no refetch,
  // no new `renderedAt`, and no state reset (Req 10.5–10.7). `pushState` adds a
  // history entry so each place is shareable and back/forward works. All calls
  // are guarded for `typeof window` so they are inert during SSR.

  // --- Travel transition ---------------------------------------------------
  // `travelingTo` is the place a travel transition is currently playing toward,
  // or `null` when no transition is running. `SceneView` owns the overlay: it
  // is set at the moment of place entry (after the client-only `pushState` +
  // `setView`) and cleared when the overlay reports `done`, at which point
  // focus moves to the place heading (Req 13.1–13.5). Travel runs ONLY on
  // map→place entry; returning to the map performs no travel (Req 13.7).
  const [travelingTo, setTravelingTo] = useState<PlaceId | null>(null);

  // Remembers the place link the user travelled FROM so returning to the map
  // can move focus back to it (fallback: the map heading, Req 13.7). Each
  // `onEnterPlace` records the originating place id; `onReturn` reads and
  // clears it.
  const originPlaceRef = useRef<PlaceId | null>(null);

  /**
   * Enter a place from the map: push one history entry carrying `?at=place`,
   * set the view (Req 10.5), then start the travel transition toward it (Req
   * 13.1). `plotIndex`/`activeFilter`/`selected` are left intact so returning
   * later restores the same place state (Req 10.7); the turning-soon "Go to it"
   * jump (task 11.1) sets those explicitly before/after calling this.
   */
  const onEnterPlace = useCallback((place: PlaceId): void => {
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}?at=${place}`;
      window.history.pushState({ view: place }, "", url);
    }
    originPlaceRef.current = place;
    setView(place);
    // Kick off the travel overlay AFTER the navigation is committed; the
    // overlay is purely visual and never changes application state (Req 13.1).
    setTravelingTo(place);
  }, []);

  /**
   * Called by the `TravelTransition` overlay when the transition finishes (or
   * is skipped). Clears the transitioning flag and moves focus to the place
   * heading so keyboard/screen-reader users land on the place's name on arrival
   * (Req 13.3/13.5). The design makes travel the single owner of arrival focus;
   * `PlaceView`'s own mount focus covers the no-travel / deep-link paths.
   */
  const onTravelDone = useCallback((): void => {
    setTravelingTo(null);
    if (typeof document !== "undefined") {
      const heading = document.querySelector<HTMLElement>(
        '[data-testid="place-heading"]',
      );
      heading?.focus();
    }
  }, []);

  /**
   * Return to the map: push one history entry whose URL omits `at` and set the
   * view to "map" (Req 10.6). Interactive state is not reset (Req 10.7). No
   * travel plays on the return (Req 13.7); focus moves back to the originating
   * place link if it can be found, else the map heading as a fallback.
   */
  const onReturn = useCallback((): void => {
    if (typeof window !== "undefined") {
      window.history.pushState({ view: "map" }, "", window.location.pathname);
    }
    // No travel on return; cancel any in-flight transition defensively.
    setTravelingTo(null);
    const origin = originPlaceRef.current;
    originPlaceRef.current = null;
    setView("map");
    // Move focus back to the originating place link, falling back to the map
    // heading (Req 13.7). Deferred to the next frame so the map has rendered.
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        const target =
          (origin &&
            document.querySelector<HTMLElement>(
              `[data-testid="estate-place-${origin}"]`,
            )) ||
          document.querySelector<HTMLElement>('[data-testid="map-heading"]');
        target?.focus();
      }, 0);
    }
  }, []);

  // Back/forward: resolve the view purely on the client from the popstate event's
  // history state, falling back to the current URL's `at` parameter, then the
  // map (Req 10.8). No server re-run, no refetch; `renderedAt`/`rows` stay frozen.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onPopState = (event: PopStateEvent): void => {
      const state = event.state as { view?: unknown } | null;
      const fromState =
        typeof state?.view === "string" ? parsePlaceId(state.view) : null;
      const fromUrl = parsePlaceId(
        new URLSearchParams(window.location.search).get("at") ?? undefined,
      );
      setView(fromState ?? fromUrl ?? "map");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  /**
   * Turning-soon "Go to it": jump straight to the turning-soon ghost inside The
   * Restless Sky (estate-map Req 12.1–12.5). `pickTurningSoon` always names a
   * `ghost`, whose place is `sky`, so the ghost is guaranteed to be a sky row.
   *
   * The jump mirrors the design's algorithm exactly: order the sky rows with
   * `orderForPlace("sky", skyRows)`, paginate them, and find the plot that
   * contains the named ghost (`plots.findIndex(plot => plot.some(r => r.name ===
   * name))`). It then selects the ghost (Req 12.3), moves to that plot (Req
   * 12.4), clears the active filter to "all" so the ghost is not filtered out
   * (Req 12.5), and finally reuses `onEnterPlace("sky")` so the sky place opens
   * via the same client-only `pushState` + travel as a normal place entry (Req
   * 12.2). The state setters are called before `onEnterPlace` so React commits
   * them together with the view change in a single batch; `plotIndex` falls
   * back to 0 if the name is somehow absent (findIndex returns -1) so the clamp
   * never sees a negative index.
   */
  const onGoToTurningSoon = useCallback(
    (name: string): void => {
      const skyRows = rows.filter((row) => placeOf(row) === "sky");
      const ordered = orderForPlace("sky", skyRows);
      const plots = paginate(ordered, PLOT_SIZE);
      const plotIndex = plots.findIndex((plot) =>
        plot.some((row) => row.name === name),
      );
      setSelected(name);
      setPlotIndex(plotIndex >= 0 ? plotIndex : 0);
      setActiveFilter("all");
      onEnterPlace("sky");
    },
    [rows, onEnterPlace],
  );

  // --- Toggles -------------------------------------------------------------
  const [lightsOn, setLightsOn] = useState<boolean>(false);
  // Display-only; flipping it loads/plays no audio (Req 13.1/13.2/13.3).
  const [soundOn, setSoundOn] = useState<boolean>(false);

  // --- Clock-dependent derivations (pure, from the current rows + repos) ---
  const turningSoon = pickTurningSoon(repos, rows, renderedAt);
  const filterHeroes = pickFilterHeroes(rows, {
    selected,
    turningSoon: turningSoon?.name ?? null,
  });
  // Precompute the ordered whisper strings once from the injected clock so the
  // map (and the `Whisper` it renders) stays clock-free; empty when nothing
  // qualifies. Whispers are a map-only, estate-wide effect.
  const whispers = composeWhispers(rows, repos, renderedAt);

  // --- Plot-index clamp (Req 8.3) ------------------------------------------
  // While viewing a place, the current plot must be a valid index into that
  // place's plots. We derive the place's plots from the pure view-model
  // (`placeOf`-filtered rows → `orderForPlace` → `paginate`) and clamp
  // `plotIndex` into `0..plots.length-1` before render, so an out-of-range
  // index (e.g. after the active filter shrinks the set, or a stale history
  // entry) can never index past the plots. `paginate` always returns at least
  // one plot, so `plotCount` is ≥ 1 and the clamp is well-defined. On the map
  // the clamp collapses to 0. The clamped value is what the place render path
  // (task 14.1) will consume. Filtering is applied by `PlaceView` itself; here
  // we clamp against the unfiltered plot count as a safe upper bound.
  const placeRows =
    view === "map" ? [] : rows.filter((row) => placeOf(row) === view);
  const plots =
    view === "map" ? [[]] : paginate(orderForPlace(view, placeRows), PLOT_SIZE);
  const plotCount = plots.length;
  const clampedPlotIndex = Math.min(Math.max(0, plotIndex), plotCount - 1);

  // --- Lights-on readable register -----------------------------------------
  // When the lights are on we show the paper-register table INSTEAD of the
  // scene (Req 10.1): no parallax, atmosphere, motion, or whispers. The table
  // is fed the FULL `rows` — one row per repository across all four places —
  // so it reads the same whether the lights were turned on from the estate map
  // or from inside a place (estate-map Req 14.1, 14.2). The table carries no
  // toggle of its own, so a thin control bar above it holds the same Lights-on
  // toggle (so the reader can return to the scene with the same data, Req 10.6)
  // plus the display-only sound toggle for parity.
  //
  // `lightsOn` is an independent boolean: flipping it touches none of
  // `view`/`plotIndex`/`activeFilter`/`selected`, so those survive untouched
  // while the lights are on (estate-map Req 14.4). This early return also sits
  // BEFORE the map/place render path, so turning the lights back off restores
  // the exact prior view instantly — a plain state swap with no travel
  // transition (estate-map Req 14.5, 14.6).
  if (lightsOn) {
    return (
      <div
        data-testid="scene-view"
        data-lights-on="true"
        className="relative min-h-dvh w-full"
        style={{ backgroundColor: "var(--color-paper-200)" }}
      >
        <div
          className="flex items-center justify-end gap-4 px-6 py-3 sm:px-12"
          style={{ borderBottom: "1px solid var(--color-paper-border)" }}
        >
          <Toggle
            pressed={lightsOn}
            onChange={setLightsOn}
            label="Lights on"
          />
          <Toggle
            pressed={soundOn}
            onChange={setSoundOn}
            label="Sound"
          />
        </div>
        <LightsOnTable rows={rows} username={username ?? undefined} />
      </div>
    );
  }

  // --- Travel representatives ----------------------------------------------
  // Stand-in motes in the travel overlay rise on the per-creature stagger keyed
  // by repo name (`animationDelay`). We feed the head of the destination
  // place's first plot (the same rows the place will show) so the raise reads
  // as "these creatures rising" rather than arbitrary motes. Empty places yield
  // an empty list and the overlay simply plays zoom/fog/title. These names are
  // read only when a transition is in flight.
  const travelNames =
    travelingTo === null ? [] : plots[0].slice(0, PLOT_SIZE).map((row) => row.name);

  // --- Map / place render switch (Req 1.1, 10.1, 10.2, 11.1) ---------------
  // With the lights off we render one of the two navigation levels: the estate
  // map when `view === "map"`, else the place view for the current place. Both
  // sit under the shared Header/Footer chrome so the username badge, summary,
  // Lights-on/Sound toggles, and footer legend appear on both levels (the
  // design's component tree shows Header/Footer on EstateMap and PlaceView
  // alike). The toggles are the same `Header`-owned controls the scene used, so
  // the existing Lights-on/Sound wiring and tests carry over unchanged. The
  // travel overlay plays over whichever view is shown during a map→place entry.
  return (
    <div
      data-testid="scene-view"
      data-lights-on="false"
      data-view={view}
      className="relative min-h-dvh w-full"
    >
      {/* Header chrome (frontmost), carrying the username badge, the summary,
          and the Lights-on / Sound toggles (Req 15 chrome; Req 10.6 toggle). */}
      <div className="absolute inset-x-0 top-0 z-50 p-4">
        <Header
          rows={rows}
          username={username ?? ""}
          mode={mode}
          lightsOn={lightsOn}
          onLightsOnChange={setLightsOn}
          soundOn={soundOn}
          onSoundChange={setSoundOn}
        />
      </div>

      {view === "map" ? (
        <EstateMap
          rows={rows}
          username={username ?? ""}
          mode={mode}
          turningSoon={turningSoon}
          whispers={whispers}
          onEnterPlace={onEnterPlace}
          onGoToTurningSoon={onGoToTurningSoon}
          reducedMotion={reducedMotion}
        />
      ) : (
        <PlaceView
          place={view}
          rows={placeRows}
          activeFilter={activeFilter}
          plotIndex={clampedPlotIndex}
          selectedName={selected}
          onFilterChange={setActiveFilter}
          onPlotChange={setPlotIndex}
          onSelect={handleSelect}
          onReturn={onReturn}
          filterHeroes={filterHeroes}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Footer chrome (plaque left, legend right) above the view. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
        <Footer mode={mode} />
      </div>

      {/* The travel overlay plays over the map/place view during the transition
          window and reports completion via `onTravelDone`. It is `aria-hidden`
          and never traps focus; arrival focus is moved by `onTravelDone`. */}
      {travelingTo !== null ? (
        <TravelTransition
          key={travelingTo}
          place={travelingTo}
          creatureNames={travelNames}
          reducedMotion={reducedMotion}
          onDone={onTravelDone}
        />
      ) : null}
    </div>
  );
}
