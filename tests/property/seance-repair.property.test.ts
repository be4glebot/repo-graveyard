import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { deriveEvidence } from "@/lib/seance";
import { repairSeance, repairVoice } from "@/lib/seance-repair";
import { seanceResultSchema, splitSentences } from "@/lib/seance-schema";
import type { RepoFacts } from "@/lib/lifecycle";

const facts: RepoFacts = {
  name: "repo-graveyard",
  description: null,
  url: "https://github.com/quietmoonowl/repo-graveyard",
  pushedAt: "2025-01-01T00:00:00Z",
  createdAt: "2024-01-02T00:00:00Z",
  isArchived: false,
  isFork: false,
  homepageUrl: null,
  stargazerCount: 0,
  primaryLanguage: "TypeScript",
  openIssueCount: 0,
  releaseCount: 0,
  readmeBytes: 400,
  lastCommitMessage: null,
  languageColor: null,
  forkCount: 0,
  topics: [],
};
const derived = deriveEvidence({ owner: "quietmoonowl", facts, readme: null, commits: [] });

const GOOD_EVIDENCE = ["open issues: 0", "stars: 0", "forks: 0", "releases: 0"];
const mk = (evidence: string, n: number) => ({
  title: `Thing ${n}`,
  detail: "It is still unfinished.",
  evidence,
});

type Slot = { ok: boolean; n: number };
const slots = fc.array(
  fc.record({ ok: fc.boolean(), n: fc.nat(1000) }),
  { minLength: 1, maxLength: 7 },
);
const toItem = (s: Slot, i: number) =>
  mk(s.ok ? GOOD_EVIDENCE[i % GOOD_EVIDENCE.length] : `zqxjv-${s.n} nowhere in facts`, i);

const base = {
  voice: "I wait in the dark. It is very quiet.",
  causeOfDeath: "A half-tidied toggle keeps me here.",
  verdict: "revive",
  verdictReason: "Worth continuing: finish the toggle first.",
};

describe("repair properties", () => {
  // Feature: the-seance, Property 28: Repair is per item and never touches what it should not
  // **Validates: Requirements 4.3, 4.29, 4.30, 4.32, 6.7**
  it("keeps exactly the valid items (at most 4), in order, and rejects only when none survive", () => {
    fc.assert(
      fc.property(slots, (list) => {
        const items = list.map(toItem);
        const input = { ...base, unfinishedBusiness: items };
        const r = repairSeance(input, derived);
        const good = items.filter((_, i) => list[i].ok);
        const parsed = seanceResultSchema.safeParse(r.value);
        if (good.length === 0) {
          expect(r.rejected.length).toBeGreaterThan(0);
          expect(parsed.success).toBe(false);
        } else {
          expect(r.rejected).toEqual([]);
          expect(parsed.success).toBe(true);
          if (parsed.success) expect(parsed.data.unfinishedBusiness).toEqual(good.slice(0, 4));
        }
        // Never touched: the parts repair must leave alone.
        const v = r.value as Record<string, unknown>;
        expect(v.causeOfDeath).toBe(base.causeOfDeath);
        expect(v.verdict).toBe(base.verdict);
        expect(v.verdictReason).toBe(base.verdictReason);
        // The input is not mutated.
        expect(input.unfinishedBusiness).toEqual(items);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: the-seance, Property 28: Repair is per item and never touches what it should not
  // **Validates: Requirements 4.31**
  it("repairVoice only removes or cuts sentences, is idempotent, and respects the limits when it changes anything", () => {
    const sentence = fc
      .tuple(fc.array(fc.constantFrom("dark", "wait", "still", "door", "lamp", "cold"), { minLength: 1, maxLength: 12 }), fc.constantFrom(".", "!", "?"))
      .map(([w, p]) => `${w.join(" ")}${p}`);
    const dated = fc.constantFrom("It was 5 days ago.", "I died on 2024-05-01.", "My memory of that has faded.");
    fc.assert(
      fc.property(
        fc.array(fc.oneof({ weight: 4, arbitrary: sentence }, { weight: 1, arbitrary: dated }), { minLength: 0, maxLength: 8 }),
        (parts) => {
          const voice = parts.join(" ");
          const r = repairVoice(voice);
          if (r.codes.length === 0) {
            expect(r.text).toBe(voice);
            return;
          }
          const out = splitSentences(r.text);
          const inp = new Set(splitSentences(voice));
          expect(out.length).toBeGreaterThanOrEqual(2);
          expect(out.length).toBeLessThanOrEqual(3);
          expect(r.text.length).toBeLessThanOrEqual(320);
          for (const s of out) expect(inp.has(s)).toBe(true);
          expect(repairVoice(r.text).codes).toEqual([]);
        },
      ),
      { numRuns: 300 },
    );
  });
});