/**
 * Feature: repo-details-hover-panel, Property 6: Only validated repos become creatures
 *
 * Composing the pipeline as SceneView does (buildRepoRows first, classification
 * via buildRows on only the validated repos), the set of creature names equals
 * the set of RepoRow names: no creature without a row, no row without a creature.
 *
 * **Validates: Requirements 1.8**
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import fc from "fast-check";
import { buildRepoRows } from "@/lib/repoRow";
import { buildRows } from "@/lib/graveyard-view";
import type { RepoFacts } from "@/lib/lifecycle";

const NOW = "2025-06-01T00:00:00.000Z";

const isoDate = fc
  .integer({ min: Date.UTC(2010, 0, 1), max: Date.UTC(2025, 0, 1) })
  .map((ms) => new Date(ms).toISOString());

const validFacts: fc.Arbitrary<RepoFacts> = fc.record({
  name: fc.constant("placeholder"),
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

const candidate = fc.oneof(validFacts, validFacts.chain(violate));

/** Mixed list with unique names so name sets are comparable. */
const repoList = fc
  .array(candidate, { maxLength: 25 })
  .map((list) => list.map((f, i) => ({ ...f, name: `repo-${i}` })));

describe("Feature: repo-details-hover-panel, Property 6: Only validated repos become creatures", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creature names equal RepoRow names (no orphans either way)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fc.assert(
      fc.property(repoList, (repos) => {
        const repoRows = buildRepoRows(repos);
        const rowNames = new Set(repoRows.map((r) => r.name));
        // Same wiring as SceneView: only validated repos reach classification.
        const validated = repos.filter((r) => rowNames.has(r.name));
        const creatureNames = new Set(buildRows(validated, {}, NOW).map((r) => r.name));

        expect(creatureNames).toEqual(rowNames);
        expect(creatureNames.size).toBe(rowNames.size);
      }),
      { numRuns: 100 },
    );
  });
});
