/**
 * Property tests for `buildGraveyardPayload` (lib/graveyard-payload.ts).
 * Properties 1-3 of the graveyard-mcp design.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { GraveyardData } from "@/lib/github";
import { classify, type RepoFacts } from "@/lib/lifecycle";
import {
  buildGraveyardPayload,
  compareCodePoints,
} from "@/lib/graveyard-payload";

import { arbIso, arbRepoFacts } from "./arbitraries";

const RUNS = { numRuns: 200 };

const STATES = ["ghost", "risen", "zombie", "tombstone", "coffin"] as const;

/** Names including astral characters (emoji, supplementary CJK) and BMP-high chars. */
const arbName: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 1, maxLength: 12 }),
  fc.string({ unit: "grapheme", minLength: 1, maxLength: 8 }),
  fc.constantFrom("a", "b", "\u{1F47B}x", "\uFF5Ez", "\u{20000}", "\uE000", "\u{10FFFF}"),
);

/** Push dates: null, malformed, future, past, and a small pool of duplicates. */
const arbPushedAt: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.constantFrom("not-a-date", "", "2024-13-45T00:00:00Z"),
  arbIso, // spans 1970..2100, so includes future dates
  fc.constantFrom(
    "2024-01-01T00:00:00.000Z",
    "2024-01-01T00:00:00Z",
    "2025-06-01T12:00:00.000Z",
    "2999-01-01T00:00:00.000Z",
  ),
);

const arbStars: fc.Arbitrary<number> = fc.oneof(
  fc.nat({ max: 100_000 }),
  fc.integer({ min: -1000, max: 1000 }),
  fc.double({ min: -1000, max: 1000, noNaN: true }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.5, 0.9),
);

const arbFacts: fc.Arbitrary<RepoFacts> = fc
  .tuple(arbRepoFacts, arbName, arbPushedAt, arbStars, fc.webUrl())
  .map(([facts, name, pushedAt, stargazerCount, url]) => ({
    ...facts,
    name,
    pushedAt,
    stargazerCount,
    url,
  }));

const arbRepos = fc.array(arbFacts, { maxLength: 40 });

const arbNow = fc
  .date({
    min: new Date("2000-01-01T00:00:00.000Z"),
    max: new Date("2100-01-01T00:00:00.000Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

const arbData = (repos: fc.Arbitrary<RepoFacts[]>) =>
  fc.tuple(repos, fc.boolean()).map(
    ([list, truncated]): GraveyardData => ({
      repos: list,
      totalCount: list.length,
      truncated,
    }),
  );

describe("buildGraveyardPayload properties", () => {
  // Feature: graveyard-mcp, Property 1: Entry correctness
  // **Validates: Requirements 1.3, 1.6, 1.7, 1.8, 1.9**
  it("Property 1: Entry correctness", () => {
    fc.assert(
      fc.property(fc.string(), arbData(arbRepos), arbNow, (owner, data, now) => {
        const payload = buildGraveyardPayload(owner, data, now);

        expect(payload.owner).toBe(owner);
        expect(payload.truncated).toBe(data.truncated);
        expect(payload.repos).toHaveLength(data.repos.length);

        // Each output entry corresponds to one input repo (match by multiset key).
        const remaining = [...data.repos];
        for (const entry of payload.repos) {
          expect(Object.keys(entry).sort()).toEqual(
            ["decay", "html_url", "name", "pushedAt", "stars", "state"],
          );

          const idx = remaining.findIndex(
            (r) =>
              r.name === entry.name &&
              r.url === entry.html_url &&
              (r.pushedAt === null || Number.isNaN(Date.parse(r.pushedAt))
                ? entry.pushedAt === null
                : entry.pushedAt !== null &&
                  Date.parse(entry.pushedAt) === Date.parse(r.pushedAt)),
          );
          expect(idx).toBeGreaterThanOrEqual(0);
          const repo = remaining.splice(idx, 1)[0];

          const c = classify(repo, undefined, now);
          expect(entry.state).toBe(c.state);
          expect(entry.decay).toBe(c.decayLevel);
          if (entry.state === "ghost") {
            expect(entry.decay).toBeGreaterThanOrEqual(0);
            expect(entry.decay).toBeLessThanOrEqual(3);
          } else if (entry.state === "zombie") {
            expect(entry.decay).toBeGreaterThanOrEqual(0);
            expect(entry.decay).toBeLessThanOrEqual(4);
          } else {
            expect(entry.decay).toBeNull();
          }

          if (entry.pushedAt !== null) {
            expect(new Date(entry.pushedAt).toISOString()).toBe(entry.pushedAt);
          }

          expect(Number.isInteger(entry.stars)).toBe(true);
          expect(entry.stars).toBeGreaterThanOrEqual(0);
        }
      }),
      RUNS,
    );
  });

  // Feature: graveyard-mcp, Property 2: Counts are consistent
  // **Validates: Requirements 1.4, 1.5**
  it("Property 2: Counts are consistent", () => {
    fc.assert(
      fc.property(fc.string(), arbData(arbRepos), arbNow, (owner, data, now) => {
        const { counts, repos } = buildGraveyardPayload(owner, data, now);

        expect(Object.keys(counts).sort()).toEqual(
          [...STATES, "total"].sort(),
        );
        let sum = 0;
        for (const s of STATES) {
          expect(Number.isInteger(counts[s])).toBe(true);
          expect(counts[s]).toBeGreaterThanOrEqual(0);
          expect(counts[s]).toBe(repos.filter((r) => r.state === s).length);
          sum += counts[s];
        }
        expect(Number.isInteger(counts.total)).toBe(true);
        expect(counts.total).toBeGreaterThanOrEqual(0);
        expect(sum).toBe(counts.total);
        expect(counts.total).toBe(repos.length);
      }),
      RUNS,
    );
  });

  it("Property 2 (empty list): all counts are zero", () => {
    const p = buildGraveyardPayload(
      "x",
      { repos: [], totalCount: 0, truncated: false },
      "2025-01-01T00:00:00.000Z",
    );
    expect(p.counts).toEqual({
      ghost: 0,
      risen: 0,
      zombie: 0,
      tombstone: 0,
      coffin: 0,
      total: 0,
    });
    expect(p.repos).toEqual([]);
  });

  // Feature: graveyard-mcp, Property 3: Ordering
  // **Validates: Requirements 1.10**
  it("Property 3: Ordering", () => {
    // Duplicate-heavy input: few dates, few names, astral characters, nulls.
    const arbDupFacts = fc
      .tuple(
        arbRepoFacts,
        fc.constantFrom("a", "b", "\u{1F47B}", "\uFF5E", "\u{20000}x", "\uE000", "ab"),
        fc.constantFrom(
          null,
          "2024-01-01T00:00:00.000Z",
          "2024-01-01T00:00:00Z",
          "2025-01-01T00:00:00.000Z",
          "2999-01-01T00:00:00.000Z",
          "garbage",
        ),
      )
      .map(([facts, name, pushedAt]) => ({ ...facts, name, pushedAt }));
    const arbList = fc.oneof(arbRepos, fc.array(arbDupFacts, { maxLength: 40 }));

    fc.assert(
      fc.property(fc.string(), arbData(arbList), arbNow, (owner, data, now) => {
        const { repos } = buildGraveyardPayload(owner, data, now);

        // Permutation of the input (compare names as multisets).
        const outNames = repos.map((r) => r.name).sort(compareCodePoints);
        const inNames = data.repos.map((r) => r.name).sort(compareCodePoints);
        expect(outNames).toEqual(inNames);

        // Dated entries first.
        const firstNull = repos.findIndex((r) => r.pushedAt === null);
        if (firstNull !== -1) {
          for (let i = firstNull; i < repos.length; i++) {
            expect(repos[i].pushedAt).toBeNull();
          }
        }

        for (let i = 1; i < repos.length; i++) {
          const prev = repos[i - 1];
          const cur = repos[i];
          if (prev.pushedAt !== null && cur.pushedAt !== null) {
            const tp = Date.parse(prev.pushedAt);
            const tc = Date.parse(cur.pushedAt);
            expect(tp).toBeGreaterThanOrEqual(tc);
            if (tp === tc) {
              expect(compareCodePoints(prev.name, cur.name)).toBeLessThanOrEqual(0);
            }
          } else if (prev.pushedAt === null && cur.pushedAt === null) {
            expect(compareCodePoints(prev.name, cur.name)).toBeLessThanOrEqual(0);
          }
        }
      }),
      RUNS,
    );
  });
});
