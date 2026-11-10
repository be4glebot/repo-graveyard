/**
 * Séance schema and validation.
 *
 * Client-safe: no `server-only` import. Shared by the renderer, the service,
 * the cache and the fixture validator.
 */

import { z } from "zod";

export const VERDICTS = ["revive", "finish", "seal"] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface BusinessItem {
  title: string;
  detail: string;
  evidence: string;
}

export interface SeanceResult {
  voice: string;
  causeOfDeath: string;
  unfinishedBusiness: BusinessItem[];
  verdict: Verdict;
  verdictReason: string;
}

// ---------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------

// Run of non-terminators, then one or more terminators and any closing
// quote/bracket; a final run may end at the end of the string.
const SENTENCE_RE = /[^.!?…]+[.!?…]+["'”’)\]»]*|[^.!?…]+$/g;

/** Deterministic sentence splitter (no Intl.Segmenter). */
export function splitSentences(text: string): string[] {
  const matches = text.trim().match(SENTENCE_RE);
  if (!matches) return [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function countSentences(text: string): number {
  return splitSentences(text).length;
}

// ---------------------------------------------------------------------------
// Date and day-count detection
// ---------------------------------------------------------------------------

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const ORD = "(?:st|nd|rd|th)?";

const DATE_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/i,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i,
  new RegExp(`\\b${MONTH}\\b\\.?\\s+\\d{1,2}${ORD}\\b`, "i"),
  new RegExp(`\\b\\d{1,2}${ORD}(?:\\s+of)?\\s+${MONTH}\\b`, "i"),
  new RegExp(`\\b${MONTH}\\b\\.?,?\\s+\\d{4}\\b`, "i"),
  /\b\d+\s*days?\b/i,
];

export function containsDateOrDayCount(text: string): boolean {
  return DATE_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// Result schema
// ---------------------------------------------------------------------------

const nonBlank = (s: string) => s.trim().length > 0;
const NO_DATE = "must not contain a date or day count";

const textField = (max: number, min = 1) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine(nonBlank, "must not be blank")
    .refine((s) => !containsDateOrDayCount(s), NO_DATE);

const businessItemSchema = z.strictObject({
  title: textField(80),
  detail: textField(300),
  evidence: z.string().min(8).max(200).refine(nonBlank, "must not be blank"),
});

export const seanceResultSchema = z.strictObject({
  voice: textField(600).refine((s) => {
    const n = countSentences(s);
    return n >= 2 && n <= 4;
  }, "must be 2 to 4 sentences"),
  causeOfDeath: textField(200).refine(
    (s) => countSentences(s) === 1,
    "must be exactly 1 sentence",
  ),
  unfinishedBusiness: z.array(businessItemSchema).min(2).max(5),
  verdict: z.enum(VERDICTS),
  verdictReason: textField(300),
});

// ---------------------------------------------------------------------------
// Request and response schemas
// ---------------------------------------------------------------------------

/** Unknown keys (such as a client-sent pushedAt) are stripped, not rejected. */
export const seanceRequestSchema = z.object({
  owner: z.string().min(1).max(39),
  repo: z.string().min(1).max(100),
});
export type SeanceRequest = z.infer<typeof seanceRequestSchema>;

export const seanceResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ok"), result: seanceResultSchema }),
  z.object({ kind: z.literal("veil") }),
  z.object({ kind: z.literal("weak") }),
  z.object({ kind: z.literal("silent") }),
]);
export type SeanceResponse = z.infer<typeof seanceResponseSchema>;

/** What the client receives for one attempt: the parsed response union. */
export type SeanceOutcome = SeanceResponse;
