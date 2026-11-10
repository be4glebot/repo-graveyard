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
