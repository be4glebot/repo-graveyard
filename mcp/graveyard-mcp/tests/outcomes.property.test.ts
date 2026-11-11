import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createHarness } from "./harness";

// Feature: graveyard-mcp, Property 15: Non-ok séance outcomes return fixed text
// **Validates: Requirements 7.6, 7.7, 7.8, 7.9, 8.6**

const FIXED = {
  veil: "The ghost could not be summoned right now: the séance is resting (a limit or budget was reached). Try again later.",
  weak: "This repo has too little history for the ghost to say anything grounded.",
  silent: "The ghost stayed silent. Try again.",
} as const;

const GRAVEYARD = {
  owner: "octo",
  counts: { ghost: 0, risen: 0, zombie: 1, tombstone: 0, coffin: 0, total: 1 },
  truncated: false,
  repos: [
    {
      name: "cat",
      state: "zombie",
      decay: 1,
      pushedAt: "2024-01-01T00:00:00Z",
      stars: 2,
      html_url: "https://github.com/octo/cat",
    },
  ],
};

const kindArb = fc.constantFrom<"veil" | "weak" | "silent">("veil", "weak", "silent");

// Distinctive marker values so a leak is unambiguous.
const extraValueArb = fc.stringMatching(/^[a-z0-9]{6,20}$/).map((s) => `ZQX${s}`);
const extrasArb = fc.dictionary(
  fc.stringMatching(/^[a-z]{3,10}$/).map((s) => `x_${s}`),
  extraValueArb,
  { maxKeys: 6 },
);

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("Property 15: non-ok séance outcomes return fixed text", () => {
  it("hold_seance and get_revival_brief return the fixed text and leak no extra values", async () => {
    await fc.assert(
      fc.asyncProperty(kindArb, extrasArb, async (kind, extras) => {
        const h = await createHarness({
          respond: (req) =>
            req.method === "GET" ? json(GRAVEYARD) : json({ ...extras, kind }),
        });
        try {
          for (const [tool, heading] of [
            ["hold_seance", "# Séance"],
            ["get_revival_brief", "# Revival brief"],
          ] as const) {
            const res = await h.client.callTool({
              name: tool,
              arguments: { owner: "octo", repo: "cat" },
            });
            const content = res.content as { type: string; text: string }[];
            const text = content.map((c) => c.text).join("\n");
            expect(res.isError).toBeFalsy();
            expect(text).toBe(`${heading}\n${FIXED[kind]}`);
            for (const v of Object.values(extras)) expect(text).not.toContain(v);
          }
        } finally {
          await h.close();
        }
      }),
      { numRuns: 100 },
    );
  });
});
