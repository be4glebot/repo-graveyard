/**
 * Pure builder for the public `GET /api/graveyard/[owner]` payload, plus the
 * mapping from loader errors to fixed HTTP responses. No I/O, no clock reads,
 * no `server-only` import: "now" is always a parameter.
 */

import type { GraveyardData, LoadError } from "@/lib/github";
import { classify, type LifecycleState } from "@/lib/lifecycle";

export interface RepoEntry {
  name: string;
  state: LifecycleState;
  /** Classification.decayLevel; null unless ghost or zombie. */
  decay: number | null;
  /** ISO 8601 UTC (Date#toISOString) or null. */
  pushedAt: string | null;
  /** Non-negative integer. */
  stars: number;
  html_url: string;
}

export interface GraveyardPayload {
  owner: string;
  counts: Record<LifecycleState, number> & { total: number };
  truncated: boolean;
  repos: RepoEntry[];
}

export type ErrorResponse = {
  status: 400 | 404 | 429 | 502;
  body: { error: string };
  retryAfter?: number;
};

/** Compares two strings by Unicode code point (not UTF-16 unit). */
export function compareCodePoints(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a.codePointAt(i) as number;
    const cb = b.codePointAt(j) as number;
    if (ca !== cb) return ca < cb ? -1 : 1;
    i += ca > 0xffff ? 2 : 1;
    j += cb > 0xffff ? 2 : 1;
  }
  const restA = a.length - i;
  const restB = b.length - j;
  if (restA === restB) return 0;
  return restA < restB ? -1 : 1;
}

function instantOf(entry: RepoEntry): number | null {
  if (entry.pushedAt === null) return null;
  const ms = Date.parse(entry.pushedAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Newest instant first, ties by name; null dates last, by name. */
export function compareEntries(a: RepoEntry, b: RepoEntry): number {
  const ia = instantOf(a);
  const ib = instantOf(b);
  if (ia !== null && ib !== null) {
    if (ia !== ib) return ia > ib ? -1 : 1;
  } else if (ia !== null) {
    return -1;
  } else if (ib !== null) {
    return 1;
  }
  return compareCodePoints(a.name, b.name);
}

export function buildGraveyardPayload(
  owner: string,
  data: GraveyardData,
  nowIso: string,
): GraveyardPayload {
  const counts = {
    ghost: 0,
    risen: 0,
    zombie: 0,
    tombstone: 0,
    coffin: 0,
    total: 0,
  };

  const repos: RepoEntry[] = data.repos.map((repo) => {
    const c = classify(repo, undefined, nowIso);
    const ms = repo.pushedAt === null ? NaN : Date.parse(repo.pushedAt);
    const stars = Number.isFinite(repo.stargazerCount)
      ? Math.max(0, Math.trunc(repo.stargazerCount))
      : 0;
    counts[c.state] += 1;
    return {
      name: repo.name,
      state: c.state,
      decay: c.decayLevel,
      pushedAt: Number.isFinite(ms) ? new Date(ms).toISOString() : null,
      stars,
      html_url: repo.url,
    };
  });

  repos.sort(compareEntries);
  counts.total = repos.length;

  return { owner, counts, truncated: data.truncated, repos };
}

/** Whole seconds until the reset (at least 1), or undefined when unknown. */
export function retryAfterFromReset(
  resetAt: string | null,
  nowMs: number,
): number | undefined {
  if (resetAt === null) return undefined;
  const resetMs = Date.parse(resetAt);
  if (!Number.isFinite(resetMs)) return undefined;
  return Math.max(1, Math.ceil((resetMs - nowMs) / 1000));
}

/** Maps a loader error to a fixed response; `detail` is never forwarded. */
export function mapLoadError(error: LoadError, nowMs: number): ErrorResponse {
  switch (error.kind) {
    case "invalid-username":
      return { status: 400, body: { error: "invalid-username" } };
    case "not-found":
      return { status: 404, body: { error: "not-found" } };
    case "rate-limited": {
      const retryAfter = retryAfterFromReset(error.resetAt, nowMs);
      return retryAfter === undefined
        ? { status: 429, body: { error: "rate-limited" } }
        : { status: 429, body: { error: "rate-limited" }, retryAfter };
    }
    default:
      return { status: 502, body: { error: "server-error" } };
  }
}
