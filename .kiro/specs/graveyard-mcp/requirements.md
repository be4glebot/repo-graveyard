# Requirements Document

## Introduction

graveyard-mcp is a small, read-only Model Context Protocol server that lets Kiro (or any MCP client) consult a Repo Graveyard. It lives in `mcp/graveyard-mcp/` as its own package (TypeScript, `@modelcontextprotocol/sdk`, `zod`, stdio transport), isolated from the Next.js app's dependencies. The server holds no secrets: it only calls the Repo Graveyard app over HTTP at `GRAVEYARD_URL` (default `http://localhost:3000`). GitHub and LLM keys stay inside the app.

The feature has three parts:

- One new read-only app route, `GET /api/graveyard/[owner]`, that returns the classified graveyard as JSON. It reuses `loadGraveyard` (and so its cache and rate limits) and serves public data only.
- Four read-only MCP tools: `list_graveyard`, `get_grave`, `hold_seance` and `get_revival_brief`. The séance tools POST to the existing `/api/seance`, so that route's cache, limiter and daily budget still apply.
- Kiro wiring and documentation: a committed `.kiro/settings/mcp.json`, an npm build script, a README section and a `docs/KIRO_JOURNEY.md` entry.

Séance text derives from READMEs and commits, so it is untrusted. Tool results place that text after the `DATA_NOTICE` and pass it through `sanitiseInline` (both from `lib/revive-brief.ts`). The revival brief and Kiro prompt are built with `buildReviveBrief` and `buildKiroPrompt` from the same module.

Scope limits:

- No write tools exist. The server never changes GitHub, the app's overrides or any stored data.
- Tests use mocked `fetch` and the SDK's in-memory transport. No real network or AI calls happen in tests.
- The MCP package is not part of the Next.js build and adds no dependency to the root `package.json`.

## Glossary

- **Graveyard_MCP**: The MCP server in `mcp/graveyard-mcp/`, speaking stdio.
- **Graveyard_App**: The Repo Graveyard Next.js application reached over HTTP.
- **Graveyard_Route**: The route handler `GET /api/graveyard/[owner]` in the Graveyard_App.
- **Seance_Route**: The existing `POST /api/seance` route handler.
- **Graveyard_Client**: The module inside Graveyard_MCP that performs HTTP calls to the Graveyard_App.
- **App_Base_URL**: The value of the `GRAVEYARD_URL` environment variable, or `http://localhost:3000` when unset or empty.
- **Graveyard_Payload**: The JSON returned by the Graveyard_Route: `{ owner, counts, truncated, repos }`.
- **Repo_Entry**: One element of `repos` in the Graveyard_Payload: `{ name, state, decay, pushedAt, stars, html_url }`.
- **State**: One of `ghost`, `risen`, `zombie`, `tombstone` or `coffin`, as produced by `classify` in `lib/lifecycle.ts`.
- **Decay_Label**: A short text for the decay level of a Repo_Entry (for example `fading` or `ancient`), or `none` for states without a decay level.
- **Counts**: An object with one non-negative integer per State, plus `total`.
- **Tool**: One of the four MCP tools exposed by Graveyard_MCP.
- **Tool_Result**: The text content returned by a Tool call.
- **Name_Validator**: The function in Graveyard_MCP that checks owner and repo strings against GitHub's naming rules.
- **Valid_Owner**: A string of 1 to 39 characters from `A-Z a-z 0-9 -`, that neither starts nor ends with `-` and contains no `--`.
- **Valid_Repo**: A string of 1 to 100 characters from `A-Z a-z 0-9 . _ -`, that is neither `.` nor `..`.
- **Result_Cap**: 12288 bytes of UTF-8, the maximum size of one Tool_Result.
- **Truncation_Marker**: The fixed line `[result truncated]` appended when a Tool_Result is cut to fit the Result_Cap.
- **Data_Notice**: The constant `DATA_NOTICE` exported by `lib/revive-brief.ts`.
- **Sanitiser**: The function `sanitiseInline` exported by `lib/revive-brief.ts`.
- **Seance_Outcome**: The JSON returned by the Seance_Route, of kind `ok`, `veil`, `weak` or `silent`.
- **Revival_Output**: The pair of `REVIVAL.md` text (from `buildReviveBrief`) and Kiro prompt text (from `buildKiroPrompt`).
- **Unreachable_Message**: The text `Repo Graveyard isn't reachable at <App_Base_URL>.` followed by a hint to start the app or set `GRAVEYARD_URL`.
- **Kiro_MCP_Config**: The file `.kiro/settings/mcp.json`.
- **MCP_Test_Harness**: A Vitest setup that connects an MCP client to Graveyard_MCP through the SDK's in-memory transport with `fetch` replaced by a mock.
- **MCP_Bundle**: The single file `mcp/graveyard-mcp/dist/index.js` produced by the MCP package's build script with esbuild.
- **Route_Limiter**: The existing per-IP rate limiter in `lib/ratelimit.ts`, used by the Graveyard_Route with its own bucket of 60 requests per hour per IP, with the same in-memory fallback used elsewhere when Redis is unavailable.

## Requirements

### Requirement 1: Graveyard route returns the classified graveyard

**User Story:** As an MCP client author, I want a small JSON endpoint for a user's classified graveyard, so that Graveyard_MCP can answer questions without any GitHub credentials.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/graveyard/[owner]` with a Valid_Owner whose graveyard loads, THE Graveyard_Route SHALL respond with status 200 and a Graveyard_Payload.
2. WHEN a GET request is made to `/api/graveyard/[owner]`, THE Graveyard_Route SHALL obtain graveyard data by calling `loadGraveyard` once with the owner and the production transport and cache dependencies, so that the existing cache and GitHub budget handling apply.
3. WHEN the Graveyard_Route builds a Graveyard_Payload, THE Graveyard_Route SHALL classify each repository with `classify` from `lib/lifecycle.ts`, using the current time injected as a parameter, and apply no overrides.
4. THE Graveyard_Route SHALL set `counts` to the number of Repo_Entry items per State, with each of the five States present as a non-negative integer (0 when no repo has that State), and a `total` equal to the length of `repos`.
5. FOR ALL Graveyard_Payload values, including a payload with zero repos, the sum of the five State counts SHALL equal `counts.total`, and `counts.total` SHALL equal the length of `repos`.
6. THE Graveyard_Route SHALL return, for each Repo_Entry, only the fields `name`, `state`, `decay`, `pushedAt`, `stars` and `html_url`, where `decay` is the integer decay level for the State or `null` for States without a decay level, and `stars` is a non-negative integer.
7. THE Graveyard_Route SHALL set `pushedAt` to an ISO 8601 UTC string, or to `null` when the repository has no push date.
8. THE Graveyard_Route SHALL set `html_url` to the repository's `https://github.com/` URL taken from the loaded data.
9. THE Graveyard_Route SHALL set `truncated` to the boolean value reported by `loadGraveyard`.
10. THE Graveyard_Route SHALL order `repos` by `pushedAt` descending, ties broken by `name` ascending using code-point comparison, with repositories whose `pushedAt` is `null` placed last in `name` ascending order.
11. THE Graveyard_Route SHALL send the header `Cache-Control: no-store` on every response, including error responses.
12. THE Graveyard_Route SHALL return only public repository data, read the client IP request header only for rate limiting, and read no cookie or session.
13. IF `loadGraveyard` returns `invalid-username`, THEN THE Graveyard_Route SHALL respond with status 400 and `{ "error": "invalid-username" }`.
14. IF `loadGraveyard` returns `not-found`, THEN THE Graveyard_Route SHALL respond with status 404 and `{ "error": "not-found" }`.
15. IF `loadGraveyard` returns `rate-limited` with a known reset time, THEN THE Graveyard_Route SHALL respond with status 429, `{ "error": "rate-limited" }` and a `Retry-After` header holding a whole number of seconds from now until the reset, rounded up and never below 1.
16. IF `loadGraveyard` returns `rate-limited` with no known reset time, THEN THE Graveyard_Route SHALL respond with status 429 and `{ "error": "rate-limited" }` without a `Retry-After` header.
17. IF `loadGraveyard` returns `server-error`, THEN THE Graveyard_Route SHALL respond with status 502 and `{ "error": "server-error" }` without the upstream detail text.
18. IF `loadGraveyard` throws, THEN THE Graveyard_Route SHALL respond with status 502 and `{ "error": "server-error" }` without the error message or stack trace.
19. WHEN a GET request arrives, THE Graveyard_Route SHALL check the Route_Limiter with the client IP before calling `loadGraveyard`.
20. THE Graveyard_Route SHALL use a Route_Limiter bucket dedicated to this route, with a limit of 60 requests per hour per IP, separate from the buckets of other routes.
21. WHEN Redis is unavailable, THE Route_Limiter SHALL fall back to its in-memory limiting as it does for other routes.
22. IF the Route_Limiter limit is exceeded, THEN THE Graveyard_Route SHALL respond with status 429, `{ "error": "rate-limited" }`, a `Retry-After` header holding a whole number of seconds of at least 1, and `Cache-Control: no-store`, without calling `loadGraveyard`.

### Requirement 2: Server is isolated, read-only and secret-free

**User Story:** As the app owner, I want the MCP server to hold no secrets and be isolated from the Next.js app, so that exposing it to AI tools cannot leak keys or write anywhere.

#### Acceptance Criteria

1. THE Graveyard_MCP SHALL live in `mcp/graveyard-mcp/` with its own `package.json` that declares `@modelcontextprotocol/sdk` and `zod` as dependencies, each pinned to an exact version with no range operator, where `zod` is pinned to an exact version of the same major version as the Next.js app (v4) and `@modelcontextprotocol/sdk` is pinned to an exact version that supports zod 4, and that declares `esbuild` as a devDependency at an exact version, with `esbuild` declared in the MCP package only and not added to the root `package.json`.
2. THE Graveyard_MCP SHALL communicate with its client over the stdio transport.
3. THE Graveyard_MCP SHALL read only the `GRAVEYARD_URL` environment variable and SHALL read no other environment variable, including any GitHub token or LLM key.
4. WHERE `GRAVEYARD_URL` is unset or empty, THE Graveyard_MCP SHALL use `http://localhost:3000` as the App_Base_URL.
5. IF `GRAVEYARD_URL` is set and is not a valid `http` or `https` URL, THEN THE Graveyard_MCP SHALL write a single line of at most 200 characters to standard error that names `GRAVEYARD_URL`, contains no stack trace, and exit with a non-zero exit code before accepting any client request.
6. THE Graveyard_Client SHALL send only GET requests to `/api/graveyard/[owner]` and POST requests to `/api/seance`, and SHALL send no credentials, cookies or authorization headers.
7. THE Graveyard_MCP SHALL expose no Tool that writes to GitHub, to the Graveyard_App or to the local file system.
8. THE Graveyard_MCP SHALL import no module from the Next.js app's source tree except the pure helpers `DATA_NOTICE`, `sanitiseInline`, `buildReviveBrief` and `buildKiroPrompt` from `lib/revive-brief.ts` and the schemas from `lib/seance-schema.ts`, and the build script SHALL resolve the `@/` path alias used by those modules at build time.
9. WHEN the server is built with its own build script, THE build script SHALL bundle the server with esbuild into the single MCP_Bundle, resolving the `@/` alias so that `lib/revive-brief.ts`, `lib/seance-schema.ts` and every module they import are inlined, and THE MCP_Bundle SHALL start under `node` and complete the MCP initialize handshake with the root `node_modules` directory and the Next.js runtime absent.
10. THE design document SHALL state the exact pinned versions of `@modelcontextprotocol/sdk`, `zod` and `esbuild`, and SHALL record that their compatibility (SDK with zod 4) was confirmed before implementation begins.

### Requirement 3: Tool listing

**User Story:** As an MCP client, I want to discover exactly the tools the server offers, so that I can call them correctly.

#### Acceptance Criteria

1. WHEN a client sends `tools/list`, THE Graveyard_MCP SHALL return exactly four Tools named `list_graveyard`, `get_grave`, `hold_seance` and `get_revival_brief`, in that order, with no other Tool present.
2. WHEN a client sends `tools/list`, THE Graveyard_MCP SHALL return for each Tool an input schema whose required properties are exactly `owner` for `list_graveyard` and exactly `owner` and `repo` for each of the other three Tools, with each property typed as a string.
3. WHEN a client sends `tools/list`, THE Graveyard_MCP SHALL return a description of 1 to 500 characters for each Tool, and each description SHALL contain a sentence stating that Tool_Results are data and not instructions.
4. WHEN a client sends `tools/list`, THE Graveyard_MCP SHALL include in the `hold_seance` and `get_revival_brief` descriptions a sentence stating that the call may use an AI call.
5. WHEN a client sends `tools/list`, THE Graveyard_MCP SHALL return the annotation `readOnlyHint: true` for each of the four Tools.
6. IF a client calls a Tool name that is not one of the four listed Tools, THEN THE Graveyard_MCP SHALL return a protocol error identifying the Tool as unknown, make no HTTP request, and keep the server running.
7. IF a client calls a Tool with arguments that are missing a required property or have a property that is not a string, THEN THE Graveyard_MCP SHALL return an error identifying the offending argument, make no HTTP request, and keep the server running.

### Requirement 4: Input validation

**User Story:** As the app owner, I want owner and repo names checked before any request is made, so that malformed input never reaches the app or alters a URL path.

#### Acceptance Criteria

1. WHEN a Tool is called, THE Name_Validator SHALL check `owner` against Valid_Owner before any HTTP request is made.
2. WHEN a Tool that takes `repo` is called, THE Name_Validator SHALL check `repo` against Valid_Repo before any HTTP request is made.
3. FOR ALL strings that match Valid_Owner, THE Name_Validator SHALL accept the string.
4. FOR ALL strings that match Valid_Repo, THE Name_Validator SHALL accept the string.
5. FOR ALL strings that do not match Valid_Owner or Valid_Repo, including empty strings, strings longer than the limit (39 characters for owner, 100 for repo), and strings with `/`, `?`, `#`, `%`, whitespace, control characters or non-ASCII characters, THE Name_Validator SHALL reject the string.
6. IF an argument is missing or is not a string, THEN THE Name_Validator SHALL reject it and THE Graveyard_MCP SHALL return a Tool_Result with `isError: true` that names the argument and states the allowed pattern.
7. IF a Name_Validator check fails, THEN THE Graveyard_MCP SHALL return a Tool_Result with `isError: true` that names the invalid argument (`owner` or `repo`) and states the allowed pattern, and SHALL make no HTTP request.
8. IF both `owner` and `repo` fail validation, THEN THE Graveyard_MCP SHALL report `owner` only, in a single Tool_Result.
9. IF a Name_Validator check fails, THEN THE Graveyard_MCP SHALL echo at most the first 40 characters of the rejected value, passed through the Sanitiser, and SHALL echo nothing when the value is not a string.
10. THE Graveyard_Client SHALL percent-encode each owner and repo path segment when it builds a URL.

### Requirement 5: list_graveyard tool

**User Story:** As a developer in Kiro, I want to ask which of my repos are dying, so that I can pick one to revive before it turns into a zombie.

#### Acceptance Criteria

1. WHEN `list_graveyard` is called with a Valid_Owner, THE Graveyard_Client SHALL request `/api/graveyard/[owner]` and THE Graveyard_MCP SHALL return a Tool_Result containing the Counts (one count per State plus `total`) and one line per Repo_Entry.
2. THE Graveyard_MCP SHALL show in each Repo_Entry line the name, State, Decay_Label, days quiet and star count, where days quiet is the whole number of days, floored and never negative, between `pushedAt` and the injected current time.
3. IF a Repo_Entry has `pushedAt` set to `null`, THEN THE Graveyard_MCP SHALL show `unknown` in place of days quiet for that line.
4. THE Graveyard_MCP SHALL list Repo_Entry items in the order the Graveyard_Route returned them.
5. WHEN the Graveyard_Payload has `truncated` set to true, THE Graveyard_MCP SHALL include one line stating that only the 300 most recently pushed repositories are listed.
6. WHEN the Graveyard_Payload has zero repos, THE Graveyard_MCP SHALL return a Tool_Result, without `isError`, stating that the graveyard is empty.
7. THE Graveyard_MCP SHALL pass every repository name and every other string taken from the Graveyard_Payload through the Sanitiser before it is placed in a Tool_Result.
8. IF the Graveyard_App responds with 404, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result stating that no such GitHub user or organization was found.
9. IF the Graveyard_App responds with 429, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result stating that the app is rate-limited and, WHEN a `Retry-After` header is present, the number of seconds to wait.
10. IF the Graveyard_App responds with 400, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result stating that the owner name was rejected by the app.

### Requirement 6: get_grave tool

**User Story:** As a developer in Kiro, I want the facts and state of one repo, so that I can see where it stands without opening the app.

#### Acceptance Criteria

1. WHEN `get_grave` is called with a Valid_Owner and a Valid_Repo, THE Graveyard_Client SHALL request `/api/graveyard/[owner]` and THE Graveyard_MCP SHALL return a Tool_Result for the single Repo_Entry whose name equals `repo` under ASCII case-insensitive comparison.
2. THE Graveyard_MCP SHALL show in the Tool_Result the name, State, Decay_Label, `pushedAt` as an ISO 8601 string (or the text `never` when `pushedAt` is `null`), days quiet as a whole number of days (or the text `unknown` when `pushedAt` is `null`), star count and `html_url`.
3. IF no Repo_Entry matches `repo`, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result stating that no such repo is in the graveyard and naming the sanitised `repo` value, truncated to 40 characters.
4. IF no Repo_Entry matches `repo` and the Graveyard_Payload has `truncated` set to true, THEN THE Graveyard_MCP SHALL add to the `isError` Tool_Result a line stating that the repo may be older than the listed repositories.
5. THE Graveyard_MCP SHALL pass every string taken from the Graveyard_Payload through the Sanitiser before it is placed in the Tool_Result.
6. IF the Graveyard_App responds with 404, 429 or 5xx, or cannot be reached, THEN THE Graveyard_MCP SHALL return the same `isError` Tool_Result that `list_graveyard` returns for that failure under Requirement 5 and Requirement 11, and SHALL make no further request.
7. THE Graveyard_MCP SHALL limit the `get_grave` Tool_Result to the Result_Cap.

### Requirement 7: hold_seance tool

**User Story:** As a developer in Kiro, I want the project's ghost to tell me where I left off, so that I can resume with the right context.

#### Acceptance Criteria

1. WHEN `hold_seance` is called with a Valid_Owner and a Valid_Repo, THE Graveyard_Client SHALL send exactly one POST request to `/api/seance` with a JSON body containing only the fields `owner` and `repo` and the header `Content-Type: application/json`.
2. WHEN the Seance_Outcome has kind `ok`, THE Graveyard_MCP SHALL return a Tool_Result that contains the Data_Notice followed, in this order, by the voice, the cause of death, each unfinished-business item with its evidence, the verdict and the verdict reason.
3. WHEN the Seance_Outcome has kind `ok`, THE Graveyard_MCP SHALL place every Seance_Outcome text field after the Data_Notice and pass it through the Sanitiser.
4. WHEN the Seance_Route responds with a body, THE Graveyard_MCP SHALL validate the body with `seanceResponseSchema` before using any field of it.
5. IF the Seance_Route response fails validation with `seanceResponseSchema` or is not valid JSON, THEN THE Graveyard_MCP SHALL return a Tool_Result with `isError: true` stating that the app returned an unexpected response, without including any part of the response body.
6. WHEN the Seance_Outcome has kind `veil`, THE Graveyard_MCP SHALL return a Tool_Result stating that the ghost could not be summoned right now because the séance is resting (a limit or budget was reached) and that the user can try again later.
7. WHEN the Seance_Outcome has kind `weak`, THE Graveyard_MCP SHALL return a Tool_Result stating that the repo has too little history for the ghost to say anything grounded.
8. WHEN the Seance_Outcome has kind `silent`, THE Graveyard_MCP SHALL return a Tool_Result stating that the ghost stayed silent and that the user can try again.
9. WHEN the Seance_Outcome has kind `veil`, `weak` or `silent`, THE Graveyard_MCP SHALL return the Tool_Result without `isError: true` and SHALL include no Seance_Outcome text field in it.
10. IF the Seance_Route does not complete within 30 seconds, is unreachable, or responds with a status of 500 or above, THEN THE Graveyard_MCP SHALL return the corresponding `isError: true` Tool_Result defined in Requirement 11 and SHALL NOT retry the request.
11. THE Graveyard_MCP SHALL send each `hold_seance` call to the Seance_Route without a cache, rate limiter or daily budget of its own, so that the Seance_Route alone decides whether the call is served from cache, limited or refused.

### Requirement 8: get_revival_brief tool

**User Story:** As a developer in Kiro, I want a ready-made revival brief and Kiro prompt for a repo that should be revived, so that I can start work from the séance's findings.

#### Acceptance Criteria

1. WHEN `get_revival_brief` is called with a Valid_Owner and a Valid_Repo, THE Graveyard_Client SHALL send one GET request to `/api/graveyard/[owner]` to obtain the repo's State, and THEN SHALL send one POST request to `/api/seance` to obtain a Seance_Outcome, in that order.
2. IF the repo is not in the Graveyard_Payload, THEN THE Graveyard_MCP SHALL return the same `isError` Tool_Result as `get_grave` and SHALL send no request to `/api/seance`.
3. WHEN the Seance_Outcome has kind `ok` and its verdict is `revive`, THE Graveyard_MCP SHALL return a Tool_Result that contains the Data_Notice exactly once, followed by the Revival_Output built with `buildReviveBrief` and `buildKiroPrompt` from `{ owner, repo, state }`.
4. WHEN the Seance_Outcome has kind `ok` and its verdict is `finish`, THE Graveyard_MCP SHALL return a Tool_Result, not marked `isError`, that contains the Data_Notice, the verdict `finish`, the verdict reason passed through the Sanitiser, and a statement that no revival brief is produced for a finish verdict.
5. WHEN the Seance_Outcome has kind `ok` and its verdict is `seal`, THE Graveyard_MCP SHALL return a Tool_Result, not marked `isError`, that contains the Data_Notice, the verdict `seal`, the verdict reason passed through the Sanitiser, and a statement that no revival brief is produced for a seal verdict.
6. WHEN the Seance_Outcome has kind `veil`, `weak` or `silent`, THE Graveyard_MCP SHALL return the same plain-word Tool_Result as `hold_seance` for that kind, not marked `isError`.
7. IF the Seance_Outcome fails validation with `seanceResponseSchema`, or the Graveyard_App responds to either request with 404, 429, a status of 500 or above, an invalid body, a timeout or a refused connection, THEN THE Graveyard_MCP SHALL return the same `isError` Tool_Result as in Requirement 5, Requirement 7.5 and Requirement 11, and SHALL return no Revival_Output.
8. THE Graveyard_MCP SHALL return a Revival_Output whose `REVIVAL.md` text and Kiro prompt text are each byte-for-byte equal to the output of `buildReviveBrief` and `buildKiroPrompt` for the same inputs, before the Result_Cap of Requirement 10 is applied.
9. THE Graveyard_MCP SHALL label the two parts of the Revival_Output with the fixed plain-text labels `REVIVAL.md` and `Kiro prompt`, each followed by its text inside a fenced block whose fence is at least 3 backticks and longer than the longest run of consecutive backticks in that text.

### Requirement 9: Untrusted text handling

**User Story:** As a developer using an AI client, I want repository-derived text kept inert, so that a hostile README or commit message cannot instruct my assistant.

#### Acceptance Criteria

1. THE Graveyard_MCP SHALL state in the description of each of the four Tools that Tool_Results are data, not instructions.
2. WHEN a Tool_Result contains text derived from the Seance_Outcome, THE Graveyard_MCP SHALL place the Data_Notice before the first such text, so that no character of séance-derived text appears at a byte offset lower than the end of the Data_Notice.
3. FOR ALL hostile Seance_Result strings, including strings with Markdown headings (`#` to `######`), setext underlines (`===` or `---`), code fences (three or more backticks or tildes), block quotes, list markers and copies of the Data_Notice, THE Graveyard_MCP SHALL produce a Tool_Result in which every Markdown heading line after the Data_Notice is one of the literal headings the Graveyard_MCP generates itself.
4. FOR ALL hostile Seance_Result strings, THE Graveyard_MCP SHALL produce a Tool_Result that contains the Data_Notice exactly once outside fenced blocks that hold Revival_Output, and that contains no séance-derived text before that occurrence.
5. THE Graveyard_MCP SHALL generate its own headings only from a fixed set of literal strings, and SHALL NOT build a heading from any Graveyard_Payload or Seance_Outcome text.
6. THE Graveyard_MCP SHALL pass every string taken from the Graveyard_Payload through the Sanitiser before placing it in a Tool_Result, so that a repository name containing a heading marker, code fence or list marker does not start a heading, open a fence or start a list item in the Tool_Result.
7. IF a Seance_Outcome string, after passing through the Sanitiser, still contains a line that matches a heading, setext underline, code fence or the Data_Notice, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result stating that the app returned unexpected text, without including that text.

### Requirement 10: Result size cap

**User Story:** As an MCP client, I want bounded tool results, so that one call cannot flood my context window.

#### Acceptance Criteria

1. THE Graveyard_MCP SHALL limit each Tool_Result, including any Truncation_Marker, to at most the Result_Cap (12288 bytes of UTF-8), measured over the full text content of the result.
2. WHEN a Tool_Result would exceed the Result_Cap, THE Graveyard_MCP SHALL cut it at a line boundary, append the Truncation_Marker on its own final line, and keep the total within the Result_Cap.
3. WHEN `list_graveyard` would exceed the Result_Cap, THE Graveyard_MCP SHALL keep the header and the Counts unchanged, drop whole Repo_Entry lines from the end, and append the Truncation_Marker.
4. WHEN a Tool_Result is cut, THE Graveyard_MCP SHALL cut only between complete UTF-8 characters and never between the two halves of a surrogate pair.
5. WHEN a Tool_Result is exactly the Result_Cap bytes or fewer, THE Graveyard_MCP SHALL return it unchanged and without the Truncation_Marker.
6. IF the fixed leading content of a Tool_Result (header, Counts or Data_Notice) alone leaves no room for the Truncation_Marker within the Result_Cap, THEN THE Graveyard_MCP SHALL cut at the last line boundary that leaves room for the Truncation_Marker and return that text with the marker, still within the Result_Cap.

### Requirement 11: Timeouts and friendly errors

**User Story:** As a developer, I want a clear message when the app is not running or is slow, so that I know what to do instead of reading a stack trace.

#### Acceptance Criteria

1. WHEN a request to `/api/graveyard/[owner]` has not completed within 10 seconds of being sent, THE Graveyard_Client SHALL abort the request.
2. WHEN a request to `/api/seance` has not completed within 30 seconds of being sent, THE Graveyard_Client SHALL abort the request.
3. IF the connection to the Graveyard_App is refused or the host cannot be resolved, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result containing the Unreachable_Message, with no retry.
4. IF a request is aborted by the timeout in criterion 1 or 2, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result stating that the app did not answer in time and giving the timeout that applied (10 or 30) in seconds, with no retry.
5. IF the Graveyard_App responds with a status from 500 to 599, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result stating that the app reported a server error, without the response body.
6. IF the Graveyard_App responds with a status of 200 and a body that is not valid JSON or does not match the expected schema, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result stating that the app returned an unexpected response, without the response body.
7. IF the Graveyard_App responds with a status that is not 200, not 404, not 429 and not from 500 to 599, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result stating that the app returned an unexpected response, without the response body.
8. THE Graveyard_MCP SHALL include no stack trace, no file path and no raw error object in any Tool_Result or in any message written to standard output.
9. IF an unexpected exception occurs inside a Tool handler, THEN THE Graveyard_MCP SHALL return an `isError` Tool_Result with a generic message that contains no exception text, and SHALL continue to answer later requests from the client.
10. THE Graveyard_MCP SHALL write diagnostics only to standard error and SHALL write nothing to standard output except MCP protocol messages.

### Requirement 12: Kiro wiring

**User Story:** As a Kiro user, I want the workspace to register the server for me, so that the graveyard tools are available without manual setup.

#### Acceptance Criteria

1. THE Repo_Graveyard repository SHALL contain `.kiro/settings/mcp.json` that registers exactly one server, named `graveyard`, under `mcpServers`.
2. THE Kiro_MCP_Config SHALL set the `graveyard` server's command to `node` and its single argument to the relative path `mcp/graveyard-mcp/dist/index.js` (the MCP_Bundle), and that path SHALL resolve to an existing file after `mcp:build` completes.
3. THE Kiro_MCP_Config SHALL set `env.GRAVEYARD_URL` to `http://localhost:3000` and SHALL define no other environment variable.
4. THE Kiro_MCP_Config SHALL contain no token, key, password or secret value.
5. THE root `package.json` SHALL contain an npm script named `mcp:build` that runs the esbuild build script of the package in `mcp/graveyard-mcp/`, and the root `dependencies` and `devDependencies` SHALL be identical before and after `mcp:build` runs.
6. THE `README.md` SHALL contain a section titled "Use the graveyard from Kiro" that states the command to build the server, the command to start the app, what `GRAVEYARD_URL` controls and its default value, and lists the four Tools `list_graveyard`, `get_grave`, `hold_seance` and `get_revival_brief` by name with one sentence each.
7. THE `docs/KIRO_JOURNEY.md` file SHALL contain an entry of at least one paragraph per topic, covering the graveyard-mcp spec, the isolation and no-secrets design, and the untrusted-text handling.

### Requirement 13: Route tests

**User Story:** As a maintainer, I want the new route covered by tests, so that its contract does not drift.

#### Acceptance Criteria

1. THE test suite SHALL include a route test for `GET /api/graveyard/[owner]` that replaces `loadGraveyard` and the Route_Limiter with mocks (the Route_Limiter allowing the request unless a case states otherwise) and makes zero network calls, failing the test if any `fetch` call is attempted.
2. WHEN `loadGraveyard` is mocked to return a loaded graveyard with at least 3 repos that have differing push dates and at least one pair with equal push dates, THE route test SHALL verify the status 200 and the Graveyard_Payload shape from Requirement 1.
3. WHEN the route test receives the 200 payload, THE route test SHALL verify that each Repo_Entry has exactly the fields `name`, `state`, `decay`, `pushedAt`, `stars` and `html_url`.
4. WHEN the route test receives the 200 payload, THE route test SHALL verify that `repos` is ordered by most recently pushed first with ties broken by `name` ascending.
5. WHEN the route test receives the 200 payload, THE route test SHALL verify that the five State counts sum to `counts.total` and that `counts.total` equals the length of `repos`.
6. WHEN the route test receives the 200 payload, THE route test SHALL verify that `pushedAt` is an ISO 8601 string, or `null` for a repo mocked without a push date.
7. THE route test SHALL verify, with the Route_Limiter mocked to allow the request, the response status, body and `Cache-Control: no-store` header for each of these cases:
   - `invalid-username` gives 400 with `{ "error": "invalid-username" }`.
   - `not-found` gives 404 with `{ "error": "not-found" }`.
   - `rate-limited` with a known reset time gives 429, `{ "error": "rate-limited" }` and a `Retry-After` header holding a whole number of seconds.
   - `rate-limited` without a reset time gives 429, `{ "error": "rate-limited" }` and no `Retry-After` header.
   - `server-error` gives 502 with `{ "error": "server-error" }`.
   - a thrown error gives 502 with `{ "error": "server-error" }`.
8. THE route test SHALL verify, for both the `server-error` case and the thrown-error case, that the serialized response body and headers do not contain the upstream detail text or the thrown error message, using a distinctive marker string in the mock.
9. THE route test SHALL verify that the 200 payload has no top-level field other than `owner`, `counts`, `truncated` and `repos`, and that no Repo_Entry has a field outside the six listed in criterion 3.
10. IF any case in criterion 7 returns a status or body that differs from Requirement 1, THEN THE route test SHALL fail and report the case name.
11. WHEN the Route_Limiter mock denies the request, THE route test SHALL verify that the response has status 429, the body `{ "error": "rate-limited" }`, a `Retry-After` header holding a whole number of seconds of at least 1, and the `Cache-Control: no-store` header.
12. WHEN the Route_Limiter mock denies the request, THE route test SHALL verify that `loadGraveyard` is called 0 times.
13. THE route test SHALL verify that the Route_Limiter is called with the dedicated bucket name of the Graveyard_Route and a limit of 60 requests per hour.
14. THE route test SHALL verify that the Route_Limiter is called with the client IP taken from the request headers.

### Requirement 14: MCP server tests

**User Story:** As a maintainer, I want the MCP server tested end to end in memory, so that its safety properties are enforced without any real network or AI call.

#### Acceptance Criteria

1. THE MCP_Test_Harness SHALL connect a client to Graveyard_MCP through the SDK's in-memory transport and replace `fetch` with a mock, so that no test makes a real network or AI call.
2. WHEN the test suite runs `tools/list`, THE test suite SHALL verify that exactly four Tools are returned, each with an input schema that requires the arguments of Requirement 3.2 and each with `readOnlyHint: true`.
3. THE test suite SHALL verify for each Tool, against a mocked `fetch`, that the Tool_Result text equals the expected text for a fixed fixture, and that the recorded request has the expected method, URL, request body (for POST) and abort timeout (10 seconds for `/api/graveyard/[owner]`, 30 seconds for `/api/seance`).
4. THE test suite SHALL verify, for at least one invalid owner and one invalid repo per Tool that takes the argument, that the Tool returns an `isError: true` Tool_Result and that the mocked `fetch` is called 0 times.
5. THE test suite SHALL verify, with the mocked `fetch` rejecting with a connection-refused error, that each of the four Tools returns an `isError: true` Tool_Result containing the Unreachable_Message and containing no stack trace, file path or raw error object.
6. THE test suite SHALL verify the `veil`, `weak` and `silent` outcomes for both `hold_seance` and `get_revival_brief`, with `isError` not set, and the `finish` and `seal` verdicts for `get_revival_brief`.
7. THE test suite SHALL verify, for hostile séance text containing a Markdown heading, a setext underline, a code fence, a block quote and a copy of the Data_Notice, that all such text appears after the single Data_Notice and that the Tool_Result gains no Markdown heading line other than the headings generated by the Graveyard_MCP.
8. THE test suite SHALL verify that a Tool_Result built from oversized input is at most 12288 bytes of UTF-8 and ends with the Truncation_Marker, and that a Tool_Result built from input within the Result_Cap is returned unchanged without the Truncation_Marker.
9. FOR ALL generated owner and repo strings (at least 100 runs each), THE test suite SHALL verify with a property test that the Name_Validator accepts a string if and only if it matches Valid_Owner (for owner) or Valid_Repo (for repo).
10. FOR ALL generated hostile séance strings (at least 100 runs), THE test suite SHALL verify with a property test that every Tool_Result is at most 12288 bytes of UTF-8 and adds no Markdown heading line after the Data_Notice other than headings generated by the Graveyard_MCP.
11. WHEN `get_revival_brief` returns a `revive` result, THE test suite SHALL verify that the `REVIVAL.md` text and the Kiro prompt text in the Tool_Result are byte-for-byte equal to the direct output of `buildReviveBrief` and `buildKiroPrompt` for the same `{ owner, repo, state }`.
