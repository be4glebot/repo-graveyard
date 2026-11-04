---
inclusion: fileMatch
fileMatchPattern: ["components/**/*.tsx", "app/**/*.tsx", "app/**/*.css", "data/estate.json"]
---

# Design System: Repo Graveyard

## The one rule
**Every spooky effect must encode real data.** Nothing is decoration only. If a judge asks "why does that ghost flicker?" the answer is always a fact about the repo. This is what the Costume Contest asks for: design elements that enhance function.

| Visual | Encodes |
|---|---|
| Ghost glow brightness | recency of the last push |
| Ghost translucency, tattered edges, flicker rate | days quiet (ghost decay level 0–3) |
| Risen: faint glow, standing, walking toward the sky | revived but not yet pushed to; countdown shown |
| Zombie decay (skin tone, limp, missing parts) | time abandoned (zombie decay level 0–4) |
| Zombie distance from the gate | freshness: newest zombies stand nearest the gate (easiest to revive) |
| Tombstone size | stars, gently scaled and capped (so one popular repo doesn't dwarf the rest) |
| Moss and cracks on tombstones | days quiet |
| Chained coffin | scrapped on purpose |
| Moon brightness | overall health: share of ghosts vs zombies |
| Fog density | number of zombies (more limbo, more fog) |

## Mood
Beautiful and eerie, not gory and not cartoon-goofy. Think a moonlit storybook illustration: calm, atmospheric, a little melancholy, with moments of delight. Restraint is the polish: effects are tuned so the facts stay readable.

## Palette (define as Tailwind v4 `@theme` tokens in app/globals.css; never hardcode hex in components)
- `night-950` #070910 (page background), `night-900` #0d1220, `night-800` #161d31 (panels)
- `moon-100` #ecead9 (primary text, moonlight), `moon-300` #b9b6a3 (secondary text)
- `ghost-300` #9fe7ff (ghost glow, cool and alive)
- `zombie-400` #8fb359 (sickly green, used sparingly)
- `iron-500` #6b7280 (coffin chains, metal)
- `candle-400` #f4b860 (warm accent: focus rings, primary buttons, highlights)
- `blood-500` #b23a48 (errors and danger only)
Check contrast: body text on `night-900` must meet WCAG AA.

## Typography
- **Display / epitaphs:** a classic serif with character (e.g. "IM Fell English" or "Cormorant Garamond"). Never Creepster-style novelty fonts for anything users must read.
- **UI text:** a clean sans (e.g. "Inter").
- **Facts and numbers:** a monospace (e.g. "JetBrains Mono"), so data reads as data.
- Load via `next/font`.

## Motion
- Library: Framer Motion for UI and creature motion; SVG filters (`feTurbulence` + `feDisplacementMap`) for wispy, tattered ghost edges.
- Idle motion is slow and calm (ghosts bob on 3–6 s loops, staggered so they never sync). Decay adds irregular flicker, not faster bobbing.
- Every creature reacts on hover/focus (ghost turns toward the cursor, zombie lurches, chains rattle, candle on a tombstone flares).
- Signature moments, each under 1.5 s:
  - **Gates open**: intro as the scene loads (fog rolls back while GitHub data loads; doubles as the loading state).
  - **Revive**: zombie stands up, a burst of light, becomes Risen (and later a ghost on the first push).
  - **Seal**: chains wrap the coffin and lock with a thud.
  - **Rest**: zombie walks through the gate and becomes a tombstone (when marked finished).
- `prefers-reduced-motion`: no bobbing, flicker or fog drift; decay is shown with static styling (opacity, tattered outline) instead.

## Turning soon
A candlelit notice near the top of the scene for ghosts within 30 days of turning: the ghost's name, a small flickering ghost icon and a countdown ("turns in 9 days"). Clicking it opens that ghost's panel. It's the "I need to get work done" moment, so it should be impossible to miss but calm, not alarming.

## Scene layout
- Layered 2D parallax: sky + moon → distant hills → cemetery fence → ground → foreground fog. Subtle parallax on mouse move.
- Ghosts in the sky band, risen climbing between ground and sky, tombstones inside the fence, coffins in a separate crypt plot at the edge, zombies outside the fence.
- Labels: every creature shows its repo name on hover/focus (and always in lights-on mode); the 5 most important (turning soon, newest zombies) show names by default.
- **100+ repos:** never let the scene break. Cap visible creatures per zone; extras collapse into a group ("+14 more zombies") that expands into a list.
- Mobile: the scene becomes a vertical scroll of zones (sky, cemetery, crypt, outside the fence).

## Detail panel (clicking a creature)
- The camera eases toward the creature and a panel slides in, styled as an old record (parchment-dark paper, serif heading, mono facts).
- Order: name + state → key facts → AI diagnosis → direction (Revive plan / Seal eulogy / epitaph) → copy buttons.
- Facts are visually separated from AI prose so users can tell data from interpretation.

## The heartbeat
A thin EKG line across the top of the detail panel, drawn from 52 weekly commit counts. Each week is a beat whose height is that week's commits; weeks with no commits are flat. Draw it on with a stroke-dash animation when the panel opens. Ghosts' lines end in a soft glowing dot that pulses; zombies' lines run flat into a single long tone (a held sine note, only if sound is on). Same `ghost-300` / `zombie-400` colors as the creature.

## The séance
The signature screen. When the user clicks "Summon the ghost":
- The scene dims to near-black except the ghost, which drifts to the center; candles flare around the panel edge.
- The ghost's words appear one phrase at a time (typewriter, ~30 ms/char, skippable on click/keypress) in the display serif, larger than body text.
- Evidence (commit SHAs, file names, branches) renders inline as small mono chips; hover shows the commit message, click opens it on GitHub.
- Follow-up questions are an input styled as writing on a Ouija-style board edge, with 3 suggested questions as chips. Show "2 questions left".
- If data is missing, the ghost says so in character ("my memory of that branch has faded"). Never fake it.
- Reduced motion: no drift or typewriter; text appears at once.

## The Haunted Estate
Same scene, populated from fixtures, with a small brass plaque in the corner: "Sample estate. Enter your own name at the gate." It should show every state and decay level, plus at least one perfect séance, so it doubles as the demo-video set.

## Empty, loading and error states (these get judged too)
- Loading: the gates-open intro with fog; never a spinner.
- User with no repos: an empty, peaceful cemetery under a full moon: "Nothing buried here yet."
- User with only ghosts: "All your projects are alive. Rare. Respect."
- Unknown username: the gate stays locked: "No one by that name rests here."
- Rate limited: "The spirits are tired. Try again in a few minutes." with the Haunted Estate link.

## Creature art
Performance: SVG filters are costly; use them on hovered, on-screen hero creatures, not all 100 (see tech.md performance budget).

Start with hand-built SVG creatures driven by props (decay level → opacity, displacement-filter scale, flicker keyframes, missing parts). If the first creature looks great by end of week 2, stay with SVG. Optional upgrade: build the hero creatures in **Rive**, whose state machines take numeric inputs, so `decay` can drive the animation directly from data. Time-box any Rive experiment to 2 days.

## Design QA loop
Run `/design-review` (a manual steering file) at milestones: it uses a Playwright MCP server to screenshot every key screen at desktop and mobile widths and critiques them against this file. Run `/a11y-review` for accessibility. Keep before/after screenshots in `docs/design-review/` for the write-up.

## "Lights on" mode
A toggle (like turning on a lantern) that shows the same data as a plain, sortable table. It's for accessibility, fast scanning, and judges who want to verify the data. Same data, no effects.

## Sound
Off by default; a speaker toggle in the corner. Only starts after a user interaction (browsers block autoplay). Ambient wind, plus soft per-creature sounds on hover. Royalty-free or self-made audio only (the rules forbid unlicensed music).

## Trademarks and assets
- Don't use GitHub's logo or Octocat artwork anywhere in the UI or the demo video. Refer to GitHub by name in plain text only.
- All art is original (hand-built SVG or Rive made for this project). Don't use stock or AI-generated images whose ownership is unclear; the rules require the submission to be solely ours.
- Fonts: open-licensed (Google Fonts / OFL). Audio: CC0 or self-made, credited in `public/sounds/CREDITS.md`.

## Accessibility
- Every creature is a focusable button with an accessible name: "weather-app, zombie, abandoned 8 months".
- Visible `candle-400` focus ring on the dark background.
- Never rely on color or motion alone to convey state; every state also has a text label.
