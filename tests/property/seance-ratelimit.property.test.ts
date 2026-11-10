// Feature: the-seance, Property 22: Daily limit parsing
//
// For any string or undefined, parseDailyLimit returns the integer value when
// the string is only ASCII digits and a safe integer (including "0"), and 200
// for every other value (missing, empty, negative, decimal, non-numeric, mixed
// text, whitespace).
//
// **Validates: Requirements 8.2, 20.28**

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseDailyLimit } from "@/lib/ratelimit";

const FALLBACK = 200;
const RUNS = { numRuns: 200 };

const digits = fc
  .array(fc.constantFrom(..."0123456789".split("")), { minLength: 1, maxLength: 25 })
  .map((a) => a.join(""));

describe("Property 22: Daily limit parsing", () => {
  it("returns the integer for ASCII-digit safe integers", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (n) => {
        expect(parseDailyLimit(String(n))).toBe(n);
      }),
      RUNS,
    );
  });

  it("agrees with the digits-and-safe-integer rule for any digit string", () => {
    fc.assert(
      fc.property(digits, (s) => {
        const n = Number(s);
        expect(parseDailyLimit(s)).toBe(Number.isSafeInteger(n) ? n : FALLBACK);
      }),
      RUNS,
    );
  });

  it("returns 200 for every other string", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (s) => {
        fc.pre(!/^[0-9]+$/.test(s));
        expect(parseDailyLimit(s)).toBe(FALLBACK);
      }),
      RUNS,
    );
  });

  it("returns 200 for digits with a sign, decimal point, padding or non-ASCII digits", () => {
    const decorated = fc.oneof(
      digits.map((d) => `-${d}`),
      digits.map((d) => `+${d}`),
      digits.map((d) => `${d}.5`),
      digits.map((d) => ` ${d}`),
      digits.map((d) => `${d}\n`),
      digits.map((d) => `${d}x`),
      fc.constantFrom("", " ", "\t", "abc", "NaN", "Infinity", "1e3", "0x10", "٣", "１２"),
    );
    fc.assert(
      fc.property(decorated, (s) => {
        expect(parseDailyLimit(s)).toBe(FALLBACK);
      }),
      RUNS,
    );
  });

  it("examples: undefined -> 200, '0' -> 0", () => {
    expect(parseDailyLimit(undefined)).toBe(FALLBACK);
    expect(parseDailyLimit("0")).toBe(0);
    expect(parseDailyLimit("9007199254740993")).toBe(FALLBACK);
  });
});

// Feature: the-seance, Property 23: Client IP extraction
//
// For any forwarded-for header value, clientIp returns the trimmed first
// comma-separated entry when it is non-empty, and the shared anonymous bucket
// id when the header is null, empty or only whitespace and commas.
//
// **Validates: Requirements 8.11**

import { clientIp, ANON_IP } from "@/lib/ratelimit";

const ws = fc
  .array(fc.constantFrom(" ", "\t"), { maxLength: 4 })
  .map((a) => a.join(""));
// An entry with no comma and a non-whitespace core.
const core = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !s.includes(",") && s.trim() !== "" && s === s.trim());
const rest = fc.array(fc.string({ maxLength: 20 }), { maxLength: 4 });

describe("Property 23: Client IP extraction", () => {
  it("returns the trimmed first entry when it is non-empty", () => {
    fc.assert(
      fc.property(ws, core, ws, rest, (pre, ip, post, tail) => {
        const header = [`${pre}${ip}${post}`, ...tail].join(",");
        expect(clientIp(header)).toBe(ip);
      }),
      RUNS,
    );
  });

  it("returns the anonymous bucket for null, empty, or only whitespace and commas", () => {
    expect(clientIp(null)).toBe(ANON_IP);
    expect(clientIp("")).toBe(ANON_IP);
    const blank = fc
      .array(fc.constantFrom(" ", "\t", ","), { maxLength: 12 })
      .map((a) => a.join(""));
    fc.assert(
      fc.property(blank, (s) => {
        expect(clientIp(s)).toBe(ANON_IP);
      }),
      RUNS,
    );
  });

  it("examples", () => {
    expect(clientIp("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
    expect(clientIp("  2001:db8::1  ")).toBe("2001:db8::1");
  });
});

// Feature: the-seance, Property 24: The rolling window never admits more than 30 calls an hour
//
// For any sequence of call timestamps for one IP presented to the limiter
// against a fake store and clock, the number of calls answered `ok` within any
// 60-minute window is at most 30. When the IP limit blocks a call, the daily
// counter is not incremented by that call. When the store throws, the
// in-memory fallback admits at most 10 calls per rolling hour.
//
// **Validates: Requirements 8.1, 8.3, 8.9**

import {
  createRateLimiter,
  IP_LIMIT,
  FALLBACK_IP_LIMIT,
  WINDOW_MS,
  type RateLimitStore,
  type ConsumeResult,
} from "@/lib/ratelimit";

/** In-memory fake of the Redis subset the limiter uses. */
function fakeStore() {
  const zsets = new Map<string, { score: number; member: string }[]>();
  const counters = new Map<string, number>();
  const store: RateLimitStore = {
    async zadd(key, entry) {
      zsets.set(key, [...(zsets.get(key) ?? []), entry]);
      return 1;
    },
    async zremrangebyscore(key, min, max) {
      zsets.set(
        key,
        (zsets.get(key) ?? []).filter((e) => e.score < min || e.score > max),
      );
      return 0;
    },
    async zcard(key) {
      return (zsets.get(key) ?? []).length;
    },
    async incr(key) {
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      return n;
    },
    async expire() {
      return 1;
    },
    async get(key) {
      return counters.get(key) ?? null;
    },
  };
  return { store, counters };
}

const throwingStore: RateLimitStore = {
  zadd: () => Promise.reject(new Error("down")),
  zremrangebyscore: () => Promise.reject(new Error("down")),
  zcard: () => Promise.reject(new Error("down")),
  incr: () => Promise.reject(new Error("down")),
  expire: () => Promise.reject(new Error("down")),
  get: () => Promise.reject(new Error("down")),
};

// Non-decreasing timestamps: bursts (delta 0) through gaps of up to 20 minutes.
const START = Date.UTC(2026, 0, 10, 12, 0, 0);
const timestamps = fc
  .array(
    fc.oneof(
      { weight: 3, arbitrary: fc.constant(0) },
      { weight: 3, arbitrary: fc.integer({ min: 0, max: 60_000 }) },
      { weight: 1, arbitrary: fc.integer({ min: 0, max: 20 * 60_000 }) },
    ),
    { minLength: 1, maxLength: 150 },
  )
  .map((deltas) => {
    let t = START;
    return deltas.map((d) => (t += d));
  });

/** Max count of admitted timestamps inside any half-open window [s, s + 60min). */
function maxInWindow(admitted: number[]): number {
  let max = 0;
  for (let i = 0; i < admitted.length; i++) {
    let n = 0;
    for (let j = i; j < admitted.length && admitted[j] < admitted[i] + WINDOW_MS; j++) n++;
    max = Math.max(max, n);
  }
  return max;
}

async function run(
  limiter: ReturnType<typeof createRateLimiter>,
  setNow: (t: number) => void,
  times: number[],
) {
  const results: ConsumeResult[] = [];
  for (const t of times) {
    setNow(t);
    results.push(await limiter.consume("203.0.113.7"));
  }
  return results;
}

describe("Property 24: The rolling window never admits more than 30 calls an hour", () => {
  const BIG = () => 1_000_000;

  it("admits at most 30 ok calls in any 60-minute window (store)", async () => {
    await fc.assert(
      fc.asyncProperty(timestamps, async (times) => {
        let now = START;
        const { store } = fakeStore();
        const limiter = createRateLimiter(store, () => now, BIG);
        const results = await run(limiter, (t) => (now = t), times);
        const admitted = times.filter((_, i) => results[i] === "ok");
        expect(maxInWindow(admitted)).toBeLessThanOrEqual(IP_LIMIT);
        // Every result is ok or veil when the daily budget is huge.
        expect(results.every((r) => r === "ok" || r === "veil")).toBe(true);
      }),
      RUNS,
    );
  });

  it("a blocked IP leaves the daily counter untouched", async () => {
    await fc.assert(
      fc.asyncProperty(timestamps, async (times) => {
        let now = START;
        const { store, counters } = fakeStore();
        const limiter = createRateLimiter(store, () => now, BIG);
        for (const t of times) {
          now = t;
          const before = new Map(counters);
          const r = await limiter.consume("203.0.113.7");
          if (r === "veil") {
            expect(new Map(counters)).toEqual(before);
          }
        }
      }),
      RUNS,
    );
  });

  it("falls back to at most 10 calls per rolling hour when the store throws or is null", async () => {
    await fc.assert(
      fc.asyncProperty(timestamps, fc.boolean(), async (times, useNull) => {
        let now = START;
        const limiter = createRateLimiter(useNull ? null : throwingStore, () => now, BIG);
        const results = await run(limiter, (t) => (now = t), times);
        const admitted = times.filter((_, i) => results[i] === "ok");
        expect(maxInWindow(admitted)).toBeLessThanOrEqual(FALLBACK_IP_LIMIT);
      }),
      RUNS,
    );
  });

  it("examples: the 31st call in an hour is a veil, and the window slides", async () => {
    let now = START;
    const { store } = fakeStore();
    const limiter = createRateLimiter(store, () => now, BIG);
    for (let i = 0; i < IP_LIMIT; i++) expect(await limiter.consume("a")).toBe("ok");
    expect(await limiter.consume("a")).toBe("veil");
    expect(await limiter.check("a")).toBe("veil");
    now = START + WINDOW_MS + 1;
    expect(await limiter.consume("a")).toBe("ok");
  });
});
