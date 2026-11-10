/**
 * LLM client: a fetch-based Anthropic Messages adapter (no SDK).
 *
 * The API key is read only here, never logged, and never included in thrown
 * errors. Error messages are generic: they never contain the key, the request
 * body or the response body. Failures carry a safe `category` (plus the HTTP
 * status and Anthropic's error `type` when present) so the service can log a
 * diagnostic line without any prompt, key or model text.
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

/** Why an LLM call failed, in terms safe to log. */
export type LlmFailureCategory = "timeout" | "http" | "parse" | "no-text" | "abort";

/** Generic failure; carries only a category and safe, non-secret details. */
export class LlmError extends Error {
  readonly category: LlmFailureCategory;
  readonly httpStatus?: number;
  /** Anthropic's `error.type` (for example `rate_limit_error`), never the message. */
  readonly anthropicErrorType?: string;

  constructor(
    category: LlmFailureCategory,
    message: string,
    details: { httpStatus?: number; anthropicErrorType?: string } = {},
  ) {
    super(message);
    this.name = "LlmError";
    this.category = category;
    this.httpStatus = details.httpStatus;
    this.anthropicErrorType = details.anthropicErrorType;
  }
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-5-5";
const FAILED = "LLM request failed";

/** Combines signals; falls back to a manual controller where AbortSignal.any is missing. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener("abort", () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

/** Only a short snake_case token is ever surfaced from an error body. */
function safeErrorType(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const err = (body as { error?: unknown }).error;
  if (!err || typeof err !== "object") return undefined;
  const type = (err as { type?: unknown }).type;
  return typeof type === "string" && /^[a-z_]{1,64}$/.test(type) ? type : undefined;
}

function createAnthropicClient(apiKey: string, model: string): LlmClient {
  return {
    async complete(req: LlmRequest): Promise<string> {
      const timeout = AbortSignal.timeout(req.timeoutMs);
      const signal = req.signal ? anySignal([timeout, req.signal]) : timeout;

      // A timeout/abort can fire while the body is still being read, so the
      // same classification applies to every awaited step below.
      const classifyAbort = (): LlmError | null => {
        if (timeout.aborted) return new LlmError("timeout", FAILED);
        if (req.signal?.aborted) return new LlmError("abort", FAILED);
        return null;
      };

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
        // Network-level failure with no status: reported as "http".
        throw classifyAbort() ?? new LlmError("http", FAILED);
      }

      if (!res.ok) {
        let anthropicErrorType: string | undefined;
        try {
          anthropicErrorType = safeErrorType(await res.json());
        } catch {
          // The error body is optional diagnostics only.
        }
        throw new LlmError("http", FAILED, {
          httpStatus: res.status,
          anthropicErrorType,
        });
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw (
          classifyAbort() ??
          new LlmError("parse", "LLM response was not valid JSON", {
            httpStatus: res.status,
          })
        );
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
      throw new LlmError("no-text", "LLM response had no text content", {
        httpStatus: res.status,
      });
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