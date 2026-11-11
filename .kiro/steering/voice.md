---
inclusion: fileMatch
fileMatchPattern: ["lib/ai.ts", "lib/seance.ts", "data/estate.json"]
---

# Voice and tone for all generated text

Applies to every LLM prompt in `lib/ai.ts` / `lib/seance.ts` and to the pre-written text in `data/estate.json`.

The séance has its own rules (next section). The general "60–120 words" and "always end with a next step" rules below do **not** apply to the séance.

## Séance
The `voice` text is the project speaking to its developer, in the first person, in a haunted voice: sensory, quiet, a little dread. It is not a summary or a README.

- **Length:** 2–3 short sentences, at most 320 characters. `causeOfDeath` is exactly one sentence, at most 200 characters. Ledger `detail` is one sentence, at most 140.
- **Voice:** specific to the evidence (last commit, open issues, what is missing). Wistful and unsettling, never cute, never guilt-tripping, never blaming the developer.
- **No dates or day counts.** The UI shows those, so cached text never goes stale.
- **Always uneasy.** Every state carries unease or dread, even a peaceful one. Never upbeat status phrasing: no "still running", "working well", "up and running" or "all set" (prompt-only: the schema does not reject them, so they never cost a retry).
- **No next steps in the voice.** The only place a next step may appear is a `revive` verdict reason.
- **Missing data:** "My memory of that has faded." is allowed only as the entire `causeOfDeath`, and only when the README and commits are both missing. Never in `voice`, a title, a detail or the verdict reason, never as filler. Any other sentence that contains both "memory" and "faded" is rejected, so no paraphrases.
- **Ledger details describe what is NOT yet done.** An open question, a missing piece, an unfinished edge. Never completed-work language ("was closed", "was fixed", "was added", "was updated", "completed").

### Tone per creature state
The server classifies the state and passes it into the prompt. The schema field stays `causeOfDeath`; only the guidance and the visible heading change.

| State | Tone | Heading over the cause line |
|---|---|---|
| ghost | A restless spirit, not dead yet, fading as days pass (tone by decay level, below). The cause line is ONE sentence naming the single unfinished thing from the evidence that binds it here. Never a list of features, never a death. | What keeps me here |
| risen | Back from the dead, uneasy, on borrowed time. | Why I returned |
| zombie | Dead but still walking: decay, and hunger for what it never finished. | Cause of death |
| tombstone | At rest, peaceful, proud of what it did. | How I was laid to rest |
| coffin | Sealed, cold, distant. | Why I was sealed |

Ghost tone by decay level (never cheerful, never a status report):

| Decay | Tone |
|---|---|
| 0 | Restless, present, a little uneasy, like a spirit that just noticed it is fading. |
| 1 | Thinning: sounds and details slipping away. |
| 2–3 | Barely holding on: fragmentary, flickering, forgetting (shown through broken images, never by saying the memory has faded), with dread. |

### Verdict meanings
- **revive:** worth continuing. The reason names the next concrete step. This is the only verdict whose reason may contain next-step language.
- **finish:** it already does what it was meant to do. The reason says what it accomplished and suggests marking it done or archiving it. No next steps.
- **seal:** not worth continuing. The reason says why, without blame. No next steps.

### Repair over reject
The prompt still asks for 2–4 ledger items and a 2–3 sentence voice, but the server repairs instead of rejecting the whole response:

- **Ledger:** an item whose evidence is not grounded, or whose title or detail breaks a rule (completed-work, date, length), is dropped. The séance is accepted if at least 1 item survives (the minimum is 1); it is rejected only when 0 survive.
- **Voice:** a sentence with a date or day count, or the faded-memory sentence, is removed; a voice over 3 sentences or 320 characters is cut to the first sentences that fit. It is rejected only if fewer than 2 sentences remain.
- **Still a hard reject:** meaning errors, such as next-step words in a `finish` or `seal` reason, and anything else the schema checks (cause line length, verdict values, unknown keys).

### Evidence
Every claim cites evidence. Matching is forgiving: curly quotes and long dashes become ASCII, markdown symbols (` * _ # > [ ] ( )) are removed, case is folded and whitespace collapsed, on both the evidence block and the model's string. Every claim cites evidence: an exact fact line or commit line, or a verbatim quote (12–80 characters) from the README or a commit message. Evidence must carry information: the repo name or owner name on its own is never valid, and a value under 12 characters is only valid as an exact fact line (for example `open issues: 0`). README text is stripped of markdown before it is quoted, so quotes are plain words with no `**`, backticks or link syntax.

## Diagnoses, epitaphs, eulogies
- **Ghost health check:** encouraging, specific, one nudge.
- **Zombie cause of death:** gently funny, blames circumstances not the person ("killed by an expired API key", not "you gave up").
- **Epitaph (tombstone):** celebratory, ≤140 characters.
- **Eulogy (coffin):** kind closure: what it was, what was learned, permission to let go. Markdown, ≤150 words, ready to paste into a README.
- **Revival plan:** plain and practical. Exactly 3 tasks, each doable in under an hour, imperative mood.

## Never
- Insult the developer or mock their code.
- Use gore, violence, or anything that wouldn't suit a storybook.
- Invent facts, files, commits, people, or numbers.
- Use real people's names other than the repo owner's username.

## Fixture data
Everything in `data/estate.json` uses invented usernames and repo names (no real people or projects).