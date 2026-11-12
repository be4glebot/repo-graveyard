import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { isValidRepoName, parseBadgeStyle } from "@/lib/badge";

const NUM_RUNS = 100;

const REPO_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";

// Independent oracle for the documented pattern (not the implementation's regex).
function oracleValidRepoName(s: string): boolean {
  if (s.length < 1 || s.length > 100) return false;
  for (const ch of s) if (!REPO_CHARS.includes(ch)) return false;
  return true;
}

const validChar = fc.constantFrom(...REPO_CHARS.split(""));
const invalidChar = fc.constantFrom(
  "/", "\\", " ", "?", "#", "%", "&", "'", '"', "<", ">", "(", ")", "\n", "\r",
  "\t", "\u0000", "\u00e9", "\u{1F47B}", "\uD800", "\uFF21", "\u00B7", "\u2026",
);

describe("graveyard-badges validation properties", () => {
  // Feature: graveyard-badges, Property 12: Style parsing is exact
  // **Validates: Requirements 3.1, 3.3**
  describe("Property 12: Style parsing is exact", () => {
    it("is flat iff the input is exactly 'flat'", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string({ maxLength: 50 }),
            fc.string({ unit: "binary", maxLength: 50 }),
            fc.constantFrom("flat", "FLAT", "Flat", "haunted", "", " flat", "flat ", "flat\n"),
            fc.string({ minLength: 33, maxLength: 200 }),
            fc.constantFrom("constructor", "__proto__", "toString"),
          ),
          (x) => {
            expect(parseBadgeStyle(x)).toBe(x === "flat" ? "flat" : "haunted");
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it("maps named edge cases to haunted", () => {
      for (const x of ["", "FLAT", "haunted", "x".repeat(33), null, undefined]) {
        expect(parseBadgeStyle(x)).toBe("haunted");
      }
      expect(parseBadgeStyle("flat")).toBe("flat");
    });
  });

  // Feature: graveyard-badges, Property 13: Repo-name validation matches the pattern
  // **Validates: Requirements 5.5, 5.6**
  // (The loader-not-called half of this property is asserted in task 6.2.)
  describe("Property 13: Repo-name validation matches the pattern", () => {
    it("agrees with the pattern oracle for arbitrary strings", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ maxLength: 120 }),
            fc.string({ unit: "binary", maxLength: 120 }),
            fc.array(fc.oneof(validChar, invalidChar), { maxLength: 110 }).map((a) => a.join("")),
          ),
          (s) => {
            expect(isValidRepoName(s)).toBe(oracleValidRepoName(s));
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it("accepts every string of 1 to 100 valid characters", () => {
      fc.assert(
        fc.property(
          fc.array(validChar, { minLength: 1, maxLength: 100 }).map((a) => a.join("")),
          (s) => {
            expect(isValidRepoName(s)).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it("rejects a valid string with one invalid character inserted", () => {
      fc.assert(
        fc.property(
          fc.array(validChar, { minLength: 0, maxLength: 99 }).map((a) => a.join("")),
          invalidChar,
          fc.nat(),
          (base, bad, pos) => {
            const i = pos % (base.length + 1);
            expect(isValidRepoName(base.slice(0, i) + bad + base.slice(i))).toBe(false);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it("rejects the empty string and anything over 100 characters", () => {
      expect(isValidRepoName("")).toBe(false);
      expect(isValidRepoName("a".repeat(100))).toBe(true);
      expect(isValidRepoName("a".repeat(101))).toBe(false);
      fc.assert(
        fc.property(
          fc.array(validChar, { minLength: 101, maxLength: 300 }).map((a) => a.join("")),
          (s) => {
            expect(isValidRepoName(s)).toBe(false);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
