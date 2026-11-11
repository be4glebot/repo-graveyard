/**
 * Diagnostics and parsing robustness for live séances: fenced JSON, non-text
 * content blocks, and every failure category the dev-only diagnostic reports.
 * The real adapter is used with a stubbed `fetch`; the real API is never hit.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractJsonObject } from "@/lib/ai";
import { LlmError, createLlmClient } from "@/lib/llm";
import type { RepoFacts } from "@/lib/lifecycle";
import {
  runSeance,
  type SeanceDeps,
  type SeanceDiag,
} from "@/lib/seance-service";

const KEY = "sk-test-DIAG-SENTINEL-77aa";
const README_SECRET = "README-SECRET-9d2f";
const MODEL_SECRET = "MODEL-TEXT-SECRET-5b1c";

const facts: RepoFacts = {
  name: "crypt-keeper",
  description: null,
  url: "https://github.com/ada/crypt-keeper",
  pushedAt: "2025-01-10T00:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
  isArchived: false,
  isFork: false,
  homepageUrl: null,
  stargazerCount: 3,
  primaryLanguage: "TypeScript",
  openIssueCount: 1,
  releaseCount: 0,
  readmeBytes: 200,
  lastCommitMessage: "wip oauth callback",
  languageColor: null,
  forkCount: 0,
  topics: [],
};

const GOOD = {
  voice: "I was left in the middle of a login. The callback still needs care.",
  causeOfDeath: "Killed by an unfinished oauth callback.",
  unfinishedBusiness: [
    { title: "Callback", detail: "The oauth callback is broken.", evidence: "last commit: wip oauth callback" },
    { title: "Issues", detail: "One issue is still open.", evidence: "open issues: 1" },
  ],
  verdict: "revive",
  verdictReason: "The idea is still worth finishing.",
};

const req = { owner: "ada", repo: "crypt-keeper", ip: "1.2.3.4" };

interface Out {
  diags: SeanceDiag[];
  fetchCalls: number;
}

function anthropicBody(text: string) {
  return { content: [{ type: "text", text }] };
}

/** Real adapter over a scripted fetch: one scripted response per call (last repeats). */
function run(
  responses: Array<() => Response | Promise<Response>>,
  extra: Partial<SeanceDeps> = {},
) {
  const out: Out = { diags: [], fetchCalls: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const make = responses[Math.min(out.fetchCalls, responses.length - 1)];
      out.fetchCalls++;
      return make();
    }),
  );
  const deps: SeanceDeps = {
    loadGraveyard: async () => ({
      ok: true,
      value: { repos: [facts], totalCount: 1, truncated: false },
    }),
    fetchEvidence: async () => ({
      readme: `# Readme\n${README_SECRET}`,
      commits: ["wip oauth callback"],
    }),
    llm: createLlmClient({
      LLM_PROVIDER: "anthropic",
      LLM_MODEL: "test-model",
      LLM_API_KEY: KEY,
    }),
    cache: null,
    limiter: { check: async () => "ok", consume: async () => "ok" },
    log: () => {},
    diag: (e) => out.diags.push(e),
    ...extra,
  };
  return { deps, out };
}

const json = (body: unknown, status = 200) => () =>
  new Response(JSON.stringify(body), { status });
const text = (t: string) => json(anthropicBody(t));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("extractJsonObject", () => {
  const obj = JSON.stringify(GOOD);

  it("returns a bare object unchanged", () => {
    expect(extractJsonObject(obj)).toBe(obj);
  });

  it("strips ```json fences", () => {
    expect(extractJsonObject("```json\n" + obj + "\n```")).toBe(obj);
    expect(extractJsonObject("```\n" + obj + "\n```")).toBe(obj);
  });

  it("skips leading prose and ignores trailing text", () => {
    expect(extractJsonObject("Here is the séance:\n" + obj + "\nHope that helps.")).toBe(obj);
  });

  it("ignores braces inside strings", () => {
    const tricky = '{"a":"} not the end { \\" still string","b":{"c":1}}';
    expect(extractJsonObject("x " + tricky + " y")).toBe(tricky);
  });

  it("returns null when there is no complete object (e.g. cut off at max tokens)", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject(obj.slice(0, obj.length - 10))).toBeNull();
  });
});

describe("live parsing", () => {
  it("accepts fenced JSON", async () => {
    const { deps, out } = run([text("```json\n" + JSON.stringify(GOOD) + "\n```")]);
    expect((await runSeance(req, deps)).kind).toBe("ok");
    expect(out.fetchCalls).toBe(1);
    expect(out.diags).toEqual([]);
  });

  it("accepts JSON introduced by prose", async () => {
    const { deps } = run([text("Certainly. " + JSON.stringify(GOOD))]);
    expect((await runSeance(req, deps)).kind).toBe("ok");
  });

  it("skips a non-text first content block", async () => {
    const { deps } = run([
      json({
        content: [
          { type: "thinking", thinking: "hmm" },
          { type: "text", text: JSON.stringify(GOOD) },
        ],
      }),
    ]);
    expect((await runSeance(req, deps)).kind).toBe("ok");
  });
});

describe("diagnostic categories", () => {
  it("http: reports status and Anthropic error type, never the message", async () => {
    const { deps, out } = run([
      json({ type: "error", error: { type: "rate_limit_error", message: `slow down ${KEY}` } }, 429),
    ]);
    expect(await runSeance(req, deps)).toEqual({ kind: "silent" });
    expect(out.diags).toHaveLength(2);
    expect(out.diags[0]).toMatchObject({
      repo: "crypt-keeper",
      attempt: 1,
      category: "http",
      httpStatus: 429,
      anthropicErrorType: "rate_limit_error",
    });
    expect(out.diags[1].attempt).toBe(2);
    expect(typeof out.diags[0].elapsedMs).toBe("number");
    expect(JSON.stringify(out.diags)).not.toContain(KEY);
  });

  it("http: an unusable error type is dropped", async () => {
    const { deps, out } = run([json({ error: { type: "Bad Type! <script>" } }, 500)]);
    await runSeance(req, deps);
    expect(out.diags[0].httpStatus).toBe(500);
    expect(out.diags[0].anthropicErrorType).toBeUndefined();
  });

  it("http: a network failure has no status", async () => {
    const { deps, out } = run([
      () => {
        throw new TypeError(`fetch failed ${KEY}`);
      },
    ]);
    await runSeance(req, deps);
    expect(out.diags[0].category).toBe("http");
    expect(out.diags[0].httpStatus).toBeUndefined();
  });

  it("parse: the HTTP body is not JSON", async () => {
    const { deps, out } = run([() => new Response("<html>gateway</html>", { status: 200 })]);
    await runSeance(req, deps);
    expect(out.diags[0]).toMatchObject({ category: "parse", httpStatus: 200 });
  });

  it("parse: the model text has no JSON object", async () => {
    const { deps, out } = run([text(`I cannot do that. ${MODEL_SECRET}`)]);
    await runSeance(req, deps);
    expect(out.diags.map((d) => d.category)).toEqual(["parse", "parse"]);
    expect(JSON.stringify(out.diags)).not.toContain(MODEL_SECRET);
  });

  it("no-text: the response has no text block", async () => {
    const { deps, out } = run([json({ content: [{ type: "tool_use", id: "t" }] })]);
    await runSeance(req, deps);
    expect(out.diags[0]).toMatchObject({ category: "no-text", httpStatus: 200 });
  });

  it("schema: reports the failing paths, not the values", async () => {
    const bad = { ...GOOD, verdict: "maybe", verdictReason: `${MODEL_SECRET}`.repeat(40) };
    const { deps, out } = run([text(JSON.stringify(bad))]);
    await runSeance(req, deps);
    expect(out.diags[0].category).toBe("schema");
    expect(out.diags[0].schemaIssuePaths).toEqual(
      expect.arrayContaining(["verdict", "verdictReason"]),
    );
    expect(JSON.stringify(out.diags)).not.toContain(MODEL_SECRET);
  });

  it("date-rule: a dated voice is its own category", async () => {
    const bad = { ...GOOD, voice: "I stopped moving. It was 5 days ago." };
    const { deps, out } = run([text(JSON.stringify(bad))]);
    await runSeance(req, deps);
    expect(out.diags[0].category).toBe("date-rule");
    expect(out.diags[0].schemaIssuePaths).toContain("voice");
  });

  it("grounding: evidence that is not in the facts", async () => {
    const bad = {
      ...GOOD,
      unfinishedBusiness: [
        { title: "A", detail: "Made up.", evidence: `commit abc1234 ${MODEL_SECRET}` },
        { title: "B", detail: "Also made up.", evidence: "also not in the facts at all" },
      ],
    };
    const { deps, out } = run([text(JSON.stringify(bad))]);
    await runSeance(req, deps);
    expect(out.diags[0].category).toBe("grounding");
    expect(JSON.stringify(out.diags)).not.toContain(MODEL_SECRET);
  });

  it("timeout: a call that never answers is reported with its elapsed time", async () => {
    vi.useFakeTimers();
    const { deps, out } = run([() => new Promise<Response>(() => {})]);
    const p = runSeance(req, deps);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await p).toEqual({ kind: "silent" });
    expect(out.diags.map((d) => d.category)).toEqual(["timeout", "timeout"]);
    expect(out.diags[0].elapsedMs).toBeGreaterThanOrEqual(8000);
  });

  it("abort: a caller abort is told apart from a timeout (adapter)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        throw init.signal!.reason;
      }),
    );
    const client = createLlmClient({
      LLM_PROVIDER: "anthropic",
      LLM_API_KEY: KEY,
    })!;
    const ac = new AbortController();
    ac.abort();
    const err = await client
      .complete({ system: "s", user: "u", maxOutputTokens: 10, timeoutMs: 5000, signal: ac.signal })
      .catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.category).toBe("abort");
  });

  it("abort and timeout categories pass through the service", async () => {
    const { deps, out } = run([text("x")], {
      llm: {
        complete: async () => {
          throw new LlmError("abort", "LLM request failed");
        },
      },
    });
    await runSeance(req, deps);
    expect(out.diags[0].category).toBe("abort");
  });

  it("a diag sink that throws never breaks the request", async () => {
    const { deps } = run([text("nope")], {
      diag: () => {
        throw new Error("sink exploded");
      },
    });
    expect(await runSeance(req, deps)).toEqual({ kind: "silent" });
  });

  it("emits nothing when no sink is provided and nothing leaks into the main log", async () => {
    const logs: unknown[] = [];
    const { deps } = run([text(MODEL_SECRET)], { diag: undefined, log: (e) => logs.push(e) });
    await runSeance(req, deps);
    expect(JSON.stringify(logs)).not.toContain(MODEL_SECRET);
    expect(JSON.stringify(logs)).not.toContain(README_SECRET);
    expect(JSON.stringify(logs)).not.toContain(KEY);
  });
});