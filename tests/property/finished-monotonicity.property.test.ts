/**
 * Feature: repo-lifecycle-classification, Property 15: Adding an unfinished signal never makes a repo finished
 *
 * For any repository whose `isFinished` is already false, adding a single
 * unfinished signal that was NOT previously present must keep `isFinished`
 * false. The three unfinished signals, per the acceptance criteria, are:
 *  (a) the commit subject (FIRST LINE ONLY, case-insensitive) contains an
 *      unfinished keyword,
 *  (b) the README is absent or zero bytes (`readmeBytes` null or 0),
 *  (c) the open issue count is at or above the `manyIssues` threshold.
 *
 * Monotonicity only has meaning when the signal is genuinely being ADDED, so
 * each case below is restricted (via `fc.pre`) to repos where that signal is
 * not already present, and the chosen signal is injected in the least
 * disruptive way (flip README to 0 only if it was not already null/0; raise
 * issues to the threshold only if below it; inject a keyword into the FIRST
 * line only if none was present there).
 *
 * Validates: Requirements 7.10
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { isFinished } from "@/lib/finished";
import { LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";
import { arbRepoFacts } from "./arbitraries";

/** The three unfinished signals we can add to a repo. */
type UnfinishedSignal = "commit-keyword" | "missing-readme" | "many-issues";

/**
 * Independent extraction of the commit subject (first line only, lowercased),
 * used solely to decide whether an unfinished keyword is ALREADY present so we
 * never claim to "add" a signal that already exists. Mirrors the spec's "first
 * line only" rule without reusing the production helper.
 */
function subjectFirstLineLower(message: string | null): string {
  if (message === null) {
    return "";
  }
  const newlineIndex = message.indexOf("\n");
  const firstLine = newlineIndex === -1 ? message : message.slice(0, newlineIndex);
  const withoutCr = firstLine.endsWith("\r") ? firstLine.slice(0, -1) : firstLine;
  return withoutCr.toLowerCase();
}

/** True iff the commit subject already contains any unfinished keyword. */
function hasUnfinishedKeyword(message: string | null): boolean {
  const subject = subjectFirstLineLower(message);
  return LIFECYCLE_CONFIG.unfinishedCommitKeywords.some((kw) =>
    subject.includes(kw.toLowerCase()),
  );
}

/** True iff the README already counts as an unfinished signal (null or 0). */
function hasMissingReadme(readmeBytes: number | null): boolean {
  return readmeBytes === null || readmeBytes === 0;
}

/** True iff the open issue count already meets the "many issues" threshold. */
function hasManyIssues(openIssueCount: number): boolean {
  return openIssueCount >= LIFECYCLE_CONFIG.manyIssues;
}

describe("Property 15: Adding an unfinished signal never makes a repo finished", () => {
  it("adding a not-previously-present unfinished signal to a non-finished repo keeps it non-finished", () => {
    fc.assert(
      fc.property(
        arbRepoFacts,
        fc.constantFrom<UnfinishedSignal>(
          "commit-keyword",
          "missing-readme",
          "many-issues",
        ),
        (repo, signal) => {
          // Monotonicity only concerns repos that are not already finished.
          fc.pre(!isFinished(repo));

          // Build a modified repo by ADDING exactly one unfinished signal that
          // was NOT already present. Precondition out cases where the chosen
          // signal already holds, so we never merely rewrite an existing one.
          let modified: RepoFacts;
          if (signal === "commit-keyword") {
            fc.pre(!hasUnfinishedKeyword(repo.lastCommitMessage));
            // Inject an unfinished keyword into the FIRST line only. Prefixing
            // the whole message guarantees the keyword lands on the subject.
            const keyword = LIFECYCLE_CONFIG.unfinishedCommitKeywords[0];
            const original = repo.lastCommitMessage ?? "";
            modified = { ...repo, lastCommitMessage: `${keyword} ${original}` };
          } else if (signal === "missing-readme") {
            fc.pre(!hasMissingReadme(repo.readmeBytes));
            modified = { ...repo, readmeBytes: 0 };
          } else {
            fc.pre(!hasManyIssues(repo.openIssueCount));
            modified = { ...repo, openIssueCount: LIFECYCLE_CONFIG.manyIssues };
          }

          // Adding an unfinished signal can only lower (finished - unfinished),
          // so a repo that was not finished must remain not finished.
          return isFinished(modified) === false;
        },
      ),
      { numRuns: 100 },
    );
  });
});
