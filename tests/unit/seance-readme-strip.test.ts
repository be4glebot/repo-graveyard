/**
 * README markdown is stripped inside deriveEvidence, so the model-facing text
 * and the grounding corpus are the same clean words.
 */

import { describe, expect, it } from "vitest";
import { buildSeancePrompt } from "@/lib/ai";
import { deriveEvidence, stripMarkdown } from "@/lib/seance";
import type { EvidencePack } from "@/lib/seance";
import type { RepoFacts } from "@/lib/lifecycle";

const facts: RepoFacts = {
  name: "crypt-keeper",
  description: "A tiny task tracker",
  url: "https://github.com/ada/crypt-keeper",
  pushedAt: "2024-01-02T00:00:00Z",
  createdAt: "2023-01-02T00:00:00Z",
  isArchived: false,
  isFork: false,
  homepageUrl: null,
  stargazerCount: 3,
  primaryLanguage: "TypeScript",
  openIssueCount: 1,
  releaseCount: 0,
  readmeBytes: 400,
  lastCommitMessage: "wip: oauth callback still broken",
  languageColor: null,
  forkCount: 0,
  topics: [],
};

const pack = (readme: string | null): EvidencePack => ({
  facts,
  readme,
  commits: ["wip: oauth callback still broken"],
});

const MD = [
  "# Crypt Keeper",
  "",
  "![logo](https://example.dev/logo.png)",
  "",
  "A **fast** and _gentle_ tracker, built with `vite`.",
  "",
  "- [docs](https://example.dev/docs) are here",
  "1. install the my_snake_case helper",
  "",
  "```bash",
  "npm run dev",
  "```",
  "",
  "<p align=\"center\"><b>Hello</b></p>",
].join("\n");

describe("stripMarkdown", () => {
  const out = stripMarkdown(MD);

  it("removes emphasis, backticks, headings, list markers and fences", () => {
    expect(out).not.toContain("**");
    expect(out).not.toContain("`");
    expect(out).not.toMatch(/^#/);
    expect(out).not.toMatch(/(^|\s)- /);
    expect(out).toContain("fast and gentle tracker, built with vite.");
  });

  it("turns links into their text and drops images and HTML tags", () => {
    expect(out).toContain("docs are here");
    expect(out).not.toContain("https://");
    expect(out).not.toContain("logo");
    expect(out).not.toMatch(/<|>/);
    expect(out).toContain("Hello");
  });

  it("keeps snake_case and collapses whitespace", () => {
    expect(out).toContain("my_snake_case");
    expect(out).not.toMatch(/\s{2,}|\n/);
  });
});

describe("deriveEvidence with a markdown README", () => {
  const d = deriveEvidence(pack(MD));

  it("has no ** or backticks in the README text or evidence text", () => {
    expect(d.readmeText).not.toBeNull();
    expect(d.readmeText).not.toMatch(/\*\*|`/);
    expect(d.evidenceText).not.toMatch(/\*\*|`/);
  });

  it("feeds the prompt and the grounding corpus the same text", () => {
    const { user } = buildSeancePrompt("ada", d);
    expect(user).toContain(d.readmeText as string);
    expect(d.evidenceText).toContain(d.readmeText as string);
  });

  it("treats a README that is only markup as no README", () => {
    expect(deriveEvidence(pack("```\n```\n![x](y)")).readmeText).toBeNull();
  });
});