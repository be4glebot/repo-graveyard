/**
 * Scene footer strip (presentational).
 *
 * The bottom chrome of the scene: the sample-estate plaque aligned to the left
 * edge and the legend/key aligned to the right edge (Req 7.10). The strip is a
 * single flex row pinned to the bottom of the scene shell; the parent stacks it
 * below the creature zones (footer z-index above the backdrop, below the
 * header) so it never overlaps any creature's rendered bounds.
 *
 * The plaque only appears for the bundled sample estate: when `mode ===
 * "estate"` it shows the exact brass-plaque text "Sample estate. Enter your own
 * name at the gate." (Req 10.5); on the live routes the plaque is omitted and
 * only the legend shows.
 *
 * The legend/key names the five lifecycle states with their scene labels
 * (ghost · risen · zombie · at rest · sealed), matching the Scene_Summary
 * wording so "at rest" = tombstones and "sealed" = coffins read consistently.
 * Per this design the five states are grouped under their four places (Req
 * 15.8): each place from `PLACES` heads a group listing the scene labels of the
 * states it holds, so the gate shows both "zombie" and "risen" while the three
 * single-state places show one label each. `PLACES` is the single source of
 * truth for the place names and their member states, so the legend and the
 * estate map always tell the same story. It is marked up as a nested list for
 * assistive tech.
 *
 * No interactivity lives here, so this stays a shared / server component (no
 * `"use client"`). All color comes from `@theme` tokens and all type from the
 * scene font tokens — the plaque in the narrative face, the legend in the UI
 * face — with no hardcoded hex.
 *
 * Requirements: 7.10, 10.1, 10.2, 15.8
 */

import { type LifecycleState } from "@/lib/lifecycle";
import { PLACE_ORDER, PLACES } from "@/lib/estate-view";

/** The scene render modes; the plaque is shown only for the sample estate. */
export type SceneMode = "live" | "estate";

/** Exact brass-plaque copy for the sample estate (Req 10.5). */
const ESTATE_PLAQUE_TEXT = "Sample estate. Enter your own name at the gate.";

/**
 * Scene label for each lifecycle state. Mirrors the Scene_Summary wording
 * (tombstone → "at rest", coffin → "sealed") so the legend and the summary line
 * stay consistent. The place grouping and display order come from `PLACES` /
 * `PLACE_ORDER`; this map only supplies each state's human label.
 */
const STATE_LABEL: Record<LifecycleState, string> = {
  ghost: "ghost",
  risen: "risen",
  zombie: "zombie",
  tombstone: "at rest",
  coffin: "sealed",
};

export interface FooterProps {
  /**
   * Which scene this footer belongs to. `"estate"` shows the sample-estate
   * plaque; `"live"` (the default) omits it and renders only the legend.
   */
  mode?: SceneMode;
}

export default function Footer({ mode = "live" }: FooterProps) {
  return (
    <footer
      data-testid="scene-footer"
      className={[
        "pointer-events-none flex w-full items-center justify-between gap-4 px-4 py-2",
      ].join(" ")}
      style={{ color: "var(--color-scene-fg-muted)" }}
    >
      {/* Plaque (left) — sample estate only. A spacer keeps the legend pinned
          right when the plaque is absent. */}
      {mode === "estate" ? (
        <p
          data-testid="scene-footer-plaque"
          className="font-[family-name:var(--font-narrative)] italic text-sm"
          style={{
            color: "var(--color-candle-tan)",
            textShadow: "0 1px 6px var(--color-night-sky)",
          }}
        >
          {ESTATE_PLAQUE_TEXT}
        </p>
      ) : (
        <span aria-hidden="true" />
      )}

      {/* Legend / key (right): the five states grouped under their four places
          (Req 15.8). Each place heads a group; the gate lists both of its
          states ("zombie" and "risen"), the other three list one each. */}
      {/* Hidden below 768px: the legend lives in the header Menu panel there,
          so the compact Bottom_Bar holds only the Pager. */}
      <SceneLegend
        testId="scene-footer-legend"
        className="max-[767px]:hidden"
      />
    </footer>
  );
}

export interface SceneLegendProps {
  /** `data-testid` for the legend list. */
  testId: string;
  /** Extra classes (e.g. responsive visibility). */
  className?: string;
}

/** The lifecycle legend list, shared by the desktop footer and the compact menu. */
export function SceneLegend({ testId, className }: SceneLegendProps) {
  return (
    <ul
      data-testid={testId}
      aria-label="Lifecycle legend"
      className={[
        "flex flex-wrap items-start gap-x-4 gap-y-1",
        "font-[family-name:var(--font-ui)] text-xs",
        className ?? "",
      ].join(" ")}
    >
      {PLACE_ORDER.map((placeId) => {
        const place = PLACES[placeId];
        return (
          <li
            key={placeId}
            data-legend-place={placeId}
            className="flex flex-col gap-0.5"
          >
            <span
              className="font-[family-name:var(--font-heading)] uppercase tracking-[1.5px]"
              style={{ color: "var(--color-candle-tan)" }}
            >
              {place.name}
            </span>
            <ul className="flex flex-wrap items-center gap-x-2">
              {place.states.map((state) => (
                <li
                  key={state}
                  data-legend-state={state}
                  className="whitespace-nowrap"
                >
                  {STATE_LABEL[state]}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
