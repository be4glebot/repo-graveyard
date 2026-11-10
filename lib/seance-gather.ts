/**
 * Séance evidence fetch (server only).
 *
 * One read-only GraphQL query, sent through the existing `GraphqlTransport`
 * (production: `createGithubTransport()` from ./github). No mutation and no
 * new token scope. Requirements 3.1, 3.2, 3.4-3.10.
 *
 * Timeout: the 5 s race (`GATHER_TIMEOUT_MS`) lives in the service
 * (`runSeance`), not here. `fetchEvidence` never throws and never retries; the
 * service races it against `GATHER_TIMEOUT_MS` and treats a timeout as facts
 * only.
 */

import "server-only";

import type { GraphqlTransport } from "./github";
import { MAX_README_BYTES, truncateUtf8 } from "./seance";

/** Time the service allows for the evidence fetch before using facts only. */
export const GATHER_TIMEOUT_MS = 5000;

/** Number of recent commit messages requested. */
export const MAX_COMMITS = 5;

/** README aliases in priority order; the first present one wins. */
export const README_ALIASES = [
  "readmeMd",
  "readmeLower",
  "readmeBare",
  "readmeRst",
] as const;

export const SEANCE_EVIDENCE_QUERY = /* GraphQL */ `
  query SeanceEvidence($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      readmeMd: object(expression: "HEAD:README.md") {
        ... on Blob {
          text
        }
      }
      readmeLower: object(expression: "HEAD:readme.md") {
        ... on Blob {
          text
        }
      }
      readmeBare: object(expression: "HEAD:README") {
        ... on Blob {
          text
        }
      }
      readmeRst: object(expression: "HEAD:README.rst") {
        ... on Blob {
          text
        }
      }
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 5) {
              nodes {
                message
              }
            }
          }
        }
      }
    }
  }
`;

type BlobNode = { text?: string | null } | null | undefined;

interface EvidenceResponse {
  repository: {
    readmeMd?: BlobNode;
    readmeLower?: BlobNode;
    readmeBare?: BlobNode;
    readmeRst?: BlobNode;
    defaultBranchRef?: {
      target?: {
        history?: { nodes?: ({ message?: unknown } | null)[] | null } | null;
      } | null;
    } | null;
  } | null;
}

export interface FetchedEvidence {
  /** Truncated to <= 8192 UTF-8 bytes; null when no README exists. */
  readme: string | null;
  /** Newest first, at most 5. */
  commits: string[];
}

/**
 * Fetches README text and recent commit messages. Returns `null` on any
 * failure (transport error, missing repository, malformed response); never
 * throws and never retries. No README or fewer than 5 commits is normal.
 */
export async function fetchEvidence(
  transport: GraphqlTransport,
  owner: string,
  repo: string,
): Promise<FetchedEvidence | null> {
  try {
    const { data } = await transport<EvidenceResponse>(SEANCE_EVIDENCE_QUERY, {
      owner,
      name: repo,
    });
    const repository = data?.repository;
    if (!repository) {
      return null;
    }

    let readme: string | null = null;
    for (const alias of README_ALIASES) {
      const text = repository[alias]?.text;
      if (typeof text === "string") {
        readme = truncateUtf8(text, MAX_README_BYTES);
        break;
      }
    }

    const nodes = repository.defaultBranchRef?.target?.history?.nodes ?? [];
    const commits: string[] = [];
    for (const node of nodes) {
      if (node && typeof node.message === "string") {
        commits.push(node.message);
      }
      if (commits.length === MAX_COMMITS) {
        break;
      }
    }

    return { readme, commits };
  } catch {
    return null;
  }
}
