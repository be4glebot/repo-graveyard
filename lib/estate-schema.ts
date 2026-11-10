/**
 * Zod schema for the bundled estate fixture (`data/estate.json`).
 *
 * Each entry carries the classification-relevant facts for a repository, but
 * uses **days-ago offsets** instead of absolute dates so the fixture stays
 * valid as time passes; `resolveEstate(fixture, now)` converts those offsets to
 * ISO timestamps relative to an explicit `now`. The prose fields (`diagnosis`,
 * `seance`) are pre-written here for later specs and are dropped during
 * resolution.
 *
 * Requirements: 12.1, 12.4, 12.9
 */

import { z } from "zod";

/** A single repository entry in the estate fixture. */
const estateRepoSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  url: z.string(),
  pushedDaysAgo: z.number().int().nonnegative().nullable(), // null => no push; use createdDaysAgo
  createdDaysAgo: z.number().int().nonnegative(),
  isArchived: z.boolean(),
  isFork: z.boolean(),
  homepageUrl: z.string().nullable(),
  stargazerCount: z.number().int().nonnegative(),
  primaryLanguage: z.string().nullable(),
  languageColor: z.string().nullable().optional(), // absent => null (resolver default)
  forkCount: z.number().int().nonnegative().optional(), // absent => 0
  topics: z.array(z.string()).max(5).optional(), // absent => []
  openIssueCount: z.number().int().nonnegative(),
  releaseCount: z.number().int().nonnegative(),
  readmeBytes: z.number().int().nonnegative().nullable(),
  lastCommitMessage: z.string().nullable(),
  override: z
    .object({
      type: z.enum(["finished", "scrapped", "revived"]),
      setDaysAgo: z.number().int().nonnegative(),
    })
    .optional(),
  diagnosis: z.string().min(1), // Req 12.4
  seance: z.string().min(1), // Req 12.4
});

/** The top-level estate fixture: a username plus a non-empty list of repos. */
export const estateSchema = z.object({
  username: z.string().min(1),
  repos: z.array(estateRepoSchema).min(1),
});

/** The validated estate fixture shape, inferred from {@link estateSchema}. */
export type EstateFixture = z.infer<typeof estateSchema>;
