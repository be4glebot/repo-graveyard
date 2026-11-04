/**
 * Feature: repo-lifecycle-classification, Property 4: Cache keys are case-insensitive
 *
 * For any valid username and any recasing of it, the two key builders each
 * produce a key equal to their respective prefix plus the LOWERCASED username,
 * and are stable across recasing (every recasing of the same username maps to
 * the same key). This single property covers BOTH halves:
 *
 *   - `graveyardCacheKey(u)` === "graveyard:" + u.toLowerCase()         (2.1)
 *   - `overridesKey(u)`      === "repo-graveyard-overrides:" + u.toLowerCase()  (6.1)
 *
 * Validates: Requirements 2.1, 6.1
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { graveyardCacheKey } from "@/lib/cache";
import { overridesKey } from "@/lib/overrides";
import { isValidUsername } from "@/lib/username";
import { arbUsername } from "./arbitraries";

const GRAVEYARD_PREFIX = "graveyard:";
const OVERRIDES_PREFIX = "repo-graveyard-overrides:";

/**
 * Deterministically recases every character of `username` using a boolean per
 * character: `true` forces upper case, `false` forces lower case. Characters
 * with no case distinction (digits, hyphens) are unaffected either way, which
 * is exactly what we want — the key must stay stable regardless.
 */
function recase(username: string, uppers: readonly boolean[]): string {
  let out = "";
  for (let i = 0; i < username.length; i += 1) {
    const ch = username[i];
    out += uppers[i] ? ch.toUpperCase() : ch.toLowerCase();
  }
  return out;
}

describe("Property 4: Cache keys are case-insensitive", () => {
  it("graveyardCacheKey and overridesKey equal their prefix + lowercased username, stable across recasing", () => {
    fc.assert(
      fc.property(
        // Only genuine usernames matter for the key contract; filter the shared
        // generator down to valid, non-empty names.
        arbUsername.filter((u) => u.length > 0 && isValidUsername(u)),
        // One upper/lower decision per character, so we can build an arbitrary
        // recasing of the generated username.
        fc.array(fc.boolean(), { minLength: 0, maxLength: 40 }),
        (username, caseFlags) => {
          const lowered = username.toLowerCase();

          // A recasing of the SAME username (may differ only in letter case).
          const recased = recase(username, caseFlags);

          // Each builder equals prefix + lowercased username, for the original
          // and for any recasing.
          const graveyardOk =
            graveyardCacheKey(username) === GRAVEYARD_PREFIX + lowered &&
            graveyardCacheKey(recased) === GRAVEYARD_PREFIX + lowered;

          const overridesOk =
            overridesKey(username) === OVERRIDES_PREFIX + lowered &&
            overridesKey(recased) === OVERRIDES_PREFIX + lowered;

          // Stability across recasing: all recasings map to the same key.
          const stable =
            graveyardCacheKey(username) === graveyardCacheKey(recased) &&
            overridesKey(username) === overridesKey(recased);

          return graveyardOk && overridesOk && stable;
        },
      ),
      { numRuns: 100 },
    );
  });
});
