import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  VERDICTS,
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
  detail: sentences(1, 3).filter((s) => s.length <= 300),
  evidence,
});

const validResult: fc.Arbitrary<SeanceResult> = fc.record({
  voice: sentences(2, 4),
  causeOfDeath: sentence,
  unfinishedBusiness: fc.array(item, { minLength: 2, maxLength: 5 }),
  verdict: fc.constantFrom(...VERDICTS),
  verdictReason: sentences(1, 3).filter((s) => s.length <= 300),
});

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
const topMax = { voice: 600, causeOfDeath: 200, verdictReason: 300 } as const;
const itemKeys = ["title", "detail", "evidence"] as const;
const itemMax = { title: 80, detail: 300, evidence: 200 } as const;

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
    fc.constantFrom(0, 1, 6),
    badVerdict,
    blank,
    fc.stringMatching(/^[a-z]{1,8}$/),
    sentences(5, 5),
    sentences(2, 2),
    fc.constantFrom("a", "b"), // spare entropy
  )
  .chain(([tk, ik, idx, badLen, bv, bl, extra, five, two]) =>
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
      { name: "array length 2..5 kept", accept: true, apply: (r) => r },
      {
        name: `array length ${badLen}`,
        accept: false,
        apply: (r) => ({
          ...r,
          unfinishedBusiness:
            badLen === 6
              ? [...r.unfinishedBusiness, ...r.unfinishedBusiness, ...r.unfinishedBusiness].slice(0, 6)
              : r.unfinishedBusiness.slice(0, badLen),
        }),
      },
      { name: "bad verdict", accept: false, apply: (r) => ({ ...r, verdict: bv }) },
      { name: "verdict deleted", accept: false, apply: (r) => { const c: Record<string, unknown> = { ...r }; delete c.verdict; return c; } },
      { name: "extra top-level key", accept: false, apply: (r) => ({ ...r, [extra + "x"]: "v" }) },
      { name: "extra item key", accept: false, apply: (r) => withItem(r, idx % r.unfinishedBusiness.length, { [extra + "x"]: "v" } as never) },
      { name: "voice 1 sentence", accept: false, apply: (r) => ({ ...r, voice: r.voice.split(/(?<=[.!?])\s/)[0] }) },
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
