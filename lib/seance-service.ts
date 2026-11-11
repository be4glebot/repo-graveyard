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

import {
  LLM_TIMEOUT_MS,
  MAX_OUTPUT_TOKENS,
  buildFeedbackNote,
  buildSeancePrompt,
  extractJsonObject,
} from "./ai";
import {
  seanceCacheGet,
  seanceCacheKey,
  seanceCacheSet,
  type CacheClient,
  type GraveyardData,
} from "./cache";
import type { LoadError, Result } from "./github";
import { classify } from "./lifecycle";
import type { LlmClient } from "./llm";
import type { RateLimiter } from "./ratelimit";
import { deriveEvidence, groundingFailures } from "./seance";
import { repairSeance } from "./seance-repair";
import { GATHER_TIMEOUT_MS, type FetchedEvidence } from "./seance-gather";
import {
  DATE_RULE_MESSAGE,
  NEXT_STEP_MESSAGE,
  ruleFailuresFromIssues,
  seanceResultSchema,
  type RuleFailure,
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

/** Why one attempt failed; every value is safe to log. */
export type SeanceDiagCategory =
  | "timeout"
  | "http"
  | "parse"
  | "no-text"
  | "truncated"
  | "abort"
  | "schema"
  | "verdict"
  | "grounding"
  | "date-rule"
  /** Accepted after repair: some items or sentences were dropped. */
  | "repaired";

/**
 * One line per failed attempt. Holds only a category, numbers and zod issue
 * paths: never the key, the prompt, README/commit text or the model's text.
 */
export interface SeanceDiag {
  repo: string;
  attempt: number;
  category: SeanceDiagCategory;
  httpStatus?: number;
  anthropicErrorType?: string;
  elapsedMs: number;
  schemaIssuePaths?: string[];
  /** Rule codes that failed this attempt (parse, schema or grounding). Codes only. */
  ruleCodes?: string[];
  /** Codes of items or sentences dropped by repair this attempt. Codes only. */
  repairedCodes?: string[];
  /** For `no-text` and `truncated`: structure of the response (names and counts, no text). */
  responseShape?: {
    stopReason?: string;
    blockTypes: string[];
    textLengths: number[];
    outputTokens?: number;
    keys: string[];
  };
}

export interface SeanceDeps {
  loadGraveyard: (owner: string) => Promise<Result<GraveyardData, LoadError>>;
  fetchEvidence: (owner: string, repo: string) => Promise<FetchedEvidence | null>;
  llm: LlmClient | null;
  cache: CacheClient | null;
  limiter: RateLimiter;
  log: (entry: { repo: string; reason: string }) => void;
  /** Optional, dev-only diagnostic sink (the route passes it outside production). */
  diag?: (entry: SeanceDiag) => void;
  /** ISO "now" for classifying the creature state; defaults to the clock. */
  now?: () => string;
}

const LLM_CATEGORIES = new Set<SeanceDiagCategory>([
  "timeout",
  "http",
  "parse",
  "no-text",
  "truncated",
  "abort",
]);

/** Reads the safe fields of an LlmError without importing the class. */
function describeLlmError(err: unknown): Partial<SeanceDiag> & {
  category: SeanceDiagCategory;
} {
  if (err && typeof err === "object") {
    const e = err as {
      category?: unknown;
      httpStatus?: unknown;
      anthropicErrorType?: unknown;
      responseShape?: unknown;
    };
    if (
      typeof e.category === "string" &&
      LLM_CATEGORIES.has(e.category as SeanceDiagCategory)
    ) {
      return {
        category: e.category as SeanceDiagCategory,
        ...(typeof e.httpStatus === "number" ? { httpStatus: e.httpStatus } : {}),
        ...(typeof e.anthropicErrorType === "string"
          ? { anthropicErrorType: e.anthropicErrorType }
          : {}),
        ...(e.responseShape && typeof e.responseShape === "object"
          ? { responseShape: e.responseShape as SeanceDiag["responseShape"] }
          : {}),
      };
    }
  }
  return { category: "http" };
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

  // 2. Cache key from server-held values only; a hit costs nothing. The state
  // is computed here (never taken from the client) because it sets the voice.
  const classified = classify(facts, undefined, (deps.now ?? (() => new Date().toISOString()))());
  const creatureState = classified.state;
  // Only a ghost's tone depends on its decay level, so only a ghost's key carries it.
  const decayLevel = creatureState === "ghost" ? (classified.decayLevel ?? 0) : null;
  const key = seanceCacheKey(
    req.owner,
    req.repo,
    facts.pushedAt,
    facts.createdAt,
    creatureState,
    decayLevel,
  );
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
    owner: req.owner,
    facts,
    readme: fetched?.readme ?? null,
    commits: fetched?.commits ?? [],
  });
  const prompt = buildSeancePrompt(req.owner, derived, creatureState, decayLevel);

  // 7. Up to two attempts; every call is consumed first and never refunded.
  let failure: "invalid-output" | "llm-error" = "llm-error";
  let valid: SeanceResult | null = null;
  // Set after a validation failure: rule codes and field paths only.
  let feedback: string | null = null;
  const codesOf = (fs: RuleFailure[]) => [...new Set(fs.map((f) => f.code))];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const consumed = await deps.limiter.consume(req.ip);
    if (state.cancelled) return SILENT;
    if (consumed !== "ok") {
      log(consumed);
      return { kind: consumed };
    }

    const startedAt = Date.now();
    const emit = (
      category: SeanceDiagCategory,
      extra: Partial<SeanceDiag> = {},
    ) => {
      try {
        deps.diag?.({
          repo: req.repo,
          attempt,
          category,
          ...extra,
          elapsedMs: Date.now() - startedAt,
        });
      } catch {
        // diagnostics must never break a request
      }
    };

    let text: string;
    try {
      const r = await race(
        llm.complete({
          system: feedback ? `${prompt.system}\n\n${feedback}` : prompt.system,
          user: prompt.user,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          timeoutMs: LLM_TIMEOUT_MS,
        }),
        LLM_TIMEOUT_MS,
      );
      if (state.cancelled) return SILENT;
      if (r.timedOut) {
        failure = "llm-error";
        emit("timeout");
        continue;
      }
      text = r.value;
    } catch (err) {
      if (state.cancelled) return SILENT;
      failure = "llm-error";
      const d = describeLlmError(err);
      emit(d.category, d);
      continue;
    }

    // Models sometimes wrap JSON in ``` fences or add a line of prose first.
    const json = extractJsonObject(text);
    let parsed: unknown;
    try {
      if (json === null) throw new Error("no object");
      parsed = JSON.parse(json);
    } catch {
      failure = "invalid-output";
      emit("parse", { ruleCodes: ["not-json"] });
      feedback = buildFeedbackNote(attempt, [{ code: "not-json", path: "(root)" }]);
      continue;
    }
    // Repair before validating: drop bad items and bad voice sentences, keep the rest.
    const repair = repairSeance(parsed, derived);
    const repairedCodes = codesOf(repair.repaired);
    const checkedResult = seanceResultSchema.safeParse(repair.value);
    if (!checkedResult.success || repair.rejected.length > 0) {
      failure = "invalid-output";
      const issues = checkedResult.success ? [] : checkedResult.error.issues;
      const paths = [
        ...new Set(issues.map((i) => i.path.join(".") || "(root)")),
      ].slice(0, 10);
      let failures = ruleFailuresFromIssues(issues);
      // When no item survived, the per-item reasons replace the bare "too few items".
      const otherIssues = issues.filter(
        (i) => !(i.path.length === 1 && i.path[0] === "unfinishedBusiness"),
      );
      if (repair.rejected.length > 0) {
        failures = [
          ...failures.filter((f) => f.path !== "unfinishedBusiness"),
          ...repair.rejected,
        ].slice(0, 8);
      }
      emit(
        otherIssues.some((i) => i.message === DATE_RULE_MESSAGE)
          ? "date-rule"
          : otherIssues.some((i) => i.message === NEXT_STEP_MESSAGE)
            ? "verdict"
            : otherIssues.length === 0
              ? "grounding"
              : "schema",
        { schemaIssuePaths: paths, ruleCodes: codesOf(failures), repairedCodes },
      );
      feedback = buildFeedbackNote(attempt, failures);
      continue;
    }
    const groundFailures = groundingFailures(checkedResult.data, derived);
    if (groundFailures.length > 0) {
      failure = "invalid-output";
      emit("grounding", { ruleCodes: codesOf(groundFailures), repairedCodes });
      feedback = buildFeedbackNote(attempt, groundFailures);
      continue;
    }
    if (repairedCodes.length > 0) emit("repaired", { repairedCodes });
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
