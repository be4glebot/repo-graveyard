import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BADGE_PALETTE, buildBadge, type BadgeTone } from "@/lib/badge";
import {
  repoMessage,
  repoTone,
  summaryMessage,
  summaryTone,
  type BadgeCounts,
} from "@/lib/badge-messages";
import type { LifecycleState } from "@/lib/lifecycle";

const SEP = " \u00B7 ";
const NUM_RUNS = 100;

const MESSAGE_ORDER: readonly LifecycleState[] = ["ghost", "risen", "zombie", "tombstone", "coffin"];
const TONE_ORDER: readonly LifecycleState[] = ["zombie", "ghost", "risen", "tombstone", "coffin"];
const ONE: Record<LifecycleState, string> = {
  ghost: "ghost",
  risen: "risen",
  zombie: "zombie",
  tombstone: "at rest",
  coffin: "sealed",
};
const MANY: Record<LifecycleState, string> = {
  ghost: "ghosts",
  risen: "risen",
  zombie: "zombies",
  tombstone: "at rest",
  coffin: "sealed",
};

// Small counts so zero and one (singular) are frequent.
const count = fc.oneof(fc.constant(0), fc.constant(1), fc.integer({ min: 0, max: 1000 }));
const countsArb: fc.Arbitrary<BadgeCounts> = fc.record({
  ghost: count,
  risen: count,
  zombie: count,
  tombstone: count,
  coffin: count,
});
const stateArb = fc.constantFrom<LifecycleState>(...MESSAGE_ORDER);
const decayArb = fc.oneof(
  fc.constant(null),
  fc.integer({ min: -50, max: 50 }),
  fc.double({ min: -50, max: 50, noNaN: false }),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
);

describe("badge messages properties", () => {
  // Feature: graveyard-badges, Property 9: Summary message lists exactly the non-zero states
  // **Validates: Requirements 1.2, 1.3, 1.4, 10.6, 10.7**
  it("Property 9: summary message lists exactly the non-zero states", () => {
    fc.assert(
      fc.property(countsArb, (counts) => {
        const msg = summaryMessage(counts);
        expect(msg).not.toContain("\u00C2");

        const expectedParts = MESSAGE_ORDER.filter((s) => counts[s] > 0).map(
          (s) => `${counts[s]} ${counts[s] === 1 ? ONE[s] : MANY[s]}`,
        );
        if (expectedParts.length === 0) {
          expect(msg).toBe("empty");
        } else {
          expect(msg).toBe(expectedParts.join(SEP));
          expect(msg.split(SEP)).toEqual(expectedParts);
        }

        const svg = buildBadge({
          label: "repo graveyard",
          message: msg,
          tone: summaryTone(counts),
          style: "haunted",
        });
        expect(svg).not.toContain("\u00C2");
        if (expectedParts.length > 1) expect(svg).toContain(SEP);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: graveyard-badges, Property 10: Summary tone follows urgency
  // **Validates: Requirements 1.6, 1.7**
  it("Property 10: summary tone follows urgency", () => {
    fc.assert(
      fc.property(countsArb, (counts) => {
        const first = TONE_ORDER.find((s) => counts[s] > 0);
        expect(summaryTone(counts)).toBe(first ?? "neutral");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: graveyard-badges, Property 11: Repo message and tone depend only on state and decay
  // **Validates: Requirements 2.2, 2.3, 2.4, 2.6**
  it("Property 11: repo message and tone depend only on state and decay", () => {
    fc.assert(
      fc.property(stateArb, decayArb, (state, decay) => {
        const msg = repoMessage(state, decay);
        expect(msg).not.toMatch(/\d/);
        expect(msg).not.toContain("\u00C2");
        if (state === "ghost" || state === "zombie") {
          const parts = msg.split(SEP);
          expect(parts).toHaveLength(2);
          expect(parts[0]).toBe(state);
          expect(parts[1].length).toBeGreaterThan(0);
        } else {
          expect(msg).toBe(ONE[state]);
        }
        expect(repoMessage(state, decay)).toBe(msg);
        expect(repoTone(state)).toBe(state);
      }),
      { numRuns: NUM_RUNS },
    );

    const tones = MESSAGE_ORDER.map((s) => repoTone(s));
    expect(new Set(tones).size).toBe(5);
    const fills = tones.map((t) => BADGE_PALETTE[t as Exclude<BadgeTone, never>].fill);
    expect(new Set(fills).size).toBe(5);
  });
});
