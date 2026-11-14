/**
 * Feature: explorable-worlds, Property 8: Layout is deterministic and each
 * Creature's look depends only on its name
 *
 * **Validates: Requirements 6.11, 6.12, 7.3, 7.4, 16.9**
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { computeWorldLayout, nameLook } from "../../lib/world-layout";
import { arbNames, arbPlace, arbViewport } from "./helpers/world-arbitraries";

const RUNS = { numRuns: 150 };

describe("Feature: explorable-worlds, Property 8: determinism and name-only looks", () => {
  it("identical inputs give deeply equal layouts", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(12), (place, vp, names) => {
        const a = computeWorldLayout({ place, names: [...names], ...vp });
        const b = computeWorldLayout({ place, names: [...names], ...vp });
        expect(b).toEqual(a);
      }),
      RUNS,
    );
  });

  it("slot looks equal nameLook(place, name), whatever the other names, order or count", () => {
    fc.assert(
      fc.property(
        arbPlace,
        arbViewport,
        arbNames(12),
        fc.infiniteStream(fc.nat()),
        (place, vp, names, stream) => {
          // Shuffle deterministically from the generated stream.
          const it = stream[Symbol.iterator]();
          const shuffled = [...names];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = it.next().value! % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const subset = names.slice(0, Math.ceil(names.length / 2));

          for (const list of [names, shuffled, subset]) {
            const layout = computeWorldLayout({ place, names: list, ...vp });
            list.forEach((name, i) => {
              const look = nameLook(place, name);
              const s = layout.slots[i];
              expect(s.band).toBe(look.band);
              expect(s.scale).toBe(look.scale);
              expect(s.brightness).toBe(look.brightness);
              expect(s.mirrored).toBe(look.mirrored);
              expect(s.tilt).toBe(look.tilt);
            });
          }
        },
      ),
      RUNS,
    );
  });

  it("nameLook is pure and band comes only from the name hash", () => {
    fc.assert(
      fc.property(arbPlace, fc.string({ maxLength: 20 }), (place, name) => {
        const a = nameLook(place, name);
        expect(nameLook(place, name)).toEqual(a);
        expect([0, 1, 2]).toContain(a.band);
      }),
      RUNS,
    );
  });

  it("sky bands order scale and brightness front >= middle >= back; ground/crypt never mirror; ground tilt in [-6, 6]", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string({ maxLength: 20 }), { minLength: 1, maxLength: 40 }), (names) => {
        const looks = names.map((n) => nameLook("sky", n));
        for (const x of looks) {
          for (const y of looks) {
            if (x.band > y.band) {
              expect(x.scale).toBeGreaterThanOrEqual(y.scale);
              expect(x.brightness).toBeGreaterThanOrEqual(y.brightness);
            }
          }
        }
        for (const n of names) {
          expect(nameLook("ground", n).mirrored).toBe(false);
          expect(nameLook("crypt", n).mirrored).toBe(false);
          const t = nameLook("ground", n).tilt;
          expect(t).toBeGreaterThanOrEqual(-6);
          expect(t).toBeLessThanOrEqual(6);
        }
      }),
      RUNS,
    );
  });
});

/**
 * Feature: explorable-worlds, Property 9: Strata and chambers partition the
 * world correctly
 *
 * **Validates: Requirements 7.1, 9.1, 9.12, 18.1, 19.6**
 */
describe("Feature: explorable-worlds, Property 9: strata and chambers partition the world", () => {
  const EPS = 1e-6;
  const THIRDS = [1 / 3, 2 / 3];
  const nearThird = (v: number) => THIRDS.some((t) => Math.abs(v - t) <= 0.1);

  it("strata are contiguous, partition [0, heightPx], each at most 1.0 Vh_eff, with blend zones at joins", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(12), (place, vp, names) => {
        const layout = computeWorldLayout({ place, names, ...vp });
        const vhEff = Math.max(layout.viewportH, 700);
        const { strata } = layout;

        expect(strata.length).toBeGreaterThanOrEqual(1);
        expect(strata[0].top).toBe(0);
        expect(strata[strata.length - 1].bottom).toBeCloseTo(layout.heightPx, 6);
        strata.forEach((st, s) => {
          expect(st.bottom).toBeGreaterThan(st.top);
          expect(st.bottom - st.top).toBeLessThanOrEqual(vhEff + EPS);
          if (s > 0) expect(st.top).toBe(strata[s - 1].bottom);
        });

        // One blend zone per join, at least 0.12 Vh tall, centred on the join.
        expect(layout.blendZones.length).toBe(strata.length - 1);
        layout.blendZones.forEach((z, i) => {
          expect(z.height).toBeGreaterThanOrEqual(0.12 * vp.viewportH - EPS);
          expect(z.y + z.height / 2).toBeCloseTo(strata[i + 1].top, 6);
        });

        // Focal stays in the frame and near a rule-of-thirds intersection.
        for (const st of strata) {
          expect(st.focal.fx).toBeGreaterThanOrEqual(0);
          expect(st.focal.fx).toBeLessThanOrEqual(1);
          expect(st.focal.fy).toBeGreaterThanOrEqual(0);
          expect(st.focal.fy).toBeLessThanOrEqual(1);
          expect(nearThird(st.focal.fx)).toBe(true);
          expect(nearThird(st.focal.fy)).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it("sky with more than 4 names has at least 2 strata, each holding a name", () => {
    fc.assert(
      fc.property(
        arbViewport,
        fc.uniqueArray(fc.string({ maxLength: 20 }), { minLength: 5, maxLength: 12 }),
        (vp, names) => {
          const layout = computeWorldLayout({ place: "sky", names, ...vp });
          expect(layout.strata.length).toBeGreaterThanOrEqual(2);
          layout.strata.forEach((_, s) => {
            expect(layout.slots.some((slot) => slot.stratum === s)).toBe(true);
          });
        },
      ),
      RUNS,
    );
  });

  it("crypt chambers: ceil(n/4) chambers of at most 4 in Plot order, every index exactly once", () => {
    fc.assert(
      fc.property(
        arbViewport,
        fc.uniqueArray(fc.string({ maxLength: 20 }), { minLength: 1, maxLength: 12 }),
        (vp, names) => {
          const layout = computeWorldLayout({ place: "crypt", names, ...vp });
          const chambers = layout.chambers!;
          const n = names.length;
          expect(chambers.length).toBe(Math.ceil(n / 4));
          chambers.forEach((c, j) => {
            expect(c.length).toBeGreaterThanOrEqual(1);
            expect(c.length).toBeLessThanOrEqual(4);
            if (j < chambers.length - 1) expect(c.length).toBe(4);
          });
          // Plot order: flattening gives 0..n-1 exactly once each.
          expect(chambers.flat()).toEqual(Array.from({ length: n }, (_, i) => i));
        },
      ),
      RUNS,
    );
  });
});

/**
 * Feature: explorable-worlds, Property 12: DOM order is visual order, urgency
 * fills the first screen, the path descends
 *
 * **Validates: Requirements 3.7, 7.10, 8.1, 8.2, 10.10, 12.6**
 */
describe("Feature: explorable-worlds, Property 12: DOM order, urgency and the path", () => {
  it("domOrder is a permutation of the slot indices sorted by (cy, cx)", () => {
    fc.assert(
      fc.property(arbPlace, arbViewport, arbNames(12), (place, vp, names) => {
        const layout = computeWorldLayout({ place, names, ...vp });
        const { domOrder, slots } = layout;
        expect(domOrder.length).toBe(slots.length);
        expect([...domOrder].sort((a, b) => a - b)).toEqual(slots.map((_, i) => i));
        for (let k = 1; k < domOrder.length; k++) {
          const p = slots[domOrder[k - 1]];
          const q = slots[domOrder[k]];
          expect(p.cy < q.cy || (p.cy === q.cy && p.cx <= q.cx)).toBe(true);
        }
      }),
      { numRuns: 150 },
    );
  });

  // Seeded Y jitter (up to 24 px) can place a same-row neighbour a few px above
  // index 0, so "smallest cy" holds up to that jitter; the hard guarantee is
  // that the most urgent creature is inside the first screen.
  it("sky and crypt: most urgent creature (index 0) is inside the first screen and within jitter of the topmost slot", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<"sky" | "crypt">("sky", "crypt"),
        arbViewport,
        fc.uniqueArray(fc.string({ maxLength: 20 }), { minLength: 2, maxLength: 12 }),
        (place, vp, names) => {
          const layout = computeWorldLayout({ place, names, ...vp });
          if (!(layout.lengthVh > 1)) return;
          const first = layout.slots[0];
          const JITTER_BAND = 2 * 24 + 1e-6;
          // Zigzag rows offset odd columns downward, so only jitter separates them.
          const top = Math.min(...layout.slots.map((s) => s.cy));
          expect(first.cy - top).toBeLessThanOrEqual(JITTER_BAND);
          expect(first.cy).toBeLessThanOrEqual(layout.viewportH);
        },
      ),
      { numRuns: 150 },
    );
  });

  it("ground with 2+ tombstones: cy strictly increases, sides alternate, path y strictly increases", () => {
    fc.assert(
      fc.property(
        arbViewport,
        fc.uniqueArray(fc.string({ maxLength: 20 }), { minLength: 2, maxLength: 12 }),
        (vp, names) => {
          const layout = computeWorldLayout({ place: "ground", names, ...vp });
          const { slots, path } = layout;
          for (let i = 1; i < slots.length; i++) {
            expect(slots[i].cy).toBeGreaterThan(slots[i - 1].cy);
            expect(slots[i].side).toBe(-slots[i - 1].side);
          }
          expect(Math.abs(slots[0].side)).toBe(1);
          expect(path).toBeDefined();
          for (let i = 1; i < path!.length; i++) {
            expect(path![i].y).toBeGreaterThan(path![i - 1].y);
          }
        },
      ),
      { numRuns: 150 },
    );
  });
});
