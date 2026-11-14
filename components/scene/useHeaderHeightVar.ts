"use client";

import { useEffect, type RefObject } from "react";

export const HEADER_HEIGHT_VAR = "--site-header-h";

/** Stylesheet floor of the token (7rem) for the wide layout. */
const MIN_WIDE_HEADER_PX = 112;

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
  options?: { always?: boolean },
): void {
  const always = options?.always === true;
  useEffect(() => {
    const header = headerRef.current;
    const root = rootRef?.current ?? (typeof document !== "undefined" ? document.documentElement : null);
    if (!header || !root) return;

    if (!compact && !always) {
      root.style.removeProperty(HEADER_HEIGHT_VAR);
      return;
    }

    // Wide layouts (`always`): the wrapper has `min-height: var(--site-header-h)`,
    // so measuring it would latch the value. Measure the header content plus the
    // wrapper padding instead, never below the stylesheet token (7rem), so a
    // header that wraps to two rows on short viewports still pushes the place
    // chrome down.
    const contentHeight = (): number => {
      if (compact || !always) return header.getBoundingClientRect().height;
      const inner = header.firstElementChild as HTMLElement | null;
      if (!inner) return header.getBoundingClientRect().height;
      const style = typeof getComputedStyle === "function" ? getComputedStyle(header) : null;
      const pad = style
        ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
        : 0;
      return Math.max(MIN_WIDE_HEADER_PX, inner.getBoundingClientRect().height + pad);
    };
    const write = (height: number) => {
      if (!Number.isFinite(height) || height < 0) return;
      root.style.setProperty(HEADER_HEIGHT_VAR, `${Math.ceil(height)}px`);
    };
    const measure = () => write(contentHeight());

    measure();

    if (typeof ResizeObserver === "undefined") return () => root.style.removeProperty(HEADER_HEIGHT_VAR);

    const observer = new ResizeObserver((entries) => {
      if (always && !compact) return measure();
      const entry = entries[entries.length - 1];
      const box = entry?.borderBoxSize?.[0];
      if (box && Number.isFinite(box.blockSize) && box.blockSize > 0) write(box.blockSize);
      else measure();
    });
    observer.observe(header);
    if (always && !compact && header.firstElementChild) observer.observe(header.firstElementChild);

    return () => {
      observer.disconnect();
      root.style.removeProperty(HEADER_HEIGHT_VAR);
    };
  }, [headerRef, rootRef, compact, always]);
}
