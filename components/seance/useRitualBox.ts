"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { RITUAL_DEFAULT_BOX, ritualGeometry, type RitualGeometry } from "@/lib/seance-ritual";

/**
 * Measures the ritual's box (it follows the panel and the viewport) and returns
 * the pixel layout for it. Until a real size is known, and in jsdom (which has
 * no layout), the default box is used.
 */
export function useRitualGeometry(ref: RefObject<HTMLElement | null>): RitualGeometry {
  const [size, setSize] = useState<{ width: number; height: number }>({ ...RITUAL_DEFAULT_BOX });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const width = Math.round(r.width);
      const height = Math.round(r.height);
      if (width <= 0 || height <= 0) return;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return ritualGeometry(size);
}