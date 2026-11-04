# Repo Graveyard — Kiroween 2026 Plan

**Category:** Costume Contest (+ Best Student Project, Bonus Blog, Social Blitz)
**Deadline:** Fri Dec 4, 2026, 2:00 PM Pacific (4:00 PM Central). No extensions, no edits after. Aim to submit by **Wed Dec 2**.
**Free Kiro credits:** 4,000 per person. Create your Kiro account first, then request via the Credit Request Form on the Resources tab by **Tue Dec 1, 12:00 PM Pacific**. Allow 48 business hours. Redeem by Dec 4; credits expire Dec 31. **Request this weekend.**

---

## 0. The concept in one breath

Enter a GitHub username and see every repo as a creature in a moonlit scene. **Ghosts** are active projects; they decay and flicker as you neglect them. After 3 months a ghost becomes a **zombie**: undecided, roaming outside the cemetery fence. **Tombstones** are finished projects, honored inside. **Chained coffins** are projects you scrapped on purpose, sealed in the crypt. Click any creature to see its heartbeat and facts, then **hold a séance**: the project's ghost tells you exactly where you left off, from your own commits, branches and TODOs. Then give every zombie a direction: **Revive** it with a 3-task plan, or **Seal** it with a eulogy.

| State | Rule |
|---|---|
| Ghost: healthy | pushed in the last 14 days |
| Ghost: fading | 14–30 days |
| Ghost: flickering | 30–60 days |
| Ghost: about to turn | 60–90 days |
| Risen | a zombie you chose to revive; push within 14 days or it falls back |
| Zombie | 90+ days, not finished, not scrapped |
| Tombstone | finished |
| Chained coffin | scrapped on purpose |

The app guesses; the user always has the final say.

### How we stand out (important)
Simple "graveyard of your abandoned repos" apps already exist outside Kiroween (e.g. a DEV challenge entry with AI epitaphs and a rekindle button), and last year's Kiroween had **Seance Stock** (find other people's abandoned repos to revive) and **The Digital Exorcist** (files as ghosts/zombies). Judges may have seen the metaphor. Our edge, which the pitch must hammer:
1. **The whole lifecycle, not just the dead.** Ghosts decaying in real time is about *prevention*: catch a project before it dies.
2. **A decision, not a eulogy.** Every zombie ends revived or sealed. Sealing as relief is a fresh angle.
3. **Every effect encodes data** (see design.md). Design that's functional, not just spooky.
4. **The séance.** None of the existing graveyards help with the real pain of returning: remembering where you left off. Every claim links to evidence.
5. **Grounded diagnosis.** Plans are based on real dependency and commit facts, verified by property tests, not just funny AI text.
6. **Haunted badges** (stretch #1) that keep the ghost in front of you on GitHub itself.

Pitch stats worth citing: in a HackerNoon reader poll, 25% said they've started dozens of side projects and finished zero; developers on Reddit describe rebuilding context as "like 50% of programming." Several 2026 Product Hunt launches (Xeyria, StateCarry) target exactly the "where was I?" problem, which shows it's real; none of them do it for your whole GitHub at a glance.

---

## 1. Setup (do this first)

1. Register on Devpost if you haven't. Request Kiro credits.
2. Install the Kiro IDE and sign in.
3. Create a public GitHub repo (e.g. `repo-graveyard`) with an **MIT license** (pick it when creating the repo so it shows in the About section).
4. Clone it and open the folder in Kiro.
5. Copy the `.kiro/steering/` folder from this kit into the repo root. It has 7 files: `product`, `tech`, `structure` (always loaded), `design` (loads for UI files), `voice` (loads for AI prompt files), and `design-review` + `a11y-review` (manual: run them as `/design-review` and `/a11y-review` in chat). Read them and edit anything you disagree with; they're yours now.
6. Check `.gitignore`: `.kiro` must **not** be listed.
7. Get a GitHub personal access token (fine-grained, public repositories read-only, **expiry after Feb 2027** so it outlives judging), an LLM API key (see Open decisions), and a free Upstash Redis database (via the Vercel Marketplace). Put them in `.env.local`, which **should** be gitignored, and add the same values in Vercel's project settings.

### Open decisions (settle before Spec 3)
- **LLM provider.** Pick one you can pay for with a hard spending cap: e.g. Anthropic (a small Claude model) or Amazon Bedrock (AWS is the sponsor, a nice touch in the write-up). The code only talks to `lib/llm.ts`, so switching later is easy.
- **Disclosure.** Planning and the first drafts of the steering docs were done with Claude outside Kiro. That's fine, but say so in one line of the write-up; honesty reads well and the rules ask you to disclose prior work.

---

## 2. Scope

**MVP (read-only, this is the submission):**
- Landing page: enter a GitHub username, or **tour the Haunted Estate** (sample graveyard)
- The scene: ghosts (4 decay levels), zombies (decay by time abandoned), tombstones, coffins in the crypt, moon and fog reflecting overall health
- Guesses + user overrides (stored in the browser)
- Detail panel: **heartbeat EKG**, facts, outdated dependencies, AI diagnosis
- **The séance**: where you left off, with evidence links and up to 3 follow-up questions
- Zombies: Revive or Seal verdict → revival plan (first task from the séance) or eulogy, with copy buttons
- **Summon me later** (.ics reminder) after reviving
- **Revive in Kiro**: a downloadable `.kiro/specs/revive-<repo>/` spec (requirements, design, tasks) plus a steering file, built from the séance facts and revival plan, so you open the old repo in Kiro and start at task 1
- **Haunt your README**: SVG repo badge + profile card, and an Open Graph share card
- **graveyard-mcp**: an MCP server so Kiro (or any MCP client) can ask "which of my projects are about to die?"
- Graveyards-opened counter on the landing page
- Designed empty, loading and error states
- "Lights on" table view
- Caching so judges' clicks don't re-run the LLM
- Deployed on Vercel, works for any public username

**Should-have (week 4):** The Coroner's Ledger (your personal death patterns).

**Stretch (only once MVP is deployed and looks great), in order:**
1. Private repos (opt-in, needs repository access)
2. "Create these 3 issues" button on revival plans
3. "Seal" button: commit eulogy to README + archive repo
4. Browser extension adding badges on github.com

**Ideas considered and cut** (out of scope or off-message): email/push reminders (need accounts and a server), leaderboards (shaming), AI auto-fixing code (write access + risk), a 3D WebGL scene (time sink; 2D parallax looks just as good if crafted).

**Go/no-go for stretch:** if the MVP is deployed, polished and bug-free by **Sun Nov 22**, start stretch. If not, polish instead.

---

## 3. Five-week timeline

| Week | Dates | Goal |
|---|---|---|
| 1 | Oct 31 – Nov 6 | Setup, credits, steering. **Spec 1 (lifecycle)**: fetch repos, classify, plain list UI. Deploy to Vercel. In parallel: a moodboard and **one finished ghost** at all 4 decay levels, to lock the art style early. |
| 2 | Nov 4 – Nov 13 | Generate the art (docs/ART_PROMPTS.md). **Spec 2 (scene + estate)**: the scene, all creatures, overrides, lights-on table, Haunted Estate fixture, every state board on the canvas. Nov 11: Devpost Build Session (10 AM PT). |
| 3 | Nov 14 – Nov 20 | **Spec 3 (detail panel)** and **Spec 4 (séance)**. **Spec 6 (Revive in Kiro)** right after, since it reuses both. MVP feature complete. |
| 4 | Nov 21 – Nov 27 | **Spec 7 (badges + share card + counter)**, **Spec 10 (owner mode)**, **Spec 8 (graveyard-mcp)**, **Spec 9 (sound)**. Signature animations, mobile, accessibility, design QA loop. **User testing** with 5–10 classmates. Spec 5 (ledger) only if on track. Thanksgiving week. |
| 5 | Nov 28 – Dec 2 | Bug fixes, demo video, finish KIRO_JOURNEY.md → Kiro write-up, Devpost text, blog + social post. Submit by Dec 3. |

**Credit checkpoint:** after Spec 1, check kiro.dev/account/usage. If Spec 1 used ≤400 credits you're on track for 4,000. Stay on the Auto model.

Design gets the most time on purpose: we're in the Costume Contest. If something has to give, cut features before cutting polish.

Deploy in week 1 and keep it deployed.

---

## 4. Use the full range of Kiro (this is 20% of the score)

The rules list these write-up topics. Plan to have something real to say about each, and keep notes as you go (screenshots, what surprised you).

| Kiro feature | What we'll do |
|---|---|
| **Strategy (say this explicitly)** | Spec-driven for anything that must be correct (lifecycle, séance grounding, Kiro export) with property tests; vibe coding for visuals and animation; steering as the design system and product memory; hooks as automatic guardrails; custom agents as reviewers; MCP for live data and for our own tool. Keep the reasoning and results in **docs/KIRO_JOURNEY.md** as you go. |
| **Specs** | Nine Feature Specs (they live in `.kiro/specs/<name>/`). After each requirements phase, run Kiro's **Analyze Requirements** to catch gaps before design. Kiro extracts property-based tests from the requirements, which matches our PBT list. Keep specs updated as features change (last year's 3rd place called this out). |
| **Vibe coding** | Use it for creative iteration on the creatures and animations, and compare it with spec-driven work in the write-up. |
| **Steering** | Three inclusion modes in use: always (product, tech, structure), fileMatch (design for UI files, voice for AI prompts), manual slash commands (/design-review, /a11y-review). Explain why you split them this way. |
| **Hooks** | (The IDE can't create manual hooks; on-demand checks are the manual steering files above.) Three targeted hooks: **Post Task Execution** → shell command `npm test -- --run` (a command action, no AI prompt) so every spec task is verified; **File Create** on `app/api/**/route.ts` → agent checks rate limiting, `server-only` and no leaked secrets; **File Create** on `components/creatures/*.tsx` → agent updates types, the lifecycle tests, the estate fixture and docs for the new creature (last year's 1st place had hooks like this). Agent-prompt hooks cost credits each time they fire; watch the usage meter. |
| **Building for Kiro** | The app's headline feature *produces Kiro specs* (Revive in Kiro), and we ship **graveyard-mcp**, our own MCP server that Kiro uses while we build. Dogfood both: revive one of your own zombie repos with the export and finish it in Kiro, and log it in the journal. This is the strongest "deep understanding of Kiro" story we have. |
| **MCP** | Our own graveyard-mcp (above), plus a GitHub MCP server to inspect real repos while building; a docs MCP (e.g. Context7) for current Next.js / Framer Motion APIs (last year's 1st place used it to stop hallucinated APIs); a **Playwright MCP** for the design QA loop: Kiro screenshots each screen and critiques it against design.md. That loop is a strong, design-specific story for the write-up. |
| **Property-based testing** | Lifecycle, decay monotonicity, overrides, semver. Note any bug PBT caught that unit tests missed. |
| **Custom agents** | Ask Kiro to create `.kiro/agents/design-critic.md` (read-only tools + Playwright MCP, instructions from design.md), `.kiro/agents/voice-editor.md` (reviews generated text against voice.md) and `.kiro/agents/graveyard-keeper.md` (uses graveyard-mcp to tell you which project to work on next and hands you its revive spec). Switch to them for reviews. |
| **Experiments (log every one)** | 1) Build one small feature twice, by spec and by vibe, and compare time, credits and bugs. 2) Command hook vs agent hook: credits per run vs what each caught. 3) Autopilot vs Supervised on the same kind of task. 4) Auto model vs a stronger model for a spec's design phase. 5) Kiro CLI once (WSL if needed). 6) Does steering change output? Run one prompt with design.md included and once without, screenshot both. |
| **Kiro powers** | The **Figma power** fits the design track: sketch the key screens in Figma (free for students), then have Kiro implement from them. Browse kiro.dev/powers for anything else useful (e.g. a Redis/Upstash or testing power if one exists). |
| **IDE vs CLI** | Do most work in the IDE. Optional: try the Kiro CLI once (on Windows it may need WSL; check the install page) so you can compare in the write-up. Skip if it's a hassle. |

Judging may include automated AI analysis of your repo, so keep `.kiro/` tidy and the README clear.

---

## 5. Prompts to give Kiro (spec mode)

Let Kiro generate the specs. Review and edit each phase (requirements → design → tasks) before moving on.

**Spec 1 — Lifecycle**
> Create a spec for repo lifecycle classification, following the Lifecycle rules, Precedence and Signals sections of product.md exactly. Given a GitHub username or organization, load their public, non-fork repositories server-side with one GraphQL query per 100 repos (cap 300, most recently pushed first), fetching every field classification needs as listed in tech.md. Classify each repo into exactly one state (ghost, risen, zombie, tombstone, coffin) with its decay level, using pure functions in lib/lifecycle.ts and lib/finished.ts that take "now" as a parameter, with all thresholds in one config object. Overrides (finished, scrapped, revived + timestamp) come from localStorage via lib/overrides.ts. Cache the graveyard list in Redis for 10 minutes. Write fast-check property tests for every lifecycle property in tech.md. For now render a plain grouped list at /g/[username] with a minimal landing page at / . Handle unknown usernames, users with no repos, and GitHub rate limits.

**Spec 2 — The haunted scene**
> Create a spec for the haunted scene at /g/[username], following design.md closely. Layered parallax night scene: ghosts in the sky band decaying visually by level, risen climbing toward the sky with a countdown, tombstones inside the cemetery fence, chained coffins in a crypt plot at the edge, zombies outside the fence (decaying with time abandoned). Moon brightness reflects the share of ghosts vs zombies; fog density reflects zombie count. A summary line ("3 ghosts, 7 zombies, 4 at rest, 2 sealed") and the Turning soon notice. First-visit prompt to confirm or correct guesses; users set overrides by dragging a creature into a zone or from a keyboard-accessible menu. /g/[username]/[repo] opens the scene with that creature selected. Every creature is a focusable button with an accessible name and reacts on hover/focus. The lights-out opening (plain list → flicker → candles → moonrise → creatures; skippable, reverses on Lights on) doubles as the loading state. Add the atmosphere layers (tree, bats, lightning by ancient-zombie count, vignette, grain). Match the boards on the "Repo Graveyard — Scene Design" canvas. Sound comes in a later spec; leave hook points for it. A "lights on" toggle shows the same data as a sortable table. Respect prefers-reduced-motion. Works with 1 repo and 100+ repos (cap per zone, collapse extras into groups). Mobile layout stacks the zones vertically. Include the Haunted Estate at /estate: a sample graveyard loaded from data/estate.json (dates stored as "days ago" offsets, no API calls, overrides not persisted), labeled with a plaque, covering every state and decay level, with pre-written diagnoses and séances for the panels built later. Design every empty, loading and error state listed in design.md.

**Spec 3 — Detail panel**
> Create a spec for the creature detail panel. At the top, a heartbeat: an EKG line from GET /repos/{owner}/{repo}/stats/participation (52 weekly owner commit counts), drawn on when the panel opens; handle 202 responses with retry/backoff and a waiting state. Then facts from APIs: last push, last commit message, open issues, language, and a dependency table comparing package.json or requirements.txt versions against npm or PyPI. Then call the LLM with those facts (it must not invent facts) for a state-specific diagnosis: ghosts get a health check and nudge; zombies get a cause of death and a Revive or Seal verdict with a reason (rules in lib/verdict.ts plus LLM judgment); tombstones get a celebratory epitaph; coffins show their eulogy. Revive produces a plan of exactly 3 small first tasks (the first comes from the séance's "where you left off" when available), plus dependency upgrades in order, and sets a revived override so the zombie becomes Risen; after reviving, offer "Summon me in 7 days", which downloads an .ics reminder built in lib/ics.ts. Seal produces a eulogy README section and moves the repo to the crypt (stored as an override). Copy buttons. Revive and seal signature animations per design.md. LLM calls go through lib/llm.ts with per-IP and daily limits from lib/ratelimit.ts; prose never hard-codes day counts. Validate LLM output with zod (retry once, then a plain fallback); cache in Redis per repo + last push + output type for 24 hours. Property tests: semver comparison, .ics round-trips for any date and time zone.

**Spec 4 — The séance**
> Create a spec for the séance. For ghosts and zombies, "Summon the ghost" gathers facts server-side in lib/seance.ts: last 10 commits (message, date, SHA, changed files), TODO/FIXME lines in the last commit's changed files only (cap count and size), branches ahead of the default branch (via compare), open issues and PRs, and the README. The LLM speaks as the project's ghost in first person and explains where the user left off and what to do first, citing evidence by SHA, file path, branch or issue number. A pure validator rejects any answer citing evidence not present in the facts; on rejection, retry once, then fall back to a plain facts summary. The user may ask up to 3 follow-up questions, answered from the same facts; if the facts don't cover it, the ghost says it doesn't remember. UI per design.md's séance section: dim scene, ghost drifts to center, typewriter text (skippable), evidence chips linking to GitHub, suggested-question chips, reduced-motion fallback. Enforce the follow-up limit and rate limits server-side. Cache the opening séance per repo + last push. Property test: the validator never accepts an answer citing evidence outside the input facts.

**Spec 6 — Revive in Kiro**
> Create a spec for "Revive in Kiro", following product.md item 9. Add a pure function in lib/kiroExport.ts that takes the séance facts, the revival plan, the repo metadata and "now", and returns a map of file paths to markdown: .kiro/specs/revive-<repo>/requirements.md (one EARS requirement per piece of unfinished business: the wip commit, each TODO/FIXME, each unmerged branch, each open issue, max 8, each with an Evidence line), design.md (current state, dependency upgrade order, which branch to merge first) and tasks.md (Kiro checkbox task format, revival-plan tasks first, then dependency upgrades, then merges, each referencing a requirement and its evidence), plus .kiro/steering/revival.md with inclusion: always. No LLM call: reuse the cached revival plan. Add a ReviveInKiro modal in the detail panel (after Revive on zombies; "Resume in Kiro" on ghosts) with a file tree, file preview, per-file Copy buttons, a Download .zip built in the browser, and 3 numbered instructions, matching the "Revive in Kiro" board on the design canvas. Add GET /api/export?owner=&repo= returning the same file map as JSON. Add a pre-built export for one estate zombie. Write fast-check property tests from tech.md: paths stay under .kiro/ with slugged repo names, tasks numbered 1..n in valid checkbox format, every Evidence reference exists in the input facts, output deterministic.

**Spec 7 — Haunt your README + share card**
> Create a spec for public badges and sharing, following product.md items 10–12 and the badge rules in tech.md. A pure lib/badge.ts renders a vector-only SVG badge for a repo (mini creature icon, state, decay word, days quiet) and a profile card for a user (a tiny graveyard strip with counts); route handlers at /badge/[user]/[repo] and /card/[user] with the caching headers in tech.md and a graceful "unknown grave" badge for missing repos. In the detail panel add "Haunt your README" with a preview and a copy button for the Markdown snippet (badge links back to /g/[user]/[repo]). Add an Open Graph image for /g/[username] with next/og showing the user's counts over a dark scene. Add a graveyards-opened counter (one Redis INCR per new graveyard load, no usernames stored) shown on the landing page. Match the "Badges + share card" board on the canvas. Property tests: SVG well-formed and escaped for any name, under 10 KB.

**Spec 8 — graveyard-mcp**
> Create a spec for graveyard-mcp, a stdio MCP server in mcp/ using the official MCP TypeScript SDK, following the graveyard-mcp sections of product.md and tech.md. Tools: list_graveyard(username), turning_soon(username, withinDays=30), seance_facts(owner, repo), revive_spec(owner, repo). It calls the deployed app's public JSON API at GRAVEYARD_URL (add GET /api/turning?u=&within= to the app) and never holds secrets. Validate inputs and outputs with zod and return clear tool errors for unknown users and rate limits. Add mcp/README.md with setup for Kiro and other clients, register it in .kiro/settings/mcp.json for this workspace, and create .kiro/agents/graveyard-keeper.md that uses these tools to recommend the next project to work on and offer its revive spec. Unit-test each tool against a mocked API.

**Spec 10 — Owner mode (Sign in with GitHub)**
> Create a spec for owner mode, following product.md item 11 and the Auth section of tech.md. Add optional Sign in with GitHub via Auth.js v5 with scope read:user only. On a signed-in user's own graveyard (matched by GitHub numeric id), each creature's menu gains Mark finished, Seal it away, Revive and Undo, and creatures can be dragged between zones with a keyboard-accessible alternative; changes play the Rest/Seal/Revive moments from the Verdicts board. Persist overrides in Redis keyed by GitHub user id via an owner-only, CSRF-protected, rate-limited route; merge server overrides over localStorage and offer to migrate local overrides on first sign-in. Invalidate the user's graveyard, badge and profile-card caches on write. Show a "Tended by its owner" seal in the header and a "Sign in to make this permanent" prompt when logged out. Visitors and the Haunted Estate never see edit controls or require login. Match the Owner mode board on the design canvas. Property tests: owner check, override round-trip, merge precedence.

**Spec 9 — Sound**
> Create a spec for sound, following the Sound section of design.md: an opt-in choice on the landing page, a single client-only audio manager in lib/audio.ts (Web Audio, synth sounds plus CC0 samples from public/sounds with CREDITS.md), mute toggle that persists, de-duplication and volume ducking, and the full event-to-sound map including the lights-out opening timings. Audio loads lazily only after sound is enabled. Respect reduced motion by skipping the opening's sound cues that accompany skipped animations.

**Spec 5 — The Coroner's Ledger (should-have, only if on track)**
> Create a spec for the Coroner's Ledger: a graveyard-wide report computed in lib/ledger.ts from data already loaded: median project lifespan (first to last push), the week of life most projects go quiet, languages of current zombies, counts by state, revive vs seal decisions (from overrides), plus one LLM-written sentence describing the user's pattern, grounded in those numbers. Present it as an old ledger page per design.md. Property tests: stats stay within input ranges and never produce NaN, including for an empty list.

---

## 6. Rules compliance (checked against the official rules on Nov 2, 2026)

| Rule | How the plan complies |
|---|---|
| Built with Kiro; insufficient use = disqualification | All specs, hooks, steering, agents and the build itself happen in Kiro. Don't use the Claude Code extension inside Kiro for this project. |
| New project, created after Oct 30, 9 AM PT; disclose pre-existing work | Fresh repo. Disclose in the write-up that planning and first-draft steering docs were done in a Claude chat. Frameworks/libraries are allowed. |
| Third-party APIs/SDKs used per their terms | GitHub API (read-only, cached), npm/PyPI public APIs, one LLM provider, Upstash, Vercel. All used normally within their terms. |
| Working URL, testable **free and without restriction until Jan 29, 2027** | Public, no login. Rate limits only stop abuse and are set high; the Haunted Estate always works. Token, keys and hosting kept alive and funded through Feb 2027. |
| Public GitHub repo with all source, assets, setup instructions | README covers env vars, `npm install`, `npm run dev`, tests and architecture. |
| OSI license visible at the top of the repo page | MIT, chosen at repo creation. |
| `/.kiro` at repo root, not in `.gitignore` | Specs, hooks, steering, agents all inside it. Check `.gitignore` before submitting. |
| Text description + Kiro write-up | Covered in section 8 below. |
| Video < 3 min, public YouTube, shows it running on its intended device, no third-party trademarks or unlicensed music | Desktop browser (plus a quick mobile shot). No GitHub logo. Only your own account and the invented Haunted Estate on screen. Self-made or CC0 audio. |
| Original work, no IP infringement | Original art, OFL fonts, CC0 audio, invented fixture data. |
| No changes after the deadline | Tag the submitted commit (`kiroween-submission`). Until judging ends Jan 29: don't push to the default branch or redeploy production. Keep any new work on another branch/preview. (The rules don't say whether later commits count as changes, so stay safe.) |
| Student prize: all team members students; LinkedIn, student email, year, degree, school; proof on request | Solo entry; have your TAMU email and proof of enrollment ready. |
| Blog prize: public post on a third-party platform during the submission period that **mentions it's written as part of the Kiroween 2026 hackathon** | Include that exact sentence; publish on dev.to or similar before Dec 4, 2 PM PT. |
| Social Blitz: post **starts with #KiroweenHackathon26**, shares your favorite thing about Kiro and how it changed your development approach | Write it yourself; the rules mention AI-writing detection for this prize. |
| Credits: request by Dec 1 noon PT with correct Kiro user ID; redeem by Dec 4; expire Dec 31 | Request now. |

## 6b. Proving impact (start THIS week, finish in week 4)
- **This week, on the plain-list version you already have:** show 5 people their own repo list and ask "What would you do with this?" and "Would you use it before recruiting season?" Write down their exact words. If "clean up my profile" comes up, lead the pitch with it.
- In week 4, ask 5–10 classmates (TAMU Discord, class group chats) to open their own graveyard. Record: number of zombies, number turning soon, whether they clicked Revive in Kiro, and one sentence each about how it felt. Get permission to quote them by first name.
- Read the graveyards-opened counter on submission day and put the number in the write-up.
- Revive one of your own zombie repos with the export and push to it. Before/after badge screenshots make a great video beat.

## 7. Submission checklist (from the official rules)

**Repo**
- [ ] Public **GitHub** repo (not GitLab/Bitbucket) with all code, assets and setup instructions
- [ ] Open-source license, visible in the About section
- [ ] `/.kiro` at repo root with specs, hooks and steering; **not** in `.gitignore`
- [ ] Disclose any pre-existing code or work (frameworks and starter templates are fine)

**App**
- [ ] Working URL; free for judges to use until **Jan 29, 2027**. Keep Vercel, the GitHub token and LLM key alive and funded until then. Set a spending cap.
- [ ] Tested with several usernames (few repos, many repos, none, unknown)

**Video**
- [ ] Under 3 minutes, public on YouTube, shows the app running on its target device (browser)
- [ ] No third-party trademarks (no GitHub logo/Octocat on screen) and no copyrighted music

**Devpost form**
- [ ] Category: Costume Contest
- [ ] Text description of features
- [ ] Kiro write-up covering the topics in section 4
- [ ] Best Student Project: LinkedIn, student email, year, degree, school (proof of enrollment may be requested). Prize: $1,500 + 1-year Kiro Pro Max.
- [ ] Bonus Blog: public post on a third-party platform (e.g. dev.to) about Kiro and the project, mentioning Kiroween 2026, published before the deadline. Link it.
- [ ] Social Blitz: public post that **starts with #KiroweenHackathon26**, sharing your favorite Kiro feature and how it changed your approach. Link it.
- [ ] Everything in English
- [ ] Submit early; you can save drafts, but nothing can change after the deadline
- [ ] Tag the submitted commit `kiroween-submission`; freeze the default branch and production deploy until Jan 29, 2027
- [ ] GitHub token, LLM key, Upstash and Vercel all valid and funded through Feb 2027

---

## 8. Write-up and description
- **Devpost description:** lead with the recruiting-season cleanup ("your GitHub is your résumé, and it's full of zombies"), then "where was I?", who it's for, the four creatures, séance, revive/seal, the design rule (every effect encodes data), tech stack, links.
- **Kiro write-up:** built from docs/KIRO_JOURNEY.md: the strategy paragraph, then one short section per row of the table in section 4 with a screenshot or snippet each, the experiments and their results, the bugs property tests caught, credits used, and the disclosures (planning with Claude, art generated with ChatGPT image generation).

## 9. Demo video outline (under 3 min)

Lesson from SpookBnB's video (transcript reviewed): it opened with a one-line "what if" hook, spent ~1:40 on how Kiro built it (specs, vibe coding, hooks) and only ~50 s on the actual demo, with narration over music. Judges score both Presentation and Kiro use, so keep their structure but give the demo more time and let the lights-out moment play uninterrupted with sound on.

Best Demo ($1,000) goes to the top Presentation score among the top 10% overall, so the video matters twice. Judges want: works end to end, explains problem + audience + why it matters, easy to follow, memorable.

1. **0:00–0:15** Hook: "I have 23 repos on GitHub. I've finished 4. I forgot about 9."
2. **0:15–0:50** "Enter with sound" → enter your username → the plain list flickers, the lights die, candles light, the moon rises → the scene. Point out a flickering ghost ("41 days, about to turn") and the zombie horde.
3. **0:50–1:35** Click a zombie → heartbeat flatlines → **séance**: the ghost tells you where you left off, evidence chips and all → **Revive** → zombie rises → **Revive in Kiro** → open the old repo in Kiro, the spec is there, start task 1.
4. **1:35–1:50** Another zombie → **Seal** → chains wrap the coffin → eulogy. "Letting go is a decision too."
5. **1:50–2:05** The badge in a README updating after a push; a classmate quote or the graveyards-opened number.
6. **2:05–2:45** Built with Kiro: the strategy in one sentence, a spec, a hook firing, a property test catching a séance citing a fake commit, the design-critic loop, and Kiro asking graveyard-mcp "what's about to die?"
7. **2:45–2:58** Close: "Every project deserves a resurrection or a proper burial." Captions on throughout.
