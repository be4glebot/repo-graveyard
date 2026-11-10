/**
 * Unit tests for the séance evidence fetch and the service-level 5 s race.
 * Requirements 3.4, 3.6, 3.8, 3.9, 3.10, 20.27, 20.29.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GraphqlTransport } from "../../lib/github";
import type { RepoFacts } from "../../lib/lifecycle";
import {
  GATHER_TIMEOUT_MS,
  SEANCE_EVIDENCE_QUERY,
  fetchEvidence,
} from "../../lib/seance-gather";
import { runSeance, type SeanceDeps } from "../../lib/seance-service";

type Repository = Record<string, unknown> | null;

function fakeTransport(repository: Repository) {
  const calls: { query: string; vars: Record<string, unknown> }[] = [];
  const transport = (async (query: string, vars: Record<string, unknown>) => {
    calls.push({ query, vars });
    return { data: { repository } };
  }) as unknown as GraphqlTransport;
  return { transport, calls };
}

const history = (messages: string[]) => ({
  target: { history: { nodes: messages.map((message) => ({ message })) } },
});

describe("SEANCE_EVIDENCE_QUERY", () => {
  it("requests all four README aliases and history(first: 5) in one document", () => {
    for (const path of ["README.md", "readme.md", "README", "README.rst"]) {
      expect(SEANCE_EVIDENCE_QUERY).toContain(`"HEAD:${path}"`);
    }
    expect(SEANCE_EVIDENCE_QUERY).toContain("history(first: 5)");
    expect(SEANCE_EVIDENCE_QUERY.match(/\bquery\b/g)).toHaveLength(1);
  });

  it("is read-only", () => {
    expect(SEANCE_EVIDENCE_QUERY.toLowerCase()).not.toContain("mutation");
  });

  it("is sent once per fetch", async () => {
    const { transport, calls } = fakeTransport({ defaultBranchRef: history([]) });
    await fetchEvidence(transport, "o", "r");
    expect(calls).toHaveLength(1);
    expect(calls[0].query).toBe(SEANCE_EVIDENCE_QUERY);
    expect(calls[0].vars).toEqual({ owner: "o", name: "r" });
  });
});

describe("fetchEvidence", () => {
  it("uses the first existing alias in order", async () => {
    const { transport } = fakeTransport({
      readmeMd: null,
      readmeLower: { text: "lower" },
      readmeBare: { text: "bare" },
      readmeRst: { text: "rst" },
      defaultBranchRef: history(["a"]),
    });
    expect((await fetchEvidence(transport, "o", "r"))?.readme).toBe("lower");
  });

  it("prefers README.md over every other alias", async () => {
    const { transport } = fakeTransport({
      readmeMd: { text: "upper" },
      readmeLower: { text: "lower" },
      readmeRst: { text: "rst" },
    });
    expect((await fetchEvidence(transport, "o", "r"))?.readme).toBe("upper");
  });

  it("falls through to README.rst when it is the only one", async () => {
    const { transport } = fakeTransport({ readmeRst: { text: "rst" } });
    expect((await fetchEvidence(transport, "o", "r"))?.readme).toBe("rst");
  });

  it("returns readme null with commits when there is no README", async () => {
    const { transport } = fakeTransport({
      readmeMd: null,
      readmeLower: null,
      readmeBare: null,
      readmeRst: null,
      defaultBranchRef: history(["one", "two"]),
    });
    expect(await fetchEvidence(transport, "o", "r")).toEqual({
      readme: null,
      commits: ["one", "two"],
    });
  });

  it("returns fewer than 5 commits as-is, newest first", async () => {
    const { transport } = fakeTransport({
      readmeMd: { text: "hi" },
      defaultBranchRef: history(["c1", "c2", "c3"]),
    });
    expect((await fetchEvidence(transport, "o", "r"))?.commits).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
  });

  it("caps commits at 5", async () => {
    const { transport } = fakeTransport({
      defaultBranchRef: history(["1", "2", "3", "4", "5", "6", "7"]),
    });
    expect((await fetchEvidence(transport, "o", "r"))?.commits).toHaveLength(5);
  });

  it("handles zero commits (empty repo, no default branch)", async () => {
    const { transport } = fakeTransport({ defaultBranchRef: null });
    expect(await fetchEvidence(transport, "o", "r")).toEqual({
      readme: null,
      commits: [],
    });
  });

  it("truncates a large README to at most 8192 UTF-8 bytes", async () => {
    const { transport } = fakeTransport({ readmeMd: { text: "é".repeat(10_000) } });
    const result = await fetchEvidence(transport, "o", "r");
    expect(Buffer.byteLength(result?.readme ?? "", "utf8")).toBeLessThanOrEqual(8192);
  });

  it("returns null when the repository is missing", async () => {
    const { transport } = fakeTransport(null);
    expect(await fetchEvidence(transport, "o", "r")).toBeNull();
  });

  it("returns null on GraphQL errors surfaced as a rejection", async () => {
    const transport = (async () => {
      throw new Error("GraphQL: Something went wrong");
    }) as unknown as GraphqlTransport;
    await expect(fetchEvidence(transport, "o", "r")).resolves.toBeNull();
  });

  it("returns null on a transport failure and does not retry", async () => {
    let calls = 0;
    const transport = (async () => {
      calls += 1;
      throw new TypeError("network down");
    }) as unknown as GraphqlTransport;
    await expect(fetchEvidence(transport, "o", "r")).resolves.toBeNull();
    expect(calls).toBe(1);
  });

  it("returns null when data is empty", async () => {
    const transport = (async () => ({ data: null })) as unknown as GraphqlTransport;
    await expect(fetchEvidence(transport, "o", "r")).resolves.toBeNull();
  });
});

describe("runSeance evidence timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const facts: RepoFacts = {
    name: "demo",
    description: null,
    url: "https://github.com/o/demo",
    pushedAt: "2024-01-01T00:00:00Z",
    createdAt: "2023-01-01T00:00:00Z",
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 0,
    primaryLanguage: null,
    languageColor: null,
    forkCount: 0,
    topics: [],
    openIssueCount: 0,
    releaseCount: 0,
    readmeBytes: null,
    lastCommitMessage: "wip",
  };

  it("abandons a never-resolving fetchEvidence after 5 s, without retry, and proceeds facts-only", async () => {
    vi.useFakeTimers();
    const fetchEvidenceFn = vi.fn(() => new Promise<never>(() => {}));
    const complete = vi.fn(async () => "not json");
    const deps: SeanceDeps = {
      loadGraveyard: async () => ({
        ok: true,
        value: { repos: [facts], totalCount: 1, truncated: false },
      }),
      fetchEvidence: fetchEvidenceFn,
      llm: { complete },
      cache: null,
      limiter: {
        check: async () => "ok",
        consume: async () => "ok",
      } as unknown as SeanceDeps["limiter"],
      log: () => {},
    };

    const pending = runSeance({ owner: "o", repo: "demo", ip: "1.1.1.1" }, deps);

    await vi.advanceTimersByTimeAsync(GATHER_TIMEOUT_MS - 1);
    expect(fetchEvidenceFn).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(complete).toHaveBeenCalled();

    await vi.runAllTimersAsync();
    await pending;
    expect(fetchEvidenceFn).toHaveBeenCalledTimes(1);
  });
});
