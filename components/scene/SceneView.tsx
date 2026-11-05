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
 *   - `selected: string | null` — the single selected creature's repo name.
 *     Initialized once via `selectInitialCreature(rows, initialRepo)` for
 *     case-insensitive deep-link pre-selection (Req 1.2/1.3); set by a creature
 *     activation or the turning-soon notice; single-select, so choosing another
 *     replaces the previous (Req 9.6, 7.9). The initializer runs against the
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
 * Requirements: 1.2, 1.3, 6.9, 7.8, 8.2, 10.1, 10.5, 10.6, 13.1, 13.2, 13.3
 */

import { useEffect, useState } from "react";

import LightsOnTable from "@/components/scene/LightsOnTable";
import Scene from "@/components/scene/Scene";
import Toggle from "@/components/ui/Toggle";

import { buildRows, type GraveyardRow } from "@/lib/graveyard-view";
import type { Override, RepoFacts } from "@/lib/lifecycle";
import { readOverrides, type OverrideMap } from "@/lib/overrides";
import {
  composeWhispers,
  pickFilterHeroes,
  pickTurningSoon,
  selectInitialCreature,
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

  // --- Selection -----------------------------------------------------------
  // Initialize once from the FIRST-render rows (lazy initializer) so the deep
  // link resolves against hydration-stable markup. Later overrides may change a
  // creature's state but not its name, so the initial selection stays valid.
  const [selected, setSelected] = useState<string | null>(() =>
    selectInitialCreature(initialRows, initialRepo),
  );

  // Single-select: activating a creature or the turning-soon notice replaces the
  // previous selection (Req 9.6, 7.9).
  const handleSelect = (name: string): void => {
    setSelected(name);
  };

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

  // --- Toggles -------------------------------------------------------------
  const [lightsOn, setLightsOn] = useState<boolean>(false);
  // Display-only; flipping it loads/plays no audio (Req 13.1/13.2/13.3).
  const [soundOn, setSoundOn] = useState<boolean>(false);

  // --- Clock-dependent derivations (pure, from the current rows + repos) ---
  const turningSoon = pickTurningSoon(repos, rows, renderedAt);
  const whispers = composeWhispers(rows, repos, renderedAt);
  const filterHeroes = pickFilterHeroes(rows, {
    selected,
    turningSoon: turningSoon?.name ?? null,
  });

  // --- Lights-on readable register -----------------------------------------
  // When the lights are on we show the paper-register table INSTEAD of the
  // scene (Req 10.1): no parallax, atmosphere, motion, or whispers. The table
  // carries no toggle of its own, so a thin control bar above it holds the same
  // Lights-on toggle (so the reader can return to the scene with the same data,
  // Req 10.6) plus the display-only sound toggle for parity.
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

  return (
    <div data-testid="scene-view" data-lights-on="false">
      <Scene
        rows={rows}
        username={username ?? ""}
        mode={mode}
        turningSoon={turningSoon}
        whispers={whispers}
        filterHeroes={filterHeroes}
        selectedName={selected}
        onSelect={handleSelect}
        lightsOn={lightsOn}
        onLightsOnChange={setLightsOn}
        soundOn={soundOn}
        onSoundChange={setSoundOn}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
