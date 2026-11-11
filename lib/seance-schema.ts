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

/**
 * Visible heading for the `causeOfDeath` field, by creature state. The field
 * keeps its name; only the heading and the prompt guidance change per state.
 */
export const CAUSE_HEADINGS = {
  ghost: "What keeps me here",
  risen: "Why I returned",
  zombie: "Cause of death",
  tombstone: "How I was laid to rest",
  coffin: "Why I was sealed",
} as const;

export type CreatureState = keyof typeof CAUSE_HEADINGS;

/** Heading for a creature state; anything unrecognised reads as "Cause of death". */
export function causeHeading(state: unknown): string {
  return typeof state === "string" &&
    Object.prototype.hasOwnProperty.call(CAUSE_HEADINGS, state)
    ? CAUSE_HEADINGS[state as CreatureState]
    : CAUSE_HEADINGS.zombie;
}

/** The one sentence the spirit may use, and only as the whole `causeOfDeath`, when the evidence is missing. */
export const MEMORY_FADED_SENTENCE = "My memory of that has faded.";

/** Zod issue message when that sentence is used inside another sentence. */
export const MEMORY_MISUSE_MESSAGE =
  "the faded-memory sentence may only appear as a sentence of its own";

/**
 * True when "My memory of that has faded." occurs anywhere other than as a
 * complete sentence of its own (for example glued into a longer sentence).
 */
export function misusesMemoryFaded(text: string): boolean {
  // Any sentence that pairs "memory" with "faded" must be exactly the allowed
  // sentence; this also catches paraphrases such as "my memory of what I was
  // meant to become has faded".
  const allowed = MEMORY_FADED_SENTENCE.toLowerCase();
  const paraphrase = splitSentences(text).some((s) => {
    const l = s.toLowerCase();
    return l.includes("memory") && l.includes("faded") && l.trim() !== allowed;
  });
  if (paraphrase) return true;
  // Match the words without the full stop, so "...has faded, so I hum" is caught.
  const core = MEMORY_FADED_SENTENCE.toLowerCase().replace(/\.$/, "");
  const occurrences = text.toLowerCase().split(core).length - 1;
  if (occurrences === 0) return false;
  const standalone = splitSentences(text).filter(
    (s) => s.trim().toLowerCase() === `${core}.`,
  ).length;
  return standalone !== occurrences;
}

/**
 * True when the text mentions the faded-memory sentence at all, or pairs
 * "memory" with "faded" in any way. Used for every field except `causeOfDeath`,
 * where the exact sentence (and nothing else of that kind) is allowed.
 */
export function mentionsMemoryFaded(text: string): boolean {
  if (misusesMemoryFaded(text)) return true;
  return text.toLowerCase().includes(MEMORY_FADED_SENTENCE.toLowerCase().replace(/\.$/, ""));
}

/** Zod issue message when a finish or seal reason talks about next steps. */
export const NEXT_STEP_MESSAGE =
  "a finish or seal reason must not contain next-step language";

const NEXT_STEP_RE =
  /\b(?:next steps?|then cut|cut (?:a |the )?(?:first )?release|add|implement\w*|fix\w*|test\w*|start (?:with|by)|begin (?:with|by)|should|needs? to|to-?do)\b/i;

/**
 * True when a verdict reason reads like instructions ("next step", "then cut",
 * "add", "implement", "fix", "test", ...). Only revive may name a next step.
 */
export function hasNextStepLanguage(text: string): boolean {
  return NEXT_STEP_RE.test(text);
}

/** Zod issue message when a ledger detail describes work that is already done. */
export const COMPLETED_WORK_MESSAGE =
  "an unfinished-business detail must describe something not yet done";

const COMPLETED_WORDS =
  "closed|fixed|added|updated|completed|merged|resolved|finished|implemented";
const COMPLETED_PASSIVE_RE = new RegExp(
  `\\b(?:was|were|is|are|been|got)\\s+(?:\\w+ly\\s+)?(?:${COMPLETED_WORDS})\\b`,
  "i",
);
// "never completed", "half-completed" and the like are unfinished, so they pass.
const NEGATED_COMPLETED_RE =
  /\b(?:never|not|isn't|wasn't|weren't|hasn't|haven't|hadn't|aren't|barely|hardly|half|partly|partially)[\s-]+(?:\w+[\s-]+){0,2}?completed\b/gi;

/**
 * True when a ledger detail uses completed-work language ("was closed",
 * "was fixed", "was added", "was updated", "completed", ...). Every item in the
 * ledger must describe something that is NOT yet done.
 */
export function describesCompletedWork(text: string): boolean {
  if (COMPLETED_PASSIVE_RE.test(text)) return true;
  return /\bcompleted\b/i.test(text.replace(NEGATED_COMPLETED_RE, ""));
}

const nonBlank = (s: string) => s.trim().length > 0;
/** Zod issue message for the date / day-count rule (used to categorise failures). */
export const DATE_RULE_MESSAGE = "must not contain a date or day count";
const NO_DATE = DATE_RULE_MESSAGE;

/**
 * `allowFadedSentence` is true only for `causeOfDeath`, where the exact
 * faded-memory sentence may stand as the whole line.
 */
const textField = (max: number, min = 1, allowFadedSentence = false) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine(nonBlank, "must not be blank")
    .refine((s) => !containsDateOrDayCount(s), NO_DATE)
    .refine(
      (s) => !(allowFadedSentence ? misusesMemoryFaded(s) : mentionsMemoryFaded(s)),
      MEMORY_MISUSE_MESSAGE,
    );

export const businessItemSchema = z.strictObject({
  title: textField(80),
  detail: textField(140)
    .refine((s) => countSentences(s) === 1, "must be exactly 1 sentence")
    .refine((s) => !describesCompletedWork(s), COMPLETED_WORK_MESSAGE),
  evidence: z.string().min(8).max(200).refine(nonBlank, "must not be blank"),
});

export const seanceResultSchema = z
  .strictObject({
  voice: textField(320).refine((s) => {
    const n = countSentences(s);
    return n >= 2 && n <= 3;
  }, "must be 2 to 3 sentences"),
  causeOfDeath: textField(200, 1, true).refine(
    (s) => countSentences(s) === 1,
    "must be exactly 1 sentence",
  ),
  unfinishedBusiness: z.array(businessItemSchema).min(1).max(4),
  verdict: z.enum(VERDICTS),
  verdictReason: textField(300),
  })
  .superRefine((r, ctx) => {
    if (r.verdict !== "revive" && hasNextStepLanguage(r.verdictReason)) {
      ctx.addIssue({
        code: "custom",
        message: NEXT_STEP_MESSAGE,
        path: ["verdictReason"],
      });
    }
  });

// ---------------------------------------------------------------------------
// Rule failures (codes and field paths only; never any model text)
// ---------------------------------------------------------------------------

/** One failed rule: a stable code and the schema path of the field. */
export interface RuleFailure {
  code: string;
  path: string;
}

interface IssueLike {
  code: string;
  path: readonly PropertyKey[];
  message: string;
}

/** `unfinishedBusiness[2].evidence`, built from schema keys and indexes only. */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "(root)";
  let out = "";
  for (const p of path) {
    if (typeof p === "number") out += `[${p}]`;
    else out += out === "" ? String(p) : `.${String(p)}`;
  }
  return out;
}

/** Stable rule code for one zod issue. */
export function ruleCodeForIssue(issue: IssueLike): string {
  if (issue.message === DATE_RULE_MESSAGE) return "date-rule";
  if (issue.message === NEXT_STEP_MESSAGE) return "next-step";
  if (issue.message === MEMORY_MISUSE_MESSAGE) return "memory-faded";
  if (issue.message === COMPLETED_WORK_MESSAGE) return "completed-work";
  if (/sentence/.test(issue.message)) return "sentence-count";
  if (issue.message === "must not be blank") return "blank";
  switch (issue.code) {
    case "too_big":
    case "too_small":
      return "length";
    case "unrecognized_keys":
      return "unknown-key";
    case "invalid_type":
      return "type";
    case "invalid_value":
      return "value";
    default:
      return "schema";
  }
}

/** Deduplicated rule failures (at most 8) for a list of zod issues. */
export function ruleFailuresFromIssues(issues: readonly IssueLike[]): RuleFailure[] {
  const seen = new Set<string>();
  const out: RuleFailure[] = [];
  for (const i of issues) {
    const f = { code: ruleCodeForIssue(i), path: formatIssuePath(i.path) };
    const k = `${f.code}@${f.path}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
    if (out.length >= 8) break;
  }
  return out;
}

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
