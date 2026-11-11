/**
 * Unit tests for the séance cache helpers in `lib/cache.ts`.
 *
 * Requirements: 7.3, 7.5, 7.6, 7.7, 7.8, 7.10, 7.11
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REDIS_TIMEOUT_MS,
  SEANCE_TTL_SECONDS,
  type CacheClient,
  seanceCacheGet,
  seanceCacheKey,
  seanceCacheSet,
} from "@/lib/cache";
import type { SeanceResult } from "@/lib/seance-schema";

const RESULT: SeanceResult = {
  voice: "I was a quiet little tool. Nobody ever finished me.",
  causeOfDeath: "The author lost interest in the parser.",
  unfinishedBusiness: [
    {
      title: "Parser rewrite",
      detail: "The rewrite was started but never merged.",
      evidence: "commit: start parser rewrite",
    },
    {
      title: "Missing docs",
      detail: "The readme stops halfway through setup.",
      evidence: "README: Setup (todo)",
    },
  ],
  verdict: "revive",
  verdictReason: "The core idea still holds up.",
};

function fakeClient(overrides: Partial<CacheClient> = {}): CacheClient & {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    ...overrides,
  } as never;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("seance cache", () => {
  it("uses a 24 hour TTL", () => {
    expect(SEANCE_TTL_SECONDS).toBe(86400);
  });

  describe("seanceCacheKey", () => {
    it("lowercases owner and repo", () => {
      expect(seanceCacheKey("OctoCat", "Hello-World", "2024-01-01T00:00:00Z", "x")).toBe(
        "seance:v6:octocat/hello-world:2024-01-01T00:00:00Z",
      );
    });

    it("falls back to createdAt when pushedAt is null", () => {
      expect(seanceCacheKey("a", "b", null, "2020-05-05T00:00:00Z")).toBe(
        "seance:v6:a/b:2020-05-05T00:00:00Z",
      );
    });
  });

  describe("seanceCacheGet", () => {
    it("returns the result for a valid payload", async () => {
      const client = fakeClient({ get: vi.fn().mockResolvedValue(RESULT) });
      await expect(seanceCacheGet(client, "k")).resolves.toEqual(RESULT);
      expect(client.get).toHaveBeenCalledWith("k");
    });

    it("misses on a null client", async () => {
      await expect(seanceCacheGet(null, "k")).resolves.toBeNull();
    });

    it("misses when nothing is stored", async () => {
      await expect(seanceCacheGet(fakeClient(), "k")).resolves.toBeNull();
    });

    it("misses on a read error", async () => {
      const client = fakeClient({ get: vi.fn().mockRejectedValue(new Error("boom")) });
      await expect(seanceCacheGet(client, "k")).resolves.toBeNull();
    });

    it("misses on a read timeout", async () => {
      vi.useFakeTimers();
      const client = fakeClient({ get: vi.fn(() => new Promise(() => {})) });
      const pending = seanceCacheGet(client, "k");
      await vi.advanceTimersByTimeAsync(REDIS_TIMEOUT_MS);
      await expect(pending).resolves.toBeNull();
    });

    it("misses on an invalid payload", async () => {
      const client = fakeClient({
        get: vi.fn().mockResolvedValue({ ...RESULT, verdict: "bury" }),
      });
      await expect(seanceCacheGet(client, "k")).resolves.toBeNull();
    });
  });

  describe("seanceCacheSet", () => {
    it("writes the result with the 24 hour TTL", async () => {
      const client = fakeClient();
      await seanceCacheSet(client, "k", RESULT);
      expect(client.set).toHaveBeenCalledWith("k", RESULT, { ex: 86400 });
    });

    it("does nothing with a null client", async () => {
      await expect(seanceCacheSet(null, "k", RESULT)).resolves.toBeUndefined();
    });

    it("swallows a write failure", async () => {
      const client = fakeClient({ set: vi.fn().mockRejectedValue(new Error("boom")) });
      await expect(seanceCacheSet(client, "k", RESULT)).resolves.toBeUndefined();
    });

    it("swallows a write timeout", async () => {
      vi.useFakeTimers();
      const client = fakeClient({ set: vi.fn(() => new Promise(() => {})) });
      const pending = seanceCacheSet(client, "k", RESULT);
      await vi.advanceTimersByTimeAsync(REDIS_TIMEOUT_MS);
      await expect(pending).resolves.toBeUndefined();
    });
  });
});
