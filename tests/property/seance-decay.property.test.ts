/**
 * Property tests for lib/seance-decay.ts
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  DECAY_PROFILES,
  selectDecayProfile,
  flickerFor,
  type DecayProfileId,
} from "../../lib/seance-decay";
import { buildRitualPlan } from "../../lib/seance-ritual";

const STATES = ["ghost", "risen", "zombie", "tombstone", "coffin"] as const;

const stateArb = fc.oneof(
  fc.constantFrom<unknown>(...STATES),
  fc.constantFrom<unknown>(undefined, null),
  fc.string(),
  fc.integer(),
  fc.double({ noNaN: false }),
  fc.boolean(),
);

const decayArb = fc.oneof(
  fc.integer(),
  fc.integer({ min: -3, max: 6 }),
  fc.double({ noNaN: false }),
  fc.constantFrom<unknown>(
    NaN,
    Infinity,
    -Infinity,
    null,
    undefined,
    "1",
    {},
  ),
);

const PROFILE_IDS = Object.keys(DECAY_PROFILES) as DecayProfileId[];

describe("seance-decay properties", () => {
  // Feature: the-seance, Property 14: Decay profile selection is total and deterministic
  // **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 20.19**
  it("selection is total, deterministic and follows the mapping", () => {
    expect(PROFILE_IDS).toHaveLength(6);

    fc.assert(
      fc.property(stateArb, decayArb, (state, decay) => {
        const a = selectDecayProfile(state, decay);
        const b = selectDecayProfile(state, decay);

        // total: exactly one profile from the fixed set
        expect(PROFILE_IDS.filter((id) => DECAY_PROFILES[id] === a)).toHaveLength(1);
        // deterministic
        expect(b).toBe(a);

        switch (state) {
          case "risen":
            expect(a.id).toBe("risen-cyan");
            break;
          case "zombie":
            expect(a.id).toBe("zombie-rough");
            break;
          case "tombstone":
          case "coffin":
            expect(a.id).toBe("cold-still");
            break;
          case "ghost":
            if (decay === 0) expect(a.id).toBe("ghost-steady");
            else if (decay === 1) expect(a.id).toBe("ghost-fading");
            else if (decay === 2 || decay === 3) expect(a.id).toBe("ghost-jitter");
            break;
          default:
            expect(a.id).toBe("ghost-steady");
        }
      }),
      { numRuns: 200 },
    );
  });

  // Feature: the-seance, Property 16: Flicker is seeded and bounded
  // **Validates: Requirements 11.7**
  it("flicker is deterministic and bounded", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 500 }),
        (repo, lineIndex, lineLength) => {
          const a = flickerFor(repo, lineIndex, lineLength);
          const b = flickerFor(repo, lineIndex, lineLength);
          expect(b).toEqual(a);
          if (a !== null) {
            expect(Number.isInteger(a.letterIndex)).toBe(true);
            expect(a.letterIndex).toBeGreaterThanOrEqual(0);
            expect(a.letterIndex).toBeLessThan(lineLength);
            expect(a.durationMs).toBeGreaterThan(0);
            expect(a.durationMs).toBeLessThanOrEqual(150);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  // Feature: the-seance, Property 17: Ritual plan stays within bounds
  // **Validates: Requirements 10.3**
  it("ritual plan stays within bounds and is deterministic", () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const plan = buildRitualPlan(seed);
        expect(buildRitualPlan(seed)).toEqual(plan);

        const { candles } = plan;
        expect(candles.length).toBeGreaterThanOrEqual(3);
        expect(candles.length).toBeLessThanOrEqual(6);

        for (let i = 1; i < candles.length; i += 1) {
          const gap = candles[i].igniteAtMs - candles[i - 1].igniteAtMs;
          expect(gap).toBeGreaterThanOrEqual(200);
          expect(gap).toBeLessThanOrEqual(600);
        }
        for (const c of candles) {
          expect(c.fadeMs).toBeGreaterThanOrEqual(500);
          expect(c.fadeMs).toBeLessThanOrEqual(1500);
        }
        const last = candles[candles.length - 1];
        expect(last.igniteAtMs + last.fadeMs).toBeLessThanOrEqual(2000);
      }),
      { numRuns: 200 },
    );
  });});
