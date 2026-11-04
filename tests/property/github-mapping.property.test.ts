/**
 * Feature: repo-lifecycle-classification, Property 3: Node mapping prefers README.md
 *
 * `mapRepoNode(node)` picks the `README.md` byte size (`readmeUpper`) when
 * present, else the `readme.md` byte size (`readmeLower`), else `null`; and it
 * preserves every other fetched field: name, description, url, pushedAt,
 * createdAt, isArchived, isFork, homepageUrl, stargazerCount, primaryLanguage
 * flattened to its name, openIssueCount from issues.totalCount, releaseCount
 * from releases.totalCount, and lastCommitMessage from
 * defaultBranchRef.target.message (empty/absent -> null).
 *
 * The `RawRepoNode` generator is defined LOCALLY in this file (the shared
 * `tests/property/arbitraries.ts` only exposes the mapped `RepoFacts` shape).
 * It independently varies `readmeUpper` and `readmeLower` across all four
 * presence combinations so the `README.md`-wins precedence is exercised from
 * every angle, and it varies `primaryLanguage` and `defaultBranchRef` across
 * their null / empty / populated cases.
 *
 * Validates: Requirements 1.3
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mapRepoNode, type RawRepoNode } from "@/lib/github";

/** A nullable `{ byteSize }` blob: absent, or present with any byte size. */
const arbReadmeBlob: fc.Arbitrary<{ byteSize: number } | null> = fc.oneof(
  fc.constant(null),
  fc.record({
    byteSize: fc.oneof(
      // Clustered small values plus a broad range so the pick is exercised on
      // zero and large sizes alike.
      fc.constantFrom(0, 1, 1024, 65_536),
      fc.integer({ min: 0, max: 10_000_000 }),
    ),
  }),
);

/** The flattenable primary language: absent, or a `{ name }` wrapper. */
const arbPrimaryLanguage: fc.Arbitrary<{ name: string } | null> = fc.oneof(
  fc.constant(null),
  fc.record({ name: fc.string({ minLength: 1, maxLength: 20 }) }),
);

/**
 * The default branch ref, exercising every shape the mapper must flatten:
 *  - `null` (empty repo, no default branch),
 *  - `{ target: null }` (branch exists but no commit target),
 *  - `{ target: {} }` (target with no `message` field -> undefined),
 *  - `{ target: { message: "" } }` (empty message -> null),
 *  - `{ target: { message: <non-empty> } }` (preserved verbatim).
 */
const arbDefaultBranchRef: fc.Arbitrary<
  { target: { message?: string } | null } | null
> = fc.oneof(
  fc.constant(null),
  fc.constant({ target: null }),
  fc.constant({ target: {} }),
  fc.record({
    target: fc.record({
      message: fc.oneof(
        fc.constant(""),
        fc.string(),
        fc.constantFrom("v1.0 release", "wip", "initial commit\nbody line"),
      ),
    }),
  }),
);

/** A full `RawRepoNode` generator with each field varied independently. */
const arbRawRepoNode: fc.Arbitrary<RawRepoNode> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 40 }),
  description: fc.oneof(fc.constant(null), fc.string()),
  url: fc.webUrl(),
  pushedAt: fc.oneof(fc.constant(null), fc.date({ noInvalidDate: true }).map((d) => d.toISOString())),
  createdAt: fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
  isArchived: fc.boolean(),
  isFork: fc.boolean(),
  homepageUrl: fc.oneof(fc.constant(null), fc.string()),
  stargazerCount: fc.integer({ min: 0, max: 1_000_000 }),
  primaryLanguage: arbPrimaryLanguage,
  issues: fc.record({ totalCount: fc.integer({ min: 0, max: 5000 }) }),
  releases: fc.record({ totalCount: fc.integer({ min: 0, max: 5000 }) }),
  readmeUpper: arbReadmeBlob,
  readmeLower: arbReadmeBlob,
  defaultBranchRef: arbDefaultBranchRef,
});

describe("Property 3: Node mapping prefers README.md", () => {
  it("picks the README.md size then readme.md then null, and preserves every other field", () => {
    fc.assert(
      fc.property(arbRawRepoNode, (node) => {
        const facts = mapRepoNode(node);

        // README precedence: README.md (upper) wins, else readme.md (lower),
        // else null.
        const expectedReadmeBytes =
          node.readmeUpper !== null
            ? node.readmeUpper.byteSize
            : node.readmeLower !== null
              ? node.readmeLower.byteSize
              : null;
        expect(facts.readmeBytes).toBe(expectedReadmeBytes);

        // primaryLanguage flattened to its name, or null when absent.
        expect(facts.primaryLanguage).toBe(node.primaryLanguage?.name ?? null);

        // Connection counts lifted to scalars.
        expect(facts.openIssueCount).toBe(node.issues.totalCount);
        expect(facts.releaseCount).toBe(node.releases.totalCount);

        // lastCommitMessage: the subject verbatim unless empty/absent -> null.
        const rawMessage = node.defaultBranchRef?.target?.message;
        const expectedMessage =
          rawMessage !== undefined && rawMessage !== "" ? rawMessage : null;
        expect(facts.lastCommitMessage).toBe(expectedMessage);

        // Every remaining field carried across unchanged.
        expect(facts.name).toBe(node.name);
        expect(facts.description).toBe(node.description);
        expect(facts.url).toBe(node.url);
        expect(facts.pushedAt).toBe(node.pushedAt);
        expect(facts.createdAt).toBe(node.createdAt);
        expect(facts.isArchived).toBe(node.isArchived);
        expect(facts.isFork).toBe(node.isFork);
        expect(facts.homepageUrl).toBe(node.homepageUrl);
        expect(facts.stargazerCount).toBe(node.stargazerCount);
      }),
      { numRuns: 100 },
    );
  });
});
