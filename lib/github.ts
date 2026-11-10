/**
 * GitHub GraphQL wrapper (server only).
 *
 * This module owns the single GraphQL query used to load a graveyard, the pure
 * mapping from a raw GraphQL repository node to the domain `RepoFacts` shape,
 * and the paginated `fetchRepos` fetch-and-error-mapping algorithm. The only
 * place `GITHUB_TOKEN` is read is the production transport at the bottom of the
 * file; every other function takes an injectable `GraphqlTransport`, so tests
 * drive the logic with fakes and the token never leaks into the pure core.
 *
 * Boundaries (Requirements 1.1-1.7):
 * - `GRAVEYARD_QUERY` and `mapRepoNode` are pure and exported for tests.
 * - `fetchRepos` is async but deterministic given a transport: it paginates up
 *   to `maxRepos`, retries a single 5xx once, and maps transport failures onto
 *   the shared `LoadError` discriminated union.
 */

import "server-only";

import { LIFECYCLE_CONFIG, type RepoFacts } from "./lifecycle";

// ---------------------------------------------------------------------------
// Shared result + error types
//
// These describe the contract `fetchRepos` (and, later, the loader) returns.
// They live here because `fetchRepos` is the first producer of them and the
// loader depends on this module (not the reverse), which keeps the import graph
// acyclic. The loader re-uses these same types.
// ---------------------------------------------------------------------------

/** The data payload for a successfully loaded graveyard. */
export interface GraveyardData {
  repos: RepoFacts[];
  totalCount: number;
  /** True when more repositories exist on GitHub than were returned. */
  truncated: boolean;
}

/** The discriminated union of every way a load can fail. */
export type LoadError =
  | { kind: "invalid-username" }
  | { kind: "not-found" }
  | { kind: "rate-limited"; resetAt: string | null }
  | { kind: "server-error"; detail?: string };

/** A success-or-error result, mirroring a Rust-style `Result`. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// ---------------------------------------------------------------------------
// Raw GraphQL node + response shapes (before mapping)
// ---------------------------------------------------------------------------

/** A single repository node exactly as selected by `GRAVEYARD_QUERY`. */
export interface RawRepoNode {
  name: string;
  description: string | null;
  url: string;
  pushedAt: string | null;
  createdAt: string;
  isArchived: boolean;
  isFork: boolean;
  homepageUrl: string | null;
  stargazerCount: number;
  primaryLanguage: { name: string; color: string | null } | null;
  forkCount: number;
  repositoryTopics: { nodes: { topic: { name: string } }[] };
  issues: { totalCount: number };
  releases: { totalCount: number };
  readmeUpper: { byteSize: number } | null;
  readmeLower: { byteSize: number } | null;
  defaultBranchRef: { target: { message?: string } | null } | null;
}

interface RepositoriesConnection {
  totalCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: RawRepoNode[];
}

/** The top-level shape of a `GRAVEYARD_QUERY` response. */
export interface GraveyardQueryResponse {
  repositoryOwner: { repositories: RepositoriesConnection } | null;
}

// ---------------------------------------------------------------------------
// Transport contract
// ---------------------------------------------------------------------------

/**
 * The injectable GraphQL transport. It resolves with the response `data` and
 * (optionally) lower-cased response headers so `fetchRepos` can read
 * `x-ratelimit-reset`. Failures are surfaced by rejecting with a
 * `TransportError`, which carries the HTTP status, response headers, and any
 * GraphQL error codes so the caller can map them onto a `LoadError`.
 */
export type GraphqlTransport = <T>(
  query: string,
  vars: Record<string, unknown>,
) => Promise<{ data: T; headers?: Record<string, string> }>;

/**
 * A normalized transport failure. The production transport converts octokit's
 * `RequestError` / `GraphqlResponseError` into this shape so `fetchRepos` never
 * depends on octokit internals. Any thrown value that is not a `TransportError`
 * is treated as an unknown server error.
 */
export class TransportError extends Error {
  /** HTTP status when known (e.g. 403, 429, 503); null for GraphQL-only errors. */
  readonly status: number | null;
  /** Lower-cased response headers, used to read `x-ratelimit-reset`. */
  readonly headers: Record<string, string>;
  /** GraphQL error type/code strings (e.g. `NOT_FOUND`, `RATE_LIMITED`). */
  readonly codes: string[];

  constructor(
    message: string,
    options: {
      status?: number | null;
      headers?: Record<string, string>;
      codes?: string[];
    } = {},
  ) {
    super(message);
    this.name = "TransportError";
    this.status = options.status ?? null;
    this.headers = options.headers ?? {};
    this.codes = options.codes ?? [];
  }
}

// ---------------------------------------------------------------------------
// GraphQL query
// ---------------------------------------------------------------------------

/**
 * The single query used for every page. `$first` is capped per page by the
 * caller and `$after` carries the cursor. Repositories are filtered to public,
 * non-fork, owner-affiliated repos and ordered by most-recent push so the 300
 * cap keeps the freshest repos. Both README casings are aliased; `README.md`
 * (`readmeUpper`) wins during mapping when both exist.
 */
export const GRAVEYARD_QUERY = /* GraphQL */ `
  query Graveyard($login: String!, $first: Int!, $after: String) {
    repositoryOwner(login: $login) {
      repositories(
        first: $first
        after: $after
        isFork: false
        privacy: PUBLIC
        ownerAffiliations: OWNER
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          description
          url
          pushedAt
          createdAt
          isArchived
          isFork
          homepageUrl
          stargazerCount
          forkCount
          primaryLanguage {
            name
            color
          }
          repositoryTopics(first: 5) {
            nodes {
              topic {
                name
              }
            }
          }
          issues(states: OPEN) {
            totalCount
          }
          releases {
            totalCount
          }
          readmeUpper: object(expression: "HEAD:README.md") {
            ... on Blob {
              byteSize
            }
          }
          readmeLower: object(expression: "HEAD:readme.md") {
            ... on Blob {
              byteSize
            }
          }
          defaultBranchRef {
            target {
              ... on Commit {
                message
              }
            }
          }
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Node mapping (pure, exported for tests)
// ---------------------------------------------------------------------------

/**
 * Maps a raw GraphQL repository node to `RepoFacts`. Pure: no I/O, no clock.
 *
 * - `readmeBytes` prefers `README.md` (`readmeUpper`) over `readme.md`
 *   (`readmeLower`), falling back to `null` when neither blob exists.
 * - `primaryLanguage` is flattened from `{ name }` to its string (or `null`).
 * - `lastCommitMessage` is the default branch's last commit subject, or `null`
 *   when the repo is empty (no default branch / target) or the message is empty.
 * - Every other field is carried across unchanged.
 */
export function mapRepoNode(node: RawRepoNode): RepoFacts {
  const readmeBytes =
    node.readmeUpper?.byteSize ?? node.readmeLower?.byteSize ?? null;

  const rawMessage = node.defaultBranchRef?.target?.message;
  const lastCommitMessage =
    rawMessage !== undefined && rawMessage !== "" ? rawMessage : null;

  return {
    name: node.name,
    description: node.description,
    url: node.url,
    pushedAt: node.pushedAt,
    createdAt: node.createdAt,
    isArchived: node.isArchived,
    isFork: node.isFork,
    homepageUrl: node.homepageUrl,
    stargazerCount: node.stargazerCount,
    primaryLanguage: node.primaryLanguage?.name ?? null,
    languageColor: node.primaryLanguage?.color ?? null,
    forkCount: node.forkCount,
    topics: (node.repositoryTopics?.nodes ?? [])
      .map((n) => n.topic.name)
      .slice(0, 5),
    openIssueCount: node.issues.totalCount,
    releaseCount: node.releases.totalCount,
    readmeBytes,
    lastCommitMessage,
  };
}

// ---------------------------------------------------------------------------
// Fetch algorithm
// ---------------------------------------------------------------------------

/** GitHub GraphQL "not found" error type/code. */
const NOT_FOUND_CODE = "NOT_FOUND";
/** GitHub GraphQL rate-limit error type/code. */
const RATE_LIMITED_CODE = "RATE_LIMITED";

/**
 * Converts the `x-ratelimit-reset` header (epoch seconds) into an ISO 8601
 * string, or `null` when the header is absent or unparseable.
 */
function resetAtFromHeaders(headers: Record<string, string>): string | null {
  const raw = headers["x-ratelimit-reset"];
  if (raw === undefined) {
    return null;
  }
  const seconds = Number(raw);
  if (!Number.isFinite(seconds)) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

/**
 * Builds a short, redacted diagnostic string for a server-error. The token
 * lives only in the request `authorization` header, which `TransportError`
 * never carries, and GitHub's 5xx bodies / GraphQL error messages do not echo
 * it, so the status + first line of the message are safe to surface for logs.
 * The message is truncated and collapsed to a single line to keep logs tidy.
 */
function serverErrorDetail(error: unknown): string {
  if (!(error instanceof TransportError)) {
    const message = error instanceof Error ? error.message : String(error);
    return `unknown error: ${message.replace(/\s+/g, " ").trim().slice(0, 200)}`;
  }
  const parts: string[] = [];
  if (error.status !== null) {
    parts.push(`status=${error.status}`);
  }
  if (error.codes.length > 0) {
    parts.push(`codes=${error.codes.join(",")}`);
  }
  const message = error.message.replace(/\s+/g, " ").trim().slice(0, 200);
  if (message.length > 0) {
    parts.push(`message=${message}`);
  }
  return parts.join(" ");
}

/** Maps a `TransportError` (or unknown throw) onto a `LoadError`. */
function toLoadError(error: unknown): LoadError {
  if (!(error instanceof TransportError)) {
    return { kind: "server-error", detail: serverErrorDetail(error) };
  }

  const codes = error.codes;
  const status = error.status;

  if (codes.includes(NOT_FOUND_CODE)) {
    return { kind: "not-found" };
  }

  if (
    status === 403 ||
    status === 429 ||
    codes.includes(RATE_LIMITED_CODE)
  ) {
    return { kind: "rate-limited", resetAt: resetAtFromHeaders(error.headers) };
  }

  return { kind: "server-error", detail: serverErrorDetail(error) };
}

/** True when a thrown error represents a retryable 5xx response. */
function isServerError(error: unknown): boolean {
  return (
    error instanceof TransportError &&
    error.status !== null &&
    error.status >= 500 &&
    error.status <= 599
  );
}

/**
 * Issues one page request, retrying exactly once on a 5xx with HALF the page
 * size. A large page (e.g. 50 repos, each resolving two README blob lookups)
 * can exhaust GitHub's GraphQL resolver and return a gateway timeout (502/503/
 * 504); re-requesting the same expensive page would just time out again, so the
 * retry shrinks `first` to `max(1, floor(first / 2))` to get under the budget.
 * A second 5xx (or any non-5xx error) propagates so the caller can discard
 * partial data and surface a server error (Req 1.7). Non-5xx failures are not
 * retried. A successful smaller page returns fewer nodes; the pagination loop
 * simply fetches the remainder on the next iteration via the cursor.
 */
async function requestPage(
  transport: GraphqlTransport,
  login: string,
  first: number,
  after: string | null,
): Promise<{ data: GraveyardQueryResponse; headers: Record<string, string> }> {
  try {
    const res = await transport<GraveyardQueryResponse>(GRAVEYARD_QUERY, {
      login,
      first,
      after,
    });
    return { data: res.data, headers: res.headers ?? {} };
  } catch (error) {
    if (!isServerError(error)) {
      throw error;
    }
    // Single retry on 5xx with a halved page size; a second 5xx (or any error)
    // propagates.
    const retryFirst = Math.max(1, Math.floor(first / 2));
    const res = await transport<GraveyardQueryResponse>(GRAVEYARD_QUERY, {
      login,
      first: retryFirst,
      after,
    });
    return { data: res.data, headers: res.headers ?? {} };
  }
}

/**
 * Fetches up to `maxRepos` repositories for `login`, paginating with the
 * injected transport.
 *
 * Algorithm (Req 1.1, 1.2, 1.7):
 * 1. Each page requests `first = min(pageSize, maxRepos - collected)` with the
 *    running cursor, so at most `ceil(min(total, maxRepos) / pageSize)` calls
 *    are made.
 * 2. Looping stops when `collected == maxRepos` or `hasNextPage` is false.
 * 3. `truncated = totalCount > maxRepos || (collected == maxRepos && hasNextPage)`.
 * 4. A persistent 5xx discards everything and returns `server-error`.
 *
 * Errors are mapped by `toLoadError`: a null owner or `NOT_FOUND` becomes
 * `not-found` (Req 1.5); 403/429/`RATE_LIMITED` becomes `rate-limited` with the
 * reset time (Req 1.6); anything else becomes `server-error`.
 */
export async function fetchRepos(
  login: string,
  transport: GraphqlTransport,
): Promise<Result<GraveyardData, LoadError>> {
  const { maxRepos, pageSize } = LIFECYCLE_CONFIG;

  const repos: RepoFacts[] = [];
  let after: string | null = null;
  let totalCount = 0;
  let hasNextPage = false;

  try {
    do {
      const first = Math.min(pageSize, maxRepos - repos.length);
      const { data } = await requestPage(transport, login, first, after);

      const owner = data.repositoryOwner;
      if (owner === null) {
        // A null owner means the login does not exist (Req 1.5).
        return { ok: false, error: { kind: "not-found" } };
      }

      const connection = owner.repositories;
      totalCount = connection.totalCount;
      hasNextPage = connection.pageInfo.hasNextPage;
      after = connection.pageInfo.endCursor;

      for (const node of connection.nodes) {
        repos.push(mapRepoNode(node));
      }
    } while (repos.length < maxRepos && hasNextPage);
  } catch (error) {
    // Any failed (and non-recovered) page discards partial data (Req 1.7).
    return { ok: false, error: toLoadError(error) };
  }

  const truncated =
    totalCount > maxRepos || (repos.length === maxRepos && hasNextPage);

  return { ok: true, value: { repos, totalCount, truncated } };
}

// ---------------------------------------------------------------------------
// Production transport (the only place GITHUB_TOKEN is read)
// ---------------------------------------------------------------------------

/**
 * Normalizes octokit's response headers (whose values may be numbers for some
 * fields) into a plain `Record<string, string>` keyed by lower-cased names.
 */
function normalizeHeaders(
  headers: Record<string, string | number | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (headers === undefined) {
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      out[key.toLowerCase()] = String(value);
    }
  }
  return out;
}

/**
 * The production transport. Wraps `@octokit/graphql` with the `GITHUB_TOKEN`
 * authorization header and converts octokit's `RequestError` (HTTP failures)
 * and `GraphqlResponseError` (GraphQL errors with a 200 status) into the
 * `TransportError` shape the fetch algorithm understands.
 *
 * `GITHUB_TOKEN` is read here and only here; tests never touch this function
 * because they inject their own `GraphqlTransport`.
 */
export function createGithubTransport(
  token: string = process.env.GITHUB_TOKEN ?? "",
): GraphqlTransport {
  return async <T>(query: string, vars: Record<string, unknown>) => {
    // Imported lazily so this server-only dependency is not pulled into the
    // module graph of pure callers/tests that never build the real transport.
    const { graphql, GraphqlResponseError } = await import("@octokit/graphql");
    const { RequestError } = await import("@octokit/request-error");

    const client = graphql.defaults({
      headers: { authorization: `token ${token}` },
    });

    try {
      const data = await client<T>(query, vars);
      return { data };
    } catch (error) {
      if (error instanceof GraphqlResponseError) {
        const codes = (error.errors ?? [])
          .map((e) => e.type)
          .filter((t): t is string => typeof t === "string");
        throw new TransportError(error.message, {
          status: null,
          headers: normalizeHeaders(
            error.headers as Record<string, string | number | undefined>,
          ),
          codes,
        });
      }
      if (error instanceof RequestError) {
        throw new TransportError(error.message, {
          status: error.status,
          headers: normalizeHeaders(
            error.response?.headers as
              | Record<string, string | number | undefined>
              | undefined,
          ),
        });
      }
      throw new TransportError(
        error instanceof Error ? error.message : "Unknown transport error",
      );
    }
  };
}
