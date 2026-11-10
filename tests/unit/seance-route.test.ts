/**
 * Unit tests for app/api/seance/route.ts.
 *
 * Every collaborator is mocked; no real API, cache or LLM is reached.
 * Requirements 4.17, 19.2, 19.3, 19.7, 20.27.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSeance: vi.fn(),
  loadGraveyard: vi.fn(),
  createGithubTransport: vi.fn(),
  createLlmClient: vi.fn(),
  createRateLimiter: vi.fn(),
  createUpstashRedis: vi.fn(),
  createUpstashStore: vi.fn(),
  fetchEvidence: vi.fn(),
}));

vi.mock("@/lib/seance-service", () => ({ runSeance: mocks.runSeance }));
vi.mock("@/lib/graveyard-loader", () => ({
  loadGraveyard: mocks.loadGraveyard,
}));
vi.mock("@/lib/github", () => ({
  createGithubTransport: mocks.createGithubTransport,
}));
vi.mock("@/lib/llm", () => ({ createLlmClient: mocks.createLlmClient }));
vi.mock("@/lib/ratelimit", () => ({
  clientIp: () => "203.0.113.9",
  createRateLimiter: mocks.createRateLimiter,
}));
vi.mock("@/lib/ratelimit-store", () => ({
  createUpstashRedis: mocks.createUpstashRedis,
  createUpstashStore: mocks.createUpstashStore,
}));
vi.mock("@/lib/seance-gather", () => ({
  fetchEvidence: mocks.fetchEvidence,
}));

import { POST, maxDuration } from "@/app/api/seance/route";

const SENTINEL = "SENTINEL-KEY-do-not-leak-7f3a9c";

function req(body: string): Request {
  return new Request("http://localhost/api/seance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

function expectNothingCalled() {
  for (const m of Object.values(mocks)) expect(m).not.toHaveBeenCalled();
}

let logSpies: ReturnType<typeof vi.spyOn>[];
let originalKey: string | undefined;

beforeEach(() => {
  originalKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = SENTINEL;
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.createUpstashRedis.mockResolvedValue(null);
  mocks.runSeance.mockResolvedValue({ kind: "silent" });
  logSpies = (["log", "warn", "error", "info", "debug"] as const).map((k) =>
    vi.spyOn(console, k).mockImplementation(() => {}),
  );
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.LLM_API_KEY;
  else process.env.LLM_API_KEY = originalKey;
  vi.restoreAllMocks();
});

describe("POST /api/seance", () => {
  it("declares maxDuration 30", () => {
    expect(maxDuration).toBe(30);
  });

  it("rejects a body over 4096 bytes with a generic 400", async () => {
    const big = JSON.stringify({ owner: "o", repo: "r", pad: "x".repeat(5000) });
    const res = await POST(req(big));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad request" });
    expectNothingCalled();
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad request" });
    expectNothingCalled();
  });

  it.each([
    ["missing owner", { repo: "r" }],
    ["missing repo", { owner: "o" }],
    ["empty owner", { owner: "", repo: "r" }],
    ["empty repo", { owner: "o", repo: "" }],
    ["non-string owner", { owner: 5, repo: "r" }],
    ["non-string repo", { owner: "o", repo: ["r"] }],
    ["owner too long", { owner: "o".repeat(40), repo: "r" }],
    ["repo too long", { owner: "o", repo: "r".repeat(101) }],
    ["null body", null],
    ["array body", []],
  ])("rejects %s with a generic body that echoes nothing", async (_n, body) => {
    const res = await POST(req(JSON.stringify(body)));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "bad request" });
    expect(text).not.toContain("o".repeat(40));
    expect(text).not.toContain(SENTINEL);
    expectNothingCalled();
  });

  it("does not echo submitted values in a 400 body", async () => {
    const res = await POST(req(JSON.stringify({ owner: "secret-owner", repo: 7 })));
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(text).toBe('{"error":"bad request"}');
    expect(text).not.toContain("secret-owner");
  });

  it("returns 200 no-store and strips unknown keys before runSeance", async () => {
    const res = await POST(
      req(
        JSON.stringify({
          owner: "octo",
          repo: "cat",
          pushedAt: "2020-01-01T00:00:00Z",
          extra: 1,
        }),
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ kind: "silent" });

    expect(mocks.runSeance).toHaveBeenCalledTimes(1);
    const input = mocks.runSeance.mock.calls[0][0];
    expect(input).toEqual({ owner: "octo", repo: "cat", ip: "203.0.113.9" });
    expect(input).not.toHaveProperty("pushedAt");
    expect(input).not.toHaveProperty("extra");
  });

  it("sets no-store on the 400 response too", async () => {
    const res = await POST(req("nope"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("never leaks the LLM key into a response or console output", async () => {
    const responses = [
      await POST(req("garbage")),
      await POST(req(JSON.stringify({ owner: "o" }))),
      await POST(req(JSON.stringify({ owner: "o", repo: "r" }))),
    ];
    for (const res of responses) {
      expect(await res.text()).not.toContain(SENTINEL);
      for (const [k, v] of res.headers) {
        expect(k).not.toContain(SENTINEL);
        expect(v).not.toContain(SENTINEL);
      }
    }
    for (const spy of logSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SENTINEL);
    }
  });

  it("does not leak the key when the service logs through the route", async () => {
    mocks.runSeance.mockImplementation(async (_i, deps) => {
      deps.log({ repo: "r", reason: "llm_failed" });
      return { kind: "silent" };
    });
    const res = await POST(req(JSON.stringify({ owner: "o", repo: "r" })));
    expect(await res.text()).not.toContain(SENTINEL);
    for (const spy of logSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SENTINEL);
    }
  });
});
