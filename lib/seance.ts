/**
 * Séance evidence: derivation, marker neutralisation, UTF-8 truncation and
 * grounding validation. Pure; no I/O, no server-only imports.
 *
 * `deriveEvidence` produces the model-facing text and the validation corpus in
 * one pass so the two cannot drift apart.
 */

import type { RepoFacts } from "./lifecycle";
import type { SeanceResult } from "./seance-schema";

/** Delimiters wrapping Untrusted_Text in the prompt. lib/ai.ts imports these. */
export const OPEN_MARKER = "<<<EVIDENCE>>>";
export const CLOSE_MARKER = "<<<END_EVIDENCE>>>";

const MARKER_REPLACEMENT = "[delimiter removed]";
const MAX_LINE_CHARS = 200;
const MIN_EVIDENCE_CHARS = 8;
export const MAX_README_BYTES = 8192;

export interface EvidencePack {
  /** Unmodified; pushedAt is the server-held value. */
  facts: RepoFacts;
  /** Already truncated to <= 8192 bytes; null when there is no README. */
  readme: string | null;
  /** Newest first, at most 5. */
  commits: string[];
}

/** A numbered evidence line; label is "F1", "C2", ... */
export interface FactLine {
  label: string;
  text: string;
}

export interface DerivedEvidence {
  /** [F#] lines followed by [C#] lines. */
  factLines: FactLine[];
  /** README after marker neutralisation, or null. */
  readmeText: string | null;
  /** Commit texts after whitespace collapse and marker neutralisation. */
  commitTexts: string[];
  evidenceText: string;
}

/** Replaces every delimiter occurrence, repeating until none remain. */
export function neutralizeMarkers(text: string): string {
  let current = text;
  // Each pass strictly removes at least one marker; the replacement contains none.
  while (current.includes(OPEN_MARKER) || current.includes(CLOSE_MARKER)) {
    current = current
      .split(OPEN_MARKER)
      .join(MARKER_REPLACEMENT)
      .split(CLOSE_MARKER)
      .join(MARKER_REPLACEMENT);
  }
  return current;
}

/** Longest prefix of `text` whose UTF-8 encoding fits in `maxBytes`; never splits a code point. */
export function truncateUtf8(text: string, maxBytes: number = MAX_README_BYTES): string {
  let bytes = 0;
  let end = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    // A lone surrogate encodes as U+FFFD (3 bytes) in TextEncoder.
    const size =
      cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (bytes + size > maxBytes) break;
    bytes += size;
    end += ch.length;
  }
  return text.slice(0, end);
}

const collapse = (s: string): string => s.replace(/\s+/g, " ").trim();

function clip(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join("");
}

/** Collapse whitespace, neutralise markers, then cap at 200 characters. */
function cleanLine(s: string): string {
  return clip(neutralizeMarkers(collapse(s)), MAX_LINE_CHARS);
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Renders the model-facing evidence text in the fixed [F#], [C#], [R] order. */
export function renderEvidenceText(
  d: Pick<DerivedEvidence, "factLines" | "readmeText">,
): string {
  const lines = d.factLines.map((f) => `[${f.label}] ${f.text}`);
  if (d.readmeText !== null) {
    lines.push("[R] README excerpt", d.readmeText);
  }
  return lines.join("\n");
}

export function deriveEvidence(pack: EvidencePack): DerivedEvidence {
  const f = pack.facts;
  const raw: string[] = [];
  if (f.primaryLanguage) raw.push(`language: ${f.primaryLanguage}`);
  raw.push(`stars: ${f.stargazerCount}`);
  raw.push(`forks: ${f.forkCount}`);
  raw.push(`open issues: ${f.openIssueCount}`);
  raw.push(`releases: ${f.releaseCount}`);
  raw.push(`archived: ${f.isArchived ? "yes" : "no"}`);
  raw.push(f.readmeBytes === null ? "readme: none" : `readme: ${f.readmeBytes} bytes`);
  if (f.pushedAt) raw.push(`last push: ${f.pushedAt.slice(0, 10)}`);
  if (f.createdAt) raw.push(`created: ${f.createdAt.slice(0, 10)}`);
  if (f.topics.length > 0) raw.push(`topics: ${f.topics.join(", ")}`);
  if (f.homepageUrl) raw.push(`homepage: ${f.homepageUrl}`);
  if (f.description) raw.push(`description: ${f.description}`);
  if (f.lastCommitMessage) raw.push(`last commit: ${f.lastCommitMessage}`);

  const factLines: FactLine[] = [];
  for (const r of raw) {
    const text = cleanLine(r);
    if (text.length === 0) continue;
    factLines.push({ label: `F${factLines.length + 1}`, text });
  }

  const commitTexts: string[] = [];
  for (const c of pack.commits.slice(0, 5)) {
    const text = cleanLine(c);
    if (collapse(c).length === 0) continue;
    commitTexts.push(text);
    factLines.push({ label: `C${commitTexts.length}`, text: `commit: ${text}` });
  }

  const readmeText = pack.readme === null ? null : neutralizeMarkers(pack.readme);
  const partial = { factLines, readmeText };
  return { factLines, readmeText, commitTexts, evidenceText: renderEvidenceText(partial) };
}

/**
 * True when `evidence` equals a Fact_Line text (after norm) or occurs
 * verbatim (after norm) in the README or one commit message. Needs >= 8 chars.
 */
export function isGroundedEvidence(evidence: string, d: DerivedEvidence): boolean {
  const e = norm(evidence);
  if (e.length < MIN_EVIDENCE_CHARS) return false;
  if (d.factLines.some((fl) => norm(fl.text) === e)) return true;
  const sources: string[] = [];
  if (d.readmeText !== null) sources.push(norm(d.readmeText));
  for (const c of d.commitTexts) sources.push(norm(c));
  return sources.some((s) => s.includes(e));
}

export function validateGrounding(
  r: SeanceResult,
  d: DerivedEvidence,
): { ok: true } | { ok: false; reason: "evidence-not-grounded" } {
  for (const item of r.unfinishedBusiness) {
    if (!isGroundedEvidence(item.evidence, d)) {
      return { ok: false, reason: "evidence-not-grounded" };
    }
  }
  return { ok: true };
}
