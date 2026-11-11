import { DATA_NOTICE, buildKiroPrompt, buildReviveBrief, sanitiseInline } from "@/lib/revive-brief";
import type { SeanceResult } from "@/lib/seance-schema";
import type { GraveyardPayload, RepoEntry, State } from "./payload";

/** Same shape as the client's Outcome; kept local so format.ts has no client dependency. */
export type FormatOutcome<T> = { ok: true; value: T } | { ok: false; text: string };

export type Sanitiser = (s: string) => string;

/** The only headings the server ever emits. */
export const HEADINGS = {
  graveyard: "# Graveyard",
  grave: "# Grave",
  seance: "# Séance",
  revival: "# Revival brief",
} as const;

export const UNEXPECTED_TEXT = "The app returned unexpected text.";

const DAY_MS = 86_400_000;

const GHOST_LABELS = ["healthy", "fading", "flickering", "about to turn"] as const;
const ZOMBIE_LABELS = ["fresh", "rotting", "decayed", "skeletal", "ancient"] as const;

/** Decay label for a state and level; total, `none` for anything else. */
export function decayLabel(state: State, decay: number | null): string {
  if (typeof decay !== "number" || !Number.isInteger(decay) || decay < 0) return "none";
  if (state === "ghost") return GHOST_LABELS[decay] ?? "none";
  if (state === "zombie") return ZOMBIE_LABELS[decay] ?? "none";
  return "none";
}

/** Whole days since the last push, never negative; null when unknown. */
export function daysQuiet(pushedAt: string | null, nowMs: number): number | null {
  if (pushedAt === null) return null;
  const ms = Date.parse(pushedAt);
  if (!Number.isFinite(ms) || !Number.isFinite(nowMs)) return null;
  return Math.max(0, Math.floor((nowMs - ms) / DAY_MS));
}

function asciiLower(s: string): string {
  return s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

/** ASCII-only case-insensitive lookup; first match in payload order. */
export function findRepo(p: GraveyardPayload, repo: string): RepoEntry | undefined {
  const want = asciiLower(repo);
  return p.repos.find((e) => asciiLower(e.name) === want);
}

/** Backtick fence longer than any backtick run in the text (minimum 3). */
export function fenceFor(text: string): string {
  let longest = 0;
  for (const run of text.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  return "`".repeat(Math.max(3, longest + 1));
}

const NOTICE_COLLAPSED = DATA_NOTICE.replace(/\s+/g, " ").toLowerCase();

/** False when a sanitised value could still act as markdown structure or carry the notice. */
export function isInert(value: string): boolean {
  if (value.replace(/\s+/g, " ").toLowerCase().includes(NOTICE_COLLAPSED)) return false;
  for (const line of value.split(/\r\n|[\n\r\u2028\u2029\u0085\v\f]/)) {
    if (/^ {0,3}#{1,6}(\s|$)/.test(line)) return false;
    if (/^ {0,3}(=+|-+)\s*$/.test(line)) return false;
    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) return false;
    if (/^ {0,3}>/.test(line)) return false;
  }
  return true;
}

function fmtDays(n: number | null): string {
  return n === null ? "unknown days quiet" : `${n} days quiet`;
}

export function formatList(
  p: GraveyardPayload,
  nowMs: number,
  sanitise: Sanitiser = sanitiseInline,
): { head: string[]; body: string[] } {
  const c = p.counts;
  const head: string[] = [
    HEADINGS.graveyard,
    `Owner: ${sanitise(p.owner)}`,
    `Counts: ghost ${c.ghost}, risen ${c.risen}, zombie ${c.zombie}, tombstone ${c.tombstone}, coffin ${c.coffin}, total ${c.total}`,
  ];
  if (p.truncated) head.push("Only the 300 most recently pushed repositories are listed.");
  if (p.repos.length === 0) head.push("The graveyard is empty.");
  const body = p.repos.map(
    (e) =>
      `${sanitise(e.name)} | ${e.state} | ${decayLabel(e.state, e.decay)} | ${fmtDays(
        daysQuiet(e.pushedAt, nowMs),
      )} | ${e.stars} stars`,
  );
  return { head, body };
}

export function formatGrave(
  e: RepoEntry,
  nowMs: number,
  sanitise: Sanitiser = sanitiseInline,
): string[] {
  const days = daysQuiet(e.pushedAt, nowMs);
  return [
    HEADINGS.grave,
    `Name: ${sanitise(e.name)}`,
    `State: ${e.state}`,
    `Decay: ${decayLabel(e.state, e.decay)}`,
    `Last push: ${e.pushedAt === null ? "never" : sanitise(e.pushedAt)}`,
    `Days quiet: ${days === null ? "unknown" : days}`,
    `Stars: ${e.stars}`,
    `URL: ${sanitise(e.html_url)}`,
  ];
}

const OTHER_TEXT = {
  veil: "The ghost could not be summoned right now: the séance is resting (a limit or budget was reached). Try again later.",
  weak: "This repo has too little history for the ghost to say anything grounded.",
  silent: "The ghost stayed silent. Try again.",
} as const;

export function formatSeanceOther(
  kind: "veil" | "weak" | "silent",
  heading: "seance" | "revival" = "seance",
): string[] {
  return [HEADINGS[heading], OTHER_TEXT[kind]];
}

const unexpected = (): { ok: false; text: string } => ({ ok: false, text: UNEXPECTED_TEXT });

export function formatSeanceOk(
  r: SeanceResult,
  owner: string,
  repo: string,
  sanitise: Sanitiser = sanitiseInline,
): FormatOutcome<string[]> {
  const voice = sanitise(r.voice);
  const cause = sanitise(r.causeOfDeath);
  const reason = sanitise(r.verdictReason);
  const items = r.unfinishedBusiness.map((i) => ({
    title: sanitise(i.title),
    detail: sanitise(i.detail),
    evidence: sanitise(i.evidence),
  }));
  const values = [voice, cause, reason, ...items.flatMap((i) => [i.title, i.detail, i.evidence])];
  if (!values.every(isInert)) return unexpected();
  return {
    ok: true,
    value: [
      HEADINGS.seance,
      DATA_NOTICE,
      `Repository: ${owner}/${repo}`,
      `Voice: ${voice}`,
      `Cause of death: ${cause}`,
      "Unfinished business:",
      ...items.map((i) => `- Title: ${i.title} | Detail: ${i.detail} | Evidence: ${i.evidence}`),
      `Verdict: ${r.verdict}`,
      `Verdict reason: ${reason}`,
    ],
  };
}

export function formatBriefOk(
  r: SeanceResult,
  owner: string,
  repo: string,
  state: State,
  sanitise: Sanitiser = sanitiseInline,
): FormatOutcome<string[]> {
  if (r.verdict !== "revive") {
    const reason = sanitise(r.verdictReason);
    if (!isInert(reason)) return unexpected();
    return {
      ok: true,
      value: [
        HEADINGS.revival,
        DATA_NOTICE,
        `Verdict: ${r.verdict}`,
        `Verdict reason: ${reason}`,
        `No revival brief is produced for a ${r.verdict} verdict.`,
      ],
    };
  }
  const facts = { owner, repo, state };
  const brief = buildReviveBrief(r, facts);
  const prompt = buildKiroPrompt(r, facts);
  const briefFence = fenceFor(brief);
  const promptFence = fenceFor(prompt);
  return {
    ok: true,
    value: [
      HEADINGS.revival,
      DATA_NOTICE,
      `Repository: ${owner}/${repo}`,
      "REVIVAL.md",
      `${briefFence}markdown`,
      brief,
      briefFence,
      "Kiro prompt",
      promptFence,
      prompt,
      promptFence,
    ],
  };
}
