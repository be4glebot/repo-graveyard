"use client";

import { useMedia } from "@/components/ui/useMedia";
import { COMPACT_MAX_WIDTH_PX } from "@/lib/estate-view";

/** The one compact (Mobile_Viewport) media query; mirrors the CSS breakpoint. */
export const COMPACT_QUERY = `(max-width: ${COMPACT_MAX_WIDTH_PX}px)`;

/**
 * The single source of truth for compact vs desktop in JS. Every component
 * that needs the decision calls this hook (or receives `compact` as a prop
 * from one that did). Widths are never used to decide; only layout math.
 * Returns false on the server, during hydration, and without `matchMedia`.
 */
export function useIsCompact(): boolean {
  return useMedia(COMPACT_QUERY, false);
}
