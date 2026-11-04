/**
 * Pure graveyard view model.
 *
 * Transforms raw repository facts plus per-repo overrides into the display rows
 * and groupings the graveyard page renders. This module performs no I/O, reads
 * no clock, and imports neither `server-only` nor the client-only override
 * store (`lib/overrides.ts`): it accepts a plain `Record<string, Override>` so
 * it stays dependency-free and shareable by both server and client code.
 *
 * Requirements: 8.1, 8.5, 8.9
 */

import {
  classify,
  type Classification,
  type LifecycleState,
  type Override,
  type RepoFacts,
} from "./lifecycle";

/**
 * The five lifecycle states in display order. Groups are rendered in this
 * order; `decayLevel` is non-null only for the ghost and zombie states
 * (Requirement 8.1, 8.5).
 */
export const STATE_ORDER: LifecycleState[] = [
  "ghost",
  "risen",
  "zombie",
  "tombstone",
  "coffin",
];

/** The notice shown when the owner has more than 300 repositories (Req 8.9). */
export const TRUNCATION_NOTICE = "showing the 300 most recently pushed.";

/** A single repository row ready for display (Requirement 8.5). */
export interface GraveyardRow {
  name: string;
  url: string;
  state: LifecycleState;
  daysQuiet: number;
  /** Non-null only for ghost and zombie rows; otherwise null. */
  decayLevel: number | null;
}

/**
 * Builds a display row for each repository. The override for a repo is looked
 * up by `repo.name` (the override map key, Req 6.2); a repo with no entry is
 * classified with no override. The emitted row carries only the view-relevant
 * fields of the classification (Requirement 8.5).
 *
 * `now` is an explicit ISO 8601 parameter threaded through to `classify`; the
 * system clock is never read here. Input order is preserved in the output.
 */
export function buildRows(
  repos: RepoFacts[],
  overrides: Record<string, Override>,
  now: string,
): GraveyardRow[] {
  return repos.map((repo) => {
    const override = overrides[repo.name];
    const classification: Classification = classify(repo, override, now);
    return {
      name: repo.name,
      url: repo.url,
      state: classification.state,
      daysQuiet: classification.daysQuiet,
      decayLevel: classification.decayLevel,
    };
  });
}

/**
 * Groups rows by lifecycle state. Every state key is present (possibly with an
 * empty array), and the input order (pushed-at descending, as produced by the
 * loader) is preserved within each group (Requirement 8.1).
 */
export function groupByState(
  rows: GraveyardRow[],
): Record<LifecycleState, GraveyardRow[]> {
  const grouped: Record<LifecycleState, GraveyardRow[]> = {
    ghost: [],
    risen: [],
    zombie: [],
    tombstone: [],
    coffin: [],
  };
  for (const row of rows) {
    grouped[row.state].push(row);
  }
  return grouped;
}

/**
 * Returns the truncation notice when the loaded data was capped at the 300-repo
 * limit, otherwise `null` (Requirement 8.9).
 */
export function truncationNotice(data: { truncated: boolean }): string | null {
  return data.truncated ? TRUNCATION_NOTICE : null;
}
