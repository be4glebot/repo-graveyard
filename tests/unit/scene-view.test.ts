/**
 * Unit tests for the remaining pure scene view-model helpers (task 6.2).
 *
 * Concrete-example coverage for `selectInitialCreature`, `creatureAccessibleName`,
 * `pickTurningSoon`, and the `ZONE_RECTS` constant. These complement the
 * property tests by pinning specific behaviors: case-insensitive deep-link
 * matching, accessible-name composition with omitted fields, turning-soon
 * selection and its pushed-at tie-break, and the zone-rectangle bounds.
 *
 * Requirements: 1.2, 1.3, 7.8, 9.1, 9.2, 5.1, 11.1
 */

import { describe, expect, it } from "vitest";
import {
  ZONE_RECTS,
  creatureAccessibleName,
  pickTurningSoon,
  selectInitialCreature,
  type ZoneName,
} from "@/lib/scene-view";
import { type GraveyardRow } from "@/lib/graveyard-view";
import { type RepoFacts } from "@/lib/lifecycle";

/** Builds a GraveyardRow, overriding only the fields a test cares about. */
function row(overrides: Partial<GraveyardRow> = {}): GraveyardRow {
  return {
    name: "repo",
    url: "https://github.com/octocat/repo",
    state: "ghost",
    daysQuiet: 0,
    decayLevel: 0,
    ...overrides,
  };
}

/** Builds a RepoFacts with only name + pushedAt meaningfully set. */
function repo(name: string, pushedAt: string | null): RepoFacts {
  return {
    name,
    description: null,
    url: `https://github.com/octocat/${name}`,
    pushedAt,
    createdAt: "2020-01-01T00:00:00.000Z",
    isArchived: false,
    isFork: false,
    homepageUrl: null,
    stargazerCount: 0,
    primaryLanguage: null,
    openIssueCount: 0,
    releaseCount: 0,
    readmeBytes: null,
    lastCommitMessage: null,
  };
}

// ---------------------------------------------------------------------------
// selectInitialCreature (Req 1.2 / 1.3)
// ---------------------------------------------------------------------------

describe("selectInitialCreature (Req 1.2, 1.3)", () => {
  it("matches case-insensitively and returns the row's original casing", () => {
    const rows = [row({ name: "weather-app" }), row({ name: "OtherRepo" })];
    // "WEATHER-APP" differs only in case; the original "weather-app" is returned.
    expect(selectInitialCreature(rows, "WEATHER-APP")).toBe("weather-app");
  });

  it("preserves mixed-case row names on a lowercase deep-link target", () => {
    const rows = [row({ name: "MyCoolRepo" })];
    expect(selectInitialCreature(rows, "mycoolrepo")).toBe("MyCoolRepo");
  });

  it("trims surrounding whitespace on the deep-link target before matching", () => {
    const rows = [row({ name: "spaced-repo" })];
    expect(selectInitialCreature(rows, "  Spaced-Repo  ")).toBe("spaced-repo");
  });

  it("returns null when no row name matches", () => {
    const rows = [row({ name: "alpha" }), row({ name: "beta" })];
    expect(selectInitialCreature(rows, "gamma")).toBeNull();
  });

  it("returns null for an undefined deep-link target", () => {
    const rows = [row({ name: "alpha" })];
    expect(selectInitialCreature(rows, undefined)).toBeNull();
  });

  it("returns null for an empty or whitespace-only deep-link target", () => {
    const rows = [row({ name: "alpha" })];
    expect(selectInitialCreature(rows, "")).toBeNull();
    expect(selectInitialCreature(rows, "   ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// creatureAccessibleName (Req 9.1 / 9.2)
// ---------------------------------------------------------------------------

describe("creatureAccessibleName (Req 9.1, 9.2)", () => {
  it("composes name, state, and humanized time-quiet in order", () => {
    const result = creatureAccessibleName(
      row({ name: "weather-app", state: "zombie", daysQuiet: 240 }),
    );
    // 240 days => 240 / 30 = 8 whole months, lead verb "abandoned".
    expect(result).toBe("weather-app, zombie, abandoned 8 months");
  });

  it("humanizes a short gap with the 'quiet N days' phrasing", () => {
    const result = creatureAccessibleName(
      row({ name: "fresh", state: "ghost", daysQuiet: 3 }),
    );
    expect(result).toBe("fresh, ghost, quiet 3 days");
  });

  it("omits the name when it is missing but keeps state and time", () => {
    const result = creatureAccessibleName({ state: "ghost", daysQuiet: 3 });
    expect(result).toBe("ghost, quiet 3 days");
    expect(result).not.toContain("undefined");
  });

  it("omits the state when it is missing but keeps name and time", () => {
    const result = creatureAccessibleName({ name: "weather-app", daysQuiet: 3 });
    expect(result).toBe("weather-app, quiet 3 days");
    expect(result).not.toContain("undefined");
  });

  it("omits the time when daysQuiet is missing but keeps name and state", () => {
    const result = creatureAccessibleName({ name: "weather-app", state: "zombie" });
    expect(result).toBe("weather-app, zombie");
    expect(result).not.toContain("undefined");
  });

  it("never emits the literal 'undefined' for an empty row", () => {
    expect(creatureAccessibleName({})).toBe("");
    expect(creatureAccessibleName({})).not.toContain("undefined");
  });
});

// ---------------------------------------------------------------------------
// pickTurningSoon (Req 7.8)
// ---------------------------------------------------------------------------

describe("pickTurningSoon (Req 7.8)", () => {
  const NOW = "2024-06-01T00:00:00.000Z";

  it("selects the ghost with the fewest whole days left to turn", () => {
    // ghostMaxDaysQuiet is 90; daysLeft = 90 - daysQuiet. Both ghosts sit in
    // the [0, 30] turning-soon window. 85 => daysLeft 5; 70 => daysLeft 20.
    const rows = [
      row({ name: "far-off", state: "ghost", daysQuiet: 70 }),
      row({ name: "almost", state: "ghost", daysQuiet: 85 }),
    ];
    const repos = [repo("far-off", null), repo("almost", null)];

    const result = pickTurningSoon(repos, rows, NOW);
    expect(result).toEqual({ name: "almost", daysLeft: 5 });
  });

  it("breaks a fewest-days tie by the latest pushedAt", () => {
    // Both ghosts have daysQuiet 80 => daysLeft 10 (a tie). The one with the
    // more recent push wins the tie-break.
    const rows = [
      row({ name: "older-push", state: "ghost", daysQuiet: 80 }),
      row({ name: "newer-push", state: "ghost", daysQuiet: 80 }),
    ];
    const repos = [
      repo("older-push", "2024-01-01T00:00:00.000Z"),
      repo("newer-push", "2024-05-01T00:00:00.000Z"),
    ];

    const result = pickTurningSoon(repos, rows, NOW);
    expect(result).toEqual({ name: "newer-push", daysLeft: 10 });
  });

  it("ignores ghosts outside the turning-soon window and non-ghost rows", () => {
    // daysQuiet 40 => daysLeft 50 (outside the 30-day window); a zombie is not
    // a ghost. With no qualifying ghost the result is null.
    const rows = [
      row({ name: "cozy-ghost", state: "ghost", daysQuiet: 40 }),
      row({ name: "a-zombie", state: "zombie", daysQuiet: 300 }),
    ];
    const repos = [repo("cozy-ghost", null), repo("a-zombie", null)];

    expect(pickTurningSoon(repos, rows, NOW)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ZONE_RECTS (Req 5.1, 11.1)
// ---------------------------------------------------------------------------

describe("ZONE_RECTS (Req 5.1, 11.1)", () => {
  const ZONE_NAMES: ZoneName[] = [
    "ghost",
    "risen",
    "tombstone",
    "zombie",
    "coffin",
  ];

  it("holds exactly the five zone keys", () => {
    expect(Object.keys(ZONE_RECTS).sort()).toEqual([...ZONE_NAMES].sort());
  });

  it("keeps every rectangle within the [0,100] percentage viewport", () => {
    for (const name of ZONE_NAMES) {
      const rect = ZONE_RECTS[name];
      const bounds = [rect.left, rect.top, rect.width, rect.height];
      for (const value of bounds) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      // The rectangle must not spill past the right or bottom edge.
      expect(rect.left + rect.width).toBeLessThanOrEqual(100);
      expect(rect.top + rect.height).toBeLessThanOrEqual(100);
    }
  });
});
