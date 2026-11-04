/**
 * Presentational graveyard list.
 *
 * Renders the classified repository rows grouped by lifecycle state. This is a
 * pure presentational component: it performs no data fetching and holds no
 * client state. It receives the already-built rows (produced by `buildRows`)
 * plus a `truncated` flag, groups them with `groupByState`, and renders one
 * heading per state in `STATE_ORDER`.
 *
 * Styling uses theme tokens and Tailwind palette utilities only; no hardcoded
 * hex values appear here.
 *
 * Requirements: 8.1, 8.2, 8.5, 8.9
 */

import {
  groupByState,
  STATE_ORDER,
  truncationNotice,
  type GraveyardRow,
} from "@/lib/graveyard-view";
import type { LifecycleState } from "@/lib/lifecycle";

export interface GraveyardListProps {
  /** Display rows in pushed-at-descending order, as produced by `buildRows`. */
  rows: GraveyardRow[];
  /** Whether the owner's repositories were capped at the 300-repo limit. */
  truncated: boolean;
}

/** Human-readable heading label for each lifecycle state (Req 8.1). */
const STATE_LABELS: Record<LifecycleState, string> = {
  ghost: "Ghosts",
  risen: "Risen",
  zombie: "Zombies",
  tombstone: "Tombstones",
  coffin: "Coffins",
};

/**
 * Renders a single repository row: its name as a link to the repo, the
 * lifecycle state, the days quiet, and the decay level only when non-null
 * (ghost and zombie rows only, Req 8.5).
 */
function RepoRow({ row }: { row: GraveyardRow }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
      <a
        href={row.url}
        className="font-medium text-foreground underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {row.name}
      </a>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        {row.state}
      </span>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        {row.daysQuiet} days quiet
      </span>
      {row.decayLevel !== null && (
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          decay {row.decayLevel}
        </span>
      )}
    </li>
  );
}

export default function GraveyardList({ rows, truncated }: GraveyardListProps) {
  const notice = truncationNotice({ truncated });

  if (rows.length === 0) {
    return (
      <div className="text-foreground">
        <p>No repositories were found.</p>
        {notice && (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            {notice}
          </p>
        )}
      </div>
    );
  }

  const grouped = groupByState(rows);

  return (
    <div className="flex flex-col gap-8 text-foreground">
      {STATE_ORDER.map((state) => {
        const group = grouped[state];
        if (group.length === 0) {
          return null;
        }
        return (
          <section key={state}>
            <h2 className="mb-2 text-xl font-semibold tracking-tight">
              {STATE_LABELS[state]}
            </h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {group.map((row) => (
                <RepoRow key={row.name} row={row} />
              ))}
            </ul>
          </section>
        );
      })}
      {notice && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{notice}</p>
      )}
    </div>
  );
}
