import { sanitiseInline } from "@/lib/revive-brief";
import { seanceResponseSchema, type SeanceResponse } from "@/lib/seance-schema";
import { graveyardPayloadSchema, type GraveyardPayload } from "./payload";

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface ClientDeps {
  baseUrl: string;
  fetch: typeof fetch;
  timers?: Timers;
}

export type Failure = { ok: false; text: string };
export type Outcome<T> = { ok: true; value: T } | Failure;

export const GRAVEYARD_TIMEOUT_MS = 10_000;
export const SEANCE_TIMEOUT_MS = 30_000;
export const MAX_BODY_CHARS = 1_048_576;

const UNEXPECTED = "The app returned an unexpected response.";
const RETRY_AFTER_RE = /^\d{1,6}$/;

const defaultTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

interface Spec<T> {
  url: string;
  init: RequestInit;
  timeoutMs: number;
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } };
  notFound: boolean;
  badRequest: boolean;
}

export function createClient(deps: ClientDeps) {
  const timers = deps.timers ?? defaultTimers;
  const doFetch = deps.fetch;

  const fail = (text: string): Failure => ({ ok: false, text });

  async function call<T>(spec: Spec<T>): Promise<Outcome<T>> {
    const ctl = new AbortController();
    let timedOut = false;
    const handle = timers.set(() => {
      timedOut = true;
      ctl.abort();
    }, spec.timeoutMs);
    try {
      let res: Response;
      try {
        res = await doFetch(spec.url, { ...spec.init, redirect: "manual", signal: ctl.signal });
      } catch {
        if (timedOut) return fail(timeoutText(spec.timeoutMs));
        return fail(unreachableText(deps.baseUrl));
      }
      const status = res.status;
      if (status === 200) {
        let text: string;
        try {
          text = await res.text();
        } catch {
          if (timedOut) return fail(timeoutText(spec.timeoutMs));
          return fail(UNEXPECTED);
        }
        if (text.length > MAX_BODY_CHARS) return fail(UNEXPECTED);
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return fail(UNEXPECTED);
        }
        const parsed = spec.schema.safeParse(json);
        if (!parsed.success) return fail(UNEXPECTED);
        return { ok: true, value: parsed.data };
      }
      if (status === 400 && spec.badRequest) return fail("The app rejected the owner name.");
      if (status === 404) return fail("No GitHub user or organization with that name was found.");
      if (status === 429) return fail(rateLimitedText(res));
      if (status >= 500 && status <= 599) return fail("The app reported a server error.");
      return fail(UNEXPECTED);
    } catch {
      return fail(timedOut ? timeoutText(spec.timeoutMs) : UNEXPECTED);
    } finally {
      timers.clear(handle);
    }
  }

  return {
    getGraveyard(owner: string): Promise<Outcome<GraveyardPayload>> {
      return call<GraveyardPayload>({
        url: `${deps.baseUrl}/api/graveyard/${encodeURIComponent(owner)}`,
        init: { method: "GET" },
        timeoutMs: GRAVEYARD_TIMEOUT_MS,
        schema: graveyardPayloadSchema,
        notFound: true,
        badRequest: true,
      });
    },
    postSeance(owner: string, repo: string): Promise<Outcome<SeanceResponse>> {
      return call<SeanceResponse>({
        url: `${deps.baseUrl}/api/seance`,
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ owner, repo }),
        },
        timeoutMs: SEANCE_TIMEOUT_MS,
        schema: seanceResponseSchema,
        notFound: true,
        badRequest: false,
      });
    },
  };
}

function timeoutText(ms: number): string {
  return `The app did not answer in time (${ms / 1000} seconds).`;
}

function unreachableText(baseUrl: string): string {
  return `Repo Graveyard isn't reachable at ${sanitiseInline(baseUrl)}. Start the app (npm run dev) or set GRAVEYARD_URL.`;
}

function rateLimitedText(res: Response): string {
  const base = "The app is rate-limited. Try again later.";
  try {
    const v = res.headers.get("retry-after");
    if (v !== null && RETRY_AFTER_RE.test(v)) {
      const n = Number(v);
      if (n >= 1) return `${base} Wait ${n} seconds.`;
    }
  } catch {
    // ignore header problems
  }
  return base;
}
