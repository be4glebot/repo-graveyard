/**
 * Unit tests for `loadEstate` (task 10.2).
 *
 * `loadEstate(deps?)` reads the bundled estate fixture via an injectable
 * `deps.read` (default: a build-time import of `data/estate.json`) and
 * validates it against `estateSchema`, returning a discriminated
 * `Result<EstateFixture, EstateError>`. It only reads + validates — it never
 * resolves offsets or assembles a view, and it issues no GitHub or network
 * call. These tests drive the reader directly so disk/network are never
 * touched:
 *
 *   - A valid fixture resolves to a populated payload ({ ok: true }) whose
 *     parsed value round-trips (non-empty `username`, non-empty `repos`).
 *   - A malformed fixture surfaces the typed `invalid-estate` estate error
 *     instead of throwing.
 *   - A reader that throws is caught and surfaced as the same typed error.
 *   - The only I/O is the injected reader: when `deps.read` is supplied, the
 *     default JSON import is never used, and the injected reader is the sole
 *     transport (asserted via a spy called exactly once).
 *
 * Requirements: 12.1, 12.8
 */

import { describe, expect, it, vi } from "vitest";
import { loadEstate, type EstateReader } from "@/lib/estate-loader";
import type { EstateFixture } from "@/lib/estate-schema";

/**
 * A minimal, schema-valid fixture built inline (NOT read from disk). Every
 * required field from `estateSchema` is present so `safeParse` succeeds and the
 * value round-trips unchanged.
 */
const VALID_FIXTURE: EstateFixture = {
  username: "mossgrove",
  repos: [
    {
      name: "lantern-notes",
      description: "A tiny markdown journal.",
      url: "https://example.test/lantern-notes",
      pushedDaysAgo: 2,
      createdDaysAgo: 410,
      isArchived: false,
      isFork: false,
      homepageUrl: null,
      stargazerCount: 7,
      primaryLanguage: "TypeScript",
      openIssueCount: 3,
      releaseCount: 0,
      readmeBytes: 820,
      lastCommitMessage: "tidy up the sidebar toggle",
      diagnosis: "Still warm to the touch.",
      seance: "It stirs eagerly.",
    },
  ],
};

/** A reader that resolves with whatever raw value a test wants to validate. */
const readerReturning = (raw: unknown): EstateReader => async () => raw;

describe("loadEstate", () => {
  it("resolves a valid fixture to a populated payload that round-trips (Req 12.1)", async () => {
    const result = await loadEstate({ read: readerReturning(VALID_FIXTURE) });

    expect(result.ok).toBe(true);
    // Narrow for TypeScript and to read the parsed value.
    if (!result.ok) throw new Error("expected ok result");

    // Populated payload: a non-empty username and a non-empty repos array.
    expect(typeof result.value.username).toBe("string");
    expect(result.value.username.length).toBeGreaterThan(0);
    expect(result.value.repos.length).toBeGreaterThan(0);

    // The parsed fixture round-trips unchanged (loadEstate validates only).
    expect(result.value).toEqual(VALID_FIXTURE);
  });

  it("surfaces the typed invalid-estate error for a malformed fixture (Req 12.8)", async () => {
    // Empty username and empty repos both violate the schema's `min` bounds.
    const malformed = { username: "", repos: [] };

    const result = await loadEstate({ read: readerReturning(malformed) });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error.kind).toBe("invalid-estate");
  });

  it("surfaces invalid-estate for a non-object fixture rather than throwing (Req 12.8)", async () => {
    const result = await loadEstate({ read: readerReturning("not an object") });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error.kind).toBe("invalid-estate");
  });

  it("catches a throwing reader and returns invalid-estate (Req 12.8)", async () => {
    const throwingReader: EstateReader = async () => {
      throw new Error("fixture asset unavailable");
    };

    const result = await loadEstate({ read: throwingReader });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error.kind).toBe("invalid-estate");
  });

  it("uses only the injected reader as I/O — no network transport constructed (Req 12.8)", async () => {
    // The injected reader is the sole transport: loadEstate takes no network
    // transport parameter and must not reach for the default JSON import when a
    // reader is supplied. A spy proves the injected reader is the only I/O and
    // is invoked exactly once per call.
    const read = vi.fn<EstateReader>(async () => VALID_FIXTURE);

    const result = await loadEstate({ read });

    expect(result.ok).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
    // Called with no arguments: there is no transport to thread through.
    expect(read).toHaveBeenCalledWith();
  });
});
