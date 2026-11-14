"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { WorldLayout } from "@/lib/world-layout";
import { depthPosition, stratumAt } from "@/lib/world-motion";

/** Viewport height used when neither the element nor the window reports one. */
export const FALLBACK_VIEWPORT_H = 812;

export interface UseWorldScrollOptions {
  /** While true, CSS variable writes pause; they resume on the next frame. */
  travelActive?: boolean;
  /** Called from the frame callback (never during render) when the Stratum changes. */
  onStratumChange?: (index: number) => void;
  /** Called synchronously from the scroll listener (no React state); used by the tap guard. */
  onScroll?: () => void;
}

function finiteOr(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Scroll-linked CSS variables for a world, with no React state.
 *
 * One passive `scroll` listener stores nothing but schedules at most one
 * `requestAnimationFrame`. The frame callback reads `scrollTop`, `scrollHeight`
 * and `clientHeight` (no `getBoundingClientRect`) and writes `--world-scroll`
 * and `--world-depth` on the root. A `ResizeObserver` re-runs the frame; the
 * viewport height falls back to the window height, then 812.
 */
export function useWorldScroll(
  scrollerRef: RefObject<HTMLElement | null>,
  rootRef: RefObject<HTMLElement | null>,
  layout: Pick<WorldLayout, "strata">,
  options: UseWorldScrollOptions = {},
): void {
  const layoutRef = useRef(layout);
  const travelRef = useRef(options.travelActive ?? false);
  const onStratumRef = useRef(options.onStratumChange);
  const onScrollRef = useRef(options.onScroll);
  const scheduleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    layoutRef.current = layout;
    onStratumRef.current = options.onStratumChange;
    onScrollRef.current = options.onScroll;
  });

  const travelActive = options.travelActive ?? false;
  useEffect(() => {
    travelRef.current = travelActive;
    // Resume from the current offset on the next frame once travel ends.
    if (!travelActive) scheduleRef.current?.();
  }, [travelActive]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let frame = 0;
    let pending = false;
    let lastStratum = -1;

    const run = (): void => {
      pending = false;
      frame = 0;
      if (travelRef.current) return;
      const root = rootRef.current ?? scroller.parentElement ?? scroller;
      const top = finiteOr(scroller.scrollTop, 0);
      const client = scroller.clientHeight;
      const viewportH =
        client > 0
          ? client
          : typeof window !== "undefined" && window.innerHeight > 0
            ? window.innerHeight
            : FALLBACK_VIEWPORT_H;
      const depth = depthPosition(top, finiteOr(scroller.scrollHeight, 0), client);
      root.style.setProperty("--world-scroll", String(Math.max(0, top)));
      root.style.setProperty("--world-depth", String(depth));
      const idx = stratumAt(layoutRef.current, top, viewportH);
      if (idx !== lastStratum) {
        lastStratum = idx;
        onStratumRef.current?.(idx);
      }
    };

    const schedule = (): void => {
      if (pending) return;
      pending = true;
      frame = window.requestAnimationFrame(run);
    };
    scheduleRef.current = schedule;

    const onScroll = (): void => {
      onScrollRef.current?.();
      schedule();
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      observer.observe(scroller);
    }
    schedule();

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      scheduleRef.current = null;
    };
  }, [scrollerRef, rootRef]);
}
