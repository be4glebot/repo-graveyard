/**
 * Explanation_Line (Requirements 6.3, 11.5, 11.8).
 *
 * One plain-English sentence stating the real reason a repo is its creature.
 * Derived only from the classification result plus the same facts/predicates
 * `lib/lifecycle.ts` uses (`daysQuiet`, `countSignals`, `isArchived`, `isFork`,
 * `revivedAt` + `reviveWindowDays`). It never re-classifies, changes no
 * threshold, reads no clock, and is pure and total.
 */

import { LIFECYCLE_CONFIG, daysQuiet, type LifecycleState, type RepoFacts } from "../lifecycle";
import { countSignals } from "../finished";
import { quietPhrase } from "./quietPhrase";

export type ExplanationFacts = Pick<
  RepoFacts,
  | "pushedAt"
  | "createdAt"
  | "isArchived"
  | "isFork"
  | "releaseCount"
  | "homepageUrl"
  | "readmeBytes"
  | "stargazerCount"
  | "lastCommitMessage"
>;

/** A repo with every finished signal switched off; used to probe one at a time. */
const NEUTRAL: RepoFacts = {
  name: "",
  description: null,
  url: "",
  pushedAt: null,
  createdAt: "",
  isArchived: false,
  isFork: false,
  homepageUrl: null,
  stargazerCount: 0,
  primaryLanguage: null,
  openIssueCount: 0,
  releaseCount: 0,
  readmeBytes: null,
  lastCommitMessage: null,
  languageColor: null,
  forkCount: 0,
  topics: [],
};

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/**
 * Names the finished signals `countSignals` finds, by asking it about each
 * fact in isolation so the predicates stay single-sourced.
 */
function finishedSignalNames(facts: ExplanationFacts): string[] {
  const fires = (patch: Partial<RepoFacts>): boolean =>
    countSignals({ ...NEUTRAL, ...patch }).finished > 0;

  const names: string[] = [];
  if (fires({ releaseCount: facts.releaseCount })) {
    names.push(plural(facts.releaseCount, "release"));
  }
  if (fires({ readmeBytes: facts.readmeBytes })) {
    names.push("a full README");
  }
  if (fires({ homepageUrl: facts.homepageUrl })) {
    names.push("a homepage");
  }
  if (fires({ lastCommitMessage: facts.lastCommitMessage })) {
    names.push("a final-sounding last commit");
  }
  if (fires({ stargazerCount: facts.stargazerCount })) {
    names.push(`${facts.stargazerCount} stars`);
  }
  return names;
}

function joinList(items: string[]): string {
  if (items.length <= 1) {
    return items.join("");
  }
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "YYYY-MM-DD" for a parseable ISO string, else null. */
function isoDate(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

/** Whole days left in the revive window, clamped to 0..reviveWindowDays; null if unparseable. */
function reviveDaysLeft(revivedAt: string, renderedAt: string): number | null {
  const from = Date.parse(revivedAt);
  const to = Date.parse(renderedAt);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }
  const elapsed = Math.floor((to - from) / LIFECYCLE_CONFIG.msPerDay);
  const left = LIFECYCLE_CONFIG.reviveWindowDays - elapsed;
  return Math.min(LIFECYCLE_CONFIG.reviveWindowDays, Math.max(0, left));
}

export function explanationLine(
  input: {
    state: LifecycleState;
    decayLevel: number | null;
    facts: ExplanationFacts;
    /** ISO date a revived override was set; present only for risen. */
    revivedAt?: string | null;
  },
  renderedAt: string,
): string {
  const { state, facts, revivedAt } = input;
  const quiet = quietPhrase(facts, renderedAt);
  const forkNote = facts.isFork ? " It's a fork." : "";

  switch (state) {
    case "ghost": {
      const days = daysQuiet(facts, renderedAt);
      const when = days === 0 ? "today" : `${plural(days, "day")} ago`;
      return `Last push ${when}.${forkNote}`;
    }
    case "zombie":
      return `${quiet[0].toUpperCase()}${quiet.slice(1)} and no signs it was finished.${forkNote}`;
    case "risen": {
      const date = isoDate(revivedAt);
      const left = revivedAt ? reviveDaysLeft(revivedAt, renderedAt) : null;
      if (date !== null && left !== null) {
        return `Brought back from the dead on ${date}; ${plural(left, "day")} to prove it's alive.`;
      }
      return "Brought back from the dead and still proving it's alive.";
    }
    case "tombstone": {
      const signals = finishedSignalNames(facts);
      const head = `${quiet[0].toUpperCase()}${quiet.slice(1)}`;
      const archived = facts.isArchived ? " and archived" : "";
      if (signals.length > 0) {
        return `${head}${archived}, but it has ${joinList(signals)}, so it's finished, not abandoned.${forkNote}`;
      }
      // Finished by a user override: no signal to cite.
      return `${head}${archived}, and marked finished.${forkNote}`;
    }
    case "coffin":
    default:
      return facts.isArchived
        ? `Archived on GitHub.${forkNote}`
        : `Laid to rest by hand.${forkNote}`;
  }
}
