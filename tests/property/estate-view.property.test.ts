/**
 * Feature: estate-map-places — fast-check property tests for the pure estate
 * view-model (`lib/estate-view.ts`).
 *
 * This file holds the four correctness properties from the design, one
 * `describe` block per property, each tagged
 * "Feature: estate-map-places, Property N: <title>". Later tasks append more
 * describe blocks for `orderForPlace`, `paginate`, and `plaqueCopy`; keep each
 * property self-contained.
 *
 * All generators are the shared estate arbitraries in `./arbitraries` (which
 * reuse the existing `arbGraveyardRow` / `arbGraveyardRows`). Each property
 * runs at least 100 cases.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { type LifecycleState } from "@/lib/lifecycle";
import { placeOf, PLACE_ORDER, type PlaceId } from "@/lib/estate-view";
import { arbGraveyardRows, arbLifecycleState } from "./arbitraries";

/**
 * The exact state→place mapping straight from the acceptance criteria
 * (Requirements 3.1–3.5), written independently of `placeOf`'s own switch so
 * the property checks the implementation against the spec rather than against
 * itself.
 */
const EXPECTED_PLACE: Record<LifecycleState, PlaceId> = {
  ghost: "sky",
  zombie: "gate",
  risen: "gate",
  tombstone: "ground",
  coffin: "crypt",
};

/** The closed set of the four place ids `placeOf` is allowed to return. */
const PLACE_IDS: ReadonlySet<PlaceId> = new Set<PlaceId>(PLACE_ORDER);

describe("Feature: estate-map-places, Property 1: placeOf is exhaustive and total (state→place mapping)", () => {
  // Arm A — every lifecycle state maps to exactly one of the four place ids,
  // the mapping matches the spec exactly (ghost→sky, zombie→gate, risen→gate,
  // tombstone→ground, coffin→crypt), and placeOf never yields undefined and
  // never throws. (Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6)
  it("maps every lifecycle state to exactly one of the four places, never undefined, never throwing", () => {
    fc.assert(
      fc.property(arbLifecycleState, (state) => {
        const place = placeOf({ state });
        return (
          place !== undefined &&
          PLACE_IDS.has(place) &&
          place === EXPECTED_PLACE[state]
        );
      }),
      { numRuns: 100 },
    );
  });

  // Arm A' — the exact mapping asserted directly, independent of generators, so
  // the five spec clauses (3.1–3.5) are each pinned by name.
  it("pins the exact mapping ghost→sky, zombie→gate, risen→gate, tombstone→ground, coffin→crypt", () => {
    expect(placeOf({ state: "ghost" })).toBe("sky");
    expect(placeOf({ state: "zombie" })).toBe("gate");
    expect(placeOf({ state: "risen" })).toBe("gate");
    expect(placeOf({ state: "tombstone" })).toBe("ground");
    expect(placeOf({ state: "coffin" })).toBe("crypt");
  });

  // Arm B — partition corollary (Requirement 3.7): grouping arbitrary rows by
  // placeOf assigns every row to exactly one place, omits no row, and the four
  // group sizes sum to the input row count. "Exactly one place" follows from
  // placeOf being a total function (Arm A); here we verify the grouping is a
  // true partition: sizes sum to the total and no row is dropped or duplicated.
  it("groups any rows by placeOf into a partition whose four group sizes sum to rows.length", () => {
    fc.assert(
      fc.property(arbGraveyardRows, (rows) => {
        // Bucket each row under its place, counting membership.
        const groups: Record<PlaceId, number> = {
          sky: 0,
          gate: 0,
          ground: 0,
          crypt: 0,
        };
        for (const row of rows) {
          const place = placeOf(row);
          // Every row lands in a known place (exactly one bucket).
          if (!PLACE_IDS.has(place)) {
            return false;
          }
          groups[place] += 1;
        }
        const total = groups.sky + groups.gate + groups.ground + groups.crypt;
        // Partition: the four group sizes sum to the input count — no row lost,
        // none counted twice.
        return total === rows.length;
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: orderForPlace is a stable, per-place-correct permutation.
//
// This block appends to the file (one describe per property). It imports the
// additional surface it needs — `orderForPlace`, the `arbPlaceId` /
// `arbGraveyardRow` arbitraries, and the `GraveyardRow` type — alongside the
// Property 1 imports above. A local `arbRowWithOddKeys` variant injects
// null/NaN `decayLevel`/`daysQuiet` (which the shared `arbGraveyardRows` never
// produces) so the totality clause is actually exercised, and every row is
// tagged with its original input index so the stability clause can assert that
// equal-key rows keep ascending input order.
// ---------------------------------------------------------------------------

import { orderForPlace } from "@/lib/estate-view";
import { arbPlaceId, arbGraveyardRow } from "./arbitraries";
import { type GraveyardRow } from "@/lib/graveyard-view";

/**
 * A `GraveyardRow` whose sort keys may be the pathological values the shared
 * generator never emits: `null` and `NaN` `decayLevel`, and `NaN`/`Infinity`
 * `daysQuiet`. `orderForPlace` must treat these as `0` and never throw or
 * produce NaN comparisons, so this variant drives the totality clause.
 */
const arbRowWithOddKeys: fc.Arbitrary<GraveyardRow> = arbGraveyardRow.chain(
  (row) =>
    fc.record({
      decayLevel: fc.oneof(
        fc.constant(row.decayLevel),
        fc.constant<number | null>(null),
        fc.constant(Number.NaN),
      ),
      daysQuiet: fc.oneof(
        fc.constant(row.daysQuiet),
        fc.constant(Number.NaN),
        fc.constant(Number.POSITIVE_INFINITY),
        fc.constant(Number.NEGATIVE_INFINITY),
      ),
    }).map(({ decayLevel, daysQuiet }) => ({ ...row, decayLevel, daysQuiet })),
);

/**
 * A list of rows that mixes ordinary rows with the odd-key variant, spanning
 * empty and non-empty lengths. Every property below draws from this so the
 * null/NaN totality clause is exercised across the same runs as the ordering
 * clauses.
 */
const arbOddKeyRows: fc.Arbitrary<GraveyardRow[]> = fc.array(
  fc.oneof(arbGraveyardRow, arbRowWithOddKeys),
  { minLength: 0, maxLength: 40 },
);

/**
 * The same 0-collapsing key readers `orderForPlace` uses internally, written
 * independently here so the monotonicity assertions compare against the spec's
 * "null/NaN → 0" rule rather than against the implementation.
 */
const decayKey = (row: GraveyardRow): number =>
  row.decayLevel === null || !Number.isFinite(row.decayLevel) ? 0 : row.decayLevel;
const quietKey = (row: GraveyardRow): number =>
  Number.isFinite(row.daysQuiet) ? row.daysQuiet : 0;

/**
 * Builds a stable multiset signature for a list of rows: each row rendered to a
 * string keyed on its identity-relevant fields, then sorted. Two lists are a
 * permutation of each other iff their signatures are equal. Rows are compared
 * by `(name, state, decayLevel, daysQuiet)` — enough to catch a dropped,
 * duplicated, or mutated row.
 */
function multisetSignature(rows: GraveyardRow[]): string[] {
  return rows
    .map(
      (r) =>
        `${r.name}\u0000${r.state}\u0000${String(r.decayLevel)}\u0000${String(r.daysQuiet)}`,
    )
    .sort();
}

/** A deep snapshot of a row's four comparison-relevant fields, for mutation checks. */
function snapshot(rows: GraveyardRow[]): string[] {
  return rows.map(
    (r) =>
      `${r.name}\u0000${r.state}\u0000${String(r.decayLevel)}\u0000${String(r.daysQuiet)}`,
  );
}

describe("Feature: estate-map-places, Property 2: orderForPlace is a stable, per-place-correct permutation", () => {
  // Clause: permutation + no mutation (Requirements 6.1, 6.9). For every place
  // and every input, the result carries the same multiset of rows as the input
  // (nothing dropped, duplicated, or altered) and the caller's array is left
  // untouched after the call.
  it("returns a permutation of the input and never mutates the caller's array", () => {
    fc.assert(
      fc.property(arbPlaceId, arbOddKeyRows, (place, rows) => {
        const before = snapshot(rows);
        const result = orderForPlace(place, rows);

        // Same multiset in, same multiset out.
        expect(multisetSignature(result)).toEqual(multisetSignature(rows));
        // Same length (a permutation preserves count).
        expect(result.length).toBe(rows.length);
        // The caller's array is unchanged (order and field values intact).
        expect(snapshot(rows)).toEqual(before);
        // A fresh array instance is returned, not the same reference.
        expect(result).not.toBe(rows);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: sky is monotonic descending in the lexicographic key
  // (decayLevel, daysQuiet) (Requirements 6.2, 6.3). For all i < j the leading
  // decay key is non-increasing, and on an equal decay key the daysQuiet key is
  // non-increasing.
  it("orders sky by (decayLevel, daysQuiet) descending", () => {
    fc.assert(
      fc.property(arbOddKeyRows, (rows) => {
        const result = orderForPlace("sky", rows);
        for (let i = 0; i + 1 < result.length; i++) {
          const a = result[i];
          const b = result[i + 1];
          // Leading key: decay never increases.
          expect(decayKey(a)).toBeGreaterThanOrEqual(decayKey(b));
          // Tie on decay: quiet never increases.
          if (decayKey(a) === decayKey(b)) {
            expect(quietKey(a)).toBeGreaterThanOrEqual(quietKey(b));
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Clause: gate ordering (Requirements 6.4, 6.5). No risen row ever follows a
  // zombie row (equivalently: there is no i < j with result[i] a zombie and
  // result[j] a risen), and within the zombie block decayLevel is monotonic
  // non-decreasing (freshest first). Rows that are neither zombie nor risen do
  // not occur at the gate (placeOf sends only zombie/risen here), but the
  // generator may still include them; the assertions below only constrain the
  // zombie/risen relationship and so stay correct regardless.
  it("orders gate with every risen before every zombie and the zombie block non-decreasing in decay", () => {
    fc.assert(
      fc.property(arbOddKeyRows, (rows) => {
        const result = orderForPlace("gate", rows);

        // No zombie precedes a risen: once a zombie is seen, no risen may follow.
        let seenZombie = false;
        for (const row of result) {
          if (row.state === "zombie") {
            seenZombie = true;
          } else if (row.state === "risen") {
            expect(seenZombie).toBe(false);
          }
        }

        // Within the zombie block, decay is non-decreasing (freshest first).
        const zombieDecays = result
          .filter((r) => r.state === "zombie")
          .map(decayKey);
        for (let i = 0; i + 1 < zombieDecays.length; i++) {
          expect(zombieDecays[i]).toBeLessThanOrEqual(zombieDecays[i + 1]);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Clause: ground and crypt order by daysQuiet ascending (Requirements 6.6,
  // 6.7 / 6.8) — newest at rest first.
  it("orders ground and crypt by daysQuiet ascending", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PlaceId>("ground", "crypt"),
        arbOddKeyRows,
        (place, rows) => {
          const result = orderForPlace(place, rows);
          for (let i = 0; i + 1 < result.length; i++) {
            expect(quietKey(result[i])).toBeLessThanOrEqual(
              quietKey(result[i + 1]),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Clause: stability (Requirement 6.9) — rows that compare equal on the
  // place's key retain their input order. Each input row is tagged with its
  // original index; after ordering, any run of rows sharing the same place key
  // must have strictly ascending original indices. The key per place matches
  // orderForPlace's own key so "equal key" means exactly what the sort treats
  // as a tie.
  it("keeps equal-key rows in input order (stability) for every place", () => {
    // The sort key orderForPlace uses, per place, as a comparable string so
    // consecutive equal keys are easy to detect. For the gate the key is
    // (rank, zombieDecay) where risen rank 0 / zombie rank 1, matching the
    // implementation's primary+secondary keys.
    const keyFor = (place: PlaceId, row: GraveyardRow): string => {
      switch (place) {
        case "sky":
          return `${decayKey(row)}|${quietKey(row)}`;
        case "gate": {
          const rank = row.state === "risen" ? 0 : 1;
          const secondary = row.state === "risen" ? 0 : decayKey(row);
          return `${rank}|${secondary}`;
        }
        case "ground":
        case "crypt":
          return `${quietKey(row)}`;
      }
    };

    fc.assert(
      fc.property(arbPlaceId, arbOddKeyRows, (place, rows) => {
        // Tag each row with its original input index.
        const tagged = rows.map((row, index) => ({ row, index }));
        // Order the underlying rows, then recover each result row's original
        // index by consuming tags left-to-right so duplicates (same fields) map
        // back to input positions in order — this is exactly what a stable sort
        // must preserve.
        const result = orderForPlace(place, rows);
        const remaining = tagged.slice();
        const resultIndices: number[] = result.map((r) => {
          const pos = remaining.findIndex((t) => t.row === r);
          // orderForPlace copies the array but keeps the SAME row object
          // references, so identity lookup recovers the original index exactly.
          const [picked] = remaining.splice(pos, 1);
          return picked.index;
        });

        // Walk the result; within each maximal run of equal keys the recovered
        // original indices must be strictly ascending.
        for (let i = 0; i + 1 < result.length; i++) {
          if (keyFor(place, result[i]) === keyFor(place, result[i + 1])) {
            expect(resultIndices[i]).toBeLessThan(resultIndices[i + 1]);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Clause: totality on null/NaN keys (Requirement 6.1). Restricting the input
  // to rows that ALL carry pathological keys still yields a permutation without
  // throwing — the null/NaN → 0 collapse makes every comparison finite.
  it("is total on all-null/NaN keys: never throws and still permutes", () => {
    fc.assert(
      fc.property(
        arbPlaceId,
        fc.array(arbRowWithOddKeys, { minLength: 0, maxLength: 30 }),
        (place, rows) => {
          const result = orderForPlace(place, rows);
          expect(multisetSignature(result)).toEqual(multisetSignature(rows));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: paginate partitions the rows.
//
// This block appends to the file (one describe per property). It imports
// `paginate` alongside the Property 1/2 imports above, and the shared
// `arbCount` generator for the plot-size input (which spans the pathological
// sizes 0, negatives, fractions, NaN, ±Infinity that paginate must normalize).
// Rows are generated as arbitrary arrays of plain values (integers / anything)
// rather than GraveyardRows, since paginate is generic in its element type and
// its partition contract is independent of what the elements are.
// ---------------------------------------------------------------------------

import { paginate } from "@/lib/estate-view";
import { arbCount } from "./arbitraries";

/**
 * The normalized effective plot size paginate uses internally, written
 * independently here so the length/count assertions compare against the spec's
 * "max(1, trunc(size)), non-finite → 1" rule rather than against the
 * implementation. (Requirement 7.5.)
 */
function effectiveSize(size: number): number {
  return Math.max(1, Number.isFinite(size) ? Math.trunc(size) : 1);
}

describe("Feature: estate-map-places, Property 3: paginate partitions the rows", () => {
  // Clause: concatenation (Requirement 7.1). Flattening the plots in order
  // reproduces the input exactly — same elements, same order, same
  // multiplicity — for any rows and any (even pathological) size. This holds
  // for both empty and non-empty input.
  it("flattens back to the input exactly (order and multiplicity preserved)", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), arbCount, (rows, size) => {
        const plots = paginate(rows, size);
        expect(plots.flat()).toEqual(rows);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: empty input ⇒ exactly one empty plot (Requirement 7.2). Regardless
  // of the requested size, an empty input yields `[[]]` — a single plot of
  // length 0 — so the pager always has a "Plot 1 of 1" to render.
  it("returns exactly one empty plot for empty input, for any size", () => {
    fc.assert(
      fc.property(arbCount, (size) => {
        const plots = paginate<number>([], size);
        expect(plots).toEqual([[]]);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: non-empty structure (Requirements 7.3, 7.4, 7.5). For non-empty
  // input, every plot is non-empty, every non-last plot has length exactly the
  // effective size, the last plot has length in 1..size, and the plot count is
  // ceil(n / size) — all computed against the NORMALIZED size so the
  // pathological sizes (0, negative, fractional, NaN, ±Infinity) are exercised
  // as if size were 1 (or the truncated floor).
  it("partitions non-empty input into full non-final plots with a 1..size final plot and ceil(n/size) plots", () => {
    fc.assert(
      fc.property(
        fc.array(fc.anything(), { minLength: 1, maxLength: 60 }),
        arbCount,
        (rows, size) => {
          const n = effectiveSize(size);
          const plots = paginate(rows, size);

          // Plot count is ceil(rows.length / n).
          expect(plots.length).toBe(Math.ceil(rows.length / n));

          for (let i = 0; i < plots.length; i++) {
            const plot = plots[i];
            // Every plot is non-empty.
            expect(plot.length).toBeGreaterThan(0);
            if (i < plots.length - 1) {
              // Non-last plots are exactly the effective size.
              expect(plot.length).toBe(n);
            } else {
              // The last plot holds 1..n.
              expect(plot.length).toBeGreaterThanOrEqual(1);
              expect(plot.length).toBeLessThanOrEqual(n);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Clause: pathological size behaves as size = 1 (Requirement 7.5). A size of
  // 0, any negative, NaN, or ±Infinity must partition the input into
  // singleton plots — one element per plot — exactly as size = 1 would. Pinned
  // directly against the explicit pathological constants so the normalization
  // rule is exercised by name, independent of arbCount's mix.
  it("treats size ≤ 0 and non-finite sizes as size = 1 (one element per plot)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 1, maxLength: 40 }),
        fc.constantFrom(
          0,
          -1,
          -12,
          Number.NaN,
          Number.POSITIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ),
        (rows, size) => {
          const plots = paginate(rows, size);
          // One plot per element, each a singleton, flattening back to input.
          expect(plots.length).toBe(rows.length);
          expect(plots.every((plot) => plot.length === 1)).toBe(true);
          expect(plots.flat()).toEqual(rows);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: plaqueCopy singular/plural correctness for 0/1/many incl. the
// gate risen clause.
//
// This block appends to the file (one describe per property). It imports
// `plaqueCopy` alongside the earlier imports, and reuses the shared `arbPlaceId`
// / `arbCount` generators (arbCount spans the pathological counts 0, negatives,
// fractions, NaN, ±Infinity that plaqueCopy must normalize to a non-negative
// integer without throwing).
//
// The per-place grammar is pinned against an independent table of expectations
// rather than against plaqueCopy's own templates, so the test checks the
// implementation against the spec (design "The Four New Pure Functions →
// plaqueCopy") rather than against itself. For each place we record the empty
// copy (count 0), the exact singular line (count 1), and — for plural counts —
// the noun and whether the verb is a simple "+s" plural or an irregular form,
// so a "1 …s" or "n … <singular verb>" regression is caught by name.
// ---------------------------------------------------------------------------

import { plaqueCopy } from "@/lib/estate-view";

/**
 * Independent per-place grammar table (the spec, not the implementation):
 *  - `empty`    — the exact count-0 copy (no digit, reads naturally).
 *  - `singular` — the exact count-1 line (singular noun + singular verb).
 *  - `pluralOf` — given n ≥ 2, the exact plural line, so the plural noun/verb
 *                 forms are pinned without reimplementing plaqueCopy's helper.
 * The gate's singular/plural lines here are the ZOMBIE base clause alone
 * (risenCount 0); the risen clause is asserted separately below.
 */
const PLAQUE_EXPECT: Record<
  PlaceId,
  { empty: string; singular: string; pluralOf: (n: number) => string }
> = {
  sky: {
    empty: "No ghosts linger",
    singular: "1 ghost still wanders",
    pluralOf: (n) => `${n} ghosts still wander`,
  },
  gate: {
    empty: "The gate stands empty",
    singular: "1 undead shambles here, waiting for a verdict",
    pluralOf: (n) => `${n} undead shamble here, waiting for a verdict`,
  },
  ground: {
    empty: "No finished works at rest",
    singular: "1 finished work at rest",
    pluralOf: (n) => `${n} finished works at rest`,
  },
  crypt: {
    empty: "No one sealed away yet",
    singular: "1 sealed away",
    pluralOf: (n) => `${n} sealed away`,
  },
};

/** Integers ≥ 2 for the "many" clause. */
const arbMany: fc.Arbitrary<number> = fc.integer({ min: 2, max: 10_000 });

describe("Feature: estate-map-places, Property 4: plaqueCopy singular/plural correctness for 0/1/many incl. the gate risen clause", () => {
  // Clause: count 0 → empty copy with NO digit (Requirements 4.1, 4.8). For
  // every place, plaqueCopy(place, 0) (and the explicit risenCount-0 gate form)
  // is the place's natural empty string and contains no digit at all.
  it("renders the empty copy with no digit for count 0", () => {
    fc.assert(
      fc.property(arbPlaceId, (place) => {
        const copy = plaqueCopy(place, 0);
        // Exact empty copy for this place.
        expect(copy).toBe(PLAQUE_EXPECT[place].empty);
        // No digit anywhere (there is nothing to count).
        expect(copy).not.toMatch(/\d/);
        // The gate with an explicit zero risen count is identical (no risen clause).
        expect(plaqueCopy(place, 0, 0)).toBe(PLAQUE_EXPECT[place].empty);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: count 1 → singular noun + singular verb, never "1 …s"
  // (Requirements 4.2, 4.5). The exact singular line is pinned per place, and
  // we additionally assert the result never contains the "1 <word>s " pattern
  // that a naive always-plural label would produce.
  it("renders singular noun and verb for count 1 (never \"1 …s\")", () => {
    fc.assert(
      fc.property(arbPlaceId, (place) => {
        const copy = plaqueCopy(place, 1);
        // Exact singular line for this place.
        expect(copy).toBe(PLAQUE_EXPECT[place].singular);
        // Guard against the "1 ghosts"/"1 works" regression: no word
        // immediately after the leading "1 " ends in an "s" plural.
        expect(copy).not.toMatch(/^1 \w+s\b/);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: count ≥ 2 → plural noun and verb (Requirements 4.3, 4.5). For every
  // place and every n ≥ 2 the line is the exact plural form, the leading number
  // is n, and it is distinct from the singular line.
  it("renders the plural noun and verb for count ≥ 2", () => {
    fc.assert(
      fc.property(arbPlaceId, arbMany, (place, n) => {
        const copy = plaqueCopy(place, n);
        expect(copy).toBe(PLAQUE_EXPECT[place].pluralOf(n));
        // The count appears verbatim and is never the singular line.
        expect(copy).toContain(String(n));
        expect(copy).not.toBe(PLAQUE_EXPECT[place].singular);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: gate risenCount 0 omits the risen clause (Requirements 4.6, 4.7).
  // For any zombie count, passing risenCount 0 yields exactly the zombie base
  // clause — no "risen" text — identical to omitting risenCount altogether.
  it("omits the risen clause at the gate when risenCount is 0", () => {
    fc.assert(
      fc.property(arbCount, (count) => {
        const withZero = plaqueCopy("gate", count, 0);
        const omitted = plaqueCopy("gate", count);
        expect(withZero).toBe(omitted);
        expect(withZero).not.toMatch(/risen/);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: gate risenCount 1 ends "1 has risen" (Requirements 4.6, 4.9). With
  // exactly one risen the line ends in the singular risen clause for any zombie
  // count (standalone when count 0, appended after " · " when zombies present).
  it("ends with \"1 has risen\" at the gate when risenCount is 1", () => {
    fc.assert(
      fc.property(arbCount, (count) => {
        const copy = plaqueCopy("gate", count, 1);
        expect(copy.endsWith("1 has risen")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: gate risenCount ≥ 2 ends "n have risen" (Requirements 4.6, 4.9).
  // With two or more risen the clause uses the plural verb "have" and the exact
  // count, for any zombie count.
  it("ends with \"n have risen\" at the gate when risenCount ≥ 2", () => {
    fc.assert(
      fc.property(arbCount, arbMany, (count, r) => {
        const copy = plaqueCopy("gate", count, r);
        expect(copy.endsWith(`${r} have risen`)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: non-gate places ignore risenCount (Requirement 4.6). For every
  // place other than the gate, the risen count has no effect: the copy with any
  // risenCount equals the copy computed without it.
  it("ignores risenCount for every non-gate place", () => {
    const nonGate = fc.constantFrom<PlaceId>("sky", "ground", "crypt");
    fc.assert(
      fc.property(nonGate, arbCount, arbCount, (place, count, r) => {
        expect(plaqueCopy(place, count, r)).toBe(plaqueCopy(place, count));
      }),
      { numRuns: 100 },
    );
  });

  // Clause: totality (Requirements 4.4, 4.8). Any finite, negative, fractional,
  // NaN, or ±Infinity count/risenCount yields a non-empty string and never
  // throws — the inputs normalize to non-negative integers first.
  it("always returns a non-empty string without throwing for any count/risenCount", () => {
    fc.assert(
      fc.property(arbPlaceId, arbCount, arbCount, (place, count, r) => {
        const copy = plaqueCopy(place, count, r);
        expect(typeof copy).toBe("string");
        expect(copy.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: polish-pass-2c, Property 2: No plaque overlap at 1440 and 1280.
//
// This block appends to the file (one describe per property). It imports the
// 2C polish surface it needs — `scatterLayout`, the shared `plaqueRect` pixel
// model, `DEPTH_ROWS`, and the `PlaqueRect` type — alongside the earlier
// estate-map-places imports above.
//
// Property 2 (Requirement 5.9): for 1..12 names in a single plot and any seed,
// at a 1440px or 1280px plot width, no two plaque rectangles overlap. The test
// drives the SAME pixel model the implementation uses — `plaqueRect`, built on
// the `PLAQUE_W`/`PLAQUE_H` constants — so the rectangle math under test is the
// production math, not a re-derivation that could silently diverge from it.
// `plaqueRect` defaults its height to `plotWidthPx * 0.5` (the deliberately
// short worst-case aspect for vertical separation), so passing width alone
// exercises the binding case; the real place plots are taller, so no-overlap
// here implies no-overlap for them.
// ---------------------------------------------------------------------------

import * as estateViewForOverlap from "@/lib/estate-view";
import {
  plaqueRect,
  DEPTH_ROWS,
  type PlaqueRect,
} from "@/lib/estate-view";
// `scatterLayout` is reached through the `estateViewForOverlap` namespace
// import (not a second named import) so this block introduces no duplicate
// `scatterLayout` binding that would collide with the polish-pass Property 1
// block's own named `scatterLayout` import in this same file.

/**
 * Non-empty repo-name generator for a single plot: 1..12 distinct-ish names
 * (PLOT_SIZE is 12). Names are drawn from the full string space (including
 * unicode and whitespace) because the layout folds each name into its own
 * `xmur3`/`mulberry32` stream — the exact bytes matter for the jitter draw, so
 * the generator must span real repo-name variety, not a tidy alphabet.
 */
const arbPlotNames: fc.Arbitrary<string[]> = fc.array(
  fc.string({ minLength: 1, maxLength: 40 }),
  { minLength: 1, maxLength: 12 },
);

/**
 * Seeds span strings and numbers, matching `scatterLayout`'s `seed` type.
 * Named `arbOverlapSeed` (not `arbSeed`) so it does not collide with the
 * polish-pass Property 1 block's own `arbSeed` generator in this same file.
 */
const arbOverlapSeed: fc.Arbitrary<number | string> = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.constantFrom("sky", "gate", "ground", "crypt"),
);

/** The two reference plot widths the no-overlap guarantee is pinned against. */
const arbPlotWidth: fc.Arbitrary<number> = fc.constantFrom(1440, 1280);

/**
 * The four places plus `undefined` (the legacy full band). Every creature's `y`
 * is mapped into the chosen place's stage band, so the no-overlap guarantee
 * must hold for each place's band (visual fix 2C), not just the legacy band.
 */
const arbOverlapPlace: fc.Arbitrary<
  "sky" | "gate" | "ground" | "crypt" | undefined
> = fc.constantFrom("sky", "gate", "ground", "crypt", undefined);

/**
 * Two axis-aligned rectangles overlap iff they share interior area on BOTH
 * axes. Edge-touching (a right edge exactly equal to the next left edge) counts
 * as no shared area, matching the spec's "shares no overlapping area" — so a
 * strict inequality is used on each axis. Written independently of the layout
 * so the property checks the placement against the geometric definition rather
 * than against itself.
 */
function rectsOverlap(a: PlaqueRect, b: PlaqueRect): boolean {
  const xOverlap = a.left < b.right && b.left < a.right;
  const yOverlap = a.top < b.bottom && b.top < a.bottom;
  return xOverlap && yOverlap;
}

describe("Feature: polish-pass-2c, Property 2: No plaque overlap at 1440 and 1280", () => {
  // Clause: no two plaque rectangles intersect (Requirement 5.9). For 1..12
  // names in a single plot, any seed, at a 1440px or 1280px plot width, every
  // pair of distinct plaque rectangles (PLAQUE_W × PLAQUE_H × scale, centred at
  // the record's on-screen x/y) shares no overlapping area.
  it("places 1..12 plaques so no axis-aligned rectangle pair intersects at 1440 or 1280 px", () => {
    fc.assert(
      fc.property(
        arbPlotNames,
        arbOverlapSeed,
        arbPlotWidth,
        arbOverlapPlace,
        (names, seed, plotWidth, place) => {
          // The production layout + the production pixel model: one rect per
          // record, PLAQUE_W/PLAQUE_H scaled by the record's scale, centred at
          // (x * plotWidth, y * plotHeight) with plotHeight defaulting to the
          // short worst-case aspect. `place` maps each `y` into that place's
          // stage band; the guarantee must hold for every band (visual fix 2C).
          const placements = estateViewForOverlap.scatterLayout(
            names,
            DEPTH_ROWS,
            seed,
            place,
          );
          // Exactly one record per name (Property 1 covers this; relied on here).
          expect(placements.length).toBe(names.length);

          const rects = placements.map((p) => plaqueRect(p, plotWidth));

          // Every distinct pair must be non-overlapping.
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              expect(rectsOverlap(rects[i], rects[j])).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: polish-pass-2c — property tests for the pure scatter/cover math in
// `lib/estate-view.ts` (`scatterLayout`, `coverRect`).
//
// This block appends to the file. It imports `scatterLayout` under its own
// name (the Property 2 block above aliases its import to
// `scatterLayoutForOverlap` to leave this name free), plus the cover-math
// surface new to it (`coverRect`, the `ScatterPlacement` type, and the
// scale-range / tombstone-tilt constants). Two describe blocks follow: the
// determinism/shape property for `scatterLayout` (Property 1) and a cover-math
// property for `coverRect`. Both run ≥100 cases.
// ---------------------------------------------------------------------------

import {
  scatterLayout,
  coverRect,
  type ScatterPlacement,
  SCATTER_SCALE_MIN,
  SCATTER_SCALE_MAX,
  TOMBSTONE_TILT_DEG,
} from "@/lib/estate-view";

/**
 * The shared `scatterLayout` seed generator spanning both accepted shapes
 * (string / number). Declared here as `arbSeed` (the Property 2 block above
 * declares its own distinctly-named `arbOverlapSeed` and references this
 * `arbSeed` for its seed input); a single module-level `const` is initialized
 * before any `it` callback runs, so both describe blocks see it.
 */
const arbSeed: fc.Arbitrary<number | string> = fc.oneof(
  fc.constantFrom<string>("sky", "gate", "ground", "crypt"),
  fc.string(),
  fc.integer(),
);

/**
 * A generator for the `names` input to `scatterLayout`: lists of 0–12 distinct
 * repo-ish names (0 exercises the empty-input clause; up to `PLOT_SIZE` = 12
 * spans a full plot). Names are kept distinct within a list via `uniqueArray`
 * so the "one record per name in order" clause is checked against genuinely
 * distinct inputs as well as the general case.
 */
const arbScatterNames: fc.Arbitrary<string[]> = fc.uniqueArray(
  fc.string({ minLength: 1, maxLength: 40 }),
  { minLength: 0, maxLength: 12 },
);

/** A generator for the depth-row count — the real `DEPTH_ROWS` is 3; span 1–4. */
const arbRows: fc.Arbitrary<number> = fc.integer({ min: 1, max: 4 });

/** A deep, order-preserving signature of a placement list for equality checks. */
function placementSignature(placements: ScatterPlacement[]): string {
  return placements
    .map(
      (p) =>
        `${p.x}\u0000${p.y}\u0000${p.scale}\u0000${p.brightness}\u0000${String(
          p.mirrored,
        )}\u0000${p.row}\u0000${p.tilt}`,
    )
    .join("\u0001");
}

describe("Feature: polish-pass-2c, Property 1: Determinism of placement", () => {
  // Clause: determinism (Req 5.2). Two calls with equal `(names, rows, seed)`
  // return records that are equal field-by-field and in the same order, with no
  // reliance on external or nondeterministic state.
  it("returns field-by-field, order-equal records for equal inputs", () => {
    fc.assert(
      fc.property(arbScatterNames, arbRows, arbSeed, (names, rows, seed) => {
        const a = scatterLayout(names, rows, seed);
        const b = scatterLayout(names, rows, seed);
        // Same length and the same deep signature => equal field-by-field and
        // in the same order.
        expect(b.length).toBe(a.length);
        expect(placementSignature(b)).toBe(placementSignature(a));
      }),
      { numRuns: 100 },
    );
  });

  // Clause: empty input (Req 5.3). An empty `names` yields an empty collection
  // for any rows/seed.
  it("returns [] for empty names, for any rows and seed", () => {
    fc.assert(
      fc.property(arbRows, arbSeed, (rows, seed) => {
        expect(scatterLayout([], rows, seed)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: exactly one record per name, in input order (Req 5.1). The result
  // has the same length as `names`, with records positionally aligned to the
  // input — no additional, missing, or duplicated records and no reordering.
  // (The placement fields are name-independent positionally, but the count and
  // order are the observable contract here.)
  it("returns exactly one record per name, in input order", () => {
    fc.assert(
      fc.property(arbScatterNames, arbRows, arbSeed, (names, rows, seed) => {
        const placements = scatterLayout(names, rows, seed);
        // One record per name, no add / omit / dup.
        expect(placements.length).toBe(names.length);
        // Every record is a well-formed placement with finite numeric fields
        // and a row index within the band count.
        const bandCount = Math.max(1, Math.trunc(rows));
        for (const p of placements) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
          expect(Number.isFinite(p.scale)).toBe(true);
          expect(Number.isFinite(p.brightness)).toBe(true);
          expect(Number.isFinite(p.tilt)).toBe(true);
          expect(typeof p.mirrored).toBe("boolean");
          expect(p.row).toBeGreaterThanOrEqual(0);
          expect(p.row).toBeLessThanOrEqual(bandCount - 1);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Clause: scale bounds + strict cross-row ordering (Req 5.5). Every `scale`
  // lies in [SCATTER_SCALE_MIN, SCATTER_SCALE_MAX], and for every pair of rows
  // the nearer (higher-index) row's MINIMUM scale strictly exceeds the farther
  // row's MAXIMUM scale — so every front record is strictly larger than every
  // middle record, which is strictly larger than every back record.
  it("bounds scale to [0.7,1.15] and orders it strictly front > middle > back across every pair", () => {
    fc.assert(
      fc.property(arbScatterNames, arbRows, arbSeed, (names, rows, seed) => {
        const placements = scatterLayout(names, rows, seed);
        // Bounds hold for every record.
        for (const p of placements) {
          expect(p.scale).toBeGreaterThanOrEqual(SCATTER_SCALE_MIN);
          expect(p.scale).toBeLessThanOrEqual(SCATTER_SCALE_MAX);
        }
        assertStrictCrossRowOrdering(placements, (p) => p.scale);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: strict cross-row brightness ordering (Req 5.6). For every pair of
  // rows the nearer row's MINIMUM brightness strictly exceeds the farther row's
  // MAXIMUM brightness — front > middle > back for every pair.
  it("orders brightness strictly front > middle > back across every pair", () => {
    fc.assert(
      fc.property(arbScatterNames, arbRows, arbSeed, (names, rows, seed) => {
        const placements = scatterLayout(names, rows, seed);
        assertStrictCrossRowOrdering(placements, (p) => p.brightness);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: mirrored count (Req 5.7). Exactly round(n / 3) records carry
  // `mirrored: true`, and `mirrored` is a boolean on every record.
  it("marks exactly round(n/3) records mirrored", () => {
    fc.assert(
      fc.property(arbScatterNames, arbRows, arbSeed, (names, rows, seed) => {
        const placements = scatterLayout(names, rows, seed);
        const mirroredCount = placements.filter((p) => p.mirrored === true).length;
        expect(mirroredCount).toBe(Math.round(names.length / 3));
      }),
      { numRuns: 100 },
    );
  });

  // Clause: tilt bounds (Req 5.8). The seeded tombstone tilt is always within
  // [-TOMBSTONE_TILT_DEG, TOMBSTONE_TILT_DEG] and finite, so the ground place's
  // deterministic rotation stays in range for any input.
  it("keeps the seeded tilt within [-6, 6] degrees", () => {
    fc.assert(
      fc.property(arbScatterNames, arbRows, arbSeed, (names, rows, seed) => {
        const placements = scatterLayout(names, rows, seed);
        for (const p of placements) {
          expect(p.tilt).toBeGreaterThanOrEqual(-TOMBSTONE_TILT_DEG);
          expect(p.tilt).toBeLessThanOrEqual(TOMBSTONE_TILT_DEG);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Asserts a strict cross-row ordering of a numeric placement field: grouping
 * records by `row`, for every pair of occupied rows the nearer (higher) row's
 * MINIMUM value strictly exceeds the farther (lower) row's MAXIMUM value. This
 * is the "every front > every middle > every back" contract of Req 5.5/5.6 —
 * stronger than comparing row means — and it holds vacuously when a row is
 * empty. Shared by the scale and brightness clauses above.
 */
function assertStrictCrossRowOrdering(
  placements: ScatterPlacement[],
  field: (p: ScatterPlacement) => number,
): void {
  // Bucket the field values by row index.
  const byRow = new Map<number, number[]>();
  for (const p of placements) {
    const bucket = byRow.get(p.row);
    if (bucket === undefined) {
      byRow.set(p.row, [field(p)]);
    } else {
      bucket.push(field(p));
    }
  }
  // Occupied rows in ascending (back → front) index order.
  const rowsAsc = [...byRow.keys()].sort((a, b) => a - b);
  // For each adjacent occupied pair, the nearer row's min > the farther row's
  // max. Transitivity then gives the full "every nearer > every farther".
  for (let i = 0; i + 1 < rowsAsc.length; i++) {
    const farther = byRow.get(rowsAsc[i])!;
    const nearer = byRow.get(rowsAsc[i + 1])!;
    const fartherMax = Math.max(...farther);
    const nearerMin = Math.min(...nearer);
    expect(nearerMin).toBeGreaterThan(fartherMax);
  }
}

describe("Feature: polish-pass-2c, Property 1: coverRect cover-math (centre + linear diameter)", () => {
  // A positive image size and a positive element box, with the element at least
  // as wide (per axis) as the image's aspect so the WIDTH term binds the cover
  // scale (`viewW / imageW >= viewH / imageH`). In that regime the on-screen
  // diameter reduces to `diamFrac * viewW`, which is exactly linear in the
  // element width — the clause the task pins. The constraint `viewW/imageW >=
  // viewH/imageH` is enforced by deriving viewH from a bounded multiple.
  const arbCoverWidthBound = fc
    .record({
      imageW: fc.integer({ min: 1, max: 4000 }),
      imageH: fc.integer({ min: 1, max: 4000 }),
      viewW: fc.double({ min: 1, max: 4000, noNaN: true }),
      diamFrac: fc.double({ min: 0, max: 1, noNaN: true }),
      // A fraction in [0,1] of the exact height ceiling, so viewH is derived to
      // keep the WIDTH term binding without an integer floor rounding the
      // ceiling down to 0 (the bug the first draft hit at tiny dimensions).
      t: fc.double({ min: 0, max: 1, noNaN: true }),
    })
    .map(({ imageW, imageH, viewW, diamFrac, t }) => {
      // maxViewH is the real value where viewH/imageH == viewW/imageW; any
      // viewH <= maxViewH keeps the width term winning the cover `max`. Floor
      // viewH at a tiny positive epsilon so it is always a positive dimension.
      const maxViewH = (viewW * imageH) / imageW;
      const viewH = Math.max(1e-6, t * maxViewH);
      return { imageW, imageH, viewW, viewH, diamFrac };
    });

  // Clause: the image centre (fx = fy = 0.5) maps to the element-box centre,
  // and the on-screen diameter equals `diamFrac * viewW` in the width-bound
  // regime (so diameter scales linearly with the element width). Both are the
  // cover-math guarantees the aligned data moon relies on (Req 4.7, 4.8).
  it("maps the image centre to the viewport centre and scales diameter linearly with width", () => {
    fc.assert(
      fc.property(arbCoverWidthBound, ({ imageW, imageH, viewW, viewH, diamFrac }) => {
        const rect = coverRect({
          imageW,
          imageH,
          viewW,
          viewH,
          fx: 0.5,
          fy: 0.5,
          diamFrac,
        });
        // The painted image, cover-scaled and centred, puts the image's own
        // centre exactly at the element box centre regardless of aspect.
        expect(rect.cx).toBeCloseTo(viewW / 2, 6);
        expect(rect.cy).toBeCloseTo(viewH / 2, 6);
        // Width binds the cover scale here, so scale = viewW / imageW and the
        // diameter collapses to diamFrac * viewW — linear in the element width.
        expect(rect.diameter).toBeCloseTo(diamFrac * viewW, 6);
      }),
      { numRuns: 100 },
    );
  });

  // Clause: diameter linearity in element width, stated directly. Doubling the
  // element width (keeping the width term binding) doubles the diameter, within
  // floating-point tolerance — the "diameter scales linearly with image width"
  // guarantee the moon sizing depends on (Req 4.8).
  it("doubles the diameter when the element width doubles (width-bound regime)", () => {
    fc.assert(
      fc.property(
        fc.record({
          imageW: fc.integer({ min: 1, max: 2000 }),
          imageH: fc.integer({ min: 1, max: 2000 }),
          viewW: fc.double({ min: 1, max: 2000, noNaN: true }),
          diamFrac: fc.double({ min: 0.001, max: 1, noNaN: true }),
          t: fc.double({ min: 0, max: 1, noNaN: true }),
        }),
        ({ imageW, imageH, viewW, diamFrac, t }) => {
          // Pick viewH so width binds the cover scale at BOTH viewW and 2*viewW
          // (viewH/imageH <= viewW/imageW <= 2viewW/imageW). A real-valued
          // fraction `t` of the exact ceiling avoids the integer-floor-to-0 bug.
          const viewH = Math.max(1e-6, (t * (viewW * imageH)) / imageW);
          const base = coverRect({
            imageW,
            imageH,
            viewW,
            viewH,
            fx: 0.5,
            fy: 0.5,
            diamFrac,
          });
          const wide = coverRect({
            imageW,
            imageH,
            viewW: viewW * 2,
            viewH,
            fx: 0.5,
            fy: 0.5,
            diamFrac,
          });
          expect(wide.diameter).toBeCloseTo(base.diameter * 2, 6);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Feature: polish-pass-2c (visual fix) — every creature's `y` lands inside its
// place's stage band so creatures stand on their place's ground rather than
// floating across the whole scene. Uses the production `STAGE_BANDS` + the
// namespace `scatterLayout` so there is no duplicate named-import collision.
// ---------------------------------------------------------------------------
import { STAGE_BANDS as STAGE_BANDS_FOR_Y } from "@/lib/estate-view";

describe("Feature: polish-pass-2c, stage bands: every creature y is inside its place band", () => {
  const arbBandNames = fc.array(fc.string({ minLength: 1, maxLength: 40 }), {
    minLength: 1,
    maxLength: 12,
  });
  const arbBandSeed = fc.oneof(fc.string(), fc.integer());
  const arbPlace = fc.constantFrom("sky", "gate", "ground", "crypt") as fc.Arbitrary<
    "sky" | "gate" | "ground" | "crypt"
  >;

  it("keeps every y within the place's [top, bottom] stage band (with jitter headroom)", () => {
    fc.assert(
      fc.property(arbBandNames, arbBandSeed, arbPlace, (names, seed, place) => {
        const placements = estateViewForOverlap.scatterLayout(
          names,
          DEPTH_ROWS,
          seed,
          place,
        );
        const band = STAGE_BANDS_FOR_Y[place];
        // The y-jitter is a fraction of the band height, so allow a small
        // headroom around the band edges (the row centres sit AT top/bottom and
        // jitter nudges them a little inward/outward but stays well inside the
        // scene). The core guarantee: no creature escapes near its band.
        const headroom = (band.bottom - band.top) * 0.1 + 1e-9;
        for (const pm of placements) {
          expect(pm.y).toBeGreaterThanOrEqual(band.top - headroom);
          expect(pm.y).toBeLessThanOrEqual(band.bottom + headroom);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("orders the depth rows back(top)->front(bottom) inside the band", () => {
    // With >= 2 rows of names, the min y of the back row is above the max y of
    // the front row, i.e. the band fills from its top (back) to bottom (front).
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 6,
          maxLength: 12,
        }),
        arbBandSeed,
        arbPlace,
        (names, seed, place) => {
          const placements = estateViewForOverlap.scatterLayout(
            names,
            DEPTH_ROWS,
            seed,
            place,
          );
          const byRow = new Map<number, number[]>();
          for (const pm of placements) {
            const ys = byRow.get(pm.row) ?? [];
            ys.push(pm.y);
            byRow.set(pm.row, ys);
          }
          const rows = [...byRow.keys()].sort((a, b) => a - b);
          // Back row (index 0) sits at a smaller y (higher on screen) than the
          // front row (highest index).
          if (rows.length >= 2) {
            const backMax = Math.max(...byRow.get(rows[0])!);
            const frontMin = Math.min(...byRow.get(rows[rows.length - 1])!);
            expect(backMax).toBeLessThanOrEqual(frontMin);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Feature: polish-pass-2c (visual fix r3 #2/#3) ? the RESOLVED scene geometry:
// no plaque overlaps another plaque or the UPPER 60% (head + torso) of any
// other creature, and every plaque + creature stays inside the 16px scene
// margins. Driven by the production `resolvePlacement` at the two real viewport
// sizes (1440?900, 1280?720), front rows resolved first so each is cleared
// against nearer creatures ? exactly how `DepthScatter` consumes it.
// ---------------------------------------------------------------------------
import {
  resolvePlacement as resolvePlacementR3,
  rectsIntersect as rectsIntersectR3,
  SCENE_EDGE_MARGIN_PX as EDGE_MARGIN_R3,
  type SceneRect as SceneRectR3,
} from "@/lib/estate-view";

/** The upper 60% (head + torso) of a creature rect ? the part protected from
 *  plaques; the bottom 40% (legs/feet) may overlap. */
function upper60R3(c: SceneRectR3): SceneRectR3 {
  return { ...c, bottom: c.top + (c.bottom - c.top) * 0.6 };
}

/** Resolves a whole plot the way `DepthScatter` does: front rows first, each
 *  plaque cleared against already-placed plaques + upper-60% creature rects. */
function resolvePlotR3(
  pls: ReturnType<typeof scatterLayout>,
  place: "sky" | "gate" | "ground" | "crypt",
  W: number,
  H: number,
): { plaque: SceneRectR3; creature: SceneRectR3 }[] {
  const order = pls
    .map((_, i) => i)
    .sort((a, b) => pls[b].row - pls[a].row);
  const res: { plaque: SceneRectR3; creature: SceneRectR3 }[] = new Array(pls.length);
  const obstacles: SceneRectR3[] = [];
  for (const i of order) {
    const r = resolvePlacementR3(pls[i], place, W, H, obstacles);
    res[i] = { plaque: r.plaque, creature: r.creature };
    obstacles.push(r.plaque, upper60R3(r.creature));
  }
  return res;
}

const arbPlotNamesR3: fc.Arbitrary<string[]> = fc.array(
  fc.string({ minLength: 1, maxLength: 40 }),
  { minLength: 1, maxLength: 12 },
);
const arbSeedR3: fc.Arbitrary<number | string> = fc.oneof(fc.string(), fc.integer());
const arbPlaceR3 = fc.constantFrom("sky", "gate", "ground", "crypt") as fc.Arbitrary<
  "sky" | "gate" | "ground" | "crypt"
>;
/** The two real Reference_Viewports the guarantee is pinned against. */
const arbViewportR3 = fc.constantFrom<[number, number]>([1440, 900], [1280, 720]);

describe("Feature: polish-pass-2c, Property 2 (r3): no plaque overlaps a plaque or a creature's upper 60%", () => {
  it("for 1..12 names, every place, at 1440?900 and 1280?720, plaques clear all other plaques and the upper 60% of all other creatures", () => {
    fc.assert(
      fc.property(
        arbPlotNamesR3,
        arbSeedR3,
        arbPlaceR3,
        arbViewportR3,
        (names, seed, place, [W, H]) => {
          const pls = scatterLayout(names, DEPTH_ROWS, seed, place);
          const res = resolvePlotR3(pls, place, W, H);
          for (let a = 0; a < res.length; a++) {
            for (let b = 0; b < res.length; b++) {
              if (a === b) continue;
              // (a) no plaque overlaps any OTHER plaque.
              expect(rectsIntersectR3(res[a].plaque, res[b].plaque)).toBe(false);
              // (b) no plaque overlaps the UPPER 60% of any OTHER creature
              //     (legs/feet overlap is allowed).
              expect(
                rectsIntersectR3(res[a].plaque, upper60R3(res[b].creature)),
              ).toBe(false);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("Feature: polish-pass-2c, margins (r3 #3): every plaque and creature stays inside the 16px scene margins", () => {
  it("for 1..12 names, every place, at 1440?900 and 1280?720, no plaque/creature rect crosses the 16px edge margins", () => {
    fc.assert(
      fc.property(
        arbPlotNamesR3,
        arbSeedR3,
        arbPlaceR3,
        arbViewportR3,
        (names, seed, place, [W, H]) => {
          const pls = scatterLayout(names, DEPTH_ROWS, seed, place);
          const res = resolvePlotR3(pls, place, W, H);
          for (const { plaque, creature } of res) {
            for (const rect of [plaque, creature]) {
              expect(rect.left).toBeGreaterThanOrEqual(EDGE_MARGIN_R3 - 1e-6);
              expect(rect.right).toBeLessThanOrEqual(W - EDGE_MARGIN_R3 + 1e-6);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
