/**
 * Contract property test: what the route's pure builder produces must satisfy
 * the client's payload schema, and the list formatter must render it faithfully.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { GraveyardData } from "@/lib/github";
import { buildGraveyardPayload } from "@/lib/graveyard-payload";
import type { RepoFacts } from "@/lib/lifecycle";
import { sanitiseInline } from "@/lib/revive-brief";

import { arbIso, arbRepoFacts, arbUsername } from "../../../tests/property/arbitraries";
import { formatList } from "../src/format";
import { graveyardPayloadSchema } from "../src/payload";

const arbName: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 1, maxLength: 100 }),
  fc.string({ unit: "grapheme", minLength: 1, maxLength: 20 }),
  fc.constantFrom("a", "b", "\u{1F47B}x", "\u{20000}", "\uE000"),
);

const arbPushedAt: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.constantFrom("not-a-date", ""),
  arbIso,
);

const arbStars: fc.Arbitrary<number> = fc.oneof(
  fc.nat({ max: 1_000_000 }),
  fc.integer({ min: -1000, max: 1000 }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, -0.5, 0.9),
);

const arbFacts: fc.Arbitrary<RepoFacts> = fc
  .tuple(arbRepoFacts, arbName, arbPushedAt, arbStars, fc.webUrl())
  .map(([facts, name, pushedAt, stargazerCount, url]) => ({
    ...facts,
    name,
    pushedAt,
    stargazerCount,
    url: url.slice(0, 400),
  }));

const arbData: fc.Arbitrary<GraveyardData> = fc
  .tuple(fc.array(arbFacts, { maxLength: 40 }), fc.boolean())
  .map(([repos, truncated]) => ({ repos, totalCount: repos.length, truncated }));

const arbNow = fc
  .date({
    min: new Date("2000-01-01T00:00:00.000Z"),
    max: new Date("2100-01-01T00:00:00.000Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

describe("route payload / client contract", () => {
  // Feature: graveyard-mcp, Property 18: Route payload satisfies the client contract
  // **Validates: Requirements 1.5, 5.1, 5.4**
  it("Property 18: Route payload satisfies the client contract", () => {
    fc.assert(
      fc.property(arbUsername, arbData, arbNow, (owner, data, nowIso) => {
        const payload = buildGraveyardPayload(owner, data, nowIso);

        const parsed = graveyardPayloadSchema.safeParse(payload);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;

        // The payload survives a JSON round trip (as sent over HTTP).
        const wire = graveyardPayloadSchema.safeParse(JSON.parse(JSON.stringify(payload)));
        expect(wire.success).toBe(true);

        const { body } = formatList(parsed.data, Date.parse(nowIso));
        expect(body).toHaveLength(payload.repos.length);
        payload.repos.forEach((entry, i) => {
          const fields = body[i].split(" | ");
          expect(fields[0]).toBe(sanitiseInline(entry.name));
          expect(fields[1]).toBe(entry.state);
          expect(body[i].endsWith(` | ${entry.stars} stars`)).toBe(true);
        });
      }),
      { numRuns: 200 },
    );
  });
});
