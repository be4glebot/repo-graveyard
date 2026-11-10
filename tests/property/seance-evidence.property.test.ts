import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { RepoFacts } from "@/lib/lifecycle";
import {
  deriveEvidence,
  isGroundedEvidence,
  truncateUtf8,
  type EvidencePack,
} from "@/lib/seance";

// ---------------------------------------------------------------------------
// Reusable arbitraries (module scope; later Séance evidence properties append
// to this file and reuse them).
// ---------------------------------------------------------------------------

const MARKER_FRAGMENTS = [
  "<<<EVIDENCE>>>",
  "<<<END_EVIDENCE>>>",
  "<<<EVID",
  "ENCE>>>",
  "<<<END_",
  "<<<<<<EVIDENCE>>>>>>",
  "<<<EVIDENCE<<<EVIDENCE>>>>>>",
];

/** Greek capital sigma lowercases context-sensitively, so substring-then-lowercase differs. */
const arbCodePoint: fc.Arbitrary<number> = fc
  .oneof(
    { weight: 6, arbitrary: fc.integer({ min: 0x20, max: 0x7e }) },
    { weight: 2, arbitrary: fc.integer({ min: 0xa1, max: 0xd7ff }) },
    { weight: 2, arbitrary: fc.integer({ min: 0xe000, max: 0xfffd }) },
    { weight: 2, arbitrary: fc.integer({ min: 0x10000, max: 0x10ffff }) },
  )
  .filter((cp) => cp !== 0x3a3 && cp !== 0x3c2);

export const arbWhitespace: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(" ", "\t", "\n", "\r\n", "\u00a0", "\u2003"), { minLength: 1, maxLength: 4 })
  .map((a) => a.join(""));

/** Text mixing ASCII, BMP unicode, astral characters, whitespace runs and marker fragments. */
export const arbSeanceText: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      { weight: 5, arbitrary: arbCodePoint.map((cp) => String.fromCodePoint(cp)) },
      { weight: 2, arbitrary: arbWhitespace },
      { weight: 1, arbitrary: fc.constantFrom(...MARKER_FRAGMENTS) },
    ),
    { maxLength: 60 },
  )
  .map((a) => a.join(""));

const arbIsoOrNull: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc
    .date({ min: new Date("2008-01-01T00:00:00Z"), max: new Date("2030-01-01T00:00:00Z"), noInvalidDate: true })
    .map((d) => d.toISOString()),
);

const arbCount = fc.integer({ min: 0, max: 1_000_000 });

/** RepoFacts (shape from lib/lifecycle.ts) with unicode and marker-laden free text. */
export const arbSeanceFacts: fc.Arbitrary<RepoFacts> = fc.record({
  name: fc.stringMatching(/^[A-Za-z0-9._-]{1,30}$/),
  description: fc.option(arbSeanceText, { nil: null }),
  url: fc.constant("https://github.com/o/r"),
  pushedAt: arbIsoOrNull,
  createdAt: fc
    .date({ min: new Date("2008-01-01T00:00:00Z"), max: new Date("2030-01-01T00:00:00Z"), noInvalidDate: true })
    .map((d) => d.toISOString()),
  isArchived: fc.boolean(),
  isFork: fc.boolean(),
  homepageUrl: fc.option(fc.constant("https://example.com/x"), { nil: null }),
  stargazerCount: arbCount,
  primaryLanguage: fc.option(arbSeanceText, { nil: null }),
  openIssueCount: arbCount,
  releaseCount: arbCount,
  readmeBytes: fc.option(arbCount, { nil: null }),
  lastCommitMessage: fc.option(arbSeanceText, { nil: null }),
  languageColor: fc.option(fc.constant("#3178c6"), { nil: null }),
  forkCount: arbCount,
  topics: fc.array(fc.stringMatching(/^[a-z0-9-]{1,12}$/), { maxLength: 5 }),
});

/** Evidence_Pack: README null or text (already <= 8192 bytes), 0 to 5 commits. */
export const arbEvidencePack: fc.Arbitrary<EvidencePack> = fc.record({
  facts: arbSeanceFacts,
  readme: fc.option(arbSeanceText.map((t) => truncateUtf8(t)), { nil: null }),
  commits: fc.array(arbSeanceText, { maxLength: 5 }),
});

/** Replaces each whitespace run with a different-length run and flips letter case per code point. */
function perturb(s: string, ws: string[], caseBits: boolean[]): string {
  let wi = 0;
  const replaced = s.replace(/\s+/g, () => ws[wi++ % ws.length]);
  let ci = 0;
  return Array.from(replaced)
    .map((ch) => {
      const up = caseBits[ci++ % caseBits.length];
      const mapped = up ? ch.toUpperCase() : ch.toLowerCase();
      // Only apply mappings that keep lowercase equivalence (e.g. skip "ß" -> "SS").
      return mapped.toLowerCase() === ch.toLowerCase() ? mapped : ch;
    })
    .join("");
}

const arbPerturbation = fc.record({
  ws: fc.array(arbWhitespace, { minLength: 1, maxLength: 8 }),
  caseBits: fc.array(fc.boolean(), { minLength: 1, maxLength: 16 }),
});

/** Picks a code-point-aligned slice of `source`. */
function sliceByCodePoints(source: string, a: number, b: number): string {
  const cps = Array.from(source);
  if (cps.length === 0) return "";
  const start = Math.floor(a * cps.length);
  const end = Math.min(cps.length, start + 1 + Math.floor(b * cps.length));
  return cps.slice(start, end).join("");
}

const arbUnit = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

describe("seance evidence grounding", () => {
  // Feature: the-seance, Property 4: Derivable evidence is accepted
  // **Validates: Requirements 6.5, 6.6, 20.6**
  it("accepts Fact_Line text and long README/commit substrings under case and whitespace changes", () => {
    fc.assert(
      fc.property(
        arbEvidencePack,
        arbPerturbation,
        fc.integer({ min: 0, max: 6 }),
        arbUnit,
        arbUnit,
        (pack, p, pick, a, b) => {
          const d = deriveEvidence(pack);
          const candidates: string[] = d.factLines.map((fl) => fl.text);
          if (d.readmeText !== null) candidates.push(sliceByCodePoints(d.readmeText, a, b));
          for (const c of d.commitTexts) candidates.push(sliceByCodePoints(c, a, b));

          // Fact lines are always valid; substrings count only when >= 8 chars after trim/collapse.
          const usable = candidates.filter(
            (c, i) =>
              i < d.factLines.length ||
              Array.from(c.trim().replace(/\s+/g, " ")).length >= 8,
          );
          fc.pre(usable.length > 0);

          const source = usable[pick % usable.length];
          const evidence = perturb(source, p.ws, p.caseBits);
          expect(isGroundedEvidence(evidence, d)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
