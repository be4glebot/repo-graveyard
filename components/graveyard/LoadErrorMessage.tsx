/**
 * Presentational error renderer for the graveyard page.
 *
 * Maps every variant of the shared `LoadError` discriminated union onto
 * user-facing copy via an exhaustive `switch` on `error.kind`. The `default`
 * case assigns `error` to a `never`-typed binding, so adding a new `LoadError`
 * variant without handling it here is a compile-time error (Req 8.3, 8.4, 8.7,
 * 8.8).
 *
 * This component has no interactivity and reads no client-only APIs, so it is a
 * shared/server presentational component and intentionally omits `"use client"`.
 * `resetAt` is rendered deterministically (a UTC-derived string) to keep server
 * and client HTML identical.
 *
 * `LoadError` is imported from `@/lib/github`, the canonical definition; the
 * loader re-exports the same type.
 */

import type { LoadError } from "@/lib/github";

interface LoadErrorMessageProps {
  error: LoadError;
}

/** Copy for a username that is well-formed but absent on GitHub (Req 8.3). */
const NOT_FOUND_MESSAGE =
  "That username does not exist on GitHub. Check the spelling and try again.";

/** Copy for a malformed username that never reaches GitHub (Req 8.8). */
const INVALID_USERNAME_MESSAGE =
  "That doesn't look like a valid GitHub username. Use 1-39 letters, digits, or hyphens, with no leading or trailing hyphen.";

/** Copy for any non-not-found, non-rate-limit failure (Req 8.7). */
const SERVER_ERROR_MESSAGE =
  "The repository data could not be loaded. Please try again later.";

/** Fallback rate-limit copy when no reset time is available (Req 8.4). */
const RATE_LIMITED_NO_RESET_MESSAGE =
  "GitHub's rate limit has been reached. Please try again later.";

/**
 * Formats a rate-limit `resetAt` ISO timestamp into a deterministic, readable
 * UTC string. Returns `null` for an absent or unparseable value so the caller
 * can fall back to the generic wait message.
 */
function formatResetAt(resetAt: string): string | null {
  const parsed = new Date(resetAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  // UTC-based formatting keeps server and client HTML identical (no hydration
  // mismatch from the viewer's local timezone).
  return `${parsed.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")} UTC`;
}

/** Builds the rate-limit message, including the reset time when available (Req 8.4). */
function rateLimitedMessage(resetAt: string | null): string {
  if (resetAt === null) {
    return RATE_LIMITED_NO_RESET_MESSAGE;
  }
  const formatted = formatResetAt(resetAt);
  if (formatted === null) {
    return RATE_LIMITED_NO_RESET_MESSAGE;
  }
  return `GitHub's rate limit has been reached. Try again after ${formatted}.`;
}

/**
 * Resolves a `LoadError` to its display message. Exhaustive over `LoadError`;
 * the `default` branch is unreachable and exists only to enforce exhaustiveness
 * at compile time.
 */
function messageFor(error: LoadError): string {
  switch (error.kind) {
    case "not-found":
      return NOT_FOUND_MESSAGE;
    case "rate-limited":
      return rateLimitedMessage(error.resetAt);
    case "invalid-username":
      return INVALID_USERNAME_MESSAGE;
    case "server-error":
      return SERVER_ERROR_MESSAGE;
    default: {
      // Exhaustiveness guard: if a new `LoadError` variant is added without a
      // case above, this assignment fails to type-check.
      const _exhaustive: never = error;
      return _exhaustive;
    }
  }
}

/**
 * Renders the error copy for a failed graveyard load. Uses theme tokens only
 * (no hardcoded hex): foreground opacity for text and the standard error color.
 */
export default function LoadErrorMessage({ error }: LoadErrorMessageProps) {
  return (
    <p
      role="alert"
      className="text-base text-red-600 dark:text-red-400"
    >
      {messageFor(error)}
    </p>
  );
}
