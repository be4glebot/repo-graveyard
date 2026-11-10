# Implementation Plan: The Séance

## Overview

Build the séance in the order the design's module map implies: tokens and config first, then the pure `lib/` core (schema, evidence, prompt), the server shell (LLM adapter, limiter, cache, service, route), the pure client helpers, fixtures, the `components/seance/` UI, and finally the `DetailPanel` and estate wiring. Property tests sit next to the code they check so errors surface early.

Ground rules for every task:

- Language is TypeScript (matches the design). Tests use Vitest 5, Testing Library and fast-check 4, run once with `npx vitest --run`.
- All tests mock the AI client (`LlmClient`), the cache, the limiter store and the GitHub transport. No test calls a real AI provider or the real GitHub API. DOM tests stub `fetch` to fail on any URL they were not told about.
- Never touch, read, print or commit `.env.local`. Never run `next build` and never start a dev server (the user's dev server is running). Type check with `npx tsc --noEmit` and lint with `npm run lint`.
- Existing tests stay unchanged. The single exception is the approved update in task 12.3. `app/globals.css` only gains tokens and classes; nothing is renamed or removed.
- Tests are required in this project. No test sub-task is marked optional.
- Each property test is one test with at least 100 runs and carries the tag comment `// Feature: the-seance, Property N: <title>`.

## Tasks

- [x] 1. Tokens and configuration
  - [x] 1.1 Add the missing design tokens to `app/globals.css`
    - Add a new `@theme` block with `--color-night-800: #161d31`, `--color-moon-100: #ecead9`, `--color-moon-300: #b9b6a3`, `--color-ghost-300: #9fe7ff` first, before any other séance work
    - Add the smoke fill tokens (`--color-smoke-*`), `--smoke-alpha-min`, `--smoke-alpha-max`, the glow tokens and the motion tokens from the design
    - Do not rename or remove any existing token
    - _Requirements: 11.2, 11.3, 13.2, 13.3, 17.5_

  - [x] 1.2 Add `.env.example` and the `.gitignore` exception
    - Add a `!.env.example` line to `.gitignore` so the example file can be committed while `.env*` stays ignored
    - Create `.env.example` with placeholders only: `LLM_PROVIDER=anthropic`, `LLM_MODEL=claude-haiku-5-5`, `LLM_API_KEY=` (empty), `LLM_DAILY_LIMIT=150`
    - Do not open, edit, print or stage `.env.local`
    - _Requirements: 8.2, 8.12, 19.7_

  - [x] 1.3 Write unit test for `.env.example`
    - Create `tests/unit/env-example.test.ts`
    - Assert the file exists, has the four expected lines, an empty `LLM_API_KEY=`, and no value that looks like a secret
    - The test never reads `.env.local`
    - _Requirements: 8.2, 19.7_

- [x] 2. Schema, sentence splitting and date rule
  - [x] 2.1 Create `lib/seance-schema.ts`
    - Export `VERDICTS`, `Verdict`, `BusinessItem`, `SeanceResult`, strict `seanceResultSchema` with every length rule from the design
    - Export `splitSentences`, `countSentences` (no `Intl.Segmenter`) and `containsDateOrDayCount`
    - Apply the date rule to `voice`, `causeOfDeath`, `verdictReason`, item `title` and `detail`, not to `evidence`
    - Export `seanceRequestSchema` (owner 1..39, repo 1..100, unknown keys stripped) and `seanceResponseSchema` (discriminated union on `kind`)
    - Keep the file client-safe (no `server-only`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.6, 19.2_

  - [x] 2.2 Write unit tests for the schema
    - Create `tests/unit/seance-schema.test.ts`
    - One valid result accepted, one test per invalid field rejected, unknown key rejected, missing key rejected
    - For each length limit: value at the limit accepted, limit + 1 rejected
    - Dates: "I may never wake." passes, "I died on May 3." fails; `2024-05-01`, `5/1/2024`, "3 May", "March 2024", "12 days" each fail; "march" and "august" in ordinary sentences pass
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.6, 20.2, 20.25_

  - [x] 2.3 Write property test for schema round trip
    - Create `tests/property/seance-schema.property.test.ts`
    - **Property 1: Schema round trip**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 20.17**

  - [x] 2.4 Write property test for exact bounds and strictness
    - Add to `tests/property/seance-schema.property.test.ts`
    - **Property 2: Schema bounds and strictness are exact**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

  - [x] 2.5 Write property test for date and day-count detection
    - Add to `tests/property/seance-schema.property.test.ts`
    - **Property 3: Date and day-count detection**
    - **Validates: Requirements 5.6, 5.7**

- [x] 3. Evidence, grounding and prompt
  - [x] 3.1 Create `lib/seance.ts`
    - Export `EvidencePack`, `FactLine`, `DerivedEvidence`, `deriveEvidence`, `renderEvidenceText`, `truncateUtf8`, `neutralizeMarkers` (loops until no marker remains), `isGroundedEvidence` and `validateGrounding`
    - `deriveEvidence` produces both the model-facing text and the validation corpus in one pass, in the fixed `[F#]`, `[C#]`, `[R]` order
    - _Requirements: 3.3, 3.5, 3.8, 3.9, 3.11, 6.4, 6.6, 6.8_

  - [x] 3.2 Create `lib/ai.ts`
    - Export `OPEN_MARKER`, `CLOSE_MARKER`, `IGNORE_INSTRUCTIONS_RULE`, `FORMAT_LOCK_RULE`, the "My memory of that has faded." sentence, `buildSeancePrompt(owner, derived)` and the constants for 1000 output tokens and 8000 ms
    - Put Untrusted_Text only inside delimited blocks; system text follows `voice.md` and rules 5.1 to 5.5 and 6.5
    - _Requirements: 4.15, 4.16, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.5_

  - [x] 3.3 Write property test for derivable evidence accepted
    - Create `tests/property/seance-evidence.property.test.ts` with arbitraries for Evidence_Packs (README null or text, 0 to 5 commits, unicode, astral characters, marker fragments)
    - **Property 4: Derivable evidence is accepted**
    - **Validates: Requirements 6.5, 6.6, 20.6**

  - [x] 3.4 Write property test for non-derivable evidence rejected
    - Add to `tests/property/seance-evidence.property.test.ts`; use unique tokens so a generated README cannot contain the evidence by accident
    - **Property 5: Non-derivable evidence is rejected**
    - **Validates: Requirements 6.6, 6.7, 6.8, 20.6, 20.26**

  - [x] 3.5 Write property test for deterministic Evidence_Text
    - Add to `tests/property/seance-evidence.property.test.ts`
    - **Property 6: Evidence_Text is deterministic and well formed**
    - **Validates: Requirements 3.8, 3.9, 3.11, 20.26**

  - [x] 3.6 Write property test for README truncation
    - Add to `tests/property/seance-evidence.property.test.ts`
    - **Property 7: README truncation is bounded and boundary safe**
    - **Validates: Requirements 3.5, 20.20**

  - [x] 3.7 Write property test for untrusted text inside delimiters
    - Add to `tests/property/seance-evidence.property.test.ts`; include nested markers such as `<<<EVID<<<EVIDENCE>>>ENCE>>>`
    - **Property 8: Untrusted text stays inside delimiters**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 20.7**

  - [x] 3.8 Write unit tests for the prompt
    - Create `tests/unit/seance-prompt.test.ts`
    - Wording for 4.16 and 5.1 to 5.5, the evidence rule 6.5, request constants (1000 tokens, 8000 ms)
    - Injection README example: prompt wraps the README as quoted evidence, the ignore-instructions rule is present, and a mock output following the injected instruction fails validation
    - _Requirements: 4.15, 4.16, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.5, 20.7_

- [x] 4. GitHub evidence fetch
  - [x] 4.1 Create `lib/seance-gather.ts`
    - Export the single read-only GraphQL document with the four README aliases (`README.md`, `readme.md`, `README`, `README.rst`) and `history(first: 5)`
    - Export `fetchEvidence(transport, owner, repo)` that picks the first present alias in order, applies `truncateUtf8(text, 8192)`, returns up to 5 commit messages, and returns `null` on any failure
    - Use the existing `GraphqlTransport`; no write call, no new scope
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 4.2 Write unit tests for evidence fetch
    - Create `tests/unit/seance-gather.test.ts` with a fake transport
    - Query requests all four aliases in one call, contains no `mutation`, uses the first existing alias
    - No README, fewer than 5 commits, zero commits, GraphQL errors and failures give a facts-only result without throwing
    - With fake timers, a call that hangs is abandoned after 5 seconds and not retried
    - _Requirements: 3.4, 3.6, 3.8, 3.9, 3.10, 20.27, 20.29_

  - [x] 4.3 Write property test for README alias selection
    - Create `tests/property/seance-gather.property.test.ts`
    - **Property 26: README alias selection**
    - **Validates: Requirements 3.4, 3.6, 20.29**

- [x] 5. LLM adapter
  - [x] 5.1 Create `lib/llm.ts`
    - Export `LlmRequest`, `LlmClient` and `createLlmClient(env?)` returning `null` when `LLM_API_KEY` is missing or empty or `LLM_PROVIDER` is not `anthropic`
    - Implement the Anthropic Messages adapter with plain `fetch` (no SDK): `POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`, `content-type`; body `{ model, max_tokens, system, messages }` with the model from `LLM_MODEL` (`claude-haiku-5-5`)
    - Use `AbortSignal.timeout(req.timeoutMs)` combined with `req.signal`; return the text of the first `text` content block
    - Throw a generic error on non-2xx, non-JSON or no text block; error messages never include the key, request body or response body
    - Import `server-only`
    - _Requirements: 4.15, 8.12, 19.1, 19.7, 19.8_

  - [x] 5.2 Write unit tests for the adapter
    - Create `tests/unit/seance-llm.test.ts` with a stubbed `fetch`
    - Endpoint, header names, body fields, first `text` block selection, non-2xx, no text block, timeout abort
    - A key sentinel never appears in a thrown message; `createLlmClient` returns `null` for a missing key, empty key or another provider
    - _Requirements: 19.1, 19.7, 19.8, 20.1_

- [x] 6. Rate limiter and cache
  - [x] 6.1 Create `lib/ratelimit.ts`
    - Export `RateLimiter` (`check` read-only, `consume` counts one AI call), `createRateLimiter(store, clock)`, `parseDailyLimit` (fallback 200) and `clientIp` (first entry trimmed, shared anonymous bucket when empty)
    - IP limit: 30 calls per rolling 60 minutes with a sorted set per IP; daily budget with `INCR` on `llm:daily:<UTC date>` and a 48 hour expiry; IP is checked first and a blocked IP leaves the daily counter untouched
    - In-memory fallback of 10 calls per rolling hour per IP when the store throws or Redis is absent
    - Import `server-only`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.9, 8.10, 8.11, 8.12_

  - [x] 6.2 Write property test for daily limit parsing
    - Create `tests/property/seance-ratelimit.property.test.ts`
    - **Property 22: Daily limit parsing**
    - **Validates: Requirements 8.2, 20.28**

  - [x] 6.3 Write property test for client IP extraction
    - Add to `tests/property/seance-ratelimit.property.test.ts`
    - **Property 23: Client IP extraction**
    - **Validates: Requirements 8.11**

  - [x] 6.4 Write property test for the rolling window
    - Add to `tests/property/seance-ratelimit.property.test.ts` with a fake store and clock
    - **Property 24: The rolling window never admits more than 30 calls an hour**
    - **Validates: Requirements 8.1, 8.3, 8.9**

  - [x] 6.5 Extend `lib/cache.ts` with séance helpers
    - Add `SEANCE_TTL_SECONDS = 86_400`, `seanceCacheKey` (lower-cased owner and repo, `pushedAt ?? createdAt`, `seance:v1:` prefix), `seanceCacheGet` (schema-validated, error, timeout and invalid payload are misses) and `seanceCacheSet` (best effort, swallows failures)
    - A `null` client is a guaranteed miss and a no-op write; reuse `REDIS_TIMEOUT_MS` and the existing `CacheClient`; do not change the graveyard helpers
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.10, 7.11, 7.12_

  - [x] 6.6 Write unit tests for the séance cache
    - Create `tests/unit/seance-cache.test.ts`
    - TTL is 86400, read error and read timeout and invalid payload are misses, write failure and write timeout are swallowed, `null` client, key casing and `createdAt` fallback
    - _Requirements: 7.3, 7.5, 7.6, 7.7, 7.8, 7.10, 7.11_

- [x] 7. Service and route
  - [x] 7.1 Create `lib/seance-service.ts`
    - Export `SeanceOutcome`, `SeanceDeps` and `runSeance(req, deps)` with this exact order: (body already validated by the route) → `loadGraveyard` and find repo (case-insensitive; error and missing both give `silent`, reason `repo-not-found`) → cache lookup (a hit returns `ok` with no limiter check) → `limiter.check(ip)` (`veil` or `weak` returns immediately) → no-LLM check (`deps.llm === null` gives `silent`, reason `no-llm`) → `fetchEvidence` raced against 5000 ms (failure means facts only) → attempts → cache set
    - Attempts: at most 2; each calls `limiter.consume(ip)` first (consumed per call, never refunded), then `llm.complete` raced against 8000 ms, then `JSON.parse`, `seanceResultSchema.safeParse` and `validateGrounding`; first fully valid result wins; failure of both gives `silent` with no partial fields
    - Cache only validated results via `seanceCacheSet` (best effort); never cache `silent`
    - Whole request raced against 25000 ms with a shared `cancelled` flag so nothing runs or is cached after the deadline
    - `log({ repo, reason })` only, using the fixed reason codes; never log README, commits, model output, body or key
    - Import `server-only`
    - _Requirements: 3.1, 3.2, 3.10, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.18, 6.7, 6.9, 7.1, 7.2, 7.9, 8.3, 8.4, 8.10, 19.4, 19.5, 19.6, 19.8_

  - [x] 7.2 Create `app/api/seance/route.ts`
    - `import "server-only"`, `export const maxDuration = 30`, `POST` handler
    - Read the body as text, reject over 4096 bytes (measured with `TextEncoder`), parse JSON, validate with `seanceRequestSchema`; any failure returns `400 {"error":"bad request"}` before touching the cache, limiter or LLM
    - Otherwise build deps (`loadGraveyard`, `fetchEvidence` with `createGithubTransport()`, `createLlmClient()`, cache client, limiter), take the IP from `clientIp(request.headers.get("x-forwarded-for"))`, and return `200` JSON with `Cache-Control: no-store`
    - _Requirements: 4.17, 8.11, 8.12, 19.1, 19.2, 19.3, 19.7_

  - [x] 7.3 Write property test for the retry loop
    - Create `tests/property/seance-service.property.test.ts` using injected fakes; model a hang as a never-resolving promise advanced with fake timers
    - **Property 19: The retry loop makes at most two calls and never returns partial output**
    - **Validates: Requirements 4.8, 4.9, 4.10, 4.11, 4.12, 5.7, 6.7, 8.10, 20.3, 20.4**

  - [x] 7.4 Write property test for no leaked model text
    - Add to `tests/property/seance-service.property.test.ts`
    - **Property 20: No raw model text leaks and only validated results are cached**
    - **Validates: Requirements 4.13, 4.14, 7.12, 19.6, 19.7**

  - [x] 7.5 Write property test for cache key dependence
    - Add to `tests/property/seance-service.property.test.ts`
    - **Property 21: Cache key depends only on server-held values**
    - **Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.9, 7.10, 19.4, 20.8, 20.24**

  - [x] 7.6 Write property test for cache hits bypassing the limiter
    - Add to `tests/property/seance-service.property.test.ts`
    - **Property 27: Cache hits bypass the limiter; blocked misses cost nothing**
    - **Validates: Requirements 7.9, 8.3, 8.4, 20.9, 20.32**

  - [x] 7.7 Write unit tests for the service
    - Create `tests/unit/seance-service.test.ts`
    - Named cases: first output invalid then valid gives exactly 2 calls (20.3); both invalid gives `silent` after exactly 2 calls and no third (20.4)
    - Cache hit makes 0 calls even when the IP is over its limit (20.32); blocked IP on a miss gets `veil` or `weak` with 0 GitHub and 0 LLM calls (20.9, 20.32); second request with same key makes 0 extra calls and a changed server `pushedAt` makes exactly 1 more (20.8); client-sent `pushedAt` changes nothing (20.24)
    - Missing key gives `silent` with no call; missing repo response equals other fallbacks (19.5); each call counted (8.10); `LLM_DAILY_LIMIT` missing, empty, negative or non-numeric yields 200 (20.28)
    - Fake timers: GitHub abandoned at 5 s, each LLM call at 8 s, whole request `silent` at 25 s with no cache write (20.27)
    - _Requirements: 4.11, 4.12, 4.18, 7.8, 7.9, 8.3, 8.4, 8.10, 19.5, 19.8, 20.3, 20.4, 20.8, 20.9, 20.24, 20.27, 20.28, 20.32_

  - [x] 7.8 Write unit tests for the route
    - Create `tests/unit/seance-route.test.ts`
    - `maxDuration === 30`, body over 4 KB gives 400, malformed JSON gives 400, generic 400 body echoes nothing, a key sentinel never appears in a response or log entry
    - _Requirements: 4.17, 19.2, 19.3, 19.7, 20.27_

  - [x] 7.9 Write property test for request validation
    - Create `tests/property/seance-route.property.test.ts`
    - **Property 25: Request validation accepts exactly the valid bodies**
    - **Validates: Requirements 19.2, 19.3**

- [x] 8. Checkpoint - Server side complete
  - Run `npx vitest --run`, `npx tsc --noEmit` and `npm run lint`. Do not run `next build`. Ensure all tests pass, ask the user if questions arise.

- [x] 9. Pure client helpers
  - [x] 9.1 Create `lib/seance-decay.ts`
    - Export `DecayProfileId`, `DecayProfile`, `DECAY_PROFILES`, a total and pure `selectDecayProfile(state, decayLevel)` (unknown inputs give `ghost-steady`; ghost decay truncated into 0..3), and a seeded `flickerFor(repoName, lineIndex, lineLength)` (null for roughly two lines in three, duration at most 150 ms)
    - _Requirements: 11.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [x] 9.2 Create `lib/seance-ritual.ts`
    - Export `WHISPER_LINES` (at least four) and `buildRitualPlan(seed)` returning 3 to 6 candles, gaps 200 to 600 ms, fades 500 to 1500 ms, last candle lit by 2000 ms
    - _Requirements: 10.3, 10.6_

  - [x] 9.3 Create `lib/seance-contrast.ts`
    - Export `parseColor` (hex and `rgb()/rgba()`), `compositeOver`, `relativeLuminance` and `contrastRatio` using the WCAG 2 formula; text-shadow is never part of the calculation
    - _Requirements: 13.1, 13.2, 13.4, 13.8_

  - [x] 9.4 Create `lib/seance-transcript.ts`
    - Export `VERDICT_COPY` (words, headlines, treatment markers, accent tokens from the design) and a pure `buildTranscriptText(result: Partial<SeanceResult>)` in the specified order with consecutive numbering, omitting empty fields and never printing `undefined` or `null`
    - _Requirements: 15.2, 15.3, 15.4, 15.7, 16.7, 16.8, 16.11, 16.12_

  - [x] 9.5 Create `lib/seance-state.ts`
    - Export `Phase`, `SeanceState`, `SeanceEvent` and a pure `seanceReducer` enforcing: START only in `idle`; RETRY only in `silent` with nothing in flight; stale `attemptId` ignored; `revealing` only after an `ok` outcome and the floor or a skip; ritual persists until an outcome; CLOSE returns the initial state
    - Reuse the response and outcome types from `lib/seance-schema.ts`
    - _Requirements: 1.5, 1.6, 1.8, 9.8, 9.9, 10.1, 10.12, 10.13_

  - [x] 9.6 Write property test for decay profile selection
    - Create `tests/property/seance-decay.property.test.ts`
    - **Property 14: Decay profile selection is total and deterministic**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 20.19**

  - [x] 9.7 Write property test for flicker
    - Add to `tests/property/seance-decay.property.test.ts`
    - **Property 16: Flicker is seeded and bounded**
    - **Validates: Requirements 11.7**

  - [x] 9.8 Write property test for the ritual plan
    - Add to `tests/property/seance-decay.property.test.ts`
    - **Property 17: Ritual plan stays within bounds**
    - **Validates: Requirements 10.3**

  - [x] 9.9 Write unit tests for decay profile numbers
    - Create `tests/unit/seance-decay.test.ts`
    - Per-profile numbers: ghost 0 jitter 0 split 0 glow baseline; ghost 1 glow 20 to 40 percent lower; ghost 2 and 3 jitter 0.1 to 1 px and split 1 to 2 px; zombie rougher, darker, red; risen matches ghost 0 with cyan; tombstone and coffin grey with motion at most 10 percent
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 9.10 Write property test for transcript contrast
    - Create `tests/property/seance-contrast.property.test.ts`; read `app/globals.css` as text and parse `--name: value;` lines
    - **Property 15: Transcript contrast holds for every profile**
    - Also assert verdict accent tokens and the ledger evidence colour reach 4.5:1 against `night-800`; failure messages name the failing profile
    - **Validates: Requirements 11.3, 13.1, 13.2, 13.8, 14.7, 15.12, 20.13**

  - [x] 9.11 Write property test for transcript content and order
    - Create `tests/property/seance-transcript.property.test.ts`
    - **Property 12: Transcript text contains everything, in order**
    - **Validates: Requirements 16.7, 16.11, 20.18**

  - [x] 9.12 Write property test for transcript markup and undefined
    - Add to `tests/property/seance-transcript.property.test.ts`
    - **Property 13: Transcript builder adds no markup and never prints undefined**
    - **Validates: Requirements 16.8, 16.12**

  - [x] 9.13 Write property test for the reducer
    - Create `tests/property/seance-state.property.test.ts` using a model-based command list
    - **Property 18: The client reducer never has two requests in flight and never shows results early**
    - **Validates: Requirements 1.5, 1.6, 1.8, 9.8, 9.9, 10.1, 10.12, 10.13**

- [x] 10. Fixtures
  - [x] 10.1 Add a `seanceResult` per repo to the sample estate
    - Add `seanceResult: z.unknown().optional()` to the repo schema in `lib/estate-schema.ts` (loose on purpose so one bad fixture only silences that one séance)
    - Add exactly one `seanceResult` to every repo in `data/estate.json`; leave the existing `seance` string field untouched
    - Cover all three verdicts and all five creature types; invented names only; no dates or day counts; follow `voice.md`
    - Each `evidence` equals a non-dated Fact_Line text derived by `deriveEvidence` from the resolved facts (for example `open issues: 3`, `language: Rust`)
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [x] 10.2 Write unit tests for fixtures
    - Create `tests/unit/seance-fixtures.test.ts`
    - Every estate repo has exactly one entry, each passes `seanceResultSchema`, all three verdicts and all five creature types appear, each `evidence` equals a derived Fact_Line text, no dated prose, no real names
    - Run `tests/unit/estate-fixture.test.ts` and `tests/unit/estate-loader.test.ts` unchanged to confirm they still pass
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

- [x] 11. Séance UI components
  - [x] 11.1 Add séance classes to `app/globals.css`
    - Add `.smoke-field` (border 0, radius 0, no tail pseudo-element, ragged mask layer using `/art/fog-wisps.webp` with `-webkit-` prefix), `.spirit-word` and the settled rule (`transition: none; opacity: 1; filter: none; animation: none`), `.ritual-surge-ghost`, `.ritual-surge-zombie`, `.ritual-dim`, `.ritual-candle-flame`, `.ritual-smoke`, `[data-ritual-dim]` (opacity 0.45, 300 ms), the candle-400 focus ring (at least 2px) and font sizes (16px at 768px and up, 15px below)
    - Animate only `transform`, `opacity` and `filter`; no flicker above 3 per second
    - Add the `prefers-reduced-motion: reduce` block: `animation: none` plus a single 200 ms opacity fade
    - Add no existing-class edits
    - _Requirements: 10.2, 10.4, 10.5, 10.7, 10.8, 10.14, 11.2, 11.3, 11.4, 11.5, 11.6, 11.8, 11.11, 13.5, 13.6, 13.7, 18.5, 18.8, 18.9_

  - [x] 11.2 Create `components/seance/useSeance.ts`
    - Hook `useSeance({ owner, repo, fixture, reduced })` driving `seanceReducer`
    - Fixture path: no `fetch`; validate with `seanceResultSchema.safeParse`; missing or invalid becomes `silent`; valid result delivered via `queueMicrotask`
    - Live path: one `fetch("/api/seance", { method: "POST", signal })`, 30 s `AbortController` timer, response parsed with `seanceResponseSchema`, anything else is `FAILURE`
    - 2 s ritual floor (dropped under reduced motion); `CLOSE` aborts the request and clears timers
    - _Requirements: 1.5, 1.7, 2.1, 2.2, 2.7, 2.8, 2.9, 9.3, 9.4, 9.8, 10.1, 10.13, 10.14_

  - [x] 11.3 Create `SeanceControl` and `SeanceStates`
    - `components/seance/SeanceControl.tsx`: native `<button type="button">` with candle glyph and text "Hold a séance"; uses `aria-disabled="true"` (not `disabled`) while running or shown and ignores clicks then
    - `components/seance/SeanceStates.tsx`: `VeilState`, `WeakGhostState`, `SilentFallback` with the copy from the design; Veil and Weak show the "Tour the estate" link and no retry button; Weak copy mentions facts and the record and never the word "verdict"; Silent shows "Light another candle", `aria-disabled` while a retry is in flight
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 9.3, 9.7, 9.9, 18.4, 18.5_

  - [x] 11.4 Create `components/seance/Ritual.tsx`
    - Candles from `buildRitualPlan(seed)`, smoke, creature surge class, Whisper_Text cycling (1 to 2 s per line, opacity 0.3 to 0.5), loops if no result at 4 s, on-screen Skip control, click-to-skip
    - Every decorative layer and the whispers carry `aria-hidden="true"`; unmounts within 500 ms of ending; reduced motion replaces everything with one 200 ms fade
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.12, 10.14, 10.15, 10.16, 18.7, 18.10_

  - [x] 11.5 Create `SpiritTranscript`, `CauseOfDeath` and `LedgerList`
    - `SpiritTranscript.tsx`: Smoke_Field, one `[data-sentence-index]` span per sentence (zero-based) with `aria-hidden` per-word spans, full text in the DOM from first render, 60 ms stagger and 300 ms fade, settle timer, click settles, `data-decay-profile`, seeded single-letter flicker, decay label text; not rendered when `voice` is empty; settled state inserts one visually hidden `<p data-seance-announce>` outside `[data-seance-transcript]`
    - `CauseOfDeath.tsx`: engraved Cinzel capitals line
    - `LedgerList.tsx`: real `<ol>` with one `li` per item showing `title`, `detail`, `evidence` (`font-fact`) in that order; held in the DOM but visually hidden until settled
    - All fields rendered as plain text; no `dangerouslySetInnerHTML`
    - _Requirements: 6.10, 6.11, 11.1, 11.4, 11.5, 11.7, 11.8, 11.9, 11.11, 11.12, 11.13, 11.14, 12.9, 12.10, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.8, 14.9, 16.2, 18.6, 18.7, 18.12_

  - [x] 11.6 Create `VerdictCard`, `KiroSlot` and `CopyTranscriptButton`
    - `VerdictCard.tsx`: one per repo, verdict in words, headline and `data-treatment` from `VERDICT_COPY`, `verdictReason` in full as plain text, no controls; reduced motion is a 200 ms fade
    - `KiroSlot.tsx`: `<div data-slot="revive-in-kiro"></div>` with no children
    - `CopyTranscriptButton.tsx`: accessible name "Copy transcript", writes `buildTranscriptText(result)` via `navigator.clipboard.writeText`, announces "Transcript copied." or "Could not copy. Select the text instead." within 1000 ms and stays available
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11, 16.5, 16.6, 16.9, 16.10_

  - [x] 11.7 Create `components/seance/SeanceRegion.tsx`
    - Always-mounted `<div aria-live="polite" data-seance-region>`, empty while idle
    - Seance_Heading `<h3 tabIndex={-1}>` "AI · from the facts above"; focus moves to it within 100 ms of results and within 500 ms of the Silent_Fallback
    - Order: transcript → cause of death → ledger → VerdictCard → KiroSlot → Copy button; maps phases to Ritual, states and result view
    - Registers the Escape claim function (skips ritual or settles reveal and returns true; otherwise returns false)
    - _Requirements: 8.5, 8.6, 9.6, 10.9, 10.10, 10.11, 11.10, 15.1, 15.10, 18.1, 18.2, 18.3, 18.6, 18.9_

- [x] 12. Detail panel and estate wiring
  - [x] 12.1 Update `components/detail/DetailPanel.tsx` and add `Portrait`
    - Add `components/detail/Portrait.tsx`: decorative `Creature` (`aria-hidden`, no button) with the ritual surge class
    - New order: header → portrait → pills and explanation → Facts section (headed, e.g. "From GitHub") → Actions section (`aria-label="Actions"`, `data-slot="actions"` kept) containing `SeanceControl` → `SeanceRegion`
    - Create `escapeClaimRef` and a small context; the Escape branch asks `escapeClaimRef.current?.()` first and only closes when it returns false; keep the dialog semantics, Tab trap, inert and scroll lock
    - Use the real font tokens (`font-heading`, `font-narrative`, `font-fact`) and color tokens only; no hex, `rgb(`, `rgba(`, `hsl(` or `hsla(` literal; apply `data-ritual-dim` during the ritual; keep the close button above the ritual layer
    - Accept `seanceFixture` and `isFixture` props and pass the owner, repo, state and decay level through
    - _Requirements: 1.1, 1.6, 1.7, 1.8, 1.10, 10.2, 10.10, 10.11, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 18.11_

  - [x] 12.2 Wire estate fixtures through the scene
    - `app/estate/page.tsx` passes `seanceFixtures` (from `loadEstate`) to `SceneView`; `SceneView` passes `seanceFixture={seanceFixtures?.[panelRow.name]}` to `DetailPanel` only when `isFixture` is true
    - Live pages pass nothing so `estate.json` is not bundled into `/g/*`
    - _Requirements: 2.1, 2.2, 2.9_

  - [x] 12.3 Update the one approved existing test
    - In `tests/dom/DetailPanel.test.tsx`, change only "renders an empty Actions landmark with no controls (6.14)" to assert that the `section[aria-label="Actions"][data-slot="actions"]` contains exactly one control, the "Hold a séance" button, and nothing else
    - Do not change, rename or delete any other existing test; confirm the rest of the file passes unmodified
    - _Requirements: 1.1, 1.10, 17.10, 17.11, 20.23_

- [x] 13. Remaining UI tests
  - [x] 13.1 Write property test for literal text rendering
    - Create `tests/property/seance-render.property.test.tsx` (jsdom)
    - **Property 9: Seance_Result fields render as literal text**
    - **Validates: Requirements 6.10, 11.13, 14.8, 15.5, 20.11**

  - [x] 13.2 Write property test for ledger numbering
    - Add to `tests/property/seance-render.property.test.tsx`
    - **Property 10: Ledger numbering and item order**
    - **Validates: Requirements 14.3, 14.5**

  - [x] 13.3 Write property test for sentence indexes and full text
    - Add to `tests/property/seance-render.property.test.tsx`
    - **Property 11: Sentence elements are indexed and the full text is present**
    - **Validates: Requirements 11.12, 13.6, 16.2, 20.12**

  - [x] 13.4 Write DOM tests for the séance flow
    - Create `tests/dom/SeanceFlow.test.tsx` with a stubbed `fetch` that fails on any unlisted URL and fake timers
    - One test each: ritual flow, skip by click, skip by Escape (panel stays open), skip by the Skip control, reduced motion, focus moves to the Seance_Heading, copy transcript output, copy failure message
    - Control disabled while running (no second request), reopening starts idle, closing cancels the request
    - Veil and Weak render their copy with the Tour link, no retry button, and 0 LLM calls; Weak copy contains no "verdict"
    - Silent_Fallback copy and "Light another candle" render; clicking makes exactly 1 new request; retry disabled while in flight; non-200, bad body and 30 s timeout show Silent within 1 s
    - Settled state: the full transcript is present as plain text and announced once
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 9.3, 9.4, 9.6, 9.8, 9.9, 10.1, 10.9, 10.10, 10.12, 10.13, 10.14, 16.5, 16.6, 16.9, 16.10, 18.2, 18.4, 18.6, 18.9, 20.5, 20.9, 20.12, 20.15, 20.30_

  - [x] 13.5 Write DOM tests for the sample estate
    - Create `tests/dom/SeanceEstate.test.tsx`
    - For each fixture repo, opening a séance makes 0 `fetch` calls and 0 LLM calls and is ready within 500 ms of starting; ritual and transcript behave as for a live séance
    - Missing fixture and invalid fixture show the Silent_Fallback with 0 network requests and the panel stays open
    - _Requirements: 2.1, 2.2, 2.7, 2.8, 2.9, 20.10_

  - [x] 13.6 Write DOM tests for the verdict card
    - Create `tests/dom/SeanceVerdict.test.tsx`
    - One card per verdict value asserting headline, reason and `data-treatment`; verdict word printed; no controls in the card; 500-character reason not truncated; Kiro_Slot empty and directly after the card
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.9, 15.10, 20.16_

  - [x] 13.7 Write DOM tests for the transcript shape
    - Create `tests/dom/SeanceTranscriptShape.test.tsx`; read the `.smoke-field` rule from `globals.css` as text
    - No tail element or pseudo-element, border 0, radius 0, every fill token dark (luminance at most 0.2), no light fill
    - _Requirements: 11.2, 11.3, 20.14_

  - [x] 13.8 Write CSS-text unit tests
    - Create `tests/unit/seance-css.test.ts`
    - Only `transform`, `opacity` and `filter` animate; no flicker faster than 3 per second; reduced-motion block present; settled rule present; font sizes 16 and 15 px; focus ring uses `candle-400` at 2px or more; `user-select` and `pointer-events` not disabled on the transcript; ritual surge brightness inside 1.2 to 1.5
    - _Requirements: 10.5, 10.7, 10.8, 10.14, 11.5, 11.6, 11.8, 13.5, 13.6, 13.7, 18.5, 18.8, 18.9_

  - [x] 13.9 Write source-scan unit test
    - Create `tests/unit/no-hardcoded-hex-seance.test.ts` (a new file; the existing `no-hardcoded-hex` test is not edited)
    - Scan `components/seance/` and `components/detail/` for hex, `rgb(`, `rgba(`, `hsl(`, `hsla(` literals using the same regex as the existing test; also scan for `dangerouslySetInnerHTML` and audio APIs (`Audio`, `AudioContext`, `<audio`, `speechSynthesis`)
    - _Requirements: 6.11, 13.3, 16.3, 17.5, 20.21_

  - [x] 13.10 Write DOM tests for the panel polish
    - Create `tests/dom/DetailPanelPolish.test.tsx`
    - Font classes by role (heading, fact, narrative), facts section before AI section, "AI · from the facts above" appears only on the AI section, Escape closes when idle and is claimed (no close) during a ritual or reveal, focus trap includes Skip and Copy controls
    - No pixel or screenshot comparison against `Seance.dc.html`
    - _Requirements: 10.10, 10.11, 17.2, 17.3, 17.4, 17.8, 18.11, 20.31_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Run `npx vitest --run`, `npx tsc --noEmit` and `npm run lint`. Do not run `next build` or start a dev server. Confirm `.env.local` is untouched and unstaged. Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Manual visual review (for the user)
  - The user compares the Detail_Panel and séance states against `docs/design-canvas/Seance.dc.html` (also `Verdicts.dc.html` and `States.dc.html`) at 390 px and 1440 px in their own running dev server; `/design-review` can help
  - Check spacing, typography, badge appearance, ritual layer placement, smoke field edges, verdict treatments and reduced-motion behaviour
  - This is verified by eye, not by automated pixel tests (17.1, 20.31); the coding agent does not run or start the app
  - _Requirements: 17.1, 20.31_

## Notes

- Tests are required in this project. Every test sub-task above is a normal (non-optional) task.
- Each task references requirement clauses for traceability; each property test names its design property.
- Property tests use fast-check with at least 100 runs; unit and DOM tests cover examples, copy, CSS-text checks and integration points.
- Tasks that write to the same file (for example `globals.css`, or one property test file) are placed in different waves.
- Task 15 is a manual task for the user and is not part of the dependency graph.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "5.1", "6.1", "9.1", "9.2", "9.3"] },
    { "id": 1, "tasks": ["1.3", "2.2", "2.3", "3.1", "5.2", "6.2", "6.5", "9.4", "9.5", "9.6", "9.9", "9.10", "11.1"] },
    { "id": 2, "tasks": ["2.4", "3.2", "3.3", "4.1", "6.3", "6.6", "9.7", "9.11", "9.13", "10.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 3, "tasks": ["2.5", "3.4", "3.8", "4.2", "4.3", "6.4", "7.1", "9.8", "9.12", "10.2", "11.7"] },
    { "id": 4, "tasks": ["3.5", "7.2", "7.3", "7.7", "12.1", "13.1", "13.6", "13.7", "13.8"] },
    { "id": 5, "tasks": ["3.6", "7.4", "7.8", "7.9", "12.2", "12.3", "13.2", "13.4", "13.9", "13.10"] },
    { "id": 6, "tasks": ["3.7", "7.5", "13.3", "13.5"] },
    { "id": 7, "tasks": ["7.6"] }
  ]
}
```
