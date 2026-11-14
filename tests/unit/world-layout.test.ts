/**
 * Sanity tests for lib/world-layout.ts part A (explorable-worlds task 4.4).
 * Property tests live in tests/property (tasks 4.5-4.8).
 */
import { describe, expect, it } from "vitest";
import {
  LAYOUT_MIN_VH,
  computeWorldLayout,
  nameLook,
  worldColumns,
  worldLength,
  type WorldPlace,
} from "@/lib/world-layout";

const PLACES: WorldPlace[] = ["sky", "ground", "crypt"];

describe("computeWorldLayout with 0 and 1 names", () => {
  it.each(PLACES)("%s: empty world is one screen with one stratum", (place) => {
    const l = computeWorldLayout({ place, names: [], viewportW: 1280, viewportH: 800 });
    expect(l.lengthVh).toBe(1);
    expect(l.heightPx).toBe(800);
    expect(l.slots).toEqual([]);
    expect(l.domOrder).toEqual([]);
    expect(l.strata).toHaveLength(1);
    expect(l.strata[0].top).toBe(0);
    expect(l.strata[0].bottom).toBe(l.heightPx);
  });

  it.each(PLACES)("%s: one creature is centred in the middle 60 percent", (place) => {
    for (const [w, h] of [[1280, 800], [1440, 900], [390, 844], [1024, 700]]) {
      const l = computeWorldLayout({ place, names: ["solo"], viewportW: w, viewportH: h });
      const vh = Math.max(h, LAYOUT_MIN_VH);
      expect(l.lengthVh).toBe(1);
      expect(l.slots).toHaveLength(1);
      expect(l.slots[0].cx).toBe(w / 2);
      expect(l.slots[0].cy).toBeGreaterThanOrEqual(0.2 * vh);
      expect(l.slots[0].cy).toBeLessThanOrEqual(0.8 * vh);
      expect(l.domOrder).toEqual([0]);
    }
  });

  it("falls back to 812 for unusable viewport heights", () => {
    for (const h of [0, -5, NaN, Infinity]) {
      const l = computeWorldLayout({ place: "sky", names: ["a"], viewportW: 1280, viewportH: h });
      expect(l.viewportH).toBe(812);
      expect(l.heightPx).toBe(812);
    }
  });

  it("floors the effective height at LAYOUT_MIN_VH", () => {
    const l = computeWorldLayout({ place: "sky", names: [], viewportW: 1280, viewportH: 500 });
    expect(l.heightPx).toBe(LAYOUT_MIN_VH);
  });
});

describe("worldLength", () => {
  it.each(PLACES)("%s: 0 and 1 names give exactly 1", (place) => {
    expect(worldLength(place, 0, 1280, 800)).toBe(1);
    expect(worldLength(place, 1, 390, 844)).toBe(1);
  });

  it("small counts give 1.5 (crypt up to 4)", () => {
    expect(worldLength("sky", 2, 1280, 800)).toBe(1.5);
    expect(worldLength("ground", 3, 1280, 800)).toBe(1.5);
    expect(worldLength("crypt", 4, 1280, 800)).toBe(1.5);
  });

  it("larger counts stay within [1.5, cap] and never decrease", () => {
    for (const place of PLACES) {
      for (const [w, cap] of [[1280, 3], [390, 4]]) {
        let prev = 0;
        for (let n = 0; n <= 12; n++) {
          const len = worldLength(place, n, w, 800);
          expect(len).toBeGreaterThanOrEqual(prev);
          expect(len).toBeLessThanOrEqual(cap);
          prev = len;
        }
      }
    }
  });

  it("crypt grows with chambers", () => {
    expect(worldLength("crypt", 5, 1280, 800)).toBeGreaterThanOrEqual(2.2);
    expect(worldLength("crypt", 12, 1280, 800)).toBeGreaterThanOrEqual(2.9);
  });
});

describe("worldColumns", () => {
  it("desktop: min(ceil(n/2), 4, floor((w-32)/200))", () => {
    expect(worldColumns(1, 1280)).toBe(1);
    expect(worldColumns(4, 1280)).toBe(2);
    expect(worldColumns(12, 1280)).toBe(4);
    expect(worldColumns(12, 800)).toBe(3);
  });

  it("compact: min(n, floor((w-32)/140)), at least 1", () => {
    expect(worldColumns(12, 390)).toBe(2);
    expect(worldColumns(1, 390)).toBe(1);
    expect(worldColumns(12, 360)).toBe(2);
    expect(worldColumns(5, 100)).toBe(1);
    expect(worldColumns(12, 760)).toBe(5);
  });
});

describe("nameLook", () => {
  it("is deterministic and independent of other names", () => {
    expect(nameLook("sky", "alpha")).toEqual(nameLook("sky", "alpha"));
  });

  it("stays inside documented ranges", () => {
    for (const place of PLACES) {
      for (const name of ["a", "b", "repo-graveyard", "ünï", ""]) {
        const look = nameLook(place, name);
        expect([0, 1, 2]).toContain(look.band);
        expect(look.scale).toBeGreaterThanOrEqual(0.7);
        expect(look.scale).toBeLessThanOrEqual(1.15);
        expect(Math.abs(look.tilt)).toBeLessThanOrEqual(6);
        if (place !== "sky") expect(look.mirrored).toBe(false);
        if (place !== "ground") expect(look.tilt).toBe(0);
      }
    }
  });
});

const mkNames = (n: number) => Array.from({ length: n }, (_, i) => `repo-${i}`);

describe("computeWorldLayout with 2+ names (slots, part B)", () => {
  it("returns index-aligned slots and strata partitioning the height", () => {
    const names = ["a", "b", "c", "d", "e"];
    const l = computeWorldLayout({ place: "sky", names, viewportW: 1280, viewportH: 800 });
    expect(l.slots).toHaveLength(names.length);
    expect(l.slots.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
    expect(l.strata[0].top).toBe(0);
    expect(l.strata[l.strata.length - 1].bottom).toBeCloseTo(l.heightPx);
  });

  it.each(PLACES)("%s: small counts put slot 0 in screen one and the last below it", (place) => {
    for (const [w, h] of [[1280, 800], [390, 844], [1024, 700]]) {
      const vh = Math.max(h, LAYOUT_MIN_VH);
      for (const n of [2, 3, ...(place === "crypt" ? [4] : [])]) {
        const l = computeWorldLayout({ place, names: mkNames(n), viewportW: w, viewportH: h });
        expect(l.slots[0].cy).toBeLessThan(vh);
        expect(l.slots[n - 1].cy).toBeGreaterThan(vh);
        for (let i = 1; i < n; i++) expect(l.slots[i].cy).toBeGreaterThan(l.slots[i - 1].cy);
        expect(l.domOrder).toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });

  it.each(PLACES)("%s: grid slots respect margins, edges and plaque separation", (place) => {
    for (const [w, h] of [[1920, 900], [1280, 800], [768, 700], [390, 844], [360, 640]]) {
      for (const n of [4, 7, 12]) {
        const l = computeWorldLayout({ place, names: mkNames(n), viewportW: w, viewportH: h });
        expect(l.slots).toHaveLength(n);
        for (const s of l.slots) {
          expect(s.cy).toBeGreaterThanOrEqual(140);
          expect(s.cy).toBeLessThanOrEqual(l.heightPx - 140);
          for (const r of [s.body, s.plaque]) {
            expect(r.left).toBeGreaterThanOrEqual(16 - 1e-9);
            expect(r.right).toBeLessThanOrEqual(w - 16 + 1e-9);
          }
        }
        for (let a = 0; a < n; a++) {
          for (let b = a + 1; b < n; b++) {
            const p = l.slots[a].plaque;
            const q = l.slots[b].plaque;
            const apart =
              p.right <= q.left || q.right <= p.left || p.bottom <= q.top || q.bottom <= p.top;
            expect(apart).toBe(true);
          }
        }
        const vh = Math.max(h, LAYOUT_MIN_VH);
        // "Below the first screen" may be met by a landmark feature (part C),
        // so only the first-screen half is asserted for grids.
        expect(l.slots.some((s) => s.cy < vh)).toBe(true);
      }
    }
  });

  it("urgency order fills the first screen (row 0 slots come first)", () => {
    const l = computeWorldLayout({ place: "sky", names: mkNames(12), viewportW: 1280, viewportH: 800 });
    const cols = l.columns;
    const firstRow = l.slots.slice(0, cols);
    expect(firstRow.every((s) => s.cy < 800)).toBe(true);
  });

  it("domOrder is a permutation sorted by (cy, cx)", () => {
    const l = computeWorldLayout({ place: "sky", names: mkNames(12), viewportW: 1280, viewportH: 800 });
    expect([...l.domOrder].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    for (let i = 1; i < l.domOrder.length; i++) {
      const p = l.slots[l.domOrder[i - 1]];
      const q = l.slots[l.domOrder[i]];
      expect(p.cy < q.cy || (p.cy === q.cy && p.cx <= q.cx)).toBe(true);
    }
  });

  it("is deterministic and a name's look does not depend on the others", () => {
    const input = { place: "sky" as const, names: mkNames(9), viewportW: 1280, viewportH: 800 };
    expect(computeWorldLayout(input)).toEqual(computeWorldLayout(input));
    const other = computeWorldLayout({ ...input, names: ["zzz", ...mkNames(5)] });
    expect(other.slots[1].scale).toBe(nameLook("sky", "repo-0").scale);
  });

  it("handles NaN, zero and negative viewports and empty names without throwing", () => {
    for (const [w, h] of [[NaN, NaN], [0, 0], [-10, -10], [Infinity, 800], [100, 300]]) {
      for (const n of [2, 5, 12]) {
        const names = ["", ...mkNames(n - 1)];
        const l = computeWorldLayout({ place: "ground", names, viewportW: w, viewportH: h });
        expect(l.slots).toHaveLength(n);
        for (const s of l.slots) {
          expect(Number.isFinite(s.cx)).toBe(true);
          expect(Number.isFinite(s.cy)).toBe(true);
        }
        expect(l.domOrder).toHaveLength(n);
      }
    }
  });
});

describe("computeWorldLayout part C (strata, features, blends, path, chambers)", () => {
  const VIEWPORTS: [number, number][] = [
    [1920, 900],
    [1280, 800],
    [768, 700],
    [700, 900],
    [390, 844],
    [360, 640],
    [1280, 1800],
  ];
  const COUNTS = [2, 3, 4, 5, 7, 9, 12];

  it.each(PLACES)("%s: strata partition the world, each at most 1 Vh, blends centred on joins", (place) => {
    for (const [w, h] of VIEWPORTS) {
      const vh = Math.max(h, LAYOUT_MIN_VH);
      for (const n of COUNTS) {
        const l = computeWorldLayout({ place, names: mkNames(n), viewportW: w, viewportH: h });
        expect(l.strata[0].top).toBe(0);
        expect(l.strata[l.strata.length - 1].bottom).toBe(l.heightPx);
        for (let s = 0; s < l.strata.length; s++) {
          const st = l.strata[s];
          expect(st.bottom - st.top).toBeLessThanOrEqual(vh + 1e-6);
          expect(st.bottom).toBeGreaterThan(st.top);
          if (s > 0) expect(st.top).toBe(l.strata[s - 1].bottom);
          expect([1 / 3, 2 / 3]).toContain(st.focal.fx);
          expect([1 / 3, 2 / 3]).toContain(st.focal.fy);
        }
        expect(l.blendZones).toHaveLength(l.strata.length - 1);
        l.blendZones.forEach((z, i) => {
          expect(z.height).toBeCloseTo(0.15 * vh);
          expect(z.y + z.height / 2).toBeCloseTo(l.strata[i + 1].top);
        });
        for (const s of l.slots) {
          expect(s.stratum).toBeGreaterThanOrEqual(0);
          expect(s.stratum).toBeLessThan(l.strata.length);
        }
      }
    }
  });

  it.each(PLACES)("%s: no stretch over 0.6 Vh without a slot or feature", (place) => {
    for (const [w, h] of VIEWPORTS) {
      const vh = Math.max(h, LAYOUT_MIN_VH);
      for (const n of COUNTS) {
        const l = computeWorldLayout({ place, names: mkNames(n), viewportW: w, viewportH: h });
        const ys = [0, l.heightPx, ...l.slots.map((s) => s.cy), ...l.features.map((f) => f.y)].sort(
          (a, b) => a - b,
        );
        for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeLessThanOrEqual(0.6 * vh);
      }
    }
  });

  it("sky with 4+ names has 2+ strata and each holds a creature", () => {
    for (const [w, h] of VIEWPORTS) {
      for (const n of [4, 5, 7, 12]) {
        const l = computeWorldLayout({ place: "sky", names: mkNames(n), viewportW: w, viewportH: h });
        expect(l.strata.length).toBeGreaterThanOrEqual(2);
        l.strata.forEach((_, s) => expect(l.slots.some((x) => x.stratum === s)).toBe(true));
        expect(l.features.some((f) => f.kind === "moon" && f.y < Math.max(h, LAYOUT_MIN_VH))).toBe(true);
        expect(l.features.some((f) => f.kind === "cloud-bank")).toBe(true);
      }
    }
  });

  it("ground: alternating sides, strictly increasing cy, path samples, gate and mausoleum", () => {
    for (const [w, h] of VIEWPORTS) {
      for (const n of COUNTS) {
        const l = computeWorldLayout({ place: "ground", names: mkNames(n), viewportW: w, viewportH: h });
        l.slots.forEach((s, i) => {
          expect(s.side).toBe(i % 2 === 0 ? -1 : 1);
          if (i > 0) expect(s.cy).toBeGreaterThan(l.slots[i - 1].cy);
        });
        expect(l.domOrder).toEqual(l.slots.map((_, i) => i));
        expect(l.path).toBeDefined();
        expect(l.path![0].y).toBe(0);
        expect(l.path![l.path!.length - 1].y).toBe(l.heightPx);
        for (const p of l.path!) expect(Number.isFinite(p.x)).toBe(true);
        expect(l.features.some((f) => f.kind === "entry-gate" && f.stratum === 0)).toBe(true);
        expect(
          l.features.some((f) => f.kind === "mausoleum" && f.stratum === l.strata.length - 1),
        ).toBe(true);
        expect(l.strata[0].id).toBe("gate-path");
        expect(l.strata[l.strata.length - 1].id).toBe("mausoleum-approach");
      }
    }
  });

  it("crypt: chambers of 4 in Plot order with stairs between them", () => {
    for (const [w, h] of VIEWPORTS) {
      const vh = Math.max(h, LAYOUT_MIN_VH);
      for (let n = 2; n <= 12; n++) {
        const l = computeWorldLayout({ place: "crypt", names: mkNames(n), viewportW: w, viewportH: h });
        const k = Math.ceil(n / 4);
        expect(l.chambers).toHaveLength(k);
        expect(l.chambers!.flat()).toEqual(Array.from({ length: n }, (_, i) => i));
        l.chambers!.forEach((c, j) => {
          expect(c.length).toBe(j < k - 1 ? 4 : n - 4 * (k - 1));
          for (const i of c) expect(l.slots[i].stratum).toBe(j + 1);
        });
        expect(l.strata).toHaveLength(k + 1);
        expect(l.strata[0].id).toBe("entry");
        expect(l.strata[0].bottom).toBeCloseTo(0.5 * vh);
        expect(l.features.filter((f) => f.kind === "stairs").length).toBeGreaterThanOrEqual(k);
        expect(l.features.some((f) => f.kind === "crypt-entry")).toBe(true);
        expect(l.features.some((f) => f.kind === "far-wall")).toBe(true);
        l.blendZones.forEach((z) => expect(["stairs", "arch"]).toContain(z.kind));
        if (n <= 4) expect(l.slots[n - 1].cy).toBeGreaterThan(vh);
      }
    }
  });

  it("crypt chamber heights follow entry 0.5, chamber 1 about 0.9, later about 0.7 Vh", () => {
    const l = computeWorldLayout({ place: "crypt", names: mkNames(12), viewportW: 1280, viewportH: 800 });
    const heights = l.strata.map((s) => (s.bottom - s.top) / 800);
    expect(heights[0]).toBeCloseTo(0.5);
    expect(heights[1]).toBeGreaterThanOrEqual(0.9 - 1e-9);
    expect(heights[2]).toBeGreaterThanOrEqual(0.7 - 1e-9);
    expect(heights.reduce((a, b) => a + b, 0)).toBeCloseTo(l.lengthVh);
  });
});
