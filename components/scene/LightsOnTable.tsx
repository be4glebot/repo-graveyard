/**
 * Lights-on accessible data table.
 *
 * The warm-paper, "lights on" readable view of the graveyard: a proper
 * semantic HTML `<table>` listing every repository with its lifecycle state
 * and key facts. It is built from the SAME `rows: GraveyardRow[]` the scene
 * renders, so the table shows the same set and count of repositories in the
 * same order as the creatures in the scene — it exactly matches the scene
 * (Req 11.7). Rows arrive in pushed-at-descending order (as produced by the
 * loader / `buildRows`), which is the default "Last push descending" ordering.
 *
 * This is a purely presentational component: it fetches no data, holds no
 * client state, and needs no client-only APIs (it reads the theme through
 * context, so it renders under client parents). Interactivity (the Lights-on toggle,
 * column-header re-sorting) lives in the owning client component.
 *
 * The register carries a **Place** column (`PLACES[placeOf(row)].name`)
 * alongside the existing Repository, State, Quiet-for, and Decay columns, so
 * the full list reads clearly across all four places (estate-map Req 14.2,
 * 14.3). `placeOf` is the frozen, pure state→place mapping, so the column stays
 * presentational. The only context it reads is the theme (`useTheme`, which
 * returns night outside a provider), so it is rendered from client components.
 *
 * Styling uses the warm-paper register tokens from `app/globals.css`
 * (`--color-paper-*`, `--color-ink-*`, `--color-candle-tan`) and the scene
 * font tokens only — no hardcoded hex. Accessibility: a real `<table>` with a
 * `<caption>`, `<th scope="col">` column headers, `<th scope="row">` row
 * headers for the repository, and links with discernible text, so the data is
 * fully navigable and determinable for screen readers (Req 9.6).
 *
 * Requirements: 11.7, 9.6, estate-map 14.2, 14.3
 */

import type { CSSProperties } from "react";

import { type GraveyardRow } from "@/lib/graveyard-view";
import { placeOf } from "@/lib/estate-view";
import { dayCopy, placeNameKey } from "@/lib/day-copy";
import { useTheme } from "@/components/scene/ThemeProvider";
import type { LifecycleState } from "@/lib/lifecycle";

export interface LightsOnTableProps {
  /**
   * Display rows in pushed-at-descending order, as produced by `buildRows` and
   * rendered by the scene. The table is built from exactly these rows so it
   * matches the scene's set, count, and order (Req 11.7).
   */
  rows: GraveyardRow[];
  /** The graveyard owner, used in the caption so the table names whose estate it is. */
  username?: string;
}

/** Human-readable lifecycle label shown in the soft pill state tag (Req 10.2). */
const STATE_LABELS: Record<LifecycleState, string> = {
  ghost: "Ghost",
  risen: "Risen",
  zombie: "Zombie",
  tombstone: "Tombstone",
  coffin: "Coffin",
};

/**
 * Turns a whole-day count into a readable "quiet for" phrase, e.g. "today",
 * "3 days", "8 months", "2 years", using the largest natural unit. Mirrors the
 * humanizing used for the creature accessible names so the readable view reads
 * the same way. Total: a non-finite or negative input collapses to 0 days.
 */
function humanizeDaysQuiet(days: number): string {
  const d = Number.isFinite(days) && days > 0 ? Math.trunc(days) : 0;
  const unit = (value: number, name: string): string =>
    `${value} ${name}${value === 1 ? "" : "s"}`;
  if (d === 0) {
    return "today";
  }
  if (d >= 365) {
    return unit(Math.floor(d / 365), "year");
  }
  if (d >= 30) {
    return unit(Math.floor(d / 30), "month");
  }
  return unit(d, "day");
}

/** Warm-paper register colors, pulled straight from the `@theme` tokens. */
const paperStyle: CSSProperties = {
  backgroundColor: "var(--color-paper-200)",
  color: "var(--color-ink-900)",
};
const cardStyle: CSSProperties = {
  backgroundColor: "var(--color-paper-100)",
  borderColor: "var(--color-paper-border)",
};
const headCellStyle: CSSProperties = {
  color: "var(--color-ink-400)",
  borderColor: "var(--color-paper-border)",
};
const bodyCellStyle: CSSProperties = {
  color: "var(--color-ink-600)",
  borderColor: "var(--color-paper-border)",
};
const pillStyle: CSSProperties = {
  backgroundColor: "var(--color-ink-tag-bg)",
  color: "var(--color-ink-tag-fg)",
};

/**
 * Renders the Lights-on data table. The columns cover the repository (as a link
 * to `row.url`), its lifecycle state, how long it has been quiet (humanized,
 * with the exact day count exposed for assistive tech), and the decay level
 * where applicable (ghost and zombie rows only; otherwise an em dash).
 */
export default function LightsOnTable({ rows, username }: LightsOnTableProps) {
  const { theme } = useTheme();
  const owner = username?.trim();
  const caption = owner
    ? `The estate register for ${owner} — ${rows.length} ${
        rows.length === 1 ? "repository" : "repositories"
      }, sorted by last push.`
    : `The estate register — ${rows.length} ${
        rows.length === 1 ? "repository" : "repositories"
      }, sorted by last push.`;

  return (
    <div
      data-testid="lights-on-view"
      className="min-h-full w-full px-6 py-10 sm:px-12 sm:py-14"
      style={paperStyle}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-7">
        <header className="flex flex-col gap-2">
          <span
            className="font-heading text-xs font-bold uppercase tracking-[3px]"
            style={{ color: "var(--color-candle-tan)" }}
          >
            The estate register
          </span>
          <h1
            className="m-0 font-narrative text-4xl font-normal leading-tight sm:text-5xl"
            style={{ color: "var(--color-ink-900)" }}
          >
            {owner ? `${owner}, every project accounted for.` : "Every project accounted for."}
          </h1>
        </header>

        <div
          className="overflow-x-auto rounded-2xl border shadow-sm"
          style={cardStyle}
        >
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b px-6 py-4 font-[family-name:var(--font-fact)] text-[11px] font-medium uppercase tracking-[1.5px]"
                  style={headCellStyle}
                >
                  Repository
                </th>
                <th
                  scope="col"
                  className="border-b px-6 py-4 font-[family-name:var(--font-fact)] text-[11px] font-medium uppercase tracking-[1.5px]"
                  style={headCellStyle}
                >
                  {dayCopy(theme, "table.place")}
                </th>
                <th
                  scope="col"
                  className="border-b px-6 py-4 font-[family-name:var(--font-fact)] text-[11px] font-medium uppercase tracking-[1.5px]"
                  style={headCellStyle}
                >
                  State
                </th>
                <th
                  scope="col"
                  className="border-b px-6 py-4 font-[family-name:var(--font-fact)] text-[11px] font-medium uppercase tracking-[1.5px]"
                  style={headCellStyle}
                >
                  Quiet for
                </th>
                <th
                  scope="col"
                  className="border-b px-6 py-4 font-[family-name:var(--font-fact)] text-[11px] font-medium uppercase tracking-[1.5px]"
                  style={headCellStyle}
                >
                  Decay
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center font-narrative text-base italic"
                    style={{ color: "var(--color-ink-600)" }}
                  >
                    No repositories rest on this estate.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.name}>
                    <th
                      scope="row"
                      className="border-b px-6 py-3 text-left font-[family-name:var(--font-fact)] text-sm font-normal"
                      style={bodyCellStyle}
                    >
                      <a
                        href={row.url}
                        className="underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        style={{ color: "var(--color-ink-900)" }}
                      >
                        {row.name}
                      </a>
                    </th>
                    <td
                      className="border-b px-6 py-3 font-[family-name:var(--font-fact)] text-sm"
                      style={bodyCellStyle}
                    >
                      {dayCopy(theme, placeNameKey(placeOf(row)))}
                    </td>
                    <td
                      className="border-b px-6 py-3"
                      style={bodyCellStyle}
                    >
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={pillStyle}
                      >
                        {STATE_LABELS[row.state]}
                      </span>
                    </td>
                    <td
                      className="border-b px-6 py-3 font-[family-name:var(--font-fact)] text-sm"
                      style={bodyCellStyle}
                    >
                      {humanizeDaysQuiet(row.daysQuiet)}
                      <span className="sr-only">
                        {` (${row.daysQuiet} days quiet)`}
                      </span>
                    </td>
                    <td
                      className="border-b px-6 py-3 font-[family-name:var(--font-fact)] text-sm"
                      style={bodyCellStyle}
                    >
                      {row.decayLevel !== null ? row.decayLevel : "\u2014"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
