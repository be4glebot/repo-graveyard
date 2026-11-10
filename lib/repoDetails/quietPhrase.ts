/**
 * Quiet_Phrase formatter (Requirements 11.1-11.4, 11.8).
 *
 * Pure and total: reads no clock, performs no I/O, and never throws or
 * returns NaN/undefined. Reuses the ISO-parse + `msPerDay` discipline from
 * `lib/lifecycle.ts`: whole days are `floor(ms / msPerDay)`.
 */

import { LIFECYCLE_CONFIG } from "../lifecycle";

/** Fixed phrase used when neither timestamp is usable (Req 11.3). */
export const QUIET_FALLBACK_PHRASE = "quiet for an unknown age";

/** Phrase for a zero (or clamped-negative) duration, below one month (Req 11.4). */
export const QUIET_ZERO_PHRASE = "quiet for less than a month";

const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;

/** Parses an ISO 8601 string to epoch ms; null when absent or unparseable. */
function parseMs(value: string | null | undefined): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/**
 * Human-readable "quiet for ..." phrase relative to `renderedAt`. Uses
 * `pushedAt` when usable, else `createdAt`. Returns a fixed fallback when no
 * reference timestamp (or `renderedAt`) is usable, and clamps future
 * timestamps to the zero-duration phrase.
 */
export function quietPhrase(
  ts: { pushedAt: string | null; createdAt: string | null },
  renderedAt: string,
): string {
  const nowMs = parseMs(renderedAt);
  const baseMs = parseMs(ts?.pushedAt) ?? parseMs(ts?.createdAt);
  if (nowMs === null || baseMs === null) {
    return QUIET_FALLBACK_PHRASE;
  }

  const rawDays = Math.floor((nowMs - baseMs) / LIFECYCLE_CONFIG.msPerDay);
  const days = rawDays > 0 && Number.isFinite(rawDays) ? rawDays : 0;

  const years = Math.floor(days / DAYS_PER_YEAR);
  const months = Math.floor((days % DAYS_PER_YEAR) / DAYS_PER_MONTH);

  const parts: string[] = [];
  if (years > 0) {
    parts.push(plural(years, "year"));
  }
  if (months > 0) {
    parts.push(plural(months, "month"));
  }
  return parts.length === 0 ? QUIET_ZERO_PHRASE : `quiet for ${parts.join(" ")}`;
}
