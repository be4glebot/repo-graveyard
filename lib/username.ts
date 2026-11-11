/**
 * Pure username validation and normalization.
 *
 * This module is shared by the loader (`lib/graveyard-loader.ts`), the
 * graveyard page, and the landing form, so it must stay dependency-free: no
 * I/O, no `server-only` import, no React.
 *
 * Requirements: 1.4, 8.8, 9.1, 9.5
 */

/** Maximum GitHub username length. */
export const USERNAME_MAX_LENGTH = 39;

/**
 * Matches a valid GitHub-style username body: alphanumeric or hyphen, with no
 * leading or trailing hyphen. A single character must be alphanumeric.
 * Consecutive hyphens are permitted.
 */
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

/**
 * Returns true iff `input` is a valid username: length 1-39 AND it matches the
 * username pattern. The input is NOT trimmed — untrimmed whitespace is invalid.
 * The landing page decides whether to trim before calling this.
 */
export function isValidUsername(input: string): boolean {
  return (
    input.length >= 1 &&
    input.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(input)
  );
}

/** Lowercases the input (used to derive case-insensitive keys). */
export function normalizeUsername(input: string): string {
  return input.toLowerCase();
}

/** Message shown when the landing/visit form is submitted empty. */
export const USERNAME_EMPTY_MESSAGE = "A username is required";

/** Message shown when the trimmed input is not a valid GitHub username. */
export const USERNAME_INVALID_MESSAGE =
  "That doesn't look like a valid GitHub username";

export type UsernameCheck =
  | { ok: true; username: string }
  | { ok: false; message: string };

/**
 * Validates raw form input: trims first, then checks emptiness, then
 * `isValidUsername`. On success returns the trimmed username.
 *
 * Requirements: 2.2, 2.3, 2.4
 */
export function validateUsernameInput(raw: string): UsernameCheck {
  const username = raw.trim();
  if (username.length === 0) {
    return { ok: false, message: USERNAME_EMPTY_MESSAGE };
  }
  if (!isValidUsername(username)) {
    return { ok: false, message: USERNAME_INVALID_MESSAGE };
  }
  return { ok: true, username };
}
