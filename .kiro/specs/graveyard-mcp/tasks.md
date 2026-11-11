# Implementation Plan: graveyard-mcp

## Overview

This plan builds graveyard-mcp in dependency order. Root tooling and the MCP package scaffold come first, so later tasks type-check, lint and test cleanly. The app side follows: a pure payload builder, a bucket limiter and the `GET /api/graveyard/[owner]` route, each with tests. The MCP modules (validator, cap, formatters, client) come next, then the server with manual `ListTools` and `CallTool` handlers, in-memory transport tests, a bundle smoke test, and the Kiro wiring and docs.

Every test task is required. Property tests use fast-check with at least 100 runs and a `// Feature: graveyard-mcp, Property N: <title>` comment. Tests never use the real network or an LLM.

Command restrictions apply to every task:

- Allowed commands are `npx vitest --run`, `npx tsc --noEmit`, `npm run lint`, `npm run mcp:typecheck`, and the MCP package's own scripts `npm run mcp:install` and `npm run mcp:build`.
- Never run `next build`, and never run a dev server or any watcher.
- Never delete or weaken existing tests. Run vitest with `--run` so it executes once.
- Do not add `esbuild` or `@modelcontextprotocol/sdk` to the root `package.json`.

## Tasks

- [x] 1. Root tooling: tsconfig exclude, lint ignore, scripts, vitest project
  - [x] 1.1 Update root config files and scripts
    - In root `tsconfig.json`, change `"exclude": ["node_modules"]` to `["node_modules", "mcp/**"]` and change nothing else.
    - In `eslint.config.mjs`, add `"mcp/graveyard-mcp/dist/**"` to `globalIgnores`.
    - In `.gitignore`, add `/mcp/graveyard-mcp/node_modules` and `/mcp/graveyard-mcp/dist`.
    - In root `package.json`, add exactly three scripts and no dependency: `mcp:install` (`npm ci --prefix mcp/graveyard-mcp`), `mcp:build` (`npm run build --prefix mcp/graveyard-mcp`) and `mcp:typecheck` (`tsc -p mcp/graveyard-mcp --noEmit`).
    - _Requirements: 12.5, 2.1_

  - [x] 1.2 Add the `mcp` Vitest project and dependency preflight
    - In `vitest.config.ts`, add a third project `mcp` with `include: ["mcp/graveyard-mcp/tests/**/*.test.ts"]`, `environment: "node"`, `extends: true`, `resolve.alias: { "@": <repo root> }` and `globalSetup` pointing at `mcp/graveyard-mcp/tests/preflight.ts`.
    - Create `mcp/graveyard-mcp/tests/preflight.ts`: fail with the single line `graveyard-mcp dependencies are missing. Run: npm run mcp:install` when `mcp/graveyard-mcp/node_modules/@modelcontextprotocol/sdk` does not exist.
    - Leave the existing `unit` and `dom` projects unchanged.
    - _Requirements: 14.1, 2.1_

  - [x] 1.3 Write the static test that the root tsconfig excludes `mcp/**`
    - Create `tests/unit/tsconfig-excludes-mcp.test.ts`.
    - Read the root `tsconfig.json` as text, strip `//` and `/* */` comments and trailing commas, parse it, and assert `exclude` is an array that contains `"mcp/**"` and still contains `"node_modules"`.
    - The test must not need the MCP install, so it runs on a fresh clone.
    - _Requirements: 2.1, 12.5_

- [x] 2. MCP package scaffold
  - [x] 2.1 Create the package files and install dependencies
    - Create `mcp/graveyard-mcp/package.json`: `name` `graveyard-mcp`, `version` `0.1.0`, `private` true, `"type": "module"`, `scripts.build` `node build.mjs`.
    - Pin exactly, with no range operator: `@modelcontextprotocol/sdk` `1.32.2` and `zod` `4.6.7` under `dependencies`, and `esbuild` `0.28.2` under `devDependencies`.
    - Create the standalone `mcp/graveyard-mcp/tsconfig.json` from the design (no `extends`, `paths` `@/*` mapped to `../../*`, `include` `src/**/*.ts` and `tests/**/*.ts`).
    - Create `mcp/graveyard-mcp/build.mjs` with the esbuild JS API: entry `src/index.ts`, outfile `dist/index.js`, `bundle`, `platform: "node"`, `format: "esm"`, `target: "node18"`, the package tsconfig, `alias: { zod: <pkg>/node_modules/zod }`, and the `createRequire` banner.
    - Generate `package-lock.json` with `npm install --save-exact --prefix mcp/graveyard-mcp`, commit it, then confirm `npm run mcp:install` succeeds.
    - Check that root `package.json` dependencies are unchanged.
    - _Requirements: 2.1, 2.2, 2.8, 2.9, 2.10, 12.5_

  - [x] 2.2 Implement `config.ts` (`parseBaseUrl`)
    - Create `mcp/graveyard-mcp/src/config.ts`.
    - `undefined` or `""` returns `http://localhost:3000`.
    - Otherwise accept only a parseable `http:` or `https:` URL and return `origin + pathname` with trailing slashes removed and the query and hash dropped.
    - On failure return the fixed line `GRAVEYARD_URL must be a valid http or https URL.`, which never contains the input.
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 2.3 Write property test for base URL parsing
    - Create `mcp/graveyard-mcp/tests/config.property.test.ts`.
    - **Property 16: Base URL parsing**
    - **Validates: Requirements 2.4, 2.5**

- [x] 3. App side: pure graveyard payload builder
  - [x] 3.1 Implement `lib/graveyard-payload.ts`
    - Create the pure module with `buildGraveyardPayload(owner, data, nowIso)`, `compareEntries`, `compareCodePoints`, `mapLoadError(error, nowMs)` and `retryAfterFromReset(resetAt, nowMs)`.
    - Do not import `server-only`, and do no I/O or clock reads.
    - Classify each repo with `classify(repo, undefined, nowIso)`, and emit only `name`, `state`, `decay`, `pushedAt` (ISO UTC or `null`), `stars` (non-negative integer) and `html_url` (from `RepoFacts.url`).
    - Build `counts` with all five states plus `total`.
    - Order entries by instant descending, ties by code-point `name` ascending, `null` dates last by `name`.
    - `mapLoadError` follows the design table (400, 404, 429, 502) and drops `detail`.
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.13, 1.14, 1.15, 1.16, 1.17_

  - [x] 3.2 Write property tests for entries, counts and ordering
    - Create `tests/property/graveyard-payload.property.test.ts`, reusing arbitraries from `tests/property/arbitraries.ts` where they fit and extending them with null dates, future dates and astral names.
    - **Property 1: Entry correctness**
    - **Validates: Requirements 1.3, 1.6, 1.7, 1.8, 1.9**
    - **Property 2: Counts are consistent**
    - **Validates: Requirements 1.4, 1.5**
    - **Property 3: Ordering**
    - **Validates: Requirements 1.10**

  - [x] 3.3 Write property tests for Retry-After and error mapping
    - Create `tests/property/graveyard-errors.property.test.ts`.
    - **Property 4: Retry-After from a reset time**
    - **Validates: Requirements 1.15, 1.16**
    - **Property 5: Load errors map to fixed responses without detail**
    - **Validates: Requirements 1.13, 1.14, 1.15, 1.16, 1.17**

- [x] 4. App side: bucket limiter and route
  - [x] 4.1 Add `createBucketLimiter` to `lib/ratelimit.ts`
    - Add `GRAVEYARD_ROUTE_BUCKET = "graveyard-route"`, `BucketConfig`, `BucketVerdict`, `BucketLimiter` and `createBucketLimiter(store, clock, config)`.
    - Use a sliding window on the sorted-set key `ratelimit:<bucket>:<ip>` with the same `RateLimitStore` interface.
    - Fall back to an in-memory map when the store is `null` or throws.
    - `retryAfter` is `Math.max(1, Math.ceil(windowMs / limit / 1000))`.
    - Leave existing exports and behaviour unchanged, and do not edit existing tests.
    - _Requirements: 1.19, 1.20, 1.21, 1.22_

  - [x] 4.2 Write property test for the bucket limiter
    - Create `tests/property/bucket-limiter.property.test.ts` with a map-backed fake store, a `null` store, a throwing store and an injected clock.
    - **Property 6: Rolling-window limit per IP and bucket**
    - **Validates: Requirements 1.19, 1.20, 1.21, 1.22**

  - [x] 4.3 Implement `app/api/graveyard/[owner]/route.ts`
    - Import `server-only`, and `await ctx.params` per Next.js 16 (no `dynamic` export).
    - Consume the dedicated limiter (bucket `graveyard-route`, 60 per 3 600 000 ms) with the IP from `clientIp(request.headers.get("x-forwarded-for"))` before calling `loadGraveyard`.
    - When denied, respond 429 with `{ "error": "rate-limited" }` and an integer `Retry-After` of at least 1, without calling `loadGraveyard`.
    - Call `loadGraveyard(owner, { transport: createGithubTransport(), cache: redis })` once, then `buildGraveyardPayload` or `mapLoadError`.
    - Wrap the body in `try/catch` to return 502 `{ "error": "server-error" }` with no error text.
    - Send `Cache-Control: no-store` on every response, and read no cookie or session.
    - _Requirements: 1.1, 1.2, 1.11, 1.12, 1.18, 1.19, 1.22_

  - [x] 4.4 Write route tests
    - Create `tests/unit/graveyard-route.test.ts`, following `tests/unit/seance-route.test.ts` (`vi.hoisted` plus `vi.mock` for `@/lib/graveyard-loader`, `@/lib/github`, `@/lib/ratelimit-store` and `createBucketLimiter`).
    - Install a `fetch` stub that throws, so any network attempt fails the test.
    - Cover the 200 case with at least 3 repos with differing push dates, one pair with equal dates and one `null` date: status, exact top-level keys, exact six entry fields, ordering, counts sum, and ISO or `null` `pushedAt`.
    - Cover each named error case (`invalid-username`, `not-found`, `rate-limited` with and without a reset time, `server-error`, thrown error) for status, body and `no-store`, and use a marker string to prove no detail or error message leaks.
    - Cover a denied limiter: 429, body, integer `Retry-After` of at least 1, `no-store`, and zero `loadGraveyard` calls.
    - Verify the limiter bucket name, the limit of 60 per hour and the client IP, and that `loadGraveyard` is called once with the owner and `{ transport, cache }`.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13, 13.14_

- [x] 5. MCP pure modules: payload schema, validator, cap, formatters
  - [x] 5.1 Implement `payload.ts` and `validate.ts`
    - Create `mcp/graveyard-mcp/src/payload.ts`: `STATES`, `repoEntrySchema` and `graveyardPayloadSchema` (zod 4), with refinements that the five counts sum to `total` and that `total` equals `repos.length`.
    - Create `mcp/graveyard-mcp/src/validate.ts`: `OWNER_PATTERN_TEXT`, `REPO_PATTERN_TEXT`, `isValidOwner`, `isValidRepo` and `checkArgs(args, needsRepo)`.
    - `checkArgs` reports `owner` first when both are bad, echoes at most 40 code points through `sanitiseInline`, and echoes nothing for non-strings.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 1.5_

  - [x] 5.2 Implement `cap.ts`
    - Create `mcp/graveyard-mcp/src/cap.ts` with `RESULT_CAP` (12288), `TRUNCATION_MARKER`, `byteLength` and `capResult(head, body)`.
    - Return unchanged when within the cap, otherwise cut at whole-line boundaries, drop body lines from the end, iterate code points when even the first line does not fit, and end with the marker line.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 5.3 Implement `format.ts`
    - Create `mcp/graveyard-mcp/src/format.ts` with `HEADINGS` (four literals), `decayLabel`, `daysQuiet`, `findRepo` (ASCII-only lower-casing), `formatList`, `formatGrave`, `formatSeanceOk`, `formatSeanceOther`, `formatBriefOk`, `fenceFor` and the `isInert` guard.
    - Use `DATA_NOTICE`, `sanitiseInline`, `buildReviveBrief` and `buildKiroPrompt` from `@/lib/revive-brief`, and `seanceResponseSchema` types from `@/lib/seance-schema`, and import nothing else from the app.
    - Place the notice before any séance-derived text, build each value after a fixed label, and never build a heading from data.
    - Embed the brief and prompt byte-for-byte inside fences longer than any backtick run in the text.
    - Fail closed with `The app returned unexpected text.` if a sanitised value still looks like a heading, setext underline, fence, block quote or notice copy.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.5, 7.2, 7.3, 7.6, 7.7, 7.8, 7.9, 8.3, 8.4, 8.5, 8.6, 8.8, 8.9, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 5.4 Write property test for the name validator
    - Create `mcp/graveyard-mcp/tests/validate.property.test.ts` with generators for valid names, near-misses (leading, trailing and doubled hyphens, length 39/40 and 100/101, `.`, `..`), strings with `/ ? # %`, whitespace, control and non-ASCII characters, and arbitrary strings, checked against an independent reference predicate.
    - **Property 7: Name validator accepts exactly the valid names and blocks I/O on rejection** (validator accept-iff part; the tool-level part is task 8.8)
    - **Validates: Requirements 4.3, 4.4, 4.5**

  - [x] 5.5 Write property tests for days quiet, decay label and repo lookup
    - Create `mcp/graveyard-mcp/tests/format.property.test.ts`.
    - **Property 9: Days quiet and decay label are total and bounded**
    - **Validates: Requirements 5.2, 5.3**
    - **Property 10: Repo lookup is ASCII case-insensitive**
    - **Validates: Requirements 6.1**

  - [x] 5.6 Write property test for the result cap
    - Create `mcp/graveyard-mcp/tests/cap.property.test.ts` with very long lines, multi-byte and astral characters, and a head that alone exceeds the cap.
    - **Property 13: Result cap**
    - **Validates: Requirements 6.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**

  - [x] 5.7 Write contract property test between route and client schema
    - Create `mcp/graveyard-mcp/tests/contract.property.test.ts` importing `@/lib/graveyard-payload` and `../src/payload`.
    - Check that every built payload passes `graveyardPayloadSchema` and that `formatList` emits one repo line per entry in payload order.
    - **Property 18: Route payload satisfies the client contract**
    - **Validates: Requirements 1.5, 5.1, 5.4**

- [x] 6. MCP Graveyard_Client with timeouts and error mapping
  - [x] 6.1 Implement `client.ts`
    - Create `mcp/graveyard-mcp/src/client.ts` with `createClient({ baseUrl, fetch, timers })` returning `getGraveyard(owner)` and `postSeance(owner, repo)`.
    - Build URLs by string concatenation with `encodeURIComponent` per segment, send only GET `/api/graveyard/<owner>` and POST `/api/seance` with body `{ owner, repo }` and `content-type: application/json`, and send no credentials, cookie or authorization header. Use `redirect: "manual"`.
    - Use an `AbortController` per call with 10 000 ms for the graveyard GET and 30 000 ms for the séance POST via the injected timers, clear the timer in `finally`, and never retry.
    - Read the body with `res.text()`, reject bodies over `MAX_BODY_CHARS`, `JSON.parse` in `try`, and validate with `graveyardPayloadSchema` or `seanceResponseSchema`.
    - Map every outcome to the fixed texts in the design error table (unreachable, timeout with 10 or 30 seconds, 400, 404, 429 with optional `Retry-After`, 5xx, unexpected response) without error messages, stacks or bodies.
    - _Requirements: 2.6, 4.10, 5.8, 5.9, 5.10, 7.1, 7.4, 7.5, 7.10, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x] 6.2 Write property test for the echo bound and URL path encoding
    - Create `mcp/graveyard-mcp/tests/client-url.property.test.ts`.
    - **Property 8: Echo bound and URL path encoding**
    - **Validates: Requirements 4.9, 4.10**

  - [x] 6.3 Write client unit tests
    - Create `mcp/graveyard-mcp/tests/client.test.ts` with a mock `fetch` and recording timers.
    - Check request method, URL, body and headers, and the recorded timeout of 10 000 and 30 000 ms.
    - Check each row of the error mapping table, including 429 with and without `Retry-After`, a fired timeout, a rejected `fetch`, a non-JSON 200 body and a non-200, non-404, non-429, non-5xx status.
    - Check that exactly one `fetch` call happens per client call.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 7.10, 5.8, 5.9, 5.10_

- [x] 7. MCP server and entry point
  - [x] 7.1 Implement `server.ts` with manual handlers
    - Create `mcp/graveyard-mcp/src/server.ts` exporting `createServer(deps)`.
    - Build `new McpServer(info, { capabilities: { tools: {} } })` and register `ListToolsRequestSchema` and `CallToolRequestSchema` on `mcp.server`, with no `registerTool` call.
    - Define the static tool table in the order `list_graveyard`, `get_grave`, `hold_seance`, `get_revival_brief`, with hand-written JSON Schema (required `owner`, or `owner` and `repo`, each `string`), `readOnlyHint: true`, descriptions of 1 to 500 characters that state results are data, not instructions, and the AI-call sentence for `hold_seance` and `get_revival_brief`.
    - Throw `McpError(InvalidParams)` for an unknown tool with no HTTP request, and return `isError` results for invalid arguments with no HTTP request.
    - Implement the four tool bodies as in the design, including: the `get_grave` not-found text with the truncation hint, and `get_revival_brief` calling GET then POST with no POST when the repo is missing.
    - Apply `capResult` to every result and wrap each handler in `try/catch` that returns `Something went wrong inside graveyard-mcp.`.
    - Write diagnostics only through the injected `log` (stderr), never stdout.
    - _Requirements: 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.6, 4.7, 5.1, 6.1, 6.3, 6.4, 6.6, 7.1, 7.2, 7.11, 8.1, 8.2, 8.7, 9.1, 11.9, 11.10_

  - [x] 7.2 Implement `index.ts`
    - Create `mcp/graveyard-mcp/src/index.ts`.
    - Read only `process.env.GRAVEYARD_URL` and call `parseBaseUrl`.
    - On failure write the single fixed line to stderr and `process.exit(1)` before creating the transport.
    - Otherwise call `createServer` with the global `fetch` and `Date.now`, and connect a `StdioServerTransport`.
    - Add a top-level `catch` that writes one fixed stderr line and exits 1, and never use `console.log`.
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 11.10_

- [x] 8. In-memory MCP tests
  - [x] 8.1 Create the test harness
    - Create `mcp/graveyard-mcp/tests/harness.ts` exporting `createHarness({ respond, nowMs })`.
    - Build `createServer` with a mock `fetch`, a fixed clock and recording timers, link a `Client` with `InMemoryTransport.createLinkedPair()`, and record each call's URL, method, headers, body and timeout.
    - Expose `fireTimeout()` to abort the in-flight request and `close()`.
    - _Requirements: 14.1_

  - [x] 8.2 Write example tests for the tools
    - Create `mcp/graveyard-mcp/tests/server.test.ts`.
    - `tools/list`: exactly four tools in order, with required properties, string types, description limits and sentences, and `readOnlyHint: true`.
    - Unknown tool gives code `-32602` and zero fetches.
    - Per-tool fixtures check exact Tool_Result text, method, URL, body and timeout (10 000 and 30 000).
    - Check one invalid owner and one invalid repo per applicable tool (`isError`, zero fetches), and connection refused for all four tools (unreachable text, no stack or path).
    - Check `veil`, `weak` and `silent` for `hold_seance` and `get_revival_brief` (no `isError`) and the `finish` and `seal` verdicts.
    - Check the hostile séance fixture (heading, setext underline, fence, block quote, notice copy), oversized input ending in the marker within 12 288 bytes, and unchanged input within the cap.
    - Check the inertness guard with an identity sanitiser injected, a handler exception followed by a successful call, timeout text with 10 or 30 seconds, two `hold_seance` calls giving two fetches, and the empty, truncated, 404, 429 and 400 graveyard cases.
    - Check the `get_revival_brief` revive result's `REVIVAL.md` and Kiro prompt text byte for byte against `buildReviveBrief` and `buildKiroPrompt`.
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.11, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.11, 9.7, 11.9_

  - [x] 8.3 Write property test for untrusted text
    - Create `mcp/graveyard-mcp/tests/untrusted.property.test.ts` with a hostile-string arbitrary (all heading levels, setext rows, backtick and tilde fences, block quotes, list markers, newline variants, notice copies with altered whitespace and case, arbitrary Unicode) applied to séance fields and payload names.
    - **Property 11: Untrusted text stays inert and after the notice**
    - **Validates: Requirements 5.7, 6.5, 7.3, 9.2, 9.3, 9.4, 9.5, 9.6**

  - [x] 8.4 Write property test for revival output embedding
    - Create `mcp/graveyard-mcp/tests/revival.property.test.ts` with a constructive `SeanceResult` arbitrary filtered by `seanceResponseSchema.safeParse`.
    - **Property 12: Revival output is embedded byte for byte**
    - **Validates: Requirements 8.3, 8.8, 8.9**

  - [x] 8.5 Write property test for failure leakage
    - Create `mcp/graveyard-mcp/tests/failures.property.test.ts` using marker strings in rejection messages and stacks, arbitrary 5xx and non-conforming 200 bodies, and other statuses.
    - **Property 14: Failures never leak bodies, errors or paths**
    - **Validates: Requirements 7.5, 7.10, 11.3, 11.5, 11.6, 11.7, 11.8, 11.10**

  - [x] 8.6 Write property test for non-ok séance outcomes
    - Create `mcp/graveyard-mcp/tests/outcomes.property.test.ts` using `veil`, `weak` and `silent` bodies with arbitrary extra fields.
    - **Property 15: Non-ok séance outcomes return fixed text**
    - **Validates: Requirements 7.6, 7.7, 7.8, 7.9, 8.6**

  - [x] 8.7 Write property test for the allowed request shapes
    - Create `mcp/graveyard-mcp/tests/requests.property.test.ts`.
    - **Property 17: Only the two allowed request shapes are sent**
    - **Validates: Requirements 2.6, 7.1, 8.1, 8.2**

  - [x] 8.8 Write property test for tool-level validation
    - Create `mcp/graveyard-mcp/tests/tool-validation.property.test.ts`, calling every tool with generated invalid or missing arguments through the harness.
    - **Property 7: Name validator accepts exactly the valid names and blocks I/O on rejection** (tool-level part: `isError`, offending argument named with `owner` first, zero fetches)
    - **Validates: Requirements 3.7, 4.1, 4.2, 4.6, 4.7, 4.8**

- [x] 9. Bundle smoke check and static scans
  - [x] 9.1 Write the bundle smoke and entry process tests
    - Create `mcp/graveyard-mcp/tests/bundle.test.ts` with a 30 000 ms timeout.
    - Build the bundle with the esbuild logic from `build.mjs` into a `mkdtemp` directory under the OS temp folder (no ancestor `node_modules`), write `{"type":"module"}` beside it, spawn `node index.js`, send an MCP `initialize` request on stdin, and expect a valid JSON-RPC response on stdout and nothing else on stdout. Remove the directory afterwards.
    - Spawn the bundle with `GRAVEYARD_URL=ftp://x` and assert exit code 1, one stderr line of at most 200 characters naming `GRAVEYARD_URL`, and empty stdout.
    - Also confirm `npm run mcp:build` produces `mcp/graveyard-mcp/dist/index.js`.
    - _Requirements: 2.5, 2.9, 12.2_

  - [x] 9.2 Write static source and package scans
    - Create `mcp/graveyard-mcp/tests/static.test.ts`.
    - Scan `src/**/*.ts`: the only `process.env` access is `GRAVEYARD_URL`; no import of `fs`, `node:fs`, `child_process` or `node:child_process`; app imports are limited to the allowed set in Requirement 2.8; no `console.log`, `console.info` or `process.stdout.write`; and no `credentials`, `cookie` or `authorization` token in `client.ts`.
    - Parse `mcp/graveyard-mcp/package.json` for exact pins (no `^`, `~` or range), `zod` major 4, `"type": "module"` and `esbuild` as a devDependency.
    - Parse the root `package.json` for the three `mcp:*` scripts and for the absence of `esbuild` and `@modelcontextprotocol/sdk` in both dependency maps.
    - _Requirements: 2.1, 2.3, 2.6, 2.7, 2.8, 11.10, 12.5_

- [x] 10. Kiro wiring and documentation
  - [x] 10.1 Create `.kiro/settings/mcp.json`
    - Register exactly one server `graveyard` under `mcpServers` with `command` `node`, `args` `["mcp/graveyard-mcp/dist/index.js"]` and `env` `{ "GRAVEYARD_URL": "http://localhost:3000" }`.
    - Include no other environment variable and no token, key or secret.
    - If the file already exists, keep it valid JSON and make sure `graveyard` is the only server.
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 10.2 Add the README section
    - Add a section titled "Use the graveyard from Kiro" to `README.md` (create the file if it is missing).
    - State the build commands `npm run mcp:install` then `npm run mcp:build`, the start command `npm run dev`, what `GRAVEYARD_URL` controls and its default `http://localhost:3000`.
    - List `list_graveyard`, `get_grave`, `hold_seance` and `get_revival_brief` by name with one sentence each.
    - _Requirements: 12.6_

  - [x] 10.3 Add the `docs/KIRO_JOURNEY.md` entry
    - Append an entry with at least one paragraph on each of: the graveyard-mcp spec, the isolation and no-secrets design, and the untrusted-text handling.
    - Create the file if it is missing.
    - _Requirements: 12.7_

  - [x] 10.4 Write config and docs checks
    - Create `mcp/graveyard-mcp/tests/wiring.test.ts`.
    - Parse `.kiro/settings/mcp.json` and assert one server `graveyard`, command `node`, the relative path, only `GRAVEYARD_URL` in `env`, no secret-like keys or values, and that the path resolves after `mcp:build`.
    - Assert `README.md` contains the section title, the build and start commands, `GRAVEYARD_URL` with its default, and the four tool names.
    - Assert `docs/KIRO_JOURNEY.md` has an entry covering the spec, isolation and untrusted-text handling.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Run `npm run mcp:install`, `npm run mcp:build`, `npm run mcp:typecheck`, `npx vitest --run`, `npx tsc --noEmit` and `npm run lint`, and fix any failure.
  - Do not run `next build`, a dev server or a watcher.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Every test task is required, including property tests and the tsconfig static test. No task is marked optional.
- Each property test references its design property number and the requirement clauses it validates.
- Property 7 is split across two tasks: the validator accept-iff part (5.4) and the tool-level no-I/O part (8.8).
- Tests that need the MCP SDK require `npm run mcp:install` first; the preflight in task 1.2 fails with the fix in its message.
- Never run `next build`, never delete existing tests, and never edit existing tests except to add new cases.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "10.1", "10.2", "10.3"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "3.2", "4.2", "4.3", "5.1", "5.2"] },
    { "id": 2, "tasks": ["2.3", "3.3", "4.4", "5.3", "5.4", "5.6", "6.1"] },
    { "id": 3, "tasks": ["5.5", "5.7", "6.2", "6.3", "7.1"] },
    { "id": 4, "tasks": ["7.2", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "9.1", "9.2"] },
    { "id": 6, "tasks": ["10.4"] }
  ]
}
```
