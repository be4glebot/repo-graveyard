/**
 * Feature: repo-details-hover-panel, Property 7: Repo-row validation never throws for a page
 *
 * For any list of candidate repo records (valid records mixed with records that
 * violate a field constraint), `buildRepoRows` returns exactly the valid
 * records in their original order, skips every invalid record, and never throws.
 *
 * **Validates: Requirements 1.3, 1.8**
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import fc from "fast-check";
import { buildRepoRows } from "@/lib/repoRow";
import type { RepoFacts } from "@/lib/lifecycle";

const isoDate = fc
  .integer({ min: Date.UTC(2010, 0, 1), max: Date.UTC(2030, 0, 1) })
  .map((ms) => new Date(ms).toISOString());

const validFacts: fc.Arbitrary<RepoFacts> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  description: fc.option(fc.string({ maxLength: 40 }), { nil: null }),
  url: fc.constant("https://github.com/o/r"),
  pushedAt: fc.option(isoDate, { nil: null }),
  createdAt: isoDate,
  isArchived: fc.boolean(),
  isFork: fc.boolean(),
  homepageUrl: fc.option(fc.constant("https://example.com"), { nil: null }),
  stargazerCount: fc.nat({ max: 1_000_000 }),
  primaryLanguage: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  openIssueCount: fc.nat({ max: 10_000 }),
  releaseCount: fc.nat({ max: 100 }),
  readmeBytes: fc.option(fc.nat({ max: 100_000 }), { nil: null }),
  lastCommitMessage: fc.option(fc.string({ maxLength: 30 }), { nil: null }),
  languageColor: fc.option(fc.constant("#3178c6"), { nil: null }),
  forkCount: fc.integer({ min: 0, max: 2_147_483_647 }),
  topics: fc.array(fc.string({ maxLength: 15 }), { maxLength: 5 }),
});

/** Break exactly one constrained field so the record is certainly invalid. */
const violate = (f: RepoFacts): fc.Arbitrary<RepoFacts> =>
  fc.oneof(
    fc.integer({ min: -1_000_000, max: -1 }).map((n) => ({ ...f, forkCount: n })),
    fc.integer({ min: 2_147_483_648, max: 4_000_000_000 }).map((n) => ({ ...f, forkCount: n })),
    fc
      .array(fc.string({ maxLength: 10 }), { minLength: 6, maxLength: 12 })
      .map((t) => ({ ...f, topics: t })),
    fc.integer({ min: -1000, max: -1 }).map((n) => ({ ...f, stargazerCount: n })),
    fc.constant({ ...f, primaryLanguage: "" }),
  );

const candidate = fc.oneof(
  validFacts.map((facts) => ({ facts, valid: true })),
  validFacts
    .chain((f) => violate(f))
    .map((facts) => ({ facts, valid: false })),
);

describe("Feature: repo-details-hover-panel, Property 7: Repo-row validation never throws for a page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns exactly the valid records in original order and never throws", () => {
    fc.assert(
      fc.property(fc.array(candidate, { maxLength: 30 }), (candidates) => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
          const rows = buildRepoRows(candidates.map((c) => c.facts));
          const expected = candidates.filter((c) => c.valid).map((c) => c.facts);

          expect(rows).toHaveLength(expected.length);
          rows.forEach((row, i) => {
            const f = expected[i];
            expect(row.name).toBe(f.name);
            expect(row.forkCount).toBe(f.forkCount);
            expect(row.stargazerCount).toBe(f.stargazerCount);
            expect(row.topics).toEqual(f.topics);
            expect(row.primaryLanguage).toEqual(
              f.primaryLanguage === null
                ? null
                : { name: f.primaryLanguage, color: f.languageColor },
            );
          });
          expect(warn).toHaveBeenCalledTimes(candidates.length - expected.length);
        } finally {
          warn.mockRestore();
        }
      }),
      { numRuns: 100 },
    );
  });
});
