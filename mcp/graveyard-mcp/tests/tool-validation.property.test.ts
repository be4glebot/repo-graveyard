import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";
import { isValidOwner, isValidRepo } from "../src/validate";

const TOOLS = [
  { name: "list_graveyard", needsRepo: false },
  { name: "get_grave", needsRepo: true },
  { name: "hold_seance", needsRepo: true },
  { name: "get_revival_brief", needsRepo: true },
] as const;

const MISSING = Symbol("missing");
type Arg = string | number | boolean | null | unknown[] | Record<string, unknown> | typeof MISSING;

const nonStrings: fc.Arbitrary<Arg> = fc.oneof(
  fc.constant(MISSING),
  fc.constant(null),
  fc.integer(),
  fc.boolean(),
  fc.array(fc.string(), { maxLength: 3 }),
  fc.dictionary(fc.string({ maxLength: 5 }), fc.string({ maxLength: 5 }), { maxKeys: 2 }),
);

const badStrings = (valid: (s: string) => boolean): fc.Arbitrary<string> =>
  fc
    .oneof(
      fc.constantFrom("", ".", "..", "-", "a-", "-a", "a--b", "a/b", "a?b", "a#b", "a%20b", "a b", "é", "\n"),
      fc.string({ maxLength: 120 }),
      fc.string({ unit: "grapheme", minLength: 1, maxLength: 20 }),
      fc.constantFrom("a", "b", "-").chain((c) => fc.integer({ min: 101, max: 150 }).map((n) => c.repeat(n))),
    )
    .filter((s) => !valid(s));

const badOwner: fc.Arbitrary<Arg> = fc.oneof(nonStrings, badStrings(isValidOwner));
const badRepo: fc.Arbitrary<Arg> = fc.oneof(nonStrings, badStrings(isValidRepo));
const goodOwner = fc.constantFrom("octocat", "a-b", "Zach1", "x");
const goodRepo = fc.constantFrom("hello", "a.b_c-d", "repo", "x");

function build(owner: Arg, repo: Arg): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (owner !== MISSING) args.owner = owner;
  if (repo !== MISSING) args.repo = repo;
  return args;
}

describe("graveyard-mcp tool-level argument validation", () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await createHarness({
      respond: () => new Response("{}", { status: 200 }),
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  // Feature: graveyard-mcp, Property 7: Name validator accepts exactly the valid names and blocks I/O on rejection
  // Validates: Requirements 3.7, 4.1, 4.2, 4.6, 4.7, 4.8
  it("rejects invalid or missing arguments with isError, names the offender (owner first), and sends no request", async () => {
    // Each case: [tool, owner, repo] where at least one relevant argument is invalid.
    type Case = { tool: (typeof TOOLS)[number]; owner: Arg; repo: Arg; expected: "owner" | "repo" };
    const cases: fc.Arbitrary<Case> = fc.constantFrom(...TOOLS).chain((tool): fc.Arbitrary<Case> => {
      const ownerBad = tool.needsRepo ? fc.boolean() : fc.constant(true);
      return ownerBad.chain((ob): fc.Arbitrary<Case> =>
        ob
          ? fc
              .tuple(badOwner, fc.oneof(badRepo, goodRepo))
              .map(([o, r]) => ({ tool, owner: o, repo: r, expected: "owner" }))
          : fc
              .tuple(goodOwner, badRepo)
              .map(([o, r]) => ({ tool, owner: o, repo: r, expected: "repo" })),
      );
    });

    await fc.assert(
      fc.asyncProperty(cases, async ({ tool, owner, repo, expected }) => {
        const before = harness.calls.length;
        const res = await harness.client.callTool({
          name: tool.name,
          arguments: build(owner, repo),
        });
        expect(res.isError).toBe(true);
        const content = res.content as { type: string; text: string }[];
        expect(content).toHaveLength(1);
        const text = content[0].text;
        expect(text).toContain(`Invalid argument "${expected}"`);
        if (expected === "repo") expect(text).not.toContain('Invalid argument "owner"');
        expect(harness.calls.length).toBe(before);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: graveyard-mcp, Property 7: Name validator accepts exactly the valid names and blocks I/O on rejection
  // Validates: Requirements 4.1, 4.2
  it("treats entirely missing arguments as an invalid owner with zero fetches", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...TOOLS), async (tool) => {
        const before = harness.calls.length;
        const res = await harness.client.callTool({ name: tool.name });
        expect(res.isError).toBe(true);
        const text = (res.content as { text: string }[])[0].text;
        expect(text).toContain('Invalid argument "owner"');
        expect(harness.calls.length).toBe(before);
      }),
      { numRuns: 100 },
    );
  });
});
