import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  VERDICTS,
  hasNextStepLanguage,
  seanceResultSchema,
  type SeanceResult,
} from "@/lib/seance-schema";

// Letters only, so no generated prose can contain a digit, date or day count.
const word = fc.stringMatching(/^[a-z]{1,10}$/);

/** One sentence of 1..6 words ending in a single terminator. */
const sentence = fc
  .tuple(
    fc.array(word, { minLength: 1, maxLength: 6 }),
    fc.constantFrom(".", "!", "?"),
  )
  .map(([words, end]) => words.join(" ") + end);

const sentences = (min: number, max: number) =>
  fc
    .array(sentence, { minLength: min, maxLength: max })
    .map((list) => list.join(" "));

// Evidence may contain digits (it is exempt from the date rule), 8..200 chars.
const evidence = fc
  .tuple(
    fc.array(fc.stringMatching(/^[A-Za-z0-9:]{1,12}$/), {
      minLength: 2,
      maxLength: 10,
    }),
  )
  .map(([parts]) => parts.join(" "))
  .filter((s) => s.length >= 8 && s.length <= 200);

const item = fc.record({
  title: fc
    .array(word, { minLength: 1, maxLength: 8 })
    .map((w) => w.join(" ")),
  detail: sentence, // exactly one sentence, well under 140 characters
  evidence,
});

const validResult: fc.Arbitrary<SeanceResult> = fc.record({
  voice: sentences(2, 3),
  causeOfDeath: sentence,
  unfinishedBusiness: fc.array(item, { minLength: 2, maxLength: 4 }),
  verdict: fc.constantFrom(...VERDICTS),
  verdictReason: sentences(1, 3).filter((s) => s.length <= 300),
}).filter((r) => r.verdict === "revive" || !hasNextStepLanguage(r.verdictReason));

describe("seance schema property tests", () => {
  // Feature: the-seance, Property 1: Schema round trip
  // **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 20.17**
  it("round-trips any valid result through JSON and the schema", () => {
    fc.assert(
      fc.property(validResult, (result) => {
        const parsed = seanceResultSchema.safeParse(
          JSON.parse(JSON.stringify(result)),
        );
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data).toEqual(result);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 helpers
// ---------------------------------------------------------------------------

/** Lengthen `s` to exactly `n` characters by prefixing letters to its first word. */
const padTo = (s: string, n: number) => "a".repeat(Math.max(0, n - s.length)) + s;

type Mutation = { name: string; accept: boolean; apply: (r: SeanceResult) => unknown };

const withItem = (r: SeanceResult, i: number, patch: Partial<SeanceResult["unfinishedBusiness"][number]>) => ({
  ...r,
  unfinishedBusiness: r.unfinishedBusiness.map((it, j) => (j === i ? { ...it, ...patch } : it)),
});

const topStringKeys = ["voice", "causeOfDeath", "verdictReason"] as const;
const topMax = { voice: 320, causeOfDeath: 200, verdictReason: 300 } as const;
const itemKeys = ["title", "detail", "evidence"] as const;
const itemMax = { title: 80, detail: 140, evidence: 200 } as const;

const blank = fc.integer({ min: 1, max: 12 }).map((n) => " \t\n".repeat(n).slice(0, Math.max(n, 8)));

const badVerdict = fc.oneof(
  fc.constantFrom("Revive", "FINISH", "Seal", "REVIVE", " revive", "seal ", "", "reviv", "sealed"),
  fc.stringMatching(/^[A-Za-z]{0,12}$/).filter((s) => !(VERDICTS as readonly string[]).includes(s)),
);

const mutation: fc.Arbitrary<Mutation> = fc
  .tuple(
    fc.constantFrom(...topStringKeys),
    fc.constantFrom(...itemKeys),
    fc.nat(),
    fc.constantFrom(0, 1, 5),
    badVerdict,
    blank,
    fc.stringMatching(/^[a-z]{1,8}$/),
    sentences(5, 5),
    sentences(2, 2),
    sentences(4, 4),
  )
  .chain(([, , idx, badLen, bv, bl, extra, five, two, four]) =>
    fc.constantFrom<Mutation>(
      ...topStringKeys.flatMap((k) => [
        { name: `${k} at max`, accept: true, apply: (r: SeanceResult) => ({ ...r, [k]: padTo(r[k], topMax[k]) }) },
        { name: `${k} at max+1`, accept: false, apply: (r: SeanceResult) => ({ ...r, [k]: padTo(r[k], topMax[k] + 1) }) },
        { name: `${k} blank`, accept: false, apply: (r: SeanceResult) => ({ ...r, [k]: bl }) },
        { name: `${k} deleted`, accept: false, apply: (r: SeanceResult) => { const c: Record<string, unknown> = { ...r }; delete c[k]; return c; } },
      ]),
      ...itemKeys.flatMap((k) => [
        { name: `item ${k} at max`, accept: true, apply: (r: SeanceResult) => withItem(r, idx % r.unfinishedBusiness.length, { [k]: padTo(r.unfinishedBusiness[idx % r.unfinishedBusiness.length][k], itemMax[k]) }) },
        { name: `item ${k} at max+1`, accept: false, apply: (r: SeanceResult) => withItem(r, idx % r.unfinishedBusiness.length, { [k]: padTo(r.unfinishedBusiness[idx % r.unfinishedBusiness.length][k], itemMax[k] + 1) }) },
        { name: `item ${k} blank`, accept: false, apply: (r: SeanceResult) => withItem(r, idx % r.unfinishedBusiness.length, { [k]: bl }) },
        { name: `item ${k} deleted`, accept: false, apply: (r: SeanceResult) => ({ ...r, unfinishedBusiness: r.unfinishedBusiness.map((it, j) => { if (j !== idx % r.unfinishedBusiness.length) return it; const c: Record<string, unknown> = { ...it }; delete c[k]; return c; }) }) },
      ]),
      { name: "array length 2..4 kept", accept: true, apply: (r) => r },
      {
        name: `array length ${badLen}`,
        accept: badLen === 1, // the ledger minimum is 1 (repair-over-reject)
        apply: (r) => ({
          ...r,
          unfinishedBusiness:
            badLen === 5
              ? [...r.unfinishedBusiness, ...r.unfinishedBusiness, ...r.unfinishedBusiness].slice(0, 5)
              : r.unfinishedBusiness.slice(0, badLen),
        }),
      },
      { name: "bad verdict", accept: false, apply: (r) => ({ ...r, verdict: bv }) },
      { name: "verdict deleted", accept: false, apply: (r) => { const c: Record<string, unknown> = { ...r }; delete c.verdict; return c; } },
      { name: "extra top-level key", accept: false, apply: (r) => ({ ...r, [extra + "x"]: "v" }) },
      { name: "extra item key", accept: false, apply: (r) => withItem(r, idx % r.unfinishedBusiness.length, { [extra + "x"]: "v" } as never) },
      { name: "voice 1 sentence", accept: false, apply: (r) => ({ ...r, voice: r.voice.split(/(?<=[.!?])\s/)[0] }) },
      { name: "voice 4 sentences", accept: false, apply: (r) => ({ ...r, voice: four }) },
      { name: "voice 5 sentences", accept: false, apply: (r) => ({ ...r, voice: five }) },
      { name: "causeOfDeath 2 sentences", accept: false, apply: (r) => ({ ...r, causeOfDeath: two }) },
    ),
  );

describe("seance schema bounds and strictness", () => {
  // Feature: the-seance, Property 2: Schema bounds and strictness are exact
  // **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**
  it("accepts exactly the mutations that stay within bounds", () => {
    fc.assert(
      fc.property(validResult, mutation, (result, m) => {
        const outcome = seanceResultSchema.safeParse(m.apply(result));
        expect({ name: m.name, success: outcome.success }).toEqual({
          name: m.name,
          success: m.accept,
        });
      }),
      { numRuns: 300 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3 helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December", "Jan", "Feb", "Mar", "Apr",
  "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const month = fc
  .tuple(fc.constantFrom(...MONTH_NAMES), fc.boolean())
  .map(([m, lower]) => (lower ? m.toLowerCase() : m));
const pad2 = (n: number) => String(n).padStart(2, "0");

const dateTemplate: fc.Arbitrary<string> = fc.oneof(
  // YYYY-MM-DD
  fc
    .tuple(fc.integer({ min: 1000, max: 9999 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }))
    .map(([y, m, d]) => `${y}-${pad2(m)}-${pad2(d)}`),
  // M/D/YYYY
  fc
    .tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }), fc.integer({ min: 1000, max: 9999 }))
    .map(([m, d, y]) => `${m}/${d}/${y}`),
  // month then day, and day then month
  fc.tuple(month, fc.integer({ min: 1, max: 31 })).map(([m, d]) => `${m} ${d}`),
  fc.tuple(month, fc.integer({ min: 1, max: 31 })).map(([m, d]) => `${d} ${m}`),
  // month then 4-digit year
  fc.tuple(month, fc.integer({ min: 1000, max: 9999 })).map(([m, y]) => `${m} ${y}`),
  // number followed by day / days
  fc
    .tuple(fc.nat({ max: 9999 }), fc.constantFrom("day", "days", " day", " days"))
    .map(([n, unit]) => `${n}${unit.startsWith(" ") ? unit : ` ${unit}`}`),
);

const ordinaryWord = fc.stringMatching(/^[a-z]{1,10}$/).filter((w) => !/^(?:day|days)$/.test(w));
const ambiguousWord = fc.constantFrom("may", "march", "august", "May", "March", "August");

/** Sentence of letters-only words with an ambiguous month word in it, no digits. */
const ambiguousSentence = fc
  .tuple(
    fc.array(ordinaryWord, { minLength: 0, maxLength: 3 }),
    ambiguousWord,
    fc.array(ordinaryWord, { minLength: 1, maxLength: 3 }),
    fc.constantFrom(".", "!", "?"),
  )
  .map(([pre, amb, post, end]) => [...pre, amb, ...post].join(" ") + end);

type TopKey = "voice" | "causeOfDeath" | "verdictReason";
type ItemKey = "title" | "detail";
const dateTargets: { label: string; max: number; get: (r: SeanceResult, i: number) => string; set: (r: SeanceResult, i: number, v: string) => SeanceResult }[] = [
  ...(["voice", "causeOfDeath", "verdictReason"] as TopKey[]).map((k) => ({
    label: k,
    max: topMax[k],
    get: (r: SeanceResult) => r[k],
    set: (r: SeanceResult, _i: number, v: string) => ({ ...r, [k]: v }),
  })),
  ...(["title", "detail"] as ItemKey[]).map((k) => ({
    label: `item ${k}`,
    max: itemMax[k],
    get: (r: SeanceResult, i: number) => r.unfinishedBusiness[i][k],
    set: (r: SeanceResult, i: number, v: string) => withItem(r, i, { [k]: v }) as SeanceResult,
  })),
];

describe("seance schema date and day-count detection", () => {
  // Feature: the-seance, Property 3: Date and day-count detection
  // **Validates: Requirements 5.6, 5.7**
  it("rejects date templates in prose, accepts them in evidence, and accepts bare month words", () => {
    fc.assert(
      fc.property(
        validResult,
        dateTemplate,
        fc.constantFrom(...dateTargets),
        fc.nat(),
        fc.array(ambiguousSentence, { minLength: 2, maxLength: 3 }),
        (result, tpl, target, idxSeed, ambiguous) => {
          const idx = idxSeed % result.unfinishedBusiness.length;
          fc.pre(seanceResultSchema.safeParse(result).success);

          // Prose carrying a date template is rejected.
          const polluted = `${tpl} ${target.get(result, idx)}`;
          fc.pre(polluted.length <= target.max); // reject for the date, not the length
          const bad = target.set(result, idx, polluted);
          expect(seanceResultSchema.safeParse(bad).success).toBe(false);

          // The same template in an evidence string is fine.
          const ev = withItem(result, idx, { evidence: `${tpl} ref` }) as SeanceResult;
          expect(seanceResultSchema.safeParse(ev).success).toBe(true);

          // Ordinary sentences using may / march / august with no number pass.
          const voice = ambiguous.join(" ");
          fc.pre(voice.length <= 600 && ambiguous.length >= 2);
          expect(seanceResultSchema.safeParse({ ...result, voice }).success).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
