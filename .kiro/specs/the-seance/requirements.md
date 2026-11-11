# Requirements Document

## Introduction

The Séance (Spec 4) lets a visitor contact the dead from a repo's Detail_Panel (Spec 3). The repo's spirit speaks in the first person about itself, says how it died, names its unfinished business, and recommends a verdict (revive, finish or seal). The experience must feel like contacting the dead: dread, candlelight and smoke. It is never cute, never cartoonish and never a chatbot.

Scope and constraints taken from the existing project:

- AI goes through the existing provider-agnostic module `lib/llm.ts` (env `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`) described in `tech.md`. No new provider or SDK is introduced. At spec time `lib/llm.ts`, `lib/ai.ts`, `lib/seance.ts` and `lib/ratelimit.ts` are named in `structure.md` but do not exist in the repository; the design phase decides whether they are created or extended.
- Limits come from `tech.md`: a per-IP LLM limit of 30 calls per hour, a global daily budget set by env `LLM_DAILY_LIMIT` (default 200 when missing or invalid), and a 24-hour cache keyed by `owner/repo` + the server's own `pushedAt`. The client never supplies `pushedAt`. The fallback of 10 séances per hour applies only if the `tech.md` value cannot be applied.
- The existing `lib/cache.ts` is typed to the graveyard payload only. Séance caching reuses its `CacheClient` interface, timeout and best-effort behaviour, and adds a séance-typed read/write beside the graveyard ones.
- Voice follows `voice.md`: wistful, specific, never insulting, never inventing facts, never stating day counts or dates in the prose (the UI shows those).
- For the séance, the `voice.md` steering lines "60-120 words" and "always ends with a next step" are superseded by Requirements 4 and 5: `voice` is 2 to 3 sentences of at most 320 characters, and only a `revive` verdict may name a next step.
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
- **Ritual**: The staged summoning animation shown before the Spirit_Transcript. It lasts at least 2 seconds and its final stage is held until the Seance_Result arrives.
- **Ritual_Stage**: One of four stages (0 to 3) of the Ritual, timed from the start of the attempt at 0, 1200, 2500 and 4500 ms and never tied to server progress. Stage 3 is the Held_Stage. The stages are defined by pure functions in `lib/seance-ritual.ts`.
- **Held_Stage**: Ritual_Stage 3, which stays on screen until the Seance_Result or a failure arrives. There is no automatic end.
- **Stage_Text**: The short smoke text line of the Ritual: none at stage 0, "Calling {repo} back…" at stage 1, "Reading its last words…" at stage 2, "Something is answering…" at stage 3. It replaces the earlier cycling Whisper_Text.
- **Whisper_Text**: The earlier cycling phrases (`WHISPER_LINES`). Still exported by `lib/seance-ritual.ts` for compatibility, but no longer used by the Ritual.
- **Ritual_Portrait**: The repo's own creature art (the same `Creature` art as `components/detail/Portrait`), rendered decorative and `aria-hidden` by `RitualPortrait` in `components/seance/RitualParts.tsx` at the Ritual centre (50% horizontally, vertical position from `ritualGeometry`), dimmed to 60% opacity (`.ritual-portrait`) over a faint cold halo (`.ritual-halo`). It replaces the earlier solid surge disc.
- **Ritual_Layer**: The `data-ritual-layer` element of the Ritual (class `ritual-layer`, also `seance-scroll-target`), sticky below the fixed site header and containing the `ritual-box` that holds the candles, portrait and Stage_Text.
- **Ritual_Exit**: The decorative, `aria-hidden` layer (`components/seance/RitualExit.tsx`) played over the reveal after the Ritual unmounts: the flames gutter out together (`ok`) or the candles are snuffed one by one (silent, veil or weak).
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
3. THE Seance_Control SHALL be styled as the primary control of the Actions_Slot (class `.seance-primary`), showing a candle glyph followed by the visible text label "Hold a séance", with `ghost-300` text on a `night-800` background and a 1px `ember-500` border.
4. THE Seance_Control SHALL be a native `button` element that receives focus through the Tab key, activates on Enter and Space, and shows a visible focus ring using the `candle-400` color while focused.
5. WHEN the visitor activates the enabled Seance_Control, THE Seance_System SHALL start the Ritual and send exactly one request for the Seance_Result.
6. WHILE a séance is running for the open repo, THE Seance_Control SHALL be disabled, expose `aria-disabled="true"`, and ignore activation so that no additional Ritual or Seance_Result request starts.
7. WHEN the visitor closes the Detail_Panel, THE Seance_System SHALL discard any running or displayed séance for that repo and cancel any pending Seance_Result request.
8. WHEN the Detail_Panel opens for any repo after being closed, THE Seance_System SHALL be in the idle state with the Seance_Control enabled.
9. IF the Seance_Result request fails, THEN THE Seance_System SHALL end the Ritual and show the Silent_Fallback described in Requirement 9.
10. THE Actions_Slot SHALL keep its existing markup attributes `aria-label="Actions"` and `data-slot="actions"`.
11. THE Seance_Control SHALL be full width below 768 px and auto width with a minimum of 16rem from 768 px, and THE "Open on GitHub" and homepage links of the Detail_Panel SHALL stay secondary, outline-only controls.
12. WHEN the Seance_Control is hovered or has keyboard focus, THE Seance_Control SHALL fade in an inner ember glow (an `::after` layer with an inset `ember-500` box-shadow) over 700 ms (`--motion-seance-glow`) and then breathe it on a 4 s loop (`--motion-seance-breathe`), and the focus ring SHALL be a 3px `candle-400` ring (`.seance-focus`).
13. WHILE the Ritual or the reveal is running, THE Seance_Control SHALL show the visible label "The circle is open…", have the accessible name "Hold a séance. The circle is open…", show no glow, and remain focusable; WHILE the Seance_System is idle, THE Seance_Control SHALL show the label "Hold a séance".
14. THE Actions_Slot SHALL contain exactly one Seance_Control and no other control for the séance.
15. WHEN a result has been shown (outcome ok once settled, veil, weak or silent) and nothing is in flight, THE Seance_Control SHALL be enabled again, SHALL show the label "Hold another séance" (accessible name "Hold another séance"), and SHALL NOT expose `aria-disabled="true"`.
16. WHEN the visitor activates the Seance_Control labelled "Hold another séance", THE Seance_System SHALL start a new Ritual and send exactly one request through the RESTART event; the Seance_API MAY answer from the Seance_Cache, and showing the cached Seance_Result again is acceptable.
17. THE Seance_System SHALL accept the RESTART event only from the settled, veil, weak and silent states with nothing in flight, SHALL accept START only from idle, and SHALL accept RETRY only from silent.

### Requirement 2: Sample estate uses fixtures

**User Story:** As a judge or first-time visitor, I want the sample estate séances to work instantly, so that I can see the full experience without any account or cost.

#### Acceptance Criteria

1. WHEN the Detail_Panel is opened with `isFixture` set to true and a Fixture_Seance exists for that repo, THE Seance_System SHALL read the Seance_Result from that Fixture_Seance and make it ready within 500 milliseconds of the visitor starting the séance.
2. WHILE the Detail_Panel is open with `isFixture` set to true, THE Seance_System SHALL make zero network requests, zero AI_Client calls and zero GitHub calls.
3. THE Sample_Estate fixture data SHALL provide exactly one Fixture_Seance for every repo listed in `data/estate.json`.
4. THE Seance_System SHALL accept each Fixture_Seance entry as valid when it is validated against the Seance_Schema, with zero validation errors.
5. THE Fixture_Seance entries SHALL follow `voice.md` (except where superseded as stated in the Introduction), follow the same limits as Requirement 4, be written in the haunted, concise style defined in Requirement 5, and use only invented names, meaning no real person, company or GitHub account name appears in any entry.
6. THE Fixture_Seance entries SHALL include at least one entry for each of the three Verdict values and at least one entry for each creature type.
7. IF a fixture repo has no Fixture_Seance, THEN THE Seance_System SHALL show the Silent_Fallback, make zero network requests, and leave the Detail_Panel open and usable.
8. IF a Fixture_Seance fails validation against the Seance_Schema when read, THEN THE Seance_System SHALL show the Silent_Fallback, make zero network requests, and leave the Detail_Panel open and usable.
9. WHEN a Fixture_Seance is shown, THE Seance_System SHALL play the Ritual and the Spirit_Transcript with the same sequence, timing and visual presentation as a live séance.
10. THE Fixture_Seance entries SHALL be written to match the state of their repo, using the tone and the `causeOfDeath` meaning defined for that state in Requirement 5.13 and 5.14.

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
12. WHEN the Evidence_Text is derived, THE Seance_API SHALL strip markdown from the README text inside `deriveEvidence` before any other README step, removing emphasis markers, backticks, heading markers, list markers, code fences and HTML tags, replacing links with their link text, replacing images with their alt text, and collapsing whitespace runs to a single space, so that the README text sent to the AI_Client and the README text used to check `evidence` are the same string. The delimiter marker replacement in Requirement 6.4 SHALL run after the stripping, and a README that is empty after stripping SHALL be treated as no README.

### Requirement 4: Output shape and validation

**User Story:** As a developer, I want every séance to be strict, validated JSON, so that the UI never renders malformed or unsafe model output.

#### Acceptance Criteria

1. THE Seance_Schema SHALL require `voice` as a string of 2 to 3 sentences, with a maximum length of 320 characters.
2. THE Seance_Schema SHALL require `causeOfDeath` as a string of exactly 1 sentence, with a maximum length of 200 characters.
3. THE Seance_Schema SHALL require `unfinishedBusiness` as an array of 1 to 4 Business_Items (the prompt still asks for 2 to 4, or the budget count of Requirement 5.11, and Requirement 4.29 repairs a response that has fewer or more), each with a `title` of 1 to 80 characters, a `detail` of exactly one sentence of at most 140 characters, and an `evidence` of 8 to 200 characters, where each string contains at least one non-whitespace character.
4. THE Seance_Schema SHALL require `verdict` to be exactly one of `revive`, `finish` or `seal`, compared case-sensitively.
5. THE Seance_Schema SHALL require `verdictReason` as a string of 1 to 300 characters containing at least one non-whitespace character.
6. THE Seance_Schema SHALL reject any Seance_Result in which a string field exceeds its maximum length stated in criteria 1 to 5.
7. THE Seance_Schema SHALL reject objects that contain keys not defined in the Seance_Result or in a Business_Item, and SHALL reject objects that omit any required key.
8. WHEN the AI_Client returns output, THE Seance_API SHALL parse it as JSON, repair it as defined in criteria 29 to 31, and validate the repaired object with the Seance_Schema and the grounding check before using any field.
9. IF the output is not valid JSON, fails the Seance_Schema, or fails the grounding check, THEN THE Seance_API SHALL call the AI_Client one more time.
10. IF the AI_Client call fails with a timeout or an error, THEN THE Seance_API SHALL treat the attempt as a failed validation and apply criterion 9 or criterion 11.
11. IF the retry also fails validation, times out, or errors, THEN THE Seance_API SHALL return the Silent_Fallback state and SHALL NOT return partial fields from either attempt.
12. THE Seance_API SHALL call the AI_Client at most 2 times for one séance request.
13. THE Seance_API SHALL NOT return, log to the client, or render raw model text, including in error responses.
14. THE Seance_API SHALL cache only validated Seance_Results and SHALL NOT cache the Silent_Fallback.
15. THE Seance_API SHALL call the AI_Client with a maximum output length of 1,500 tokens and a timeout of 8 seconds per call.
16. THE Seance_API SHALL instruct the AI_Client to produce prose that states no day counts and no dates, per `voice.md`.
17. THE Seance_API route SHALL export an explicit `maxDuration` of 30 seconds.
18. IF the whole request, including the GitHub evidence call and all AI_Client calls, has not finished within 25 seconds, THEN THE Seance_API SHALL stop work, return the Silent_Fallback, and SHALL NOT cache any result.
19. IF the `verdict` is `finish` or `seal` and the `verdictReason` contains next-step language (for example "next step", "then cut", "add", "implement", "fix" or "test"), THEN THE Seance_Schema SHALL reject the Seance_Result as invalid and THE Seance_API SHALL apply the retry rule in criteria 9 to 11, so that only a `revive` verdict may name a next step. This is a hard reject and is never repaired (criterion 32).
20. IF any sentence of `voice`, a Business_Item `title`, a Business_Item `detail` or `verdictReason` contains both the word "memory" and the word "faded" (case-insensitive), including the exact sentence "My memory of that has faded.", THEN THE Seance_Schema SHALL reject the Seance_Result as invalid, except that repair removes such a `voice` sentence (criterion 31) and drops such a Business_Item (criterion 29) before the Seance_Schema runs, so only a `verdictReason` or `causeOfDeath` violation is a hard reject. IF `causeOfDeath` contains both words and is not exactly "My memory of that has faded." as its entire value, THEN THE Seance_Schema SHALL also reject the Seance_Result. The sentence is therefore allowed only as the entire `causeOfDeath`, and Requirement 6.13 adds a grounding condition for it.
21. THE Seance_API SHALL instruct the AI_Client to avoid upbeat status phrasing (such as "still running", "working well", "up and running" or "all set") in `voice` and `causeOfDeath`, and THE Seance_Schema SHALL NOT reject a Seance_Result for upbeat status phrasing, so that this rule is prompt-only and never costs a retry.
22. IF the `detail` of a Business_Item describes completed work, meaning it contains "was", "were", "is" or "been" followed by "closed", "fixed", "added", "updated", "completed", "merged", "resolved", "finished" or "implemented", or contains the bare word "completed", THEN THE Seance_Schema SHALL reject that Business_Item as invalid and repair SHALL drop that item with code `completed-work` (criterion 29) instead of rejecting the whole Seance_Result, except that negated forms such as "never completed" and "half-completed" SHALL NOT cause the item to be dropped.
23. WHEN attempt 1 fails JSON parsing, the Seance_Schema or the grounding check, THE Seance_API SHALL append to the system prompt of the second AI_Client call a note of the form "Attempt 1 rejected: <path> [<rule-code>]: <fixed phrase>; ... Fix only these and keep everything else valid.", where each entry names a schema field path (or the grounding location) and a rule code, with at most 8 entries, deduplicated. `buildFeedbackNote` in `lib/ai.ts` SHALL build the note from `ruleFailuresFromIssues` (`lib/seance-schema.ts`) and `groundingFailures` (`lib/seance.ts`).
24. THE feedback note SHALL contain only rule codes, schema field paths and fixed phrases defined in code, and SHALL NOT contain any text from the model's previous output.
25. THE rule codes SHALL be exactly `not-json`, `date-rule`, `next-step`, `memory-faded`, `completed-work`, `sentence-count`, `length`, `blank`, `unknown-key`, `type`, `value`, `evidence-not-grounded` and `schema`.
26. THE user message of the second AI_Client call (the evidence blocks) SHALL be identical to the user message of the first call.
27. IF attempt 1 fails because the AI_Client throws an error or times out, THEN THE Seance_API SHALL send the second call with the original system prompt and no feedback note.
28. WHEN an attempt fails, THE Seance_API SHALL record in that attempt's dev diagnostic entry a `ruleCodes` list holding the unique rule codes that failed in that attempt (from parsing, repair, the Seance_Schema or the grounding check), and the entry SHALL NOT contain model text.
29. WHEN the AI_Client output has been parsed as JSON and before the Seance_Schema runs, THE Seance_API SHALL call `repairSeance` from the new pure module `lib/seance-repair.ts`, which repairs the `unfinishedBusiness` ledger per item and not per response: a Business_Item SHALL be dropped when its `evidence` is not grounded under Requirement 6 (including the bare-name rule of 6.12 and the 12-character quote minimum of 6.6), or when the item breaks an item rule of the Seance_Schema (completed-work, date-rule, memory-faded, length, sentence-count, blank, unknown-key or type), and at most 4 items SHALL be kept, with extra items dropped with code `length`.
30. WHEN `repairSeance` leaves at least 1 Business_Item, THE Seance_API SHALL accept the response for schema and grounding validation, and IF `repairSeance` leaves 0 Business_Items, THEN THE Seance_API SHALL reject the attempt, use the per-item drop reasons (code and path) as the rejection reasons and as the feedback note entries of criterion 23 for attempt 2, and apply the retry rule in criteria 9 to 11.
31. WHEN `repairVoice` (in `lib/seance-repair.ts`) receives a `voice`, THE Seance_API SHALL remove every sentence that contains a date or day count or that mentions the faded-memory wording, then cut the voice to the first sentences that fit within 3 sentences and 320 characters, and IF fewer than 2 sentences would remain or fewer than 2 sentences fit, THEN THE Seance_API SHALL leave the voice untouched so that the Seance_Schema rejects it, and a voice that needs no repair SHALL be returned byte-for-byte unchanged.
32. THE Seance_API SHALL NOT repair the following, which remain hard rejects through the Seance_Schema and grounding check: a `finish` or `seal` `verdictReason` with next-step language (criterion 19), any `causeOfDeath` rule, the `verdict` value, unknown or missing top-level keys, a `verdictReason` rule, and every other check the Seance_Schema makes outside the Business_Item rules of criterion 29.
33. WHEN an attempt is processed, THE Seance_API SHALL record in that attempt's dev diagnostic entry a `repairedCodes` list holding the unique codes of the Business_Items and `voice` sentences that repair dropped or trimmed (such as `evidence-not-grounded`, `completed-work`, `date-rule`, `length`, `memory-faded` and `voice-trimmed`), and WHEN an attempt is accepted after repair removed or trimmed anything, THE Seance_API SHALL emit the dev diagnostic category `repaired` for that attempt, and neither the `repairedCodes` list nor the category SHALL contain model text.

### Requirement 5: Voice and tone of the generated text

**User Story:** As a visitor, I want the spirit to sound like a dead project, so that the séance feels haunting rather than like a chatbot.

#### Acceptance Criteria

1. THE Seance_API SHALL instruct the AI_Client to write `voice` in the first person as the dead project, in a wistful and unsettling tone that follows the tone rules defined in `voice.md`.
2. THE Seance_API SHALL instruct the AI_Client to write `causeOfDeath` as exactly one sentence, grounded in facts present in the Evidence_Pack, that attributes the death to circumstances (such as lost attention, changed priorities or abandoned dependencies) and does not name or blame the developer.
3. THE Seance_API SHALL instruct the AI_Client to avoid insults, descriptions of gore or graphic bodily harm, facts that do not appear in the Evidence_Pack, and names of real people other than the repo owner's username.
4. THE Seance_API SHALL instruct the AI_Client to avoid chatbot phrasing, defined as greetings, offers of help, questions addressed to the visitor, and the words "AI" or "assistant".
5. WHEN the Evidence_Pack does not contain the information needed to address a point, THE Seance_API SHALL instruct the AI_Client not to guess and not to write the sentence "My memory of that has faded." in `voice`, `title`, `detail` or `verdictReason`, and to use that exact sentence only as the entire `causeOfDeath` when the README and the commits are both missing.
6. IF a `voice` contains a numeric date (such as `2024-05-01` or `5/1/2024`), a month name immediately next to a day number or a 4-digit year (such as "May 3", "3 May" or "March 2024"), or a day count (a number followed by "day" or "days"), THEN the date or day-count sentence SHALL be removed by `repairVoice` (Requirement 4.31) and, if the voice cannot be repaired, THE Seance_Schema SHALL reject the response as invalid, and a month word that is not next to a day number or 4-digit year (such as "may", "march" or "august" in an ordinary sentence) SHALL NOT cause rejection.
7. IF the Seance_Schema rejects a generated response under criterion 6, THEN THE Seance_API SHALL apply the retry rule in Requirement 4, SHALL NOT return the rejected text to the visitor, and, if the retry also fails, SHALL return the Silent_Fallback.
8. THE Seance_API SHALL instruct the AI_Client with these Verdict meanings: `revive` means the project is worth continuing and the `verdictReason` names the next concrete step; `finish` means the project already does what it was meant to do and the `verdictReason` says what it accomplished and suggests marking it done or archiving it; `seal` means the project is not worth continuing and the `verdictReason` says why without blame.
9. THE Seance_API SHALL instruct the AI_Client to write `voice` in a haunted voice: first person as something that has died and still lingers, sensory, with quiet dread, specific to the evidence, and with no recap of the README's purpose.
10. THE Seance_API SHALL include in the prompt two short tone examples of the haunted voice.
11. WHEN the repo is small, defined as having at most 3 informative evidence lines and a README that is absent or shorter than 600 characters, THE Seance_API SHALL instruct the AI_Client to write exactly 2 Business_Items, and for any richer repo THE Seance_API SHALL instruct the AI_Client to write 2 to 4 Business_Items.
12. WHEN a séance is requested, THE Seance_API SHALL classify the creature state on the server with `classify(facts, undefined, now)` from the server-held RepoFacts and SHALL NOT use any state sent by the client.
13. WHEN the Seance_API builds a prompt, THE Seance_API SHALL include an intro and a tone note for the classified state: ghost is restless and not yet dead, and describes what is unfinished; risen is back from the dead, uneasy, on borrowed time; zombie is dead but walking, with decay and hunger; tombstone is at rest, peaceful and proud; coffin is sealed, cold and distant.
14. THE Seance_Schema SHALL keep the field name `causeOfDeath` for every state, and the visible heading for that field SHALL depend on the state: "What keeps me here" for ghost, "Why I returned" for risen, "Cause of death" for zombie, "How I was laid to rest" for tombstone and "Why I was sealed" for coffin.
15. THE heading texts SHALL be defined once, as `CAUSE_HEADINGS` and `causeHeading` in `lib/seance-schema.ts`, and the prompt, the UI and the tests SHALL all read them from there; IF the state is unknown, THEN `causeHeading` SHALL return the zombie heading.
16. WHERE a visitor has set a browser-only override, THE Seance_System SHALL accept that the server does not see the override, so that the text may be written for a different state than the heading the UI shows.
17. WHEN a séance is requested for a ghost, THE Seance_API SHALL take the decay level from the same server-side `classify` result as the state, pass it to the prompt, and instruct the AI_Client to set the tone by decay level: decay 0 is restless, present and a little uneasy, a spirit that has just noticed it is fading; decay 1 is thinning, with sounds and details slipping away; decay 2 and 3 are barely holding on, fragmentary and flickering, with dread, showing forgetting through broken images and never by saying that memory faded.
18. THE Seance_API SHALL instruct the AI_Client that every state carries an undertone of unease or dread, and SHALL forbid upbeat status phrasing ("still running", "working well", "up and running", "all set") in `voice` and `causeOfDeath`.
19. WHEN the classified state is ghost, THE Seance_API SHALL instruct the AI_Client to write `causeOfDeath` (shown under "What keeps me here") as one sentence naming the single unfinished thing from the evidence that binds the spirit, and not a list of features.
20. THE Seance_API SHALL instruct the AI_Client to write the `detail` of every Business_Item as something not yet done.

### Requirement 6: Grounding and prompt-injection safety

**User Story:** As a visitor, I want every claim in the séance to trace to real data, and I want hostile README text to have no power over the output.

#### Acceptance Criteria

1. WHEN the Seance_API builds a prompt, THE Seance_API SHALL place Untrusted_Text only inside quoted evidence blocks, each opened and closed by a fixed delimiter marker, and SHALL place no Untrusted_Text outside those blocks.
2. WHEN the Seance_API builds a prompt, THE Seance_API SHALL include an instruction telling the AI_Client to treat the content of the quoted evidence blocks as data only and to ignore any instruction found inside them.
3. WHEN the Seance_API builds a prompt, THE Seance_API SHALL include an instruction telling the AI_Client that the output format and content rules cannot be changed by any text inside the quoted evidence blocks.
4. IF Untrusted_Text contains the delimiter marker used by the quoted evidence blocks, THEN THE Seance_API SHALL replace every occurrence of that marker in the Untrusted_Text with a non-delimiter placeholder before building the prompt, so that the prompt contains exactly one opening and one closing marker per evidence block.
5. WHEN the Seance_API builds a prompt, THE Seance_API SHALL instruct the AI_Client to set each Business_Item `evidence` to an exact copy of the fact text of one Fact_Line, or to a verbatim substring of the README text or of one commit message that is at least 12 and at most 80 characters long.
6. WHEN the Seance_API receives AI_Client output, THE Seance_API SHALL accept a Business_Item `evidence` string only if, after both sides are normalized with `normalizeForMatch` (criterion 14), it equals the fact text of one Fact_Line, or it is a substring of the README text or of one commit message and is at least 12 and at most 80 characters long, where both sides are first normalized as defined in criterion 14. An exact copy of a Fact_Line fact text remains accepted regardless of the 80-character cap.
7. IF a Business_Item `evidence` string is not accepted under criterion 6, THEN THE Seance_API SHALL drop that Business_Item with code `evidence-not-grounded` as defined in Requirement 4.29, and only IF no Business_Item survives SHALL the Seance_API treat the output as invalid, discard it, and apply the retry rule in Requirement 4.
8. IF a Business_Item `evidence` string is shorter than 8 characters after trimming leading and trailing whitespace, THEN THE Seance_API SHALL drop that Business_Item under criterion 7.
9. WHEN the Seance_API receives AI_Client output, THE Seance_API SHALL repair and validate the Seance_Result against the same schema and grounding rules in criteria 5 to 8, regardless of the content of Untrusted_Text.
10. THE Seance_System SHALL render every Seance_Result field as plain text, so that HTML tags, markdown syntax and URLs in a field are displayed as literal characters and none is rendered as an element, formatting or a clickable link.
11. THE Seance_System SHALL NOT use `dangerouslySetInnerHTML` for any Seance_Result field.
12. IF a Business_Item `evidence` string, after punctuation is removed and case is folded, equals the repo name, the owner name or `owner/repo`, THEN THE Seance_API SHALL drop that Business_Item under criterion 7, even when that string occurs in the README, so that evidence carries information. `deriveEvidence` SHALL receive the owner so that it can build the list of these names.
13. IF `causeOfDeath` is exactly "My memory of that has faded." and the Evidence_Pack has a README or at least one commit message, THEN THE Seance_API SHALL treat the output as invalid, discard it, and apply the retry rule in Requirement 4 (a hard reject, never repaired).
14. THE Seance_API SHALL compare `evidence` against the sources in criterion 6 using `normalizeForMatch` in `lib/seance.ts`, applied to both the source text and the model's `evidence` string: curly single and double quotes become ASCII quotes, en dashes, em dashes and similar dashes become `-`, the ellipsis character becomes `...`, a non-breaking space becomes a space, the markdown symbols `` ` `` `*` `_` `#` `>` `[` `]` `(` `)` are removed, case is folded, and whitespace runs are collapsed and trimmed. The 12-character minimum (measured after normalization), the 80-character maximum, the exact Fact_Line allowance and the bare-name rule of criterion 12 SHALL be unchanged.

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
13. THE Seance_Cache SHALL begin every key with the prefix `seance:v6`, so that a Seance_Result generated with an earlier prompt is never served.
14. WHEN a classified state is given, THE Seance_Cache SHALL append the suffix `:{state}` to the key, so that séances written for different states never share an entry.
15. WHEN the classified state is ghost, THE Seance_Cache SHALL append the suffix `:d{decayLevel}` after the state suffix, so that séances written for different ghost decay levels never share an entry, and THE Seance_Cache SHALL append no decay suffix for any other state.

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

1. WHEN a séance starts, THE Ritual SHALL run for a minimum of 2 seconds (`RITUAL_MIN_MS`, the same number as the hook's `RITUAL_FLOOR_MS`), measured from Ritual start to the moment the Seance_Result is shown, even on a cache hit or a Fixture_Seance, and THE Ritual SHALL advance through Ritual_Stages 0 to 3 at 0, 1200, 2500 and 4500 ms from the start of the attempt, never tied to server progress (see criterion 12).
2. WHEN the Ritual starts, THE Detail_Panel SHALL reduce its content opacity to a value between 0.3 and 0.6, compared with 1.0 in its normal state, within 300 ms.
3. WHILE Ritual_Stage 0 is active (0 to 1.2 s), THE Ritual SHALL light five candles (`RITUAL_CANDLE_COUNT`) one at a time around the portrait, one ignition every 240 ms (`RITUAL_CANDLE_GAP_MS`) with all five lit by 1.2 s, and THE Ritual SHALL dim the panel edges with a vignette that reaches opacity 0.85 over 1.2 s.
4. WHILE Ritual_Stage 1 is active (1.2 to 2.5 s), THE Ritual SHALL display smoke (the existing `public/art/fog-wisps.webp` art) that rises from the candles and gathers above the portrait, together with the Stage_Text "Calling {repo} back…".
5. WHILE the Ritual is running, THE portrait's creature SHALL increase its brightness by 20% to 50% above its normal state, and its decay behaviour SHALL intensify for no more than 1.5 seconds in total: a ghost creature SHALL show increased drift and flicker, and a zombie creature SHALL show increased twitch.
6. WHILE Ritual_Stage 2 is active (2.5 to 4.5 s), THE Ritual SHALL creep frost inward from the four panel corners (`ghost-300` radial gradients at low opacity), lean the candle flames toward the portrait, and show the Stage_Text "Reading its last words…".
7. THE Ritual SHALL animate only the `transform`, `opacity` and `filter` CSS properties.
8. THE Ritual SHALL NOT produce any flash or flicker at a rate above 3 times per second at any point.
9. WHEN the visitor clicks the Ritual area, uses the Skip control or presses Escape during the Ritual, THE Ritual SHALL jump to the Held_Stage immediately within 100 ms with no build-up (`data-instant`), SHALL NOT skip the wait for the Seance_Result, and SHALL show the Seance_Result as soon as it is ready; WHEN the Seance_Result is already in, the reveal behaviour SHALL be unchanged.
10. WHEN Escape is pressed during the Ritual, THE Seance_System SHALL skip the Ritual and SHALL NOT close the Detail_Panel.
11. WHEN Escape is pressed and no Ritual is running and no transcript Escape handling is pending, THE Detail_Panel SHALL close.
12. WHILE the Held_Stage (from 4.5 s) is active, THE Ritual SHALL show the Stage_Text "Something is answering…", flicker the flames slowly on a 3.2 s loop and breathe the frost on a 6 s loop, and SHALL hold this stage until the Seance_Result arrives or the séance fails, with no automatic end; WHEN the séance fails, THE Ritual SHALL end and THE Seance_System SHALL show the Silent_Fallback.
13. IF the Seance_Result is ready before the Ritual reaches 2 seconds and the visitor has not skipped, THEN THE Ritual SHALL continue until 2 seconds have elapsed and then show the Seance_Result.
14. WHILE Reduced_Motion is active, THE Ritual SHALL show the five candles lit and static and a static vignette, with no smoke, frost, lean, flame flicker, creature surge or Ritual_Exit, no inline transform and `animation: none` and `transform: none` on the Ritual classes, and THE Stage_Text SHALL still change at the same stage times and fade in over 200 ms using opacity only (`--motion-ritual-fade-reduced`).
15. WHEN the Ritual ends, THE Ritual SHALL be removed from the DOM within 500 ms.
16. THE visible Stage_Text and every decorative Ritual layer SHALL be hidden from assistive technology (`aria-hidden="true"`), and THE Seance_Region SHALL announce the current Stage_Text through a visually hidden element (`data-seance-stage`) inside the existing `aria-live="polite"` region, once per Ritual_Stage and never per frame, with stage 0 announcing nothing.
17. THE Ritual SHALL be dim, slow and smoky, using CSS and SVG only with no new image assets, animating only `transform`, `opacity` and `filter`, using Design_Tokens only (no hex literal in the séance CSS block), and with no cartoon shapes, bounce or bright colours.
18. WHEN the Seance_Result arrives with outcome `ok`, THE Ritual SHALL unmount and THE Ritual_Exit SHALL play over the reveal, gutting the flames together over 450 ms (`RITUAL_EXIT_MS.resolved` is 600 ms in total) and dissolving the Stage_Text, after which the Spirit_Transcript reveal SHALL run unchanged.
19. WHEN the outcome is silent, veil or weak, THE Ritual_Exit SHALL snuff the candles one by one, 180 ms apart (`RITUAL_SNUFF_GAP_MS`, `RITUAL_EXIT_MS.silent` is 1400 ms in total), while the frost recedes, and no Spirit_Transcript SHALL be shown.
20. THE Ritual_Exit SHALL be decorative (`aria-hidden`), SHALL NOT be rendered under Reduced_Motion, and SHALL NOT play when the Detail_Panel is closed.
21. WHEN a séance starts, THE Seance_Region SHALL scroll the Ritual_Layer into view once per attempt with `scrollIntoView({ block: "start", behavior: "smooth" })` only after the Ritual_Layer has mounted and laid out (see criterion 36), THE class `seance-scroll-target` SHALL set `scroll-margin-top: var(--site-header-h)` so the fixed site header is cleared, and the Ritual box height SHALL equal the dialog height minus the site header height (`--site-header-h`, read with `getComputedStyle`, in rem or px), capped as in criterion 37.
22. WHEN the result reveals (phase revealing), THE Seance_Region SHALL scroll the Seance_Heading (the top of the transcript, also `seance-scroll-target`) into view the same way, once per attempt, and WHEN the visitor holds another séance, THE Seance_Region SHALL scroll again for the new attempt.
23. WHILE Reduced_Motion is active, THE Seance_Region SHALL scroll with `behavior: "auto"`.
24. WHEN a séance starts, THE Seance_System SHALL NOT move focus; WHEN the result reveals, THE Seance_System SHALL still move focus to the Seance_Heading as specified in Requirement 18, using `preventScroll` so that focus itself does not scroll the page.
25. THE Ritual SHALL render the Ritual_Portrait at the Ritual centre (50% horizontally, positioned vertically by the geometry of criterion 32) at 60% opacity over a `.ritual-halo` (a blurred radial gradient of `ghost-300` to transparent at opacity 0.16, never a solid shape), and THE Ritual SHALL render no opaque disc layer (no `.ritual-surge-ghost` or `.ritual-surge-zombie` element and no `data-ritual-creature` element).
26. THE Ritual SHALL render the Ritual_Portrait under Reduced_Motion with no movement, and THE Ritual_Exit SHALL render the Ritual_Portrait in its layer and fade it with the exit.
27. THE Ritual SHALL place the five candles in an elliptical ring around the Ritual_Portrait, positioned in pixels as specified in criterion 32, and the panel Portrait SHALL keep the `ritualSurgeClass` animation class unchanged.
28. THE Ritual SHALL draw each candle with an 18 by 28 px flame shaped as a soft blurred teardrop (a rotated rounded square, `border-radius: 0 50% 50% 50%`, 1.2 px blur) and a wax body (see criterion 34) whose height is a base height times a `heightScale` taken from [1, 0.84, 1.14, 0.92, 1.06] (set as `--wax-h`), with a faint warm glow (`.ritual-glow`, a blurred `ember-500` radial gradient) behind the flame, and the 240 ms ignition stagger SHALL stay unchanged.
29. THE Ritual frost SHALL follow criterion 31 (soft, noise-masked, peak opacity 0.4).
30. THE Stage_Text SHALL use a 16 px font size, the `moon-300` colour, a soft `night-sky` text-shadow, a peak opacity of 0.85 (including the Reduced_Motion 200 ms fade) and a position taken from the geometry of criterion 32 (`textTop`, in px).
31. THE Ritual frost SHALL be soft: each of the four panel corners SHALL carry a blurred radial cold tint (`ghost-300` to transparent) masked by an SVG `feTurbulence` `fractalNoise` data-URL mask (base frequency 0.011 by 0.016, `numOctaves` 3, alpha boosted by an `feColorMatrix`) with a different mask position per corner, so that the edge is ragged and crystalline; THE frost SHALL contain no straight lines and no repeating or conic gradients; THE frost SHALL peak at opacity 0.4, breathe between 0.4 and 0.32 in the Held_Stage and recede from 0.4 in the Ritual_Exit; and only `opacity` and `transform` SHALL transition.
32. THE Ritual SHALL place the five candles in pixels on an ellipse around the Ritual_Portrait using the pure function `ritualGeometry(width, height)` in `lib/seance-ritual.ts`, computed from the measured Ritual size (`components/seance/useRitualBox.ts`, using a `ResizeObserver`, falling back to a 420 by 560 px box before measurement and in jsdom), such that the top candle is above the portrait's head, no candle box touches the portrait box (at least 10 px gap, tested with a 0.5 px tolerance), all candles stay inside the Ritual width, and the ellipse is a little wider than tall; THE Stage_Text SHALL be positioned from the geometry (`textTop`, in px) just below the candles and above the Skip control.
33. THE Ritual_Portrait SHALL be up to 168 px (previously 136 px), shrinking on short rituals down to 96 px so the whole block fits, SHALL stay dimmed to 60% over the cold halo, and its art SHALL fill the box (CSS variable `--portrait-size`, halo 1.8 times larger).
34. THE candle wax SHALL be about 11 px wide (previously 12 px) with a vertical gradient from `moon-300` (dim ivory) to `night-sky` (shadow), a slightly irregular rounded top and opacity 0.6, and a small dark wick (2 by 7 px, `night-sky`) SHALL sit between the flame and the wax; the blurred teardrop flame, the warm glow and the uneven heights SHALL be kept.
35. THE smoke layer SHALL fade out at its top and bottom edge with a `linear-gradient` `mask-image` (transparent, black 25%, black 75%, transparent, also `-webkit-` prefixed) so that no hard edge shows.
36. THE Seance_Region SHALL scroll the Ritual into view (`scrollIntoView` with block `start`, smooth, or `auto` under Reduced_Motion) only after the Ritual_Layer has mounted and laid out: a stable ref callback on the layer SHALL schedule `requestAnimationFrame` and then call the region's `onLaidOut` once per attempt; WHEN the Ritual unmounts before that frame, THE frame SHALL be cancelled, so that a Ritual that ends before its first frame (for example under Reduced_Motion with an instant answer) causes no Ritual scroll; THE scroll SHALL NOT be called from the click handler; THE Ritual_Layer (class `ritual-layer`) SHALL stick below the fixed site header (`top: var(--site-header-h)`) and SHALL be a scroll target with `scroll-margin-top: var(--site-header-h)`, so that the Ritual's top clears the header.
37. THE Ritual box (class `ritual-box`) SHALL have `max-height: calc(100dvh - var(--site-header-h) - 96px)` so that the whole Ritual, including the Stage_Text, fits on screen, and its height SHALL otherwise be the dialog height minus the header height.
38. THE Ritual_Exit layer SHALL measure its own box with the same function and SHALL therefore show the candles, portrait and text where the Ritual had them.

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

1. WHEN the Spirit_Transcript reaches the Settled_State, THE Seance_Region SHALL display `causeOfDeath` as a single engraved line (`.cause-engraved`) in the narrative font (IM Fell English), in sentence case with no uppercase display styling (`text-transform: none`, normal letter-spacing, line-height 1.5), under the state heading defined in Requirement 5.14.
2. WHEN the Spirit_Transcript reaches the Settled_State, THE Seance_Region SHALL display the Ledger_List below the cause of death.
3. THE Ledger_List SHALL be an ordered list numbered consecutively from 1 to the number of Business_Items, with no skipped or repeated numbers.
4. THE Ledger_List SHALL style each item like a scrawled ledger entry.
5. THE Ledger_List SHALL show each item's `title`, `detail` and `evidence`, with `title` appearing first, `detail` second and `evidence` third within the item.
6. THE Ledger_List SHALL render `evidence` in small dim JetBrains Mono (`font-fact`).
7. THE Ledger_List evidence text SHALL meet a contrast ratio of at least 4.5:1 against its background.
8. THE Seance_Region SHALL render `causeOfDeath`, `title`, `detail` and `evidence` as plain text, so that any markup characters in those values appear literally and are not interpreted as HTML or formatting.
9. WHILE the Spirit_Transcript is still revealing, THE Seance_Region SHALL hold the cause of death and Ledger_List in the DOM, visually hidden until the Settled_State, and keep their text available to assistive technology.
10. THE Seance_Region SHALL NOT show a visible decay label; the Decay_Profile id SHALL remain only as the `data-decay-profile` attribute on the Smoke_Field.
11. THE Ledger_List SHALL show each `evidence` through the pure display function `displayEvidence(raw)`, which collapses whitespace, trims leading and trailing punctuation and symbols, removes unbalanced brackets `( ) [ ] { }` while keeping balanced pairs, keeps literal `<` and `>` characters, falls back to the whitespace-collapsed original when only punctuation remains, and wraps the result in “curly quotation marks”.
12. THE `displayEvidence` function SHALL affect display only, and the grounding rules, the Seance_Schema and the stored Seance_Result SHALL stay unchanged.

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
13. THE Transcript_Text SHALL NOT include the state heading of Requirement 5.14.

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
6. THE test suite SHALL include a fast-check property test, with at least 100 runs over generated Evidence_Packs, that every accepted Business_Item `evidence` value equals the fact text of a Fact_Line or is a substring of at least 12 characters of the README or commit text, and tests that an output citing text absent from the Evidence_Text, an `evidence` shorter than 8 characters, an `evidence` that is only a fragment of a Fact_Line, and an `evidence` that is only the repo name, owner name or `owner/repo` are each rejected.
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
33. THE test suite SHALL include Seance_Schema tests that upbeat status phrasing in `voice` or `causeOfDeath` is accepted (prompt-only rule), that completed-work language in a `detail` is rejected while "never completed" and "half-completed" pass, that a sentence containing "memory" and "faded" is rejected in `voice`, `title`, `detail` and `verdictReason` (including the exact sentence), and that in `causeOfDeath` it is accepted only when the whole value is exactly "My memory of that has faded.", together with a grounding test that this `causeOfDeath` is rejected when the README or a commit exists and accepted when both are missing.
34. THE test suite SHALL include tests that a quote of 11 characters from the README is rejected, a quote of 12 characters is accepted, an exact Fact_Line copy such as "open issues: 0" is accepted, the cache key carries `:d{decayLevel}` after the state suffix for a ghost and no decay suffix for any other state, and the prompt carries the tone for each ghost decay level.
35. THE test suite SHALL include a test that, WHEN attempt 1 fails a rule, the system prompt of the second AI_Client call ends with the feedback note listing the failed rule codes and field paths (at most 8, deduplicated), contains no text from the model's attempt 1 output, and is paired with a user message identical to the first call's; a test that an AI_Client error or timeout on attempt 1 sends the second call with no note; a test that the call count stays at most 2; and a test that each failed attempt's diagnostic entry carries `ruleCodes` and no model text.
36. THE test suite SHALL include tests that: one ungrounded Business_Item among three is dropped and the response is accepted with two items; a response whose Business_Items are all ungrounded rejects the attempt with the per-item drop reasons as feedback for attempt 2; curly-quote and backtick evidence matches its plain README source after normalization; a 4-sentence oice is trimmed to 3 sentences; and a inish verdict whose erdictReason has next-step words is still a hard reject. The test suite SHALL also check that a oice needing no repair is returned byte-for-byte unchanged and that diagnostic entries carry 
epairedCodes and the 
epaired category without model text.
