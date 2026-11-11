import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isValidUsername,
  validateUsernameInput,
  USERNAME_EMPTY_MESSAGE,
  USERNAME_INVALID_MESSAGE,
} from "@/lib/username";

// Feature: landing-mobile-states, Property 1: Username validation is total and consistent
// **Validates: Requirements 2.2, 2.3, 2.4**

const validBody = fc
  .stringMatching(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/)
  .filter((s) => s.length <= 39);
const padding = fc.stringMatching(/^[ \t\n]{0,4}$/);

describe("Property 1: Username validation is total and consistent", () => {
  it("ok iff trimmed input is non-empty and valid; messages and round-trip hold", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ maxLength: 60 }),
          fc.string({ unit: "binary", maxLength: 60 }),
          fc.tuple(padding, validBody, padding).map(([a, b, c]) => a + b + c),
        ),
        (raw) => {
          const trimmed = raw.trim();
          const result = validateUsernameInput(raw);
          const expectedOk = trimmed.length > 0 && isValidUsername(trimmed);
          expect(result.ok).toBe(expectedOk);
          if (result.ok) {
            expect(result.username).toBe(trimmed);
            expect(decodeURIComponent(encodeURIComponent(result.username))).toBe(
              result.username,
            );
          } else {
            expect(result.message).toBe(
              trimmed.length === 0
                ? USERNAME_EMPTY_MESSAGE
                : USERNAME_INVALID_MESSAGE,
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("exact messages match the spec text", () => {
    expect(USERNAME_EMPTY_MESSAGE).toBe("A username is required");
    expect(USERNAME_INVALID_MESSAGE).toBe(
      "That doesn't look like a valid GitHub username",
    );
  });
});
