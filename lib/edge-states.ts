/**
 * Pure copy and helpers for the themed edge states (not-found, rate-limited,
 * server-error, empty graveyard, app 404) and the loading page.
 *
 * No I/O, no clock: "now" is always a parameter. Copy is static, kind and
 * never blaming, and contains no digits (no hard-coded dates or day counts).
 */

export type EdgeKind =
  | "not-found"
  | "rate-limited"
  | "server-error"
  | "empty"
  | "app-not-found";

export interface EdgeCopy {
  heading: string;
  body: string;
}

const EDGE_COPY: Readonly<Record<EdgeKind, EdgeCopy>> = {
  "not-found": {
    heading: "No one by that name rests here",
    body: "We searched every plot and found no graveyard under that name. Check the spelling, or walk the Haunted Estate instead.",
  },
  "rate-limited": {
    heading: "The gates are locked for now",
    body: "GitHub needs the spirits to rest. The Haunted Estate is always open.",
  },
  "server-error": {
    heading: "The spirits lost the thread",
    body: "Something went wrong while digging, and it was not your doing. Try again, or walk the Haunted Estate.",
  },
  empty: {
    heading: "Nothing buried here yet.",
    body: "The moon keeps watch over an empty cemetery.",
  },
  "app-not-found": {
    heading: "This path leads nowhere",
    body: "Whatever stood here has crumbled away. Return to the gate and try another way in.",
  },
};

/** Static heading and body for an edge state. */
export function edgeCopy(kind: EdgeKind): EdgeCopy {
  return EDGE_COPY[kind];
}

/** The line shown under the empty-graveyard heading; includes the owner's name. */
export function emptyGraveyardLine(username: string): string {
  return `${username} has no public repositories to bury. The moon keeps watch anyway.`;
}

/**
 * Whole minutes until a rate-limit reset, rounded up, minimum 1.
 * `undefined` when the reset time is unknown or either instant is unparseable.
 */
export function resetInMinutes(
  resetAt: string | null,
  nowIso: string,
): number | undefined {
  if (resetAt === null) return undefined;
  const resetMs = Date.parse(resetAt);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(resetMs) || Number.isNaN(nowMs)) return undefined;
  const minutes = Math.ceil((resetMs - nowMs) / 60_000);
  return Math.max(1, minutes);
}

/** Longest username (in code points) shown on the loading page. */
export const LOADING_NAME_MAX = 39;
export const LOADING_GENERIC = "Digging up this graveyard…";

/**
 * Loading status text. URL-decodes `raw` (failures fall back to the generic
 * line), truncates by code points to LOADING_NAME_MAX and appends an ellipsis
 * only when truncated. Output is plain text; the caller renders it escaped.
 */
export function loadingLabel(raw: string | undefined): string {
  if (raw === undefined || raw === "") return LOADING_GENERIC;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return LOADING_GENERIC;
  }
  if (decoded === "") return LOADING_GENERIC;
  const points = Array.from(decoded);
  const name =
    points.length > LOADING_NAME_MAX
      ? `${points.slice(0, LOADING_NAME_MAX).join("")}…`
      : decoded;
  return `Digging up ${name}'s graveyard…`;
}

/**
 * Raw (still encoded) username segment from "/g/<seg>[/...]", or undefined
 * when the path is not a graveyard path or the segment is empty.
 */
export function usernameFromPath(pathname: string): string | undefined {
  const match = /^\/g\/([^/?#]+)(?:\/|$)/.exec(pathname);
  return match ? match[1] : undefined;
}
