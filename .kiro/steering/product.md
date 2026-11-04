---
inclusion: always
---

# Product: Repo Graveyard

## What it is
A haunted night scene that shows every one of a developer's GitHub repositories as a creature, based on where the project actually stands:

- **Ghosts** are active projects. They float and glow. As a project goes quiet, its ghost visibly decays: it dims, turns translucent, gets tattered, and flickers more and more.
- **Zombies** are unfinished projects that went quiet for 3+ months. They shamble around outside the cemetery fence, and the longer they've been abandoned, the more decayed they look.
- **Tombstones** are finished, shipped projects. They sit inside the fenced cemetery, honored and at peace.
- **Chained coffins** are projects scrapped on purpose. They sit sealed in a separate crypt plot at the cemetery's edge and won't come back to haunt you.

A zombie means **undecided**. The goal of the app is to give developers **direction**: get every zombie out of limbo by either **reviving** it (back to a ghost) or **sealing** it (into a chained coffin). Finishing a project turns it into a tombstone. Sealing is framed as a relief, not a failure: you officially let it go and stop feeling guilty about it.

## The problem
Most developers have a pile of half-finished side projects. Some they've forgotten exist; for the rest they have no direction: they don't know what's broken, how much is left, or whether it's even worth finishing. And the hardest part of coming back isn't the code, it's **forgetting where you left off**: what you were in the middle of, what was broken, which branch had the real work. So the projects sit there, and the developer feels vaguely guilty about all of them.

## Who it's for
- Students and hobbyists with many side projects
- Developers cleaning up their GitHub profile
- Anyone who wants a nudge and a plan to finish one thing

## Lifecycle rules
"Days quiet" = days since the repo's last push, computed against today.

| State | Decay levels (defaults) |
|---|---|
| Ghost | 0 healthy (<14 days quiet), 1 fading (14–30), 2 flickering (30–60), 3 about to turn (60–90) |
| Risen | a zombie the user chose to revive but hasn't pushed to yet (see below) |
| Zombie | 0 fresh (90 days–6 months quiet), 1 rotting (6–12 months), 2 decayed (1–2 years), 3 skeletal (2–3 years), 4 ancient (3+ years) |
| Tombstone | no decay level; moss grows with days quiet (cosmetic) |
| Chained coffin | no decay level |

### Precedence (first rule that matches wins)
1. **User override** `finished` → Tombstone; `scrapped` → Coffin.
2. **User override** `revived`: if fewer than 14 days since reviving and no push since → **Risen**. Otherwise (a push happened after reviving, or 14+ days passed without one) the override clears itself and classification continues with rule 3 as if there were no override.
3. **Archived on GitHub** → Tombstone if it has finished signals, else Coffin.
4. **Pushed within the last 90 days** → Ghost. (Activity beats a "finished" guess: a maintained, finished project that's still being pushed to is alive.)
5. **Finished guess** (see signals) → Tombstone.
6. Otherwise → Zombie.

Overrides: `finished`, `scrapped`, `revived`, or none. "Mark as unfinished" just removes the override and lets the rules decide. Users can set any override on any repo (including ghosts, e.g. "this is done, stop nagging me").

### Signals
- Forks are excluded. Organizations work too (same rules).
- **Finished signals** (computed from the single bulk query, no extra calls): has at least one release; has a homepage/live URL; README larger than a stub (~1 KB); last commit subject sounds final ("v1.0", "release", "final", "done", "ship"); is popular (stars at or above the "popular" threshold, default 50 — a widely-starred shipped project like `resque` or `unicorn` reads as finished even without a GitHub Release). ("Few open issues" is deliberately NOT a signal: almost every solo side project has zero issues, finished or not.)
- **Unfinished signals:** last commit subject contains "wip", "todo", "temp", "fix later"; an explicitly empty README (0 bytes) — a README we simply could not find is neutral, not a strike, because older repos often use `README.rdoc`, `README.markdown`, `README.mkd`, etc., which the two bulk-query lookups (`README.md`/`readme.md`) don't see, and we won't add more lookups (they timed the query out); open issues ≥ the "many issues" threshold, but only for non-popular repos (stars below the "popular" threshold) — a popular project accumulates open issues precisely because people use it, so its backlog is not treated as a sign of abandonment.
- **Rule:** finished iff (finished signals − unfinished signals) ≥ 2.
- **Days quiet** = whole days between last push and now, floored, never negative. Missing push date → use the created date.
- **Scrapped** is about intent, so the only automatic guess is rule 3 (archived with no finished signals).
- **The user always has the final say.** Overrides are set by dragging a creature into a zone (cemetery, crypt) or from a keyboard-accessible menu, and stored in the browser (localStorage, keyed by username), wrapped in try/catch. They're per device and per viewer; that's fine for the MVP.

### Risen (the revive flow, in a read-only app)
Reviving can't change GitHub, so it's a promise. A risen zombie stands up, glows faintly, and walks toward the sky band, with a countdown: "Risen. Push within 14 days or it falls back." The first push turns it into a full ghost. This is what "Summon me in 7 days" reminds you about.

## Core experience (MVP — read-only)
0. **The Haunted Estate (sample graveyard)** at `/estate`: the landing page offers "Tour the estate" next to the username box. It loads a built-in sample graveyard (bundled fixture data, clearly labeled as a sample) that shows every state and decay level, so judges and first-time visitors see the full experience even if their own GitHub is small.
   - Fixture dates are stored as **"days ago" offsets**, not fixed dates, so the estate looks the same on Dec 4 and on Jan 29 when judges test it.
   - Séances, diagnoses and plans in the estate are pre-written in the fixture (no LLM calls). Follow-up questions offer 3 pre-written answers.
   - Overrides made in the estate last only for the visit (not saved).
   - All estate usernames, repo names and commit messages are **invented** (no real people or projects).
1. **Enter a username**: no login, public repos only.
2. **The scene**: ghosts float above, the cemetery holds tombstones, coffins lie sealed in the crypt, zombies roam outside the fence. A summary line: "3 ghosts, 7 zombies, 4 at rest, 2 sealed."
   - **Turning soon**: if any ghost is within 30 days of becoming a zombie, a candlelit notice names it with a countdown: "api-server turns in 9 days." This is the prevention moment ("I need to get work done before it becomes a zombie"), so it's prominent.
3. **Sort**: on first visit, a quick prompt invites the user to confirm or correct the guesses.
4. **Inspect a creature**: click it to see facts (last push, last commit message, open issues, language, outdated dependencies) and an AI-written diagnosis:
   - Ghost → health check and a nudge ("last pushed 41 days ago, you were halfway through auth")
   - Zombie → cause of death, verdict (**Revive** or **Seal**) with a reason
   - Tombstone → a celebratory epitaph
   - Coffin → the eulogy
5. **The heartbeat**: every detail panel shows the repo's pulse, a 52-week EKG line drawn from weekly commit counts. Active projects beat; zombies flatline. It's the single clearest picture of a project's life.
6. **The séance** (ghosts and zombies): "Summon the ghost" and the project's ghost tells you, in first person, where you left off, using only real data:
   > "You left me 41 days ago, in the middle of the login page. Your last three commits fixed the redirect; your final message was 'wip: oauth callback still broken'. There's a TODO in auth.ts and an unmerged branch, feature/settings, three commits ahead. Start there."
   - Sources: last ~10 commits (messages, dates, files changed), the last commit's changed files scanned for TODO/FIXME, branches ahead of the default branch, open issues and PRs, the README.
   - The user can ask up to 3 follow-up questions ("what was feature/settings for?"). Answers stay grounded in the same data; if the data doesn't say, the ghost says it doesn't remember.
   - Every claim links to its evidence (commit, file, branch, issue).
7. **Direction** for zombies:
   - Revive → a revival plan of exactly 3 small first tasks (the first comes from the séance's "where you left off" when available), plus which dependencies to upgrade, in order. Copy button. The zombie becomes **Risen**.
   - Seal → a eulogy README section (what it was, what was learned). Copy button. The repo moves to the crypt.
   - Users can also mark a zombie **finished** ("it was actually done") → tombstone with an epitaph.
8. **Summon me later**: after reviving, "Summon me in 7 days" downloads a calendar reminder (.ics) linking back to the repo's page. Accountability with no accounts or servers.

## Should-have (week 4, if the MVP is solid)
- **The Coroner's Ledger**: a graveyard-wide report of your patterns, from data the app already has: median project lifespan (created → last push), how many weeks in most projects go quiet, which languages your zombies are in, revive vs seal counts, and a one-line pattern drawn only from those numbers (e.g. "most of your projects go quiet within 3 weeks of being created"). Presented as an old ledger page.

## Stretch features (only after the MVP is deployed and polished)
In priority order:
1. **Haunted badges**: public SVG endpoints for a repo badge (`/badge/[user]/[repo].svg`, "flickering, 41 days") and a profile card (`/card/[user].svg`, a mini graveyard for a profile README). Read-only and cheap; GitHub profile widgets are hugely popular, and every embed is free distribution.
2. **Share image**: a dynamic Open Graph image of each user's graveyard, so a shared link unfurls as a picture of the scene (helps the Social Blitz prize).
3. Sign in with GitHub (GitHub App, user picks repos) for private repos; overrides saved server-side
4. "Create these 3 issues" button for revival plans
5. "Seal" button that commits the eulogy to the README and archives the repo
6. Tiny browser extension that adds ghost/zombie/tombstone badges next to repos on github.com

Every write action must show a preview of exactly what will change and require an explicit click. Nothing is ever changed automatically.

## Principles
- **Useful first, spooky second.** The theme makes it fun; the direction (revive or seal) makes it valuable.
- **Kind, not mean.** Epitaphs and diagnoses are playful, never insulting.
- **Honest about data.** Facts come from APIs. The AI interprets and writes prose; it never invents facts.
- **The user knows best.** Classification is a suggestion; the user can always override it.
- **Zero friction for judges.** Works for any public username with no login, and the Haunted Estate shows everything in one click.
- **Design is the product.** We're entering the Costume Contest: the experience must feel finished, intentional and beautiful on every screen, including empty, loading and error states.
