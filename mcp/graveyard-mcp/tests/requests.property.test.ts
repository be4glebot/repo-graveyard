import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createHarness, HARNESS_BASE_URL } from "./harness";

const owner = fc.stringMatching(/^[A-Za-z0-9]{1,12}$/);
const repoName = fc
  .stringMatching(/^[A-Za-z0-9][A-Za-z0-9._-]{0,20}$/)
  .filter((r) => r !== "." && r !== "..");
const tool = fc.constantFrom("list_graveyard", "get_grave", "hold_seance", "get_revival_brief");

const FORBIDDEN_HEADERS = ["cookie", "authorization", "proxy-authorization", "x-api-key"];

// Feature: graveyard-mcp, Property 17: Only the two allowed request shapes are sent
describe("Property 17: only the two allowed request shapes are sent", () => {
  it("sends only GET /api/graveyard/<owner> and POST /api/seance {owner, repo}, with no credentials", async () => {
    await fc.assert(
      fc.asyncProperty(tool, owner, repoName, fc.boolean(), async (name, o, repo, repoPresent) => {
        const h = await createHarness({
          respond: (req) => {
            if (req.method === "POST") return Response.json({ kind: "unavailable" });
            const repos = repoPresent
              ? [{ name: repo, state: "zombie", decay: null, pushedAt: null, stars: 0, html_url: "https://x.test/r" }]
              : [];
            const counts = { ghost: 0, risen: 0, zombie: repos.length, tombstone: 0, coffin: 0, total: repos.length };
            return Response.json({ owner: o, counts, truncated: false, repos });
          },
        });
        try {
          const args = name === "list_graveyard" ? { owner: o } : { owner: o, repo };
          await h.client.callTool({ name, arguments: args });

          for (const c of h.calls) {
            if (c.method === "GET") {
              expect(c.url).toBe(`${HARNESS_BASE_URL}/api/graveyard/${encodeURIComponent(o)}`);
              expect(c.body).toBeUndefined();
            } else {
              expect(c.method).toBe("POST");
              expect(c.url).toBe(`${HARNESS_BASE_URL}/api/seance`);
              expect(c.headers["content-type"]).toBe("application/json");
              expect(JSON.parse(c.body ?? "null")).toEqual({ owner: o, repo });
            }
            expect(c.credentials).toBeUndefined();
            for (const hn of FORBIDDEN_HEADERS) expect(c.headers[hn]).toBeUndefined();
          }

          const methods = h.calls.map((c) => c.method);
          if (name === "hold_seance") {
            expect(methods).toEqual(["POST"]);
          } else if (name === "get_revival_brief") {
            expect(methods).toEqual(repoPresent ? ["GET", "POST"] : ["GET"]);
          } else {
            expect(methods).toEqual(["GET"]);
          }
        } finally {
          await h.close();
        }
      }),
      { numRuns: 100 },
    );
  });
});
