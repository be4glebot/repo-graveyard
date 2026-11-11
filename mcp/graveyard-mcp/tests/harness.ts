import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server";

export interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** The `credentials` fetch option, if one was passed. */
  credentials?: string;
}

export interface HarnessOptions {
  /** Scripted app. Returning an Error makes fetch reject (connection refused). */
  respond: (req: Recorded) => Response | Promise<Response> | Error;
  /** Fixed clock in epoch milliseconds. */
  nowMs?: number;
  /** Injectable for guard tests. */
  sanitise?: (s: string) => string;
  /** Diagnostics sink; defaults to a silent no-op. */
  log?: (line: string) => void;
}

export interface Harness {
  client: Client;
  calls: Recorded[];
  /** Fires the most recent live timer, aborting the in-flight request. */
  fireTimeout(): void;
  close(): Promise<void>;
}

export const HARNESS_BASE_URL = "http://app.test";

function abortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

function normaliseHeaders(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  new Headers(h).forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

export async function createHarness(opts: HarnessOptions): Promise<Harness> {
  const nowMs = opts.nowMs ?? 0;
  const calls: Recorded[] = [];

  // Recording timers: remember the requested ms and keep live callbacks.
  const live = new Map<number, () => void>();
  let nextHandle = 1;
  let lastTimerMs: number | undefined;
  const timers = {
    set(fn: () => void, ms: number): unknown {
      const handle = nextHandle++;
      lastTimerMs = ms;
      live.set(handle, fn);
      return handle;
    },
    clear(handle: unknown): void {
      live.delete(handle as number);
    },
  };

  const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const recorded: Recorded = {
      url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      method: (init?.method ?? "GET").toUpperCase(),
      headers: normaliseHeaders(init?.headers),
      timeoutMs: lastTimerMs,
    };
    if (typeof init?.body === "string") recorded.body = init.body;
    if (init?.credentials !== undefined) recorded.credentials = init.credentials;
    calls.push(recorded);

    const signal = init?.signal ?? undefined;
    if (signal?.aborted) throw abortError();

    const aborted = new Promise<never>((_, reject) => {
      signal?.addEventListener("abort", () => reject(abortError()), { once: true });
    });
    const answer = (async () => {
      const r = opts.respond(recorded);
      if (r instanceof Error) throw r;
      return await r;
    })();
    // Avoid unhandled rejections if the abort wins the race.
    answer.catch(() => {});
    return Promise.race([answer, aborted]);
  }) as typeof fetch;

  const server = createServer({
    baseUrl: HARNESS_BASE_URL,
    fetch: mockFetch,
    now: () => nowMs,
    timers,
    sanitise: opts.sanitise,
    log: opts.log ?? (() => {}),
  });

  const client = new Client({ name: "graveyard-mcp-tests", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    calls,
    fireTimeout(): void {
      const entries = [...live.entries()];
      const last = entries[entries.length - 1];
      if (!last) return;
      live.delete(last[0]);
      last[1]();
    },
    async close(): Promise<void> {
      await client.close();
      await server.close();
    },
  };
}
