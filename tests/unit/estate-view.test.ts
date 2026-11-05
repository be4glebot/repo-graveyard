/**
 * Unit tests for the exact plaque copy strings produced by `plaqueCopy`
 * (task 5.3).
 *
 * These pin the precise, human-facing mock strings for representative places
 * and counts, complementing the `plaqueCopy` property test (Property 4) which
 * checks singular/plural structure across all inputs. Here we assert exact
 * equality so the copy — including the gate's separate risen clause and its
 * " · " separator — cannot drift silently.
 *
 * Requirements: 4.1, 4.2, 4.5
 */

import { describe, expect, it } from "vitest";
import { plaqueCopy } from "@/lib/estate-view";

describe("plaqueCopy exact strings (Req 4.1, 4.2, 4.5)", () => {
  it("gate with zombies and a risen clause joins both with ' · '", () => {
    expect(plaqueCopy("gate", 48, 1)).toBe(
      "48 undead shamble here, waiting for a verdict · 1 has risen",
    );
  });

  it("gate with zero risen omits the risen clause entirely", () => {
    expect(plaqueCopy("gate", 48, 0)).toBe(
      "48 undead shamble here, waiting for a verdict",
    );
  });

  it("sky with a single ghost uses the singular noun and verb", () => {
    expect(plaqueCopy("sky", 1)).toBe("1 ghost still wanders");
  });

  it("crypt with nothing sealed away reads the empty-copy line", () => {
    expect(plaqueCopy("crypt", 0)).toBe("No one sealed away yet");
  });
});

/**
 * Unit tests for `parsePlaceId` and the deep-link precedence encoded in
 * `resolveInitialView` (task 7.2).
 *
 * `parsePlaceId` is exercised across each valid id, unknown strings, and the
 * empty/undefined cases; `resolveInitialView` is exercised against small
 * fixture graveyards spanning multiple places so each precedence branch can be
 * asserted to land in the right place with the right selection.
 *
 * Requirements: 10.2, 10.3, 11.1, 11.2, 11.3, 11.4
 */

import {
  parsePlaceId,
  resolveInitialView,
  type PlaceId,
} from "@/lib/estate-view";
import type { GraveyardRow } from "@/lib/graveyard-view";

/** Build a GraveyardRow fixture with sensible defaults per state. */
function row(overrides: Partial<GraveyardRow> & Pick<GraveyardRow, "name" | "state">): GraveyardRow {
  return {
    url: `https://github.com/acme/${overrides.name}`,
    daysQuiet: 0,
    decayLevel: null,
    ...overrides,
  };
}

/**
 * A fixture graveyard spanning all four places so deep-link resolution can be
 * asserted to land each named repo in the correct place:
 *  - `spectre`   ghost     → sky
 *  - `shambler`  zombie    → gate
 *  - `lazarus`   risen     → gate
 *  - `monument`  tombstone → ground
 *  - `sealed`    coffin    → crypt
 */
const FIXTURE: GraveyardRow[] = [
  row({ name: "spectre", state: "ghost", daysQuiet: 20, decayLevel: 2 }),
  row({ name: "shambler", state: "zombie", daysQuiet: 400, decayLevel: 1 }),
  row({ name: "lazarus", state: "risen", daysQuiet: 5 }),
  row({ name: "monument", state: "tombstone", daysQuiet: 90 }),
  row({ name: "sealed", state: "coffin", daysQuiet: 1200 }),
];

describe("parsePlaceId (Req 10.2, 10.3)", () => {
  const validIds: PlaceId[] = ["sky", "gate", "ground", "crypt"];

  it.each(validIds)("returns %s for the matching valid id", (id) => {
    expect(parsePlaceId(id)).toBe(id);
  });

  it.each(["", "SKY", "Gate", " sky", "sky ", "garden", "map", "ghost"])(
    "returns null for the unknown/empty string %j",
    (value) => {
      expect(parsePlaceId(value)).toBeNull();
    },
  );

  it("returns null for undefined", () => {
    expect(parsePlaceId(undefined)).toBeNull();
  });
});

describe("resolveInitialView precedence (Req 11.1–11.4)", () => {
  it("a valid ?at= wins over a deep-link repo in a different place (Req 11.2)", () => {
    // The repo lives at the gate, but ?at=crypt is explicit and must win.
    const result = resolveInitialView(FIXTURE, "crypt", "shambler");
    expect(result.view).toBe("crypt");
    // The deep-linked creature stays selected even though the view is forced.
    expect(result.selected).toBe("shambler");
  });

  it("no ?at= + a matching repo opens that repo's place with it selected (Req 11.1, 11.3)", () => {
    const result = resolveInitialView(FIXTURE, undefined, "spectre");
    expect(result.view).toBe("sky");
    expect(result.selected).toBe("spectre");
  });

  it("resolves a risen deep-link repo to the gate (Req 11.3)", () => {
    const result = resolveInitialView(FIXTURE, undefined, "lazarus");
    expect(result.view).toBe("gate");
    expect(result.selected).toBe("lazarus");
  });

  it("matches the deep-link repo case-insensitively (Req 11.3)", () => {
    const result = resolveInitialView(FIXTURE, undefined, "MONUMENT");
    expect(result.view).toBe("ground");
    // The original-cased row name is returned, not the query's casing.
    expect(result.selected).toBe("monument");
  });

  it("no ?at= + an unmatched repo falls back to the map with no selection (Req 11.4)", () => {
    const result = resolveInitialView(FIXTURE, undefined, "does-not-exist");
    expect(result.view).toBe("map");
    expect(result.selected).toBeNull();
  });

  it("an invalid ?at= falls through to the deep-link repo's place (Req 11.1, 11.2)", () => {
    // "garden" is not a place, so precedence falls to the matching repo.
    const result = resolveInitialView(FIXTURE, "garden", "sealed");
    expect(result.view).toBe("crypt");
    expect(result.selected).toBe("sealed");
  });

  it("an empty ?at= with no deep link lands on the map (Req 11.4)", () => {
    const result = resolveInitialView(FIXTURE, "", undefined);
    expect(result.view).toBe("map");
    expect(result.selected).toBeNull();
  });

  it("a valid ?at= with no deep link opens the place with nothing selected (Req 11.2, 11.4)", () => {
    const result = resolveInitialView(FIXTURE, "gate", undefined);
    expect(result.view).toBe("gate");
    expect(result.selected).toBeNull();
  });

  it("no ?at= and no deep link lands on the map (Req 11.4)", () => {
    const result = resolveInitialView(FIXTURE, undefined, undefined);
    expect(result.view).toBe("map");
    expect(result.selected).toBeNull();
  });
});
