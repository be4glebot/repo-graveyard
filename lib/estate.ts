/**
 * Pure estate resolver.
 *
 * Turns the bundled estate fixture (`data/estate.json`, validated by
 * `lib/estate-schema.ts`) into the same `RepoFacts[]` + overrides contract the
 * live routes feed to the scene. The fixture stores **days-ago offsets** rather
 * than calendar dates so it stays valid as time passes; `resolveEstate`
 * reconstructs each absolute ISO timestamp relative to an injected `now`:
 *
 *   resolvedDate(daysAgo, now) = ISO( parseMs(now) − daysAgo × msPerDay )
 *
 * Because `classify` derives `daysQuiet` as `floor((now − base) / msPerDay)`
 * and this resolver rebuilds `base` as `now − daysAgo × msPerDay`, the resolved
 * `daysQuiet` equals the fixture's `pushedDaysAgo` on any calendar day, so the
 * resolved state and decay level are date-stable (Requirement 12.3).
 *
 * This module is pure: it performs no I/O, imports neither `server-only` nor
 * React, and never reads the clock — `now` is always a parameter
 * (Requirement 12.6). The prose fields (`diagnosis`, `seance`) are dropped here;
 * they belong to later specs.
 *
 * Requirements: 12.3, 12.6
 */

import type { EstateFixture } from "./estate-schema";
import { LIFECYCLE_CONFIG, type Override, type RepoFacts } from "./lifecycle";

/** The resolved estate: classification-ready facts plus in-memory overrides. */
export interface ResolvedEstate {
  repos: RepoFacts[];
  /** Keyed by repo name; holds one entry per fixture repo that has an override. */
  overrides: Record<string, Override>;
}

/**
 * Converts a non-negative "days ago" offset to an absolute ISO 8601 timestamp
 * `daysAgo` whole days before `now`, using `LIFECYCLE_CONFIG.msPerDay` as the
 * single source of truth for a day's length (no magic numbers).
 */
function resolvedDateIso(daysAgo: number, now: string): string {
  const ms = Date.parse(now) - daysAgo * LIFECYCLE_CONFIG.msPerDay;
  return new Date(ms).toISOString();
}

/**
 * Resolves the estate fixture into `RepoFacts[]` plus an in-memory
 * `Record<string, Override>` relative to the injected `now`.
 *
 * Each entry's `createdDaysAgo` always resolves to a `createdAt`; a null
 * `pushedDaysAgo` resolves to a null `pushedAt` (no push recorded), otherwise it
 * resolves to a concrete `pushedAt`. The prose fields are dropped. For any entry
 * carrying an override, `setDaysAgo` is converted to the override's `setAt`
 * timestamp and stored under the repo's name.
 *
 * Pure and total: `now` is a parameter, the clock is never read.
 */
export function resolveEstate(fixture: EstateFixture, now: string): ResolvedEstate {
  const repos: RepoFacts[] = [];
  const overrides: Record<string, Override> = {};

  for (const repo of fixture.repos) {
    repos.push({
      name: repo.name,
      description: repo.description,
      url: repo.url,
      pushedAt: repo.pushedDaysAgo === null ? null : resolvedDateIso(repo.pushedDaysAgo, now),
      createdAt: resolvedDateIso(repo.createdDaysAgo, now),
      isArchived: repo.isArchived,
      isFork: repo.isFork,
      homepageUrl: repo.homepageUrl,
      stargazerCount: repo.stargazerCount,
      primaryLanguage: repo.primaryLanguage,
      openIssueCount: repo.openIssueCount,
      releaseCount: repo.releaseCount,
      readmeBytes: repo.readmeBytes,
      lastCommitMessage: repo.lastCommitMessage,
    });

    if (repo.override !== undefined) {
      overrides[repo.name] = {
        type: repo.override.type,
        setAt: resolvedDateIso(repo.override.setDaysAgo, now),
      };
    }
  }

  return { repos, overrides };
}
