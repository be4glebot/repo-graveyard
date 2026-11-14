"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Stratum } from "@/lib/world-layout";
import { useMedia } from "@/components/ui/useMedia";

/** Minimum gap between two live-region updates (ms). */
export const LIVE_MIN_INTERVAL_MS = 1000;

export interface DepthMarkerProps {
  strata: Stratum[];
  lengthVh: number;
  /** Index of the current Stratum (from `useWorldScroll`'s `onStratumChange`). */
  current: number;
  /** Place name announced with the Stratum label. */
  placeName?: string;
  /** Returns the anchor element at a Stratum's top. */
  getAnchor?: (stratum: Stratum, index: number) => HTMLElement | null;
}

/**
 * Whether a marker of `markerH` px fits a host band of `bandH` px. An unmeasured
 * marker (0 tall, e.g. jsdom or before layout) counts as fitting, so tests and
 * first paint keep it; a collapsed band (0 or negative) fits nothing.
 */
export function markerFits(markerH: number, bandH: number): boolean {
  if (!(markerH > 0)) return true;
  return markerH <= Math.max(0, bandH) + 1;
}

function defaultAnchor(stratum: Stratum): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(
    `[data-stratum-anchor="${CSS.escape(stratum.id)}"]`,
  );
}

/**
 * Depth marker: a `nav` with an `ol` of native buttons, one per Stratum.
 * Hidden when the world is one viewport long. The live region changes only
 * when the Stratum changes, and at most once per second.
 */
export default function DepthMarker({
  strata,
  lengthVh,
  current,
  placeName,
  getAnchor,
}: DepthMarkerProps) {
  const reduced = useMedia("(prefers-reduced-motion: reduce)", false);
  const [liveText, setLiveText] = useState("");

  const index = Math.min(Math.max(0, current), Math.max(0, strata.length - 1));
  const label = strata[index]?.label ?? "";
  const announcement = placeName ? `${placeName}: ${label}` : label;

  const announcementRef = useRef(announcement);
  const lastIndexRef = useRef(index);
  const lastAnnounceRef = useRef(Number.NEGATIVE_INFINITY);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    announcementRef.current = announcement;
    // Announce only when the Stratum changed, never for the initial value.
    if (index === lastIndexRef.current) return;
    lastIndexRef.current = index;
    if (timerRef.current) return; // a pending update will read the latest text
    const wait = lastAnnounceRef.current + LIVE_MIN_INTERVAL_MS - Date.now();
    const flush = () => {
      timerRef.current = null;
      lastAnnounceRef.current = Date.now();
      setLiveText(announcementRef.current);
    };
    if (wait <= 0) {
      flush();
    } else {
      timerRef.current = setTimeout(flush, wait);
    }
  }, [index, announcement]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const present = !(lengthVh === 1 || strata.length <= 1);

  // The marker lives in the band between the top and bottom chrome. On short
  // viewports that band is smaller than the marker, so it would run into the
  // title, filters or pager; hide it then (scrolling still works, and the
  // keyboard scroll keys move through the place) (25.3).
  const navRef = useRef<HTMLElement | null>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const host = nav?.parentElement;
    if (!present || !nav || !host) return;
    const measure = (): void => {
      setFits(markerFits(nav.offsetHeight, host.clientHeight));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [present, strata.length]);

  if (!present) return null;

  const total = strata.length;

  return (
    <nav
      ref={navRef}
      aria-label="Depth"
      data-testid="depth-marker"
      data-fit={fits ? "true" : "false"}
      className="pointer-events-auto absolute right-2 top-1/2 z-50 flex -translate-y-1/2 flex-col items-end gap-2 data-[fit=false]:invisible"
    >
      <p
        data-testid="depth-marker-label"
        title="Where you are as you scroll. Use the diamonds below to jump to a section."
        className="max-w-[9rem] rounded-sm border border-[color:var(--color-plaque-border)] bg-[linear-gradient(to_bottom,var(--color-plaque-bg-top),var(--color-plaque-bg-bottom))] px-2 py-0.5 text-right font-heading text-xs uppercase leading-tight tracking-wider text-[color:var(--color-plaque-name)]"
      >
        {label}
      </p>
      <ol className="flex flex-col items-end gap-1">
        {strata.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              aria-label={s.label}
              aria-current={i === index ? "true" : undefined}
              title={`Jump to: ${s.label}`}
              data-testid={`depth-step-${i}`}
              onClick={() => {
                const anchor = (getAnchor ?? defaultAnchor)(s, i);
                anchor?.scrollIntoView({
                  block: "start",
                  behavior: reduced ? "auto" : "smooth",
                });
              }}
              className="flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-candle-400"
            >
              <span
                aria-hidden="true"
                className={
                  i === index
                    ? "block h-3 w-3 rotate-45 bg-candle-400"
                    : "block h-2 w-2 rotate-45 bg-moon-100/50"
                }
              />
            </button>
          </li>
        ))}
      </ol>
      <span aria-hidden="true" className="sr-only">
        {index + 1} of {total}
      </span>
      <div aria-live="polite" role="status" data-testid="depth-marker-live" className="sr-only">
        {liveText}
      </div>
    </nav>
  );
}
