import { describe, expect, it } from "vitest";
import { explanationLine, type ExplanationFacts } from "../lib/repoDetails/explanationLine";

const NOW = "2025-01-01T00:00:00.000Z";

const base: ExplanationFacts = {
  pushedAt: "2024-12-22T00:00:00.000Z",
  createdAt: "2020-01-01T00:00:00.000Z",
  isArchived: false,
  isFork: false,
  releaseCount: 0,
  homepageUrl: null,
  readmeBytes: null,
  stargazerCount: 0,
  lastCommitMessage: null,
};

describe("explanationLine (Requirements 6.3, 11.5)", () => {
  it("ghost: states the last push", () => {
    const line = explanationLine({ state: "ghost", decayLevel: null, facts: base }, NOW);
    expect(line).toBe("Last push 10 days ago.");
  });

  it("zombie: says there are no signs it was finished", () => {
    const facts = { ...base, pushedAt: "2022-01-01T00:00:00.000Z" };
    const line = explanationLine({ state: "zombie", decayLevel: 2, facts }, NOW);
    expect(line).toContain("no signs it was finished");
    expect(line).toMatch(/^Quiet for 3 years/);
  });

  it("risen: shows the revive date and days remaining", () => {
    const line = explanationLine(
      { state: "risen", decayLevel: null, facts: base, revivedAt: "2024-12-22T00:00:00.000Z" },
      NOW,
    );
    expect(line).toContain("2024-12-22");
    expect(line).toMatch(/\d+ days? to prove/);
  });

  it("tombstone: names the README and releases that make it finished", () => {
    const facts = { ...base, pushedAt: "2022-01-01T00:00:00.000Z", releaseCount: 3, readmeBytes: 100000 };
    const line = explanationLine({ state: "tombstone", decayLevel: 2, facts }, NOW);
    expect(line).toContain("3 releases");
    expect(line).toContain("README");
    expect(line).toContain("finished, not abandoned");
  });

  it("coffin: says Archived on GitHub", () => {
    const facts = { ...base, isArchived: true };
    const line = explanationLine({ state: "coffin", decayLevel: null, facts }, NOW);
    expect(line).toBe("Archived on GitHub.");
  });
});
