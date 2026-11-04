/**
 * Threshold and boundary assertion tests (task 14.1).
 *
 * Part 1 pins every `LIFECYCLE_CONFIG` default against the values mandated by
 * the requirements (Req 3.14, 5.4), so an accidental threshold edit fails loudly.
 *
 * Part 2 exercises the classification boundaries with concrete, hand-built
 * `RepoFacts` and an explicit `now`, covering the off-by-one edges of the ghost
 * threshold and the revive window.
 *
 * Requirements: 3.14, 5.4
 */

import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_CONFIG,
  classify,
  daysQuiet,
  type Override,
  type RepoFacts,
} from "@/lib/lifecycle";

const MS_PER_DAY = 86_400_000;

/** A fixed reference instant; boundaries are expressed as offsets from this. */
const NOW = "2024-06-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);

/** ISO string for exactly `days` days before NOW (no flooring surprises). */
function daysBeforeNow(days: number): string {
  return new Date(NOW_MS - days * MS_PER_DAY).toISOString();
}

/**
 * A repo with zero finished signals and no override, so classification turns
 * purely on `daysQuiet`: releaseCount 0, empty homepage, absent README (also an
 * unfinished signal), low open issues, no finished keyword in the commit.
 */
function noSignalRepo(pushedAt: string): RepoFacts {
  return {
    name: "repo",
    description: null,
    url: "https://github.com/octocat/repo",
    pushedAt,
    createdAt: daysBeforeNow(1000),
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 0,
    primaryLanguage: null,
    openIssueCount: 0,
    releaseCount: 0,
    readmeBytes: null,
    lastCommitMessage: "small tweak",
  };
}

describe("LIFECYCLE_CONFIG defaults (Req 3.14, 5.4)", () => {
  it("pins every scalar threshold to its required default", () => {
    expect(LIFECYCLE_CONFIG.ghostMaxDaysQuiet).toBe(90);
    expect(LIFECYCLE_CONFIG.reviveWindowDays).toBe(14);
    expect(LIFECYCLE_CONFIG.readmeMinBytes).toBe(1024);
    expect(LIFECYCLE_CONFIG.manyIssues).toBe(10);
    expect(LIFECYCLE_CONFIG.popularStars).toBe(50);
    expect(LIFECYCLE_CONFIG.finishedMargin).toBe(2);
    expect(LIFECYCLE_CONFIG.maxRepos).toBe(300);
    expect(LIFECYCLE_CONFIG.pageSize).toBe(50);
    expect(LIFECYCLE_CONFIG.msPerDay).toBe(86_400_000);
  });

  it("pins the decay band bounds", () => {
    expect(LIFECYCLE_CONFIG.ghostDecayBounds).toEqual([14, 30, 60]);
    expect(LIFECYCLE_CONFIG.zombieDecayBounds).toEqual([182, 365, 730, 1095]);
  });

  it("pins the finished and unfinished keyword lists (Req 5.4)", () => {
    expect(LIFECYCLE_CONFIG.finishedCommitKeywords).toEqual([
      "v1.0",
      "release",
      "final",
      "done",
      "ship",
    ]);
    expect(LIFECYCLE_CONFIG.unfinishedCommitKeywords).toEqual([
      "wip",
      "todo",
      "temp",
      "fix later",
    ]);
  });
});

describe("classification boundaries", () => {
  it("classifies a push 89 days ago as ghost (just under the 90-day threshold)", () => {
    const repo = noSignalRepo(daysBeforeNow(89));
    expect(daysQuiet(repo, NOW)).toBe(89);

    const result = classify(repo, undefined, NOW);
    expect(result.state).toBe("ghost");
    // days_quiet 89 is at/above all three ghost bounds [14, 30, 60] => level 3.
    expect(result.decayLevel).toBe(3);
  });

  it("classifies a push 90 days ago with no finished signals as zombie", () => {
    const repo = noSignalRepo(daysBeforeNow(90));
    expect(daysQuiet(repo, NOW)).toBe(90);

    const result = classify(repo, undefined, NOW);
    expect(result.state).toBe("zombie");
    // days_quiet 90 is below the first zombie bound (182) => level 0.
    expect(result.decayLevel).toBe(0);
  });

  it("does not classify a 14-day-old revival as risen (window is exclusive)", () => {
    // Pushed long ago (not after setAt) so the revival is governed by elapsed.
    const repo = noSignalRepo(daysBeforeNow(400));
    const override: Override = {
      type: "revived",
      setAt: daysBeforeNow(14), // exactly reviveWindowDays before NOW => elapsed 14
    };

    const result = classify(repo, override, NOW);
    // elapsed (14) is not < reviveWindowDays (14): the revive lapsed and cleared.
    expect(result.state).not.toBe("risen");
    expect(result.clearedOverrides).toContain("revived");
    // Falls through to zombie (no finished signals, days_quiet 400 >= 90).
    expect(result.state).toBe("zombie");
  });
});
