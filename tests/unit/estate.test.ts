/**
 * Date-stability unit test for `resolveEstate` (task 8.3).
 *
 * The estate fixture stores push/creation/override dates as "days ago" offsets
 * so the sample graveyard resolves to the same lifecycle state and decay level
 * on every calendar day. This test resolves one in-memory fixture at two very
 * different `now` values and asserts that, for every repo, `classify` yields an
 * identical state and decay level — proving the offsets keep the estate stable
 * over time (Requirement 12.3). It also pins the resolver contract the estate
 * route relies on: the prose fields are dropped and overrides are keyed by repo
 * name and applied in-memory only (Requirement 12.7).
 *
 * Requirements: 12.3, 12.7
 */

import { describe, expect, it } from "vitest";
import { resolveEstate } from "@/lib/estate";
import type { EstateFixture } from "@/lib/estate-schema";
import { classify, type RepoFacts } from "@/lib/lifecycle";

/** Two calendar days roughly 20 months apart; offsets must be stable across both. */
const NOW_A = "2024-01-01T00:00:00.000Z";
const NOW_B = "2025-09-15T12:34:56.000Z";

/**
 * A small in-memory fixture (NOT read from `data/estate.json`) whose repos span
 * several lifecycle states and carry an override. Every required field from the
 * estate schema is present so the shape matches what the resolver consumes.
 */
const FIXTURE: EstateFixture = {
  username: "ghoulish-dev",
  repos: [
    // Recently pushed -> ghost, decay 0 (pushedDaysAgo < first ghost bound 14).
    {
      name: "fresh-ghost",
      description: "A repo touched last week.",
      url: "https://example.test/fresh-ghost",
      pushedDaysAgo: 3,
      createdDaysAgo: 400,
      isArchived: false,
      isFork: false,
      homepageUrl: null,
      stargazerCount: 2,
      primaryLanguage: "TypeScript",
      openIssueCount: 1,
      releaseCount: 0,
      readmeBytes: 256,
      lastCommitMessage: "wip: tweak",
      diagnosis: "Still warm to the touch.",
      seance: "It stirs when you call its name.",
    },
    // Long silent, not finished -> zombie with a high decay band.
    {
      name: "shambling-zombie",
      description: "Abandoned ages ago.",
      url: "https://example.test/shambling-zombie",
      pushedDaysAgo: 800,
      createdDaysAgo: 1200,
      isArchived: false,
      isFork: false,
      homepageUrl: null,
      stargazerCount: 0,
      primaryLanguage: "JavaScript",
      openIssueCount: 0,
      releaseCount: 0,
      readmeBytes: null,
      lastCommitMessage: "todo: finish later",
      diagnosis: "Dragging one foot behind it.",
      seance: "A low groan answers from the dark.",
    },
    // Archived + not finished -> coffin.
    {
      name: "sealed-coffin",
      description: "Archived and forgotten.",
      url: "https://example.test/sealed-coffin",
      pushedDaysAgo: 500,
      createdDaysAgo: 900,
      isArchived: true,
      isFork: false,
      homepageUrl: null,
      stargazerCount: 1,
      primaryLanguage: null,
      openIssueCount: 0,
      releaseCount: 0,
      readmeBytes: 100,
      lastCommitMessage: "temp",
      diagnosis: "The lid is nailed shut.",
      seance: "Silence. Only silence.",
    },
    // Carries a recent "revived" override -> risen while the window holds.
    {
      name: "risen-by-hand",
      description: "Marked revived by its owner.",
      url: "https://example.test/risen-by-hand",
      pushedDaysAgo: 300,
      createdDaysAgo: 600,
      isArchived: false,
      isFork: false,
      homepageUrl: null,
      stargazerCount: 10,
      primaryLanguage: "Rust",
      openIssueCount: 2,
      releaseCount: 1,
      readmeBytes: 2048,
      lastCommitMessage: "revive it",
      override: { type: "revived", setDaysAgo: 2 },
      diagnosis: "Freshly disturbed earth.",
      seance: "A hand breaks the surface.",
    },
  ],
};

describe("resolveEstate", () => {
  it("resolves to identical state and decay across different now values (Req 12.3)", () => {
    const resolvedA = resolveEstate(FIXTURE, NOW_A);
    const resolvedB = resolveEstate(FIXTURE, NOW_B);

    // Same set of repos, same order, at both now values.
    expect(resolvedA.repos.map((r) => r.name)).toEqual(
      resolvedB.repos.map((r) => r.name),
    );

    for (let i = 0; i < resolvedA.repos.length; i += 1) {
      const repoA = resolvedA.repos[i];
      const repoB = resolvedB.repos[i];
      const overrideA = resolvedA.overrides[repoA.name];
      const overrideB = resolvedB.overrides[repoB.name];

      const classA = classify(repoA, overrideA, NOW_A);
      const classB = classify(repoB, overrideB, NOW_B);

      // The whole point of the offsets: state and decay must not depend on the
      // calendar day the fixture is resolved on.
      expect(classB.state).toBe(classA.state);
      expect(classB.decayLevel).toBe(classA.decayLevel);
    }
  });

  it("covers the intended spread of lifecycle states", () => {
    const resolved = resolveEstate(FIXTURE, NOW_A);
    const stateFor = (name: string) => {
      const repo = resolved.repos.find((r) => r.name === name) as RepoFacts;
      return classify(repo, resolved.overrides[name], NOW_A).state;
    };

    expect(stateFor("fresh-ghost")).toBe("ghost");
    expect(stateFor("shambling-zombie")).toBe("zombie");
    expect(stateFor("sealed-coffin")).toBe("coffin");
    expect(stateFor("risen-by-hand")).toBe("risen");
  });

  it("drops the prose fields from resolved RepoFacts", () => {
    const resolved = resolveEstate(FIXTURE, NOW_A);

    for (const repo of resolved.repos) {
      expect(repo).not.toHaveProperty("diagnosis");
      expect(repo).not.toHaveProperty("seance");
      // And it keeps the offsets out of the resolved facts too.
      expect(repo).not.toHaveProperty("pushedDaysAgo");
      expect(repo).not.toHaveProperty("createdDaysAgo");
    }
  });

  it("keys overrides by repo name and only for repos that have one (Req 12.7)", () => {
    const resolved = resolveEstate(FIXTURE, NOW_A);

    expect(Object.keys(resolved.overrides)).toEqual(["risen-by-hand"]);
    expect(resolved.overrides["risen-by-hand"]?.type).toBe("revived");
    // The override timestamp resolves relative to the injected `now`.
    expect(resolved.overrides["risen-by-hand"]?.setAt).toBe(
      new Date(Date.parse(NOW_A) - 2 * 86_400_000).toISOString(),
    );
  });
});
