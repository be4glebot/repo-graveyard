/**
 * Graveyard summary line (presentational).
 *
 * Renders the per-state counts plus the total "souls" from `summaryCounts(rows)`
 * as a single readable line:
 *
 *   "<souls> souls · <n> ghosts · <n> risen · <n> zombies · <n> at rest · <n> sealed"
 *
 * Every category is shown even when its count is 0 — `summaryCounts` already
 * returns zeros for empty buckets and this component never drops them (Req 7.3,
 * 7.4). The line uses the fact/UI font tokens and scene foreground color
 * tokens; it hardcodes no hex.
 *
 * This component is pure and side-effect free, so it is shareable by server and
 * client code. It accepts either the raw rows (and computes the counts) or a
 * precomputed `SummaryCounts`, so a parent that already derived the counts need
 * not recompute them.
 *
 * Requirements: 7.3, 7.4
 */

import type { GraveyardRow } from "@/lib/graveyard-view";
import { summaryCounts, type SummaryCounts } from "@/lib/scene-view";

export interface SummaryLineProps {
  /** Rows to summarize; ignored when `counts` is provided. */
  rows?: GraveyardRow[];
  /** Precomputed counts; takes precedence over `rows` when both are given. */
  counts?: SummaryCounts;
}

/** The per-state segments in display order, each with its singular/plural-ready label. */
const SEGMENTS: ReadonlyArray<{ key: keyof Omit<SummaryCounts, "souls">; label: string }> = [
  { key: "ghost", label: "ghosts" },
  { key: "risen", label: "risen" },
  { key: "zombie", label: "zombies" },
  { key: "tombstone", label: "at rest" },
  { key: "coffin", label: "sealed" },
];

export default function SummaryLine({ rows, counts }: SummaryLineProps) {
  const resolved: SummaryCounts = counts ?? summaryCounts(rows ?? []);

  return (
    <p className="font-ui text-sm text-scene-fg-muted">
      <span className="font-fact text-scene-fg">{resolved.souls}</span>{" "}
      <span>souls</span>
      {SEGMENTS.map((segment) => (
        <span key={segment.key}>
          {" · "}
          <span className="font-fact text-scene-fg">{resolved[segment.key]}</span>{" "}
          <span>{segment.label}</span>
        </span>
      ))}
    </p>
  );
}
