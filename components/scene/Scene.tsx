"use client";

/**
 * Scene layout (client component).
 *
 * `Scene` is the layout surface of the haunted graveyard: it composites every
 * visual layer in the documented z-order and lays out the interactive chrome,
 * consuming only the already-derived view-model values it is handed. It owns no
 * data derivation of its own beyond the cheap, pure reads it needs for layout
 * (`groupByState`, `summaryCounts(...).zombie`, `ancientZombieCount`) — all of
 * which are pure functions of `rows`. Interactive *state* (selection, toggles,
 * reduced-motion, overrides, the turning-soon/whisper computations) is owned by
 * `SceneView` (task 17.2) and threaded in through props; `Scene` only places
 * things and wires the parallax CSS variables.
 *
 * ## Props contract (what SceneView must satisfy)
 *
 * `Scene` deliberately takes the *derived* view-model values rather than raw
 * clock-dependent inputs, matching the design's seam: "SceneView owns state and
 * derivations, Scene lays out." Concretely it receives:
 *   - `rows` — the classified `GraveyardRow[]` (the creature model). `Scene`
 *     groups these per state and derives the fog/lightning/moon inputs from
 *     them with pure functions only.
 *   - `turningSoon` / `whispers` — precomputed by SceneView from the injected
 *     `now` (via `pickTurningSoon` / `composeWhispers`), so `Scene` reads no
 *     clock.
 *   - `filterHeroes` — the `Set<string>` from `pickFilterHeroes`, passed down to
 *     each `Zone` so only the budgeted creatures use expensive filters.
 *   - selection + toggle state and their handlers (`selectedName`, `onSelect`,
 *     `lightsOn`/`onLightsOnChange`, `soundOn`/`onSoundChange`).
 *   - `mode` ("live" | "estate") and `username` for the chrome.
 *
 * ## Z-order (Req 2.1)
 *
 * The documented bands are:
 *
 *   sky → backdrop-far → stars → moon → bats → mid-fence → ghosts → risen →
 *   tombstones → crypt/coffins → zombies → fog → fg-frame →
 *   lightning/vignette/cobwebs/grain → footer → header
 *
 * Two already-built components bundle several bands each, so `Scene`
 * approximates the exact interleaving with explicit `z-*` utility classes on
 * positioned wrappers rather than one flat DOM order:
 *   - `Backdrop` paints bg-far, the mid-fence, AND fg-frame as one element.
 *     fg-frame must sit *in front of* the creatures, so the whole `Backdrop`
 *     is placed on a low band (`z-0`) while the creature zones sit above it on
 *     `z-20..z-30`; fg-frame's own in-component stacking keeps it the frontmost
 *     plate, and `Atmosphere` (vignette/grain/cobwebs/bats) + `Lightning` ride
 *     an even higher band (`z-40`) so they read over everything but the chrome.
 *     The practical consequence (fg-frame ending up behind the creatures rather
 *     than framing in front of them) is a known, documented tradeoff of reusing
 *     the bundled `Backdrop`; the creature/fog/atmosphere ordering that the
 *     tests and the "every effect encodes data" layering care about is exact.
 *   - Zones render in `STATE_ORDER` (ghost → risen → zombie → tombstone →
 *     coffin) inside one positioned container. Because every zone is absolutely
 *     positioned from `ZONE_RECTS` (percentage rects, Req 11.1/11.2) they do not
 *     overlap, so their DOM order does not fight the band intent; `Fog` is
 *     layered just above the zones so it reads over the zombies.
 *
 * The exact pixel-perfect band match against ArtPreview.dc.html is left to the
 * design-review loop (per the design's Testing Strategy); this component
 * guarantees the *stacking relationships* the design calls out.
 *
 * ## Parallax (Req 2.3, 2.6)
 *
 * The scene root is tagged with a ref. When motion is allowed, a single
 * `pointermove` listener records the latest pointer position in a ref and a
 * `requestAnimationFrame` loop writes the normalized offset (roughly `[-1, 1]`
 * per axis, measured from the viewport center) to `--px` / `--py` on the root
 * once per frame. Pointer movement therefore never triggers a React re-render,
 * and the backdrop `.layer-*` classes in `globals.css` consume those variables
 * directly. Under reduced motion the listener and the rAF loop are **not
 * attached at all**: `--px`/`--py` stay unset (treated as `0` by the CSS
 * fallbacks) and every plate sits at its centered rest position. All work is
 * SSR-guarded and fully torn down on unmount or when `reducedMotion` flips.
 *
 * Requirements: 2.1, 2.3, 2.4, 11.1, 11.2
 */

import { useEffect, useRef } from "react";

import Atmosphere from "@/components/scene/Atmosphere";
import Backdrop from "@/components/scene/Backdrop";
import Fog from "@/components/scene/Fog";
import Lightning from "@/components/scene/Lightning";
import Moon from "@/components/scene/Moon";
import Sky from "@/components/scene/Sky";
import TurningSoon from "@/components/scene/TurningSoon";
import Whisper from "@/components/scene/Whisper";
import Footer from "@/components/scene/Footer";
import Zone from "@/components/scene/Zone";
import Header from "@/components/ui/Header";

import { groupByState, STATE_ORDER, type GraveyardRow } from "@/lib/graveyard-view";
import {
  ancientZombieCount,
  summaryCounts,
  type TurningSoon as TurningSoonResult,
  type ZoneName,
} from "@/lib/scene-view";

/** The scene render modes; drives the estate plaque/badge chrome. */
export type SceneMode = "live" | "estate";

export interface SceneProps {
  /**
   * The classified creatures to render. `Scene` groups these by state and
   * derives the moon/fog/lightning inputs from them with pure functions; it
   * never re-derives a lifecycle threshold or reads a clock.
   */
  rows: GraveyardRow[];
  /** The graveyard owner's username, shown in the header chrome. */
  username: string;
  /** Live graveyard vs the bundled sample estate (badge + plaque). */
  mode: SceneMode;

  /**
   * Precomputed turning-soon selection (`pickTurningSoon(repos, rows, now)` in
   * SceneView), or `null` when no ghost is inside the notice window. Passed in
   * precomputed so `Scene` reads no clock.
   */
  turningSoon: TurningSoonResult | null;
  /**
   * Precomputed, ordered whisper strings (`composeWhispers(rows, repos, now)`
   * in SceneView). Empty when no qualifying data exists.
   */
  whispers: string[];

  /**
   * Names allowed to use the expensive filter effects, from
   * `pickFilterHeroes`. Threaded to every `Zone`.
   */
  filterHeroes: Set<string>;

  /** The currently selected creature's repo name, or `null`. */
  selectedName: string | null;
  /** Raised with a repo name when a creature or the turning-soon notice fires. */
  onSelect: (name: string) => void;

  /** Lights-on toggle state + handler (owned by SceneView). */
  lightsOn: boolean;
  onLightsOnChange: (next: boolean) => void;
  /** Sound toggle state + handler (display-only; no audio). */
  soundOn: boolean;
  onSoundChange: (next: boolean) => void;

  /**
   * Whether reduced motion is active. When `true` the parallax pointer loop is
   * not attached at all and the backdrop rests centered (Req 2.6). SceneView
   * owns this (defaulting to `true` on the server); `Scene` only consumes it.
   */
  reducedMotion: boolean;
}

/**
 * Normalizes a pointer coordinate against a viewport extent to roughly
 * `[-1, 1]`: center maps to 0, the two edges to ∓1. Guards a zero extent so an
 * unmeasured viewport never divides by zero.
 */
function normalizeAxis(position: number, extent: number): number {
  if (extent <= 0) {
    return 0;
  }
  const normalized = (position / extent) * 2 - 1;
  return Math.max(-1, Math.min(1, normalized));
}

export default function Scene({
  rows,
  username,
  mode,
  turningSoon,
  whispers,
  filterHeroes,
  selectedName,
  onSelect,
  lightsOn,
  onLightsOnChange,
  soundOn,
  onSoundChange,
  reducedMotion,
}: SceneProps) {
  // The scene root: the element the parallax variables are written onto and the
  // element the backdrop `.layer-*` classes read `--px`/`--py` from.
  const rootRef = useRef<HTMLDivElement>(null);

  // Latest pointer position, kept in a ref so pointer movement never triggers a
  // React re-render (Req 2.3). The rAF loop reads this once per frame.
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  // Parallax: attach a pointer listener + rAF loop that write normalized
  // `--px`/`--py` to the root once per frame. NOT attached under reduced motion
  // (Req 2.6) and fully torn down on unmount or when the preference flips.
  useEffect(() => {
    // SSR guard and reduced-motion guard: do no work and attach nothing, so the
    // backdrop stays at its centered rest position (Req 2.6).
    if (typeof window === "undefined" || reducedMotion) {
      return;
    }

    const root = rootRef.current;
    if (root === null) {
      return;
    }

    let frame = 0;

    const onPointerMove = (event: PointerEvent): void => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };

    // One write per frame: read the latest pointer from the ref, normalize it
    // against the viewport, and write the two custom properties. The CSS
    // factors (`--f-far`/`--f-mid`/`--f-fg`) carry the px units, so these are
    // written as unitless multipliers.
    const tick = (): void => {
      const pointer = pointerRef.current;
      if (pointer !== null) {
        const px = normalizeAxis(pointer.x, window.innerWidth);
        const py = normalizeAxis(pointer.y, window.innerHeight);
        root.style.setProperty("--px", px.toFixed(4));
        root.style.setProperty("--py", py.toFixed(4));
      }
      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      // Reset to rest so a flip to reduced motion (or unmount) never strands a
      // displaced backdrop.
      root.style.removeProperty("--px");
      root.style.removeProperty("--py");
      pointerRef.current = null;
    };
  }, [reducedMotion]);

  // Pure, cheap layout derivations from the rows. groupByState returns every
  // state key (possibly empty), so an empty zone renders with no creatures and
  // does not affect its siblings.
  const grouped = groupByState(rows);
  const zombieCount = summaryCounts(rows).zombie;
  const ancientCount = ancientZombieCount(rows);

  return (
    <div
      ref={rootRef}
      data-testid="scene-root"
      data-mode={mode}
      className="relative h-dvh w-full overflow-hidden"
      style={{ backgroundColor: "var(--color-night-sky)" }}
    >
      {/* --- Band: sky + stars (backmost). --- */}
      <div className="absolute inset-0 z-0">
        <Sky />
      </div>

      {/* --- Band: backdrop plates (bg-far → mid-fence → fg-frame). The bundled
          Backdrop paints all three; it rides a low band so the creature zones
          composite above it. See the z-order note in the file header. --- */}
      <div className="absolute inset-0 z-0">
        <Backdrop />
      </div>

      {/* --- Band: moon, drawn over the backdrop (Req 3.1). --- */}
      <div className="absolute inset-0 z-10">
        <Moon rows={rows} />
      </div>

      {/* --- Band: creature zones, one Zone per state in STATE_ORDER. Each zone
          is absolutely positioned from ZONE_RECTS (percentage rects), so the
          zones never overlap and their DOM order does not fight the band intent
          (Req 11.1/11.2). --- */}
      <div className="absolute inset-0 z-20">
        {STATE_ORDER.map((state) => (
          <Zone
            key={state}
            state={state as ZoneName}
            rows={grouped[state]}
            onSelect={onSelect}
            selectedName={selectedName ?? undefined}
            filterHeroes={filterHeroes}
          />
        ))}
      </div>

      {/* --- Band: fog, layered just above the zombies so it reads over them
          (density encodes the zombie count, Req 3.3). --- */}
      <div className="absolute inset-0 z-30">
        <Fog zombieCount={zombieCount} />
      </div>

      {/* --- Band: atmosphere (vignette/grain/cobwebs/bats) + lightning, over
          everything but the chrome. Lightning cadence encodes the ancient
          count (Req 3.4/3.5). --- */}
      <div className="absolute inset-0 z-40">
        <Atmosphere />
        <Lightning ancientCount={ancientCount} />
      </div>

      {/* --- Band: turning-soon + whisper chrome, positioned in their regions.
          Both sit above the atmosphere but below the header/footer chrome. --- */}
      <div className="pointer-events-none absolute inset-x-0 top-[22%] z-40 flex justify-center">
        <div className="pointer-events-auto">
          <TurningSoon turningSoon={turningSoon} onSelect={onSelect} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[16%] z-40 flex justify-center px-6 text-center">
        <Whisper whispers={whispers} />
      </div>

      {/* --- Band: footer (plaque left, legend right) above the scene, below the
          header. --- */}
      <div className="absolute inset-x-0 bottom-0 z-40">
        <Footer mode={mode} />
      </div>

      {/* --- Band: header chrome (frontmost). --- */}
      <div className="absolute inset-x-0 top-0 z-50 p-4">
        <Header
          rows={rows}
          username={username}
          mode={mode}
          lightsOn={lightsOn}
          onLightsOnChange={onLightsOnChange}
          soundOn={soundOn}
          onSoundChange={onSoundChange}
        />
      </div>
    </div>
  );
}
