/**
 * Unit tests for the Anthropic adapter in lib/llm.ts. `fetch` is always stubbed;
 * the real API is never called.
 *
 * Requirements: 19.1, 19.7, 19.8, 20.1
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLlmClient } from "@/lib/llm";

const KEY_SENTINEL = "sk-test-SENTINEL-9f3a1c7e";

const env = {
  LLM_PROVIDER: "anthropic",
  LLM_MODEL: "test-model",
  LLM_API_KEY: KEY_SENTINEL,
};

const req = {
  system: "sys prompt",
  user: "user prompt",
  maxOutputTokens: 321,
  timeoutMs: 5000,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function client() {
  const c = createLlmClient(env);
  if (!c) throw new Error("expected a client");
  return c;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("anthropic adapter request shape", () => {
  it("posts to the Messages endpoint with the expected headers and body", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: "text", text: "hello" }] }),
    );
    await client().complete(req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(KEY_SENTINEL);
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["content-type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      model: "test-model",
      max_tokens: 321,
      system: "sys prompt",
      messages: [{ role: "user", content: "user prompt" }],
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("falls back to the default model when LLM_MODEL is unset", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: "text", text: "x" }] }),
    );
    const c = createLlmClient({ ...env, LLM_MODEL: undefined });
    await c!.complete(req);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string).model).toBe("claude-haiku-5-5");
  });
});

describe("anthropic adapter response handling", () => {
  it("returns the first text block, skipping non-text blocks", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [
          { type: "thinking", text: "ignored" },
          { type: "text", text: "first" },
          { type: "text", text: "second" },
        ],
      }),
    );
    await expect(client().complete(req)).resolves.toBe("first");
  });

  it("throws on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "nope" }, 500));
    await expect(client().complete(req)).rejects.toThrow("LLM request failed");
  });

  it("throws when there is no text block", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: "tool_use", id: "t" }] }),
    );
    await expect(client().complete(req)).rejects.toThrow(
      "LLM response had no text content",
    );
  });

  it("aborts when the timeout elapses", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(init.signal!.reason),
          );
        }),
    );
    await expect(client().complete({ ...req, timeoutMs: 20 })).rejects.toThrow(
      "LLM request failed",
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal!.aborted).toBe(true);
  });
});

describe("key never leaks into errors", () => {
  it("omits the key from every thrown message", async () => {
    const failures: Array<() => void> = [
      () => fetchMock.mockRejectedValue(new Error(`boom ${KEY_SENTINEL}`)),
      () => fetchMock.mockResolvedValue(jsonResponse({ k: KEY_SENTINEL }, 401)),
      () => fetchMock.mockResolvedValue(jsonResponse({ content: [] })),
      () =>
        fetchMock.mockResolvedValue(
          new Response(`not json ${KEY_SENTINEL}`, { status: 200 }),
        ),
    ];
    for (const arrange of failures) {
      arrange();
      let message = "";
      try {
        await client().complete(req);
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
      expect(message).not.toBe("");
      expect(message).not.toContain(KEY_SENTINEL);
    }
  });
});

describe("createLlmClient", () => {
  it("returns null for a missing key", () => {
    expect(createLlmClient({ LLM_PROVIDER: "anthropic" })).toBeNull();
  });

  it("returns null for an empty or blank key", () => {
    expect(
      createLlmClient({ LLM_PROVIDER: "anthropic", LLM_API_KEY: "" }),
    ).toBeNull();
    expect(
      createLlmClient({ LLM_PROVIDER: "anthropic", LLM_API_KEY: "   " }),
    ).toBeNull();
  });

  it("returns null for another provider", () => {
    expect(
      createLlmClient({ LLM_PROVIDER: "openai", LLM_API_KEY: KEY_SENTINEL }),
    ).toBeNull();
  });

  it("returns a client for anthropic with a key", () => {
    expect(createLlmClient(env)).not.toBeNull();
  });
});
