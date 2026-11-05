/**
 * Feature: haunted-graveyard-scene — fast-check property tests for the pure
 * scene view-model (`lib/scene-view.ts`).
 *
 * This file holds Properties 1–11 from the design, one `describe` block per
 * property, each tagged "Feature: haunted-graveyard-scene, Property N: <title>".
 * Later tasks append more describe blocks; keep each property self-contained.
 *
 * All generators are the shared scene arbitraries in `./arbitraries` (which
 * reuse the existing `arbRepoFacts`, `arbIso`, and `arbOverride`); `now` is
 * always passed explicitly. Each property runs at least 100 cases.
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { classify, type LifecycleState } from "@/lib/lifecycle";
import {
  animationDelay,
  ANIMATION_DELAY_MAX_SECONDS,
  capZone,
  composeWhispers,
  creatureImage,
  FILTER_HERO_BUDGET,
  fogDensity,
  FOG_FULL_ZOMBIES,
  lightningIntervalSeconds,
  LIGHTNING_BASE_SECONDS,
  LIGHTNING_FLOOR_SECONDS,
  LIGHTNING_STEP_SECONDS,
  moonTreatment,
  orderZombies,
  pickFilterHeroes,
  summaryCounts,
  tombstoneTreatment,
  ZONE_CAP,
  type CreatureBasename,
} from "@/lib/scene-view";
import { type GraveyardRow } from "@/lib/graveyard-view";
import {
  arbDecayLevel,
  arbGraveyardRows,
  arbIso,
  arbLifecycleState,
  arbOverride,
  arbRepoFacts,
} from "./arbitraries";

/**
 * The closed set of art basenames `creatureImage` is allowed to return. The
 * property asserts the result is always a member of this set and never
 * anything else.
 */
const CREATURE_BASENAMES: ReadonlySet<CreatureBasename> = new Set<CreatureBasename>([
  "ghost-0",
  "ghost-1",
  "ghost-2",
  "ghost-3",
  "zombie-0",
  "zombie-1",
  "zombie-2",
  "zombie-3",
  "zombie-4",
  "risen",
  "tomb-arch-fresh",
  "coffin",
]);

/**
 * Independent reference for the expected basename, derived straight from the
 * acceptance criteria rather than reusing `creatureImage`'s own branches:
 *  - ghost → `ghost-N` with N the decay level clamped into 0–3 (Req 4.1)
 *  - zombie → `zombie-N` with N the decay level clamped into 0–4 (Req 4.2)
 *  - risen → `risen` (Req 4.3)
 *  - tombstone → `tomb-arch-fresh` (Req 4.4)
 *  - coffin → `coffin` (Req 4.5)
 * A null / non-finite / out-of-band decay level clamps into the valid band so
 * the map stays total (Req 4.6–4.8).
 */
function expectedBasename(
  state: LifecycleState,
  decayLevel: number | null,
): CreatureBasename {
  const clamp = (value: number | null, max: number): number => {
    if (value === null || !Number.isFinite(value)) {
      return 0;
    }
    const level = Math.trunc(value);
    if (level < 0) return 0;
    if (level > max) return max;
    return level;
  };
  switch (state) {
    case "ghost":
      return `ghost-${clamp(decayLevel, 3)}` as CreatureBasename;
    case "zombie":
      return `zombie-${clamp(decayLevel, 4)}` as CreatureBasename;
    case "risen":
      return "risen";
    case "tombstone":
      return "tomb-arch-fresh";
    case "coffin":
      return "coffin";
  }
}

describe("Feature: haunted-graveyard-scene, Property 1: Creature image matches state and decay", () => {
  // Arm A — every (state, decayLevel) pair the view-model can carry, including
  // the ghost 0–3 / zombie 0–4 / null-elsewhere contract plus defensive
  // out-of-band levels. `creatureImage` must return exactly one member of the
  // closed basename set, matching the independent mapping, and never throw.
  it("returns one closed-set basename matching the mapping, for any state and consistent decay", () => {
    fc.assert(
      fc.property(
        arbLifecycleState.chain((state) =>
          arbDecayLevel(state).map((decayLevel) => ({ state, decayLevel })),
        ),
        ({ state, decayLevel }) => {
          const basename = creatureImage(state, decayLevel);
          return (
            CREATURE_BASENAMES.has(basename) &&
            basename === expectedBasename(state, decayLevel)
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Arm A' — out-of-band / degenerate decay levels (negative, far above the
  // band, fractional, non-finite) still clamp into the valid band and yield a
  // closed-set basename without throwing (Req 4.6–4.8 defence).
  it("clamps out-of-band decay into the valid band and stays total", () => {
    fc.assert(
      fc.property(
        arbLifecycleState,
        fc.oneof(
          fc.constant<number | null>(null),
          fc.integer({ min: -100, max: 100 }),
          fc.double({ min: -100, max: 100, noNaN: false }),
          fc.constantFrom(
            Number.NaN,
            Number.POSITIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
          ),
        ),
        (state, decayLevel) => {
          const basename = creatureImage(state, decayLevel);
          return (
            CREATURE_BASENAMES.has(basename) &&
            basename === expectedBasename(state, decayLevel)
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Arm B — exercise exactly the (state, decayLevel) pairs that the real
  // `classify` engine can produce (ghost 0–3, zombie 0–4, others null) by
  // generating repo facts + optional overrides and a `now`, classifying, then
  // feeding the engine's own output into `creatureImage`. This confirms the map
  // is total over every pair classify emits and never throws.
  it("handles every (state, decay) pair produced by classify", () => {
    fc.assert(
      fc.property(
        arbRepoFacts,
        fc.option(arbOverride, { nil: undefined }),
        arbIso,
        (repo, override, now) => {
          const { state, decayLevel } = classify(repo, override, now);
          const basename = creatureImage(state, decayLevel);
          return (
            CREATURE_BASENAMES.has(basename) &&
            basename === expectedBasename(state, decayLevel)
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

/** The five per-state buckets `summaryCounts` partitions rows into. */
const SUMMARY_STATES: readonly LifecycleState[] = [
  "ghost",
  "risen",
  "zombie",
  "tombstone",
  "coffin",
];

describe("Feature: haunted-graveyard-scene, Property 4: Summary counts partition the repositories", () => {
  // For any list of rows, `summaryCounts` must partition them: every per-state
  // count is non-negative, the per-state counts sum to the total number of
  // rows, and `souls` equals that same total (Req 7.3 / 7.4). We also
  // independently recompute each per-state count by filtering the input, so the
  // property does not merely reflect the implementation's own tallying.
  it("per-state counts are non-negative, sum to the total, and souls equals rows.length", () => {
    fc.assert(
      fc.property(arbGraveyardRows, (rows) => {
        const counts = summaryCounts(rows);

        // Every per-state count is a non-negative integer.
        const perState = SUMMARY_STATES.map((state) => counts[state]);
        if (
          !perState.every(
            (count) => Number.isInteger(count) && count >= 0,
          )
        ) {
          return false;
        }

        // The per-state counts partition the input: they sum to the total.
        const sum = perState.reduce((total, count) => total + count, 0);
        if (sum !== rows.length) {
          return false;
        }

        // `souls` is the total, equal to rows.length.
        if (counts.souls !== rows.length) {
          return false;
        }

        // Independent recomputation: each per-state count equals the number of
        // input rows actually in that state (not derived from `summaryCounts`).
        for (const state of SUMMARY_STATES) {
          const expected = rows.filter((row) => row.state === state).length;
          if (counts[state] !== expected) {
            return false;
          }
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: haunted-graveyard-scene, Property 3: Moon treatment follows the health comparison", () => {
  // The moon turns blood-red strictly when the "undead" population
  // (zombie + risen) outnumbers the "settled" population (ghost + tombstone);
  // ties and a settled majority stay pale (Req 3.2). We count each state
  // independently by filtering the input rows — never via `summaryCounts` — so
  // the property validates the comparison itself rather than reflecting the
  // implementation's own tally. `arbGraveyardRows` spans empty lists and varied
  // state mixes, so it naturally hits ties and both sides of the comparison.
  // **Validates: Requirements 3.2**
  it("is blood-red iff (zombie + risen) > (ghost + tombstone), else pale", () => {
    fc.assert(
      fc.property(arbGraveyardRows, (rows) => {
        const countState = (state: LifecycleState): number =>
          rows.filter((row) => row.state === state).length;

        const zombie = countState("zombie");
        const risen = countState("risen");
        const ghost = countState("ghost");
        const tombstone = countState("tombstone");

        const expected: "blood-red" | "pale" =
          zombie + risen > ghost + tombstone ? "blood-red" : "pale";

        return moonTreatment(rows) === expected;
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: haunted-graveyard-scene, Property 5: Fog density is monotonic in zombie count", () => {
  // `fogDensity` maps a zombie count to an overlay density. The contract
  // (Req 3.3 / Property 5): the result is always within [0,100]; it is exactly
  // 0 iff the count is 0; it is exactly 100 iff the count is at or above the
  // full-house threshold (FOG_FULL_ZOMBIES, 20); and it is monotonic
  // non-decreasing in the count. `fc.nat({ max: 60 })` spans the empty case,
  // the strictly-interior band (1..19), the exact full threshold, and well
  // beyond it so every branch of the contract is exercised.
  // **Validates: Requirements 3.3**
  it("is clamped to [0,100], 0 iff count 0, 100 iff count >= 20", () => {
    fc.assert(
      fc.property(fc.nat({ max: 60 }), (count) => {
        const density = fogDensity(count);

        // Clamped to the inclusive [0,100] range.
        if (!(density >= 0 && density <= 100)) {
          return false;
        }

        // 0 iff the count is 0: an empty graveyard clears the fog, and any
        // non-empty count produces strictly positive density.
        if (count === 0) {
          if (density !== 0) return false;
        } else {
          if (!(density > 0)) return false;
        }

        // 100 iff the count is at or above the full-house threshold; strictly
        // below it the density stays under 100.
        if (count >= FOG_FULL_ZOMBIES) {
          if (density !== 100) return false;
        } else {
          if (!(density < 100)) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // Monotonicity: for any ordered pair of counts a <= b, the fog never thins as
  // the zombie count grows (Req 3.3 / Property 5). We draw two independent
  // counts and sort them so the pair always satisfies a <= b.
  it("is monotonic non-decreasing in the zombie count", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(fc.nat({ max: 60 }), fc.nat({ max: 60 }))
          .map(([x, y]): [number, number] => (x <= y ? [x, y] : [y, x])),
        ([a, b]) => fogDensity(a) <= fogDensity(b),
      ),
      { numRuns: 100 },
    );
  });
});

describe("Feature: haunted-graveyard-scene, Property 6: Lightning interval is monotonic and bounded", () => {
  // Zero ancient zombies means no lightning at all: the interval is null
  // (Req 3.5). This is the single boundary case, asserted directly.
  it("returns null when the ancient count is 0", () => {
    if (lightningIntervalSeconds(0) !== null) {
      throw new Error("expected null interval for ancient count 0");
    }
  });

  // For any ancient count >= 1 the interval equals the acceptance-criteria
  // formula max(FLOOR, BASE − STEP × (count − 1)), recomputed independently
  // from the exported constants rather than reusing the implementation's own
  // branches, and always sits within the inclusive [FLOOR, BASE] band
  // (Req 3.4). `fc.integer({min:1,max:30})` spans the single-ancient base case,
  // the strictly-interior stepping band, and counts well past the floor.
  // **Validates: Requirements 3.4, 3.5**
  it("equals max(FLOOR, BASE − STEP × (count − 1)) and stays within [FLOOR, BASE] for count >= 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (ancientCount) => {
        const interval = lightningIntervalSeconds(ancientCount);
        const expected = Math.max(
          LIGHTNING_FLOOR_SECONDS,
          LIGHTNING_BASE_SECONDS - LIGHTNING_STEP_SECONDS * (ancientCount - 1),
        );
        if (interval !== expected) {
          return false;
        }
        return (
          interval !== null &&
          interval >= LIGHTNING_FLOOR_SECONDS &&
          interval <= LIGHTNING_BASE_SECONDS
        );
      }),
      { numRuns: 100 },
    );
  });

  // Monotonic non-increasing: as more ancient zombies crowd in, the lightning
  // only strikes more often, never less (Req 3.4). We draw two counts (both
  // >= 1) and sort them so the pair always satisfies a <= b, then assert the
  // interval for the smaller count is at least that of the larger.
  it("is monotonic non-increasing in the ancient count", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(fc.integer({ min: 1, max: 30 }), fc.integer({ min: 1, max: 30 }))
          .map(([x, y]): [number, number] => (x <= y ? [x, y] : [y, x])),
        ([a, b]) => {
          const intervalA = lightningIntervalSeconds(a);
          const intervalB = lightningIntervalSeconds(b);
          return (
            intervalA !== null &&
            intervalB !== null &&
            intervalA >= intervalB
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * A generator for a list of zombie `GraveyardRow`s with a decay level drawn
 * from the full 0–4 band. Each row is given a unique `name` that embeds its
 * original input index so the test can both (a) confirm the output is a
 * permutation of the input (compare by the unique name key) and (b) verify
 * tie-stability by recovering each row's original input position. The list
 * spans empty, single, and many-row cases and deliberately reuses decay levels
 * across rows so ties are common.
 */
const arbZombieRowsForOrdering: fc.Arbitrary<GraveyardRow[]> = fc
  .array(
    fc.record({
      decayLevel: fc.integer({ min: 0, max: 4 }),
      daysQuiet: fc.integer({ min: 182, max: 2000 }),
    }),
    { minLength: 0, maxLength: 30 },
  )
  .map((specs) =>
    specs.map(
      (spec, index): GraveyardRow => ({
        // The index makes every name unique, so it doubles as a stable key and
        // as a record of the row's original input position.
        name: `zombie-${index}`,
        url: "https://github.com/owner/repo",
        state: "zombie",
        daysQuiet: spec.daysQuiet,
        decayLevel: spec.decayLevel,
      }),
    ),
  );

describe("Feature: haunted-graveyard-scene, Property 2: Zombie ordering is monotonic by decay near the gate", () => {
  // The "effective" decay the ordering keys off of: the implementation treats a
  // null / non-finite decay level defensively as 0, and the assertions mirror
  // that so the property validates the real contract rather than an idealized
  // one. For this generator decay is always a finite 0–4 integer, but the
  // helper keeps the test robust to that contract.
  const effectiveDecay = (row: GraveyardRow): number =>
    row.decayLevel === null || !Number.isFinite(row.decayLevel)
      ? 0
      : row.decayLevel;

  // `orderZombies` must produce a deterministic placement that reads as data:
  // lowest decay nearest the gate (first), highest decay farthest (last), so
  // decay is monotonic non-decreasing across the output with increasing
  // distance from the gate (Req 5.3); rows sharing a decay level keep their
  // input order, i.e. the sort is stable (Req 5.4); the output is a permutation
  // of the input (nothing dropped, duplicated, or invented); and the caller's
  // array is never mutated.
  // **Validates: Requirements 5.3, 5.4**
  it("is a stable, non-mutating permutation with decay monotonic non-decreasing from the gate", () => {
    fc.assert(
      fc.property(arbZombieRowsForOrdering, (input) => {
        // Snapshot the input's identity and order up front so we can prove
        // `orderZombies` did not mutate the caller's array.
        const inputSnapshot = input.slice();
        const inputNames = input.map((row) => row.name);

        const output = orderZombies(input);

        // --- Non-mutation: the caller's array is untouched. ---
        if (input.length !== inputSnapshot.length) {
          return false;
        }
        for (let i = 0; i < input.length; i += 1) {
          // Same element identity in the same slot — the original array was
          // neither reordered nor had its elements swapped out.
          if (input[i] !== inputSnapshot[i]) {
            return false;
          }
        }

        // --- Permutation: same length and same multiset of rows by key. ---
        if (output.length !== input.length) {
          return false;
        }
        const outputNames = output.map((row) => row.name);
        if ([...outputNames].sort().join("\u0000") !== [...inputNames].sort().join("\u0000")) {
          return false;
        }
        // Every output row is one of the exact row objects from the input (no
        // invented or cloned rows).
        const inputSet = new Set(input);
        for (const row of output) {
          if (!inputSet.has(row)) {
            return false;
          }
        }

        // --- Monotonic non-decreasing decay across the output. ---
        for (let i = 1; i < output.length; i += 1) {
          if (effectiveDecay(output[i - 1]) > effectiveDecay(output[i])) {
            return false;
          }
        }

        // --- Tie-stability: within each decay level, output order equals
        // input order. We recover each row's original input index from its
        // unique name and check that, for rows sharing a decay level, those
        // indices appear in strictly ascending order in the output. ---
        const inputIndexOf = new Map<string, number>();
        input.forEach((row, index) => inputIndexOf.set(row.name, index));

        const lastIndexSeenForDecay = new Map<number, number>();
        for (const row of output) {
          const decay = effectiveDecay(row);
          const originalIndex = inputIndexOf.get(row.name) ?? -1;
          const previousIndex = lastIndexSeenForDecay.get(decay);
          if (previousIndex !== undefined && originalIndex <= previousIndex) {
            // A row within this decay level appeared out of its input order.
            return false;
          }
          lastIndexSeenForDecay.set(decay, originalIndex);
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: haunted-graveyard-scene, Property 7: Tombstone darkness and tilt are monotonic in daysQuiet", () => {
  // `tombstoneTreatment` maps a tombstone's `daysQuiet` to two display factors,
  // `darkness` and `tilt`. The contract (Req 5.5 / Property 7): both factors
  // stay within the safe [0,1] display range for every input; a fresh
  // tombstone (daysQuiet 0) sits at the minimum (darkness 0, tilt 0), confirmed
  // against the implementation's saturating curve days/(days+halfLife); and
  // each factor is monotonic non-decreasing in `daysQuiet`, so a tombstone that
  // has been quiet strictly longer is rendered at least as dark and at least as
  // tilted. `fc.nat({ max: 5000 })` spans the fresh case and days well past
  // both half-lives (120 and 200) where the curve nears saturation.
  // **Validates: Requirements 5.5**
  it("keeps darkness and tilt within [0,1] and pins the fresh tombstone to the minimum", () => {
    fc.assert(
      fc.property(fc.nat({ max: 5000 }), (daysQuiet) => {
        const { darkness, tilt } = tombstoneTreatment(daysQuiet);

        // Both factors stay within the safe [0,1] display range.
        if (!(darkness >= 0 && darkness <= 1)) return false;
        if (!(tilt >= 0 && tilt <= 1)) return false;

        // A fresh tombstone (daysQuiet 0) sits at the minimum treatment.
        if (daysQuiet === 0) {
          if (darkness !== 0 || tilt !== 0) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // Monotonicity: for any ordered pair a <= b, a tombstone quiet longer is never
  // lighter or less tilted (Req 5.5 / Property 7). We draw two independent nats
  // and sort them so the pair always satisfies a <= b, then assert both factors
  // are non-decreasing across the pair.
  it("is monotonic non-decreasing in daysQuiet for both darkness and tilt", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(fc.nat({ max: 5000 }), fc.nat({ max: 5000 }))
          .map(([x, y]): [number, number] => (x <= y ? [x, y] : [y, x])),
        ([a, b]) => {
          const lower = tombstoneTreatment(a);
          const higher = tombstoneTreatment(b);
          return (
            lower.darkness <= higher.darkness && lower.tilt <= higher.tilt
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
describe("Feature: haunted-graveyard-scene, Property 8: Zone capping partitions the Creatures", () => {
  // `capZone` splits a zone's creature count into the `rendered` ones (drawn
  // individually) and the `more` ones (rolled into the "+N more" group). The
  // contract (Req 11.3 / Property 8): for any count C, rendered = min(C, cap)
  // and more = max(0, C − cap). We recompute both expectations independently
  // from the exported `ZONE_CAP` rather than reusing the implementation's own
  // branches, and also assert the partition invariants hold: the two sides sum
  // back to the count, `rendered` never exceeds the cap, and `more` is never
  // negative. `fc.nat({ max: 60 })` spans counts below the cap, exactly at it,
  // and well above it so every side of the boundary is exercised.
  // **Validates: Requirements 11.3**
  it("returns rendered = min(count, cap), more = max(0, count − cap), and partitions the count", () => {
    fc.assert(
      fc.property(fc.nat({ max: 60 }), (count) => {
        const { rendered, more } = capZone(count, ZONE_CAP);

        const expectedRendered = Math.min(count, ZONE_CAP);
        const expectedMore = Math.max(0, count - ZONE_CAP);

        // Matches the acceptance-criteria formulas exactly.
        if (rendered !== expectedRendered) return false;
        if (more !== expectedMore) return false;

        // Partition invariants: the two sides sum back to the whole count,
        // `rendered` stays within the cap, and `more` is non-negative.
        if (rendered + more !== count) return false;
        if (rendered > ZONE_CAP) return false;
        if (more < 0) return false;

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // The default-cap call must behave identically to passing ZONE_CAP
  // explicitly, so the module default and the public constant stay in lockstep.
  it("defaults the cap to ZONE_CAP when omitted", () => {
    fc.assert(
      fc.property(fc.nat({ max: 60 }), (count) => {
        const withDefault = capZone(count);
        const withExplicit = capZone(count, ZONE_CAP);
        return (
          withDefault.rendered === withExplicit.rendered &&
          withDefault.more === withExplicit.more
        );
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * A generator for a `FilterHeroHints` object whose three hint fields each
 * either (a) are absent (undefined), (b) name a row that is PRESENT in the
 * input rows, or (c) name a row that is ABSENT from the input rows. Drawing an
 * absent hint confirms that a hint pointing at a non-existent creature is
 * ignored; drawing a present hint confirms it can be honored. Taking `rows`
 * as input keeps the present/absent split meaningful for each case.
 */
const arbFilterHeroHints = (
  rows: GraveyardRow[],
): fc.Arbitrary<{
  hovered?: string | null;
  selected?: string | null;
  turningSoon?: string | null;
}> => {
  const presentNames = rows.map((row) => row.name);
  // One hint field generator: undefined, a present name (when any exist), or an
  // absent name that is guaranteed not to appear in the rows.
  const arbHint: fc.Arbitrary<string | null | undefined> = fc.oneof(
    fc.constant<string | null | undefined>(undefined),
    fc.constant<string | null | undefined>(null),
    presentNames.length > 0
      ? fc.constantFrom(...presentNames)
      : fc.constant<string | null | undefined>(undefined),
    // An absent name: the "\u0000" prefix never occurs in generated row names.
    fc.string().map((s) => `\u0000absent-${s}`),
  );
  return fc.record({
    hovered: arbHint,
    selected: arbHint,
    turningSoon: arbHint,
  });
};

describe("Feature: haunted-graveyard-scene, Property 9: Filter-hero budget is bounded and prioritized", () => {
  // `pickFilterHeroes` chooses which creatures may use the expensive filter
  // effects. The contract (Req 6.9 / Property 9): the result holds at most
  // FILTER_HERO_BUDGET (4) names; every chosen name is one actually present in
  // the input rows (a hint pointing at an absent creature carries nothing, so
  // it is ignored); and the choice is deterministic — identical inputs yield an
  // identical set. We draw whole row lists from `arbGraveyardRows` and hints
  // from `arbFilterHeroHints` (each hint undefined, a present name, or an
  // absent name) so both the honored-hint and ignored-hint cases are exercised.
  // **Validates: Requirements 6.9**
  it("returns at most the budget, drawn only from input rows, and deterministically", () => {
    fc.assert(
      fc.property(
        arbGraveyardRows.chain((rows) =>
          arbFilterHeroHints(rows).map((hints) => ({ rows, hints })),
        ),
        ({ rows, hints }) => {
          const present = new Set(rows.map((row) => row.name));

          const heroes = pickFilterHeroes(rows, hints);

          // Bounded: never more than the budget of 4.
          if (heroes.size > FILTER_HERO_BUDGET) {
            return false;
          }

          // Drawn only from input rows: every chosen name is present on screen.
          for (const name of heroes) {
            if (!present.has(name)) {
              return false;
            }
          }

          // Determinism: a second call with the identical inputs yields a set
          // with exactly the same members.
          const again = pickFilterHeroes(rows, hints);
          if (again.size !== heroes.size) {
            return false;
          }
          for (const name of heroes) {
            if (!again.has(name)) {
              return false;
            }
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Focused priority / presence case: with MORE than the budget of distinct
  // present rows and three distinct hints that each name a present row, all
  // three prioritized hints (hovered, turning-soon, selected) land in the
  // result — the budget has room for them before the deterministic fill — while
  // a hint naming an ABSENT row is ignored and never appears.
  it("honors present hints within the budget and ignores absent hints", () => {
    fc.assert(
      fc.property(
        // Build > FILTER_HERO_BUDGET rows with guaranteed-unique names so we can
        // pick three distinct present hints and still have fill rows left over.
        fc
          .integer({ min: FILTER_HERO_BUDGET + 2, max: FILTER_HERO_BUDGET + 10 })
          .map((count) =>
            Array.from(
              { length: count },
              (_unused, index): GraveyardRow => ({
                name: `repo-${index}`,
                url: "https://github.com/owner/repo",
                state: "zombie",
                daysQuiet: 400,
                decayLevel: 2,
              }),
            ),
          ),
        (rows) => {
          // Three distinct present names for the three prioritized hints.
          const hovered = rows[0].name;
          const turningSoon = rows[1].name;
          const selected = rows[2].name;
          // A name guaranteed not to be among the rows.
          const absent = "\u0000absent-repo";

          const heroes = pickFilterHeroes(rows, {
            hovered,
            turningSoon,
            selected,
          });

          // All three present, distinct, prioritized hints are included.
          if (
            !heroes.has(hovered) ||
            !heroes.has(turningSoon) ||
            !heroes.has(selected)
          ) {
            return false;
          }

          // An absent hint is never honored.
          const withAbsent = pickFilterHeroes(rows, {
            hovered: absent,
            turningSoon,
            selected,
          });
          if (withAbsent.has(absent)) {
            return false;
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * A generator for a non-zombie, non-turning-soon list of `GraveyardRow`s: only
 * tombstone / coffin / risen rows, plus ghosts that are NOT within the
 * turning-soon window. A ghost qualifies for the "grows cold…" whisper only
 * when `daysLeft = ghostMaxDaysQuiet (90) − daysQuiet` lands in [0, 30], i.e.
 * daysQuiet in [60, 90]; drawing ghost daysQuiet strictly below 60 keeps every
 * ghost well clear of the window. With no zombie rows either, `composeWhispers`
 * has no qualifying data and must return []. Spans empty through many rows.
 */
const arbNoWhisperRows: fc.Arbitrary<GraveyardRow[]> = fc.array(
  fc.oneof(
    // A settled / sealed / risen row — none of these ever source a whisper.
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 40 }),
      url: fc.constant("https://github.com/owner/repo"),
      state: fc.constantFrom<LifecycleState>("tombstone", "coffin", "risen"),
      daysQuiet: fc.integer({ min: 0, max: 2000 }),
      decayLevel: fc.constant<number | null>(null),
    }),
    // A ghost comfortably outside the turning-soon window (daysQuiet < 60 means
    // daysLeft > 30), so it is never called out as "grows cold…".
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 40 }),
      url: fc.constant("https://github.com/owner/repo"),
      state: fc.constant<LifecycleState>("ghost"),
      daysQuiet: fc.integer({ min: 0, max: 59 }),
      decayLevel: fc.integer({ min: 0, max: 3 }),
    }),
  ),
  { minLength: 0, maxLength: 30 },
);

describe("Feature: haunted-graveyard-scene, Property 10: Whispers are built only from loaded data", () => {
  // `composeWhispers(rows, repos, now)` narrates at most two facts drawn
  // strictly from the loaded data: "<name> is still waiting for you…" for the
  // freshest zombie, and "<name> grows cold…" for a ghost inside the
  // turning-soon window. The contract (Req 8.2 / 8.3 / Property 10): every
  // returned string is composed from a name present in the input rows — the
  // function never invents a name or fact — and it returns [] when no
  // qualifying data exists.
  //
  // `repos` is used only for pushed-at tie-break lookups by name, so passing an
  // empty repos array is safe and keeps the property focused on the "built from
  // loaded rows" invariant. `now` is a fixed ISO string (the function derives
  // every whisper from the rows, not the clock).
  // **Validates: Requirements 8.2, 8.3**
  const NOW = "2024-01-01T00:00:00.000Z";

  // Arm A — every returned whisper is composed from a name present in `rows`.
  // The emitted formats are "<name> is still waiting for you…" and
  // "<name> grows cold…", so each whisper must START WITH "<name> " for some
  // row name actually present in the input. This proves the text is built only
  // from loaded data and never fabricates a name. `arbGraveyardRows` spans
  // empty lists, mixed-state lists, and the zombie bands, so it naturally
  // exercises zero, one, and both whispers.
  it("composes every whisper from a name present in the input rows", () => {
    fc.assert(
      fc.property(arbGraveyardRows, (rows) => {
        const whispers = composeWhispers(rows, [], NOW);

        for (const whisper of whispers) {
          // There must exist a row whose name is the leading "<name> " prefix of
          // this whisper. Requiring the "<name> " prefix (name followed by a
          // space) — rather than a bare substring — ties the whisper to a real
          // row even when a row name is unusual, and rules out a fabricated
          // name. A degenerate empty-string row name cannot form a "<name> "
          // prefix, so it is correctly never credited as a source.
          const sourced = rows.some(
            (row) => row.name.length > 0 && whisper.startsWith(`${row.name} `),
          );
          if (!sourced) {
            return false;
          }
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // Arm B — when no qualifying data exists (no zombie rows and no ghost within
  // the turning-soon window), `composeWhispers` returns the empty list (Req
  // 8.3). `arbNoWhisperRows` constructs exactly that focused case: only
  // tombstone / coffin / risen rows and ghosts safely outside the window.
  it("returns [] when no zombie and no turning-soon ghost qualifies", () => {
    fc.assert(
      fc.property(arbNoWhisperRows, (rows) => {
        const whispers = composeWhispers(rows, [], NOW);
        return whispers.length === 0;
      }),
      { numRuns: 100 },
    );
  });

  // Arm C — determinism: the same inputs always yield the same array, element
  // for element. `composeWhispers` is pure, so a second call must reproduce the
  // first exactly.
  it("is deterministic — identical inputs yield an identical array", () => {
    fc.assert(
      fc.property(arbGraveyardRows, (rows) => {
        const first = composeWhispers(rows, [], NOW);
        const second = composeWhispers(rows, [], NOW);
        if (first.length !== second.length) {
          return false;
        }
        for (let i = 0; i < first.length; i += 1) {
          if (first[i] !== second[i]) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: haunted-graveyard-scene, Property 11: Animation delay is deterministic and bounded", () => {
  // `animationDelay(name)` hashes a repo name to a stable per-creature stagger,
  // in seconds, so no two creatures in a zone begin their cycle at the same
  // instant while the delay stays identical across renders for the same name.
  // The contract (Req 6.8 / Property 11): the result always falls within its
  // documented half-open range [0, ANIMATION_DELAY_MAX_SECONDS) — never
  // negative, never at or above the exclusive upper bound — and it is
  // deterministic, returning the same value on repeated calls for the same
  // name. The function is also total: it must produce a finite number for any
  // string without throwing. `fc.string()` spans the empty string and ordinary
  // names; a second arm covers unusual full-Unicode (grapheme) input.
  // **Validates: Requirements 6.8**

  // Arm A — bounded, finite, and deterministic across the common name space.
  // `fc.string()` naturally includes the empty string, so the total-on-empty
  // contract is exercised here too.
  it("stays within [0, ANIMATION_DELAY_MAX_SECONDS) and is deterministic for any string", () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        const delay = animationDelay(name);

        // Finite: never NaN or infinite, so it can be rendered as a CSS delay.
        if (!Number.isFinite(delay)) {
          return false;
        }

        // Bounded to the documented half-open range: at or above 0, and
        // strictly below the exclusive upper bound.
        if (!(delay >= 0 && delay < ANIMATION_DELAY_MAX_SECONDS)) {
          return false;
        }

        // Deterministic: a second call with the identical name returns the
        // exact same value (the delay is stable across renders).
        if (animationDelay(name) !== delay) {
          return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // Arm B — the same contract holds for full-Unicode names (emoji, surrogate
  // pairs, combining marks), confirming the hash stays total and in-range for
  // names well outside the ASCII band. `fc.string({ unit: "grapheme" })` draws
  // from user-perceived characters, so it spans multi-code-unit emoji and
  // combining sequences rather than just the ASCII band.
  it("stays bounded and deterministic for full-Unicode names", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme" }), (name) => {
        const first = animationDelay(name);
        const second = animationDelay(name);
        return (
          Number.isFinite(first) &&
          first >= 0 &&
          first < ANIMATION_DELAY_MAX_SECONDS &&
          first === second
        );
      }),
      { numRuns: 100 },
    );
  });

  // Arm C — explicit edge inputs asserted directly, independent of the
  // generators: the empty string must hash to a well-defined in-range delay
  // (total-on-empty contract) and repeated calls agree.
  it("handles the empty string as a total, in-range, deterministic input", () => {
    const first = animationDelay("");
    const second = animationDelay("");
    if (!Number.isFinite(first)) {
      throw new Error("expected a finite delay for the empty string");
    }
    if (!(first >= 0 && first < ANIMATION_DELAY_MAX_SECONDS)) {
      throw new Error(
        `expected the empty-string delay in [0, ${ANIMATION_DELAY_MAX_SECONDS}), got ${first}`,
      );
    }
    if (first !== second) {
      throw new Error("expected the empty-string delay to be deterministic");
    }
  });
});
