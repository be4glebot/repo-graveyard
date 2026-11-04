/**
 * Feature: repo-lifecycle-classification, Property 1: Username validation matches the specification
 *
 * Loader half of Property 1. For any string that FAILS username validation,
 * `loadGraveyard(badString, deps)` must return
 * `{ ok: false, error: { kind: "invalid-username" } }` and make ZERO transport
 * calls and ZERO cache calls. Validation happens before any dependency is
 * touched, so an invalid username can never reach GitHub or Redis.
 *
 * The validator half (`isValidUsername` agrees with the reference predicate) is
 * covered by task 2.2 in `tests/property/username.test.ts`.
 *
 * Validates: Requirements 1.4
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { isValidUsername } from "@/lib/username";
import { loadGraveyard } from "@/lib/graveyard-loader";
import type { GraphqlTransport } from "@/lib/github";
import type { CacheClient } from "@/lib/cache";
import { arbUsername } from "./arbitraries";

/**
 * A transport that must never be called for an invalid username. It increments
 * a counter and rejects loudly, so any accidental invocation both bumps the
 * count (failing the zero-calls assertion) and surfaces as a thrown error.
 */
function spyTransport(): { transport: GraphqlTransport; calls: () => number } {
  let count = 0;
  const transport: GraphqlTransport = async () => {
    count += 1;
    throw new Error("transport must not be called for an invalid username");
  };
  return { transport, calls: () => count };
}

/**
 * A cache client whose `get`/`set` both increment a shared counter and reject.
 * As with the transport, any call fails the zero-calls assertion.
 */
function spyCache(): { cache: CacheClient; calls: () => number } {
  let count = 0;
  const cache: CacheClient = {
    get: async () => {
      count += 1;
      throw new Error("cache.get must not be called for an invalid username");
    },
    set: async () => {
      count += 1;
      throw new Error("cache.set must not be called for an invalid username");
    },
  };
  return { cache, calls: () => count };
}

describe("Property 1: Username validation matches the specification (loader)", () => {
  it("rejects every invalid username with invalid-username and zero transport/cache calls", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Only strings that genuinely fail validation. `arbUsername` already
        // includes the invalid near-misses (leading/trailing hyphen, 40 chars,
        // empty, whitespace, unicode) alongside valid names, so filtering to
        // the failing set keeps a rich mix of invalid inputs.
        arbUsername.filter((s) => !isValidUsername(s)),
        async (badUsername) => {
          const t = spyTransport();
          const c = spyCache();

          const result = await loadGraveyard(badUsername, {
            transport: t.transport,
            cache: c.cache,
          });

          expect(result.ok).toBe(false);
          // Narrow for the error shape without leaning on the success branch.
          if (!result.ok) {
            expect(result.error.kind).toBe("invalid-username");
          }
          expect(t.calls()).toBe(0);
          expect(c.calls()).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
