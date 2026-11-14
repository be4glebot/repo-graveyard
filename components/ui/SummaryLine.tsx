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
 * 7.4). Each segment is singular/plural correct: a count of exactly 1 renders
 * the singular noun ("1 ghost", "1 soul") and a count of 0 or 2+ renders the
 * plural ("0 ghosts", "3 ghosts"). The pluralization is driven by the shared
 * `plural` helper exported from `lib/estate-view`, the same helper that backs
 * the place plaques, so the chrome and the plaques always agree (Req 15.5,
 * 15.6, 15.7). The count-invariant phrases "risen", "at rest", and "sealed"
 * read the same at every count and stay as-is.
 *
 * The line is drawn in the letter-spaced Cinzel treatment (the UI/heading face)
 * to match the painted boards (Req 15.3); the counts themselves keep the fact
 * (monospace) face so the numbers line up. It uses only scene foreground color
 * tokens and hardcodes no hex.
 *
 * This component is pure and side-effect free, so it is shareable by server and
 * client code. It accepts either the raw rows (and computes the counts) or a
 * precomputed `SummaryCounts`, so a parent that already derived the counts need
 * not recompute them.
 *
 * Requirements: 7.3, 7.4, 15.3, 15.5, 15.6, 15.7
 */

import type { GraveyardRow } from "@/lib/graveyard-view";
import { plural } from "@/lib/estate-view";
import { summaryCounts, type SummaryCounts } from "@/lib/scene-view";
import { useTheme } from "@/components/scene/ThemeProvider";
import { countKey, dayCopy } from "@/lib/day-copy";

export interface SummaryLineProps {
  /** Rows to summarize; ignored when `counts` is provided. */
  rows?: GraveyardRow[];
  /** Precomputed counts; takes precedence over `rows` when both are given. */
  counts?: SummaryCounts;
}

/**
 * One per-state segment in display order. `singular`/`plural` are the noun
 * forms chosen by count; a count of exactly 1 uses `singular`, 0 or 2+ uses
 * `plural`. The count-invariant phrases ("risen", "at rest", "sealed") use the
 * same string for both forms.
 */
const SEGMENTS: ReadonlyArray<{
  key: keyof Omit<SummaryCounts, "souls">;
  singular: string;
  plural: string;
}> = [
  { key: "ghost", singular: "ghost", plural: "ghosts" },
  { key: "risen", singular: "risen", plural: "risen" },
  { key: "zombie", singular: "zombie", plural: "zombies" },
  { key: "tombstone", singular: "at rest", plural: "at rest" },
  { key: "coffin", singular: "sealed", plural: "sealed" },
];

/** Pick the singular or plural noun for a segment at the given count. */
function nounFor(
  count: number,
  segment: { singular: string; plural: string },
): string {
  return plural(count) === "" ? segment.singular : segment.plural;
}

export default function SummaryLine({ rows, counts }: SummaryLineProps) {
  const { theme } = useTheme();
  const resolved: SummaryCounts = counts ?? summaryCounts(rows ?? []);

  return (
    <p
      data-testid="scene-summary-line"
      className="day-chrome-plate font-heading text-sm uppercase tracking-[2px] text-scene-fg-muted"
    >
      <span className="font-fact text-scene-fg">{resolved.souls}</span>{" "}
      <span>{resolved.souls === 1 ? "soul" : "souls"}</span>
      {SEGMENTS.map((segment) => (
        <span key={segment.key}>
          {" · "}
          <span className="font-fact text-scene-fg">{resolved[segment.key]}</span>{" "}
          <span>
            {theme === "day"
              ? dayCopy(theme, countKey(segment.key, resolved[segment.key]))
              : nounFor(resolved[segment.key], segment)}
          </span>
        </span>
      ))}
    </p>
  );
}
