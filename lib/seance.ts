/**
 * Séance evidence: derivation, marker neutralisation, UTF-8 truncation and
 * grounding validation. Pure; no I/O, no server-only imports.
 *
 * `deriveEvidence` produces the model-facing text and the validation corpus in
 * one pass so the two cannot drift apart.
 */

import type { RepoFacts } from "./lifecycle";
import { mentionsMemoryFaded } from "./seance-schema";
import type { RuleFailure, SeanceResult } from "./seance-schema";

/** Delimiters wrapping Untrusted_Text in the prompt. lib/ai.ts imports these. */
export const OPEN_MARKER = "<<<EVIDENCE>>>";
export const CLOSE_MARKER = "<<<END_EVIDENCE>>>";

const MARKER_REPLACEMENT = "[delimiter removed]";
const MAX_LINE_CHARS = 200;
const MIN_EVIDENCE_CHARS = 8;
/** A README or commit quote must carry at least this much (Fact_Line copies are exempt). */
export const MIN_QUOTE_CHARS = 12;
/** A quote taken from the README or a commit message may be at most this long. */
export const MAX_QUOTE_CHARS = 80;
/** A README at or above this size counts as "rich" when sizing the ledger. */
export const SHORT_README_CHARS = 600;
export const MAX_README_BYTES = 8192;

export interface EvidencePack {
  /** Unmodified; pushedAt is the server-held value. */
  facts: RepoFacts;
  /** Already truncated to <= 8192 bytes; null when there is no README. */
  readme: string | null;
  /** Newest first, at most 5. */
  commits: string[];
  /** Repo owner; with the repo name it forms the names that are not valid evidence on their own. */
  owner?: string;
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
  /** Repo name, owner and "owner/repo": never valid evidence by themselves. */
  names?: string[];
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

/**
 * Removes markdown and HTML syntax from README text so quoted evidence reads as
 * plain words: code fences, comments, images, links (keeping the link text),
 * reference definitions, HTML tags, headings, blockquote and list markers,
 * rules, emphasis, strikethrough and inline-code backticks. Whitespace is
 * collapsed to single spaces. Pure; contents of code blocks are kept.
 */
export function stripMarkdown(text: string): string {
  let s = text.replace(/\r\n?/g, "\n");
  s = s.replace(/^[ \t]*(?:`{3,}|~{3,}).*$/gm, ""); // code fence lines
  s = s.replace(/<!--[\s\S]*?-->/g, ""); // HTML comments
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ""); // images
  s = s.replace(/!\[[^\]]*\]\[[^\]]*\]/g, ""); // reference images
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1"); // [text][ref] -> text
  s = s.replace(/^[ \t]*\[[^\]]+\]:[ \t]+\S.*$/gm, ""); // reference definitions
  s = s.replace(/<\/?[A-Za-z][^<>]*>/g, " "); // HTML tags
  s = s.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, ""); // headings
  s = s.replace(/^[ \t]*(?:[=-]{3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})[ \t]*$/gm, ""); // rules, setext underlines
  s = s.replace(/^[ \t]{0,3}>[ \t]?/gm, ""); // blockquotes
  s = s.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, ""); // list markers, task boxes
  s = s.replace(/(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/g, "$2"); // bold
  s = s.replace(/\*(?=\S)([^*]+?)(?<=\S)\*/g, "$1"); // *italic*
  s = s.replace(/(?<![A-Za-z0-9])_(?=\S)([^_]+?)(?<=\S)_(?![A-Za-z0-9])/g, "$1"); // _italic_, not snake_case
  s = s.replace(/~~/g, ""); // strikethrough
  s = s.replace(/`+/g, ""); // inline code
  s = s.replace(/\*{2,}/g, ""); // leftover bold markers
  return collapse(s);
}

function clip(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join("");
}

/** Collapse whitespace, neutralise markers, then cap at 200 characters. */
function cleanLine(s: string): string {
  return clip(neutralizeMarkers(collapse(s)), MAX_LINE_CHARS);
}

/**
 * Forgiving form used to compare evidence with its source. Applied to both
 * sides: curly quotes and dashes become ASCII, markdown symbols
 * (` * _ # > [ ] ( )) are removed, case is folded and whitespace is collapsed.
 */
export function normalizeForMatch(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[`*_#>\[\]()]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
const norm = normalizeForMatch;

const compact = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** True when the text is only a repo name, an owner name, or "owner/repo" (or has no letters at all). */
function isBareName(e: string, d: Pick<DerivedEvidence, "names">): boolean {
  const c = compact(e);
  if (c === "") return true;
  return (d.names ?? []).some((n) => compact(n) === c);
}

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

  // Strip markdown first, then neutralise: removing tags could rebuild a marker.
  // The same cleaned text feeds the prompt and the grounding corpus.
  const cleanedReadme = pack.readme === null ? "" : stripMarkdown(pack.readme);
  const readmeText = cleanedReadme === "" ? null : neutralizeMarkers(cleanedReadme);
  const partial = { factLines, readmeText };
  const names = [f.name, pack.owner, pack.owner ? `${pack.owner}/${f.name}` : undefined].filter(
    (n): n is string => typeof n === "string" && n.length > 0,
  );
  return {
    factLines,
    readmeText,
    commitTexts,
    evidenceText: renderEvidenceText(partial),
    names,
  };
}

/**
 * True when `evidence` equals a Fact_Line text (after norm) or occurs
 * verbatim (after norm) in the README or one commit message. Needs >= 8 chars.
 */
export function isGroundedEvidence(evidence: string, d: DerivedEvidence): boolean {
  const e = norm(evidence);
  if (e.length < MIN_EVIDENCE_CHARS) return false;
  // The repo name or owner name on its own says nothing.
  if (isBareName(e, d)) return false;
  if (d.factLines.some((fl) => norm(fl.text) === e)) return true;
  // Outside an exact Fact_Line, a quote must carry real information.
  if (Array.from(e).length < MIN_QUOTE_CHARS) return false;
  // A README/commit quote must stay short (counted in code points).
  if (Array.from(e).length > MAX_QUOTE_CHARS) return false;
  const sources: string[] = [];
  if (d.readmeText !== null) sources.push(norm(d.readmeText));
  for (const c of d.commitTexts) sources.push(norm(c));
  return sources.some((s) => s.includes(e));
}

/**
 * How many unfinished-business items the ledger should hold. Small repos (at
 * most 3 informative evidence lines and a short or absent README) get exactly
 * 2; richer ones get 2 to 4.
 *
 * "Informative" counts commit lines plus the description, topics and homepage
 * lines. The always-present counters (stars, forks, issues, releases, archived,
 * readme size) and the dates are excluded, and so is the "last commit" fact
 * line, which repeats the newest commit.
 */
export function businessItemBudget(d: DerivedEvidence): { min: number; max: number } {
  const informative = d.factLines.filter(
    (f) => f.label.startsWith("C") || /^(?:description|topics|homepage):/.test(f.text),
  ).length;
  const readmeLength = d.readmeText === null ? 0 : d.readmeText.trim().length;
  const small = informative <= 3 && readmeLength < SHORT_README_CHARS;
  return { min: 2, max: small ? 2 : 4 };
}

/**
 * Every rule that needs the evidence, as codes and paths only: ungrounded or
 * uninformative `evidence`, and the faded-memory sentence used as the cause
 * line while a README or commits exist (it is for missing evidence only).
 */
export function groundingFailures(r: SeanceResult, d: DerivedEvidence): RuleFailure[] {
  const out: RuleFailure[] = [];
  r.unfinishedBusiness.forEach((item, i) => {
    if (!isGroundedEvidence(item.evidence, d)) {
      out.push({ code: "evidence-not-grounded", path: `unfinishedBusiness[${i}].evidence` });
    }
  });
  const evidenceMissing = d.readmeText === null && d.commitTexts.length === 0;
  if (!evidenceMissing && mentionsMemoryFaded(r.causeOfDeath)) {
    out.push({ code: "memory-faded", path: "causeOfDeath" });
  }
  return out;
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
