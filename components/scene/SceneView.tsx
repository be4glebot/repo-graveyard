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

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import EstateMap from "@/components/scene/EstateMap";
import Footer from "@/components/scene/Footer";
import LightsOnTable from "@/components/scene/LightsOnTable";
import PlaceView from "@/components/scene/PlaceView";
import { TravelRunner } from "@/components/scene/TravelTransition";
import HoverCardLayer from "@/components/detail/HoverCardLayer";
import DetailPanel from "@/components/detail/DetailPanel";
import { useRepoDeepLink } from "@/components/detail/useRepoDeepLink";
import {
  HoverCardProvider,
  useHoverCardActions,
  type HoverCardActions,
} from "@/components/detail/HoverCardProvider";
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
import { buildRepoRows } from "@/lib/repoRow";
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
  /**
   * Estate-only pre-written séances (repo name → unvalidated séance result).
   * Live pages pass nothing.
   */
  seanceFixtures?: Record<string, unknown>;
}

export default function SceneView({
  rows: serverRows,
  repos: allRepos,
  truncated,
  username,
  renderedAt,
  mode,
  initialRepo,
  at,
  estateOverrides,
  seanceFixtures,
}: SceneViewProps) {
  // `truncated` is part of the loader contract and the props shape but is not
  // surfaced by the scene chrome yet (the scene has no 300-repo notice of its
  // own). Reference it defensively so the prop stays wired without an unused
  // warning; the Lights-on register already shows the full capped set.
  void truncated;

  const isEstate = mode === "estate";

  // --- Validation precedes classification (Req 1.8) -------------------------
  // FIRST pipeline stage: validate every record into a `RepoRow`, skipping (and
  // warning on) invalid ones. Only repos that produced a valid row flow into
  // classification (`buildRows`) and the other derivations, so a skipped repo
  // has neither a creature nor a row. No threshold or classification change.
  const repoRows = useMemo(() => buildRepoRows(allRepos), [allRepos]);
  // `RepoRow` lookup keyed by name, shared by the hover card and detail panel.
  const repoRowsByName = useMemo(
    () => new Map(repoRows.map((row) => [row.name, row] as const)),
    [repoRows],
  );
  const repos = useMemo(
    () => allRepos.filter((repo) => repoRowsByName.has(repo.name)),
    [allRepos, repoRowsByName],
  );
  const initialRows = useMemo(
    () => serverRows.filter((row) => repoRowsByName.has(row.name)),
    [serverRows, repoRowsByName],
  );
  // Exposed for the detail surfaces wired in later tasks (7.x/9.x/11.x).
  void repoRowsByName;

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

  // Whether the detail panel is open for `selected`. Distinct from `selected`
  // (which also drives the aria-pressed highlight and deep-link pre-selection),
  // so a deep link highlights a creature without auto-opening the panel.
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  // Filled by `SceneHoverBridge` so close handlers can reach the hover actions.
  const hoverActionsRef = useRef<HoverCardActions | null>(null);

  // State-only open/close; history is handled by `useRepoDeepLink` (Req 8).
  const openPanelState = useCallback((name: string): void => {
    setSelected(name);
    setPanelOpen(true);
  }, []);

  const closePanelState = useCallback((): void => {
    // Must run BEFORE the panel unmounts: its cleanup restores focus to the
    // opener synchronously, which would otherwise reopen a hover card.
    hoverActionsRef.current?.suppressNextFocusOpen();
    setPanelOpen(false);
  }, []);

  const deepLink = useRepoDeepLink({
    rows: repoRows,
    panelOpen,
    onOpenState: openPanelState,
    onCloseState: closePanelState,
  });
  const { handlePopState: handleRepoPopState } = deepLink;

  const handleSelect = (name: string): void => {
    deepLink.open(name);
  };

  const handleClosePanel = deepLink.close;

  const getFallbackFocus = useCallback(
    (): HTMLElement | null =>
      document.querySelector<HTMLElement>('[data-testid="place-heading"]') ??
      document.querySelector<HTMLElement>('[data-testid="map-heading"]'),
    [],
  );

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
  // The in-flight travel transition, or `null` when none is running. It carries
  // the view we are leaving (`from`), the view we are entering (`to`), the
  // `place` whose centre is the zoom origin, and the pull `direction`. CRUCIAL
  // (visual fix r3 travel): the committed nav `view` is NOT flipped on click \u2014
  // the source view stays mounted and zooms; the `TravelRunner` reports the CUT
  // (under the fog) via `onCutTravel`, and only THEN is `view` switched to the
  // destination. `onTravelDone` clears the travel and moves arrival focus. The
  // URL is pushed immediately on click so the place stays shareable.
  const [travel, setTravel] = useState<{
    from: "map" | PlaceId;
    to: "map" | PlaceId;
    place: PlaceId;
    direction: "in" | "out";
  } | null>(null);

  // Remembers the place link the user travelled FROM so returning to the map can
  // move focus back to it (fallback: the map heading, Req 13.7).
  const originPlaceRef = useRef<PlaceId | null>(null);

  /**
   * Enter a place from the map: push one history entry carrying `?at=place`
   * (shareable immediately, Req 10.5), then start the inward "pulled in" travel.
   * `view` is left on the map so the REAL map zooms; it is switched to the place
   * at the cut (`onCutTravel`). Interactive state is left intact (Req 10.7).
   */
  const onEnterPlace = useCallback((place: PlaceId): void => {
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}?at=${place}`;
      window.history.pushState({ view: place }, "", url);
    }
    originPlaceRef.current = place;
    setTravel({ from: "map", to: place, place, direction: "in" });
  }, []);

  /**
   * The CUT: fired by `TravelRunner` while the fog fully covers the screen.
   * Commits the mounted view switch to the travel destination, so the REAL
   * destination view mounts and animates in for the second half.
   */
  const onCutTravel = useCallback((): void => {
    setTravel((current) => {
      if (current) {
        setView(current.to);
      }
      return current;
    });
  }, []);

  /**
   * End of travel (or a skip): clear the transition and move arrival focus \u2014 to
   * the place heading on an INWARD travel, or back to the originating place link
   * (fallback: the map heading) on an OUTWARD one (Req 13.3/13.5/13.7). Focus is
   * deferred to the next frame so the destination view has rendered.
   */
  const onTravelDone = useCallback((): void => {
    setTravel((current) => {
      const direction = current?.direction ?? "in";
      const origin = originPlaceRef.current;
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          if (direction === "in") {
            document
              .querySelector<HTMLElement>('[data-testid="place-heading"]')
              ?.focus();
          } else {
            const target =
              (origin &&
                document.querySelector<HTMLElement>(
                  `[data-testid="estate-place-${origin}"]`,
                )) ||
              document.querySelector<HTMLElement>('[data-testid="map-heading"]');
            target?.focus();
          }
          if (direction === "out") {
            originPlaceRef.current = null;
          }
        }, 0);
      }
      return null;
    });
  }, []);

  /**
   * Return to the map: push one history entry whose URL omits `at` (Req 10.6),
   * then start the REVERSE "pulled out" travel from the current place back to the
   * map (visual fix r3 #4). `view` stays on the place so the REAL place zooms
   * out; it switches to the map at the cut. Interactive state is not reset
   * (Req 10.7); arrival focus is handled by `onTravelDone`.
   */
  const onReturn = useCallback((): void => {
    if (typeof window !== "undefined") {
      window.history.pushState({ view: "map" }, "", window.location.pathname);
    }
    const origin = originPlaceRef.current;
    // `from` is whatever place we are currently in; prefer the recorded origin,
    // else fall back to the gate so the overlay always has a centre.
    const fromPlace = origin ?? "gate";
    setTravel({ from: fromPlace, to: "map", place: fromPlace, direction: "out" });
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
      // Back/forward also syncs the detail panel with `?repo=` (Req 8.5). A
      // panel-only traversal leaves the place view as it is.
      if (handleRepoPopState()) {
        return;
      }
      setView(fromState ?? fromUrl ?? "map");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [handleRepoPopState]);

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

  // --- Map / place render switch (Req 1.1, 10.1, 10.2, 11.1) ---------------
  //
  // `renderSceneView` builds the REAL map or place view for a view identity,
  // threading an optional `travel` hint so a view can fade its own sub-parts
  // during a transition (the map fades its NON-target place links; the place
  // fades its chrome in last) and pause its pointer parallax. `SceneView`
  // renders this directly when idle, or hands the `from`/`to` views to
  // `TravelRunner` (which wraps the mounted one in the zoom `travel-stage`).
  const renderSceneView = (
    which: "map" | PlaceId,
    travelHint?: { active: boolean; targetPlace: PlaceId },
  ): React.ReactNode => {
    if (which === "map") {
      return (
        <EstateMap
          rows={rows}
          username={username ?? ""}
          mode={mode}
          turningSoon={turningSoon}
          whispers={whispers}
          onEnterPlace={onEnterPlace}
          onGoToTurningSoon={onGoToTurningSoon}
          reducedMotion={reducedMotion}
          lightsOn={lightsOn}
          travel={travelHint}
        />
      );
    }
    return (
      <PlaceView
        place={which}
        rows={which === view ? placeRows : rows.filter((r) => placeOf(r) === which)}
        activeFilter={activeFilter}
        plotIndex={clampedPlotIndex}
        selectedName={selected}
        onFilterChange={setActiveFilter}
        onPlotChange={setPlotIndex}
        onSelect={handleSelect}
        onReturn={onReturn}
        filterHeroes={filterHeroes}
        reducedMotion={reducedMotion}
        lightsOn={lightsOn}
        travel={travelHint ? { active: travelHint.active } : undefined}
      />
    );
  };

  // With the lights off we render one of the two navigation levels: the estate
  // map when `view === "map"`, else the place view for the current place. Both
  // With the lights off we render one of the two navigation levels: the estate
  // map when `view === "map"`, else the place view for the current place. Both
  // sit under the shared Header/Footer chrome so the username badge, summary,
  // Lights-on/Sound toggles, and footer legend appear on both levels (the
  // design's component tree shows Header/Footer on EstateMap and PlaceView
  // alike). The toggles are the same `Header`-owned controls the scene used, so
  // the existing Lights-on/Sound wiring and tests carry over unchanged. The
  // travel overlay plays over whichever view is shown during a map→place entry.
  // Classification lookup for the hover card (built from the classified rows).
  const classificationsByName = new Map(
    rows.map(
      (row) =>
        [row.name, { state: row.state, decayLevel: row.decayLevel }] as const,
    ),
  );

  const panelRow =
    panelOpen && selected !== null ? repoRowsByName.get(selected) : undefined;
  const panelClassification =
    panelRow !== undefined ? classificationsByName.get(panelRow.name) : undefined;
  const panelFacts =
    panelRow !== undefined
      ? repos.find((repo) => repo.name === panelRow.name)
      : undefined;
  const panelOverride =
    panelRow !== undefined ? overrides[panelRow.name] : undefined;
  const panelRevivedAt =
    panelOverride?.type === "revived" ? panelOverride.setAt : undefined;

  return (
    <HoverCardProvider>
    <SceneHoverBridge
      suppressed={panelOpen || travel !== null}
      actionsRef={hoverActionsRef}
    />
    <div
      id="scene-root"
      data-testid="scene-view"
      data-lights-on="false"
      data-view={view}
      className="relative min-h-dvh w-full"
    >
      {/* Header chrome (frontmost), carrying the username badge, the summary,
          and the Lights-on / Sound toggles (Req 15 chrome; Req 10.6 toggle).
          Occupies the fixed `--site-header-h` band at the top; the place chrome
          offsets itself below this band so the two never overlap (visual fix 2C). */}
      <div
        data-testid="site-header"
        className="pointer-events-none absolute inset-x-0 top-0 z-50 min-h-[var(--site-header-h)] p-4 max-[767px]:min-h-0"
      >
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

      {travel === null ? (
        renderSceneView(view)
      ) : (
        <TravelRunner
          key={`${travel.direction}-${travel.place}`}
          place={travel.place}
          direction={travel.direction}
          reducedMotion={reducedMotion}
          from={renderSceneView(travel.from, {
            active: true,
            targetPlace: travel.place,
          })}
          to={renderSceneView(travel.to, {
            active: true,
            targetPlace: travel.place,
          })}
          onCut={onCutTravel}
          onDone={onTravelDone}
        />
      )}

      {/* Footer chrome (plaque left, legend right) above the view. It sits
          OUTSIDE the travel stage so it — like the site header / toggles — stays
          fixed and unzoomed during a travel transition. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
        <Footer mode={mode} />
      </div>
    </div>
    <HoverCardLayer
      rowsByName={repoRowsByName}
      owner={username ?? ""}
      classificationsByName={classificationsByName}
      renderedAt={renderedAt}
      isFixture={mode === "estate"}
    />
    {panelRow && panelClassification && panelFacts && (
      <DetailPanel
        row={panelRow}
        owner={username ?? ""}
        classification={panelClassification}
        facts={panelFacts}
        renderedAt={renderedAt}
        isFixture={mode === "estate"}
        seanceFixture={
          mode === "estate" ? seanceFixtures?.[panelRow.name] : undefined
        }
        revivedAt={panelRevivedAt}
        onClose={handleClosePanel}
        sceneRootId="scene-root"
        getFallbackFocus={getFallbackFocus}
      />
    )}
    </HoverCardProvider>
  );
}

/**
 * Lives inside `HoverCardProvider` so it can reach the hover actions. Keeps the
 * hover card suppressed (and closed) while the panel is open or a travel runs,
 * and exposes the actions to SceneView through a ref.
 */
function SceneHoverBridge({
  suppressed,
  actionsRef,
}: {
  suppressed: boolean;
  actionsRef: MutableRefObject<HoverCardActions | null>;
}) {
  const actions = useHoverCardActions();
  useEffect(() => {
    actionsRef.current = actions;
    return () => {
      actionsRef.current = null;
    };
  }, [actions, actionsRef]);
  useEffect(() => {
    // setSuppressed(true) also calls closeNow().
    actions.setSuppressed(suppressed);
  }, [actions, suppressed]);
  return null;
}
