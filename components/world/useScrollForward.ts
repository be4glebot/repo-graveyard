"use client";

import { useEffect, type RefObject } from "react";
import { classifyGesture } from "@/lib/world-motion";

/**
 * Chip-row forwarding. The compact chip row uses `touch-action: pan-x`, so a
 * vertical swipe that starts on it would not scroll the world. A pointer drag
 * that classifies as a vertical scroll is forwarded as `scrollBy({ top: -dy })`
 * on the scroller. Passive pointer listeners only.
 */
export function useScrollForward(
  rowRef: RefObject<HTMLElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let down = false;
    let vertical = false;

    const onDown = (e: PointerEvent): void => {
      startX = e.clientX;
      startY = e.clientY;
      lastY = e.clientY;
      down = true;
      vertical = false;
    };
    const onMove = (e: PointerEvent): void => {
      if (!down) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!vertical) {
        if (classifyGesture(dx, dy) !== "scroll" || Math.abs(dy) <= Math.abs(dx)) return;
        vertical = true;
      }
      const step = e.clientY - lastY;
      lastY = e.clientY;
      const scroller = scrollerRef.current;
      if (!scroller || step === 0) return;
      if (typeof scroller.scrollBy === "function") {
        scroller.scrollBy({ top: -step });
      } else {
        scroller.scrollTop -= step;
      }
    };
    const onEnd = (): void => {
      down = false;
      vertical = false;
    };

    const passive = { passive: true } as const;
    row.addEventListener("pointerdown", onDown, passive);
    row.addEventListener("pointermove", onMove, passive);
    row.addEventListener("pointerup", onEnd, passive);
    row.addEventListener("pointercancel", onEnd, passive);
    return () => {
      row.removeEventListener("pointerdown", onDown);
      row.removeEventListener("pointermove", onMove);
      row.removeEventListener("pointerup", onEnd);
      row.removeEventListener("pointercancel", onEnd);
    };
  }, [rowRef, scrollerRef]);
}
