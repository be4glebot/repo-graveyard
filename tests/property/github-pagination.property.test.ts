/**
 * Feature: repo-lifecycle-classification, Property 2: Pagination respects the cap and query budget
 *
 * Drives `fetchRepos` with a FAKE paginated transport that honors `first` /
 * `after` and reports a `totalCount` of N synthetic repos. For any N the fetch
 * must:
 *  - return exactly `min(N, maxRepos)` repos, in the transport's order;
 *  - issue exactly `max(1, ceil(min(N, maxRepos) / pageSize))` transport calls
 *    (the query budget);
 *  - report `truncated` true iff `N > maxRepos`.
 *
 * `maxRepos` (300) and `pageSize` (100) are read from `LIFECYCLE_CONFIG` rather
 * than hardcoded so the property tracks the single source of truth.
 *
 * Validates: Requirements 1.1, 1.2, 8.9
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  fetchRepos,
  type GraphqlTransport,
  type GraveyardQueryResponse,
  type RawRepoNode,
} from "@/lib/github";
import { LIFECYCLE_CONFIG } from "@/lib/lifecycle";

const { maxRepos, pageSize } = LIFECYCLE_CONFIG;

/** Builds a minimal, valid raw GraphQL node whose name encodes its index. */
function makeNode(index: number): RawRepoNode {
  return {
    name: `repo-${index}`,
    description: null,
    url: `https://github.com/owner/repo-${index}`,
    pushedAt: "2023-01-01T00:00:00.000Z",
    createdAt: "2020-01-01T00:00:00.000Z",
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 0,
    primaryLanguage: null,
    forkCount: 0,
    repositoryTopics: { nodes: [] },
    issues: { totalCount: 0 },
    releases: { totalCount: 0 },
    readmeUpper: null,
    readmeLower: null,
    defaultBranchRef: null,
  };
}

/**
 * Builds a fake transport over an array of N synthetic nodes. It reads the
 * `first` and `after` cursor variables, slices the requested page, sets
 * `pageInfo.hasNextPage` / `endCursor` correctly, reports `totalCount = N`, and
 * records every invocation count. The cursor is the index of the next node to
 * serve, encoded as a string.
 */
function makeFakeTransport(total: number): {
  transport: GraphqlTransport;
  getCalls: () => number;
} {
  const nodes = Array.from({ length: total }, (_, i) => makeNode(i));
  let calls = 0;

  const transport: GraphqlTransport = async <T>(
    _query: string,
    vars: Record<string, unknown>,
  ) => {
    calls += 1;
    const first = vars.first as number;
    const after = (vars.after as string | null) ?? null;
    const start = after === null ? 0 : Number(after);
    const end = Math.min(start + first, nodes.length);
    const page = nodes.slice(start, end);
    const hasNextPage = end < nodes.length;

    const data: GraveyardQueryResponse = {
      repositoryOwner: {
        repositories: {
          totalCount: total,
          pageInfo: {
            hasNextPage,
            endCursor: hasNextPage ? String(end) : null,
          },
          nodes: page,
        },
      },
    };

    return { data: data as T };
  };

  return { transport, getCalls: () => calls };
}

describe("Property 2: Pagination respects the cap and query budget", () => {
  it("returns min(N, maxRepos) repos in order with the expected query budget and truncation", async () => {
    // Boundaries are derived from the config (never a hard-coded 100), so the
    // property tracks `pageSize`/`maxRepos` if they change. We probe just
    // around each page edge and the cap.
    const boundaryTotals = Array.from(
      new Set([
        0,
        1,
        pageSize - 1,
        pageSize,
        pageSize + 1,
        maxRepos - 1,
        maxRepos,
        maxRepos + 1,
        maxRepos * 2,
      ]),
    );
    const arbTotal = fc.oneof(
      fc.constantFrom(...boundaryTotals),
      // A broad span to cover the rest of the input space.
      fc.integer({ min: 0, max: maxRepos * 3 + 100 }),
    );

    await fc.assert(
      fc.asyncProperty(arbTotal, async (total) => {
        const { transport, getCalls } = makeFakeTransport(total);

        const result = await fetchRepos("owner", transport);

        expect(result.ok).toBe(true);
        if (!result.ok) {
          return;
        }

        const expectedCount = Math.min(total, maxRepos);
        const expectedCalls = Math.max(
          1,
          Math.ceil(Math.min(total, maxRepos) / pageSize),
        );

        // Correct number of repos.
        expect(result.value.repos.length).toBe(expectedCount);

        // Repos are in the transport's original order.
        const expectedNames = Array.from(
          { length: expectedCount },
          (_, i) => `repo-${i}`,
        );
        expect(result.value.repos.map((r) => r.name)).toEqual(expectedNames);

        // Query budget.
        expect(getCalls()).toBe(expectedCalls);

        // Truncation reported iff the owner has more repos than the cap.
        expect(result.value.truncated).toBe(total > maxRepos);
      }),
      { numRuns: 100 },
    );
  });
});
