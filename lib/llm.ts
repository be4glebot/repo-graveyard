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
export type LlmFailureCategory =
  | "timeout"
  | "http"
  | "parse"
  | "no-text"
  | "truncated"
  | "abort";

/**
 * Structure of a response that had no usable text block. Names, counts and
 * lengths only: never any text, thinking content or ids.
 */
export interface LlmResponseShape {
  stopReason?: string;
  /** `type` of every content block, in order (for example ["thinking"]). */
  blockTypes: string[];
  /** Length of each text block, in the same order as the text blocks. */
  textLengths: number[];
  outputTokens?: number;
  /** Top-level keys of the response object. */
  keys: string[];
}

/**
 * Structure of a response that had no usable text block. Names, counts and
 * lengths only: never any text, thinking content or ids.
 */
export interface LlmResponseShape {
  stopReason?: string;
  /** `type` of every content block, in order (for example ["thinking"]). */
  blockTypes: string[];
  /** Length of each text block, in the same order as the text blocks. */
  textLengths: number[];
  outputTokens?: number;
  /** Top-level keys of the response object. */
  keys: string[];
}

/** Generic failure; carries only a category and safe, non-secret details. */
export class LlmError extends Error {
  readonly category: LlmFailureCategory;
  readonly httpStatus?: number;
  /** Anthropic's `error.type` (for example `rate_limit_error`), never the message. */
  readonly anthropicErrorType?: string;
  /** Only set for `no-text` failures. */
  readonly responseShape?: LlmResponseShape;

  constructor(
    category: LlmFailureCategory,
    message: string,
    details: {
      httpStatus?: number;
      anthropicErrorType?: string;
      responseShape?: LlmResponseShape;
    } = {},
  ) {
    super(message);
    this.name = "LlmError";
    this.category = category;
    this.httpStatus = details.httpStatus;
    this.anthropicErrorType = details.anthropicErrorType;
    this.responseShape = details.responseShape;
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

const SAFE_TOKEN = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

/** Describes a Messages response without exposing any of its content. */
function describeShape(data: unknown): LlmResponseShape {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const safe = (v: unknown): string | undefined =>
    typeof v === "string" && SAFE_TOKEN.test(v) ? v : undefined;
  const blocks = Array.isArray(obj.content) ? obj.content : [];
  const blockTypes: string[] = [];
  const textLengths: number[] = [];
  for (const b of blocks.slice(0, 10)) {
    const rec = b && typeof b === "object" ? (b as Record<string, unknown>) : {};
    blockTypes.push(safe(rec.type) ?? "unknown");
    if (rec.type === "text" && typeof rec.text === "string") {
      textLengths.push(rec.text.length);
    }
  }
  const usage = obj.usage && typeof obj.usage === "object" ? (obj.usage as Record<string, unknown>) : {};
  return {
    stopReason: safe(obj.stop_reason),
    blockTypes,
    textLengths,
    outputTokens:
      typeof usage.output_tokens === "number" && Number.isFinite(usage.output_tokens)
        ? usage.output_tokens
        : undefined,
    keys: Object.keys(obj).filter((k) => SAFE_TOKEN.test(k)).slice(0, 20),
  };
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
            // claude-haiku-5-5 thinks by default; with a long prompt the whole
            // token budget can go to a thinking block and leave no text.
            thinking: { type: "disabled" },
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
      const responseShape = describeShape(data);
      // No text and the reply stopped at the token limit: it was cut off.
      if (responseShape.stopReason === "max_tokens") {
        throw new LlmError("truncated", "LLM response was cut off", {
          httpStatus: res.status,
          responseShape,
        });
      }
      throw new LlmError("no-text", "LLM response had no text content", {
        httpStatus: res.status,
        responseShape,
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