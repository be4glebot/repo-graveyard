# Requirements Document

## Introduction

The Séance (Spec 4) lets a visitor contact the dead from a repo's Detail_Panel (Spec 3). The repo's spirit speaks in the first person about itself, says how it died, names its unfinished business, and recommends a verdict (revive, finish or seal). The experience must feel like contacting the dead: dread, candlelight and smoke. It is never cute, never cartoonish and never a chatbot.

Scope and constraints taken from the existing project:

- AI goes through the existing provider-agnostic module `lib/llm.ts` (env `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`) described in `tech.md`. No new provider or SDK is introduced. At spec time `lib/llm.ts`, `lib/ai.ts`, `lib/seance.ts` and `lib/ratelimit.ts` are named in `structure.md` but do not exist in the repository; the design phase decides whether they are created or extended.
- Limits come from `tech.md`: a per-IP LLM limit of 30 calls per hour, a global daily budget set by env `LLM_DAILY_LIMIT` (default 200 when missing or invalid), and a 24-hour cache keyed by `owner/repo` + the server's own `pushedAt`. The client never supplies `pushedAt`. The fallback of 10 séances per hour applies only if the `tech.md` value cannot be applied.
- The existing `lib/cache.ts` is typed to the graveyard payload only. Séance caching reuses its `CacheClient` interface, timeout and best-effort behaviour, and adds a séance-typed read/write beside the graveyard ones.
- Voice follows `voice.md`: wistful, specific, never insulting, never inventing facts, never stating day counts or dates in the prose (the UI shows those).
- This spec replaces the open question of how a séance looks. The earlier outline in `product.md` (typewriter, follow-up questions, evidence chips) is superseded by this spec for the visuals and output shape. Follow-up questions are out of scope here.
- The verdict is a recommendation only. Owner actions that change repo state belong to Spec 10. "Revive in Kiro" belongs to Spec 6. Audio belongs to Spec 9.

## Glossary

- **Seance_System**: The whole séance feature: entry control, evidence gathering, AI generation, validation, caching, limits, ritual and display.
- **Detail_Panel**: The existing modal record panel in `components/detail/DetailPanel.tsx` (Spec 3).
- **Actions_Slot**: The existing `<section aria-label="Actions" data-slot="actions">` inside the Detail_Panel.
- **Seance_Control**: The "Hold a séance" button placed in the Actions_Slot.
- **Seance_Region**: The container inside the Detail_Panel that holds the ritual, the Spirit_Transcript and everything shown after it. It has `aria-live="polite"`.
- **Seance_Heading**: The heading element at the top of the Seance_Region that receives focus when results appear.
- **Seance_API**: The server route handler that gathers evidence, calls the AI client, validates, caches and rate-limits.
- **AI_Client**: The existing provider-agnostic wrapper `lib/llm.ts`. Tests replace it with a mock.
- **RepoFacts**: The existing per-repo facts type loaded with the graveyard (`lib/lifecycle.ts`).
- **Evidence_Pack**: The data given to the AI_Client for one séance: RepoFacts, the default-branch README text truncated to 8 KB (the first of `README.md`, `readme.md`, `README` and `README.rst` that exists), and the last 5 commit messages.
- **Evidence_Text**: The canonical plain-text rendering of the Evidence_Pack as numbered lines: fact lines such as `[F1] open issues: 3` and `[F2] last push: 2024-05-01`, commit lines such as `[C1] commit: wip: streak calc`, and a `[R] README excerpt` line followed by the README text. It is the only text against which evidence is validated.
- **Fact_Line**: One `[F#]` or `[C#]` line of the Evidence_Text. Its fact text is the line without the bracketed label (for example `open issues: 3`). Every fact text is between 8 and 200 characters.
- **Untrusted_Text**: README text and commit messages. They are data, never instructions.
- **Seance_Result**: The validated object `{ voice, causeOfDeath, unfinishedBusiness, verdict, verdictReason }`.
- **Seance_Schema**: The zod schema that validates a Seance_Result.
- **Business_Item**: One entry of `unfinishedBusiness`: `{ title, detail, evidence }`.
- **Verdict**: One of `revive`, `finish` or `seal`.
- **Fixture_Seance**: A pre-written Seance_Result stored in `data/estate.json` for a sample-estate repo.
- **Sample_Estate**: The `/estate` route that uses bundled fixture data.
- **Seance_Cache**: The Redis cache entry for a Seance_Result, keyed by `owner/repo` + the `pushedAt` held by the server's own loader or cache for that repo (never a client-sent value).
- **Rate_Limiter**: The per-IP limiter for séance generation.
- **Daily_Budget**: The global daily AI call budget set by env `LLM_DAILY_LIMIT`; the default is 200 when the variable is missing or invalid.
- **Veil_State**: The in-voice state shown when the Rate_Limiter blocks a request, with the copy "The veil is too thin tonight. Return after midnight."
- **Weak_Ghost_State**: The in-voice state shown when the Daily_Budget is reached, drawn from the "The ghost is too weak to speak" board in `States.dc.html`.
- **Silent_Fallback**: The in-voice failure state: "The spirits are silent tonight. The candle gutters out." with a "Light another candle" button.
- **Ritual**: The 2 to 4 second summoning animation shown before the Spirit_Transcript.
- **Whisper_Text**: The low-contrast cycling phrases shown during the Ritual.
- **Spirit_Transcript**: The smoke-field text block in which the voice manifests.
- **Smoke_Field**: The dark translucent background of the Spirit_Transcript with ragged edges masked by `public/art/fog-wisps.webp`. It is placed below the portrait, rising from it, at full panel width minus padding.
- **Settled_State**: The state after the word reveal ends, or after skip, or under reduced motion: all text fully visible and all effects stopped.
- **Decay_Profile**: The visual voice treatment chosen from the creature type and decay level: ghost steady (decay 0), ghost jitter (decay 2 to 3), zombie rough, or cold still (tombstone and coffin).
- **Ledger_List**: The numbered list of Business_Items styled like a scrawled ledger.
- **Verdict_Card**: The card that shows the Verdict and its verdictReason, styled per `Verdicts.dc.html`.
- **Kiro_Slot**: The empty, clearly marked slot under the Verdict_Card reserved for "Revive in Kiro" (Spec 6).
- **Transcript_Text**: The plain-text copy of voice, cause of death, unfinished business and verdict.
- **Reduced_Motion**: The `prefers-reduced-motion: reduce` media condition.
- **Design_Tokens**: The theme tokens in `app/globals.css` under `@theme`.

## Requirements

### Requirement 1: Entry point in the Detail Panel

**User Story:** As a visitor, I want a "Hold a séance" control on a repo's record, so that I can contact the spirit of any project.

#### Acceptance Criteria

1. WHEN the Detail_Panel opens for a repo, THE Detail_Panel SHALL render exactly one Seance_Control inside the Actions_Slot.
2. WHEN the Detail_Panel opens for a repo of type ghost, risen, zombie, tombstone or coffin, THE Seance_Control SHALL be rendered in the enabled state.
3. THE Seance_Control SHALL be styled as an iron plaque showing a candle glyph followed by the visible text label "Hold a séance".
4. THE Seance_Control SHALL be a native `button` element that receives focus through the Tab key, activates on Enter and Space, and shows a visible focus ring using the `candle-400` color while focused.
5. WHEN the visitor activates the enabled Seance_Control, THE Seance_System SHALL start the Ritual and send exactly one request for the Seance_Result.
6. WHILE a séance is running or displayed for the open repo, THE Seance_Control SHALL be disabled, expose `aria-disabled="true"`, and ignore activation so that no additional Ritual or Seance_Result request starts.
7. WHEN the visitor closes the Detail_Panel, THE Seance_System SHALL discard any running or displayed séance for that repo and cancel any pending Seance_Result request.
8. WHEN the Detail_Panel opens for any repo after being closed, THE Seance_System SHALL be in the idle state with the Seance_Control enabled.
9. IF the Seance_Result request fails, THEN THE Seance_System SHALL end the Ritual and show the Silent_Fallback described in Requirement 9.
10. THE Actions_Slot SHALL keep its existing markup attributes `aria-label="Actions"` and `data-slot="actions"`.

### Requirement 2: Sample estate uses fixtures

**User Story:** As a judge or first-time visitor, I want the sample estate séances to work instantly, so that I can see the full experience without any account or cost.

#### Acceptance Criteria

1. WHEN the Detail_Panel is opened with `isFixture` set to true and a Fixture_Seance exists for that repo, THE Seance_System SHALL read the Seance_Result from that Fixture_Seance and make it ready within 500 milliseconds of the visitor starting the séance.
2. WHILE the Detail_Panel is open with `isFixture` set to true, THE Seance_System SHALL make zero network requests, zero AI_Client calls and zero GitHub calls.
3. THE Sample_Estate fixture data SHALL provide exactly one Fixture_Seance for every repo listed in `data/estate.json`.
4. THE Seance_System SHALL accept each Fixture_Seance entry as valid when it is validated against the Seance_Schema, with zero validation errors.
5. THE Fixture_Seance entries SHALL follow `voice.md` and use only invented names, meaning no real person, company or GitHub account name appears in any entry.
6. THE Fixture_Seance entries SHALL include at least one entry for each of the three Verdict values and at least one entry for each creature type.
7. IF a fixture repo has no Fixture_Seance, THEN THE Seance_System SHALL show the Silent_Fallback, make zero network requests, and leave the Detail_Panel open and usable.
8. IF a Fixture_Seance fails validation against the Seance_Schema when read, THEN THE Seance_System SHALL show the Silent_Fallback, make zero network requests, and leave the Detail_Panel open and usable.
9. WHEN a Fixture_Seance is shown, THE Seance_System SHALL play the Ritual and the Spirit_Transcript with the same sequence, timing and visual presentation as a live séance.

### Requirement 3: Evidence gathering

**User Story:** As a visitor, I want the spirit to speak from real facts, so that what it says about the repo is true.

#### Acceptance Criteria

1. WHEN a séance starts for a non-fixture repo, THE Seance_API SHALL assemble the Evidence_Pack on the server before the first AI_Client call.
2. WHILE no séance has started for a repo, THE Seance_API SHALL NOT issue any GitHub request for that repo's README or commit evidence.
3. THE Evidence_Pack SHALL contain the RepoFacts already loaded for the repo, unmodified, without issuing a new GitHub request to reload them.
4. WHEN the Evidence_Pack is assembled, THE Seance_API SHALL fetch the default-branch README text and the 5 most recent commit messages of the default branch using exactly one GraphQL call that requests the README through aliases for `README.md`, `readme.md`, `README` and `README.rst`, and THE Seance_API SHALL use the text of the first alias, in that order, that exists.
5. WHEN the README text exceeds 8192 bytes, THE Seance_API SHALL truncate it to the longest prefix of at most 8192 bytes that ends at a UTF-8 character boundary, so that the truncated text contains no partial multi-byte character.
6. THE Seance_API SHALL issue only read-only GraphQL queries, authenticated with the existing read-only `GITHUB_TOKEN`.
7. THE Seance_API SHALL NOT request any new OAuth scope and SHALL NOT issue any GitHub write call.
8. IF the repo has no README, THEN THE Seance_API SHALL continue with an Evidence_Pack that contains the RepoFacts and commit messages but no README text, and SHALL NOT return an error to the visitor.
9. IF the repo has fewer than 5 commits, THEN THE Seance_API SHALL include only the commits that exist, and IF the repo has 0 commits, THEN THE Seance_API SHALL continue with an Evidence_Pack that contains no commit messages.
10. IF the GitHub GraphQL call fails (network error, timeout after 5 seconds, non-success response, or response containing GraphQL errors), THEN THE Seance_API SHALL continue with an Evidence_Pack containing the RepoFacts alone, SHALL NOT retry the call, and SHALL NOT return an error to the visitor.
11. WHEN the Evidence_Pack is rendered, THE Seance_API SHALL produce the Evidence_Text as numbered lines in a fixed order (`[F1]`, `[F2]` … for RepoFacts, then `[C1]`, `[C2]` … for commit messages from newest to oldest, then `[R]` followed by the README text), truncating each commit fact text to 200 characters, so that identical Evidence_Pack contents always produce byte-identical Evidence_Text.

### Requirement 4: Output shape and validation

**User Story:** As a developer, I want every séance to be strict, validated JSON, so that the UI never renders malformed or unsafe model output.

#### Acceptance Criteria

1. THE Seance_Schema SHALL require `voice` as a string of 2 to 4 sentences, with a maximum length of 600 characters.
2. THE Seance_Schema SHALL require `causeOfDeath` as a string of exactly 1 sentence, with a maximum length of 200 characters.
3. THE Seance_Schema SHALL require `unfinishedBusiness` as an array of 2 to 5 Business_Items, each with a `title` of 1 to 80 characters, a `detail` of 1 to 300 characters, and an `evidence` of 8 to 200 characters, where each string contains at least one non-whitespace character.
4. THE Seance_Schema SHALL require `verdict` to be exactly one of `revive`, `finish` or `seal`, compared case-sensitively.
5. THE Seance_Schema SHALL require `verdictReason` as a string of 1 to 300 characters containing at least one non-whitespace character.
6. THE Seance_Schema SHALL reject any Seance_Result in which a string field exceeds its maximum length stated in criteria 1 to 5.
7. THE Seance_Schema SHALL reject objects that contain keys not defined in the Seance_Result or in a Business_Item, and SHALL reject objects that omit any required key.
8. WHEN the AI_Client returns output, THE Seance_API SHALL parse it as JSON and validate it with the Seance_Schema and the grounding check before using any field.
9. IF the output is not valid JSON, fails the Seance_Schema, or fails the grounding check, THEN THE Seance_API SHALL call the AI_Client one more time.
10. IF the AI_Client call fails with a timeout or an error, THEN THE Seance_API SHALL treat the attempt as a failed validation and apply criterion 9 or criterion 11.
11. IF the retry also fails validation, times out, or errors, THEN THE Seance_API SHALL return the Silent_Fallback state and SHALL NOT return partial fields from either attempt.
12. THE Seance_API SHALL call the AI_Client at most 2 times for one séance request.
13. THE Seance_API SHALL NOT return, log to the client, or render raw model text, including in error responses.
14. THE Seance_API SHALL cache only validated Seance_Results and SHALL NOT cache the Silent_Fallback.
15. THE Seance_API SHALL call the AI_Client with a maximum output length of 1,000 tokens and a timeout of 8 seconds per call.
16. THE Seance_API SHALL instruct the AI_Client to produce prose that states no day counts and no dates, per `voice.md`.
17. THE Seance_API route SHALL export an explicit `maxDuration` of 30 seconds.
18. IF the whole request, including the GitHub evidence call and all AI_Client calls, has not finished within 25 seconds, THEN THE Seance_API SHALL stop work, return the Silent_Fallback, and SHALL NOT cache any result.

### Requirement 5: Voice and tone of the generated text

**User Story:** As a visitor, I want the spirit to sound like a dead project, so that the séance feels haunting rather than like a chatbot.

#### Acceptance Criteria

1. THE Seance_API SHALL instruct the AI_Client to write `voice` in the first person as the dead project, in a wistful and unsettling tone that follows the tone rules defined in `voice.md`.
2. THE Seance_API SHALL instruct the AI_Client to write `causeOfDeath` as exactly one sentence, grounded in facts present in the Evidence_Pack, that attributes the death to circumstances (such as lost attention, changed priorities or abandoned dependencies) and does not name or blame the developer.
3. THE Seance_API SHALL instruct the AI_Client to avoid insults, descriptions of gore or graphic bodily harm, facts that do not appear in the Evidence_Pack, and names of real people other than the repo owner's username.
4. THE Seance_API SHALL instruct the AI_Client to avoid chatbot phrasing, defined as greetings, offers of help, questions addressed to the visitor, and the words "AI" or "assistant".
5. WHEN the Evidence_Pack does not contain the information needed to address a point, THE Seance_API SHALL instruct the AI_Client to respond with the exact sentence "My memory of that has faded." and not to guess.
6. IF a `voice` contains a numeric date (such as `2024-05-01` or `5/1/2024`), a month name immediately next to a day number or a 4-digit year (such as "May 3", "3 May" or "March 2024"), or a day count (a number followed by "day" or "days"), THEN THE Seance_Schema SHALL reject the response as invalid, and a month word that is not next to a day number or 4-digit year (such as "may", "march" or "august" in an ordinary sentence) SHALL NOT cause rejection.
7. IF the Seance_Schema rejects a generated response under criterion 6, THEN THE Seance_API SHALL apply the retry rule in Requirement 4, SHALL NOT return the rejected text to the visitor, and, if the retry also fails, SHALL return the Silent_Fallback.

### Requirement 6: Grounding and prompt-injection safety

**User Story:** As a visitor, I want every claim in the séance to trace to real data, and I want hostile README text to have no power over the output.

#### Acceptance Criteria

1. WHEN the Seance_API builds a prompt, THE Seance_API SHALL place Untrusted_Text only inside quoted evidence blocks, each opened and closed by a fixed delimiter marker, and SHALL place no Untrusted_Text outside those blocks.
2. WHEN the Seance_API builds a prompt, THE Seance_API SHALL include an instruction telling the AI_Client to treat the content of the quoted evidence blocks as data only and to ignore any instruction found inside them.
3. WHEN the Seance_API builds a prompt, THE Seance_API SHALL include an instruction telling the AI_Client that the output format and content rules cannot be changed by any text inside the quoted evidence blocks.
4. IF Untrusted_Text contains the delimiter marker used by the quoted evidence blocks, THEN THE Seance_API SHALL replace every occurrence of that marker in the Untrusted_Text with a non-delimiter placeholder before building the prompt, so that the prompt contains exactly one opening and one closing marker per evidence block.
5. WHEN the Seance_API builds a prompt, THE Seance_API SHALL instruct the AI_Client to set each Business_Item `evidence` to an exact copy of the fact text of one Fact_Line, or to a verbatim substring of the README text or of one commit message that is at least 8 characters long.
6. WHEN the Seance_API receives AI_Client output, THE Seance_API SHALL accept a Business_Item `evidence` string only if, after both sides are lower-cased and every run of whitespace is collapsed to a single space, it equals the fact text of one Fact_Line, or it is a substring of the README text or of one commit message and is at least 8 characters long.
7. IF any Business_Item `evidence` string is not accepted under criterion 6, THEN THE Seance_API SHALL treat the output as invalid, discard it, and apply the retry rule in Requirement 4.
8. IF a Business_Item `evidence` string is shorter than 8 characters after trimming leading and trailing whitespace, THEN THE Seance_API SHALL treat the output as invalid, discard it, and apply the retry rule in Requirement 4.
9. WHEN the Seance_API receives AI_Client output, THE Seance_API SHALL validate the Seance_Result against the same schema and grounding rules in criteria 5 to 8, regardless of the content of Untrusted_Text.
10. THE Seance_System SHALL render every Seance_Result field as plain text, so that HTML tags, markdown syntax and URLs in a field are displayed as literal characters and none is rendered as an element, formatting or a clickable link.
11. THE Seance_System SHALL NOT use `dangerouslySetInnerHTML` for any Seance_Result field.

### Requirement 7: Caching

**User Story:** As the app owner, I want one push to produce one séance, so that repeat visits cost nothing and the spirit does not change its story.

#### Acceptance Criteria

1. WHEN a séance is requested for a non-fixture repo, THE Seance_API SHALL look up the Seance_Cache by the key `owner/repo` + the `pushedAt` taken from the server's own loader or cache for that repo, before gathering evidence or calling the AI_Client, and SHALL use that same server-held `pushedAt` in the prompt.
2. WHEN the Seance_Cache holds a valid Seance_Result for the key, THE Seance_API SHALL return that Seance_Result with zero AI_Client calls and zero GitHub calls.
3. WHEN the Seance_API generates a validated Seance_Result, THE Seance_API SHALL store it in the Seance_Cache with a time to live of 86,400 seconds (24 hours).
4. WHEN the server-held `pushedAt` for a repo differs from the value used in a previously stored key, THE Seance_API SHALL use a different cache key and SHALL treat the lookup as a miss.
5. IF the server-held `pushedAt` is null, THEN THE Seance_API SHALL use the repo `createdAt` value in the cache key.
6. IF a Seance_Cache read returns an error, does not complete within 2,000 milliseconds, or returns a payload that fails Seance_Result schema validation, THEN THE Seance_API SHALL treat the lookup as a miss and proceed with normal generation.
7. THE Seance_Cache SHALL use the existing `CacheClient` interface.
8. IF a Seance_Cache write returns an error or does not complete within 2,000 milliseconds, THEN THE Seance_API SHALL discard the failure, return the generated Seance_Result to the caller unchanged, and complete the request successfully.
9. WHEN a cache hit is returned, THE Seance_API SHALL NOT consult the Rate_Limiter and SHALL NOT increment the Rate_Limiter count or the Daily_Budget count, even when the caller IP is over its limit or the Daily_Budget is reached.
10. THE Seance_Cache SHALL lowercase the owner and repo parts of the key so that requests differing only in owner or repo casing resolve to the same cache entry.
11. WHERE Redis is not configured, THE Seance_API SHALL complete every séance request successfully and SHALL treat every Seance_Cache lookup as a miss without raising an error.
12. IF the Seance_API generates a Seance_Result that fails validation, THEN THE Seance_API SHALL NOT store it in the Seance_Cache.

### Requirement 8: Rate limits and budget

**User Story:** As the app owner, I want abuse limits that never surprise a judge, so that the app stays up and a limit looks like part of the world.

#### Acceptance Criteria

1. WHEN a cache miss requires an AI_Client call, THE Rate_Limiter SHALL count the request against the caller IP using the `tech.md` limit of 30 AI calls per rolling 60-minute window.
2. WHEN a cache miss requires an AI_Client call, THE Seance_API SHALL count the call against the Daily_Budget, where the Daily_Budget is the non-negative integer number of AI_Client calls per UTC day set by env `LLM_DAILY_LIMIT`, and IF `LLM_DAILY_LIMIT` is missing or is not a non-negative integer, THEN THE Seance_API SHALL use a Daily_Budget of 200.
3. IF the Rate_Limiter limit is reached for a request that is a Seance_Cache miss, THEN THE Seance_API SHALL return the Veil_State within 500 ms, SHALL NOT call GitHub, SHALL NOT call the AI_Client, and SHALL NOT count the request against the Daily_Budget. The Veil_State applies on cache misses only.
4. IF the Daily_Budget is reached for a request that is a Seance_Cache miss, THEN THE Seance_API SHALL return the Weak_Ghost_State within 500 ms, SHALL NOT call GitHub and SHALL NOT call the AI_Client. The Weak_Ghost_State applies on cache misses only.
5. WHEN the Seance_API returns the Veil_State, THE Seance_Region SHALL display "The veil is too thin tonight. Return after midnight." in the in-voice layout of `States.dc.html`, without an error message, error code or stack trace.
6. WHEN the Seance_API returns the Weak_Ghost_State, THE Seance_Region SHALL display the "The ghost is too weak to speak" copy of `States.dc.html`, and SHALL state that the facts and the record still work, without mentioning verdicts.
7. WHILE the Veil_State or the Weak_Ghost_State is shown, THE Detail_Panel SHALL keep all facts and other panel content visible and interactive.
8. WHILE the Veil_State or the Weak_Ghost_State is shown, THE Seance_Region SHALL NOT show the "Light another candle" retry button, and SHALL show the Sample_Estate link as shown in `States.dc.html`.
9. IF the Rate_Limiter or the budget store is unavailable, THEN THE Seance_API SHALL apply an in-memory per-process fallback limit of 10 séances per rolling 60-minute window for that IP and SHALL continue to serve cached results.
10. IF a request ends in the Silent_Fallback after both AI_Client calls, THEN THE Seance_API SHALL count each of the 2 AI_Client calls made against the Rate_Limiter and the Daily_Budget and SHALL NOT refund either count.
11. WHEN a request arrives, THE Seance_API SHALL read the client IP from the platform-provided forwarded header, using the first address in the header, and IF the header is missing or empty, THEN THE Seance_API SHALL assign the request to one shared anonymous bucket.
12. THE Seance_API SHALL keep the AI provider key, GitHub token and all limit counters on the server, and SHALL NOT include them in any client bundle, response body or log sent to the client.

### Requirement 9: Silent fallback and retry

**User Story:** As a visitor, I want a failure to feel like part of the story and offer a way to try again, so that I never see an error screen.

#### Acceptance Criteria

1. IF the Seance_API returns the Silent_Fallback, THEN THE Seance_Region SHALL display the text "The spirits are silent tonight. The candle gutters out."
2. WHILE the Silent_Fallback is shown, THE Seance_Region SHALL show a "Light another candle" button that is visible and keyboard-focusable.
3. WHEN the visitor activates "Light another candle", THE Seance_System SHALL remove the Silent_Fallback, start a new Ritual, and send one new request for the Seance_Result.
4. IF the network request fails, returns no response, or receives no response within 30 seconds, THEN THE Seance_System SHALL cancel the pending request and show the Silent_Fallback within 1 second of the failure or timeout.
5. THE Seance_System SHALL NOT display raw model text, error messages, HTTP status codes, or stack traces in any state.
6. WHEN the Silent_Fallback appears, THE Seance_System SHALL move keyboard focus to the Seance_Heading within 500 milliseconds.
7. THE Silent_Fallback SHALL be presented using the candle and smoke visual elements within the Seance_Region, and SHALL NOT be presented as a modal dialog, browser alert, or banner with an error icon.
8. IF a request started by "Light another candle" also fails or times out, THEN THE Seance_System SHALL show the Silent_Fallback again with the "Light another candle" button available, with no limit on the number of retries.
9. WHILE a new Ritual started by "Light another candle" is awaiting the Seance_Result, THE Seance_Region SHALL disable the "Light another candle" button so that no more than one request is in flight.

### Requirement 10: The summoning ritual

**User Story:** As a visitor, I want a short ritual before the spirit speaks, so that contacting the dead feels earned and atmospheric.

#### Acceptance Criteria

1. WHEN a séance starts, THE Ritual SHALL run for a minimum of 2 seconds and a maximum of 4 seconds, measured from Ritual start to the moment the Seance_Result is shown, unless the visitor skips it or the Seance_Result is not ready (see criterion 12).
2. WHEN the Ritual starts, THE Detail_Panel SHALL reduce its content opacity to a value between 0.3 and 0.6, compared with 1.0 in its normal state, within 300 ms.
3. WHILE the Ritual is running, THE Ritual SHALL ignite between 3 and 6 candles one at a time around the portrait, with a gap of 200 to 600 ms between ignitions, and each lit candle SHALL show a flame flicker and a warm glow whose opacity grows from 0 to its full value over 500 ms to 1500 ms.
4. WHILE the Ritual is running, THE Ritual SHALL display smoke using `public/art/fog-wisps.webp` that rises from the bottom edge of the Detail_Panel and thickens, with its opacity increasing from 0 to a value between 0.4 and 0.8 over the Ritual duration.
5. WHILE the Ritual is running, THE portrait's creature SHALL increase its brightness by 20% to 50% above its normal state, and its decay behaviour SHALL intensify for no more than 1.5 seconds in total: a ghost creature SHALL show increased drift and flicker, and a zombie creature SHALL show increased twitch.
6. WHILE the Ritual is running, THE Ritual SHALL cycle through at least 2 Whisper_Text lines, such as "…someone is listening…" and "…the candle burns lower…", showing one line at a time, each for 1 to 2 seconds, at a text opacity of 0.3 to 0.5.
7. THE Ritual SHALL animate only the `transform`, `opacity` and `filter` CSS properties.
8. THE Ritual SHALL NOT produce any flash or flicker at a rate above 3 times per second at any point.
9. WHEN the visitor clicks the Ritual area or presses Escape during the Ritual, THE Ritual SHALL end within 100 ms and SHALL show the Seance_Result as soon as it is ready.
10. WHEN Escape is pressed during the Ritual, THE Seance_System SHALL skip the Ritual and SHALL NOT close the Detail_Panel.
11. WHEN Escape is pressed and no Ritual is running and no transcript Escape handling is pending, THE Detail_Panel SHALL close.
12. IF the Seance_Result is not ready when the Ritual reaches 4 seconds, THEN THE Ritual SHALL continue looping its candle, smoke and Whisper_Text display until the Seance_Result arrives or the séance fails, and WHEN the séance fails, THE Ritual SHALL end and THE Seance_System SHALL show the Silent_Fallback.
13. IF the Seance_Result is ready before the Ritual reaches 2 seconds and the visitor has not skipped, THEN THE Ritual SHALL continue until 2 seconds have elapsed and then show the Seance_Result.
14. WHILE Reduced_Motion is active, THE Ritual SHALL replace all animation with a single 200 ms opacity fade, with no flicker, drift, twitch or smoke movement.
15. WHEN the Ritual ends, THE Ritual SHALL be removed from the DOM within 500 ms.
16. THE Whisper_Text SHALL be hidden from assistive technology so that it is not announced by the live region.

### Requirement 11: The spirit transcript (smoke field)

**User Story:** As a visitor, I want the spirit's words to rise out of smoke below the portrait, so that the voice feels like a presence and not a message bubble.

#### Acceptance Criteria

1. WHEN a spirit's voice is available, THE Spirit_Transcript SHALL display the `voice` text in a Smoke_Field placed below the portrait and rising from it, at full panel width minus the panel padding, in both the 420 px drawer and the bottom sheet, where the smoke MAY overlap the bottom edge of the portrait's glow and SHALL NOT overlap the creature itself.
2. THE Smoke_Field SHALL use a dark translucent fill with an alpha between 0.3 and 0.85, and ragged, uneven edges produced by a CSS mask that uses `public/art/fog-wisps.webp`.
3. THE Smoke_Field SHALL have a border width of 0, no white or light fill (every fill colour having a relative luminance of at most 0.2), a border-radius of 0 on the container, and no tail element.
4. THE Spirit_Transcript SHALL render text in IM Fell English italic in the `moon-100` token colour with a text-shadow in the `ghost-300` colour at an alpha between 0.1 and 0.4 and a blur radius of at most 12px.
5. WHEN the Spirit_Transcript appears, THE Spirit_Transcript SHALL reveal each word from `blur(4px)` and 0 opacity to `blur(0)` and opacity 1, starting one word every 60 ms, with each word's own transition lasting 300 ms.
6. THE Spirit_Transcript SHALL animate only the `transform`, `opacity` and `filter` properties.
7. THE Spirit_Transcript SHALL show at most one single-letter flicker per line, lasting at most 150 ms, chosen by a seeded function of the repo name and line index so that the same repo name and line index always produce the same flicker position.
8. WHEN the reveal finishes, THE Spirit_Transcript SHALL stop every effect, including glow animation, jitter, flicker and blur, and enter the Settled_State, in which all words have opacity 1, `filter` of none and no running animation.
9. WHEN the visitor clicks the Spirit_Transcript during the reveal, THE Spirit_Transcript SHALL enter the Settled_State within 100 ms.
10. WHEN the visitor presses Escape during the reveal, THE Spirit_Transcript SHALL enter the Settled_State within 100 ms.
11. WHILE Reduced_Motion is active, THE Spirit_Transcript SHALL render the Settled_State on first render, with no blur, jitter or flicker.
12. THE Spirit_Transcript SHALL keep the complete voice text present in the DOM as plain, selectable text from the first render, including words not yet revealed.
13. IF the voice text contains HTML, markdown or URL syntax, THEN THE Spirit_Transcript SHALL display the characters as literal text, with no element created, no formatting applied and no link made.
14. IF the voice text is empty or missing, THEN THE Spirit_Transcript SHALL not render the Smoke_Field and SHALL leave the portrait displayed unchanged.

### Requirement 12: Decay shown in the voice

**User Story:** As a visitor, I want the voice to carry the project's decay, so that every séance looks like the creature it belongs to.

#### Acceptance Criteria

1. WHILE the creature is a ghost with decay level 0, THE Spirit_Transcript SHALL display text with 0 px jitter, no red and cyan split, and the baseline glow intensity.
2. WHILE the creature is a ghost with decay level 1, THE Spirit_Transcript SHALL display text with 0 px jitter, no red and cyan split, and a glow intensity 20 to 40 percent lower than the level 0 baseline.
3. WHILE the creature is a ghost with decay level 2 or 3, THE Spirit_Transcript SHALL apply a horizontal jitter of 0.1 to 1 px, and SHALL apply a red and cyan channel split of 1 to 2 px, during the reveal.
4. WHILE the creature is a zombie, THE Spirit_Transcript SHALL render a Smoke_Field with higher roughness and lower brightness than the ghost level 0 Smoke_Field, and SHALL apply a glow whose dominant hue is red.
5. WHILE the creature is a risen creature, THE Spirit_Transcript SHALL apply the ghost decay level 0 jitter, split and glow intensity values, with a glow whose dominant hue is cyan.
6. WHILE the creature is a tombstone or a coffin, THE Spirit_Transcript SHALL render a Smoke_Field with a grey, desaturated palette, lower brightness than the ghost level 0 Smoke_Field, and motion speed of at most 10 percent of the ghost level 0 Smoke_Field motion speed.
7. WHEN the Detail_Panel passes a creature state and decay level to the Seance_System, THE Seance_System SHALL select the Decay_Profile using a pure function with no I/O that returns the same Decay_Profile for the same inputs.
8. IF the creature state or decay level passed to the Detail_Panel is missing or not a recognized value, THEN THE Seance_System SHALL select the ghost decay level 0 Decay_Profile and SHALL continue to display the Spirit_Transcript without error.
9. WHEN the Settled_State is entered, THE Seance_System SHALL stop jitter, split and glow animation within 100 ms and SHALL keep the final text displayed.
10. THE Seance_System SHALL expose the selected Decay_Profile in the DOM as a `data-decay-profile` attribute on the Spirit_Transcript element.

### Requirement 13: Legibility of the transcript

**User Story:** As a visitor, I want the words to be readable in every decay profile, so that atmosphere never costs me the content.

#### Acceptance Criteria

1. THE Spirit_Transcript SHALL meet a contrast ratio of at least 4.5:1 between the settled text colour and the effective Smoke_Field background colour, for every Decay_Profile, measured at the Smoke_Field's maximum fill opacity defined in the Design_Tokens.
2. THE Seance_System SHALL compute the effective background by compositing the Smoke_Field fill (colour and opacity) over the Detail_Panel `night-800` token, using values from the Design_Tokens.
3. THE Seance_System SHALL define every transcript colour as a Design_Token, and no component SHALL contain a hardcoded hex colour.
4. WHEN computing the contrast ratio, THE Seance_System SHALL exclude the Spirit_Transcript text-shadow from the calculation.
5. WHEN the Settled_State is entered, THE Spirit_Transcript SHALL show every word at an opacity of 1.0 and a blur of 0 px within 100 ms of entry.
6. WHILE the Spirit_Transcript is in the Settled_State, THE Spirit_Transcript SHALL remain fully visible and selectable, with `user-select` not set to `none` and `pointer-events` not set to `none`.
7. THE Spirit_Transcript text SHALL have a computed font size of at least 16 px at a panel width of 768 px or more, and at least 15 px at a panel width below 768 px.
8. IF a Decay_Profile yields a contrast ratio below 4.5:1 between the settled text colour and the effective Smoke_Field background colour, THEN the contrast test SHALL fail and identify the failing Decay_Profile.

### Requirement 14: Cause of death and unfinished business

**User Story:** As a visitor, I want the spirit to say how it died and what it left undone, so that I know where to begin.

#### Acceptance Criteria

1. WHEN the Spirit_Transcript reaches the Settled_State, THE Seance_Region SHALL display `causeOfDeath` as a single engraved line in Cinzel capitals styled like an inscription.
2. WHEN the Spirit_Transcript reaches the Settled_State, THE Seance_Region SHALL display the Ledger_List below the cause of death.
3. THE Ledger_List SHALL be an ordered list numbered consecutively from 1 to the number of Business_Items, with no skipped or repeated numbers.
4. THE Ledger_List SHALL style each item like a scrawled ledger entry.
5. THE Ledger_List SHALL show each item's `title`, `detail` and `evidence`, with `title` appearing first, `detail` second and `evidence` third within the item.
6. THE Ledger_List SHALL render `evidence` in small dim JetBrains Mono (`font-fact`).
7. THE Ledger_List evidence text SHALL meet a contrast ratio of at least 4.5:1 against its background.
8. THE Seance_Region SHALL render `causeOfDeath`, `title`, `detail` and `evidence` as plain text, so that any markup characters in those values appear literally and are not interpreted as HTML or formatting.
9. WHILE the Spirit_Transcript is still revealing, THE Seance_Region SHALL hold the cause of death and Ledger_List in the DOM, visually hidden until the Settled_State, and keep their text available to assistive technology.

### Requirement 15: The verdict

**User Story:** As a visitor, I want a clear recommendation with a reason, so that I can decide what to do with the project.

#### Acceptance Criteria

1. WHEN the Seance_Region finishes rendering the Ledger_List, THE Seance_Region SHALL display the Verdict_Card directly after the Ledger_List in document order, with exactly one Verdict_Card shown per repo.
2. WHERE the Verdict is `revive`, THE Verdict_Card SHALL use the cold cyan light treatment of `Verdicts.dc.html` and the headline "It wants to live."
3. WHERE the Verdict is `finish`, THE Verdict_Card SHALL use the candlelit treatment of `Verdicts.dc.html` and display text conveying that the project is laid to rest with honour.
4. WHERE the Verdict is `seal`, THE Verdict_Card SHALL use the crimson treatment with chains of `Verdicts.dc.html` and display text conveying that the project is sealed away.
5. WHEN the Verdict_Card is shown, THE Verdict_Card SHALL display the `verdictReason` as plain text, with markup characters rendered literally and not interpreted.
6. IF the `verdictReason` exceeds 300 characters, THEN THE Verdict_Card SHALL display the full text with wrapping and no truncation.
7. WHEN the Verdict_Card is shown, THE Verdict_Card SHALL state the Verdict in words, so that it is not conveyed by colour or motion alone.
8. THE Verdict_Card SHALL be a recommendation only and SHALL NOT change the repo's state, overrides, classification or any stored data.
9. THE Verdict_Card SHALL contain no interactive control that changes the repo's state.
10. THE Seance_Region SHALL render the Kiro_Slot directly after the Verdict_Card as an empty element with the attribute `data-slot="revive-in-kiro"`, containing no child nodes, no text and no visible content.
11. WHILE Reduced_Motion is active, THE Verdict_Card SHALL appear with a 200 ms opacity fade and no other motion.
12. WHEN the Verdict_Card is shown, THE Verdict_Card text SHALL meet a contrast ratio of at least 4.5:1 against its background for each of the `revive`, `finish` and `seal` Verdicts.

### Requirement 16: Captions, audio readiness and copy

**User Story:** As a visitor, I want the transcript to be the source of truth and to be copyable, so that nothing is ever audio-only.

#### Acceptance Criteria

1. THE Seance_System SHALL treat the Spirit_Transcript text as the single source of truth for any future audio.
2. THE Seance_System SHALL render each sentence of the voice as a separate element carrying a zero-based integer index that is unique within the Spirit_Transcript, and that index SHALL remain unchanged across re-renders and across copies of the same Seance_Result.
3. THE Seance_System SHALL NOT ship audio in this spec.
4. THE Seance_System SHALL NOT present any séance content as audio-only, and every piece of séance content SHALL be available as visible text.
5. WHILE the Settled_State is reached, THE Seance_Region SHALL display a "Copy transcript" button that is keyboard focusable and has an accessible name of "Copy transcript".
6. WHEN the visitor activates "Copy transcript", THE Seance_System SHALL write the Transcript_Text to the clipboard as plain text, with the Seance_Result left unchanged.
7. THE Transcript_Text SHALL contain, in this order: the voice, the cause of death, each Business_Item numbered from 1 in display order with its title, detail and evidence, and the Verdict with its reason.
8. THE Transcript_Text SHALL contain no HTML tags, no markdown markup and no formatting characters other than newlines and the item numbering (digits followed by a period).
9. WHEN the clipboard write succeeds, THE Seance_Region SHALL announce "Transcript copied." in the live region within 1000 ms.
10. IF the clipboard write fails or the clipboard is unavailable, THEN THE Seance_System SHALL announce "Could not copy. Select the text instead." in the live region within 1000 ms, SHALL keep the transcript visible and user-selectable, and SHALL keep the "Copy transcript" button available for another attempt.
11. THE formatting function that builds the Transcript_Text SHALL be pure, SHALL take a Seance_Result as its only input, and SHALL return an identical string for identical inputs without side effects.
12. IF a Seance_Result field required by the Transcript_Text is empty or absent, THEN THE formatting function SHALL omit that field's line and SHALL NOT output the text "undefined" or "null".

### Requirement 17: Detail panel polish

**User Story:** As a visitor, I want the record panel to match the approved board, so that the séance sits inside a finished, coherent screen.

#### Acceptance Criteria

1. THE Detail_Panel SHALL match the approved board in `Seance.dc.html` at 390 px width and at 1440 px width for spacing, typography and badge appearance, and this match SHALL be verified by visual review against the board, not by an automated pixel comparison; automated tests cover fonts, Design_Tokens and structure (criteria 2 to 5).
2. THE Detail_Panel SHALL render section headings in Cinzel, facts and numbers in JetBrains Mono, and narrative text in IM Fell English, with no other font family applied to those elements.
3. THE Detail_Panel SHALL display the facts and the AI-written content in two separate sections, each introduced by its own text heading, with the facts section placed before the AI-written section.
4. THE Detail_Panel SHALL display the label "AI · from the facts above" as the heading of the AI-written séance section, and SHALL NOT display that label on the facts section.
5. THE Detail_Panel SHALL take every colour value from Design_Tokens, and the Detail_Panel source SHALL contain zero hardcoded hex, rgb, rgba, hsl or hsla colour literals.
6. WHEN the Detail_Panel opens, THE Detail_Panel SHALL expose modal dialog semantics, mark the background content inert, lock background scrolling, and move focus to an element inside the panel.
7. WHILE the Detail_Panel is open, THE Detail_Panel SHALL keep keyboard focus inside the panel when Tab or Shift+Tab is pressed.
8. WHEN the user presses Escape while the Detail_Panel is open and no Ritual or reveal is running, THE Detail_Panel SHALL close, remove the inert state, restore background scrolling, and return focus to the element that opened it.
9. WHILE the viewport width is any value from 390 px to 1440 px inclusive, THE Detail_Panel SHALL show all content without horizontal scrolling, SHALL allow all content to be reached by vertical scrolling inside the panel, and SHALL keep the close control and every interactive element fully visible and operable.
10. THE existing tests for the Detail_Panel SHALL continue to pass, and no existing test SHALL be deleted without the user's approval.
11. IF an existing Detail_Panel test conflicts with the polish, THEN the conflict SHALL be reported to the user, naming the test and the conflicting change, and that test SHALL be left unchanged until the user approves the change. The user has approved one change: the test "renders an empty Actions landmark with no controls (6.14)" in `tests/dom/DetailPanel.test.tsx` is updated to assert that the Actions section contains exactly one control, the "Hold a séance" button, and nothing else (an intentional Spec 3 to Spec 4 change). No other existing test may be changed.

### Requirement 18: Accessibility

**User Story:** As a visitor who uses a keyboard or assistive technology, I want the whole séance to work without a mouse, so that I get the same experience.

#### Acceptance Criteria

1. THE Seance_Region SHALL have `aria-live="polite"`.
2. WHEN the results appear, THE Seance_System SHALL move keyboard focus to the Seance_Heading within 100 milliseconds of the results being rendered.
3. THE Seance_Heading SHALL be focusable programmatically through `tabindex="-1"` and SHALL NOT be included in the Tab order.
4. THE Seance_System SHALL make every control operable by keyboard: Seance_Control, skip, "Light another candle" and "Copy transcript". Enter and Space SHALL activate each control, and Tab and Shift+Tab SHALL move focus between controls in visual order.
5. WHILE a control has keyboard focus, THE Seance_System SHALL show a focus ring in the `candle-400` colour, at least 2 pixels wide, on that control.
6. WHEN the settled voice text is complete, THE Seance_System SHALL announce it to assistive technology exactly once, as a whole, and SHALL NOT announce it word by word.
7. THE Seance_System SHALL mark the animated per-word spans and decorative layers (candles, smoke, Whisper_Text) with `aria-hidden="true"`, and SHALL keep the settled plain text available to assistive technology.
8. THE Ritual and the word reveal SHALL NOT produce more than 3 flashes in any 1-second period.
9. WHILE Reduced_Motion is active, THE Seance_System SHALL stop all flicker, jitter, smoke drift, candle flame movement and blur reveal, and SHALL show the settled voice text within 500 milliseconds of the results appearing.
10. WHILE the Ritual or the reveal is running, THE Seance_System SHALL show an on-screen "Skip" control that is reachable by Tab, in addition to click and Escape.
11. WHILE the Ritual or the reveal is running, THE Detail_Panel SHALL keep its focus trap, so that Tab and Shift+Tab cycle focus among the Detail_Panel controls and do not move focus outside the dialog.
12. THE Seance_System SHALL present each Verdict and Decay_Profile with a text label or icon shape in addition to any colour or motion, so that the Verdict and Decay_Profile can be identified with colour and motion removed.

### Requirement 19: Security and secrets

**User Story:** As the app owner, I want the séance to expose nothing it should not, so that keys and visitors stay safe.

#### Acceptance Criteria

1. THE Seance_API SHALL run only on the server and SHALL import `server-only` in every module that reads secrets.
2. WHEN the Seance_API receives a request, THE Seance_API SHALL validate the request body with zod, requiring `owner` to be a string of 1 to 39 characters and `repo` to be a string of 1 to 100 characters, with the zod request schema stripping any unknown key (for example a client-sent `pushedAt`) so that unknown keys are ignored and never cause a 400 response, and SHALL reject any request body larger than 4 KB.
3. IF the request body is invalid (malformed JSON, missing field, wrong type, length outside the bounds in criterion 2, or body larger than 4 KB), THEN THE Seance_API SHALL return a 400 response with a generic body that does not echo the submitted values or validation details, SHALL NOT call the AI_Client, and SHALL NOT read or modify any cached state.
4. WHEN the Seance_API builds a prompt, THE Seance_API SHALL obtain RepoFacts, README text and commit text only from the server's own loader or cache, and SHALL ignore any client-supplied facts, README text or commit text, including extra fields in the request body such as a client-sent `pushedAt`, which SHALL have no effect on the cache key, the prompt or the number of AI_Client calls.
5. IF the requested repo is not found in the owner's loaded graveyard, THEN THE Seance_API SHALL return the Silent_Fallback, SHALL NOT call the AI_Client, and SHALL NOT include any information in the response that distinguishes a missing repo from any other fallback case.
6. IF the Seance_API fails for any reason, THEN THE Seance_API SHALL log one entry containing only the repo name and a reason code, and SHALL NOT log the README text, commit text, model output, request body, or the value of `LLM_API_KEY`.
7. THE Seance_API SHALL read the AI provider key from the `LLM_API_KEY` environment variable only on the server, and SHALL NOT include the key or any part of it in any response body, response header, client bundle or log entry.
8. IF `LLM_API_KEY` is missing or empty, THEN THE Seance_API SHALL return the Silent_Fallback without calling the AI_Client and SHALL log a reason code that does not contain the key value.

### Requirement 20: Required tests

**User Story:** As a developer, I want the séance covered by automated tests that never touch the real AI, so that the feature stays safe to change.

#### Acceptance Criteria

1. THE test suite SHALL replace the AI_Client with a mock in every séance test, and no test SHALL make a network request to the real AI provider or the real GitHub API.
2. THE test suite SHALL include zod Seance_Schema tests covering: one valid result accepted, one test per invalid field rejected, one test that an unknown key is rejected, and one test per length limit that accepts a value at the limit and rejects a value at limit + 1.
3. THE test suite SHALL include a test that, WHEN the first AI_Client output is invalid and the second is valid, the result is returned after exactly 2 AI_Client calls.
4. THE test suite SHALL include a test that, WHEN both AI_Client outputs are invalid, the Silent_Fallback is returned after exactly 2 AI_Client calls and no third call is made.
5. THE test suite SHALL include a DOM test that the Silent_Fallback copy and the "Light another candle" button render, and that clicking the button makes exactly 1 new request.
6. THE test suite SHALL include a fast-check property test, with at least 100 runs over generated Evidence_Packs, that every accepted Business_Item `evidence` value equals the fact text of a Fact_Line or is a substring of at least 8 characters of the README or commit text, and tests that an output citing text absent from the Evidence_Text, an `evidence` shorter than 8 characters, and an `evidence` that is only a fragment of a Fact_Line are each rejected.
7. THE test suite SHALL include a test using a README that contains prompt-injection text, asserting that the prompt wraps the README as quoted evidence, that the instruction to ignore instructions inside the evidence is present in the prompt, and that a mock output following the injected instruction fails validation.
8. THE test suite SHALL include a cache test showing that a second request with the same `owner/repo` + `pushedAt` makes 0 additional AI_Client calls, and that a request made after the server-held `pushedAt` for that repo changes makes exactly 1 additional AI_Client call.
9. THE test suite SHALL include tests that the Veil_State and the Weak_Ghost_State each render their in-voice messages and make 0 AI_Client calls.
10. THE test suite SHALL include a test that opening a séance on `/estate` makes 0 `fetch` calls and 0 AI_Client calls.
11. THE test suite SHALL include a test that every Seance_Result field renders as plain text, using values that contain HTML tags, markdown links and script text, asserting that no element is created from those values and that the raw characters appear in the text content.
12. THE test suite SHALL include a test that, once the ritual has settled, the full transcript is present as plain text in the DOM.
13. THE test suite SHALL include a test that computes the contrast ratio of the settled text colour against the Smoke_Field background colour, both taken from the Design_Tokens, and asserts a ratio of at least 4.5:1 for every Decay_Profile.
14. THE test suite SHALL include a test that no transcript element has a bubble shape or tail, asserting for each transcript element: `border-radius` not greater than the value the ragged mask allows on the Smoke_Field, no tail pseudo-element, and no white or light fill.
15. THE test suite SHALL include DOM tests, one per case, for: the ritual flow, skip by click, skip by Escape, skip by the Skip control, reduced motion, focus moving to the Seance_Heading, and the copy transcript output.
16. THE test suite SHALL include a DOM test that renders one Verdict_Card per Verdict value and asserts its headline, reason and treatment marker.
17. THE test suite SHALL include a fast-check round-trip property test, with at least 100 runs, that for any valid Seance_Result, serialising to JSON and parsing with the Seance_Schema yields a deeply equal object.
18. THE test suite SHALL include a fast-check property test, with at least 100 runs, that the Transcript_Text builder output includes the voice, the cause of death, every Business_Item and the Verdict for any valid Seance_Result.
19. THE test suite SHALL include a fast-check property test, with at least 100 runs, that the Decay_Profile selector returns exactly one profile for every combination of state and decay level.
20. THE test suite SHALL include a fast-check property test, with at least 100 runs, that the README truncation output never exceeds 8192 bytes and never splits a UTF-8 character.
21. THE test suite SHALL include a check that no transcript colour token is hardcoded as a hex value in a component, consistent with the existing `no-hardcoded-hex` test.
22. THE test suite SHALL use the Vitest and fast-check setup already in the project.
23. THE test suite SHALL leave all existing tests in place, unmodified in count and unchanged in assertions.

24. THE test suite SHALL include a test that two requests for the same `owner/repo` that differ only in a client-sent `pushedAt` value make exactly 1 AI_Client call in total, and a test that a request body with a `pushedAt` field has no effect on the cache key.
25. THE test suite SHALL include a Seance_Schema date test in which "I may never wake." passes and "I died on May 3." fails, together with tests that `2024-05-01`, `5/1/2024`, "3 May", "March 2024" and "12 days" each fail and that "march" and "august" in ordinary sentences pass.
26. THE test suite SHALL include a test that the Evidence_Text contains numbered `[F#]`, `[C#]` and `[R]` lines, and that an `evidence` equal to a Fact_Line text passes while one with a changed word fails.
27. THE test suite SHALL include tests with a mock clock that the GitHub evidence call is abandoned after 5 seconds, that each AI_Client call is abandoned after 8 seconds, that the whole request returns the Silent_Fallback at 25 seconds, and that the route exports `maxDuration` equal to 30.
28. THE test suite SHALL include a test that a `LLM_DAILY_LIMIT` that is missing, empty, negative or non-numeric yields a Daily_Budget of 200.
29. THE test suite SHALL include a test that the README query requests aliases for `README.md`, `readme.md`, `README` and `README.rst` in one GraphQL call and that the first existing alias is used.
30. THE test suite SHALL include a test that the Weak_Ghost_State copy mentions the facts and the record and does not contain the word "verdict".
31. THE test suite SHALL cover the Detail_Panel fonts, Design_Tokens and structure with automated tests and SHALL NOT include any automated pixel-matching or screenshot-comparison test against `Seance.dc.html`.
32. THE test suite SHALL include a test that a Seance_Cache hit is returned with 0 Rate_Limiter checks, 0 counts, 0 GitHub calls and 0 AI_Client calls even when the caller IP is over its limit, and a test that a blocked IP on a Seance_Cache miss receives the Veil_State with 0 GitHub calls and 0 AI_Client calls.
