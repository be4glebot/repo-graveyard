/**
 * Lifecycle_Config and the shared domain types used across the pure core and
 * the I/O shell.
 *
 * `LIFECYCLE_CONFIG` is the single source of truth for every threshold in the
 * classification system. No magic numbers may appear elsewhere in the codebase;
 * all thresholds are read from this object (Requirements 3.14, 5.4).
 *
 * The `daysQuiet` and `classify` implementations are intentionally NOT defined
 * here — they belong to a later task. This module only establishes the config
 * constant and the exported types that other modules depend on.
 */

export const LIFECYCLE_CONFIG = {
  ghostMaxDaysQuiet: 90, // days_quiet < 90 => ghost
  ghostDecayBounds: [14, 30, 60], // level = count of bounds <= days_quiet (0..3)
  zombieDecayBounds: [182, 365, 730, 1095], // level 0..4
  reviveWindowDays: 14,
  readmeMinBytes: 1024,
  manyIssues: 10,
  finishedCommitKeywords: ["v1.0", "release", "final", "done", "ship"],
  unfinishedCommitKeywords: ["wip", "todo", "temp", "fix later"],
  finishedMargin: 2,
  maxRepos: 300,
  pageSize: 100,
  msPerDay: 86_400_000,
} as const;

/** The five lifecycle states a repository can be classified into. */
export type LifecycleState = "ghost" | "risen" | "zombie" | "tombstone" | "coffin";

/** The user-settable override intents, at most one per repo. */
export type OverrideType = "finished" | "scrapped" | "revived";

/** A single user override: an intent plus the ISO 8601 timestamp it was set. */
export interface Override {
  type: OverrideType;
  /** ISO 8601 datetime string recording when the override was set. */
  setAt: string;
}

/** The raw, classification-relevant facts for a single repository. */
export interface RepoFacts {
  name: string;
  description: string | null;
  url: string;
  pushedAt: string | null;
  createdAt: string;
  isArchived: boolean;
  isFork: boolean;
  homepageUrl: string | null;
  stargazerCount: number;
  primaryLanguage: string | null;
  openIssueCount: number;
  releaseCount: number;
  /** README size in bytes; null = no README found. */
  readmeBytes: number | null;
  lastCommitMessage: string | null;
}

/** The result of classifying a single repository. */
export interface Classification {
  state: LifecycleState;
  /** ghost 0-3, zombie 0-4, otherwise null. */
  decayLevel: number | null;
  /** Always >= 0. */
  daysQuiet: number;
  /** Contains "revived" when a revived override lapsed or was satisfied. */
  clearedOverrides: OverrideType[];
}
