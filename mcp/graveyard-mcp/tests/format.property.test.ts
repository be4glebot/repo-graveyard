import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { daysQuiet, decayLabel, findRepo } from "../src/format";
import { STATES, type GraveyardPayload, type RepoEntry, type State } from "../src/payload";

const DAY_MS = 86_400_000;
const LABELS = new Set([
  "healthy",
  "fading",
  "flickering",
  "about to turn",
  "fresh",
  "rotting",
  "decayed",
  "skeletal",
  "ancient",
  "none",
]);

const state = fc.constantFrom<State>(...STATES);
const nowMs = fc.integer({ min: 0, max: 4_000_000_000_000 });
const validPushed = fc
  .date({ min: new Date(0), max: new Date(4_100_000_000_000), noInvalidDate: true })
  .map((d) => d.toISOString());
const garbage = fc.constantFrom("", "garbage", "not a date", "xyz-", "yesterday", "NaN");
const pushedAt = fc.oneof(validPushed, garbage, fc.constant(null));
const decay = fc.oneof(
  fc.constant(null),
  fc.integer({ min: -1000, max: 1000 }),
  fc.double({ noNaN: false }),
);

// Feature: graveyard-mcp, Property 9: Days quiet and decay label are total and bounded
describe("Property 9: days quiet and decay label are total and bounded", () => {
  it("daysQuiet is null for null/unparseable and a clamped floor otherwise", () => {
    fc.assert(
      fc.property(pushedAt, nowMs, (p, now) => {
        const out = daysQuiet(p, now);
        if (p === null || Number.isNaN(Date.parse(p))) {
          expect(out).toBeNull();
          return;
        }
        expect(out).not.toBeNull();
        expect(Number.isInteger(out)).toBe(true);
        expect(out).toBeGreaterThanOrEqual(0);
        expect(out).toBe(Math.max(0, Math.floor((now - Date.parse(p)) / DAY_MS)));
      }),
      { numRuns: 200 },
    );
  });

  it("daysQuiet is 0 for future pushes and null for non-finite now", () => {
    expect(daysQuiet("2999-01-01T00:00:00Z", 0)).toBe(0);
    expect(daysQuiet("2020-01-01T00:00:00Z", Number.NaN)).toBeNull();
    expect(daysQuiet("2020-01-01T00:00:00Z", Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("decayLabel never throws and returns a label from the fixed set", () => {
    fc.assert(
      fc.property(state, decay, (s, d) => {
        const label = decayLabel(s, d);
        expect(label.length).toBeGreaterThan(0);
        expect(LABELS.has(label)).toBe(true);
        const inRange =
          typeof d === "number" &&
          Number.isInteger(d) &&
          ((s === "ghost" && d >= 0 && d <= 3) || (s === "zombie" && d >= 0 && d <= 4));
        if (!inRange) expect(label).toBe("none");
        else expect(label).not.toBe("none");
      }),
      { numRuns: 200 },
    );
  });
});

// Reference lower-casing: only A-Z change.
const refLower = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());

// Mix of ASCII letters of both cases and non-ASCII letters with case pairs.
const nameChar = fc.constantFrom(..."abcAB-_.Zz09".split(""), "é", "É", "ä", "Ä", "ß", "\u0130", "\u0131", "\u212A");
const name = fc.string({ unit: nameChar, minLength: 1, maxLength: 8 });

const entry = (n: string): RepoEntry => ({
  name: n,
  state: "ghost",
  decay: 0,
  pushedAt: null,
  stars: 0,
  html_url: "https://example.test/x",
});

const payload = (names: string[]): GraveyardPayload =>
  ({
    owner: "o",
    truncated: false,
    counts: { ghost: names.length, risen: 0, zombie: 0, tombstone: 0, coffin: 0, total: names.length },
    repos: names.map(entry),
  }) as unknown as GraveyardPayload;

const swapAsciiCase = (s: string) =>
  s.replace(/[a-zA-Z]/g, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));

// Feature: graveyard-mcp, Property 10: Repo lookup is ASCII case-insensitive
describe("Property 10: repo lookup is ASCII case-insensitive", () => {
  it("matches iff some name equals the query after ASCII lower-casing, first in order", () => {
    fc.assert(
      fc.property(fc.array(name, { maxLength: 8 }), name, (names, query) => {
        const found = findRepo(payload(names), query);
        const expected = names.find((n) => refLower(n) === refLower(query));
        expect(found?.name).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it("finds a name through any ASCII case swap of it", () => {
    fc.assert(
      fc.property(fc.array(name, { minLength: 1, maxLength: 8 }), fc.nat(), (names, i) => {
        const target = names[i % names.length]!;
        const found = findRepo(payload(names), swapAsciiCase(target));
        expect(found).toBeDefined();
        expect(refLower(found!.name)).toBe(refLower(target));
        expect(names.indexOf(found!.name)).toBe(names.findIndex((n) => refLower(n) === refLower(target)));
      }),
      { numRuns: 200 },
    );
  });

  it("does not match names that differ only by non-ASCII case folding", () => {
    for (const [a, b] of [["Ä", "ä"], ["É", "é"], ["\u0130", "i"], ["\u212A", "k"]] as const) {
      expect(findRepo(payload([`x${a}`]), `x${b}`)).toBeUndefined();
    }
  });
});
