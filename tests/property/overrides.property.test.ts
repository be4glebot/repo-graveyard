/**
 * Feature: repo-lifecycle-classification, Property 16: Override store round trip and replacement
 *
 * With a WORKING in-memory `StorageLike` fake:
 *  - `readOverrides` returns the last override written per repo name — at most
 *    one entry per name, so writing the same repo name again replaces the prior
 *    entry.
 *  - A single write followed by a read returns an equal `{ type, setAt }`.
 *
 * With a THROWING storage:
 *  - `readOverrides` returns `{}`.
 *  - `writeOverride` does not throw.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Override } from "@/lib/lifecycle";
import { readOverrides, writeOverride, type StorageLike } from "@/lib/overrides";
import { arbOverride, arbRepoName, arbUsername } from "./arbitraries";

/**
 * A working in-memory `StorageLike` fake backed by a plain object. Mirrors the
 * get/set contract of `localStorage`: `getItem` returns the stored string or
 * `null` for a missing key, `setItem` overwrites.
 */
function makeMemoryStorage(): StorageLike {
  const data: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key: string, value: string): void {
      data[key] = value;
    },
  };
}

/**
 * A `StorageLike` whose every operation throws, simulating storage that is
 * disabled or erroring (private mode, quota, blocked cookies).
 */
function makeThrowingStorage(): StorageLike {
  return {
    getItem(): string | null {
      throw new Error("storage unavailable");
    },
    setItem(): void {
      throw new Error("storage unavailable");
    },
  };
}

/** A non-empty username so reads/writes are not short-circuited. */
const arbNonEmptyUsername: fc.Arbitrary<string> = arbUsername.filter((u) => u.length > 0);

describe("Property 16: Override store round trip and replacement", () => {
  it("a single write then read returns an equal { type, setAt }", () => {
    fc.assert(
      fc.property(arbNonEmptyUsername, arbRepoName, arbOverride, (username, repoName, override) => {
        const storage = makeMemoryStorage();
        writeOverride(username, repoName, override, storage);
        const map = readOverrides(username, storage);
        expect(map[repoName]).toEqual(override);
      }),
      { numRuns: 100 },
    );
  });

  it("readOverrides returns the last override written per repo name (replacement, one entry per name)", () => {
    fc.assert(
      fc.property(
        arbNonEmptyUsername,
        fc.array(fc.tuple(arbRepoName, arbOverride), { minLength: 1, maxLength: 30 }),
        (username, writes) => {
          const storage = makeMemoryStorage();

          // Build the expected map independently: the last write for each repo
          // name wins, and each name appears at most once.
          const expected: Record<string, Override> = {};
          for (const [repoName, override] of writes) {
            writeOverride(username, repoName, override, storage);
            expected[repoName] = override;
          }

          const map = readOverrides(username, storage);

          // At most one entry per name: the stored keys equal the distinct
          // repo names written.
          expect(new Set(Object.keys(map))).toEqual(new Set(Object.keys(expected)));
          // Each stored entry equals the LAST override written for that name.
          expect(map).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("with a throwing storage, readOverrides returns {} and writeOverride does not throw", () => {
    fc.assert(
      fc.property(arbNonEmptyUsername, arbRepoName, arbOverride, (username, repoName, override) => {
        const storage = makeThrowingStorage();
        expect(() => writeOverride(username, repoName, override, storage)).not.toThrow();
        expect(readOverrides(username, storage)).toEqual({});
      }),
      { numRuns: 100 },
    );
  });
});
