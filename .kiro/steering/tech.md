---
inclusion: always
---

# Tech Stack and Conventions

## Stack
- **Framework**: Next.js 16 (App Router, Turbopack, **Cache Components enabled**) with TypeScript in strict mode. Use Next 16 APIs and conventions (e.g. `"use cache"` where appropriate, async `params`/`searchParams`); if unsure about an API, check current Next.js docs rather than relying on older (v13–15) patterns
- **Styling**: Tailwind CSS v4. Theme tokens from design.md are defined in `app/globals.css` with `@theme` (v4 has no `tailwind.config.ts` by default)
- **Motion**: Framer Motion, plus SVG filters (feTurbulence / feDisplacementMap) for ghost effects
- **GitHub data**: server-side only, token from `GITHUB_TOKEN` (read-only, public repos). **GraphQL** for the graveyard load, **REST** (Octokit) for per-repo detail
- **Dependency freshness**: npm registry (`registry.npmjs.org`) for a root `package.json`; PyPI JSON API for a root `requirements.txt`. Root files only (no monorepo crawling)
- **AI**: one provider-agnostic module, `lib/llm.ts`, wrapping a small, fast, cheap model (provider chosen via env: `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`). Every other module calls `lib/llm.ts`, never a provider SDK directly
- **Cache + rate limiting**: a hosted Redis (e.g. Upstash via the Vercel Marketplace, free tier). In-memory caches don't survive serverless invocations, so don't rely on them
- **Testing**: Vitest for unit tests, fast-check for property-based tests
- **Hosting**: Vercel

## Routes
- `/` landing (username box + "Tour the estate")
- `/estate` the Haunted Estate (fixture, no API calls)
- `/g/[username]` a user's graveyard; `/g/[username]/[repo]` deep link that opens the scene with that creature's detail panel open (shareable)
- `/api/*` route handlers
- Stretch: `/badge/[user]/[repo]` and `/card/[user]` (SVG)
Usernames live under `/g/` so a GitHub user named "estate" or "badge" can't collide with app routes.

## GitHub data budget
An authenticated token gets 5,000 REST requests/hour and 5,000 GraphQL points/hour. Budget carefully.
- **Graveyard load = one GraphQL query per 100 repos** via `repositoryOwner(login:)` (works for users and organizations), `repositories(isFork: false, privacy: PUBLIC, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC})`, capped at the 300 most recently pushed repos (≤3 queries). Fetch everything classification needs in that query: name, description, `pushedAt`, `createdAt`, `isArchived`, `isFork`, `homepageUrl`, `stargazerCount`, `primaryLanguage`, open issue count, release count, README size (alias two lookups, `HEAD:README.md` and `HEAD:readme.md`, since the path is case-sensitive), and the default branch's last commit message. No per-repo calls to draw the scene.
- **Per-repo detail is lazy** (only when a panel opens) and cached:
  - Heartbeat: REST `GET /repos/{owner}/{repo}/stats/participation` (52 weekly counts, `owner` series). May return **202** while GitHub computes it: retry with backoff (e.g. 1s, 2s, 4s), then show "the spirits are gathering…" and let the user retry. Never block the panel on it. 204 (empty repo) = flat line.
  - Séance inputs: last 10 commits, the last commit's changed files, contents of those files only for a TODO/FIXME scan (max 5 files, 100 KB each), branches + `compare` vs the default branch (max 5 branches), open issues and PRs (max 10), README. Never scan the whole repo.
  - Dependencies: root `package.json` / `requirements.txt` + registry lookups (max 30 packages).
- Handle GitHub errors explicitly: 404 (unknown user), 403/429 rate limit (read reset headers), 5xx (retry once).

## Caching
- Graveyard list: 10 minutes per username.
- Per-repo facts (heartbeat, séance inputs, deps): keyed by `owner/repo` + `pushedAt`; 24 hours.
- LLM outputs (diagnosis, séance opening, plan, eulogy, epitaph): keyed by `owner/repo` + `pushedAt` + output type; 24 hours.
- **LLM prose must not hard-code day counts or dates** ("41 days ago"). The UI renders those from data, so cached text never goes stale.

## Cost and abuse protection (the app must stay up for judges until Jan 29, 2027)
- Rate-limit LLM routes per IP (e.g. 30 LLM calls/hour) and enforce the séance's 3 follow-up limit **server-side** too.
- A global daily LLM call budget (env `LLM_DAILY_LIMIT`); when hit, show a friendly in-character message and keep the rest of the app working (facts, scene, estate).
- Set a hard spending cap in the LLM provider's console.
- **Keep limits generous.** The rules require the app to be testable "free of charge and without any restriction" until Jan 29, 2027, so limits exist only to stop abuse: set them so a judge clicking through 20 repos and asking every follow-up never hits one, and budget enough LLM spend for that. If a limit ever triggers, the scene, facts, heartbeat and the full Haunted Estate keep working.
- The GitHub token must not expire before **Feb 2027** (set its expiry when you create it). Same for any LLM key.
- Vercel functions have a maximum duration; check your plan's limit and keep LLM calls short (small model, capped output) or stream responses so the séance never times out.

## Rules
- Never expose `GITHUB_TOKEN` or the LLM key to the client. All external calls go through route handlers or server actions. Server-only modules import `server-only`.
- Keep pure logic (lifecycle, finished signals, semver, verdict rules, séance evidence validator, ledger math, .ics) in `lib/` as plain functions with no I/O, so it can be property-tested.
- Facts shown to the user come from APIs, not the LLM. Pass facts into the LLM prompt and ask it only for prose; validate LLM output against a zod schema before using it; on invalid output retry once, then fall back to a plain, non-AI message.
- Missing data is normal: a repo with no package.json, no README or no commits still gets a creature.
- MVP is **read-only** against GitHub: no write scopes. Overrides (`finished` / `scrapped` / `revived` + timestamp) live in localStorage keyed by username, with every read/write in try/catch.
- All lifecycle thresholds live in one config object in `lib/lifecycle.ts`, never as magic numbers elsewhere.
- "Now" is injected (a parameter), never read inside pure functions, so tests and the estate can control time.
- Respect `prefers-reduced-motion`. Every interactive element is keyboard reachable with a visible focus ring.

## Performance budget
- The scene stays smooth (aim for 60 fps) with 100 creatures on a mid-range laptop. SVG filters are expensive: apply `feTurbulence`/displacement to a creature only when it's on screen, hovered, or one of the few "hero" creatures; others use cheaper opacity/transform effects.
- Lighthouse performance ≥ 80 on the landing page and `/estate`. Fonts via `next/font`; audio loads lazily after the user enables sound.

## Property-based testing targets
- **Lifecycle is total and exclusive:** every repo maps to exactly one of ghost, risen, zombie, tombstone, coffin for any input and any "now".
- **Precedence holds:** a `finished`/`scrapped` override always wins; a repo pushed within 90 days with no override and not archived is always a ghost.
- **Decay is monotonic:** with all else equal, more days quiet never yields a healthier state or a lower decay level.
- **Decay levels stay in range** (ghost 0–3, zombie 0–4) for any date, including future dates and missing dates.
- **Revive lapses correctly:** a `revived` override becomes ghost iff a push happened after the revive date; otherwise risen for 14 days, then zombie.
- **Semver comparison:** `isOutdated(a, b)` is consistent with ordering (antisymmetric, transitive) and never throws on valid semver.
- **LLM output** that passes zod validation always respects length limits.
- **Séance grounding:** every evidence reference in a séance answer (commit SHA, file path, branch, issue number) exists in the input facts. Generate random fact sets and check the validator rejects any answer citing something not in them.
- **Ledger math:** stats stay within the min/max of the inputs and are never NaN, for any repo list including empty.
- **.ics reminder** is valid for any date/time zone (parses back to the same instant).
