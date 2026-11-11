"use client";

import { useCallback, useSyncExternalStore } from "react";

function hasMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * Subscribes to a CSS media query. `serverValue` is returned during SSR,
 * hydration, and whenever `matchMedia` is unavailable (e.g. jsdom).
 */
export function useMedia(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!hasMatchMedia()) return () => {};
      try {
        const mq = window.matchMedia(query);
        if (typeof mq?.addEventListener === "function") {
          mq.addEventListener("change", cb);
          return () => mq.removeEventListener("change", cb);
        }
        if (typeof mq?.addListener === "function") {
          mq.addListener(cb);
          return () => mq.removeListener(cb);
        }
      } catch {
        // fall through to no-op
      }
      return () => {};
    },
    [query],
  );

  const getSnapshot = useCallback((): boolean => {
    if (!hasMatchMedia()) return serverValue;
    try {
      const mq = window.matchMedia(query);
      return typeof mq?.matches === "boolean" ? mq.matches : serverValue;
    } catch {
      return serverValue;
    }
  }, [query, serverValue]);

  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
