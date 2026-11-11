/**
 * Property tests for `createBucketLimiter` (graveyard-mcp).
 *
 * Uses a map-backed fake store, a `null` store, a store whose calls all throw,
 * and an injected clock. No network, no real time.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  createBucketLimiter,
  type BucketConfig,
  type BucketVerdict,
  type RateLimitStore,
} from "@/lib/ratelimit";

const START = 1_700_000_000_000;
const RUNS = { numRuns: 100 };

/** Map-backed fake of the sorted-set operations the limiter uses. */
function fakeStore() {
  const sets = new Map<string, { score: number; member: string }[]>();
  const store: RateLimitStore = {
    async zadd(key, entry) {
      const set = sets.get(key) ?? [];
      set.push(entry);
      sets.set(key, set);
      return 1;
    },
    async zremrangebyscore(key, min, max) {
      const set = sets.get(key) ?? [];
      sets.set(
        key,
        set.filter((e) => e.score < min || e.score > max),
      );
      return 0;
    },
    async zcard(key) {
      return (sets.get(key) ?? []).length;
    },
    async incr() {
      return 1;
    },
    async expire() {
      return 1;
    },
    async get() {
      return null;
    },
  };
  return { store, sets };
}

const boom = async (): Promise<never> => {
  throw new Error("store down");
};
const throwingStore: RateLimitStore = {
  zadd: boom,
  zremrangebyscore: boom,
  zcard: boom,
  incr: boom,
  expire: boom,
  get: boom,
};

type Kind = "working" | "null" | "throwing";
const kinds: Kind[] = ["working", "null", "throwing"];

function storeFor(kind: Kind): RateLimitStore | null {
  if (kind === "null") return null;
  if (kind === "throwing") return throwingStore;
  return fakeStore().store;
}

interface Req {
  ip: number;
  at: number;
}

const configArb = fc.record({
  limit: fc.integer({ min: 1, max: 8 }),
  windowMs: fc.integer({ min: 1_000, max: 120_000 }),
});

/** Non-decreasing timestamps with small gaps (so windows fill up) and some big ones. */
const requestsArb = fc
  .array(
    fc.record({
      ip: fc.integer({ min: 0, max: 3 }),
      gap: fc.oneof(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 200_000 }),
      ),
    }),
    { maxLength: 60 },
  )
  .map((items) => {
    let t = START;
    return items.map<Req>(({ ip, gap }) => {
      t += gap;
      return { ip, at: t };
    });
  });

async function drive(
  store: RateLimitStore | null,
  config: BucketConfig,
  reqs: Req[],
): Promise<BucketVerdict[]> {
  let now = START;
  const limiter = createBucketLimiter(store, () => now, config);
  const out: BucketVerdict[] = [];
  for (const r of reqs) {
    now = r.at;
    out.push(await limiter.consume(`ip-${r.ip}`));
  }
  return out;
}

describe("bucket limiter properties", () => {
  // Feature: graveyard-mcp, Property 6: Rolling-window limit per IP and bucket
  // **Validates: Requirements 1.19, 1.20, 1.21, 1.22**
  it("never allows more than L per IP in any window of W, and denials carry retryAfter >= 1", async () => {
    await fc.assert(
      fc.asyncProperty(
        configArb,
        requestsArb,
        fc.constantFrom(...kinds),
        async ({ limit, windowMs }, reqs, kind) => {
          const verdicts = await drive(
            storeFor(kind),
            { bucket: "b", limit, windowMs },
            reqs,
          );
          const allowed = reqs.filter((_, i) => verdicts[i].ok);

          for (const a of allowed) {
            const inWindow = allowed.filter(
              (x) => x.ip === a.ip && x.at <= a.at && x.at > a.at - windowMs,
            );
            expect(inWindow.length).toBeLessThanOrEqual(limit);
          }
          for (const v of verdicts) {
            if (!v.ok) {
              expect(Number.isInteger(v.retryAfter)).toBe(true);
              expect(v.retryAfter).toBeGreaterThanOrEqual(1);
            }
          }
        },
      ),
      RUNS,
    );
  });

  it("admits the first L requests from a fresh IP and denies the next at the same instant", async () => {
    await fc.assert(
      fc.asyncProperty(
        configArb,
        fc.constantFrom(...kinds),
        async ({ limit, windowMs }, kind) => {
          const reqs: Req[] = Array.from({ length: limit + 1 }, () => ({
            ip: 0,
            at: START,
          }));
          const verdicts = await drive(
            storeFor(kind),
            { bucket: "b", limit, windowMs },
            reqs,
          );
          expect(verdicts.slice(0, limit).every((v) => v.ok)).toBe(true);
          expect(verdicts[limit].ok).toBe(false);
        },
      ),
      RUNS,
    );
  });

  it("keeps IPs independent: each IP sees the same verdicts as when it runs alone", async () => {
    await fc.assert(
      fc.asyncProperty(
        configArb,
        requestsArb,
        fc.constantFrom(...kinds),
        async ({ limit, windowMs }, reqs, kind) => {
          const config = { bucket: "b", limit, windowMs };
          const mixed = await drive(storeFor(kind), config, reqs);
          for (const ip of [0, 1, 2, 3]) {
            const idx = reqs.map((r, i) => (r.ip === ip ? i : -1)).filter((i) => i >= 0);
            const alone = await drive(
              storeFor(kind),
              config,
              idx.map((i) => reqs[i]),
            );
            expect(idx.map((i) => mixed[i])).toEqual(alone);
          }
        },
      ),
      RUNS,
    );
  });

  it("isolates buckets: another bucket never reads or changes this bucket's counters", async () => {
    await fc.assert(
      fc.asyncProperty(
        configArb,
        requestsArb,
        requestsArb,
        async ({ limit, windowMs }, mine, theirs) => {
          const aloneStore = fakeStore();
          const alone = await drive(
            aloneStore.store,
            { bucket: "mine", limit, windowMs },
            mine,
          );

          // Same store shared by two limiters with different bucket names.
          const shared = fakeStore();
          let now = START;
          const a = createBucketLimiter(shared.store, () => now, {
            bucket: "mine",
            limit,
            windowMs,
          });
          const b = createBucketLimiter(shared.store, () => now, {
            bucket: "other",
            limit: 1,
            windowMs,
          });
          const merged = [
            ...mine.map((r) => ({ ...r, who: "a" as const })),
            ...theirs.map((r) => ({ ...r, who: "b" as const })),
          ].sort((x, y) => x.at - y.at);

          const seenA: BucketVerdict[] = [];
          for (const r of merged) {
            now = r.at;
            if (r.who === "a") seenA.push(await a.consume(`ip-${r.ip}`));
            else await b.consume(`ip-${r.ip}`);
          }

          // `sort` is stable and `mine` is already non-decreasing, so order is preserved.
          expect(seenA).toEqual(alone);
          for (const key of shared.sets.keys()) {
            expect(key).toMatch(/^ratelimit:(mine|other):ip-\d$/);
          }
          // Counters under this bucket's keys match the run without the other bucket.
          for (const [key, set] of aloneStore.sets) {
            expect(shared.sets.get(key)?.length ?? 0).toBe(set.length);
          }
        },
      ),
      RUNS,
    );
  });
});
