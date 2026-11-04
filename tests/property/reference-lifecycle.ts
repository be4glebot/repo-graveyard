/**
 * Reference lifecycle model for Property 6 (task 4.4).
 *
 * This is a test helper, NOT a test (it contains no `fc.assert`). It
 * re-derives the lifecycle `state` of a repository from the ten ordered
 * precedence rules of Requirement 3 using a flat, table-driven structure:
 * an ordered list of `[predicate, state]` pairs where the first matching
 * predicate wins.
 *
 * It is deliberately implemented INDEPENDENTLY of the production `classify`
 * branching in `lib/lifecycle.ts` so that Property 6 compares two genuinely
 * different derivations of the same rules. In particular:
 *  - `classify` uses nested `if`/early-return control flow; this model uses a
 *    linear scan over a rule table.
 *  - The "cleared override" fall-through (rules 3 and 5) is modelled here by
 *    re-scanning the table with the override removed, rather than by mutating
 *    a local `effective` variable mid-branch.
 *
 * `classify` is NOT imported. Only `isFinished` (the finished-signal input to
 * rules 6/8) and `LIFECYCLE_CONFIG` (the threshold inputs) are reused, because
 * those are the *inputs* to the rules, not the rule-ordering logic under test.
 *
 * Requirements: 3.2
 */

import { isFinished } from "@/lib/finished";
import {
  LIFECYCLE_CONFIG,
  type LifecycleState,
  type Override,
  type RepoFacts,
} from "@/lib/lifecycle";

/** The result Property 6 compares against: the resolved lifecycle state. */
export interface ReferenceClassification {
  state: LifecycleState;
}

// ---------------------------------------------------------------------------
// Local, independent date helpers.
//
// These mirror the arithmetic in the spec ("floored" days, "pushed strictly
// after", unparseable dates treated as missing) but are written here as
// free-standing helpers so the reference model does not depend on any
// production parsing helper.
// ---------------------------------------------------------------------------

/** Parses an ISO 8601 string to epoch ms, or `null` if absent/unparseable. */
function toMs(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * `days_quiet` computed with its own floored formula:
 * `max(0, floor((now - base) / msPerDay))` where `base` is a parseable
 * `pushedAt` else `createdAt`, and an unusable base yields 0.
 */
function referenceDaysQuiet(repo: RepoFacts, now: string): number {
  const nowMs = toMs(now);
  if (nowMs === null) {
    return 0;
  }
  const base = toMs(repo.pushedAt) ?? toMs(repo.createdAt);
  if (base === null) {
    return 0;
  }
  const quiet = Math.floor((nowMs - base) / LIFECYCLE_CONFIG.msPerDay);
  return Math.max(0, quiet);
}

/** True iff `pushedAt` is present, parseable, and strictly after `setAt`. */
function pushedStrictlyAfter(pushedAt: string | null, setAt: string): boolean {
  const pushed = toMs(pushedAt);
  const set = toMs(setAt);
  if (pushed === null || set === null) {
    return false;
  }
  return pushed > set;
}

/**
 * Floored days elapsed from `setAt` to `now`, or `null` when either timestamp
 * is unparseable. A future `setAt` yields a negative count. A `null` result is
 * treated by the revival rules as a lapsed (>= window) revival.
 */
function elapsedDays(setAt: string, now: string): number | null {
  const from = toMs(setAt);
  const to = toMs(now);
  if (from === null || to === null) {
    return null;
  }
  return Math.floor((to - from) / LIFECYCLE_CONFIG.msPerDay);
}

// ---------------------------------------------------------------------------
// The rule table.
//
// A rule maps the evaluation context to one of three outcomes:
//   - a concrete LifecycleState  -> this rule fires, scan stops
//   - "clear"                    -> the revived override is cleared; re-scan
//                                   the table with the override removed
//   - null                       -> this rule does not match; try the next
// ---------------------------------------------------------------------------

/** The per-evaluation context passed to each rule predicate. */
interface RuleContext {
  repo: RepoFacts;
  override: Override | undefined;
  now: string;
  daysQuiet: number;
}

/** Sentinel outcome meaning "clear the revived override and re-scan". */
const CLEAR = Symbol("clear-override");
type RuleOutcome = LifecycleState | typeof CLEAR | null;
type Rule = (ctx: RuleContext) => RuleOutcome;

/**
 * The ten ordered rules as a flat `[predicate, state]`-style table. Each entry
 * is a predicate returning the state it resolves to (or `null`/`CLEAR`). The
 * first entry whose predicate does not return `null` wins the scan.
 *
 * Rules 1-5 only fire when an override is present; rules 6-10 are the
 * no-override (or post-clear) rules. Because a cleared override re-scans with
 * `override === undefined`, rules 1-5 are naturally skipped on the second pass.
 */
const RULES: Rule[] = [
  // Rule 1: finished override -> tombstone.
  ({ override }) => (override?.type === "finished" ? "tombstone" : null),

  // Rule 2: scrapped override -> coffin.
  ({ override }) => (override?.type === "scrapped" ? "coffin" : null),

  // Rule 3: revived override WITH a push after setAt -> clear, continue.
  ({ override, repo }) =>
    override?.type === "revived" && pushedStrictlyAfter(repo.pushedAt, override.setAt)
      ? CLEAR
      : null,

  // Rule 4: revived within the window and not pushed after -> risen.
  ({ override, now }) => {
    if (override?.type !== "revived") {
      return null;
    }
    const elapsed = elapsedDays(override.setAt, now);
    return elapsed !== null && elapsed < LIFECYCLE_CONFIG.reviveWindowDays ? "risen" : null;
  },

  // Rule 5: revived lapsed (>= window elapsed, or unparseable setAt) -> clear.
  // This only reaches here when rules 3 and 4 did not fire, i.e. not pushed
  // after and not within the window.
  ({ override }) => (override?.type === "revived" ? CLEAR : null),

  // Rule 6: archived -> tombstone if finished, else coffin.
  ({ repo }) => (repo.isArchived ? (isFinished(repo) ? "tombstone" : "coffin") : null),

  // Rule 7: daysQuiet below the ghost ceiling -> ghost.
  ({ daysQuiet }) => (daysQuiet < LIFECYCLE_CONFIG.ghostMaxDaysQuiet ? "ghost" : null),

  // Rule 8: finished signals -> tombstone.
  ({ repo }) => (isFinished(repo) ? "tombstone" : null),

  // Rule 9 (final / otherwise): zombie.
  () => "zombie",
];

/**
 * Scans the rule table in order. Returns the first resolved state. If a rule
 * returns `CLEAR`, the override is dropped and the table is re-scanned once
 * from the top with `override === undefined` (modelling rules 3 and 5's
 * "continue as no-override" fall-through). A re-scan never produces another
 * `CLEAR` because the override is gone, so the recursion depth is at most one.
 */
function scan(ctx: RuleContext): LifecycleState {
  for (const rule of RULES) {
    const outcome = rule(ctx);
    if (outcome === null) {
      continue;
    }
    if (outcome === CLEAR) {
      return scan({ ...ctx, override: undefined });
    }
    return outcome;
  }
  // Unreachable: the final rule always returns a state. Kept for totality so
  // the function has a non-`undefined` return on every path.
  return "zombie";
}

/**
 * Reference classifier for Property 6. Resolves the lifecycle `state` of a
 * repository by scanning the ordered rule table, independently of the
 * production `classify` branching.
 *
 * `now` is an explicit ISO 8601 parameter; the system clock is never read.
 */
export function referenceClassify(
  repo: RepoFacts,
  override: Override | undefined,
  now: string,
): ReferenceClassification {
  const daysQuiet = referenceDaysQuiet(repo, now);
  const state = scan({ repo, override, now, daysQuiet });
  return { state };
}
