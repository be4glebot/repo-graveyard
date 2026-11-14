import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { GraveyardRow } from "@/lib/graveyard-view";
import {
  GHOST_DECAY_WORDS,
  ZOMBIE_DECAY_WORDS,
  orderForPlace,
  paginate,
  type PlaceFilter,
  type PlaceId,
} from "@/lib/estate-view";
import { applyFilter, placePlots } from "@/lib/place-pipeline";

function row(over: Partial<GraveyardRow>): GraveyardRow {
  return {
    name: "r",
    url: "https://github.com/o/r",
    state: "ghost",
    daysQuiet: 1,
    decayLevel: 0,
    ...over,
  };
}

describe("applyFilter", () => {
  const rows = [
    row({ name: "a", state: "ghost", decayLevel: 0 }),
    row({ name: "b", state: "ghost", decayLevel: 1 }),
    row({ name: "c", state: "zombie", decayLevel: 2 }),
    row({ name: "d", state: "risen", decayLevel: null }),
  ];

  it("keeps everything for all", () => {
    expect(applyFilter("sky", rows, "all")).toBe(rows);
  });

  it("filters risen rows", () => {
    expect(applyFilter("gate", rows, "risen").map((r) => r.name)).toEqual(["d"]);
  });

  it("filters sky by ghost decay word band", () => {
    const word = GHOST_DECAY_WORDS[1] as PlaceFilter;
    expect(applyFilter("sky", rows, word).map((r) => r.name)).toEqual(["b"]);
  });

  it("filters gate by zombie decay word band, zombies only", () => {
    const word = ZOMBIE_DECAY_WORDS[2] as PlaceFilter;
    expect(applyFilter("gate", rows, word).map((r) => r.name)).toEqual(["c"]);
  });

  it("is a no-op for decay words on ground and crypt", () => {
    const word = GHOST_DECAY_WORDS[0] as PlaceFilter;
    expect(applyFilter("ground", rows, word)).toBe(rows);
    expect(applyFilter("crypt", rows, word)).toBe(rows);
  });
});

describe("placePlots", () => {
  it("equals filter, order, paginate", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      row({ name: `g${i}`, daysQuiet: i, decayLevel: i % 4 }),
    );
    const expected = paginate(
      orderForPlace("sky", applyFilter("sky", rows, "all")),
      12,
    );
    expect(placePlots("sky", rows, "all", 12)).toEqual(expected);
  });

  it("always returns at least one plot and keeps every filtered row", () => {
    const places: PlaceId[] = ["sky", "gate", "ground", "crypt"];
    fc.assert(
      fc.property(
        fc.constantFrom(...places),
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: 1, max: 12 }),
        (place, n, size) => {
          const rows = Array.from({ length: n }, (_, i) =>
            row({ name: `n${i}`, daysQuiet: i }),
          );
          const plots = placePlots(place, rows, "all", size);
          expect(plots.length).toBeGreaterThanOrEqual(1);
          expect(plots.flat().length).toBe(n);
        },
      ),
      { numRuns: 100 },
    );
  });
});
