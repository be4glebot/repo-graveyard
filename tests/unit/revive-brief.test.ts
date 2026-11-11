import { describe, expect, it } from "vitest";
import estate from "@/data/estate.json";
import {
  DATA_NOTICE,
  EMPTY_PLACEHOLDER,
  buildCloneCommand,
  buildRepoUrl,
  buildReviveBrief,
  isEstateOwner,
} from "@/lib/revive-brief";
import type { SeanceResult } from "@/lib/seance-schema";

const base: SeanceResult = {
  voice: "I am here.",
  causeOfDeath: "A cause.",
  unfinishedBusiness: [{ title: "Toggle", detail: "Half done.", evidence: "commit abc" }],
  verdict: "revive",
  verdictReason: "Start with the toggle.",
};

describe("isEstateOwner", () => {
  it("treats empty and blank owners as the estate", () => {
    expect(isEstateOwner("")).toBe(true);
    expect(isEstateOwner("  ")).toBe(true);
    expect(isEstateOwner("octo")).toBe(false);
  });
});

describe("empty owner", () => {
  it("falls back to 'unknown' with no empty path segment", () => {
    expect(buildCloneCommand({ owner: "", repo: "my-repo" })).toBe(
      "git clone https://github.com/unknown/my-repo.git",
    );
    const url = buildRepoUrl({ owner: "", repo: "my-repo" });
    expect(url.replace("https://", "")).not.toContain("//");
    const brief = buildReviveBrief(base, { owner: "", repo: "my-repo", state: "zombie" });
    expect(brief).toContain("(https://github.com/unknown/my-repo)");
  });
});

describe("estate revive entry", () => {
  it("produces sections in the expected order", () => {
    const repo = (estate.repos as Array<{ name: string; seanceResult?: SeanceResult }>).find(
      (r) => r.seanceResult?.verdict === "revive",
    );
    expect(repo).toBeDefined();
    const brief = buildReviveBrief(repo!.seanceResult!, {
      owner: "",
      repo: repo!.name,
      state: "zombie",
    });
    const headings = [
      "# Revival brief:",
      "## Cause of death",
      "## Unfinished business",
      "## First step",
      "## How to use this in Kiro",
    ];
    const positions = headings.map((h) => brief.indexOf(h));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(brief).toContain(DATA_NOTICE);
  });
});

describe("unfinished business rendering", () => {
  const facts = { owner: "octo", repo: "cat", state: "zombie" };

  it("renders a single line when there are no items", () => {
    const brief = buildReviveBrief({ ...base, unfinishedBusiness: [] }, facts);
    expect(brief).toContain("No unfinished business was found.");
    expect(brief).not.toContain("1. Title:");
  });

  it("escapes a title of '---' so it cannot form a rule", () => {
    const brief = buildReviveBrief(
      { ...base, unfinishedBusiness: [{ title: "---", detail: "", evidence: "" }] },
      facts,
    );
    expect(brief).toContain("1. Title: \\---");
    expect(brief).toContain(`Detail: ${EMPTY_PLACEHOLDER}`);
  });
});
