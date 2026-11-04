/**
 * Lifecycle_Config and the shared domain types used across the pure core and
 * the I/O shell.
 *
 * `LIFECYCLE_CONFIG` is the single source of truth for every threshold in the
 * classification system. No magic numbers may appear elsewhere in the codebase;
 * all thresholds are read from this object (Requirements 3.14, 5.4).
 *
 * The pure classification engine (`daysQuiet` and `classify`) lives at the
 * bottom of this module, below the config constant and shared type
 * definitions it depends on.
 */

import { isFinished } from "./finished";

export const LIFECYCLE_CONFIG = {
  ghostMaxDaysQuiet: 90, // days_quiet < 90 => ghost
  ghostDecayBounds: [14, 30, 60], // level = count of bounds <= days_quiet (0..3)
  zombieDecayBounds: [182, 365, 730, 1095], // level 0..4
  reviveWindowDays: 14,
  readmeMinBytes: 1024,
  manyIssues: 10,
  popularStars: 50, // stargazerCount >= this is a finished signal and suppresses many-issues
  finishedCommitKeywords: ["v1.0", "release", "final", "done", "ship"],
  unfinishedCommitKeywords: ["wip", "todo", "temp", "fix later"],
  finishedMargin: 2,
  maxRepos: 300,
  pageSize: 50,
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

// ---------------------------------------------------------------------------
// Pure classification engine (Requirements 3.1-3.14, 4.1-4.6)
// ---------------------------------------------------------------------------

/**
 * Parses an ISO 8601 datetime string to epoch milliseconds, returning `null`
 * when the string is absent or unparseable. Keeps the engine total: no input
 * can make it throw or produce `NaN`.
 */
function parseMs(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Returns true iff `pushedAt` is present, parseable, and strictly after
 * `setAt`. A `null` or unparseable `pushedAt` (or `setAt`) is treated as "not
 * after", so a revival is never satisfied by a missing push timestamp.
 */
function pushedAfter(pushedAt: string | null, setAt: string): boolean {
  const pushed = parseMs(pushedAt);
  const set = parseMs(setAt);
  if (pushed === null || set === null) {
    return false;
  }
  return pushed > set;
}

/**
 * Days elapsed between two ISO timestamps as `floor((to - from) / msPerDay)`.
 * A future `from` (relative to `to`) yields a negative count. Returns `null`
 * when either timestamp is unparseable, which the caller treats as a lapsed
 * (>= window) revival.
 */
function daysBetween(from: string, to: string): number | null {
  const fromMs = parseMs(from);
  const toMs = parseMs(to);
  if (fromMs === null || toMs === null) {
    return null;
  }
  return Math.floor((toMs - fromMs) / LIFECYCLE_CONFIG.msPerDay);
}

/**
 * Computes `days_quiet` for a repository: `max(0, floor((now - base) / 1 day))`
 * where `base` is `pushedAt` when present and parseable, otherwise `createdAt`.
 * An unparseable `createdAt` (and no usable `pushedAt`) yields 0. The result is
 * always a non-negative integer and never `NaN` (Requirement 4.1).
 *
 * `now` is an explicit ISO 8601 parameter; the system clock is never read
 * (Requirement 3.13).
 */
export function daysQuiet(
  repo: Pick<RepoFacts, "pushedAt" | "createdAt">,
  now: string,
): number {
  const nowMs = parseMs(now);
  if (nowMs === null) {
    return 0;
  }
  const base = parseMs(repo.pushedAt) ?? parseMs(repo.createdAt);
  if (base === null) {
    return 0;
  }
  const quiet = Math.floor((nowMs - base) / LIFECYCLE_CONFIG.msPerDay);
  return quiet > 0 ? quiet : 0;
}

/**
 * Counts how many bounds are `<= value`. Because the bounds are ascending, this
 * yields the decay band index: 0 for below the first bound, up to `bounds.length`.
 */
function decayLevelFor(value: number, bounds: readonly number[]): number {
  let level = 0;
  for (const bound of bounds) {
    if (bound <= value) {
      level += 1;
    }
  }
  return level;
}

/**
 * Classifies a repository into exactly one lifecycle state with a decay level
 * where applicable, honoring an optional per-repo override.
 *
 * The ten precedence rules of Requirement 3 are evaluated in order with early
 * returns. Rules 3 and 5 clear a `revived` override and fall through to the
 * archived rule as if no override were set. `now` is an explicit ISO 8601
 * parameter (Requirement 3.13); all thresholds come from `LIFECYCLE_CONFIG`
 * (Requirement 3.14). The function is total: no input throws or yields `NaN`.
 */
export function classify(
  repo: RepoFacts,
  override: Override | undefined,
  now: string,
): Classification {
  const dq = daysQuiet(repo, now);
  const clearedOverrides: OverrideType[] = [];

  if (override !== undefined) {
    // Rule 1: a finished override is terminal -> tombstone.
    if (override.type === "finished") {
      return { state: "tombstone", decayLevel: null, daysQuiet: dq, clearedOverrides };
    }
    // Rule 2: a scrapped override is terminal -> coffin.
    if (override.type === "scrapped") {
      return { state: "coffin", decayLevel: null, daysQuiet: dq, clearedOverrides };
    }
    // Rule 3/4/5: revived override.
    if (override.type === "revived") {
      if (pushedAfter(repo.pushedAt, override.setAt)) {
        // Rule 3: pushed since the revive -> clear and continue as no-override.
        clearedOverrides.push("revived");
      } else {
        const elapsed = daysBetween(override.setAt, now);
        // Rule 4: within the revive window and not pushed after -> risen.
        // An unparseable setAt (elapsed === null) is treated as lapsed.
        if (elapsed !== null && elapsed < LIFECYCLE_CONFIG.reviveWindowDays) {
          return { state: "risen", decayLevel: null, daysQuiet: dq, clearedOverrides };
        }
        // Rule 5: lapsed (>= window, or unparseable) -> clear and continue.
        clearedOverrides.push("revived");
      }
    }
  }

  // Rules 6 & 7: archived repositories are terminal.
  if (repo.isArchived) {
    const state: LifecycleState = isFinished(repo) ? "tombstone" : "coffin";
    return { state, decayLevel: null, daysQuiet: dq, clearedOverrides };
  }

  // Rule 8: a recent push -> ghost (with decay band).
  if (dq < LIFECYCLE_CONFIG.ghostMaxDaysQuiet) {
    return {
      state: "ghost",
      decayLevel: decayLevelFor(dq, LIFECYCLE_CONFIG.ghostDecayBounds),
      daysQuiet: dq,
      clearedOverrides,
    };
  }

  // Rule 9: finished signals -> tombstone.
  if (isFinished(repo)) {
    return { state: "tombstone", decayLevel: null, daysQuiet: dq, clearedOverrides };
  }

  // Rule 10: otherwise -> zombie (with decay band).
  return {
    state: "zombie",
    decayLevel: decayLevelFor(dq, LIFECYCLE_CONFIG.zombieDecayBounds),
    daysQuiet: dq,
    clearedOverrides,
  };
}
