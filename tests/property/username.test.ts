/**
 * Feature: repo-lifecycle-classification, Property 1: Username validation matches the specification
 *
 * Validator half of Property 1. `isValidUsername` must agree with an
 * independent reference predicate: true iff the string has length 1–39,
 * contains only ASCII letters, digits, and hyphens, and neither starts nor
 * ends with a hyphen.
 *
 * The loader half (zero transport/cache calls for invalid input) is covered by
 * task 9.2 and is intentionally NOT included here.
 *
 * Validates: Requirements 1.4, 8.8, 9.1, 9.5
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { isValidUsername } from "@/lib/username";
import { arbUsername } from "./arbitraries";

/**
 * Independent reference predicate derived straight from the specification.
 * Deliberately does NOT reuse the production regex: it checks length, the
 * character set, and the hyphen edges with primitive operations so a defect in
 * the production pattern cannot hide behind a shared implementation.
 */
function referenceIsValidUsername(input: string): boolean {
  // Length 1–39.
  if (input.length < 1 || input.length > 39) {
    return false;
  }
  // Only ASCII letters, digits, and hyphens.
  for (const ch of input) {
    const isLower = ch >= "a" && ch <= "z";
    const isUpper = ch >= "A" && ch <= "Z";
    const isDigit = ch >= "0" && ch <= "9";
    const isHyphen = ch === "-";
    if (!isLower && !isUpper && !isDigit && !isHyphen) {
      return false;
    }
  }
  // Neither starts nor ends with a hyphen.
  if (input[0] === "-" || input[input.length - 1] === "-") {
    return false;
  }
  return true;
}

describe("Property 1: Username validation matches the specification (validator)", () => {
  it("isValidUsername agrees with the independent reference predicate", () => {
    fc.assert(
      fc.property(arbUsername, (candidate) => {
        return isValidUsername(candidate) === referenceIsValidUsername(candidate);
      }),
      { numRuns: 100 },
    );
  });
});
