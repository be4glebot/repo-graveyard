/**
 * Repair over reject. Pure; no I/O.
 *
 * After the model's JSON is parsed and before the strict schema runs, drop the
 * parts that fail a rule and keep the rest:
 *
 * - `unfinishedBusiness`: an item whose evidence is not grounded, or that
 *   breaks an item rule (completed-work, date-rule, length, ...), is dropped.
 *   The response is rejected only when no item survives.
 * - `voice`: sentences that break the date rule or are the faded-memory
 *   sentence are removed, and the rest is cut to the first sentences that fit
 *   (at most 3 sentences, at most 320 characters). Fewer than 2 sentences left
 *   means the voice is returned untouched, so the schema rejects it.
 *
 * Meaning errors (for example next-step words in a finish or seal reason) are
 * not repaired: the schema still rejects them. Results hold rule codes and
 * schema paths only, never model text.
 */
import { isGroundedEvidence, type DerivedEvidence } from "./seance";
import {
  businessItemSchema,
  containsDateOrDayCount,
  mentionsMemoryFaded,
  ruleFailuresFromIssues,
  splitSentences,
  type RuleFailure,
} from "./seance-schema";

/** Same numbers as the voice rules in the schema. */
export const REPAIR_VOICE_MAX_CHARS = 320;
export const REPAIR_VOICE_MAX_SENTENCES = 3;
export const REPAIR_VOICE_MIN_SENTENCES = 2;
/** Same upper bound as the ledger rule in the schema. */
export const REPAIR_ITEMS_MAX = 4;

export interface RepairResult {
  /** The repaired value, to be validated by the strict schema. */
  value: unknown;
  /** What was dropped or trimmed (code and path). The response is still usable. */
  repaired: RuleFailure[];
  /** Set only when no ledger item survived: why each item was dropped. */
  rejected: RuleFailure[];
}

export function repairVoice(voice: string): { text: string; codes: string[] } {
  const sentences = splitSentences(voice);
  const codes: string[] = [];
  const kept: string[] = [];
  for (const s of sentences) {
    if (containsDateOrDayCount(s)) {
      codes.push("date-rule");
      continue;
    }
    if (mentionsMemoryFaded(s)) {
      codes.push("memory-faded");
      continue;
    }
    kept.push(s);
  }
  if (kept.length < REPAIR_VOICE_MIN_SENTENCES) return { text: voice, codes: [] };

  const fit: string[] = [];
  for (const s of kept) {
    if (fit.length >= REPAIR_VOICE_MAX_SENTENCES) break;
    if ([...fit, s].join(" ").length > REPAIR_VOICE_MAX_CHARS) break;
    fit.push(s);
  }
  if (fit.length < REPAIR_VOICE_MIN_SENTENCES) return { text: voice, codes: [] };
  if (fit.length < kept.length) codes.push("voice-trimmed");
  if (codes.length === 0) return { text: voice, codes: [] };
  return { text: fit.join(" "), codes };
}

export function repairSeance(parsed: unknown, d: DerivedEvidence): RepairResult {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { value: parsed, repaired: [], rejected: [] };
  }
  const value: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
  const repaired: RuleFailure[] = [];
  const rejected: RuleFailure[] = [];

  if (typeof value.voice === "string") {
    const r = repairVoice(value.voice);
    if (r.codes.length > 0) {
      value.voice = r.text;
      for (const code of r.codes) repaired.push({ code, path: "voice" });
    }
  }

  if (Array.isArray(value.unfinishedBusiness)) {
    const items: unknown[] = value.unfinishedBusiness;
    const kept: unknown[] = [];
    const dropped: RuleFailure[] = [];
    items.forEach((item, i) => {
      const base = `unfinishedBusiness[${i}]`;
      const result = businessItemSchema.safeParse(item);
      if (!result.success) {
        for (const f of ruleFailuresFromIssues(result.error.issues)) {
          dropped.push({ code: f.code, path: f.path === "(root)" ? base : `${base}.${f.path}` });
        }
        return;
      }
      if (!isGroundedEvidence(result.data.evidence, d)) {
        dropped.push({ code: "evidence-not-grounded", path: `${base}.evidence` });
        return;
      }
      if (kept.length >= REPAIR_ITEMS_MAX) {
        dropped.push({ code: "length", path: base });
        return;
      }
      kept.push(result.data);
    });
    if (items.length > 0 && kept.length === 0) {
      rejected.push(...dropped);
      value.unfinishedBusiness = [];
    } else if (dropped.length > 0) {
      repaired.push(...dropped);
      value.unfinishedBusiness = kept;
    }
  }

  return { value, repaired, rejected };
}