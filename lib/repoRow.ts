/**
 * Validated view-model for the hover card and detail panel.
 *
 * `buildRepoRows` is the FIRST stage of the scene pipeline: it validates each
 * `RepoFacts` record, skipping (and warning on) invalid ones so that only
 * validated repositories ever become creatures.
 *
 * Pure (no clock, no I/O apart from `console.warn`) and total (never throws).
 *
 * Requirements: 1.3, 1.8
 */

import { z } from "zod";
import type { RepoFacts } from "./lifecycle";

/** UI-only language shape; NOT a field type on `RepoFacts`. */
export interface RepoLanguage {
  name: string;
  color: string | null;
}

export interface RepoRow {
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  primaryLanguage: RepoLanguage | null;
  stargazerCount: number;
  forkCount: number;
  openIssueCount: number;
  /** 0..5 topics. */
  topics: string[];
  pushedAt: string | null;
  createdAt: string;
  isArchived: boolean;
  isFork: boolean;
}

const MAX_INT32 = 2_147_483_647;

const count = z.number().int().nonnegative();

/** Enforces the Req 1.3 ranges. */
export const repoRowSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  homepageUrl: z.string().nullable(),
  primaryLanguage: z
    .object({
      name: z.string().min(1).max(255),
      color: z.string().nullable().optional(),
    })
    .nullable(),
  stargazerCount: count,
  forkCount: count.max(MAX_INT32),
  openIssueCount: count,
  topics: z.array(z.string()).max(5),
  pushedAt: z.string().nullable(),
  createdAt: z.string(),
  isArchived: z.boolean(),
  isFork: z.boolean(),
}) as unknown as z.ZodType<RepoRow>;

function compose(facts: RepoFacts): unknown {
  return {
    name: facts.name,
    description: facts.description,
    url: facts.url,
    homepageUrl: facts.homepageUrl,
    primaryLanguage:
      facts.primaryLanguage === null
        ? null
        : { name: facts.primaryLanguage, color: facts.languageColor },
    stargazerCount: facts.stargazerCount,
    forkCount: facts.forkCount,
    openIssueCount: facts.openIssueCount,
    topics: facts.topics,
    pushedAt: facts.pushedAt,
    createdAt: facts.createdAt,
    isArchived: facts.isArchived,
    isFork: facts.isFork,
  };
}

/**
 * Compose and validate a row per repo, preserving order. An invalid record is
 * skipped with a `console.warn` naming the repo and offending field; every
 * other valid record is kept. Never throws.
 */
export function buildRepoRows(repos: RepoFacts[]): RepoRow[] {
  const rows: RepoRow[] = [];
  for (const facts of repos) {
    try {
      const result = repoRowSchema.safeParse(compose(facts));
      if (result.success) {
        rows.push(result.data);
      } else {
        const issue = result.error.issues[0];
        const field = issue && issue.path.length > 0 ? issue.path.join(".") : "(row)";
        console.warn(`repo-row skipped: ${String(facts?.name)} — invalid field ${field}`);
      }
    } catch {
      console.warn(`repo-row skipped: ${String(facts?.name)} — invalid field (row)`);
    }
  }
  return rows;
}
