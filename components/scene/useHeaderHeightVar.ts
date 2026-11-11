"use client";

import { useEffect, type RefObject } from "react";

export const HEADER_HEIGHT_VAR = "--site-header-h";

/**
 * While `compact` (below 768 px), measures the site-header wrapper and writes
 * its rendered height, in CSS px, to `--site-header-h` on the scene root.
 * A ResizeObserver callback runs before the next paint, so the value updates
 * within one animation frame of the header changing size (menu open/close,
 * wrapping text). When not compact the override is removed so the stylesheet
 * token (7rem) applies again.
 *
 * `rootRef` is the scene root element; when omitted or empty the document
 * element is used.
 */
export function useHeaderHeightVar(
  headerRef: RefObject<HTMLElement | null>,
  compact: boolean,
  rootRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const header = headerRef.current;
    const root = rootRef?.current ?? (typeof document !== "undefined" ? document.documentElement : null);
    if (!header || !root) return;

    if (!compact) {
      root.style.removeProperty(HEADER_HEIGHT_VAR);
      return;
    }

    const write = (height: number) => {
      if (!Number.isFinite(height) || height < 0) return;
      root.style.setProperty(HEADER_HEIGHT_VAR, `${Math.ceil(height)}px`);
    };
    const measure = () => write(header.getBoundingClientRect().height);

    measure();

    if (typeof ResizeObserver === "undefined") return () => root.style.removeProperty(HEADER_HEIGHT_VAR);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const box = entry?.borderBoxSize?.[0];
      if (box && Number.isFinite(box.blockSize) && box.blockSize > 0) write(box.blockSize);
      else measure();
    });
    observer.observe(header);

    return () => {
      observer.disconnect();
      root.style.removeProperty(HEADER_HEIGHT_VAR);
    };
  }, [headerRef, rootRef, compact]);
}
