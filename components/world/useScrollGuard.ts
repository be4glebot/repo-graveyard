"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { classifyGesture } from "@/lib/world-motion";

/**
 * A touch that lands this soon after a scroll event is stopping a fling, not
 * tapping. Applies to touch only: a mouse wheel is not a drag, so mouse clicks
 * are never swallowed by scroll momentum.
 */
export const SCROLL_MOMENTUM_MS = 120;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** What the guard knows about the gesture that produced a click. */
export interface ClickGesture {
  /** `PointerEvent.pointerType` from the matching pointerdown ("" when unseen). */
  pointerType: string;
  /** The pointer moved more than 8 px between pointerdown and the click. */
  moved: boolean;
  /** Time of the matching pointerdown, or -Infinity when unseen. */
  downAt: number;
  /** Time of the most recent scroll event, or -Infinity. */
  lastScroll: number;
}

/**
 * Pure decision: should this pointer-origin click be swallowed?
 *
 * - A real drag (over the 8 px threshold) always suppresses, for any pointer.
 * - Scroll momentum suppresses touch taps only: a scroll that began during the
 *   touch, or a touch that landed within `SCROLL_MOMENTUM_MS` of a scroll event.
 * - Mouse and pen clicks are never suppressed by scrolling alone.
 */
export function shouldSwallowClick(g: ClickGesture, momentumMs: number = SCROLL_MOMENTUM_MS): boolean {
  if (g.moved) return true;
  if (g.pointerType !== "touch") return false;
  const scrolledDuringTouch = g.lastScroll >= g.downAt;
  const touchedDuringMomentum = g.downAt - g.lastScroll <= momentumMs;
  return scrolledDuringTouch || touchedDuringMomentum;
}

/**
 * Tap versus scroll guard for a world's scroller.
 *
 * Passive `pointerdown`/`pointermove`/`pointerup` listeners record the pointer
 * type and whether a gesture moved more than 8 px (`classifyGesture`). A
 * capture-phase `click` listener swallows pointer-origin clicks (`detail > 0`)
 * after such a drag, and touch taps made during scroll momentum (see
 * `shouldSwallowClick`). Keyboard clicks (`detail === 0`) are never swallowed.
 * No wheel or touch listeners, and nothing here navigates.
 *
 * Returns `markScroll`, to be called from the scroller's existing scroll
 * listener (so the scroller keeps a single scroll listener).
 */
export function useScrollGuard(scrollerRef: RefObject<HTMLElement | null>): {
  markScroll: () => void;
} {
  const lastScroll = useRef(Number.NEGATIVE_INFINITY);

  const markScroll = useCallback((): void => {
    lastScroll.current = now();
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let down = false;
    let moved = false;
    let pointerType = "";
    let downAt = Number.NEGATIVE_INFINITY;

    const onDown = (e: PointerEvent): void => {
      startX = e.clientX;
      startY = e.clientY;
      down = true;
      moved = false;
      pointerType = e.pointerType ?? "";
      downAt = now();
    };
    const onMove = (e: PointerEvent): void => {
      if (!down || moved) return;
      if (classifyGesture(e.clientX - startX, e.clientY - startY) === "scroll") {
        moved = true;
      }
    };
    const onUp = (): void => {
      down = false;
    };
    const onClick = (e: MouseEvent): void => {
      if (e.detail === 0) return; // keyboard or programmatic: never swallowed
      const swallow = shouldSwallowClick({
        pointerType,
        moved,
        downAt,
        lastScroll: lastScroll.current,
      });
      if (swallow) {
        e.stopPropagation();
        e.preventDefault();
      }
      moved = false;
      pointerType = "";
      downAt = Number.NEGATIVE_INFINITY;
    };

    const passive = { passive: true } as const;
    el.addEventListener("pointerdown", onDown, passive);
    el.addEventListener("pointermove", onMove, passive);
    el.addEventListener("pointerup", onUp, passive);
    el.addEventListener("pointercancel", onUp, passive);
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClick, true);
    };
  }, [scrollerRef]);

  return { markScroll };
}
