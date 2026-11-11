import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { RepoFacts } from "@/lib/lifecycle";
import {
  deriveEvidence,
  isGroundedEvidence,
  normalizeForMatch,
  neutralizeMarkers,
  truncateUtf8,
  CLOSE_MARKER,
  OPEN_MARKER,
  type EvidencePack,
} from "@/lib/seance";
import { buildSeancePrompt, FORMAT_LOCK_RULE, IGNORE_INSTRUCTIONS_RULE } from "@/lib/ai";

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
  // README/commit quotes are capped at 80 characters (MAX_QUOTE_CHARS).
  const end = Math.min(cps.length, start + 1 + Math.floor(b * Math.min(80, cps.length)), start + 80);
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

// ---------------------------------------------------------------------------
// Property 5 helpers
// ---------------------------------------------------------------------------

const normLocal = normalizeForMatch;

/** True when the candidate is derivable by the documented rule (used only to discard accidental hits). */
function derivable(candidate: string, d: ReturnType<typeof deriveEvidence>): boolean {
  const e = normLocal(candidate);
  if (d.factLines.some((fl) => normLocal(fl.text) === e)) return true;
  const sources: string[] = [];
  if (d.readmeText !== null) sources.push(normLocal(d.readmeText));
  for (const c of d.commitTexts) sources.push(normLocal(c));
  return sources.some((s) => s.includes(e));
}

/** Hex nonce; combined with a fixed prefix it is a token no generated text should contain. */
const arbNonce = fc.stringMatching(/^[0-9a-f]{12}$/);

describe("seance evidence rejection", () => {
  // Feature: the-seance, Property 5: Non-derivable evidence is rejected
  // **Validates: Requirements 6.6, 6.7, 6.8, 20.6, 20.26**
  it("rejects evidence shorter than 8 characters after trimming", () => {
    fc.assert(
      fc.property(
        arbEvidencePack,
        fc.stringMatching(/^[A-Za-z0-9 :._-]{0,7}$/),
        arbWhitespace,
        arbWhitespace,
        (pack, short, padL, padR) => {
          fc.pre(normLocal(short).length < 8);
          const d = deriveEvidence(pack);
          expect(isGroundedEvidence(padL + short + padR, d)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  // Feature: the-seance, Property 5: Non-derivable evidence is rejected
  // **Validates: Requirements 6.6, 6.7, 20.6, 20.26**
  it("rejects long evidence that occurs nowhere in the Evidence_Text (unique token)", () => {
    fc.assert(
      fc.property(arbEvidencePack, arbNonce, arbNonce, (pack, n1, n2) => {
        const d = deriveEvidence(pack);
        const token = `zqxjv-${n1} unbacked ${n2}-vjxqz`;
        fc.pre(!derivable(token, d));
        fc.pre(!d.evidenceText.toLowerCase().includes(n1) && !d.evidenceText.toLowerCase().includes(n2));
        expect(isGroundedEvidence(token, d)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: the-seance, Property 5: Non-derivable evidence is rejected
  // **Validates: Requirements 6.6, 6.8, 20.6, 20.26**
  it("rejects a strict fragment of a Fact_Line that is not verbatim in the README or a commit", () => {
    fc.assert(
      fc.property(arbEvidencePack, fc.nat(), arbUnit, arbUnit, (pack, pick, a, b) => {
        const d = deriveEvidence(pack);
        const line = d.factLines[pick % d.factLines.length].text;
        const cps = Array.from(line);
        fc.pre(cps.length > 8);
        // Strict, code-point-aligned fragment of at least 8 characters.
        const len = 8 + Math.floor(a * (cps.length - 8)); // 8 .. cps.length - 1
        const start = Math.floor(b * (cps.length - len + 1));
        const fragment = cps.slice(start, start + len).join("");
        fc.pre(fragment.length >= 8 && Array.from(fragment).length < cps.length);
        // Discard fragments that happen to be derivable another way (e.g. equal to another line).
        fc.pre(!derivable(fragment, d));
        expect(isGroundedEvidence(fragment, d)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: the-seance, Property 5: Non-derivable evidence is rejected
  // **Validates: Requirements 6.6, 6.8, 20.6, 20.26**
  it("rejects a Fact_Line with one word changed", () => {
    fc.assert(
      fc.property(arbEvidencePack, fc.nat(), fc.nat(), arbNonce, (pack, pick, wordPick, n) => {
        const d = deriveEvidence(pack);
        const line = d.factLines[pick % d.factLines.length].text;
        const words = line.split(" ");
        const i = wordPick % words.length;
        const changed = words.map((w, idx) => (idx === i ? `zqxjv${n}` : w)).join(" ");
        fc.pre(!derivable(changed, d));
        expect(isGroundedEvidence(changed, d)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});

describe("seance evidence text", () => {
  // Feature: the-seance, Property 6: Evidence_Text is deterministic and well formed
  // **Validates: Requirements 3.8, 3.9, 3.11, 20.26**
  it("renders byte-identical text with ordered, gap-free labels and own-line Fact_Lines of 8 to 200 chars", () => {
    fc.assert(
      fc.property(arbEvidencePack, (pack) => {
        const d1 = deriveEvidence(pack);
        const d2 = deriveEvidence(pack);
        expect(d1.evidenceText).toBe(d2.evidenceText);
        expect(Buffer.from(d1.evidenceText, "utf8").equals(Buffer.from(d2.evidenceText, "utf8"))).toBe(true);

        // [F#] numbered 1..n, then [C#] numbered 1..m, in that order.
        const fLines = d1.factLines.filter((l) => l.label.startsWith("F"));
        const cLines = d1.factLines.filter((l) => l.label.startsWith("C"));
        expect(d1.factLines).toEqual([...fLines, ...cLines]);
        fLines.forEach((l, i) => expect(l.label).toBe(`F${i + 1}`));
        cLines.forEach((l, i) => expect(l.label).toBe(`C${i + 1}`));
        expect(cLines.length).toBe(d1.commitTexts.length);

        // Fact lines come first in the rendered text, each on its own line, then [R] when a README exists.
        const lines = d1.evidenceText.split("\n");
        d1.factLines.forEach((fl, i) => {
          expect(lines[i]).toBe(`[${fl.label}] ${fl.text}`);
          const len = Array.from(fl.text).length;
          expect(len).toBeGreaterThanOrEqual(8);
          expect(len).toBeLessThanOrEqual(200);
          expect(fl.text).not.toMatch(/[\r\n]/);
        });
        if (d1.readmeText !== null) {
          expect(lines[d1.factLines.length]).toBe("[R] README excerpt");
        } else {
          expect(lines.length).toBe(d1.factLines.length);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: README truncation
// ---------------------------------------------------------------------------

/** Well-formed text from 0 to 5000 code points; often over 8192 bytes, with multi-byte and astral characters. */
const arbLongText: fc.Arbitrary<string> = fc
  .array(arbCodePoint, { maxLength: 5000 })
  .map((cps) => cps.map((cp) => String.fromCodePoint(cp)).join(""));

const utf8 = new TextEncoder();
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function checkTruncation(text: string, maxBytes: number): void {
  const out = truncateUtf8(text, maxBytes);
  const outBytes = utf8.encode(out).length;

  // Bounded.
  expect(outBytes).toBeLessThanOrEqual(maxBytes);
  // Well-formed prefix of the input (code-point aligned, no lone surrogates).
  expect(text.startsWith(out)).toBe(true);
  expect(out.isWellFormed()).toBe(true);
  // Round-trips through UTF-8 unchanged, no replacement character introduced.
  expect(utf8Decoder.decode(utf8.encode(out))).toBe(out);
  // Longest such prefix.
  if (out.length === text.length) {
    expect(out).toBe(text);
  } else {
    const next = String.fromCodePoint(text.codePointAt(out.length)!);
    expect(outBytes + utf8.encode(next).length).toBeGreaterThan(maxBytes);
  }
  if (utf8.encode(text).length <= maxBytes) expect(out).toBe(text);
}

describe("seance README truncation", () => {
  // Feature: the-seance, Property 7: README truncation is bounded and boundary safe
  // **Validates: Requirements 3.5, 20.20**
  it("Property 7: README truncation is bounded and boundary safe", () => {
    fc.assert(
      fc.property(arbLongText, (text) => {
        checkTruncation(text, 8192);
      }),
      { numRuns: 200 },
    );
    // Small limits land the cut on every multi-byte boundary.
    fc.assert(
      fc.property(arbLongText, fc.integer({ min: 0, max: 40 }), (text, max) => {
        checkTruncation(text, max);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Untrusted text stays inside delimiters
// ---------------------------------------------------------------------------

const NESTED = "<<<EVID<<<EVIDENCE>>>ENCE>>>";
const arbMarkerNoise: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(NESTED, ...MARKER_FRAGMENTS, "", " ", "\n"), { maxLength: 4 })
  .map((a) => a.join(""));

/** Unique token wrapped in marker noise; the token sits first so line clipping cannot drop it. */
function wrapToken(token: string, before: string, after: string): string {
  return `${token}${before}${after}`;
}

const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe("seance prompt delimiters", () => {
  // Feature: the-seance, Property 8: Untrusted text stays inside delimiters
  // **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 20.7**
  it("keeps README, commits and free-text facts inside exactly three evidence blocks", () => {
    fc.assert(
      fc.property(
        arbEvidencePack,
        fc.array(fc.stringMatching(/^[0-9a-f]{12}$/), { minLength: 12, maxLength: 12 }),
        fc.array(arbMarkerNoise, { minLength: 12, maxLength: 12 }),
        (basePack, hex, noise) => {
          const tok = (name: string, i: number) => `zq${name}${hex[i]}x`;
          const tReadme = tok("readme", 0);
          const tOwner = tok("owner", 1);
          const tDesc = tok("desc", 2);
          const tLang = tok("lang", 3);
          const tLast = tok("last", 4);
          const tCommits = [5, 6, 7].map((i) => tok(`commit${i}`, i));

          const pack: EvidencePack = {
            facts: {
              ...basePack.facts,
              description: wrapToken(tDesc, noise[0], noise[1]),
              primaryLanguage: wrapToken(tLang, noise[2], noise[3]),
              lastCommitMessage: wrapToken(tLast, noise[4], noise[5]),
            },
            readme: truncateUtf8(`${noise[6]}${NESTED}${tReadme}${noise[7]}${NESTED}`),
            commits: tCommits.map((t, i) => wrapToken(t, noise[8 + i], NESTED)),
          };
          const owner = wrapToken(tOwner, noise[11], NESTED);

          const derived = deriveEvidence(pack);
          const { system, user } = buildSeancePrompt(owner, derived);

          // Exactly one open and one close marker per block (3 blocks).
          expect(countOf(user, OPEN_MARKER)).toBe(3);
          expect(countOf(user, CLOSE_MARKER)).toBe(3);

          // Markers alternate open, close, open, close, open, close.
          const order = [...user.matchAll(/<<<EVIDENCE>>>|<<<END_EVIDENCE>>>/g)].map((m) => m[0]);
          expect(order).toEqual([OPEN_MARKER, CLOSE_MARKER, OPEN_MARKER, CLOSE_MARKER, OPEN_MARKER, CLOSE_MARKER]);

          // Removing block contents leaves none of the untrusted text.
          const outside = user.replace(/<<<EVIDENCE>>>[\s\S]*?<<<END_EVIDENCE>>>/g, "");
          for (const t of [tReadme, tOwner, tDesc, tLang, tLast, ...tCommits]) {
            expect(outside).not.toContain(t);
          }
          // Marker fragments from untrusted text do not survive outside blocks either.
          expect(outside).not.toContain(NESTED);

          // The README token is present inside the README block (the third one).
          const blocks = [...user.matchAll(/<<<EVIDENCE>>>([\s\S]*?)<<<END_EVIDENCE>>>/g)].map((m) => m[1]);
          expect(blocks).toHaveLength(3);
          expect(blocks[2]).toContain(tReadme);
          expect(blocks[1]).toContain(tCommits[0]);

          // Rules live in the system message.
          expect(system).toContain(IGNORE_INSTRUCTIONS_RULE);
          expect(system).toContain(FORMAT_LOCK_RULE);
        },
      ),
      { numRuns: 200 },
    );
  });

  // Feature: the-seance, Property 8: Untrusted text stays inside delimiters
  // **Validates: Requirements 6.3, 20.7**
  it("neutralizeMarkers leaves no marker, including nested ones", () => {
    fc.assert(
      fc.property(arbMarkerNoise, arbSeanceText, (noise, text) => {
        const out = neutralizeMarkers(`${noise}${NESTED}${text}${noise}`);
        expect(out).not.toContain(OPEN_MARKER);
        expect(out).not.toContain(CLOSE_MARKER);
      }),
      { numRuns: 200 },
    );
  });
});
