/**
 * Response parsing for the Anthropic adapter: the exact real response shape,
 * and the safe structure reported when a response has no usable text block.
 * `fetch` is always stubbed; the real API is never called.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmError, createLlmClient } from "@/lib/llm";
import { runSeance, type SeanceDiag } from "@/lib/seance-service";

const KEY = "sk-test-SHAPE-SENTINEL-31de";
const THINKING_SECRET = "THINKING-SECRET-aa91";
const TEXT_SECRET = "TEXT-SECRET-77bc";

const REAL_RESPONSE = {
  id: "msg_x",
  type: "message",
  role: "assistant",
  model: "claude-haiku-5-5",
  content: [{ type: "text", text: '{"voice":"hello"}' }],
  stop_reason: "end_turn",
  usage: { input_tokens: 10, output_tokens: 12 },
};

const req = { system: "s", user: "u", maxOutputTokens: 1000, timeoutMs: 5000 };

function client() {
  return createLlmClient({
    LLM_PROVIDER: "anthropic",
    LLM_MODEL: "claude-haiku-5-5",
    LLM_API_KEY: KEY,
  })!;
}

function stubJson(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("real Messages API response", () => {
  it("complete() returns the text of the real response shape", async () => {
    stubJson(REAL_RESPONSE);
    await expect(client().complete(req)).resolves.toBe('{"voice":"hello"}');
  });

  it("sends a non-streaming request with no prefill", async () => {
    const fn = stubJson(REAL_RESPONSE);
    await client().complete(req);
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.stream).toBeUndefined();
    expect(body.messages).toEqual([{ role: "user", content: "u" }]);
    expect(body.system).toBe("s");
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.max_tokens).toBe(1000);
    expect(body.thinking).toEqual({ type: "disabled" });
  });

  it("reads the body once (a second read would throw)", async () => {
    const res = new Response(JSON.stringify(REAL_RESPONSE), { status: 200 });
    vi.stubGlobal("fetch", vi.fn(async () => res));
    await expect(client().complete(req)).resolves.toBe('{"voice":"hello"}');
    expect(res.bodyUsed).toBe(true);
  });

  it("returns an empty text block as text (not as missing)", async () => {
    stubJson({ ...REAL_RESPONSE, content: [{ type: "text", text: "" }] });
    await expect(client().complete(req)).resolves.toBe("");
  });

  it("skips thinking blocks and returns the later text block", async () => {
    stubJson({
      ...REAL_RESPONSE,
      content: [
        { type: "thinking", thinking: THINKING_SECRET, signature: "sig" },
        { type: "text", text: '{"voice":"hello"}' },
      ],
    });
    await expect(client().complete(req)).resolves.toBe('{"voice":"hello"}');
  });
});

describe("no-text and truncated failures carry only the response structure", () => {
  async function failure(body: unknown): Promise<LlmError> {
    stubJson(body);
    return (await client().complete(req).catch((e) => e)) as LlmError;
  }

  it("thinking-only reply that hit max_tokens is classified truncated", async () => {
    const err = await failure({
      ...REAL_RESPONSE,
      content: [{ type: "thinking", thinking: THINKING_SECRET, signature: "sig" }],
      stop_reason: "max_tokens",
      usage: { input_tokens: 900, output_tokens: 1000 },
    });
    expect(err).toBeInstanceOf(LlmError);
    expect(err.category).toBe("truncated");
    expect(err.httpStatus).toBe(200);
    expect(err.responseShape).toEqual({
      stopReason: "max_tokens",
      blockTypes: ["thinking"],
      textLengths: [],
      outputTokens: 1000,
      keys: ["id", "type", "role", "model", "content", "stop_reason", "usage"],
    });
    expect(JSON.stringify(err.responseShape)).not.toContain(THINKING_SECRET);
  });

  it("empty content list (for example a refusal)", async () => {
    const err = await failure({ ...REAL_RESPONSE, content: [], stop_reason: "refusal" });
    expect(err.responseShape).toMatchObject({
      stopReason: "refusal",
      blockTypes: [],
      textLengths: [],
    });
  });

  it("a different top-level shape is described, not dumped", async () => {
    const err = await failure({
      choices: [{ message: { content: TEXT_SECRET } }],
      "weird key with spaces": 1,
    });
    expect(err.responseShape?.keys).toEqual(["choices"]);
    expect(err.responseShape?.blockTypes).toEqual([]);
    expect(JSON.stringify(err.responseShape)).not.toContain(TEXT_SECRET);
  });

  it("text blocks with a non-string text are not counted", async () => {
    const err = await failure({
      ...REAL_RESPONSE,
      content: [{ type: "text", text: 42 }, { type: "text" }],
    });
    expect(err.responseShape?.blockTypes).toEqual(["text", "text"]);
    expect(err.responseShape?.textLengths).toEqual([]);
  });

  it("an unusable block type is reported as unknown", async () => {
    const err = await failure({
      ...REAL_RESPONSE,
      content: [{ type: "<script>alert(1)</script>" }, 7],
    });
    expect(err.responseShape?.blockTypes).toEqual(["unknown", "unknown"]);
  });
});

describe("truncated diagnostic through the service", () => {
  it("includes the response structure in the diag line, and nothing secret", async () => {
    stubJson({
      ...REAL_RESPONSE,
      content: [{ type: "thinking", thinking: THINKING_SECRET, signature: "sig" }],
      stop_reason: "max_tokens",
      usage: { input_tokens: 900, output_tokens: 1000 },
    });
    const diags: SeanceDiag[] = [];
    const out = await runSeance(
      { owner: "ada", repo: "crypt-keeper", ip: "1.2.3.4" },
      {
        loadGraveyard: async () => ({
          ok: true,
          value: {
            repos: [
              {
                name: "crypt-keeper",
                description: null,
                url: "https://github.com/ada/crypt-keeper",
                pushedAt: "2025-01-10T00:00:00Z",
                createdAt: "2024-01-01T00:00:00Z",
                isArchived: false,
                isFork: false,
                homepageUrl: null,
                stargazerCount: 0,
                primaryLanguage: null,
                openIssueCount: 0,
                releaseCount: 0,
                readmeBytes: null,
                lastCommitMessage: null,
                languageColor: null,
                forkCount: 0,
                topics: [],
              },
            ],
            totalCount: 1,
            truncated: false,
          },
        }),
        fetchEvidence: async () => null,
        llm: client(),
        cache: null,
        limiter: { check: async () => "ok", consume: async () => "ok" },
        log: () => {},
        diag: (e) => diags.push(e),
      },
    );
    expect(out).toEqual({ kind: "silent" });
    expect(diags).toHaveLength(2);
    expect(diags[0]).toMatchObject({
      attempt: 1,
      category: "truncated",
      httpStatus: 200,
      responseShape: {
        stopReason: "max_tokens",
        blockTypes: ["thinking"],
        textLengths: [],
        outputTokens: 1000,
      },
    });
    const line = JSON.stringify(diags);
    expect(line).not.toContain(THINKING_SECRET);
    expect(line).not.toContain(KEY);
  });
});

describe("truncated vs no-text", () => {
  it("a text block cut off at max_tokens is still returned as text", async () => {
    stubJson({
      ...REAL_RESPONSE,
      content: [{ type: "text", text: '{"voice":"hel' }],
      stop_reason: "max_tokens",
    });
    await expect(client().complete(req)).resolves.toBe('{"voice":"hel');
  });

  it("no text and a stop reason other than max_tokens stays no-text", async () => {
    stubJson({ ...REAL_RESPONSE, content: [], stop_reason: "end_turn" });
    const err = (await client().complete(req).catch((e) => e)) as LlmError;
    expect(err.category).toBe("no-text");
  });

  it("empty content at max_tokens is truncated", async () => {
    stubJson({ ...REAL_RESPONSE, content: [], stop_reason: "max_tokens" });
    const err = (await client().complete(req).catch((e) => e)) as LlmError;
    expect(err.category).toBe("truncated");
    expect(err.message).toBe("LLM response was cut off");
  });
});