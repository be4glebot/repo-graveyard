"use client";

/**
 * Depth scatter (client component) — organic seeded creature placement.
 *
 * Replaces the *usage* of `DepthRows`' flex-row flow with `scatterLayout`'s
 * absolute scatter: every creature in the plot is positioned at its own
 * seeded `x`/`y` (fractions of the plot box), sized by its depth-band `scale`,
 * and dimmed by its depth-band `brightness`, with exactly `round(n / 3)`
 * creatures horizontally mirrored. A single plaque layer, stacked above every
 * creature and above the near fog, carries one `Plaque` per creature so names
 * always read on top of the scene (Req 5.1, 5.8, 5.11).
 *
 * `DepthRows.tsx` is intentionally retained (Req 8.2/8.3); this component is
 * simply the new renderer `PlaceView` points at.
 *
 * ## Two stacked layers (Req 5.11)
 *
 *   1. **Creatures layer (z 20).** Each creature is absolutely positioned at
 *      `left: x * 100%` / `top: y * 100%`, centred on that point, scaled by
 *      `scale`, and brightness-filtered by `brightness`. A `mirrored` record
 *      gets `scaleX(-1)` applied **only to the creature image** — never to the
 *      plaque — so a flipped creature still has a left-to-right-readable name.
 *      Ground tombstones additionally rotate by the record's seeded `tilt`
 *      (Req 5.8). Creatures keep their existing per-creature motion components.
 *   2. **Plaque layer (z 30).** A sibling layer rendered *after* the creatures
 *      layer, so it paints above both the creatures (z 20) and the near fog
 *      `Fog_Thin` (z 25). One `Plaque` per creature, positioned at the same `x`
 *      just below the creature's centre, and **never** mirrored.
 *
 * Both layers are `pointer-events-none` at the layer level; the creature shell
 * (`Creature`) re-enables pointer events on its own interactive button so
 * clicks still land on creatures and nothing else swallows them.
 *
 * ## Width branch + gate wander (task 8.2, Req 5.9/5.10/5.12–5.14)
 *
 * A `ResizeObserver` reads the plot container's width (SSR-guarded; defaults to
 * the ≥768px scatter branch until measured). At **≥ `MOBILE_BREAKPOINT` (768)**
 * the seeded `scatterLayout` positions are used verbatim. **Below 768px** a
 * deterministic **two-column staggered layout** replaces the `x`/`y` fractions:
 * creatures alternate between a left and a right column and every creature gets
 * its own vertical slot, so no two plaque rectangles ever share both an
 * x-band and a y-band — guaranteeing no plaque overlap on narrow viewports the
 * same way the scatter grid does on wide ones (Req 5.10). Scale, brightness,
 * mirrored, and tilt still come from the same `scatterLayout` record so the
 * data encoding is identical in both branches.
 *
 * At the **gate** with `reducedMotion` inactive, **fresh** zombies (decay 0)
 * get a `translateX`-only horizontal **wander** — displacement 8–24px around
 * their placed `x`, with a per-creature seeded duration 7–12s and seeded start
 * delay — applied on a dedicated wrapper *outside* the creature's own motion so
 * it never touches the mirror flip or the plaque (Req 5.12, 9.1). Decay 1–4
 * zombies keep their existing lurch/twitch (their creature component is
 * unchanged). With `reducedMotion` active the wander class is omitted so fresh
 * zombies render at their placed `x` with no wander (Req 5.14).
 *
 * Requirements: 5.1, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 9.1
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";

import { type GraveyardRow } from "@/lib/graveyard-view";
import { type LifecycleState } from "@/lib/lifecycle";
import { dayCopy } from "@/lib/day-copy";
import type { Theme } from "@/lib/theme-art";
import { useTheme } from "@/components/scene/ThemeProvider";
import {
  CREATURE_BASE_SIZE,
  DEPTH_ROWS,
  COMPACT_CHROME_FALLBACK_PX,
  stageBand,
  GHOST_DECAY_WORDS,
  ZOMBIE_DECAY_WORDS,
  compactStackLayout,
  resolvePlacement,
  scatterLayout,
  type PlaceId,
  type ResolvedPlacement,
  type ScatterPlacement,
  type SceneRect,
  type StageBandPx,
} from "@/lib/estate-view";

import Ghost from "@/components/creatures/Ghost";
import Risen from "@/components/creatures/Risen";
import Zombie from "@/components/creatures/Zombie";
import Tombstone from "@/components/creatures/Tombstone";
import Coffin from "@/components/creatures/Coffin";
import Plaque from "@/components/ui/Plaque";
import { hoverCardId } from "@/components/detail/HoverCardLayer";
import { useOptionalHoverCardActions } from "@/components/detail/HoverCardProvider";

/** Shared prop shape the five concrete creature components expose. */
interface ConcreteCreatureProps {
  row: GraveyardRow;
  onSelect?: (name: string) => void;
  selected?: boolean;
  filterHero?: boolean;
  style?: CSSProperties;
  onHoverStart?: (name: string, anchor: HTMLElement) => void;
  onHoverEnd?: (name: string) => void;
  onFocusStart?: (name: string, anchor: HTMLElement) => void;
  onBlurEnd?: (name: string) => void;
  hoverCardId?: string;
}

/** Maps a lifecycle state to the concrete creature component that renders it. */
const CREATURE_BY_STATE: Record<
  LifecycleState,
  ComponentType<ConcreteCreatureProps>
> = {
  ghost: Ghost,
  risen: Risen,
  zombie: Zombie,
  tombstone: Tombstone,
  coffin: Coffin,
};

// --- Seeded wander parameters for fresh gate zombies (Req 5.12) ------------
//
// The wander displacement (8-24px), duration (7-12s), and start delay are
// derived deterministically from the creature name via a tiny inline string
// hash so the same creature always wanders the same way (no clock, no RNG
// library). This mirrors `scatterLayout`'s per-name seeding without widening
// the estate-view export surface; only the gate fresh-zombie branch uses it.

/** Wander displacement bounds in px around the placed `x` (Req 5.12). */
const WANDER_DX_MIN = 8;
const WANDER_DX_MAX = 24;

/** Wander cycle duration bounds in seconds (Req 5.12). */
const WANDER_DUR_MIN = 7;
const WANDER_DUR_MAX = 12;

/** Upper bound (seconds) for the seeded start delay so phases desynchronise. */
const WANDER_DELAY_MAX = 6;

/** The CSS custom properties the `.gate-wander` keyframe reads. */
interface WanderVars extends CSSProperties {
  "--wander-dx": string;
  "--wander-dur": string;
  "--wander-delay": string;
}

/**
 * Tiny pure string hash (FNV-1a style) producing three independent unit floats
 * in [0, 1) from one name. Deterministic and clock-free: equal names yield
 * equal triples. Used only to seed the fresh-zombie wander parameters.
 */
function wanderSeeds(name: string): [number, number, number] {
  // Fold the name into a 32-bit accumulator, snapshotting it at three offsets
  // so the three draws are independent of one another.
  let h = 2166136261 >>> 0;
  const snaps: number[] = [];
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
    if (i === Math.floor(name.length / 3) || i === Math.floor((2 * name.length) / 3)) {
      snaps.push(h >>> 0);
    }
  }
  snaps.push(h >>> 0);
  // Ensure three snapshots even for very short names by re-mixing the final one.
  while (snaps.length < 3) {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    snaps.push(h >>> 0);
  }
  return [
    (snaps[0] % 100000) / 100000,
    (snaps[1] % 100000) / 100000,
    (snaps[2] % 100000) / 100000,
  ];
}

/**
 * Builds the seeded `--wander-*` CSS variables for a fresh gate zombie named
 * `name`: a displacement in [8, 24]px, a duration in [7, 12]s, and a start
 * delay in [0, WANDER_DELAY_MAX]s, all deterministic in `name` (Req 5.12).
 */
function wanderVars(name: string): WanderVars {
  const [dxU, durU, delayU] = wanderSeeds(name);
  const dx = WANDER_DX_MIN + dxU * (WANDER_DX_MAX - WANDER_DX_MIN);
  const dur = WANDER_DUR_MIN + durU * (WANDER_DUR_MAX - WANDER_DUR_MIN);
  const delay = delayU * WANDER_DELAY_MAX;
  return {
    "--wander-dx": `${dx.toFixed(2)}px`,
    "--wander-dur": `${dur.toFixed(2)}s`,
    "--wander-delay": `${delay.toFixed(2)}s`,
  };
}

/**
 * Whether a row is a FRESH zombie (decay level 0) — the only rows that wander at
 * the gate. A null / non-finite / negative level is treated as fresh (0),
 * mirroring `Zombie`'s own decay clamp so art and motion agree. Decay 1–4 keep
 * their existing lurch/twitch (Req 5.13).
 */
function isFreshZombie(row: GraveyardRow): boolean {
  if (row.state !== "zombie") {
    return false;
  }
  const level = row.decayLevel;
  return level === null || !Number.isFinite(level) || Math.trunc(level) <= 0;
}

export interface DepthScatterProps {
  /** Which place this plot belongs to (seeds the layout; gates ground tilt). */
  place: PlaceId;
  /** The current plot's creatures, pre-ordered by `orderForPlace`. */
  plot: GraveyardRow[];
  /** The currently selected creature's repo name, or `null`. */
  selectedName: string | null;
  /** Raised with a repo name when a creature is activated. */
  onSelect: (name: string) => void;
  /** Names allowed the expensive filter effects (from `pickFilterHeroes`). */
  filterHeroes?: Set<string>;
  /** Whether reduced motion is active (gates the gate fresh-zombie wander). */
  reducedMotion: boolean;
  /**
   * Optional style for the PLAQUE layer only (visual fix r3 travel): PlaceView
   * passes `{ opacity: "var(--travel-chrome-fade, 1)" }` so the plaques fade in
   * with the rest of the place chrome during a travel transition, while the
   * creatures underneath keep animating in. Defaults to no extra style.
   */
  plaqueStyle?: CSSProperties;
  /**
   * Minimum top edge (px, in the scatter box's coordinates) for every creature
   * and plaque rect on the desktop branch: `max(sceneH / 3, chromeBottomPx)`
   * from `PlaceView`. Defaults to `sceneH / 3` when omitted. Passed to
   * `resolvePlacement`; the compact branch ignores it (it uses `compactBand`).
   */
  topLimitPx?: number;
  /**
   * Whether the viewport is compact (from `useIsCompact`, the single source of
   * truth). When true the layout is ALWAYS `compactStackLayout`; the desktop
   * branches never run. Width measurements are never used to decide this.
   */
  compact?: boolean;
  /**
   * Stage band (px, scene coordinates) for the compact layout. When omitted
   * while `compact`, a fallback band is derived from
   * `COMPACT_CHROME_FALLBACK_PX` and the scene height.
   */
  compactBand?: StageBandPx;
}

/**
 * Reads the plaque sub-line for a row: a short decay/state word that sits below
 * the name on the plaque. Ghosts and zombies show their decay-band word (from
 * the place's decay-word array, indexed by the row's existing `decayLevel` — no
 * threshold recomputed); the risen, tombstones, and coffins show a fixed state
 * word. Total: an out-of-band or null `decayLevel` falls back to the state.
 */
function plaqueSub(row: GraveyardRow, theme: Theme): string {
  switch (row.state) {
    case "ghost":
      return decayWordOr(GHOST_DECAY_WORDS, row.decayLevel, "ghost");
    case "zombie":
      return decayWordOr(ZOMBIE_DECAY_WORDS, row.decayLevel, "zombie");
    case "risen":
      return "risen";
    case "tombstone":
      return dayCopy(theme, "plaque.tombstone");
    case "coffin":
      return dayCopy(theme, "plaque.coffin");
    default: {
      // Exhaustiveness guard: a new lifecycle state fails to compile here.
      const _exhaustive: never = row.state;
      return _exhaustive;
    }
  }
}

/**
 * Indexes a decay-word array by a (possibly null / out-of-band) `decayLevel`,
 * falling back to `fallback` when the level is missing or out of range so the
 * sub-line is always a well-formed word.
 */
function decayWordOr(
  words: readonly string[],
  decayLevel: number | null,
  fallback: string,
): string {
  if (
    decayLevel === null ||
    !Number.isFinite(decayLevel) ||
    decayLevel < 0 ||
    decayLevel >= words.length
  ) {
    return fallback;
  }
  return words[Math.trunc(decayLevel)];
}

/**
 * Observes the plot container's width through a `ResizeObserver`, returning
 * `true` once the measured width is below `MOBILE_BREAKPOINT` (768px). SSR-safe:
 * returns `false` (the scatter branch) until a measurement lands, so the server
 * render and the first client paint both use the ≥768px scatter positions and
 * only switch to the two-column layout after measuring a narrow container.
 * Guards the absence of `ResizeObserver` (older/SSR environments) by reading the
 * initial `clientWidth` once.
 */
interface SceneBox {
  /** Measured scatter-container width in px (0 until first measurement). */
  width: number;
  /** Measured scatter-container height in px (0 until first measurement). */
  height: number;
}

/**
 * Observes the scatter container's WIDTH and HEIGHT through a `ResizeObserver`.
 * The width still drives the <768px mobile branch; the height is needed by the
 * pure `resolvePlacement` geometry (row pitch, creature-height cap) so the
 * creature + plaque sizing matches the no-overlap property exactly (visual fix
 * r3 #2/#3). SSR-safe: returns `{0,0}` until a measurement lands, so the server
 * render and first client paint use the un-resolved scatter positions and only
 * switch once a real box is measured. Guards the absence of `ResizeObserver`.
 */
function useSceneBox(ref: React.RefObject<HTMLElement | null>): SceneBox {
  const [box, setBox] = useState<SceneBox>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    const measure = (width: number, height: number): void => {
      setBox((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };
    // Initial synchronous read so the first committed layout is correct even
    // before the observer fires.
    measure(el.clientWidth, el.clientHeight);

    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        measure(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return box;
}

export default function DepthScatter({
  place,
  plot,
  selectedName,
  onSelect,
  filterHeroes,
  reducedMotion,
  plaqueStyle,
  topLimitPx,
  compact = false,
  compactBand,
}: DepthScatterProps) {
  const { theme } = useTheme();
  // Compute the scatter layout once per (plot, place). The seed is the place id
  // so each place scatters deterministically and differently; the names are the
  // plot's rows in order, so the i-th placement pairs with the i-th creature.
  const placements = useMemo<ScatterPlacement[]>(
    () => scatterLayout(plot.map((row) => row.name), DEPTH_ROWS, place, place),
    [plot, place],
  );

  // Measure the scatter container (width AND height). Width drives the <768px
  // mobile branch; height feeds the pure `resolvePlacement` geometry so the
  // rendered creature/plaque sizing matches the no-overlap property exactly
  // (visual fix r3 #2/#3).
  const rootRef = useRef<HTMLDivElement>(null);

  // Stable hover-card callbacks (null outside a provider). DepthScatter does
  // NOT subscribe to open state, so opening/closing a card never re-renders it.
  const hover = useOptionalHoverCardActions();

  // A plaque at rest maps to the same intent as its creature; the anchor is
  // the creature's button so the card positions identically either way.
  const creatureButton = (name: string): HTMLElement | null => {
    const root = rootRef.current;
    if (root === null) return null;
    const wrappers = root.querySelectorAll<HTMLElement>(
      '[data-testid="scatter-creature"]',
    );
    for (const w of Array.from(wrappers)) {
      if (w.dataset.name === name) return w.querySelector<HTMLElement>("button");
    }
    return null;
  };
  const { width: sceneW, height: sceneH } = useSceneBox(rootRef);
  // Compact is decided ONLY by the `compact` prop. Measured sizes feed layout
  // math; when unmeasured (0) fall back to the viewport, then a safe default.
  const isMobile = compact;
  const layoutW =
    sceneW > 0
      ? sceneW
      : typeof window !== "undefined" && window.innerWidth > 0
        ? window.innerWidth
        : 375;
  const layoutH =
    sceneH > 0
      ? sceneH
      : typeof window !== "undefined" && window.innerHeight > 0
        ? window.innerHeight
        : 812;
  const fallbackBand = stageBand(
    layoutH,
    COMPACT_CHROME_FALLBACK_PX.header +
      COMPACT_CHROME_FALLBACK_PX.returnLink +
      COMPACT_CHROME_FALLBACK_PX.titleBlock +
      COMPACT_CHROME_FALLBACK_PX.chips,
    layoutH - COMPACT_CHROME_FALLBACK_PX.bottomBar,
  );
  const bandTop = compactBand?.top ?? fallbackBand.top;
  const bandBottom = compactBand?.bottom ?? fallbackBand.bottom;

  const isGround = place === "ground";
  const isGate = place === "gate";

  // Resolve every creature's final on-screen geometry (visual fix r3 #2/#3):
  //
  //   - Mobile (<768px): keep the two-column staggered positions (already
  //     overlap-safe by construction) at full scale \u2014 no height cap needed.
  //   - Desktop, measured: run the pure `resolvePlacement` FRONT rows first
  //     (largest `row` index), accumulating each resolved plaque + the UPPER 60%
  //     of each resolved creature as obstacles, so a back-row plaque is placed
  //     clear of nearer creatures' heads/torsos and of every other plaque. This
  //     is the SAME math the no-overlap property verifies.
  //   - Desktop, pre-measurement (SSR / first paint): fall back to the raw
  //     scatter positions at full scale so hydration stays stable.
  //
  // Each entry carries the feet x/y fraction, the plaque centre x/y fraction,
  // and the effective render scale (base scale times any height-cap shrink).
  interface Resolved {
    feetX: number;
    feetY: number;
    plaqueX: number;
    plaqueY: number;
    effectiveScale: number;
    /** Compact only: the layout's plaque width (px) the DOM must honor. */
    plaqueWidthPx?: number;
  }

  // The UPPER 60% (head + torso) of a creature rect — the part the no-overlap
  // property protects from plaques; the bottom 40% (legs/feet) may overlap.
  const upper60 = (c: SceneRect): SceneRect => ({
    ...c,
    bottom: c.top + (c.bottom - c.top) * 0.6,
  });

  const resolved = useMemo<Resolved[]>(() => {
    const out: Resolved[] = new Array(plot.length);

    if (isMobile) {
      const stacked = compactStackLayout(
        placements,
        layoutW,
        { top: bandTop, bottom: bandBottom },
        layoutH,
      );
      const H = layoutH;
      for (let i = 0; i < plot.length; i++) {
        const r = stacked[i];
        out[i] = {
          feetX: r.x,
          feetY: r.y,
          plaqueX: r.plaque.cx / layoutW,
          plaqueY: r.plaque.cy / H,
          effectiveScale: r.creatureHeightPx / CREATURE_BASE_SIZE,
          plaqueWidthPx: r.plaque.right - r.plaque.left,
        };
      }
      return out;
    }

    // Pre-measurement fallback: raw positions, full scale (hydration-stable).
    if (sceneW <= 0 || sceneH <= 0) {
      for (let i = 0; i < plot.length; i++) {
        const pm = placements[i];
        out[i] = { feetX: pm.x, feetY: pm.y, plaqueX: pm.x, plaqueY: pm.y, effectiveScale: pm.scale };
      }
      return out;
    }

    // Measured desktop: resolve front rows first, accumulating obstacles.
    const order = plot
      .map((_, i) => i)
      .sort((a, b) => placements[b].row - placements[a].row);
    const obstacles: SceneRect[] = [];
    for (const i of order) {
      const r: ResolvedPlacement = resolvePlacement(
        placements[i],
        place,
        sceneW,
        sceneH,
        obstacles,
        Math.max(sceneH / 3, topLimitPx ?? 0),
      );
      obstacles.push(r.plaque, upper60(r.creature));
      // The resolved creature box is square with side = creatureHeightPx; the
      // effective render scale is that height over the intrinsic art box.
      const effectiveScale = r.creatureHeightPx / CREATURE_BASE_SIZE;
      out[i] = {
        feetX: r.x,
        feetY: r.y,
        // Plaque centre in fractions of the scene box.
        plaqueX: r.plaque.cx / sceneW,
        plaqueY: r.plaque.cy / sceneH,
        effectiveScale,
      };
    }
    return out;
  }, [plot, placements, place, sceneW, sceneH, layoutW, layoutH, isMobile, topLimitPx, bandTop, bandBottom]);

  return (
    <div
      ref={rootRef}
      data-testid="depth-scatter"
      data-place={place}
      data-layout={isMobile ? "two-column" : "scatter"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className="relative h-full w-full"
    >
      {/* --- Creatures layer (z 20). A mirrored record flips ONLY the creature
          image; ground tombstones also apply the seeded tilt. The layer is
          pointer-events-none; each creature's button re-enables its own. --- */}
      <div
        data-testid="depth-scatter-creatures"
        className="pointer-events-none absolute inset-0 z-20"
      >
        {plot.map((row, index) => {
          const placement = placements[index];
          const r = resolved[index];
          if (placement === undefined || r === undefined) {
            return null;
          }
          const Creature = CREATURE_BY_STATE[row.state];
          // The flip and (ground-only) tilt live on the creature image wrapper
          // so the plaque \u2014 a separate layer \u2014 is never mirrored (Req 5.11).
          // Mirroring applies ONLY to ghosts and zombies (sky / gate); tombstones
          // and coffins carry text and locks that must never read backwards, so
          // the `mirrored` flag is ignored on ground and crypt (visual fix 2C).
          const canMirror = place === "sky" || place === "gate";
          const mirror = placement.mirrored && canMirror ? " scaleX(-1)" : "";
          const tilt = isGround ? ` rotate(${placement.tilt}deg)` : "";
          // `effectiveScale` already folds in any height-cap shrink (fix r3 #2),
          // so the rendered creature never grows taller than its row allows.
          const creatureTransform = `scale(${r.effectiveScale})${mirror}${tilt}`;

          // Gate fresh-zombie wander (Req 5.12\u20135.14): decay-0 zombies at the
          // gate wander horizontally when reduced motion is inactive.
          const wander = isGate && !reducedMotion && isFreshZombie(row);

          return (
            <div
              key={row.name}
              data-testid="scatter-creature"
              data-name={row.name}
              data-mirrored={placement.mirrored ? "true" : "false"}
              data-wander={wander ? "true" : "false"}
              className="pointer-events-none absolute"
              style={{
                left: `${r.feetX * 100}%`,
                top: `${r.feetY * 100}%`,
                // Anchor the creature by its FEET at (x, y): the stage-band `y`
                // is the ground line, so the body rises from there (visual fix 2C).
                transform: "translate(-50%, -100%)",
                // Day shows creatures as painted: no depth dimming.
                filter:
                  theme === "day" ? undefined : `brightness(${placement.brightness})`,
              }}
            >
              <div
                className={wander ? "gate-wander" : undefined}
                style={wander ? wanderVars(row.name) : undefined}
              >
                <div
                  className="pointer-events-auto"
                  style={{ transform: creatureTransform }}
                >
                  <Creature
                    row={row}
                    onSelect={onSelect}
                    selected={row.name === selectedName}
                    filterHero={filterHeroes?.has(row.name) ?? false}
                    onHoverStart={hover?.onPointerEnter}
                    onHoverEnd={hover?.onPointerLeave}
                    onFocusStart={hover?.onFocus}
                    onBlurEnd={hover?.onBlur}
                    hoverCardId={hover ? hoverCardId(row.name) : undefined}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Plaque layer (z 30). A single layer above every creature (z 20)
          and the near fog (z 25). One Plaque per creature, placed over the lower
          body of its OWN creature by `resolvePlacement` (Option A, visual fix r3
          #2) \u2014 centred at the resolved plaque x/y, never mirrored. --- */}
      <div
        data-testid="depth-scatter-plaques"
        className="pointer-events-none absolute inset-0 z-30"
        style={plaqueStyle}
      >
        {plot.map((row, index) => {
          const placement = placements[index];
          const r = resolved[index];
          if (placement === undefined || r === undefined) {
            return null;
          }
          return (
            <div
              key={row.name}
              data-testid="scatter-plaque"
              data-name={row.name}
              // Centred on the resolved plaque point (its own creature's lower
              // body): `translate(-50%, -50%)` because the resolved point is the
              // plaque CENTRE, not a corner.
              className={
                hover ? "pointer-events-auto absolute" : "pointer-events-none absolute"
              }
              style={{
                left: `${r.plaqueX * 100}%`,
                top: `${r.plaqueY * 100}%`,
                transform: "translate(-50%, -50%)",
                // Compact: honor the layout's plaque width exactly so the text
                // ellipsizes instead of overflowing into the neighbouring cell.
                ...(r.plaqueWidthPx !== undefined
                  ? {
                      width: `${r.plaqueWidthPx}px`,
                      maxWidth: `${r.plaqueWidthPx}px`,
                      minWidth: 0,
                    }
                  : null),
              }}
              onPointerEnter={
                hover
                  ? () => {
                      const el = creatureButton(row.name);
                      if (el) hover.onPointerEnter(row.name, el);
                    }
                  : undefined
              }
              onPointerLeave={hover ? () => hover.onPointerLeave(row.name) : undefined}
              // The plaque can overlap its creature's lower body; forward a
              // click to the same activation so that region stays clickable.
              onClick={hover ? () => onSelect(row.name) : undefined}
            >
              <Plaque
                name={row.name}
                sub={plaqueSub(row, theme)}
                scale={placement.scale}
                widthPx={r.plaqueWidthPx}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
