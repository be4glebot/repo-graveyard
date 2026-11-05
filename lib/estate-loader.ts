/**
 * Estate fixture loader (server only).
 *
 * The `/estate` route is a self-contained sample graveyard that never touches
 * GitHub: its data is the bundled fixture `data/estate.json`. `loadEstate`
 * reads that fixture from the bundle (no network, no live clock) and validates
 * it against `estateSchema`, returning a discriminated `Result`:
 *
 *   - `{ ok: true, value }`  — the parsed, schema-valid `EstateFixture`.
 *   - `{ ok: false, error }` — a typed `EstateError` when the fixture is
 *                              missing, unparseable, or fails validation.
 *
 * It deliberately stops at validation. Turning the fixture's "days ago" offsets
 * into concrete dates (`resolveEstate(fixture, now)`) and assembling the view
 * (`buildRows` / `groupByState`) are the caller's job on the `/estate` page, so
 * the page can capture its single `renderedAt` and thread it through exactly as
 * the live `/g/[username]` path threads `renderedAt` through `GraveyardView`.
 * This mirrors the live flow (`loadGraveyard` returns raw `RepoFacts`; the view
 * layer classifies) and keeps this module's one responsibility — read + verify
 * the bundled estate — testable in isolation (Req 1.4, 12.8).
 *
 * The result/error shape intentionally reuses the shared `Result<T, E>` from
 * `lib/github` but carries its OWN `EstateError`, not the GitHub `LoadError`
 * union: an estate failure is a bundle/validation problem, not a network
 * outcome, and the design renders it as a dedicated full-page `EstateErrorState`
 * rather than as a `SceneErrorState` keyed by `LoadError.kind` (design.md,
 * Req 12.8). Keeping `EstateError` separate avoids widening `LoadError` — which
 * would force an unrelated case into the exhaustive `LoadErrorMessage` switch.
 *
 * The fixture read is injectable (`deps.read`) so tests can drive a valid
 * fixture, a malformed one, or a missing-file throw without touching disk and
 * can assert no network transport is ever constructed (Req 1.4). The production
 * default dynamically imports the bundled JSON — a build-time asset, so there
 * is no filesystem or network access at request time.
 *
 * Requirements: 1.4, 12.8
 */

import "server-only";

import { type Result } from "./github";
import { type EstateFixture, estateSchema } from "./estate-schema";

// Re-export the shared result contract and the fixture type so callers can
// import everything the loader returns from one place.
export type { Result, EstateFixture };

/**
 * The single way loading the estate fixture can fail. The fixture is a bundled
 * asset the author controls, so there is exactly one failure mode from the
 * caller's point of view — the fixture is not usable — regardless of whether it
 * was missing, unparseable, or schema-invalid. `detail` carries a short
 * diagnostic for logs; it is never required to render the user-facing
 * full-page `EstateErrorState` (Req 12.8).
 */
export interface EstateError {
  kind: "invalid-estate";
  detail?: string;
}

/**
 * Reads the bundled estate fixture and returns its raw, still-unvalidated
 * contents. The production default dynamically imports `data/estate.json`
 * (a bundled build asset — no filesystem or network at request time). Tests
 * inject a fake to supply a valid fixture, a malformed value, or a throw.
 */
export type EstateReader = () => Promise<unknown>;

/** Injectable dependencies for {@link loadEstate}. */
export interface LoadEstateDeps {
  /** Overrides how the raw fixture is obtained; defaults to the bundled JSON. */
  read?: EstateReader;
}

/**
 * The production fixture reader: dynamically imports the bundled estate JSON.
 *
 * `data/estate.json` is resolved and inlined at build time, so this performs no
 * network call and no request-time disk read — it just hands back the bundled
 * object. The import is dynamic (not a top-level `import`) so the module graph
 * stays clean and the dependency is only pulled when the default reader is
 * actually used. The JSON module's default export is the fixture object.
 */
const defaultReader: EstateReader = async () => {
  const mod = await import("@/data/estate.json");
  // JSON modules expose the object as the default export under ESM interop.
  return (mod as { default: unknown }).default;
};

/**
 * Builds a short, safe diagnostic string for an estate failure. The estate
 * fixture is author-controlled bundle data (no tokens, no PII), so echoing a
 * truncated single-line message is safe for logs. Collapsed to one line and
 * capped to keep logs tidy.
 */
function estateErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Loads and validates the bundled estate fixture.
 *
 * Flow (Req 1.4, 12.8):
 * 1. Read the bundled fixture via `deps.read` (default: the bundled JSON). A
 *    throw here — e.g. the asset is unavailable — is caught and surfaced as an
 *    `invalid-estate` error rather than propagating.
 * 2. Validate with `estateSchema.safeParse`. On failure, return `invalid-estate`
 *    carrying the zod issue summary as `detail`.
 * 3. On success, return the parsed `EstateFixture` as `{ ok: true, value }`.
 *
 * This issues no GitHub call and no network request: the only I/O is reading a
 * bundled asset, which the production default satisfies with a build-time
 * import. The function never throws; every failure becomes a typed error.
 */
export async function loadEstate(
  deps?: LoadEstateDeps,
): Promise<Result<EstateFixture, EstateError>> {
  const read = deps?.read ?? defaultReader;

  // 1. Obtain the raw fixture. A read throw is a usable-fixture failure, not a
  // crash: catch it and surface it as a typed estate error.
  let raw: unknown;
  try {
    raw = await read();
  } catch (error) {
    return {
      ok: false,
      error: { kind: "invalid-estate", detail: estateErrorDetail(error) },
    };
  }

  // 2. Validate. `safeParse` never throws, so a malformed or schema-invalid
  // fixture becomes an error result rather than an exception.
  const parsed = estateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "invalid-estate",
        detail: estateErrorDetail(parsed.error),
      },
    };
  }

  // 3. Success: hand back the validated fixture. Resolution + view assembly are
  // the caller's responsibility (so the page owns its single `renderedAt`).
  return { ok: true, value: parsed.data };
}
