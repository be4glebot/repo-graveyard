# Implementation Plan: Repo Lifecycle Classification

## Overview

This plan implements the feature in TypeScript (strict, Next.js 16 App Router) following the design's hard boundary between the pure core and the I/O shell. Work proceeds bottom-up: shared domain types and the test runner first, then each pure module with its fast-check property tests placed immediately after the code it validates, then the server-only I/O shell (GitHub GraphQL, Redis cache, loader orchestration) and the client-only override store, and finally the UI wiring (landing page, graveyard page, view components) with component tests. Every correctness property from the design becomes exactly one fast-check property test; example/unit/component tests cover the I/O and UI behavior that is not property-testable.

## Tasks

- [ ] 1. Set up shared types and the test runner
  - [ ] 1.1 Define domain types and the `LIFECYCLE_CONFIG` object
    - Create `lib/lifecycle.ts` with the `LIFECYCLE_CONFIG` constant holding every threshold (`ghostMaxDaysQuiet`, `ghostDecayBounds`, `zombieDecayBounds`, `reviveWindowDays`, `readmeMinBytes`, `manyIssues`, `finishedCommitKeywords`, `unfinishedCommitKeywords`, `finishedMargin`, `maxRepos`, `pageSize`, `msPerDay`)
    - Export the shared types used across modules: `LifecycleState`, `OverrideType`, `Override`, `RepoFacts`, `Classification`
    - No magic numbers may appear elsewhere in the codebase; all thresholds come from this object
    - _Requirements: 3.14, 5.4_

  - [ ] 1.2 Configure the Vitest runner
    - Create `vitest.config.ts` at the project root using `@vitejs/plugin-react` and `vite-tsconfig-paths` (resolves the `@/` alias from `tsconfig.json`)
    - Run component tests in `jsdom` and pure `lib` property/unit tests in `node` via `environmentMatchGlobs` (jsdom for `tests/unit/**/*.tsx`, node default for the rest)
    - Confirm the suite is runnable via `vitest --run`
    - _Requirements: 7.11_

- [ ] 2. Implement the username validator (pure)
  - [ ] 2.1 Implement `lib/username.ts`
    - Export `USERNAME_MAX_LENGTH`, `isValidUsername` (length 1–39, `/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/`, no trimming), and `normalizeUsername` (lowercases)
    - _Requirements: 1.4, 8.8, 9.1, 9.5_

  - [ ]* 2.2 Write property test for username validation
    - **Property 1: Username validation matches the specification** (validator half: true iff length 1–39, only letters/digits/hyphens, no leading/trailing hyphen)
    - Use `arbUsername` generator (valid names plus near-miss strings: leading/trailing hyphen, 40 chars, empty, whitespace, unicode)
    - **Validates: Requirements 1.4, 8.8, 9.1, 9.5**

- [ ] 3. Implement finished-signal detection (pure)
  - [ ] 3.1 Implement `lib/finished.ts`
    - Export `countSignals(repo)` and `isFinished(repo)`
    - Finished signals: `releaseCount >= 1`; non-empty trimmed `homepageUrl`; `readmeBytes > readmeMinBytes`; commit subject (first line only) contains a finished keyword, case-insensitive (at most one signal from the commit)
    - Unfinished signals: commit subject contains an unfinished keyword (at most one); `readmeBytes` is `null` or `0`; `openIssueCount >= manyIssues`
    - `isFinished` returns `finished - unfinished >= finishedMargin`; read thresholds from `LIFECYCLE_CONFIG`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 3.2 Write property test for finished detection equivalence
    - **Property 14: Finished detection is exactly the signal difference** — `isFinished` true iff `(finished − unfinished) >= 2`, compared against an independent reference implementation of the signals (first line only, case-insensitive)
    - **Validates: Requirements 5.1, 5.2, 5.3, 7.9**

  - [ ]* 3.3 Write property test for unfinished-signal monotonicity
    - **Property 15: Adding an unfinished signal never makes a repo finished** — for any repo where `isFinished` is false, adding a not-previously-present unfinished signal (matching commit subject, missing README, or issues at/above threshold) keeps it false
    - **Validates: Requirements 7.10**

- [ ] 4. Implement the lifecycle engine (pure)
  - [ ] 4.1 Implement `daysQuiet` and `classify` in `lib/lifecycle.ts`
    - `daysQuiet(repo, now)` = `max(0, floor((now − base) / msPerDay))` where `base` is `pushedAt` when present and parseable, else `createdAt`; unparseable `createdAt` yields 0; never negative or `NaN`
    - `classify(repo, override, now)` evaluates the ten ordered rules with early returns: finished override → tombstone; scrapped override → coffin; revived with push after `setAt` → clear `revived`, continue as no-override; revived within 14 days and not pushed after → risen; revived lapsed (≥14 days, not pushed after) → clear `revived`, continue; archived → tombstone/coffin via `isFinished`; `daysQuiet < ghostMaxDaysQuiet` → ghost; `isFinished` → tombstone; otherwise zombie
    - Ghost decay level = count of `ghostDecayBounds` `<= daysQuiet` (0–3); zombie decay level = count of `zombieDecayBounds` `<= daysQuiet` (0–4); tombstone/coffin/risen → `null`
    - Treat `pushedAfter(null, …)` as false; future `setAt` yields negative elapsed (`< 14` → risen); unparseable `setAt` treated as "not after" and elapsed ≥ window (lapses); `now` is an explicit parameter, never the system clock
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 4.2 Write the reference lifecycle model for property comparison
    - Create `tests/property/reference-lifecycle.ts` as an ordered list of `[predicate, state]` pairs implementing the ten rules independently of the production branching
    - Supports Property 6; no shared structure with `classify`
    - _Requirements: 3.2_

  - [ ]* 4.3 Write property test for totality, exclusivity, and determinism
    - **Property 5: Classification is total, exclusive, and deterministic** — for any repo (including null/missing/unparseable/future dates), any optional override, and any ISO `now`, `classify` does not throw, returns exactly one of the five states, a non-negative integer `daysQuiet`, and identical output on repeated calls
    - **Validates: Requirements 3.1, 3.13, 7.1**

  - [ ]* 4.4 Write property test for reference-model equivalence
    - **Property 6: Classification equals the precedence reference model** — state from `classify` equals the state from the table-driven reference model for any repo, override, and `now`
    - **Validates: Requirements 3.2, 3.8, 3.9, 3.10, 3.11, 3.12**

  - [ ]* 4.5 Write property test for terminal overrides
    - **Property 7: Terminal overrides always win** — `finished` → tombstone, `scrapped` → coffin, regardless of archive status, dates, or signals
    - **Validates: Requirements 3.3, 3.4, 7.2**

  - [ ]* 4.6 Write property test for recent pushes
    - **Property 8: Recent pushes are ghosts** — any non-archived repo with no override whose `pushedAt` is strictly less than 90 days before `now` classifies as ghost
    - **Validates: Requirements 3.10, 7.3**

  - [ ]* 4.7 Write property test for satisfied or lapsed revivals
    - **Property 9: Satisfied or lapsed revivals clear and match the no-override result** — a `revived` override with push after `setAt`, or ≥14 days elapsed with no push after, puts `"revived"` in `clearedOverrides` and yields the same state and decay level as no override
    - **Validates: Requirements 3.5, 3.7, 7.6, 7.8**

  - [ ]* 4.8 Write property test for revival within the window
    - **Property 10: Revival in the window yields risen** — a `revived` override with fewer than 14 days elapsed and `pushedAt` not after `setAt` yields risen, `null` decay level, empty `clearedOverrides`
    - **Validates: Requirements 3.6, 7.7**

  - [ ]* 4.9 Write property test for days-quiet computation
    - **Property 11: Days quiet is floored, clamped, and falls back to createdAt** — `daysQuiet` equals `max(0, floor((now − base) / 1 day))` with `base` = parseable `pushedAt` else `createdAt`; never negative or `NaN`
    - **Validates: Requirements 4.1**

  - [ ]* 4.10 Write property test for decay bands, ranges, and presence
    - **Property 12: Decay level bands, ranges, and presence** — ghost/zombie band levels match the thresholds, ghost levels stay 0–3, zombie levels stay 0–4, and tombstone/coffin/risen have `null`
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 7.5**

  - [ ]* 4.11 Write property test for decay monotonicity
    - **Property 13: Decay is monotonic in days quiet** — for a non-archived no-override repo, shifting only `pushedAt` so `daysQuiet` grows from `a` to `b` never turns a non-ghost into a ghost and never lowers the decay level within the same ghost/zombie state
    - **Validates: Requirements 7.4**

- [ ] 5. Checkpoint - pure classification core
  - Ensure all pure-core tests pass (username, finished, lifecycle), ask the user if questions arise.

- [ ] 6. Implement the graveyard view model (pure)
  - [ ] 6.1 Implement `lib/graveyard-view.ts`
    - Export `STATE_ORDER`, `GraveyardRow`, `buildRows(repos, overrides, now)`, `groupByState(rows)`, `TRUNCATION_NOTICE` (`"showing the 300 most recently pushed."`), and `truncationNotice(data)`
    - `buildRows` looks up overrides by `repo.name`, calls `classify`, and emits name, url, state, daysQuiet, and decayLevel (non-null only for ghost/zombie); `groupByState` preserves pushed-at-descending input order within each group
    - _Requirements: 8.1, 8.5, 8.9_

  - [ ]* 6.2 Write property test for grouping partition
    - **Property 17: Grouping partitions the classified repos** — every input repo appears in exactly one group, group sizes sum to the input length, each row sits in the group matching its state, and within-group order matches input order
    - **Validates: Requirements 8.1**

  - [ ]* 6.3 Write property test for row fields
    - **Property 18: Rows expose the required fields** — each row has name, state, and daysQuiet, and a non-null decay level iff the state is ghost or zombie
    - **Validates: Requirements 8.5**

- [ ] 7. Implement the GitHub GraphQL wrapper (server only)
  - [ ] 7.1 Implement query, node mapping, and fetch in `lib/github.ts`
    - Import `server-only`; define `GRAVEYARD_QUERY` selecting `repositoryOwner(login:)` with `repositories(first, after, isFork: false, privacy: PUBLIC, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC})`, all required node fields, both README aliases (`readmeUpper`/`readmeLower`), and connection-level `totalCount` + `pageInfo { hasNextPage endCursor }`
    - Implement `mapRepoNode` (pure, exported): `readmeBytes = upper?.byteSize ?? lower?.byteSize ?? null`, flatten `primaryLanguage` to its name, `lastCommitMessage` null when empty, preserve all other fields
    - Implement `fetchRepos(login, transport)`: paginate with `first = min(pageSize, maxRepos − collected)` until `collected == maxRepos` or `hasNextPage` false; set `truncated = totalCount > maxRepos || (collected == maxRepos && hasNextPage)`; retry a 5xx once then discard partial data and return `server-error`; map `repositoryOwner: null`/`NOT_FOUND` → `not-found`, 403/429/`RATE_LIMITED` → `rate-limited` with `resetAt` from `x-ratelimit-reset`, else `server-error`
    - Define the injectable `GraphqlTransport` type; the production transport wraps `@octokit/graphql` and reads `GITHUB_TOKEN` only here
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

  - [ ]* 7.2 Write property test for pagination cap and budget
    - **Property 2: Pagination respects the cap and query budget** — with a fake paginated transport honoring `first`/`after`, `fetchRepos` returns `min(N, 300)` repos in order, issues `max(1, ceil(min(N,300)/100))` queries, and reports `truncated` iff `N > 300`
    - **Validates: Requirements 1.1, 1.2, 8.9**

  - [ ]* 7.3 Write property test for node mapping
    - **Property 3: Node mapping prefers README.md** — `mapRepoNode` picks `README.md` size when present, else `readme.md`, else `null`, and preserves every other fetched field
    - **Validates: Requirements 1.3**

  - [ ]* 7.4 Write unit tests for the query text and fetch error mapping
    - Assert `GRAVEYARD_QUERY` contains every required field, both README aliases, the ordering, `isFork: false`, `privacy: PUBLIC`, and the pagination fields (1.3)
    - Assert not-found via null owner and via error code (1.5); 403, 429, and `RATE_LIMITED` with and without a reset header (1.6); 5xx-then-success and 5xx-then-5xx discarding partial pages (1.7)
    - _Requirements: 1.3, 1.5, 1.6, 1.7_

- [ ] 8. Implement the Redis cache helpers (server only)
  - [ ] 8.1 Implement `lib/cache.ts`
    - Import `server-only`; export `GRAVEYARD_TTL_SECONDS` (600), `REDIS_TIMEOUT_MS` (2000), `graveyardCacheKey(username)` (`graveyard:{lowercased}`), the `CacheClient` interface, and `cacheGet`/`cacheSet`
    - Both operations race a 2 s timeout, catch every error, and never throw: a `get` failure/timeout returns `null` (miss), a `set` failure is swallowed; validate cached payloads with a zod schema and treat invalid/stale shapes as a miss; cache only `RepoFacts[]` + `totalCount` + `truncated`, never classifications
    - _Requirements: 2.1, 2.4_

  - [ ]* 8.2 Write property test for case-insensitive cache keys
    - **Property 4: Cache keys are case-insensitive** — for any valid username and any recasing, `graveyardCacheKey` and `overridesKey` produce identical keys equal to the prefix plus the lowercased username
    - Covers the `overridesKey` half as well (depends on `lib/overrides.ts`)
    - **Validates: Requirements 2.1, 6.1**

- [ ] 9. Implement the loader orchestration (server only)
  - [ ] 9.1 Implement `lib/graveyard-loader.ts`
    - Import `server-only`; define the `LoadError` discriminated union, `GraveyardData`, `Result<T,E>`, and `loadGraveyard(rawUsername, deps?)`
    - Flow: validate first (return `invalid-username` before touching deps, zero cache/transport calls) → `cacheGet` → hit returns it → miss runs `fetchRepos` → on success `cacheSet` best-effort → return; a Redis outage plus failed GitHub fetch returns the GitHub error as-is; never cache errors
    - _Requirements: 1.4, 2.2, 2.3, 2.5_

  - [ ]* 9.2 Complete the username property test's loader half
    - **Property 1 (loader half): for any string failing validation, `loadGraveyard` returns `invalid-username` and makes zero transport and zero cache calls**
    - **Validates: Requirements 1.4**

  - [ ]* 9.3 Write cache and loader example tests
    - Stored value is raw facts under `graveyard:{lowercase}` with `ex: 600` (2.1); hit makes zero transport calls (2.2); miss fetches then stores (2.3); a `get` that rejects or hangs past 2 s falls back to GitHub without an error, using fake timers (2.4); Redis failure plus GitHub failure returns the GitHub error (2.5)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 10. Implement the override store (client only)
  - [ ] 10.1 Implement `lib/overrides.ts`
    - Export `OverrideMap`, `overridesKey(username)` (`repo-graveyard-overrides:{lowercased}`), `readOverrides(username, storage?)`, and `writeOverride(username, repoName, override, storage?)`
    - `StorageLike` defaults to `window.localStorage`; wrap every access in try/catch; reads parse JSON and validate with zod, malformed data yields `{}`; missing/empty username returns `{}` on read and is a no-op on write; writing a repo that already has an entry replaces it; do not import `server-only`
    - Add an ESLint `no-restricted-imports` rule blocking `lib/overrides` from server modules (enforces client-only, Req 6.7)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 10.2 Write property test for override round trip and replacement
    - **Property 16: Override store round trip and replacement** — with a working in-memory storage, `readOverrides` returns the last override per repo name (at most one entry each) and a single write/read returns an equal `{ type, setAt }`; with a throwing storage, `readOverrides` returns `{}` and `writeOverride` does not throw
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [ ]* 10.3 Write unit tests for override edge cases
    - Missing username on read returns `{}` (6.6); malformed JSON in storage returns `{}`
    - _Requirements: 6.5, 6.6_

- [ ] 11. Checkpoint - I/O shell and stores
  - Ensure all shell and store tests pass (github, cache, loader, overrides), ask the user if questions arise.

- [ ] 12. Implement the landing page UI
  - [ ] 12.1 Implement `components/landing/UsernameForm.tsx` (client)
    - `"use client"`; a labeled text input and submit button inside a `<form>` so Enter and button activation both submit and Tab order is input then button
    - On submit: trim, then empty → inline "A username is required"; invalid (via `isValidUsername`) → inline invalid-format message; valid → `router.push('/g/' + encodeURIComponent(username))`
    - Link the message with `aria-describedby`/`aria-invalid`, render it adjacent to the input, use theme-token focus ring (no hardcoded hex)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 12.2 Implement `app/page.tsx` (server)
    - Server component rendering static landing copy and mounting `UsernameForm`; no client interactivity of its own
    - _Requirements: 9.1_

  - [ ]* 12.3 Write component tests for the landing form
    - Blocks empty and invalid input with the correct inline message; navigates on valid input via Enter and via the button (9.2, 9.4, 9.5); Tab order reaches input then button (9.3)
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

- [ ] 13. Implement the graveyard page and view UI
  - [ ] 13.1 Implement `components/graveyard/LoadErrorMessage.tsx`
    - Exhaustive `switch` on `LoadError.kind` with a `never` check: `not-found` ("username does not exist on GitHub"), `rate-limited` (includes reset time from `resetAt`, generic wait message when `null`), `invalid-username` (format message), `server-error` ("repository data could not be loaded")
    - _Requirements: 8.3, 8.4, 8.7, 8.8_

  - [ ] 13.2 Implement `components/graveyard/GraveyardList.tsx` (presentational)
    - Headings per state in `STATE_ORDER`; each row shows linked name, state, days quiet, and decay level only when non-null; omit empty groups; render the empty-state message for zero repos; render the exact truncation notice when truncated; theme tokens only
    - _Requirements: 8.1, 8.2, 8.5, 8.9_

  - [ ] 13.3 Implement `components/graveyard/GraveyardView.tsx` (client)
    - Receives `repos`, `truncated`, `username`, `renderedAt`; initial render uses empty overrides and `renderedAt` to match server HTML; a mount `useEffect` reads `readOverrides(username)` and re-runs `buildRows`, updating displayed classifications
    - _Requirements: 8.6_

  - [ ] 13.4 Implement `app/g/[username]/page.tsx` (server)
    - `await params` inside a `<Suspense>`-wrapped async child; call `loadGraveyard`; capture `renderedAt = new Date().toISOString()` once, only after awaiting `params` (fall back to `await connection()` if the build flags the dynamic clock read); render `LoadErrorMessage` on error or `GraveyardView` on success; show the truncation notice when `truncated`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 8.8, 8.9_

  - [ ]* 13.5 Write component tests for the graveyard UI
    - `GraveyardList` renders the empty-state message (8.2); `LoadErrorMessage` renders the expected copy for each error kind including the reset time (8.3, 8.4, 8.7, 8.8); truncation notice shows the exact text (8.9); `GraveyardView` re-classifies after overrides load from storage (8.6)
    - _Requirements: 8.2, 8.3, 8.4, 8.6, 8.7, 8.8, 8.9_

- [ ] 14. Static and structural checks
  - [ ]* 14.1 Write threshold and boundary assertion tests
    - Import `LIFECYCLE_CONFIG` and assert the default values match the requirements (3.14, 5.4); add concrete boundary examples (89 days is a ghost, 90 days with no signals is a zombie, a 14-day-old revival is not risen)
    - _Requirements: 3.14, 5.4_

  - [ ] 14.2 Verify the build and boundary enforcement
    - Ensure `tsc --noEmit` and `next build` pass, the `LoadError` switch uses an exhaustive `never` check, server modules import `server-only`, and the ESLint `no-restricted-imports` rule blocks `lib/overrides` from server modules (6.7)
    - _Requirements: 6.7_

- [ ] 15. Final checkpoint - full suite
  - Ensure all tests pass via `vitest --run` and the build is clean, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (property, unit, integration, and component tests) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements and/or correctness properties for traceability.
- Each of the 18 correctness properties maps to exactly one fast-check property test (`fc.assert(fc.property(...))`, `{ numRuns: 100 }` minimum), tagged `Feature: repo-lifecycle-classification, Property N: <title>`.
- Shared fast-check generators live in `tests/property/arbitraries.ts` (`arbIso`, `arbRepoFacts`, `arbOverride`, `arbUsername`); `now` is always passed explicitly and boundary offsets are mixed in via `fc.constantFrom`.
- Property 1 spans tasks 2.2 (validator) and 9.2 (loader); Property 4 lives in 8.2 but depends on `overridesKey` from task 10.1.
- Checkpoints ensure incremental validation after each major layer.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "10.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "4.1", "10.2", "10.3"] },
    { "id": 3, "tasks": ["4.2", "6.1", "7.1", "8.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "6.2", "6.3", "7.2", "7.3", "7.4", "8.2"] },
    { "id": 5, "tasks": ["9.1", "12.1", "13.1", "13.2"] },
    { "id": 6, "tasks": ["9.2", "9.3", "12.2", "13.3"] },
    { "id": 7, "tasks": ["12.3", "13.4", "14.1"] },
    { "id": 8, "tasks": ["13.5", "14.2"] }
  ]
}
```
