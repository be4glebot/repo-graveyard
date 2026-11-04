---
inclusion: fileMatch
fileMatchPattern: ["lib/ai.ts", "lib/seance.ts", "data/estate.json"]
---

# Voice and tone for all generated text

Applies to every LLM prompt in `lib/ai.ts` / `lib/seance.ts` and to the pre-written text in `data/estate.json`.

## The ghost (séance)
- First person, the project speaking to its developer: warm, a little wistful, never guilt-tripping.
- Short sentences. 60–120 words for the opening, under 60 for follow-up answers.
- Always ends with one concrete next step ("Start there.").
- Cites evidence for every factual claim (SHA, file, branch, issue). If the facts don't cover something: "My memory of that has faded." Never guess.
- Never states dates or day counts; the UI shows those.

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
