/**
 * LLM client: a fetch-based Anthropic Messages adapter (no SDK).
 *
 * The API key is read only here, never logged, and never included in thrown
 * errors. Error messages are generic: they never contain the key, the request
 * body or the response body.
 *
 * Requirements: 4.15, 8.12, 19.1, 19.7, 19.8
 */

import "server-only";

export interface LlmRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface LlmClient {
  complete(req: LlmRequest): Promise<string>;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-5-5";

function createAnthropicClient(apiKey: string, model: string): LlmClient {
  return {
    async complete(req: LlmRequest): Promise<string> {
      const timeout = AbortSignal.timeout(req.timeoutMs);
      const signal = req.signal ? AbortSignal.any([timeout, req.signal]) : timeout;

      let res: Response;
      try {
        res = await fetch(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: req.maxOutputTokens,
            system: req.system,
            messages: [{ role: "user", content: req.user }],
          }),
          signal,
        });
      } catch {
        throw new Error("LLM request failed");
      }

      if (!res.ok) throw new Error("LLM request failed");

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new Error("LLM response was not valid JSON");
      }

      const content =
        data && typeof data === "object"
          ? (data as { content?: unknown }).content
          : undefined;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (
            block &&
            typeof block === "object" &&
            (block as { type?: unknown }).type === "text" &&
            typeof (block as { text?: unknown }).text === "string"
          ) {
            return (block as { text: string }).text;
          }
        }
      }
      throw new Error("LLM response had no text content");
    },
  };
}

/**
 * Returns a client, or `null` when `LLM_API_KEY` is missing/empty or
 * `LLM_PROVIDER` is not `anthropic` (the caller then falls back silently).
 */
export function createLlmClient(
  env: Record<string, string | undefined> = process.env,
): LlmClient | null {
  const apiKey = env.LLM_API_KEY;
  if (!apiKey || apiKey.trim() === "") return null;
  if (env.LLM_PROVIDER?.trim().toLowerCase() !== "anthropic") return null;
  const model = env.LLM_MODEL?.trim() || DEFAULT_MODEL;
  return createAnthropicClient(apiKey.trim(), model);
}
