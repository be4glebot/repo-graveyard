/**
 * Feature: repo-lifecycle-classification, Property 7: Terminal overrides always win
 *
 * A `finished` override always drives `classify` to the `tombstone` state and a
 * `scrapped` override always drives it to `coffin`, no matter the repo's archive
 * status, push/create dates, or finished/unfinished signals. These two override
 * intents are terminal and evaluated before every other rule, so nothing in the
 * repo facts or the `now` timestamp can change the resulting state.
 *
 * Validates: Requirements 3.3, 3.4, 7.2
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { classify, type LifecycleState, type Override } from "@/lib/lifecycle";
import { arbRepoFacts, arbIso } from "./arbitraries";

/**
 * The two terminal override intents. A narrower union than `OverrideType`
 * (which also includes the non-terminal `"revived"`), so indexing
 * `TERMINAL_EXPECTATIONS` with it is sound.
 */
type TerminalOverrideType = "finished" | "scrapped";

/** Maps each terminal override intent to the state it must always produce. */
const TERMINAL_EXPECTATIONS: Record<TerminalOverrideType, LifecycleState> = {
  finished: "tombstone",
  scrapped: "coffin",
};

describe("Property 7: Terminal overrides always win", () => {
  it("finished -> tombstone and scrapped -> coffin regardless of facts, dates, or signals", () => {
    fc.assert(
      fc.property(
        arbRepoFacts,
        fc.constantFrom<TerminalOverrideType>("finished", "scrapped"),
        arbIso,
        arbIso,
        (repo, type, setAt, now) => {
          const override: Override = { type, setAt };
          const result = classify(repo, override, now);
          return result.state === TERMINAL_EXPECTATIONS[type];
        },
      ),
      // A fixed seed keeps the run deterministic. The shared `arbIso` generator
      // builds its random branch from `fc.date(...).toISOString()`, and under
      // fast-check v4 `fc.date` can emit an `Invalid Date` (~0.4% of draws),
      // whose `.toISOString()` throws `RangeError: Invalid time value` during
      // generation — before any predicate runs. `arbitraries.ts` is shared and
      // must not be modified, so this seed pins a draw sequence that stays on
      // valid ISO strings while still exercising 100 runs through `arbIso`.
      { numRuns: 100, seed: 2 },
    );
  });
});
