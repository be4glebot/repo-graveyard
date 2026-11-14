"use client";

/**
 * WorldPlaceView: the explorable world shell for the sky, the ground and the
 * crypt (design: DOM skeleton of a world, Z-order).
 *
 *   root (relative h-dvh, NO overflow utility)
 *     WorldScroller            the only overflow-auto element
 *       top chrome             sticky top-0 z-50 h-0: return, heading, chips, DepthMarker
 *       WorldStage             tall stage of layout.heightPx
 *         decor (data-decor-clip, aria-hidden, inert) + generic art slot
 *         WorldCreatures       z 20, one ol per Stratum
 *         near mist
 *       bottom chrome          sticky bottom-0 z-50 h-0: pager (safe-area padding)
 *     legibility gradients (z 30, 18 vh) / LanternCursor (z 35) / Atmosphere (z 40)
 *
 * It renders no Data_Fog (`scene-fog`): worlds use Environmental_Mist only.
 * Per-place art arrives in later steps through the generic `art` slot.
 *
 * Requirements: 3.1, 11.2, 11.3, 12.6, 12.7, 12.11, 12.12, 13.2, 15.1, 15.5
 */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import Atmosphere from "@/components/scene/Atmosphere";
import FilterChips from "@/components/scene/FilterChips";
import type { PlaceViewProps } from "@/components/scene/GatePlaceView";
import LanternCursor from "@/components/scene/LanternCursor";
import Pager from "@/components/scene/Pager";
import PlaceHeading from "@/components/scene/PlaceHeading";
import ReturnToGate from "@/components/scene/ReturnToGate";
import useParallax from "@/components/scene/useParallax";
import { useIsCompact } from "@/components/ui/useIsCompact";
import { dayCopy, placeNameKey } from "@/lib/day-copy";
import {
  PLOT_SIZE,
  compactPlotSize,
  plaqueCopy,
} from "@/lib/estate-view";
import { placePlots } from "@/lib/place-pipeline";
import { bottomTailPx, computeWorldLayout, type WorldPlace } from "@/lib/world-layout";
import { effectProps } from "@/lib/world-effects";
import { scrollTargetFor } from "@/lib/world-motion";

import DepthMarker from "./DepthMarker";
import CryptArt from "./CryptArt";
import EmptyScene from "./EmptyScene";
import EnvMist from "./EnvMist";
import GroundArt from "./GroundArt";
import SkyArt from "./SkyArt";
import { useDiscovery } from "./useDiscovery";
import { useScrollForward } from "./useScrollForward";
import { WorldCreatures } from "./WorldCreatures";
import { WorldScroller } from "./WorldScroller";
import { WorldStage } from "./WorldStage";

/** Extra px kept clear above the pager (see the creature window measurement). */
const PAGER_END_SLACK = 24;

/** Height of each legibility gradient, as a share of the viewport (Req 15.5 floor is 15). */
const GRADIENT_BAND_VH = 18;

export interface WorldPlaceViewProps extends Omit<PlaceViewProps, "place"> {
  place: WorldPlace;
  /** Generic art slot, rendered inside the stage below the creatures. */
  art?: ReactNode;
}

export default function WorldPlaceView({
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
  panelOpen = false,
  revealRequest = null,
  onRevealHandled,
  art,
}: WorldPlaceViewProps) {
  const compact = useIsCompact();

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  // Scroller viewport size; falls back to the window until layout is measured.
  const [box, setBox] = useState({ w: 0, h: 0 });
  // The server and the hydrating client must render the same numbers, so the
  // window fallback only applies after mount; the flip forces a re-render that
  // replaces any server-sized art (otherwise art stays 1024 px wide, a visible
  // edge on wider screens).
  const [mounted, setMounted] = useState(false);
  const viewportW =
    box.w > 0
      ? box.w
      : mounted && typeof window !== "undefined" && window.innerWidth > 0
        ? window.innerWidth
        : 1024;
  const viewportH =
    box.h > 0
      ? box.h
      : mounted && typeof window !== "undefined" && window.innerHeight > 0
        ? window.innerHeight
        : 812;

  const pageSize = compact ? compactPlotSize(viewportW) : PLOT_SIZE;
  const plots = useMemo(
    () => placePlots(place, rows, activeFilter, pageSize),
    [place, rows, activeFilter, pageSize],
  );
  const plotCount = plots.length;
  const clampedIndex = Math.min(Math.max(0, plotIndex), plotCount - 1);
  const currentPlot = useMemo(() => plots[clampedIndex] ?? [], [plots, clampedIndex]);

  const layout = useMemo(
    () =>
      computeWorldLayout({
        place,
        names: currentPlot.map((r) => r.name),
        viewportW,
        viewportH,
      }),
    [place, currentPlot, viewportW, viewportH],
  );

  const tail = bottomTailPx(layout.strata, layout.viewportH);
  const lastStratum = layout.strata[layout.strata.length - 1];

  const copy = useMemo(
    () => plaqueCopy(place, rows.length, undefined, theme),
    [place, rows.length, theme],
  );
  const [stratumIndex, setStratumIndex] = useState(0);

  useParallax(rootRef, { reducedMotion, paused: travel?.active ?? false });

  // Find the scroller once (WorldScroller owns the element) and measure it.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = root?.querySelector<HTMLElement>("[data-world-scroller]") ?? null;
    scrollerRef.current = scroller;
    // One-shot post-mount flag: viewport size is only readable on the client,
    // so the first paint matches the server and this flips it once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (!scroller) return;
    const measure = (): void => {
      const w = scroller.clientWidth;
      const h = scroller.clientHeight;
      if (w > 0 && h > 0) {
        setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  // The depth marker's box is cut out of the creature window so no creature
  // is drawn or hit under it (see `.world-creatures` in globals.css). The box
  // is measured relative to the root; an absent marker leaves the defaults.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const names = ["--world-marker-left", "--world-marker-top", "--world-marker-bottom"];
    const apply = (): void => {
      const o = root.getBoundingClientRect();
      // Measured chrome bands: the lowest label of the top chrome and the top of
      // the pager. They only ever raise the design clearance (globals.css).
      const CHROME_GAP = 8;
      let chromeTop = 0;
      for (const sel of [
        '[data-testid="return-to-gate"]',
        '[data-testid="place-heading"]',
        '[data-testid="place-chips-row"]',
      ]) {
        const el = root.querySelector<HTMLElement>(sel);
        const b = el?.getBoundingClientRect();
        if (b && b.height > 0) chromeTop = Math.max(chromeTop, b.bottom - o.top + CHROME_GAP);
      }
      const pager = root.querySelector<HTMLElement>('[data-testid="pager"]')?.getBoundingClientRect();
      if (chromeTop > 0) root.style.setProperty("--world-chrome-top", `${Math.ceil(chromeTop)}px`);
      else root.style.removeProperty("--world-chrome-top");
      if (pager && pager.height > 0) {
        root.style.setProperty(
          "--world-chrome-bottom",
          // Extra slack: parallax bands extend the scrollable overflow by a few
          // px, and at the very end of the scroll the sticky pager rises by that.
          `${Math.ceil(o.bottom - pager.top + CHROME_GAP + PAGER_END_SLACK)}px`,
        );
      } else {
        root.style.removeProperty("--world-chrome-bottom");
      }
      const nav = root.querySelector<HTMLElement>('[data-testid="depth-marker"]');
      if (!nav) {
        names.forEach((n) => root.style.removeProperty(n));
        return;
      }
      const r = nav.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const gap = 4;
      root.style.setProperty("--world-marker-left", `${Math.max(0, r.left - o.left - gap)}px`);
      root.style.setProperty("--world-marker-top", `${Math.max(0, r.top - o.top - gap)}px`);
      root.style.setProperty("--world-marker-bottom", `${Math.max(0, r.bottom - o.top + gap)}px`);
    };
    apply();
    // Once more after the header height variable has settled.
    const raf = window.requestAnimationFrame(apply);
    if (typeof ResizeObserver === "undefined") {
      return () => window.cancelAnimationFrame(raf);
    }
    const observer = new ResizeObserver(apply);
    observer.observe(root);
    root
      .querySelectorAll<HTMLElement>(
        '[data-testid="depth-marker"], [data-testid="place-heading"], [data-testid="place-chips-row"], [data-testid="pager"], [data-testid="place-bottom-bar"]',
      )
      .forEach((el) => observer.observe(el));
    // The site header wraps without resizing these (it moves them), so also
    // follow the window.
    window.addEventListener("resize", apply);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
    // Re-run when the layout (and so the marker's strata) changes.
  }, [layout, stratumIndex, viewportW, viewportH, plotCount, compact]);

  useScrollForward(chipsRef, scrollerRef);
  useDiscovery(scrollerRef, { reduced: reducedMotion, watchKey: layout });

  // Reveal: bring a named creature into the central part of the view when it
  // was opened without a pointer (turning-soon jump, `?repo=`). Step 1 makes
  // the target visible (filter to "all", switch Plot); step 2 scrolls once the
  // creature is in the current Plot. Each request id is handled once; a name
  // with no match changes nothing (Req 10.5-10.8).
  const handledRevealId = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!revealRequest || handledRevealId.current === revealRequest.id) return;
    const { name, id } = revealRequest;
    const finish = (): void => {
      handledRevealId.current = id;
      onRevealHandled?.(id);
    };

    if (!rows.some((r) => r.name === name)) {
      finish();
      return;
    }
    const inPlot = (plot: readonly { name: string }[]): boolean =>
      plot.some((r) => r.name === name);

    // Not in the filtered set: show everything, then re-run with the new plots.
    if (!plots.some(inPlot)) {
      if (activeFilter !== "all") onFilterChange("all");
      else finish();
      return;
    }
    const target = plots.findIndex(inPlot);
    if (target !== clampedIndex) {
      onPlotChange(target);
      return;
    }

    const slotIndex = currentPlot.findIndex((r) => r.name === name);
    const slot = layout.slots[slotIndex];
    const scroller = scrollerRef.current;
    if (slot && scroller) {
      const top = scrollTargetFor(slot, layout.heightPx, viewportH);
      if (typeof scroller.scrollTo === "function") {
        scroller.scrollTo({ top, behavior: "auto" });
      }
      // Always set directly too: instant, and works where scrollTo is absent.
      scroller.scrollTop = top;
    }
    finish();
  }, [
    revealRequest,
    rows,
    plots,
    activeFilter,
    clampedIndex,
    currentPlot,
    layout,
    viewportH,
    onFilterChange,
    onPlotChange,
    onRevealHandled,
  ]);

  // Focus the heading once per place entry, without scrolling.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [place]);

  // Focus return: when the panel closes, go back to the creature that opened it.
  const lastSelected = useRef<string | null>(null);
  useEffect(() => {
    if (selectedName !== null) lastSelected.current = selectedName;
  }, [selectedName]);
  const wasPanelOpen = useRef(panelOpen);
  useEffect(() => {
    if (wasPanelOpen.current && !panelOpen) {
      const name = lastSelected.current;
      const items = rootRef.current?.querySelectorAll<HTMLElement>(
        '[data-testid="scatter-creature"]',
      );
      let target: HTMLElement | null = null;
      items?.forEach((li) => {
        if (li.getAttribute("data-name") === name) {
          target = li.querySelector<HTMLElement>("button");
        }
      });
      (target ?? headingRef.current)?.focus({ preventScroll: true });
    }
    wasPanelOpen.current = panelOpen;
  }, [panelOpen]);

  const chromeFade: CSSProperties = travel?.active
    ? { opacity: "var(--travel-chrome-fade, 1)" }
    : {};

  return (
    <div
      ref={rootRef}
      data-scene-root
      data-testid="place-view"
      data-place={place}
      data-world=""
      {...effectProps("scroll-parallax")}
      data-travel-active={travel?.active ? "true" : undefined}
      className="relative h-dvh w-full"
      style={
        {
          backgroundColor: "var(--color-night-sky)",
          "--world-view-h": `${viewportH}px`,
        } as CSSProperties
      }
    >
      <WorldScroller
        place={place}
        layout={layout}
        activeFilter={activeFilter}
        plotIndex={clampedIndex}
        panelOpen={panelOpen}
        travel={travel}
        rootRef={rootRef}
        onStratumChange={setStratumIndex}
      >
        {/* Top chrome: sticky, zero height, above the lantern (z 50). */}
        <div
          data-testid="world-chrome-top"
          className="world-chrome-top pointer-events-none sticky top-0 z-50 h-0"
          style={chromeFade}
        >
          {/* Legibility surface: creatures scrolling under the title and chips
              dim behind a night scrim instead of colliding with the text. */}
          <div
            data-testid="world-chrome-scrim"
            aria-hidden="true"
            className={[
              "pointer-events-none absolute inset-x-0 top-0",
              compact ? "h-[22rem]" : "h-[15rem]",
            ].join(" ")}
            style={{
              backgroundImage:
                "linear-gradient(to bottom, transparent 0, transparent 30%, color-mix(in srgb, var(--color-night-sky) 85%, transparent) 46%, color-mix(in srgb, var(--color-night-sky) 85%, transparent) 62%, transparent 100%)",
            }}
          />
          <div
            className={
              compact
                ? "pointer-events-none absolute inset-x-0 flex flex-col items-stretch gap-2 px-4 py-2"
                : "place-title-clear pointer-events-none absolute inset-x-0 flex flex-col items-center gap-4 px-6"
            }
            style={{ top: "var(--site-header-h)" }}
          >
            <div className={compact ? "flex justify-start" : "absolute left-6 top-6"}>
              <ReturnToGate onReturn={onReturn} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <PlaceHeading ref={headingRef} name={dayCopy(theme, placeNameKey(place))} copy={copy} />
            </div>
            <div
              ref={chipsRef}
              data-testid="place-chips-row"
              className={
                compact
                  ? "pointer-events-auto overflow-x-auto [&>div]:w-max [&>div]:flex-nowrap [&>div]:justify-start"
                  : "pointer-events-auto"
              }
              style={compact ? { touchAction: "pan-x" } : undefined}
            >
              <FilterChips
                place={place}
                rows={rows}
                activeFilter={activeFilter}
                onFilterChange={onFilterChange}
              />
            </div>
          </div>
          {/* Viewport-high positioned host so the marker centres vertically. */}
          <div className="pointer-events-none absolute left-0 top-0 h-dvh w-full">
            {/* The marker lives between the chrome bands (same clearance as
                the scroll padding), so it never meets the title or filters. */}
            <div
              data-testid="depth-marker-window"
              className="world-window pointer-events-none absolute inset-x-0"
            >
              <DepthMarker
                strata={layout.strata}
                lengthVh={layout.lengthVh}
                current={stratumIndex}
                placeName={dayCopy(theme, placeNameKey(place))}
              />
            </div>
          </div>
        </div>

        <WorldStage heightPx={layout.heightPx}>
          {/* Generic background: one clipped, inert wrapper per Stratum (z 0). */}
          {layout.strata.map((s) => (
            <div
              key={`bg-${s.id}`}
              data-decor-clip=""
              data-testid="world-bg"
              aria-hidden="true"
              inert
              className="world-band world-band-bg pointer-events-none z-0 overflow-clip"
              style={
                {
                  top: s.top,
                  height: s.bottom - s.top + (s === lastStratum ? tail : 0),
                  "--band-anchor": s.top,
                  backgroundColor: "var(--color-night-sky)",
                } as CSSProperties
              }
            />
          ))}

          {/* Far mist (z 10), per Stratum. */}
          {layout.strata.map((s) => (
            <div
              key={`far-${s.id}`}
              className="world-band world-band-mid pointer-events-none z-10"
              style={
                {
                  top: s.top,
                  height: s.bottom - s.top + (s === lastStratum ? tail : 0),
                  "--band-anchor": s.top,
                } as CSSProperties
              }
            >
              <EnvMist place={place} layer="far" reducedMotion={reducedMotion} viewportW={viewportW} />
            </div>
          ))}

          {art ??
            (place === "sky" ? (
              <SkyArt
                layout={layout}
                rows={rows}
                viewportW={viewportW}
                reducedMotion={reducedMotion}
                theme={theme}
              />
            ) : place === "ground" ? (
              <GroundArt
                layout={layout}
                viewportW={viewportW}
                reducedMotion={reducedMotion}
                theme={theme}
              />
            ) : place === "crypt" ? (
              <CryptArt
                layout={layout}
                viewportW={viewportW}
                reducedMotion={reducedMotion}
                theme={theme}
              />
            ) : null)}

          {(place === "sky" || place === "ground" || place === "crypt") &&
          rows.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[3]">
              <EmptyScene
                variant={place}
                viewportW={viewportW}
                viewportH={viewportH}
                reducedMotion={reducedMotion}
                theme={theme}
              />
            </div>
          ) : null}

          {/* Anchors the depth marker scrolls to (Stratum tops). */}
          {layout.strata.map((s) => (
            <div
              key={`anchor-${s.id}`}
              data-stratum-anchor={s.id}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 h-0"
              style={{ top: s.top }}
            />
          ))}

          <WorldCreatures
            layout={layout}
            rows={currentPlot}
            viewportW={viewportW}
            selectedName={selectedName}
            onSelect={onSelect}
            filterHeroes={filterHeroes}
            theme={theme}
          />

          {/* Near mist (z 25), per Stratum. */}
          {layout.strata.map((s) => (
            <div
              key={`near-${s.id}`}
              className="world-band world-band-near pointer-events-none z-[25]"
              style={
                {
                  top: s.top,
                  height: s.bottom - s.top + (s === lastStratum ? tail : 0),
                  "--band-anchor": s.top,
                } as CSSProperties
              }
            >
              <EnvMist place={place} layer="near" reducedMotion={reducedMotion} viewportW={viewportW} />
            </div>
          ))}
        </WorldStage>

        {/* Bottom chrome: sticky, zero height; the pager sits above the footer row and the safe area. */}
        <div
          className="world-chrome-bottom pointer-events-none sticky bottom-0 z-50 h-0"
          style={chromeFade}
        >
          <div
            data-testid="place-bottom-bar"
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pt-2 min-[768px]:max-[1099px]:pb-[calc(6rem+env(safe-area-inset-bottom,0px))]!"
            style={{
              // Lifted above the scene footer row (legend, sample-estate notice)
              // so the pager never shares a row with them. Between 768 and
              // 1099px the legend wraps to more rows, so the important class
              // above lifts the pager to 6rem there (25.3).
              paddingBottom: `calc(${compact ? "2.75rem" : "4rem"} + env(safe-area-inset-bottom, 0px))`,
            }}
          >
            <Pager
              plotIndex={clampedIndex}
              plotCount={plotCount}
              onPlotChange={onPlotChange}
            />
          </div>
        </div>
      </WorldScroller>

      {/* Legibility gradients (z 30), viewport-sized, 18 vh each. */}
      {/* Day: no cream wash over the painted art. */}
      {theme === "day" ? null : (
        <>
          <div
            data-testid="world-gradient-top"
            {...effectProps("legibility-gradient")}
            aria-hidden="true"
            inert
            className="pointer-events-none absolute inset-x-0 top-0 z-30"
            style={{
              height: `${GRADIENT_BAND_VH}vh`,
              backgroundImage:
                "linear-gradient(to bottom, var(--color-night-cover-top), transparent)",
            }}
          />
          <div
            data-testid="world-gradient-bottom"
            {...effectProps("legibility-gradient")}
            aria-hidden="true"
            inert
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30"
            style={{
              height: `${GRADIENT_BAND_VH}vh`,
              backgroundImage:
                "linear-gradient(to top, var(--color-night-cover-bottom), transparent)",
            }}
          />
        </>
      )}

      <LanternCursor theme={theme} reducedMotion={reducedMotion} />

      <div
        data-testid="world-atmosphere"
        aria-hidden="true"
        inert
        className="pointer-events-none absolute inset-0 z-40"
      >
        <Atmosphere />
      </div>
    </div>
  );
}
