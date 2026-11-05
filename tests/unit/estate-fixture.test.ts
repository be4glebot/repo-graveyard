/**
 * Estate fixture conformance test (task 9.2).
 *
 * Feature: haunted-graveyard-scene, Property 12: Estate fixture conforms to its schema.
 *
 * This is a schema-conformance unit test, not a fast-check property. It pins the
 * bundled fixture (`data/estate.json`) against three guarantees:
 *
 *   1. The fixture parses cleanly through `estateSchema` (every entry conforms).
 *   2. Resolved at a fixed `now` and run through `classify`, the fixture yields
 *      at least one repository in every one of the five lifecycle states
 *      (ghost, risen, zombie, tombstone, coffin).
 *   3. The fixture exercises every override type (finished, scrapped, revived).
 *
 * A fixed `now` keeps the resolved states deterministic: because the fixture
 * stores days-ago offsets and `resolveEstate` reconstructs each base timestamp
 * as `now - daysAgo * msPerDay`, the resolved classification is identical on any
 * calendar day, so this test never drifts with the wall clock.
 *
 * Validates: Requirements 12.2, 12.5, 12.9
 */

import { describe, expect, it } from "vitest";
import estateData from "@/data/estate.json";
import { estateSchema } from "@/lib/estate-schema";
import { resolveEstate } from "@/lib/estate";
import { classify, type LifecycleState, type OverrideType } from "@/lib/lifecycle";

/** A fixed reference instant so resolved states are deterministic. */
const FIXED_NOW = "2025-01-01T00:00:00.000Z";

/** The five lifecycle states every fixture must cover. */
const ALL_STATES: readonly LifecycleState[] = [
  "ghost",
  "risen",
  "zombie",
  "tombstone",
  "coffin",
];

/** The three override types the fixture must exercise. */
const ALL_OVERRIDE_TYPES: readonly OverrideType[] = ["finished", "scrapped", "revived"];

describe("estate fixture conformance (Property 12, Req 12.2/12.5/12.9)", () => {
  it("parses cleanly through estateSchema", () => {
    // A schema violation throws here with a descriptive ZodError.
    expect(() => estateSchema.parse(estateData)).not.toThrow();

    const parsed = estateSchema.parse(estateData);
    expect(parsed.username.length).toBeGreaterThan(0);
    expect(parsed.repos.length).toBeGreaterThan(0);
  });

  it("resolves to at least one repository in every lifecycle state", () => {
    const parsed = estateSchema.parse(estateData);
    const { repos, overrides } = resolveEstate(parsed, FIXED_NOW);

    const states = new Set<LifecycleState>(
      repos.map((repo) => classify(repo, overrides[repo.name], FIXED_NOW).state),
    );

    for (const state of ALL_STATES) {
      expect(states, `expected at least one repo in state "${state}"`).toContain(state);
    }
  });

  it("exercises every override type", () => {
    const parsed = estateSchema.parse(estateData);

    const overrideTypes = new Set<OverrideType>(
      parsed.repos
        .map((repo) => repo.override?.type)
        .filter((type): type is OverrideType => type !== undefined),
    );

    for (const type of ALL_OVERRIDE_TYPES) {
      expect(overrideTypes, `expected an override of type "${type}"`).toContain(type);
    }
  });
});
