/**
 * Feature: repo-lifecycle-classification, Property 14: Finished detection is exactly the signal difference
 *
 * For any combination of release count, homepage URL, README size, last commit
 * message, and open issue count, `isFinished` returns true if and only if
 * `(finished signal count - unfinished signal count) >= finishedMargin` (2),
 * where the counts come from an INDEPENDENT reference implementation of the
 * signals written below.
 *
 * The reference implementation deliberately does NOT import or reuse
 * `countSignals` from `lib/finished.ts`. It mirrors the specification directly
 * so a defect in the production tally cannot hide behind a shared code path:
 *  - finished signals: releaseCount >= 1; non-empty trimmed homepageUrl;
 *    readmeBytes > readmeMinBytes; commit subject (FIRST LINE ONLY,
 *    case-insensitive) contains any finished keyword (at most one commit signal)
 *  - unfinished signals: commit subject (first line, case-insensitive) contains
 *    any unfinished keyword (at most one); readmeBytes null or 0;
 *    openIssueCount >= manyIssues
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 7.9
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { isFinished } from "@/lib/finished";
import { LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";
import { arbRepoFacts } from "./arbitraries";

/**
 * Independent extraction of the commit subject: the first line of the message,
 * lowercased for case-insensitive comparison. A `null` message yields the empty
 * string. This mirrors the spec's "first line only" rule without reusing the
 * production helper.
 */
function referenceSubject(message: string | null): string {
  if (message === null) {
    return "";
  }
  // The subject is everything up to the first line break. Handle both LF and
  // CRLF: take up to the first "\n", then strip a trailing "\r".
  const newlineIndex = message.indexOf("\n");
  const firstLine = newlineIndex === -1 ? message : message.slice(0, newlineIndex);
  const withoutCr = firstLine.endsWith("\r") ? firstLine.slice(0, -1) : firstLine;
  return withoutCr.toLowerCase();
}

/**
 * Independent reference tally of the finished and unfinished signals, derived
 * straight from the acceptance criteria.
 */
function referenceCounts(repo: RepoFacts): { finished: number; unfinished: number } {
  const subject = referenceSubject(repo.lastCommitMessage);

  let finished = 0;
  if (repo.releaseCount >= 1) {
    finished += 1;
  }
  if (repo.homepageUrl !== null && repo.homepageUrl.trim() !== "") {
    finished += 1;
  }
  if (repo.readmeBytes !== null && repo.readmeBytes > LIFECYCLE_CONFIG.readmeMinBytes) {
    finished += 1;
  }
  // At most one finished signal from the commit subject.
  const hasFinishedKeyword = LIFECYCLE_CONFIG.finishedCommitKeywords.some((kw) =>
    subject.includes(kw.toLowerCase()),
  );
  if (hasFinishedKeyword) {
    finished += 1;
  }
  // A popular repo (stars at/above the threshold) is a finished signal.
  if (repo.stargazerCount >= LIFECYCLE_CONFIG.popularStars) {
    finished += 1;
  }

  let unfinished = 0;
  // At most one unfinished signal from the commit subject.
  const hasUnfinishedKeyword = LIFECYCLE_CONFIG.unfinishedCommitKeywords.some((kw) =>
    subject.includes(kw.toLowerCase()),
  );
  if (hasUnfinishedKeyword) {
    unfinished += 1;
  }
  // Only an explicitly empty README (0 bytes) is unfinished; a not-found
  // README (null) is neutral, since a non-.md README may exist but be invisible
  // to the two bulk-query lookups.
  if (repo.readmeBytes === 0) {
    unfinished += 1;
  }
  // Many-issues counts as unfinished only for non-popular repos.
  if (
    repo.openIssueCount >= LIFECYCLE_CONFIG.manyIssues &&
    repo.stargazerCount < LIFECYCLE_CONFIG.popularStars
  ) {
    unfinished += 1;
  }

  return { finished, unfinished };
}

describe("Property 14: Finished detection is exactly the signal difference", () => {
  it("isFinished is true iff (finished - unfinished) >= finishedMargin per the reference signals", () => {
    fc.assert(
      fc.property(arbRepoFacts, (repo) => {
        const { finished, unfinished } = referenceCounts(repo);
        const expected = finished - unfinished >= LIFECYCLE_CONFIG.finishedMargin;
        return isFinished(repo) === expected;
      }),
      { numRuns: 100 },
    );
  });
});
