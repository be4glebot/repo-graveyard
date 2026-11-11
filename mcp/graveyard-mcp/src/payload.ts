import { z } from "zod";

export const STATES = ["ghost", "risen", "zombie", "tombstone", "coffin"] as const;
export type State = (typeof STATES)[number];

const nonNegInt = z.number().int().min(0);

export const repoEntrySchema = z.object({
  name: z.string().min(1).max(200),
  state: z.enum(STATES),
  decay: z.number().int().min(0).max(4).nullable(),
  pushedAt: z.string().max(40).nullable(),
  stars: nonNegInt,
  html_url: z.string().max(500),
});
export type RepoEntry = z.infer<typeof repoEntrySchema>;

export const graveyardPayloadSchema = z
  .object({
    owner: z.string().max(100),
    counts: z.object({
      ghost: nonNegInt,
      risen: nonNegInt,
      zombie: nonNegInt,
      tombstone: nonNegInt,
      coffin: nonNegInt,
      total: nonNegInt,
    }),
    truncated: z.boolean(),
    repos: z.array(repoEntrySchema).max(300),
  })
  .refine(
    (p) =>
      p.counts.ghost + p.counts.risen + p.counts.zombie + p.counts.tombstone + p.counts.coffin ===
      p.counts.total,
    { message: "counts must sum to total" },
  )
  .refine((p) => p.counts.total === p.repos.length, {
    message: "total must equal repos.length",
  });
export type GraveyardPayload = z.infer<typeof graveyardPayloadSchema>;
