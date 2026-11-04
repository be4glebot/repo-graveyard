/**
 * Unit tests for the GitHub GraphQL wrapper: query text shape and the
 * `fetchRepos` fetch/error-mapping algorithm.
 *
 * These are example/unit tests (NOT fast-check). They assert the single
 * `GRAVEYARD_QUERY` contains every required field and filter, and drive
 * `fetchRepos` with hand-built fake `GraphqlTransport`s to exercise each
 * error-mapping branch and the single-retry-on-5xx behavior.
 *
 * Validates: Requirements 1.3, 1.5, 1.6, 1.7
 */

import { describe, it, expect } from "vitest";
import {
  GRAVEYARD_QUERY,
  fetchRepos,
  TransportError,
  type GraphqlTransport,
  type GraveyardQueryResponse,
  type RawRepoNode,
} from "@/lib/github";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** A minimal valid raw repository node for building transport responses. */
function makeNode(name: string): RawRepoNode {
  return {
    name,
    description: null,
    url: `https://github.com/owner/${name}`,
    pushedAt: "2020-01-01T00:00:00Z",
    createdAt: "2019-01-01T00:00:00Z",
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 0,
    primaryLanguage: null,
    issues: { totalCount: 0 },
    releases: { totalCount: 0 },
    readmeUpper: null,
    readmeLower: null,
    defaultBranchRef: null,
  };
}

/** Builds a single-page success response with the given nodes. */
function successResponse(
  nodes: RawRepoNode[],
  totalCount = nodes.length,
): GraveyardQueryResponse {
  return {
    repositoryOwner: {
      repositories: {
        totalCount,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes,
      },
    },
  };
}

/** A transport that always resolves with a fixed response and no headers. */
function constantTransport(
  response: GraveyardQueryResponse,
): GraphqlTransport {
  return (async () => ({ data: response })) as GraphqlTransport;
}

// ---------------------------------------------------------------------------
// 1. Query text (Requirement 1.3)
// ---------------------------------------------------------------------------

describe("GRAVEYARD_QUERY shape (Req 1.3)", () => {
  // Collapse all runs of whitespace to a single space so the assertions are
  // tolerant of indentation and line-break differences.
  const flat = GRAVEYARD_QUERY.replace(/\s+/g, " ");

  it("selects both README aliases pointing at README.md and readme.md", () => {
    expect(flat).toMatch(/readmeUpper:\s*object\(expression:\s*"HEAD:README\.md"\)/);
    expect(flat).toMatch(/readmeLower:\s*object\(expression:\s*"HEAD:readme\.md"\)/);
  });

  it("orders repositories by PUSHED_AT descending", () => {
    expect(flat).toMatch(
      /orderBy:\s*\{\s*field:\s*PUSHED_AT,?\s*direction:\s*DESC\s*\}/,
    );
  });

  it("filters to non-fork, public, owner-affiliated repositories", () => {
    expect(flat).toMatch(/isFork:\s*false/);
    expect(flat).toMatch(/privacy:\s*PUBLIC/);
    expect(flat).toMatch(/ownerAffiliations:\s*OWNER/);
  });

  it("selects the connection-level pagination fields", () => {
    expect(flat).toMatch(/totalCount/);
    expect(flat).toMatch(/hasNextPage/);
    expect(flat).toMatch(/endCursor/);
  });

  it("selects every required per-node field", () => {
    for (const field of [
      "name",
      "pushedAt",
      "createdAt",
      "isArchived",
      "homepageUrl",
      "stargazerCount",
    ]) {
      expect(flat).toMatch(new RegExp(`\\b${field}\\b`));
    }
    // Nested selections for language, issues, releases, and the last commit.
    expect(flat).toMatch(/primaryLanguage\s*\{\s*name\s*\}/);
    expect(flat).toMatch(/issues\([^)]*\)\s*\{\s*totalCount\s*\}/);
    expect(flat).toMatch(/releases\s*\{\s*totalCount\s*\}/);
    expect(flat).toMatch(/defaultBranchRef\s*\{\s*target/);
    expect(flat).toMatch(/\.\.\. on Commit \{ message \}/);
  });
});

// ---------------------------------------------------------------------------
// 2a. not-found mapping (Requirement 1.5)
// ---------------------------------------------------------------------------

describe("fetchRepos not-found mapping (Req 1.5)", () => {
  it("maps a null repositoryOwner to not-found", async () => {
    const transport = constantTransport({ repositoryOwner: null });

    const result = await fetchRepos("ghost-user", transport);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not-found");
    }
  });

  it("maps a TransportError carrying a NOT_FOUND code to not-found", async () => {
    const transport: GraphqlTransport = async () => {
      throw new TransportError("Could not resolve to a User", {
        codes: ["NOT_FOUND"],
      });
    };

    const result = await fetchRepos("ghost-user", transport);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not-found");
    }
  });
});

// ---------------------------------------------------------------------------
// 2b. rate-limited mapping (Requirement 1.6)
// ---------------------------------------------------------------------------

describe("fetchRepos rate-limited mapping (Req 1.6)", () => {
  it("maps a 403 status to rate-limited", async () => {
    const transport: GraphqlTransport = async () => {
      throw new TransportError("Forbidden", { status: 403 });
    };

    const result = await fetchRepos("owner", transport);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("rate-limited");
    }
  });

  it("maps a 429 status to rate-limited", async () => {
    const transport: GraphqlTransport = async () => {
      throw new TransportError("Too Many Requests", { status: 429 });
    };

    const result = await fetchRepos("owner", transport);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("rate-limited");
    }
  });

  it("maps a RATE_LIMITED code to rate-limited", async () => {
    const transport: GraphqlTransport = async () => {
      throw new TransportError("API rate limit exceeded", {
        codes: ["RATE_LIMITED"],
      });
    };

    const result = await fetchRepos("owner", transport);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("rate-limited");
    }
  });

  it("parses resetAt from the x-ratelimit-reset header (epoch seconds -> ISO)", async () => {
    // 2021-01-01T00:00:00Z == 1609459200 epoch seconds.
    const epochSeconds = 1609459200;
    const transport: GraphqlTransport = async () => {
      throw new TransportError("Forbidden", {
        status: 403,
        headers: { "x-ratelimit-reset": String(epochSeconds) },
      });
    };

    const result = await fetchRepos("owner", transport);

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "rate-limited") {
      expect(result.error.resetAt).toBe(
        new Date(epochSeconds * 1000).toISOString(),
      );
    } else {
      throw new Error("expected a rate-limited error");
    }
  });

  it("leaves resetAt null when the header is absent", async () => {
    const transport: GraphqlTransport = async () => {
      throw new TransportError("Forbidden", { status: 403 });
    };

    const result = await fetchRepos("owner", transport);

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "rate-limited") {
      expect(result.error.resetAt).toBeNull();
    } else {
      throw new Error("expected a rate-limited error");
    }
  });
});

// ---------------------------------------------------------------------------
// 2c. 5xx retry behavior (Requirement 1.7)
// ---------------------------------------------------------------------------

describe("fetchRepos 5xx retry behavior (Req 1.7)", () => {
  it("retries once on a 5xx and recovers with the data on the second try", async () => {
    let calls = 0;
    const transport: GraphqlTransport = (async () => {
      calls += 1;
      if (calls === 1) {
        throw new TransportError("Service Unavailable", { status: 503 });
      }
      return { data: successResponse([makeNode("recovered")]) };
    }) as GraphqlTransport;

    const result = await fetchRepos("owner", transport);

    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.repos.map((r) => r.name)).toEqual(["recovered"]);
    }
  });

  it("returns server-error and discards partial data when a 5xx persists through the retry", async () => {
    let calls = 0;
    const transport: GraphqlTransport = (async () => {
      calls += 1;
      throw new TransportError("Service Unavailable", { status: 503 });
    }) as GraphqlTransport;

    const result = await fetchRepos("owner", transport);

    // The first page is attempted twice (initial + one retry).
    expect(calls).toBe(2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("server-error");
      // No `repos` field leaks out of an error result.
      expect(result).not.toHaveProperty("value");
    }
  });
});
