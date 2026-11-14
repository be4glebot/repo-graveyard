"use client";

/**
 * Plot pager (client component).
 *
 * Moves between the fixed-size plots of a `PlaceView` and reports the current
 * position as "Plot X of Y" (1-based). Per the mock (`PlaceBeyondGate.dc.html`)
 * and the design, the two controls and their directions are:
 *
 *   "‹ Nearer the gate"      → the PREVIOUS plot (`plotIndex − 1`), i.e. the
 *                              fresher creatures nearer the gate. Disabled on
 *                              the first plot (`plotIndex === 0`).
 *   "Deeper into the dark ›" → the NEXT plot (`plotIndex + 1`), i.e. deeper
 *                              into the older/decayed creatures. Disabled on
 *                              the last plot (`plotIndex === plotCount − 1`).
 *
 * The incoming `plotIndex` is clamped into `0..plotCount−1` before any label or
 * disabled state is derived, so a stale or out-of-range index can never render
 * an incoherent "Plot 0 of Y" or enable a control past the ends (Req 8.3).
 * `plotCount` is always ≥ 1 (empty places paginate to a single empty plot), so
 * the clamp and the "of Y" are always well-defined.
 *
 * Requirements: 8.1, 8.2, 8.3
 */

import { useTheme } from "@/components/scene/ThemeProvider";
import { dayCopy } from "@/lib/day-copy";

export interface PagerProps {
  /** The current 0-based plot index (may be out of range; clamped here). */
  plotIndex: number;
  /** Total number of plots (always ≥ 1). */
  plotCount: number;
  /** Raised with the next 0-based plot index when a control is activated. */
  onPlotChange: (index: number) => void;
}

/**
 * Shared `fixture-rail` (iron rail) treatment for the two pager controls. The base
 * class from the boards owns the box, Cinzel uppercase label, border, and
 * background (Req 7.1); the utilities here carry only interaction and disabled
 * state so the two controls still disable correctly at the plot ends.
 */
const PAGER_BUTTON = [
  "fixture-rail pointer-events-auto px-4 py-2 font-heading text-xs uppercase tracking-[1.5px] transition-colors",
  "enabled:cursor-pointer enabled:hover:border-candle-400",
  "disabled:cursor-not-allowed disabled:opacity-40",
].join(" ");

export default function Pager({
  plotIndex,
  plotCount,
  onPlotChange,
}: PagerProps) {
  const { theme } = useTheme();
  // Clamp defensively so an out-of-range index never renders an incoherent
  // label or mis-enabled control (Req 8.3). `plotCount` is ≥ 1 by contract.
  const count = Math.max(1, plotCount);
  const index = Math.min(Math.max(0, plotIndex), count - 1);

  // "Nearer the gate" steps to the fresher, lower-index plot; disabled on the
  // first plot. "Deeper into the dark" steps to the higher-index plot; disabled
  // on the last plot.
  const atFirst = index === 0;
  const atLast = index === count - 1;

  return (
    <div
      data-testid="pager"
      className="flex items-center justify-center gap-4"
    >
      <button
        type="button"
        data-testid="pager-nearer"
        title={dayCopy(theme, "pager.nearer.title")}
        disabled={atFirst}
        onClick={() => onPlotChange(index - 1)}
        className={PAGER_BUTTON}
      >
        {dayCopy(theme, "pager.nearer")}
      </button>

      <span
        data-testid="pager-label"
        title="Page of projects in this place"
        className="day-chrome-plate font-heading text-xs uppercase tracking-[2px] text-scene-fg-muted"
      >
        Plot {index + 1} of {count}
      </span>

      <button
        type="button"
        data-testid="pager-deeper"
        title={dayCopy(theme, "pager.deeper.title")}
        disabled={atLast}
        onClick={() => onPlotChange(index + 1)}
        className={PAGER_BUTTON}
      >
        {dayCopy(theme, "pager.deeper")}
      </button>
    </div>
  );
}
