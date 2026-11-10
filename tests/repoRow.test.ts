import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRepoRows } from "../lib/repoRow";
import type { RepoFacts } from "../lib/lifecycle";

function facts(overrides: Partial<RepoFacts> = {}): RepoFacts {
  return {
    name: "repo",
    description: "a repo",
    url: "https://github.com/me/repo",
    pushedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2020-01-01T00:00:00.000Z",
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 1,
    primaryLanguage: null,
    openIssueCount: 0,
    releaseCount: 0,
    readmeBytes: null,
    lastCommitMessage: null,
    languageColor: null,
    forkCount: 0,
    topics: [],
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("buildRepoRows (Requirements 1.3, 1.8)", () => {
  it("skips a negative forkCount with a warning and keeps the other rows", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = buildRepoRows([
      facts({ name: "a" }),
      facts({ name: "bad-fork", forkCount: -1 }),
      facts({ name: "c" }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["a", "c"]);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain("bad-fork");
    expect(msg).toContain("forkCount");
  });

  it("skips a repo with more than 5 topics with a warning and keeps the others", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = buildRepoRows([
      facts({ name: "many", topics: ["a", "b", "c", "d", "e", "f"] }),
      facts({ name: "ok", topics: ["a", "b", "c", "d", "e"] }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["ok"]);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain("many");
    expect(msg).toContain("topics");
  });

  it("composes primaryLanguage into { name, color } from RepoFacts fields", () => {
    const [row] = buildRepoRows([
      facts({ primaryLanguage: "TypeScript", languageColor: "#3178c6" }),
    ]);
    expect(row.primaryLanguage).toEqual({ name: "TypeScript", color: "#3178c6" });
  });

  it("keeps a language with a null color", () => {
    const [row] = buildRepoRows([facts({ primaryLanguage: "Rust", languageColor: null })]);
    expect(row.primaryLanguage).toEqual({ name: "Rust", color: null });
  });

  it("yields primaryLanguage null when RepoFacts.primaryLanguage is null", () => {
    const [row] = buildRepoRows([facts({ primaryLanguage: null, languageColor: "#fff" })]);
    expect(row.primaryLanguage).toBeNull();
  });
});
