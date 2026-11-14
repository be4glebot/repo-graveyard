"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { useTheme } from "@/components/scene/ThemeProvider";
import { dayCopy, placeNameKey } from "@/lib/day-copy";
import type { WorldLayout, WorldPlace } from "@/lib/world-layout";
import { useScrollGuard } from "./useScrollGuard";
import { useWorldScroll } from "./useWorldScroll";

export interface WorldScrollerProps {
  place: WorldPlace;
  layout: Pick<WorldLayout, "strata">;
  /** Current filter; a change resets the scroll offset to 0. */
  activeFilter: string;
  /** Current Plot (page) index; a change resets the scroll offset to 0. */
  plotIndex: number;
  /** Rising saves the offset; falling restores it within 1 px. */
  panelOpen?: boolean;
  travel?: { active: boolean };
  /** Element that receives `--world-scroll` / `--world-depth`; defaults to the parent. */
  rootRef?: RefObject<HTMLElement | null>;
  onStratumChange?: (index: number) => void;
  children?: ReactNode;
}

/**
 * The only scroll container of a world. Native scrolling, no key handling
 * (Tab and Escape are never intercepted). Scroll padding and the 2 px candle
 * focus ring come from the `[data-world-scroller]` rules in globals.css.
 */
export function WorldScroller({
  place,
  layout,
  activeFilter,
  plotIndex,
  panelOpen = false,
  travel,
  rootRef,
  onStratumChange,
  children,
}: WorldScrollerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fallbackRootRef = useRef<HTMLElement | null>(null);
  const savedTop = useRef(0);
  const wasOpen = useRef(false);

  const { theme } = useTheme();
  const { markScroll } = useScrollGuard(scrollerRef);

  useWorldScroll(scrollerRef, rootRef ?? fallbackRootRef, layout, {
    travelActive: travel?.active ?? false,
    onStratumChange,
    onScroll: markScroll,
  });

  // The stage height changes in the same commit: start at the top.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = 0;
  }, [place, activeFilter, plotIndex]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (panelOpen && !wasOpen.current) {
      savedTop.current = el.scrollTop;
    } else if (!panelOpen && wasOpen.current) {
      if (Math.abs(el.scrollTop - savedTop.current) > 1) {
        el.scrollTop = savedTop.current;
      }
    }
    wasOpen.current = panelOpen;
  }, [panelOpen]);

  return (
    <div
      ref={scrollerRef}
      data-testid="world-scroller"
      data-world-scroller=""
      role="region"
      aria-label={dayCopy(theme, placeNameKey(place))}
      tabIndex={0}
      className="absolute inset-0 overflow-y-auto overflow-x-clip overscroll-contain touch-pan-y"
    >
      {children}
    </div>
  );
}
