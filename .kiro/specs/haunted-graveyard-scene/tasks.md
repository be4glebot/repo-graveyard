# Implementation Plan: Haunted Graveyard Scene

## Overview

This plan implements the haunted graveyard scene in TypeScript (strict, Next.js 16 App Router) following the design's hard boundary between the pure view-model core and the React/I-O shell. Work proceeds bottom-up: the pure functions in `lib/scene-view.ts` and the estate data layer (`lib/estate-schema.ts`, `lib/estate.ts`, `lib/estate-loader.ts`, `data/estate.json`) come first because they are the property-test and conformance-test targets, with each fast-check property test placed immediately after the code it validates. Then the theme tokens and animation CSS, the backdrop/atmosphere components, the creature components, the zone/chrome components, the `SceneView` client entry and `Scene` layout, and finally the route pages that wire everything together. Component and integration tests cover the interactive behavior that is not property-testable; the ~60fps, brightness, and exact-layout criteria are left to the design-review / performance loop as the design's Testing Strategy specifies.

This feature consumes the existing lifecycle engine unchanged: `classify` (`lib/lifecycle.ts`) and `buildRows` / `groupByState` / `STATE_ORDER` (`lib/graveyard-view.ts`) are reused, and the live routes reuse the existing `loadGraveyard` path verbatim. No lifecycle threshold is redefined anywhere in this plan.

## Tasks

- [x] 1. Scaffold the pure view-model module and its arbitraries
  - [x] 1.1 Create `lib/scene-view.ts` with types and signatures
    - Create `lib/scene-view.ts` (no `server-only`, no React, no I/O) exporting the types and function stubs from the design's "New pure view-model functions" section: `CreatureBasename`, `SummaryCounts`, `TombstoneTreatment`, `ZoneCap`, `ZoneName`, `ZoneRect`, `TurningSoon`, `FilterHeroHints`
    - Import the reused domain types from `lib/lifecycle.ts` (`LifecycleState`, `RepoFacts`, `LIFECYCLE_CONFIG`) and `lib/graveyard-view.ts` (`GraveyardRow`)
    - Define the scene-level constant `TURNING_SOON_DAYS = 30` here (a scene constant, not a lifecycle threshold); all other numeric knobs (fog cap 20, lightning base 16/step 3/floor 7, zone cap 12, scale floor 0.6, filter-hero budget 4) live as named constants in this module, no magic numbers elsewhere
    - _Requirements: 4.8, 5.4_
  - [x] 1.2 Add shared scene arbitraries to `tests/property/arbitraries.ts`
    - Extend the existing `tests/property/arbitraries.ts` with `arbLifecycleState` (all five states), `arbDecayLevel` (ghost 0–3, zombie 0–4, null for others), `arbGraveyardRow` (a `GraveyardRow` with `name`, `url`, `state`, `daysQuiet`, and a decay level consistent with the state), and `arbGraveyardRows` (lists spanning empty, below/at/above the zone cap of 12, and zombie counts spanning 0/1–19/≥20)
    - Reuse `arbRepoFacts`, `arbIso`, and `arbOverride` already defined in the file; do not duplicate them
    - _Requirements: 4.6_

- [x] 2. Implement creature image selection (pure)
  - [x] 2.1 Implement `creatureImage` in `lib/scene-view.ts`
    - Total map from (`state`, `decayLevel`) to a `CreatureBasename`: ghost → `ghost-0`…`ghost-3`, zombie → `zombie-0`…`zombie-4`, risen → `risen`, tombstone → `tomb-arch-fresh`, coffin → `coffin`; clamp `decayLevel` into the valid band for defence, read only state and decay, recompute no threshold, never throw
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
  - [x] 2.2 Write property test for creature image selection
    - **Property 1: Creature image matches state and decay**
    - For every state produced by `classify` and every decay level that state can carry, `creatureImage` returns exactly one basename from the closed set and never throws
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8**

- [x] 3. Implement counts, moon, fog, and lightning knobs (pure)
  - [x] 3.1 Implement `summaryCounts` and `moonTreatment`
    - `summaryCounts(rows)` returns `{ souls, ghost, risen, zombie, tombstone, coffin }`; counts are non-negative, partition the input, and `souls` equals the total
    - `moonTreatment(rows)` returns `"blood-red"` iff `(zombie + risen) > (ghost + tombstone)`, else `"pale"`
    - _Requirements: 3.2, 7.3, 7.4_
  - [x] 3.2 Write property test for summary counts
    - **Property 4: Summary counts partition the repositories**
    - Per-state counts are non-negative, sum to the total, and the total equals `souls`
    - **Validates: Requirements 7.3, 7.4**
  - [x] 3.3 Write property test for moon treatment
    - **Property 3: Moon treatment follows the health comparison**
    - `moonTreatment` is `"blood-red"` iff `(zombie + risen) > (ghost + tombstone)`, else `"pale"`
    - **Validates: Requirements 3.2**
  - [x] 3.4 Implement `fogDensity`
    - `fogDensity(zombieCount)` returns a value in `[0,100]`: 0 iff count is 0, 100 iff count ≥ 20, strictly interior and monotonic non-decreasing for 1–19, with endpoints pinned so 1–19 stays strictly interior
    - _Requirements: 3.3_
  - [x] 3.5 Write property test for fog density
    - **Property 5: Fog density is monotonic in zombie count**
    - `fogDensity` is in `[0,100]`, monotonic non-decreasing in count, 0 iff count 0, 100 iff count ≥ 20
    - **Validates: Requirements 3.3**
  - [x] 3.6 Implement `ancientZombieCount` and `lightningIntervalSeconds`
    - `ancientZombieCount(rows)` counts zombie rows at decay level 4
    - `lightningIntervalSeconds(ancientCount)` returns `max(7, 16 − 3 × (ancientCount − 1))` seconds, or `null` when `ancientCount` is 0
    - _Requirements: 3.4, 3.5_
  - [x] 3.7 Write property test for lightning interval
    - **Property 6: Lightning interval is monotonic and bounded**
    - For ancient count ≥ 1 the interval equals `max(7, 16 − 3 × (ancientCount − 1))`, monotonic non-increasing, bounded 7–16; returns `null` when ancient count is 0
    - **Validates: Requirements 3.4, 3.5**

- [x] 4. Implement placement, tombstone treatment, capping, and scaling (pure)
  - [x] 4.1 Implement `orderZombies`
    - Stable sort of zombie rows by decay level so distance from the gate is monotonic non-decreasing (lowest decay nearest the gate); rows sharing a decay level keep their input order (pushed-at descending as produced by the loader)
    - _Requirements: 5.3, 5.4_
  - [x] 4.2 Write property test for zombie ordering
    - **Property 2: Zombie ordering is monotonic by decay near the gate**
    - `orderZombies` output is monotonic non-decreasing in decay level with increasing distance from the gate; ties keep input order
    - **Validates: Requirements 5.3, 5.4**
  - [x] 4.3 Implement `tombstoneTreatment`
    - `tombstoneTreatment(daysQuiet)` returns normalized `{ darkness, tilt }` factors in `[0,1]`, each monotonic non-decreasing in `daysQuiet` and clamped to safe display ranges
    - _Requirements: 5.5_
  - [x] 4.4 Write property test for tombstone treatment
    - **Property 7: Tombstone darkness and tilt are monotonic in daysQuiet**
    - For any pair of tombstone rows, darkness and tilt are each monotonic non-decreasing in `daysQuiet`
    - **Validates: Requirements 5.5**
  - [x] 4.5 Implement `capZone` and `creatureScale`
    - `capZone(count, cap = 12)` returns `{ rendered: min(count, cap), more: max(0, count − cap) }`
    - `creatureScale(zoneCount)` scales display size down to no less than 0.6 as the zone count grows
    - _Requirements: 11.3, 11.6_
  - [x] 4.6 Write property test for zone capping
    - **Property 8: Zone capping partitions the Creatures**
    - For any count C, `capZone(C, 12)` returns `rendered = min(C, 12)` and `more = max(0, C − 12)`, across counts below/at/above the cap
    - **Validates: Requirements 11.3**
  - [x] 4.7 Implement `ZONE_RECTS`
    - Export the `ZONE_RECTS: Record<ZoneName, ZoneRect>` constant as viewport percentages taken from `docs/design-canvas/ArtPreview.dc.html`: ghost → sky band, risen → left-edge grave, tombstone → in front of the fence, zombie → foreground outside the fence, coffin → the crypt at the mausoleum door; one constant is the single source of truth for every zone's bounds
    - _Requirements: 5.1, 5.2, 11.1, 11.2_

- [x] 5. Implement filter heroes, whispers, and animation stagger (pure)
  - [x] 5.1 Implement `pickFilterHeroes`
    - `pickFilterHeroes(rows, { hovered, selected, turningSoon })` returns a `Set<string>` of at most 4 repo names drawn from the input rows, in priority order hovered → turning-soon → selected → deterministic input-order fill, deduped, never exceeding 4
    - _Requirements: 6.9_
  - [x] 5.2 Write property test for the filter-hero budget
    - **Property 9: Filter-hero budget is bounded and prioritized**
    - Result size ≤ 4, drawn only from input rows, honors the priority order, and is identical for identical inputs
    - **Validates: Requirements 6.9**
  - [x] 5.3 Implement `composeWhispers`
    - `composeWhispers(rows, repos, now)` builds an ordered list of whisper strings strictly from loaded repo data (e.g. the freshest zombie, the turning-soon ghost), returns `[]` when no qualifying data exists, is pure and deterministic for the same inputs, and never invents a name or fact
    - _Requirements: 8.2, 8.3_
  - [x] 5.4 Write property test for whisper composition
    - **Property 10: Whispers are built only from loaded data**
    - Every returned string is composed from a name or fact present in the input data; returns an empty list when no qualifying data exists
    - **Validates: Requirements 8.2, 8.3**
  - [x] 5.5 Implement `animationDelay`
    - `animationDelay(name)` hashes the repo name to a stable fractional-second delay within a bounded range (e.g. `[0, 6)` seconds), pure, total, deterministic across renders, never throws
    - _Requirements: 6.8_
  - [x] 5.6 Write property test for animation delay
    - **Property 11: Animation delay is deterministic and bounded**
    - Returns the same value on repeated calls for the same name and always falls within its documented range
    - **Validates: Requirements 6.8**

- [x] 6. Implement the remaining pure helpers and their unit tests
  - [x] 6.1 Implement `selectInitialCreature`, `creatureAccessibleName`, and `pickTurningSoon`
    - `selectInitialCreature(rows, initialRepo?)` returns the matching row name by exact, case-insensitive comparison, else `null`
    - `creatureAccessibleName(row)` composes "name, state, humanized-time-quiet", omitting only unavailable fields while keeping the rest
    - `pickTurningSoon(repos, rows, now)` returns the ghost with the fewest whole days until crossing `LIFECYCLE_CONFIG.ghostMaxDaysQuiet` when ≤ `TURNING_SOON_DAYS`, tie-broken by latest `pushedAt`, else `null`; reads the threshold from config, never hardcodes 90
    - _Requirements: 1.2, 1.3, 7.8, 9.1, 9.2, 9.5_
  - [x] 6.2 Write unit tests for the remaining pure helpers
    - `selectInitialCreature`: case-insensitive match and no-match (1.2, 1.3); `creatureAccessibleName`: full name and each omitted-field case (9.1, 9.2); `pickTurningSoon`: fewest-days selection and the latest-`pushedAt` tie-break (7.8); assert `ZONE_RECTS` holds all five zones with percentage bounds inside `[0,100]` (5.1, 11.1)
    - _Requirements: 1.2, 1.3, 7.8, 9.1, 9.2, 5.1, 11.1_

- [x] 7. Checkpoint - pure view-model core
  - Ensure all `lib/scene-view.ts` property and unit tests pass, ask the user if questions arise.

- [x] 8. Implement the estate schema and resolver (pure)
  - [x] 8.1 Implement `lib/estate-schema.ts`
    - Export the zod `estateSchema` and `EstateFixture` type exactly per the design: `estateRepoSchema` with `name`, `description`, `url`, nullable `pushedDaysAgo`, non-negative integer `createdDaysAgo`, the boolean/number/string facts, an optional `override` (`type` enum + `setDaysAgo`), and non-empty `diagnosis` and `seance`; the top-level object has a non-empty `username` and a non-empty `repos` array
    - _Requirements: 12.1, 12.4, 12.9_
  - [x] 8.2 Implement `resolveEstate` in `lib/estate.ts`
    - Pure `resolveEstate(fixture, now)` converting each entry's `pushedDaysAgo` / `createdDaysAgo` / `override.setDaysAgo` to ISO timestamps relative to `now` via `now − daysAgo × LIFECYCLE_CONFIG.msPerDay`, dropping the prose fields, returning `RepoFacts[]` plus an in-memory `Record<string, Override>` for fixture overrides; takes `now` as a parameter, never reads the clock
    - _Requirements: 12.3, 12.6_
  - [x] 8.3 Write a date-stability unit test for `resolveEstate`
    - Assert the resolved `daysQuiet` (via `classify`) equals the fixture's `pushedDaysAgo`, and that the resolved state and decay level are identical, across several distinct `now` values
    - _Requirements: 12.3_

- [x] 9. Author the estate fixture and its conformance test
  - [x] 9.1 Author `data/estate.json`
    - Create the bundled fixture with invented repositories (no real person or project) covering every lifecycle state, every ghost decay level 0–3, and every zombie decay level 0–4, with `pushedDaysAgo` / `createdDaysAgo` offsets chosen so each resolves to the intended state/decay, and a non-empty `diagnosis` and `seance` for every entry
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [x] 9.2 Write the estate fixture conformance test
    - **Property 12: Estate fixture conforms to its schema** (schema-conformance unit test, `tests/unit/estate-fixture.test.ts`)
    - Parse `data/estate.json` against `estateSchema`, asserting every entry parses and the fixture represents all five states, every ghost decay level 0–3, and every zombie decay level 0–4
    - **Validates: Requirements 12.9**

- [x] 10. Implement the estate loader (server only)
  - [x] 10.1 Implement `lib/estate-loader.ts`
    - Import `server-only`; export `loadEstate()` that reads `data/estate.json` from disk (bundled, no network), parses it, and validates against `estateSchema`, returning a discriminated result (`ok` with the `EstateFixture`, or a parse/validation failure); issues no GitHub or network call
    - _Requirements: 1.4, 12.8_
  - [x] 10.2 Write unit tests for `loadEstate`
    - A valid fixture returns `ok`; a malformed or unparseable fixture (injected via a fake reader) returns the failure result rather than throwing; assert no network transport is invoked
    - _Requirements: 1.4, 12.8_

- [x] 11. Checkpoint - estate data layer
  - Ensure all estate schema, resolver, fixture, and loader tests pass, ask the user if questions arise.

- [x] 12. Implement theme tokens, fonts, and animation CSS
  - [x] 12.1 Add scene `@theme` tokens and creature keyframe classes to `app/globals.css`
    - Add the design.md palette tokens (crimson, candle, moon/bloodmoon, paper/ink, etc.) and motion-duration tokens under `@theme`; define the creature decay keyframe classes (`ghost-decay-0`…`ghost-decay-3`, `zombie-lurch-0/1/2`, `zombie-twitch-3/4`, `risen-pulse`) using only `transform` and `opacity`, with durations from motion tokens; define the parallax layer transforms reading `--px`/`--py` with per-layer factors `--f-far < --f-mid < --f-fg`; gate all keyframes and parallax under `@media (prefers-reduced-motion: reduce)` to the rest position
    - _Requirements: 2.3, 2.4, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.10_
  - [x] 12.2 Configure the five fonts via `next/font`
    - Load UnifrakturMaguntia, Cinzel, IM Fell English, Inter, and JetBrains Mono via `next/font` with `display: "swap"`, exposing them as CSS variables wired into the `@theme` font tokens used by the wordmark, headings, narrative/whispers, UI, and facts
    - _Requirements: 7.1, 8.2, 14.2_

- [x] 13. Implement the backdrop and atmosphere components
  - [x] 13.1 Implement `components/scene/Backdrop.tsx`, `Sky.tsx`, and `Moon.tsx`
    - `Backdrop` renders the plates back-to-front: `bg-far` (opaque), `mg-fence` (gate centerpiece), and `fg-frame` (transparent, in front) each via `next/image` with `priority`; because `next/image` cannot repeat an image, `mg-fence-tile` is rendered as a CSS `background-image` with `repeat-x` to fill the viewport width and is preloaded with a `<link rel="preload" as="image">` tag; each plate (including the tiled layer) carries `brightness(≤0.6)` and translates from `--px`/`--py` with its layer factor; a failed plate renders nothing for that layer with no broken-image placeholder while the rest still render
    - `Sky` renders the gradient and stars; `Moon` renders in code with its treatment chosen by `moonTreatment(rows)` (blood-red vs pale)
    - _Requirements: 2.1, 2.2, 2.5, 3.1, 3.2, 14.2, 14.3_
  - [x] 13.2 Implement `components/scene/Fog.tsx`, `Lightning.tsx`, and `Atmosphere.tsx`
    - `Fog` sets overlay density from `fogDensity(zombieCount)`; `Lightning` flashes on the interval from `lightningIntervalSeconds(ancientCount)` as a brief dim overlay of ≤70% opacity, at most one flash per interval, none when ancient count is 0; `Atmosphere` draws a vignette, an SVG-noise film-grain overlay at 7–8% opacity, cobwebs in both top corners, and 2–5 bats, all with `brightness(≤0.6)`; under reduced motion the moon/fog/vignette/grain/cobwebs render static and lightning and bat motion stop
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 13.4_

- [x] 14. Implement the creature components
  - [x] 14.1 Implement `components/creatures/Creature.tsx` (shared shell)
    - A focusable `<button type="button">` with the accessible name from `creatureAccessibleName(row)`, a `candle-400` focus ring ≥2 CSS px thick visible for the full focus duration, and a Framer-Motion hover/focus transition that rotates ≤8° toward the pointer and raises glow within 200ms with no translation >2px; state is conveyed in the accessible-name text; the image uses `next/image` with positive integer width/height and lazy loading below the fold
    - _Requirements: 4.9, 9.1, 9.2, 9.3, 9.4, 9.5, 14.2, 14.4_
  - [x] 14.2 Implement the five creature components
    - `Ghost.tsx` (decay 0–3 motion variants), `Risen.tsx` (cyan pulse), `Zombie.tsx` (decay 0–4: lurch 0–2 with increasing cycle duration, twitch 3–4), `Tombstone.tsx` (darkness + tilt from `tombstoneTreatment(daysQuiet)`), and `Coffin.tsx`; each chooses its image via `creatureImage(state, decayLevel)` and applies its keyframe class with `animationDelay(name)`; filter effects (decay-0 ripple, decay-3 split glitch) apply only when the creature is in the `pickFilterHeroes` set; under reduced motion no keyframe class is applied and decay reads through the image and static opacity
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_
  - [x] 14.3 Write component tests for the creature shell
    - Each creature renders as a focusable button whose accessible name includes the available fields and omits only missing ones (9.1, 9.2); the state is determinable from the accessible-name text alone (9.5); the image declares positive width/height (4.9)
    - _Requirements: 4.9, 9.1, 9.2, 9.5_

- [x] 15. Implement the zone and chrome components
  - [x] 15.1 Implement `components/scene/Zone.tsx` and `MoreGroup.tsx`
    - `Zone` reads its rect from `ZONE_RECTS[state]`, spaces creatures evenly across it (percentage-based so it scales with viewport width), applies `capZone(count, 12)`, orders zombies via `orderZombies`, scales each creature via `creatureScale(count)`, and renders a `MoreGroup` "+N more" when the count exceeds 12; `MoreGroup` toggles between the "+N more" summary and a scrollable list with one named entry per remaining repository, keeping the zone within its boundary; an empty state renders its zone with no creatures and does not alter other zones
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - [x] 15.2 Implement `components/ui/Toggle.tsx`, `Header.tsx`, and `SummaryLine.tsx`
    - `Toggle` renders a state-only on/off control; `SummaryLine` renders from `summaryCounts(rows)` as one line "<souls> souls · <n> ghosts · <n> risen · <n> zombies · <n> at rest · <n> sealed" with every category shown even at 0; `Header` renders the UnifrakturMaguntia wordmark with crimson glow, a "Haunted Estate" badge when `mode === "estate"`, the `SummaryLine`, a 1–39 char visit `<input>` that navigates on non-empty submit and shows a "username is required" validation message on empty/whitespace submit, and the lights-on and sound toggles each showing their state
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 13.1, 13.2_
  - [x] 15.3 Implement `components/scene/TurningSoon.tsx`, `Whisper.tsx`, and `Footer.tsx`
    - `TurningSoon` uses `pickTurningSoon(repos, rows, now)` and renders only when a ghost has ≤30 whole days left, naming that ghost and a whole-day countdown in the crimson-700 fill / crimson-400 border-and-glow treatment, and selects that ghost when activated; `Whisper` is a thin scheduler over `composeWhispers` output — at most one at a time, ≥20s between starts, 8s visible then a 1s auto-fade, `role="status"`, instant visibility toggle under reduced motion, and it stops within 1s and removes any visible whisper when motion is disabled while the sound toggle has no effect on it; `Footer` renders the sample-estate plaque left and the legend/key right without overlapping any creature bounds
    - _Requirements: 7.8, 7.9, 7.10, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [x] 15.4 Implement `components/scene/LightsOnTable.tsx`
    - Render the same set and count of classified repos in the warm-paper style of step 1 of `docs/design-canvas/LightsOut.dc.html` (paper `#f6f3ea` via token, ink text, tan accent, IM Fell English headline, monospace repo names, soft pill state tags) as a table with at least Repository / State / Last push columns, sorted by Last push descending by default, re-sorting on column-header activation, with no parallax/atmosphere/motion/whisper and a steady non-flickering view; render an empty/error state rather than a broken table when repos are unavailable
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 16. Implement the error-state components
  - [x] 16.1 Implement `components/scene/SceneErrorState.tsx` and `EstateErrorState.tsx`
    - `SceneErrorState({ kind, resetInMinutes? })` renders the panel keyed by `LoadError.kind` matching `docs/design-canvas/States.dc.html`: `not-found` (and `invalid-username`) → "No one by that name rests here" with "Try again" and "Tour the estate" actions; `rate-limited` and `server-error`/unreachable → "The gates are locked for now" with the reset countdown in crimson-200 when known and omitted when unknown, plus a "Tour the estate" action; every panel links to `/estate`. `EstateErrorState()` renders a full-page state that replaces the `/estate` scene entirely, never an inline banner
    - _Requirements: 1.5, 1.6, 1.7, 12.8_

- [x] 17. Implement the SceneView entry and Scene layout
  - [x] 17.1 Implement `components/scene/Scene.tsx`
    - Client component that lays out the layers in the z-order from the design (sky → backdrop far → moon → bats → mid-fence → ghosts → risen → tombstones → crypt/coffins → zombies → fog → fg-frame → lightning/vignette/cobwebs/grain → footer → header), passing `groupByState(rows)` to one `Zone` per state in `STATE_ORDER`, and consuming the derived view-model values
    - _Requirements: 1.8, 5.1_
  - [x] 17.2 Implement `components/scene/SceneView.tsx` (client entry)
    - Owns `selected` (initialized via `selectInitialCreature(rows, initialRepo)`; set by creature activation or the turning-soon notice; single-select clears the previous), `reducedMotion` (from a `prefers-reduced-motion` listener, defaulting to `true` on the server), `lightsOn` (renders `LightsOnTable` instead of the scene when true), and `soundOn` (display-only, no audio); for live routes recomputes `rows = buildRows(repos, overrides, renderedAt)` during render with overrides read from `lib/overrides.ts` in a mount effect; for the estate applies in-memory overrides only, never persisting them
    - Implements parallax with a `pointermove` ref + `requestAnimationFrame` loop writing `--px`/`--py` to the Scene root (no React state, coalesced to one write per frame); the listener and rAF loop are not attached at all when `reducedMotion` is true
    - _Requirements: 1.2, 1.3, 2.3, 2.6, 7.9, 8.8, 9.6, 10.1, 10.6, 12.6, 12.7, 13.1, 13.2, 13.3_
  - [x] 17.3 Write component/integration tests for `SceneView`
    - Deep-link pre-selection selects the matching creature on first paint and leaves selection empty on no match (1.2, 1.3); activating a creature single-selects and clears the previous (9.6); activating the turning-soon notice selects that ghost (7.9); the lights-on toggle swaps to the table and back to the same data (10.1, 10.6); "+N more" expands and collapses (11.4, 11.5); the whisper region has `role="status"` (8.6); activating the sound toggle flips its displayed state and loads/plays no audio (13.1, 13.2, 13.3); reduced motion renders backdrop at rest and applies no keyframe classes (2.6, 6.10)
    - _Requirements: 1.2, 1.3, 2.6, 6.10, 7.9, 8.6, 9.6, 10.1, 10.6, 11.4, 11.5, 13.1, 13.2, 13.3_

- [x] 18. Checkpoint - components render
  - Ensure all component and SceneView integration tests pass, ask the user if questions arise.

- [x] 19. Wire the route pages
  - [x] 19.1 Wire `app/g/[username]/page.tsx` to the Scene
    - Keep the existing loader path (await params, `await connection()`, capture `renderedAt` once, `loadGraveyard(username)`); on `ok` render `SceneView` with `rows`/`repos`/`truncated`/`username`/`renderedAt` and `mode="live"`; on error render `SceneErrorState` keyed by `LoadError.kind` (never a partial scene)
    - _Requirements: 1.1, 1.5, 1.6, 1.7, 1.8_
  - [x] 19.2 Implement `app/g/[username]/[repo]/page.tsx`
    - Same loader path as `/g/[username]`, passing the raw `[repo]` segment to `SceneView` as `initialRepo` for case-insensitive deep-link pre-selection; the error branches render `SceneErrorState` identically
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 1.7_
  - [x] 19.3 Implement `app/estate/page.tsx`
    - Server component that captures `renderedAt` once, calls `loadEstate()`, and on success calls `resolveEstate(fixture, renderedAt)` to produce `RepoFacts[]` + in-memory overrides, then renders `SceneView` with `mode="estate"` (brass plaque "Sample estate. Enter your own name at the gate.", Haunted Estate badge); on parse/validation failure renders the full-page `EstateErrorState`; issues no GitHub or network call
    - _Requirements: 1.4, 12.5, 12.6, 12.7, 12.8_

- [x] 20. Static and structural checks
  - [x] 20.1 Add a no-hardcoded-hex assertion for scene and creature components
    - Add a unit test (or an ESLint rule) that scans `components/scene/*`, `components/creatures/*`, and `components/ui/*` and fails on any literal hex color, enforcing that components reference `@theme` tokens only
    - _Requirements: 1.8_
  - [x] 20.2 Verify the build and boundary enforcement
    - Ensure `tsc --noEmit` and `next build` pass, `lib/estate-loader.ts` imports `server-only`, and `lib/scene-view.ts` / `lib/estate.ts` import no React, no I/O, and no `server-only`; confirm the full suite runs via `vitest --run`
    - _Requirements: 13.3, 13.4_

- [x] 21. Final checkpoint - full suite and build
  - Ensure all tests pass via `vitest --run` and `next build` is clean, ask the user if questions arise.

## Notes

- All test sub-tasks (property, unit, component, and integration) are required deliverables and will be run; they are not optional and must be implemented alongside the core implementation sub-tasks.
- Each task references specific numbered acceptance criteria from `requirements.md` for traceability.
- Each of the design's 12 correctness properties maps to exactly one test. Properties 1–11 are fast-check property tests (`fc.assert(fc.property(...))`, `{ numRuns: 100 }` minimum) living in `tests/property/scene-view.property.test.ts`, tagged `Feature: haunted-graveyard-scene, Property N: <title>`; Property 12 is the schema-conformance unit test in `tests/unit/estate-fixture.test.ts`.
- Shared fast-check generators live in `tests/property/arbitraries.ts`; the scene suite reuses the existing `arbRepoFacts`, `arbIso`, and `arbOverride` and adds `arbLifecycleState`, `arbDecayLevel`, `arbGraveyardRow`, and `arbGraveyardRows`. `now` is always passed explicitly.
- The feature consumes the lifecycle engine unchanged: `classify`, `buildRows`, `groupByState`, `STATE_ORDER`, and the `loadGraveyard` server path are reused, and no lifecycle threshold is redefined.
- The following criteria are verified by the design-review / performance loop rather than by unit or property tests, per the design's Testing Strategy: ~60fps at ~100 creatures (14.1), backdrop and set-dressing brightness ≤0.6 (2.5, 3.8), the strictly-increasing parallax displacement feel (2.3 qualitatively), and the exact error-state and scene copy/layout matching `States.dc.html`, `ArtPreview.dc.html`, and `.kiro/steering/design.md` (1.6, 1.7, 1.8).
- Checkpoints ensure incremental validation after the pure core, the estate data layer, the components, and the full wiring.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "3.4", "3.6", "4.1", "4.3", "4.5", "4.7", "5.1", "5.3", "5.5", "6.1", "8.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "3.5", "3.7", "4.2", "4.4", "4.6", "5.2", "5.4", "5.6", "6.2", "8.2"] },
    { "id": 3, "tasks": ["8.3", "9.1", "10.1", "12.1", "12.2"] },
    { "id": 4, "tasks": ["9.2", "10.2", "13.1", "13.2", "14.1", "16.1"] },
    { "id": 5, "tasks": ["14.2", "15.1", "15.2", "15.4"] },
    { "id": 6, "tasks": ["14.3", "15.3", "17.1"] },
    { "id": 7, "tasks": ["17.2"] },
    { "id": 8, "tasks": ["17.3", "19.1", "19.2", "19.3"] },
    { "id": 9, "tasks": ["20.1", "20.2"] }
  ]
}
```
