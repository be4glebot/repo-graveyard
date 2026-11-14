"use client";

import { useEffect, type RefObject } from "react";

export interface UseDiscoveryOptions {
  /** Reduced motion: every reveal is preset and no observer is created. */
  reduced?: boolean;
  /** Change to re-scan the scroller after Creatures or Strata are added. */
  watchKey?: unknown;
}

/**
 * Discovery reveals and off-screen pausing with no React state.
 *
 * One `IntersectionObserver` rooted at the scroller watches every
 * `[data-reveal]` element and every `li`. A `[data-reveal]` element gets
 * `data-revealed="true"` on its first intersection and the reveal never
 * replays. Every `li` gets `data-offscreen="true|false"` on each callback, so
 * CSS can pause animation while it is out of view and resume it on re-entry.
 *
 * Under reduced motion, or when `IntersectionObserver` is missing, every
 * reveal is preset at mount and no observer is created, so nothing stays
 * hidden.
 */
export function useDiscovery(
  scrollerRef: RefObject<HTMLElement | null>,
  options: UseDiscoveryOptions = {},
): void {
  const reduced = options.reduced ?? false;
  const watchKey = options.watchKey;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const reveals = Array.from(scroller.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reduced || typeof IntersectionObserver === "undefined") {
      for (const el of reveals) el.setAttribute("data-revealed", "true");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const isItem = el.tagName === "LI";
          if (isItem) {
            el.setAttribute("data-offscreen", entry.isIntersecting ? "false" : "true");
          }
          if (
            entry.isIntersecting &&
            el.hasAttribute("data-reveal") &&
            el.getAttribute("data-revealed") !== "true"
          ) {
            el.setAttribute("data-revealed", "true");
            if (!isItem) observer.unobserve(el);
          }
        }
      },
      { root: scroller },
    );

    const targets = new Set<HTMLElement>(reveals);
    for (const li of Array.from(scroller.querySelectorAll<HTMLElement>("li"))) {
      targets.add(li);
    }
    for (const el of targets) {
      // A reveal that already played must not replay after a re-scan.
      if (el.tagName !== "LI" && el.getAttribute("data-revealed") === "true") continue;
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [scrollerRef, reduced, watchKey]);
}
