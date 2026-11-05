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
 * It is marked up as a list for assistive tech.
 *
 * No interactivity lives here, so this stays a shared / server component (no
 * `"use client"`). All color comes from `@theme` tokens and all type from the
 * scene font tokens — the plaque in the narrative face, the legend in the UI
 * face — with no hardcoded hex.
 *
 * Requirements: 7.10, 10.1, 10.2
 */

import { type LifecycleState } from "@/lib/lifecycle";

/** The scene render modes; the plaque is shown only for the sample estate. */
export type SceneMode = "live" | "estate";

/** Exact brass-plaque copy for the sample estate (Req 10.5). */
const ESTATE_PLAQUE_TEXT = "Sample estate. Enter your own name at the gate.";

/**
 * The five lifecycle states in display order, paired with their scene labels.
 * Mirrors the Scene_Summary wording (tombstone → "at rest", coffin → "sealed")
 * so the legend and the summary line stay consistent.
 */
const LEGEND: { state: LifecycleState; label: string }[] = [
  { state: "ghost", label: "ghost" },
  { state: "risen", label: "risen" },
  { state: "zombie", label: "zombie" },
  { state: "tombstone", label: "at rest" },
  { state: "coffin", label: "sealed" },
];

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

      {/* Legend / key (right). */}
      <ul
        data-testid="scene-footer-legend"
        aria-label="Lifecycle legend"
        className={[
          "flex flex-wrap items-center gap-x-3 gap-y-1",
          "font-[family-name:var(--font-ui)] text-xs",
        ].join(" ")}
      >
        {LEGEND.map(({ state, label }) => (
          <li
            key={state}
            data-legend-state={state}
            className="whitespace-nowrap"
          >
            {label}
          </li>
        ))}
      </ul>
    </footer>
  );
}
