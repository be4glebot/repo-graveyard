/**
 * Per-state séance voice: the heading, the prompt guidance and the cache key
 * all follow the creature state.
 */
import { describe, expect, it } from "vitest";
import { STATE_VOICE, buildSeancePrompt } from "@/lib/ai";
import { seanceCacheKey } from "@/lib/cache";
import { deriveEvidence } from "@/lib/seance";
import type { EvidencePack } from "@/lib/seance";
import { CAUSE_HEADINGS, causeHeading, type CreatureState } from "@/lib/seance-schema";
import type { RepoFacts } from "@/lib/lifecycle";

const EXPECTED: Record<CreatureState, string> = {
  ghost: "What keeps me here",
  risen: "Why I returned",
  zombie: "Cause of death",
  tombstone: "How I was laid to rest",
  coffin: "Why I was sealed",
};
const STATES = Object.keys(EXPECTED) as CreatureState[];

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
const pack: EvidencePack = { facts, readme: "# Hi", commits: ["wip: oauth callback still broken"] };
const derived = deriveEvidence(pack);

describe("causeHeading", () => {
  it.each(STATES)("%s maps to its exact heading", (s) => {
    expect(causeHeading(s)).toBe(EXPECTED[s]);
    expect(CAUSE_HEADINGS[s]).toBe(EXPECTED[s]);
  });

  it("falls back to the zombie heading for unknown states", () => {
    expect(causeHeading("nonsense")).toBe("Cause of death");
    expect(causeHeading(undefined)).toBe("Cause of death");
  });
});

describe("prompt follows the state", () => {
  it.each(STATES)("%s prompt states its heading and tone note", (s) => {
    const { system, user } = buildSeancePrompt("ada", derived, s);
    expect(system).toContain(`shown under the heading "${EXPECTED[s]}"`);
    expect(system).toContain(STATE_VOICE[s].intro);
    expect(system).toContain(STATE_VOICE[s].tone);
    expect(system).toContain(STATE_VOICE[s].cause);
    expect(user).toContain(`Speak as ${STATE_VOICE[s].speaker}.`);
    expect(system).toContain("`causeOfDeath`");
  });

  it("does not call a ghost dead", () => {
    const { system, user } = buildSeancePrompt("ada", derived, "ghost");
    expect(`${system}\n${user}`).not.toMatch(/\bdead\b/i);
    expect(system).toMatch(/restless spirit/);
  });

  it("describes risen as back from the dead on borrowed time", () => {
    expect(buildSeancePrompt("ada", derived, "risen").system).toMatch(/borrowed time/);
  });

  it("describes tombstones as at rest and coffins as sealed", () => {
    expect(buildSeancePrompt("ada", derived, "tombstone").system).toMatch(/peaceful/);
    expect(buildSeancePrompt("ada", derived, "coffin").system).toMatch(/cold, distant/);
  });

  it("without a state behaves as a zombie", () => {
    const none = buildSeancePrompt("ada", derived);
    const zombie = buildSeancePrompt("ada", derived, "zombie");
    expect(none).toEqual(zombie);
  });
});

describe("cache key includes the state", () => {
  it("appends the state only when given", () => {
    const base = seanceCacheKey("Ada", "Repo", "2024-01-01T00:00:00Z", "x");
    expect(base).toBe("seance:v6:ada/repo:2024-01-01T00:00:00Z");
    expect(seanceCacheKey("Ada", "Repo", "2024-01-01T00:00:00Z", "x", "ghost")).toBe(
      `${base}:ghost`,
    );
  });

  it("differs per state", () => {
    const keys = new Set(
      STATES.map((s) => seanceCacheKey("a", "b", null, "2020-01-01T00:00:00Z", s)),
    );
    expect(keys.size).toBe(STATES.length);
  });
});