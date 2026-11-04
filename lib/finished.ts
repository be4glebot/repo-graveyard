/**
 * Pure finished-signal detection.
 *
 * Given the raw facts for a single repository, count the "finished" and
 * "unfinished" signals and decide whether the repo looks finished. This module
 * performs no I/O and holds no magic numbers: every threshold and keyword list
 * is read from `LIFECYCLE_CONFIG` in `lib/lifecycle.ts`.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { LIFECYCLE_CONFIG, type RepoFacts } from "./lifecycle";

/** The tallied finished and unfinished signal counts for a repository. */
export interface FinishedSignals {
  finished: number;
  unfinished: number;
}

/**
 * Returns the subject line (first line) of a commit message, lowercased for
 * case-insensitive keyword matching. A `null` message yields an empty string.
 */
function commitSubject(message: string | null): string {
  if (message === null) {
    return "";
  }
  // Only the first line is the subject; split on the first newline (handling
  // both "\n" and "\r\n").
  const firstLine = message.split("\n", 1)[0];
  return firstLine.replace(/\r$/, "").toLowerCase();
}

/**
 * Counts the finished and unfinished signals for a repository. Each signal
 * contributes at most one to its tally. The commit subject contributes at most
 * one finished signal and at most one unfinished signal even if several
 * keywords match.
 */
export function countSignals(repo: RepoFacts): FinishedSignals {
  const subject = commitSubject(repo.lastCommitMessage);

  let finished = 0;
  // (a) at least one release
  if (repo.releaseCount >= 1) {
    finished += 1;
  }
  // (b) non-empty homepage URL after trimming
  if (repo.homepageUrl !== null && repo.homepageUrl.trim().length > 0) {
    finished += 1;
  }
  // (c) README larger than the minimum size threshold
  if (repo.readmeBytes !== null && repo.readmeBytes > LIFECYCLE_CONFIG.readmeMinBytes) {
    finished += 1;
  }
  // (d) commit subject contains any finished keyword (at most one signal)
  if (
    LIFECYCLE_CONFIG.finishedCommitKeywords.some((keyword) =>
      subject.includes(keyword.toLowerCase()),
    )
  ) {
    finished += 1;
  }
  // (e) the repo is popular (a widely-starred project reads as shipped even
  // without a GitHub Release)
  if (repo.stargazerCount >= LIFECYCLE_CONFIG.popularStars) {
    finished += 1;
  }

  let unfinished = 0;
  // (a) commit subject contains any unfinished keyword (at most one signal)
  if (
    LIFECYCLE_CONFIG.unfinishedCommitKeywords.some((keyword) =>
      subject.includes(keyword.toLowerCase()),
    )
  ) {
    unfinished += 1;
  }
  // (b) README explicitly empty (zero bytes). A `null` readmeBytes means no
  // README.md/readme.md blob was found, but the repo may still have a README in
  // another format (README.rdoc, README.markdown, README.mkd, ...) that the two
  // bulk-query lookups cannot see, so a not-found README is neutral, not
  // unfinished. Adding more lookups is out: it timed out the GraphQL query.
  if (repo.readmeBytes === 0) {
    unfinished += 1;
  }
  // (c) open issue count at or above the "many issues" threshold, but only for
  // non-popular repos: a popular project's open-issue backlog reflects use, not
  // abandonment, so it does not count against a repo at/above popularStars
  if (
    repo.openIssueCount >= LIFECYCLE_CONFIG.manyIssues &&
    repo.stargazerCount < LIFECYCLE_CONFIG.popularStars
  ) {
    unfinished += 1;
  }

  return { finished, unfinished };
}

/**
 * Returns true iff the repository looks finished: the finished signal count
 * minus the unfinished signal count is at least `finishedMargin`.
 */
export function isFinished(repo: RepoFacts): boolean {
  const { finished, unfinished } = countSignals(repo);
  return finished - unfinished >= LIFECYCLE_CONFIG.finishedMargin;
}
