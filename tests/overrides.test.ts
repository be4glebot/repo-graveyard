/**
 * Unit tests for Override_Store edge cases (task 10.3).
 *
 * These example tests cover the degenerate paths that the property test
 * (task 10.2) does not exercise: a missing/empty username, malformed JSON in
 * storage, a schema-valid-JSON-but-wrong-shape payload, a no-op write when the
 * username is absent, and a throwing storage that must never crash a read or
 * write.
 *
 * All state is injected through an in-memory `StorageLike` fake so the tests
 * never depend on a real `localStorage`. This file runs on the node project
 * (the `.test.ts` unit suite).
 *
 * Validates: Requirements 6.5, 6.6
 */

import { describe, it, expect, vi } from "vitest";
import {
  readOverrides,
  writeOverride,
  overridesKey,
  type StorageLike,
  type OverrideMap,
} from "@/lib/overrides";
import type { Override } from "@/lib/lifecycle";

/**
 * A minimal in-memory `StorageLike` fake backed by a plain object. Records the
 * `setItem` calls so tests can assert that writes do or do not happen.
 */
function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>;
  setItem: ReturnType<typeof vi.fn>;
} {
  const data: Record<string, string> = { ...initial };
  const setItem = vi.fn((key: string, value: string) => {
    data[key] = value;
  });
  return {
    data,
    setItem,
    getItem: (key: string) => (key in data ? data[key] : null),
  };
}

/** A `StorageLike` whose every access throws, simulating blocked storage. */
function createThrowingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
  };
}

const SAMPLE_OVERRIDE: Override = { type: "finished", setAt: "2024-01-01T00:00:00.000Z" };

describe("readOverrides - missing username (Req 6.6)", () => {
  it("returns {} for an empty-string username and never touches storage", () => {
    const storage = createMemoryStorage({
      [overridesKey("octocat")]: JSON.stringify({ repo: SAMPLE_OVERRIDE }),
    });

    expect(readOverrides("", storage)).toEqual<OverrideMap>({});
  });

  it("returns {} for an undefined username", () => {
    const storage = createMemoryStorage({
      [overridesKey("octocat")]: JSON.stringify({ repo: SAMPLE_OVERRIDE }),
    });

    expect(readOverrides(undefined, storage)).toEqual<OverrideMap>({});
  });

  it("returns {} for a null username", () => {
    const storage = createMemoryStorage();

    expect(readOverrides(null, storage)).toEqual<OverrideMap>({});
  });
});

describe("readOverrides - malformed and invalid stored data (Req 6.5)", () => {
  it("returns {} when the stored value is not valid JSON", () => {
    const storage = createMemoryStorage({
      [overridesKey("octocat")]: "{ this is not json",
    });

    expect(readOverrides("octocat", storage)).toEqual<OverrideMap>({});
  });

  it("returns {} for valid JSON that fails the override-map schema", () => {
    // Valid JSON, but the entry shape is wrong (type is not a known override
    // type and setAt is a number rather than a string).
    const storage = createMemoryStorage({
      [overridesKey("octocat")]: JSON.stringify({
        repo: { type: "bogus", setAt: 12345 },
      }),
    });

    expect(readOverrides("octocat", storage)).toEqual<OverrideMap>({});
  });

  it("returns {} for valid JSON that is not an object (e.g. an array)", () => {
    const storage = createMemoryStorage({
      [overridesKey("octocat")]: JSON.stringify([1, 2, 3]),
    });

    expect(readOverrides("octocat", storage)).toEqual<OverrideMap>({});
  });
});

describe("readOverrides - throwing storage (Req 6.5)", () => {
  it("returns {} and does not propagate the error when getItem throws", () => {
    const storage = createThrowingStorage();

    expect(() => readOverrides("octocat", storage)).not.toThrow();
    expect(readOverrides("octocat", storage)).toEqual<OverrideMap>({});
  });
});

describe("writeOverride - missing username is a no-op (Req 6.6)", () => {
  it("does not call setItem when the username is an empty string", () => {
    const storage = createMemoryStorage();

    writeOverride("", "repo", SAMPLE_OVERRIDE, storage);

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.data).toEqual({});
  });

  it("does not call setItem when the username is undefined", () => {
    const storage = createMemoryStorage();

    writeOverride(undefined, "repo", SAMPLE_OVERRIDE, storage);

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.data).toEqual({});
  });
});

describe("writeOverride - throwing storage (Req 6.5)", () => {
  it("does not propagate the error when setItem throws", () => {
    const storage = createThrowingStorage();

    expect(() =>
      writeOverride("octocat", "repo", SAMPLE_OVERRIDE, storage),
    ).not.toThrow();
  });
});
