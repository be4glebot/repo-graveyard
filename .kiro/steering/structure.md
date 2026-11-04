---
inclusion: always
---

# Project Structure

```
app/
  page.tsx                       # landing: username box + "Tour the estate"
  globals.css                    # Tailwind v4 @theme tokens (from design.md)
  estate/page.tsx                # the Haunted Estate (fixture data)
  g/[username]/page.tsx          # a user's haunted scene
  g/[username]/[repo]/page.tsx   # deep link: scene with that creature's panel open
  api/
    graveyard/route.ts           # GraphQL bulk load + classification inputs
    repo/route.ts                # lazy per-repo facts (heartbeat, deps)
    seance/route.ts              # séance opening + follow-ups (rate-limited)
    diagnosis/route.ts           # diagnosis, plan, eulogy, epitaph (rate-limited)
  badge/[user]/[repo]/route.ts   # stretch: SVG repo badge
  card/[user]/route.ts           # stretch: SVG profile card
components/
  scene/        # Scene, Sky, Moon, Hills, Cemetery, Crypt, Fence, Fog, GatesIntro, TurningSoon, SummaryLine, LightsOnTable
  creatures/    # Ghost (decay 0–3), Risen, Zombie (decay 0–4), Tombstone, Coffin
  detail/       # DetailPanel, Heartbeat, FactsPanel, DependencyTable, Diagnosis, RevivalPlan, Eulogy, Epitaph, SummonLater
  seance/       # SeanceRoom, GhostVoice, EvidenceChip, FollowUpQuestion
  ledger/       # CoronersLedger
  ui/           # shared buttons, menus, toggles, sound toggle
data/
  estate.json                    # Haunted Estate fixture (dates as "days ago" offsets)
lib/
  github.ts        # GraphQL + Octokit wrappers (server only)
  registries.ts    # npm / PyPI lookups (server only)
  lifecycle.ts     # pure: thresholds config, precedence, state + decay level (takes "now")
  finished.ts      # pure: finished / unfinished signals and guess
  overrides.ts     # localStorage overrides (client only, try/catch)
  semver.ts        # pure: version comparison helpers
  verdict.ts       # pure: rules feeding the Revive / Seal verdict
  seance.ts        # gather séance facts (server) + pure evidence validator
  ledger.ts        # pure: graveyard-wide pattern stats
  ics.ts           # pure: build .ics reminder
  llm.ts           # provider-agnostic LLM wrapper (server only)
  ai.ts            # prompts + zod schemas (server only)
  cache.ts         # Redis cache helpers (server only)
  ratelimit.ts     # per-IP + daily LLM limits (server only)
tests/
  unit/
  property/        # fast-check property tests
public/
  sounds/          # royalty-free / CC0 audio only, with a CREDITS.md
docs/
  design-review/   # dated screenshots from /design-review runs (for the write-up)
```

## Conventions
- Components are function components in PascalCase files.
- Server-only modules import `server-only` at the top.
- Theme tokens (colors, fonts, motion durations) live in `app/globals.css` under `@theme`; components never hardcode hex colors.
- Pure functions take their inputs (including "now") as parameters and never call APIs, read storage or read the clock.
