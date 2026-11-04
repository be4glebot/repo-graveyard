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
