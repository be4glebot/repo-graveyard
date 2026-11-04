/**
 * Per-device override storage, backed by localStorage.
 *
 * This module is CLIENT ONLY. It must NOT import `server-only`, and it must
 * never be imported from a server module — an ESLint `no-restricted-imports`
 * rule enforces that boundary mechanically (Req 6.7).
 *
 * Every storage access is wrapped in try/catch so that a missing or throwing
 * `localStorage` (private mode, disabled storage, quota errors) can never crash
 * the application. Reads validate the stored JSON with a zod schema; anything
 * malformed yields an empty map. A missing/empty username yields an empty map
 * on read and is a no-op on write.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { z } from "zod";
import type { Override, OverrideType } from "./lifecycle";

/** A map of repo name to its single override entry (at most one per name). */
export type OverrideMap = Record<string, Override>;

/**
 * The subset of the DOM `Storage` interface this module uses. Defaults to
 * `window.localStorage`; tests inject in-memory fakes.
 */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const KEY_PREFIX = "repo-graveyard-overrides:";

/** The override types, kept in sync with `OverrideType` from lifecycle. */
const OVERRIDE_TYPES = ["finished", "scrapped", "revived"] as const satisfies readonly OverrideType[];

/** Validates a parsed override map; invalid data is rejected wholesale. */
const overrideMapSchema = z.record(
  z.string(),
  z.object({
    type: z.enum(OVERRIDE_TYPES),
    setAt: z.string(),
  }),
);

/**
 * Returns the localStorage key for a username's overrides:
 * `repo-graveyard-overrides:{lowercased-username}`.
 */
export function overridesKey(username: string): string {
  return `${KEY_PREFIX}${username.toLowerCase()}`;
}

/**
 * Resolves the storage to use. Returns `null` when no storage is available
 * (e.g. server-side rendering, or `window` is undefined), so callers degrade
 * gracefully instead of throwing.
 */
function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Accessing window.localStorage can throw (e.g. blocked cookies).
  }
  return null;
}

/**
 * Reads the override map for `username`. Returns `{}` for a missing/empty
 * username, unavailable storage, storage errors, or malformed/invalid data.
 */
export function readOverrides(
  username: string | null | undefined,
  storage?: StorageLike,
): OverrideMap {
  if (!username) return {};

  const store = resolveStorage(storage);
  if (!store) return {};

  let raw: string | null;
  try {
    raw = store.getItem(overridesKey(username));
  } catch {
    return {};
  }
  if (raw === null) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  const result = overrideMapSchema.safeParse(parsed);
  return result.success ? result.data : {};
}

/**
 * Writes a single override for `repoName` under `username`, replacing any
 * existing entry for that repo name (at most one entry per name). A
 * missing/empty username or unavailable/throwing storage is a silent no-op.
 */
export function writeOverride(
  username: string | null | undefined,
  repoName: string,
  override: Override,
  storage?: StorageLike,
): void {
  if (!username) return;

  const store = resolveStorage(storage);
  if (!store) return;

  const current = readOverrides(username, store);
  const next: OverrideMap = { ...current, [repoName]: override };

  try {
    store.setItem(overridesKey(username), JSON.stringify(next));
  } catch {
    // Quota or serialization errors are silently discarded (Req 6.5).
  }
}
