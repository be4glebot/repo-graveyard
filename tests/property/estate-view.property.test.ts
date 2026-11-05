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
