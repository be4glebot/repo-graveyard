/**
 * Quality rules for a séance: verdict meanings, concision that scales with the
 * repo, the faded-memory sentence, and the haunted-voice prompt.
 */
import { describe, expect, it } from "vitest";
import {
  TONE_EXAMPLES,
  VERDICT_RULES,
  buildSeancePrompt,
  MEMORY_FADED_SENTENCE,
} from "@/lib/ai";
import type { RepoFacts } from "@/lib/lifecycle";
import {
  MAX_QUOTE_CHARS,
  businessItemBudget,
  deriveEvidence,
  isGroundedEvidence,
  type EvidencePack,
} from "@/lib/seance";
import {
  NEXT_STEP_MESSAGE,
  hasNextStepLanguage,
  misusesMemoryFaded,
  seanceResultSchema,
} from "@/lib/seance-schema";

const facts: RepoFacts = {
  name: "smart-sunrise-lamp",
  description: null,
  url: "https://github.com/ada/smart-sunrise-lamp",
  pushedAt: "2025-01-10T00:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
  isArchived: false,
  isFork: false,
  homepageUrl: null,
  stargazerCount: 1,
  primaryLanguage: "C++",
  openIssueCount: 0,
  releaseCount: 0,
  readmeBytes: null,
  lastCommitMessage: "wip: dimming curve",
  languageColor: null,
  forkCount: 0,
  topics: [],
};

const pack = (over: Partial<EvidencePack> = {}): EvidencePack => ({
  facts,
  readme: null,
  commits: ["wip: dimming curve"],
  ...over,
});

const base = {
  voice: "The lamp never learned your name. It waits in the dark with the curve half drawn.",
  causeOfDeath: "The dimming curve was left half drawn.",
  unfinishedBusiness: [
    { title: "The curve", detail: "The dimming curve was never finished.", evidence: "last commit: wip: dimming curve" },
    { title: "The lamp", detail: "No release ever left the bench.", evidence: "releases: 0" },
  ],
  verdict: "revive",
  verdictReason: "Finish the dimming curve, then cut a first release.",
};

const ok = (v: unknown) => seanceResultSchema.safeParse(v).success;

describe("verdict consistency", () => {
  it("revive may name a next step", () => {
    expect(ok(base)).toBe(true);
  });

  it.each(["finish", "seal"])("%s with next-step language is rejected", (verdict) => {
    // The smart-sunrise-lamp failure: a finish whose reason said to keep testing.
    const bad = { ...base, verdict, verdictReason: "Keep testing it, then cut a first release." };
    const r = seanceResultSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === NEXT_STEP_MESSAGE)).toBe(true);
      expect(r.error.issues[0].path).toEqual(["verdictReason"]);
    }
  });

  it.each([
    "Next step: ship it.",
    "Then cut a release.",
    "Add a readme.",
    "Implement the missing curve.",
    "Fix the dimming bug.",
    "Run the tests first.",
    "You should archive it.",
    "It needs to be finished.",
  ])("flags next-step wording: %s", (reason) => {
    expect(hasNextStepLanguage(reason)).toBe(true);
  });

  it.each([
    "It already does what it was meant to do, so mark it done or archive it.",
    "It was a good lamp and it lit many mornings; let it rest.",
    "Not worth continuing, and that is nobody's fault.",
  ])("accepts finished or sealed wording: %s", (reason) => {
    expect(hasNextStepLanguage(reason)).toBe(false);
    expect(ok({ ...base, verdict: "finish", verdictReason: reason })).toBe(true);
    expect(ok({ ...base, verdict: "seal", verdictReason: reason })).toBe(true);
  });

  it("the prompt states the three verdict meanings", () => {
    const { system } = buildSeancePrompt("ada", deriveEvidence(pack()));
    for (const rule of VERDICT_RULES) expect(system).toContain(rule);
    expect(system).toMatch(/revive: it is worth continuing/);
    expect(system).toMatch(/finish: it already does what it was meant to do/);
    expect(system).toMatch(/seal: it is not worth continuing/);
    expect(system).toMatch(/No next steps/);
  });
});

describe("concision", () => {
  it("voice is limited to 3 sentences and 320 characters", () => {
    expect(ok({ ...base, voice: "One. Two. Three." })).toBe(true);
    expect(ok({ ...base, voice: "One. Two. Three. Four." })).toBe(false);
    expect(ok({ ...base, voice: "I wait. " + "x".repeat(320 - 8 - 1) + "." })).toBe(true);
    expect(ok({ ...base, voice: "I wait. " + "x".repeat(320 - 8) + "." })).toBe(false);
  });

  it("each detail is one sentence of at most 140 characters", () => {
    const withDetail = (detail: string) => ({
      ...base,
      unfinishedBusiness: [{ ...base.unfinishedBusiness[0], detail }, base.unfinishedBusiness[1]],
    });
    expect(ok(withDetail("One sentence only."))).toBe(true);
    expect(ok(withDetail("Two sentences. Not allowed."))).toBe(false);
    expect(ok(withDetail("x".repeat(141)))).toBe(false);
  });

  it("the ledger holds 1 to 4 items (the prompt still asks for 2 to 4)", () => {
    const items = (n: number) => Array.from({ length: n }, () => base.unfinishedBusiness[0]);
    expect(ok({ ...base, unfinishedBusiness: items(0) })).toBe(false);
    expect(ok({ ...base, unfinishedBusiness: items(1) })).toBe(true);
    expect(ok({ ...base, unfinishedBusiness: items(2) })).toBe(true);
    expect(ok({ ...base, unfinishedBusiness: items(4) })).toBe(true);
    expect(ok({ ...base, unfinishedBusiness: items(5) })).toBe(false);
  });

  describe("item budget scales with the repo", () => {
    it("small repo: exactly 2", () => {
      expect(businessItemBudget(deriveEvidence(pack()))).toEqual({ min: 2, max: 2 });
      const { system } = buildSeancePrompt("ada", deriveEvidence(pack()));
      expect(system).toMatch(/`unfinishedBusiness` has exactly 2 items/);
    });

    it("more than 3 informative lines: up to 4", () => {
      const rich = pack({ commits: ["one", "two", "three", "four"].map((s) => `${s} change`) });
      expect(businessItemBudget(deriveEvidence(rich))).toEqual({ min: 2, max: 4 });
      const { system } = buildSeancePrompt("ada", deriveEvidence(rich));
      expect(system).toMatch(/`unfinishedBusiness` has 2 to 4 items/);
    });

    it("a long README makes a repo rich even with few lines", () => {
      const long = pack({ readme: "A long readme. ".repeat(60) });
      expect(businessItemBudget(deriveEvidence(long))).toEqual({ min: 2, max: 4 });
    });

    it("a short README keeps it small", () => {
      expect(businessItemBudget(deriveEvidence(pack({ readme: "# Lamp\nA lamp." })))).toEqual({ min: 2, max: 2 });
    });
  });

  describe("README and commit quotes are at most 80 characters", () => {
    const longCommit = "wip: " + "a very long and winding commit message ".repeat(3).trim();
    const d = deriveEvidence(pack({ commits: [longCommit] }));

    it("accepts a short quote", () => {
      expect(isGroundedEvidence("a very long and winding commit message", d)).toBe(true);
    });

    it("rejects a longer quote of the same text", () => {
      const quote = longCommit.slice(0, MAX_QUOTE_CHARS + 1);
      expect(quote.length).toBe(81);
      expect(isGroundedEvidence(quote, d)).toBe(false);
      expect(isGroundedEvidence(longCommit.slice(0, MAX_QUOTE_CHARS), d)).toBe(true);
    });

    it("still allows an exact copy of a fact line", () => {
      const line = d.factLines.find((f) => f.label === "C1")!.text;
      expect(line.length).toBeGreaterThan(MAX_QUOTE_CHARS);
      expect(isGroundedEvidence(line, d)).toBe(true);
    });

    it("the prompt asks for short quotes", () => {
      const { system } = buildSeancePrompt("ada", d);
      expect(system).toMatch(/at most 80 characters/);
      expect(system).toMatch(/exactly ONE sentence, at most 140 characters/);
      expect(system).toMatch(/at most 320 characters/);
    });
  });
});

describe("the faded-memory sentence", () => {
  it("is allowed only as the whole causeOfDeath, never in voice", () => {
    expect(misusesMemoryFaded(MEMORY_FADED_SENTENCE)).toBe(false);
    expect(ok({ ...base, causeOfDeath: MEMORY_FADED_SENTENCE })).toBe(true);
    expect(ok({ ...base, voice: `The lamp went dark. ${MEMORY_FADED_SENTENCE}` })).toBe(false);
    expect(ok({ ...base, verdictReason: MEMORY_FADED_SENTENCE })).toBe(false);
  });

  it("is rejected inside another sentence", () => {
    const glued = "You asked about the curve, and my memory of that has faded, so I hum.";
    expect(misusesMemoryFaded(glued)).toBe(true);
    expect(misusesMemoryFaded("It is true that My memory of that has faded.")).toBe(true);
    expect(ok({ ...base, voice: "I loved the dark. " + glued })).toBe(false);
  });

  it("is rejected in every prose field", () => {
    const glued = "Because my memory of that has faded, I cannot say.";
    expect(ok({ ...base, causeOfDeath: glued })).toBe(false);
    expect(ok({ ...base, verdictReason: glued })).toBe(false);
    const item = (patch: object) => ({
      ...base,
      unfinishedBusiness: [{ ...base.unfinishedBusiness[0], ...patch }, base.unfinishedBusiness[1]],
    });
    expect(ok(item({ detail: glued }))).toBe(false);
    expect(ok(item({ title: glued.slice(0, 70) }))).toBe(false);
  });

  it("the prompt allows it only as the entire causeOfDeath when evidence is missing", () => {
    const { system } = buildSeancePrompt("ada", deriveEvidence(pack()));
    expect(system).toContain(`"${MEMORY_FADED_SENTENCE}" may be used only as the entire`);
    expect(system).toMatch(/only when the README and commits are both missing/);
    expect(system).toMatch(/not in `voice`/);
  });
});

describe("haunted voice prompt", () => {
  const { system } = buildSeancePrompt("ada", deriveEvidence(pack()));

  it("asks for a lingering spirit, not a summary", () => {
    expect(system).toMatch(/have died, and you are still lingering/);
    expect(system).toMatch(/not a summary and not a README/);
    expect(system).toMatch(/never recap what the project is for/);
    expect(system).toMatch(/sensory, quiet, a little dread/);
    expect(system).toMatch(/specific to the evidence/);
  });

  it("includes two tone examples and says not to copy them", () => {
    expect(TONE_EXAMPLES).toHaveLength(2);
    for (const e of TONE_EXAMPLES) expect(system).toContain(e);
    expect(TONE_EXAMPLES[0]).toContain("strongest signal");
    expect(system).toMatch(/do not copy them/);
  });

  it("the tone examples themselves obey the voice rules", () => {
    const voice = TONE_EXAMPLES.join(" ");
    // Each example is a valid voice: 2 sentences, under 320 characters.
    for (const e of TONE_EXAMPLES) {
      expect(e.length).toBeLessThanOrEqual(320);
      expect(ok({ ...base, voice: e })).toBe(true);
    }
    expect(voice.toLowerCase()).not.toContain("my memory of that has faded");
  });

  it("no longer asks every reason to end with a next step", () => {
    expect(system).not.toMatch(/End it with one concrete next step/);
  });
});