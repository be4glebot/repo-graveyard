/**
 * Séance service: orchestrates one request with every dependency injected.
 *
 * Order: load graveyard + find repo -> cache lookup -> limiter.check ->
 * no-LLM check -> fetchEvidence (5 s) -> up to 2 attempts (consume, LLM 8 s,
 * parse, schema, grounding) -> cache set. The whole request is raced against
 * a 25 s deadline; a shared `cancelled` flag stops any later step.
 *
 * Logging is `log({ repo, reason })` with fixed reason codes only. README,
 * commits, model output, the request body and the key are never logged.
 */
import "server-only";

import { LLM_TIMEOUT_MS, MAX_OUTPUT_TOKENS, buildSeancePrompt } from "./ai";
import {
  seanceCacheGet,
  seanceCacheKey,
  seanceCacheSet,
  type CacheClient,
  type GraveyardData,
} from "./cache";
import type { LoadError, Result } from "./github";
import type { LlmClient } from "./llm";
import type { RateLimiter } from "./ratelimit";
import { deriveEvidence, validateGrounding } from "./seance";
import { GATHER_TIMEOUT_MS, type FetchedEvidence } from "./seance-gather";
import {
  seanceResultSchema,
  type SeanceOutcome,
  type SeanceResult,
} from "./seance-schema";

export type { SeanceOutcome };

export const REQUEST_DEADLINE_MS = 25_000;
export const MAX_ATTEMPTS = 2;

export type SeanceLogReason =
  | "repo-not-found"
  | "no-llm"
  | "invalid-output"
  | "llm-error"
  | "timeout"
  | "veil"
  | "weak";

export interface SeanceDeps {
  loadGraveyard: (owner: string) => Promise<Result<GraveyardData, LoadError>>;
  fetchEvidence: (owner: string, repo: string) => Promise<FetchedEvidence | null>;
  llm: LlmClient | null;
  cache: CacheClient | null;
  limiter: RateLimiter;
  log: (entry: { repo: string; reason: string }) => void;
}

const SILENT: SeanceOutcome = { kind: "silent" };

type Raced<T> = { timedOut: true } | { timedOut: false; value: T };

/** Races a promise against a timer; rejections propagate. Clears the timer. */
function race<T>(promise: Promise<T>, ms: number): Promise<Raced<T>> {
  return new Promise<Raced<T>>((resolve, reject) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve({ timedOut: false, value });
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function runSeance(
  req: { owner: string; repo: string; ip: string },
  deps: SeanceDeps,
): Promise<SeanceOutcome> {
  const state = { cancelled: false };
  const safeLog = (reason: SeanceLogReason) => {
    try {
      deps.log({ repo: req.repo, reason });
    } catch {
      // logging must never break a request
    }
  };

  let raced: Raced<SeanceOutcome>;
  try {
    raced = await race(inner(req, deps, state, safeLog), REQUEST_DEADLINE_MS);
  } catch {
    state.cancelled = true;
    safeLog("llm-error");
    return SILENT;
  }
  if (raced.timedOut) {
    state.cancelled = true;
    safeLog("timeout");
    return SILENT;
  }
  return raced.value;
}

async function inner(
  req: { owner: string; repo: string; ip: string },
  deps: SeanceDeps,
  state: { cancelled: boolean },
  log: (reason: SeanceLogReason) => void,
): Promise<SeanceOutcome> {
  // 1. Load the graveyard and find the repo (case-insensitive).
  const loaded = await deps.loadGraveyard(req.owner);
  if (state.cancelled) return SILENT;
  const wanted = req.repo.toLowerCase();
  const facts = loaded.ok
    ? loaded.value.repos.find((r) => r.name.toLowerCase() === wanted)
    : undefined;
  if (!facts) {
    log("repo-not-found");
    return SILENT;
  }

  // 2. Cache key from server-held values only; a hit costs nothing.
  const key = seanceCacheKey(req.owner, req.repo, facts.pushedAt, facts.createdAt);
  const cached = await seanceCacheGet(deps.cache, key);
  if (state.cancelled) return SILENT;
  if (cached) return { kind: "ok", result: cached };

  // 3. Read-only limiter check: no GitHub, no LLM when blocked.
  const checked = await deps.limiter.check(req.ip);
  if (state.cancelled) return SILENT;
  if (checked !== "ok") {
    log(checked);
    return { kind: checked };
  }

  // 4. No usable LLM client.
  const llm = deps.llm;
  if (llm === null) {
    log("no-llm");
    return SILENT;
  }

  // 5. Evidence fetch; any failure or timeout means a facts-only pack.
  let fetched: FetchedEvidence | null = null;
  try {
    const r = await race(deps.fetchEvidence(req.owner, req.repo), GATHER_TIMEOUT_MS);
    fetched = r.timedOut ? null : r.value;
  } catch {
    fetched = null;
  }
  if (state.cancelled) return SILENT;

  // 6. Derive evidence and build the prompt.
  const derived = deriveEvidence({
    facts,
    readme: fetched?.readme ?? null,
    commits: fetched?.commits ?? [],
  });
  const prompt = buildSeancePrompt(req.owner, derived);

  // 7. Up to two attempts; every call is consumed first and never refunded.
  let failure: "invalid-output" | "llm-error" = "llm-error";
  let valid: SeanceResult | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const consumed = await deps.limiter.consume(req.ip);
    if (state.cancelled) return SILENT;
    if (consumed !== "ok") {
      log(consumed);
      return { kind: consumed };
    }

    let text: string;
    try {
      const r = await race(
        llm.complete({
          system: prompt.system,
          user: prompt.user,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          timeoutMs: LLM_TIMEOUT_MS,
        }),
        LLM_TIMEOUT_MS,
      );
      if (state.cancelled) return SILENT;
      if (r.timedOut) {
        failure = "llm-error";
        continue;
      }
      text = r.value;
    } catch {
      if (state.cancelled) return SILENT;
      failure = "llm-error";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      failure = "invalid-output";
      continue;
    }
    const checkedResult = seanceResultSchema.safeParse(parsed);
    if (!checkedResult.success) {
      failure = "invalid-output";
      continue;
    }
    if (!validateGrounding(checkedResult.data, derived).ok) {
      failure = "invalid-output";
      continue;
    }
    valid = checkedResult.data;
    break;
  }

  // 8. Both failed: silent, no partial fields, nothing cached.
  if (!valid) {
    log(failure);
    return SILENT;
  }

  // 9. Cache only a fully validated result (best effort), unless past the deadline.
  if (state.cancelled) return SILENT;
  await seanceCacheSet(deps.cache, key, valid);
  if (state.cancelled) return SILENT;
  return { kind: "ok", result: valid };
}
