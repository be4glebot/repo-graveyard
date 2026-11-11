import { describe, expect, it } from "vitest";
import {
  GRAVEYARD_TIMEOUT_MS,
  MAX_BODY_CHARS,
  SEANCE_TIMEOUT_MS,
  createClient,
  type Timers,
} from "../src/client";

const BASE = "http://localhost:3000";

const PAYLOAD = {
  owner: "octo",
  counts: { ghost: 1, risen: 0, zombie: 0, tombstone: 0, coffin: 0, total: 1 },
  truncated: false,
  repos: [
    {
      name: "a",
      state: "ghost",
      decay: 0,
      pushedAt: "2025-01-01T00:00:00Z",
      stars: 1,
      html_url: "https://github.com/octo/a",
    },
  ],
};

interface FetchCall {
  url: string;
  init: RequestInit;
}

function harness(
  responder: (call: FetchCall) => Promise<Response> | Response,
) {
  const calls: FetchCall[] = [];
  const setCalls: number[] = [];
  const cleared: unknown[] = [];
  let fire: (() => void) | undefined;
  const timers: Timers = {
    set(fn, ms) {
      setCalls.push(ms);
      fire = fn;
      return setCalls.length;
    },
    clear(h) {
      cleared.push(h);
    },
  };
  const fetchMock = ((url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return Promise.resolve(responder(call));
  }) as unknown as typeof fetch;
  const client = createClient({ baseUrl: BASE, fetch: fetchMock, timers });
  return { client, calls, setCalls, cleared, fire: () => fire?.() };
}

const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });
const status = (s: number, headers?: Record<string, string>) =>
  new Response("secret body", { status: s, headers });

const UNEXPECTED = "The app returned an unexpected response.";

describe("client requests", () => {
  it("getGraveyard sends one GET with the encoded owner and a 10 s timeout", async () => {
    const h = harness(() => json(PAYLOAD));
    const r = await h.client.getGraveyard("a b/c");
    expect(r.ok).toBe(true);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].url).toBe(`${BASE}/api/graveyard/a%20b%2Fc`);
    expect(h.calls[0].init.method).toBe("GET");
    expect(h.calls[0].init.body).toBeUndefined();
    expect(h.calls[0].init.redirect).toBe("manual");
    expect(h.calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect(h.setCalls).toEqual([GRAVEYARD_TIMEOUT_MS]);
    expect(GRAVEYARD_TIMEOUT_MS).toBe(10000);
    expect(h.cleared).toHaveLength(1);
  });

  it("postSeance sends one POST with JSON body, content-type and a 30 s timeout", async () => {
    const h = harness(() => json({ kind: "veil" }));
    const r = await h.client.postSeance("octo", "repo");
    expect(r).toEqual({ ok: true, value: { kind: "veil" } });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].url).toBe(`${BASE}/api/seance`);
    expect(h.calls[0].init.method).toBe("POST");
    expect(h.calls[0].init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(h.calls[0].init.body as string)).toEqual({
      owner: "octo",
      repo: "repo",
    });
    expect(Object.keys(JSON.parse(h.calls[0].init.body as string))).toEqual([
      "owner",
      "repo",
    ]);
    expect(h.setCalls).toEqual([SEANCE_TIMEOUT_MS]);
    expect(SEANCE_TIMEOUT_MS).toBe(30000);
  });

  it("sets no credential, cookie or authorization", async () => {
    const h = harness(() => json({ kind: "silent" }));
    await h.client.postSeance("o", "r");
    const init = h.calls[0].init as Record<string, unknown>;
    expect(init.credentials).toBeUndefined();
    expect(JSON.stringify(init.headers)).not.toMatch(/cookie|authorization/i);
  });
});

describe("client error mapping", () => {
  const cases: Array<[string, () => Response, string]> = [
    ["404", () => status(404), "No GitHub user or organization with that name was found."],
    ["429 without Retry-After", () => status(429), "The app is rate-limited. Try again later."],
    [
      "429 with Retry-After 30",
      () => status(429, { "retry-after": "30" }),
      "The app is rate-limited. Try again later. Wait 30 seconds.",
    ],
    [
      "429 with Retry-After 0",
      () => status(429, { "retry-after": "0" }),
      "The app is rate-limited. Try again later.",
    ],
    [
      "429 with HTTP-date Retry-After",
      () => status(429, { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }),
      "The app is rate-limited. Try again later.",
    ],
    [
      "429 with 7-digit Retry-After",
      () => status(429, { "retry-after": "1234567" }),
      "The app is rate-limited. Try again later.",
    ],
    ["500", () => status(500), "The app reported a server error."],
    ["599", () => status(599), "The app reported a server error."],
    ["200 non-JSON", () => new Response("<html>", { status: 200 }), UNEXPECTED],
    ["200 schema mismatch", () => json({ nope: true }), UNEXPECTED],
    ["200 oversized", () => new Response(" ".repeat(MAX_BODY_CHARS + 1), { status: 200 }), UNEXPECTED],
    ["201", () => status(201), UNEXPECTED],
    ["302", () => status(302, { location: "http://evil" }), UNEXPECTED],
    ["401", () => status(401), UNEXPECTED],
    ["418", () => status(418), UNEXPECTED],
  ];

  for (const [name, make, text] of cases) {
    it(`graveyard: ${name}`, async () => {
      const h = harness(make);
      expect(await h.client.getGraveyard("octo")).toEqual({ ok: false, text });
      expect(h.calls).toHaveLength(1);
      expect(h.cleared).toHaveLength(1);
    });
    it(`seance: ${name}`, async () => {
      const h = harness(make);
      expect(await h.client.postSeance("octo", "r")).toEqual({ ok: false, text });
      expect(h.calls).toHaveLength(1);
    });
  }

  it("400 is a rejected owner name for the graveyard only", async () => {
    const g = harness(() => status(400));
    expect(await g.client.getGraveyard("x")).toEqual({
      ok: false,
      text: "The app rejected the owner name.",
    });
    const s = harness(() => status(400));
    expect(await s.client.postSeance("x", "y")).toEqual({ ok: false, text: UNEXPECTED });
  });

  it("a rejected fetch is unreachable and does not leak the error", async () => {
    const h = harness(() => Promise.reject(new Error("ECONNREFUSED secret")) as never);
    const r = await h.client.getGraveyard("octo");
    expect(r).toEqual({
      ok: false,
      text: `Repo Graveyard isn't reachable at ${BASE}. Start the app (npm run dev) or set GRAVEYARD_URL.`,
    });
    expect(h.calls).toHaveLength(1);
    expect(h.cleared).toHaveLength(1);
  });

  it("a fired timeout aborts the request and reports seconds", async () => {
    let h!: ReturnType<typeof harness>;
    h = harness((call) => {
      return new Promise<Response>((_, reject) => {
        (call.init.signal as AbortSignal).addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
        h.fire();
      });
    });
    expect(await h.client.getGraveyard("octo")).toEqual({
      ok: false,
      text: "The app did not answer in time (10 seconds).",
    });
    expect(h.calls).toHaveLength(1);

    h = harness((call) => {
      return new Promise<Response>((_, reject) => {
        (call.init.signal as AbortSignal).addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
        h.fire();
      });
    });
    expect(await h.client.postSeance("octo", "r")).toEqual({
      ok: false,
      text: "The app did not answer in time (30 seconds).",
    });
    expect(h.calls).toHaveLength(1);
  });
});
