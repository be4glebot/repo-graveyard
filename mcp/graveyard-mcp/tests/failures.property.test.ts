import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHarness, type Recorded } from "./harness";

const OWNER = "octo";
const REPO = "demo";

type ToolName = "list_graveyard" | "get_grave" | "hold_seance" | "get_revival_brief";
const TOOLS: ToolName[] = ["list_graveyard", "get_grave", "hold_seance", "get_revival_brief"];
const SEANCE_TOOLS: ToolName[] = ["hold_seance", "get_revival_brief"];

const FIXED = {
  unreachable: "isn't reachable at",
  server: "The app reported a server error.",
  unexpected: "The app returned an unexpected response.",
};

const validPayload = {
  owner: OWNER,
  counts: { ghost: 0, risen: 0, zombie: 1, tombstone: 0, coffin: 0, total: 1 },
  truncated: false,
  repos: [
    {
      name: REPO,
      state: "zombie",
      decay: 1,
      pushedAt: "2024-01-01T00:00:00Z",
      stars: 3,
      html_url: `https://github.com/${OWNER}/${REPO}`,
    },
  ],
};

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

function argsFor(tool: ToolName): Record<string, string> {
  return tool === "list_graveyard" ? { owner: OWNER } : { owner: OWNER, repo: REPO };
}

const MARKER = "ZZMARKERZZ";
const markerArb = fc
  .string({ unit: fc.constantFrom(..."abcdefghijklmnop0123456789".split("")), minLength: 6, maxLength: 16 })
  .map((s) => `${MARKER}${s}`);

type Failure =
  | { kind: "reject"; marker: string }
  | { kind: "5xx"; status: number; marker: string }
  | { kind: "badBody"; marker: string; shape: number }
  | { kind: "status"; status: number; marker: string };

const failureArb: fc.Arbitrary<Failure> = fc.oneof(
  markerArb.map((marker): Failure => ({ kind: "reject", marker })),
  fc.record({ status: fc.integer({ min: 500, max: 599 }), marker: markerArb }).map(
    (r): Failure => ({ kind: "5xx", ...r }),
  ),
  fc.record({ marker: markerArb, shape: fc.integer({ min: 0, max: 4 }) }).map(
    (r): Failure => ({ kind: "badBody", ...r }),
  ),
  fc
    .record({
      status: fc.constantFrom(201, 202, 301, 302, 400, 401, 403, 405, 410, 418, 422),
      marker: markerArb,
    })
    .map((r): Failure => ({ kind: "status", ...r })),
);

function failingResponse(f: Failure): Response | Error {
  switch (f.kind) {
    case "reject": {
      const err = new Error(`connect ECONNREFUSED ${f.marker} C:\\secret\\${f.marker}\\app.js`);
      err.stack = `Error: ${f.marker}\n    at /home/${f.marker}/node_modules/x.js:1:1`;
      return err;
    }
    case "5xx":
      return new Response(`{"error":"${f.marker}"} at /srv/${f.marker}/app.js`, { status: f.status });
    case "badBody": {
      const bodies = [
        `not json ${f.marker}`,
        JSON.stringify({ owner: f.marker }),
        JSON.stringify([f.marker]),
        JSON.stringify({ ...validPayload, counts: { total: f.marker }, note: f.marker }),
        JSON.stringify({ kind: "ok", note: f.marker }),
      ];
      return new Response(bodies[f.shape], { status: 200 });
    }
    case "status":
      return new Response(`${f.marker}`, { status: f.status, headers: { location: `/${f.marker}` } });
  }
}

function expectedText(f: Failure, text: string, graveyardStep: boolean): void {
  if (f.kind === "status" && f.status === 400 && graveyardStep) {
    expect(text).toBe("The app rejected the owner name.");
    return;
  }
  if (f.kind === "reject") expect(text).toContain(FIXED.unreachable);
  else if (f.kind === "5xx") expect(text).toBe(FIXED.server);
  else expect(text).toBe(FIXED.unexpected);
}

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content.map((c) => c.text ?? "").join("\n");
}

describe("Property 14: failures never leak bodies, errors or paths", () => {
  let stdout: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    stdout.mockRestore();
  });

  async function run(
    tool: ToolName,
    f: Failure,
    failOn: "graveyard" | "seance",
  ): Promise<{ text: string; isError: unknown; calls: Recorded[] }> {
    const h = await createHarness({
      respond: (req) => {
        const isSeance = req.url.endsWith("/api/seance");
        if (failOn === "graveyard" || isSeance) return failingResponse(f);
        return jsonResponse(validPayload);
      },
    });
    try {
      const res = await h.client.callTool({ name: tool, arguments: argsFor(tool) });
      return { text: textOf(res), isError: res.isError, calls: [...h.calls] };
    } finally {
      await h.close();
    }
  }

  function assertClean(f: Failure, text: string, graveyardStep: boolean): void {
    expect(text).not.toContain(MARKER);
    expect(text).not.toContain(f.marker);
    expect(text).not.toMatch(/\n\s+at\s/);
    expect(text).not.toMatch(/[A-Za-z]:\\|\/home\/|\/srv\/|node_modules/);
    expectedText(f, text, graveyardStep);
  }

  // Feature: graveyard-mcp, Property 14: Failures never leak bodies, errors or paths
  /** **Validates: Requirements 7.5, 7.10, 11.3, 11.5, 11.6, 11.7, 11.8, 11.10** */
  it("graveyard-fetch failures yield fixed text for every tool", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...TOOLS), failureArb, async (tool, f) => {
        const { text, isError, calls } = await run(tool, f, "graveyard");
        expect(isError).toBe(true);
        assertClean(f, text, tool !== "hold_seance");
        expect(calls).toHaveLength(1);
        expect(stdout).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: graveyard-mcp, Property 14: Failures never leak bodies, errors or paths
  /** **Validates: Requirements 7.5, 7.10, 11.3, 11.5, 11.6, 11.7, 11.8, 11.10** */
  it("séance-fetch failures yield fixed text for the séance tools", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...SEANCE_TOOLS), failureArb, async (tool, f) => {
        const { text, isError, calls } = await run(tool, f, "seance");
        expect(isError).toBe(true);
        assertClean(f, text, false);
        expect(calls).toHaveLength(tool === "get_revival_brief" ? 2 : 1);
        expect(stdout).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });
});
