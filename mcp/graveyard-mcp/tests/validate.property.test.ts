import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isValidOwner, isValidRepo } from "../src/validate";

const isAlnum = (c: string) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9");

// Independent reference predicates (no regex).
function refOwner(s: string): boolean {
  if (s.length < 1 || s.length > 39) return false;
  if (s[0] === "-" || s[s.length - 1] === "-") return false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "-") {
      if (s[i - 1] === "-") return false;
    } else if (!isAlnum(c)) return false;
  }
  return true;
}

function refRepo(s: string): boolean {
  if (s.length < 1 || s.length > 100) return false;
  if (s === "." || s === "..") return false;
  for (const c of s) if (!isAlnum(c) && c !== "." && c !== "_" && c !== "-") return false;
  return true;
}

const alnum = fc.constantFrom(..."abcxyzABCXYZ0189".split(""));
const ownerChars = fc.constantFrom(..."abcxyzABCXYZ0189-".split(""));
const repoChars = fc.constantFrom(..."abcxyzABCXYZ0189-._".split(""));
const fill = (n: number) => fc.array(alnum, { minLength: n, maxLength: n }).map((a) => a.join(""));

const hostile = fc.constantFrom(..."/?#% \t\n\r\0\x01\x7f\u00e9\u4e2d\u{1F47B}\u00a0\u200b\\:@".split(""));

const nearMisses = fc.oneof(
  fc.constantFrom("", ".", "..", "-", "--", "a-", "-a", "a--b", "a-b", "...", "a.b", "_", "a_b", ".a", "a/b", "a?b", "a#b", "a%20b"),
  fc.tuple(fc.constantFrom(39, 40, 100, 101), alnum).map(([n, c]) => c.repeat(n)),
  fc.tuple(fc.constantFrom(37, 38, 98, 99), alnum).map(([n, c]) => `-${c.repeat(n)}`),
  fc.tuple(fc.constantFrom(37, 38, 98, 99), alnum).map(([n, c]) => `${c.repeat(n)}-`),
  fc.tuple(fill(1), fill(1)).map(([a, b]) => `${a}--${b}`),
);

const candidates = fc.oneof(
  fc.array(ownerChars, { maxLength: 45 }).map((a) => a.join("")),
  fc.array(repoChars, { maxLength: 105 }).map((a) => a.join("")),
  nearMisses,
  fc.tuple(fc.array(alnum, { maxLength: 10 }), hostile, fc.array(alnum, { maxLength: 10 })).map(([a, h, b]) => a.join("") + h + b.join("")),
  fc.string({ maxLength: 120 }),
  fc.string({ unit: "grapheme", maxLength: 50 }),
  fc.string({ unit: "binary", maxLength: 50 }),
);

describe("name validator", () => {
  // Feature: graveyard-mcp, Property 7: Name validator accepts exactly the valid names and blocks I/O on rejection
  // **Validates: Requirements 4.3, 4.4, 4.5**
  it("isValidOwner accepts iff the reference owner predicate accepts", () => {
    fc.assert(
      fc.property(candidates, (s) => {
        expect(isValidOwner(s)).toBe(refOwner(s));
      }),
      { numRuns: 300 },
    );
  });

  // Feature: graveyard-mcp, Property 7: Name validator accepts exactly the valid names and blocks I/O on rejection
  // **Validates: Requirements 4.3, 4.4, 4.5**
  it("isValidRepo accepts iff the reference repo predicate accepts", () => {
    fc.assert(
      fc.property(candidates, (s) => {
        expect(isValidRepo(s)).toBe(refRepo(s));
      }),
      { numRuns: 300 },
    );
  });

  it("rejects non-string values", () => {
    fc.assert(
      fc.property(fc.anything().filter((v) => typeof v !== "string"), (v) => {
        expect(isValidOwner(v)).toBe(false);
        expect(isValidRepo(v)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
