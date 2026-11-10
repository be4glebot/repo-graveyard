import type { BusinessItem, SeanceResult, Verdict } from "./seance-schema";

export interface VerdictCopy {
  /** Verdict printed in words on the card (never colour alone). */
  word: string;
  headline: string;
  /** Value of `data-treatment` on the VerdictCard. */
  treatment: "cold-light" | "candlelit" | "crimson-chains";
  /** Colour token name from app/globals.css (without the `--color-` prefix). */
  accentToken: "ghost-300" | "candle-400" | "crimson-200";
}

export const VERDICT_COPY: Record<Verdict, VerdictCopy> = {
  revive: {
    word: "Revive",
    headline: "It wants to live.",
    treatment: "cold-light",
    accentToken: "ghost-300",
  },
  finish: {
    word: "Finish",
    headline: "Laid to rest with honour.",
    treatment: "candlelit",
    accentToken: "candle-400",
  },
  seal: {
    word: "Seal",
    headline: "Sealed away. Letting go is a decision too.",
    treatment: "crimson-chains",
    accentToken: "crimson-200",
  },
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isVerdict(value: unknown): value is Verdict {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(VERDICT_COPY, value)
  );
}

/**
 * Plain-text transcript of a séance: voice, cause of death, numbered
 * unfinished business, then the verdict. Empty or absent fields are omitted.
 * Adds only newlines and "N." numbering.
 */
export function buildTranscriptText(result: Partial<SeanceResult>): string {
  const blocks: string[] = [];

  const voice = clean(result?.voice);
  if (voice) blocks.push(voice);

  const cause = clean(result?.causeOfDeath);
  if (cause) blocks.push(cause);

  const items: unknown[] = Array.isArray(result?.unfinishedBusiness)
    ? result.unfinishedBusiness
    : [];
  let n = 0;
  for (const raw of items) {
    if (raw === null || typeof raw !== "object") continue;
    const item = raw as Partial<BusinessItem>;
    const title = clean(item.title);
    const detail = clean(item.detail);
    const evidence = clean(item.evidence);
    if (!title && !detail && !evidence) continue;
    n += 1;
    const lines: string[] = [];
    if (title) lines.push(`${n}. ${title}`);
    else lines.push(`${n}.`);
    if (detail) lines.push(detail);
    if (evidence) lines.push(evidence);
    blocks.push(lines.join("\n"));
  }

  const reason = clean(result?.verdictReason);
  const verdictLines: string[] = [];
  if (isVerdict(result?.verdict)) {
    verdictLines.push(`Verdict: ${VERDICT_COPY[result.verdict].word}`);
  }
  if (reason) verdictLines.push(reason);
  if (verdictLines.length > 0) blocks.push(verdictLines.join("\n"));

  return blocks.join("\n\n");
}
