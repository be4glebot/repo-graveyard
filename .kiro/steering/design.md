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

## Visual reference
The approved mockups are HTML files in `docs/design-canvas/` (open them with #File or in a browser). Match them for layout zones, palette, typography, copy tone, states and decay steps. Creature *art* comes from `public/art/` images (see Creature art below); the vector creatures on the boards are placeholders.

| Board | File | Used by |
|---|---|---|
| Graveyard scene | `Main.dc.html` | Spec 2 |
| Creature sheet (every decay level) | `Creatures.dc.html` | Spec 2 |
| Landing (castle gate, sound choice) | `Landing.dc.html` | Spec 2 |
| Lights-out opening (6 steps, timings) | `LightsOut.dc.html` | Spec 2 |
| Empty, loading and error states | `States.dc.html` | Spec 2, 3, 4 |
| Mobile | `Mobile.dc.html` | Spec 2, 3, 6 |
| Detail panel + séance | `Seance.dc.html` | Spec 3, 4 |
| Verdicts: revive, seal, rest | `Verdicts.dc.html` | Spec 3, 10 |
| Revive in Kiro | `ReviveInKiro.dc.html` | Spec 6 |
| Badges, profile card, share card | `Badges.dc.html` | Spec 7 |
| Owner mode | `OwnerMode.dc.html` | Spec 10 |

## Mood
**Gothic Dracula-castle suspense. No jumpscares, ever.** Anticipation and atmosphere beat shocks. Think an old Hammer-horror matte painting: a castle on a cliff with one blood-red window, storm clouds, a moon that reddens, wrought-iron gates with spear tips, stone pillars, ravens with red eyes, cobwebs in the corners, blackletter on the gate. Menacing and grand, never gory, never cartoon-goofy. Suspense comes from slowness, darkness and things that watch (eyes, ravens, a flickering window). Restraint is still the polish: effects are tuned so the facts stay readable.

## Palette (define as Tailwind v4 `@theme` tokens in app/globals.css; never hardcode hex in components)
- `night-950` #070910 (page background), `night-900` #0d1220, `night-800` #161d31 (panels)
- `moon-100` #ecead9 (primary text, moonlight), `moon-300` #b9b6a3 (secondary text)
- `ghost-300` #9fe7ff (ghost glow, cool and alive)
- `zombie-400` #8fb359 (sickly green, used sparingly)
- `iron-500` #6b7280 (coffin chains, metal)
- `candle-400` #f4b860 (warm accent: focus rings, primary buttons, highlights)
- `blood-500` #b23a48 (errors and danger)
- `crimson-700` #6e0f1f, `crimson-500` #9b1c31 (primary buttons, turning-soon notice, active states), `crimson-400` #c22a3e (the castle's red window, raven eyes, wordmark glow), `crimson-200` #ff8a98 (crimson text on dark)
- `stone-800` #1d1b24, `stone-700` #26242f, `iron-900` #151a26 (pillars, gate, fences)
- `bloodmoon-100` #eccbbd (moon when health < 0.5)
Check contrast: body text on `night-900` must meet WCAG AA.

## Typography
- **Wordmark only:** "UnifrakturMaguntia" (blackletter) for "Repo Graveyard", with a soft crimson glow. Nowhere else; blackletter is unreadable at length.
- **Headings, labels, buttons, badges:** "Cinzel" (engraved Roman capitals, letter-spaced, uppercase).
- **Narrative / epitaphs / whispers / séance:** "IM Fell English" (italic for spoken lines). Never Creepster-style novelty fonts.
- **UI text:** a clean sans (e.g. "Inter").
- **Facts and numbers:** a monospace (e.g. "JetBrains Mono"), so data reads as data.
- Load via `next/font`.

## The signature moment: the lights-out opening
Every graveyard opens the same way (skippable with a "Skip" button, any key, or a click; ~6 s total). It is built for suspense: hold the darkness longer than feels comfortable.

| Time | Visual | Sound |
|---|---|---|
| 0.0 s | The **plain register** (light paper theme, same as Lights-on mode). Doubles as the loading state: "Counting the graves… N%". | fluorescent hum |
| 1.0 s | Lights fail: overlay flickers 4 times, text jitters, copy turns sinister, the oldest rows bleed to crimson | buzz, three pops |
| 2.2 s | Total black. A pair of red eyes opens center, blinks once; two smaller pairs appear in the corners. "YOU LEFT THEM HERE…" fades in (Cinzel, crimson) | silence, a held breath |
| 3.8 s | Lightning: a white flash and bolt reveal the castle on the cliff, screen shakes ~0.5 s | thunder crack, rain begins |
| 4.7 s | Blood moon rises behind the clouds (red only if the undead outnumber the living), castle windows light, candles light one by one, wordmark burns in | match strikes, distant bell |
| 6.2 s | The estate appears: tombstones and coffins first, zombies rise, ghosts materialize last; summary line fades in | ambient bed (rain, wind, ravens, low organ drone) |

- **Lights on** (header button) plays it in reverse: candles snuff, lights buzz back on, the plain list returns. Same data, no effects: the accessible view and the judges' verification view.
- Reduced motion: skip straight to a 300 ms crossfade, no flicker, no shake, no lightning.
- Return visits within a session: offer "Skip intro" by default after the first view.

### Lights-on must be beautiful too
Lesson from SpookBnB (3rd overall): its normal mode was a genuinely premium page (editorial serif headline with an italic accent word, warm paper tones, soft cards), which is why the switch to darkness landed. Our Lights-on list is the "before" picture: warm paper `#f6f3ea`, ink `#1f2330`, tan accent `#a8794a`, an IM Fell headline ("Every project, *accounted for.*"), mono repo names, soft pill state tags, one soft shadow. It must look finished, never like a debug table.

### The copy turns sinister (same data, darker words)
During the flicker the plain list's words change while the data stays identical, and the scene keeps the dark vocabulary:

| Lights on | Lights out |
|---|---|
| The estate register | The estate register · none may leave |
| Every project, accounted for. | Every soul, bound here forever. |
| Ghost / Zombie / Tombstone / Coffin | Restless / Undead / At rest / Sealed |
| 3 days ago | 3 days since last breath |
| 16 public repositories | 16 souls on this estate |
| State | Condition |
| Last push | Last seen alive |
| Open issues | Unfinished business |
| Archived | Laid to rest |
| Sorted by last push | Ordered by when they were last seen alive |

### Whispers
Occasional italic whispers (IM Fell, dark translucent box, center of the scene) narrate real data, one at a time, at most one every ~20 s, auto-fading: "habit-tracker is still waiting for you…", "api-server grows cold…" (turning soon), "Something stirs near the crypt…" (a coffin was just sealed). Announced politely to screen readers (`role="status"`), never blocking clicks, and switchable off with motion.

## Atmosphere layers (back to front)
Sky (gradient toward a bruised crimson at the horizon) → stars (twinkle) → moon (brightness = health; turns blood-red `bloodmoon-100` when zombies + risen outnumber ghosts + tombstones) → storm clouds drifting across the moon (set dressing) → bats → castle silhouette on the cliff (set dressing: amber windows, one flickering, one red window that never goes out) → hills → dead tree framing the left edge → ground → cemetery, crypt, wrought-iron fence with spear tips, stone pillars, gothic arch gate → ravens on the gate pillars (red eyes, set dressing) → creatures → fog (density = zombie count) → lightning flash (frequency = number of ancient zombies; none if zero) → vignette (inset shadow with a faint crimson tint) → cobwebs in the top corners → film grain (SVG noise, ~7% opacity). Set dressing (castle, clouds, bats, ravens, tree, cobwebs, grain, vignette) must stay dark and low-contrast and never compete with creatures.

## Motion
- Library: Framer Motion for UI and creature motion; SVG filters (`feTurbulence` + `feDisplacementMap`) for wispy, tattered ghost edges.
- Idle motion is slow and calm (ghosts bob on 3–6 s loops, staggered so they never sync). Decay adds irregular flicker, not faster bobbing.
- Every creature reacts on hover/focus (ghost turns toward the cursor, zombie lurches, chains rattle, candle on a tombstone flares).
- Signature moments, each under 1.5 s:
  - **Lights out**: the opening sequence (see The signature moment).
  - **Revive**: zombie stands up, a burst of light, becomes Risen (and later a ghost on the first push).
  - **Seal**: chains wrap the coffin and lock with a thud.
  - **Rest**: zombie walks through the gate and becomes a tombstone (when marked finished).
- `prefers-reduced-motion`: no bobbing, flicker or fog drift; decay is shown with static styling (opacity, tattered outline) instead.

## Turning soon
A crimson notice near the top of the scene for ghosts within 30 days of turning: dark crimson fill (`crimson-700` at ~35%), `crimson-400` border with a soft red glow, the ghost's name and a countdown ("api-server turns in 9 days. It can still be saved." / "Go to it →"). Clicking it opens that ghost's panel. It's the "I need to get work done" moment: impossible to miss, full of dread, but never a jumpscare.

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
- Loading: the plain list's "Counting the graves… N%" state, then the lights-out opening; never a spinner.
- User with no repos: an empty, peaceful cemetery under a full moon: "Nothing buried here yet."
- User with only ghosts: "All your projects are alive. Rare. Respect."
- Unknown username: the gate stays locked: "No one by that name rests here."
- Rate limited: "The spirits are tired. Try again in a few minutes." with the Haunted Estate link.

## Creature art
Performance: SVG filters are costly; use them on hovered, on-screen hero creatures, not all 100 (see tech.md performance budget).

**Painted art, data-driven motion.** The look is rough and dreary (scratchy ink, charcoal, grime), never smooth vector, cute or realistic.
- Creature and backdrop images live in `public/art/` as WebP, named exactly as in `docs/ART_PROMPTS.md`: `ghost-0`…`ghost-3`, `zombie-0`…`zombie-4`, `risen`, `tomb-{arch|cross|gothic}-{fresh|old}`, `coffin`, `mausoleum`, `bg-sky`, `bg-castle`, `bg-hills`, `mg-fence`, `fg-frame`, `tex-grime`.
- Creature components choose the image from state + decay level (the data), then add motion in code: ghosts bob and sway, flicker by decay, glow by recency; zombies shamble with speed by decay; risen pulses cyan. Use `next/image` with explicit sizes.
- Depth: the backdrop plates are parallax layers (sky slowest, foreground frame fastest) that move with the pointer and scroll; off with reduced motion. `tex-grime` overlays everything at low opacity with the grain.
- Moon (color = health), fog (density = zombies) and lightning (frequency = ancient zombies) stay drawn in code because they show data.
- Until an image exists, fall back to the placeholder vector creatures in `docs/design-canvas/` so nothing is blocked on art.

## Design QA loop
Run `/design-review` (a manual steering file) at milestones: it uses a Playwright MCP server to screenshot every key screen at desktop and mobile widths and critiques them against this file. Run `/a11y-review` for accessibility. Keep before/after screenshots in `docs/design-review/` for the write-up.

## "Lights on" mode
A toggle (like turning on a lantern) that shows the same data as a plain, sortable table. It's for accessibility, fast scanning, and judges who want to verify the data. Same data, no effects.

## Sound
- **Opt-in at the landing page:** "Enter with sound" / "In silence". That click is the user gesture that unlocks audio for the whole session (browsers block autoplay; last year's Séance solved it the same way). A speaker toggle stays in the scene header. Remember the choice in localStorage.
- **One audio manager** (`lib/audio.ts`, client-only): Web Audio API, a master gain with mute, per-category volumes, and de-duplication so rapid hovers never stack sounds. Respect the mute toggle instantly. Never play sound before the opt-in.
- **Sources: a mix.** Synthesized in code with Web Audio (no licensing risk): ambient drone, wind (filtered noise), heartbeat, bell, flatline tone, buzz/pops. CC0 recordings (e.g. Freesound's CC0 filter) for: zombie groan, chain rattle and lock click, thunder, match strike, owl, crickets, whisper. Every file is listed with its source and license in `public/sounds/CREDITS.md`. Keep each file small (mono, ≤ 100 KB, compressed).
- **Sound map:**

| Event | Sound |
|---|---|
| Scene ambient bed | low drone + wind + crickets, owl every ~40 s |
| Ghost about to turn | one distant bell toll per such ghost when the scene opens |
| Hover ghost / zombie / tombstone / coffin | soft whisper / low groan / candle crackle / chain rattle (quiet, max one at a time) |
| Open detail panel | page rustle |
| Heartbeat line draws | one soft thump per active week drawn; a held flatline tone over the quiet weeks (zombies) |
| Séance text appears | faint whisper under the typewriter, planchette scrape on each evidence chip |
| Revive | thunder crack + rising choir swell (~1.5 s) |
| Seal | chains whip, lock click, coffin thud |
| Mark finished | gate creak, stone settling |
| Lights on / off | electrical buzz + pops (reverse for on) |

- **Accessibility:** sound never carries information alone; every sound event has a visible counterpart.

## Trademarks and assets
- Don't use GitHub's logo or Octocat artwork anywhere in the UI or the demo video. Refer to GitHub by name in plain text only.
- All art is original (hand-built SVG or Rive made for this project). Don't use stock or AI-generated images whose ownership is unclear; the rules require the submission to be solely ours.
- Fonts: open-licensed (Google Fonts / OFL). Audio: CC0 or self-made, credited in `public/sounds/CREDITS.md`.

## Accessibility
- Every creature is a focusable button with an accessible name: "weather-app, zombie, abandoned 8 months".
- Visible `candle-400` focus ring on the dark background.
- Never rely on color or motion alone to convey state; every state also has a text label.
