# Implementation Plan: Estate Map & Places

## Overview

This plan implements the Estate Map & Places feature in TypeScript (strict, Next.js 16 App Router) following the design's hard boundary: lifecycle classification (`lib/lifecycle.ts`) is frozen and untouched, and every piece of new domain logic is a pure, property-tested view-model function layered on top of already-classified `GraveyardRow`s.

Work proceeds bottom-up. The four pure functions in a new `lib/estate-view.ts` module come first — `placeOf`, `orderForPlace`, `paginate`, and `plaqueCopy` — each with a fast-check property test placed immediately after the code it validates (mirroring how `lib/scene-view.ts` is tested). Then the `SceneView` client state/routing wiring and the server-page `?at=` plumbing, so the view can resolve a place deterministically. Then the presentational components (`EstateMap` + `Place`, then `PlaceView` and its parts), the travel transition, the turning-soon "Go to it" jump, the lights-on register extension, and the header/summary/footer chrome fixes. A final integration task replaces the single-scene rendering in the three route pages so there is no orphaned code.

Existing pure helpers from `lib/scene-view.ts` (`creatureScale`, `creatureImage`, `orderZombies`, `creatureAccessibleName`, `pickTurningSoon`, `moonTreatment`, `fogDensity`, `ancientZombieCount`, `summaryCounts`, `selectInitialCreature`, `animationDelay`) and the existing `components/scene/*` and `components/creatures/*` components are reused wherever possible. No new runtime dependency is added; property tests use the repo's existing `fast-check`.

## Tasks

- [x] 1. Scaffold the pure view-model module and its arbitraries
  - [x] 1.1 Create `lib/estate-view.ts` with types, place metadata, and constants
    - Create `lib/estate-view.ts` (no `server-only`, no React, no I/O, no clock) exporting `PlaceId`, `PlaceMeta`, the `PLACES` record (single source of truth, display order sky, gate, ground, crypt, with name/states/accent/cta), the decay-word label maps (`GHOST_DECAY_WORDS` 0–3, `ZOMBIE_DECAY_WORDS` 0–4), the gate `GateFilter` type, and the constants `PLOT_SIZE = 12`, `DEPTH_ROWS = 3`, `TRAVEL_MS = 1200`, `TRAVEL_CROSSFADE_MS = 300`
    - Import reused types from `lib/lifecycle.ts` (`LifecycleState`) and `lib/graveyard-view.ts` (`GraveyardRow`); add signature stubs for `placeOf`, `orderForPlace`, `paginate`, `plaqueCopy`
    - _Requirements: 3.8, 1.2_
  - [x] 1.2 Add shared estate arbitraries to `tests/property/arbitraries.ts`
    - Extend the existing arbitraries file with `arbPlaceId` (the four place ids) and reuse the existing `arbGraveyardRow` / `arbGraveyardRows` (spanning empty, below/at/above `PLOT_SIZE`, mixed states including risen+zombie) plus an `arbCount` for arbitrary finite integers (including negative and fractional) for the `plaqueCopy`/`paginate` size inputs
    - Do not duplicate arbitraries already defined for the scene feature
    - _Requirements: 3.6_

- [x] 2. Implement `placeOf` (pure)
  - [x] 2.1 Implement `placeOf` in `lib/estate-view.ts`
    - Total switch over the five lifecycle states: ghost → `sky`, zombie → `gate`, risen → `gate`, tombstone → `ground`, coffin → `crypt`; never returns undefined, never throws; reads only `row.state`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [x] 2.2 Write property test for `placeOf`
    - **Property 1: placeOf is exhaustive and total (state→place mapping)**
    - Encode: every lifecycle state maps to exactly one of the four `PlaceId`s and never yields undefined/throws; partition corollary — grouping arbitrary `rows` by `placeOf` puts every row in exactly one place and the four group sizes sum to `rows.length`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

- [x] 3. Implement `orderForPlace` (pure)
  - [x] 3.1 Implement `orderForPlace` in `lib/estate-view.ts`
    - Copy the input first (never mutate); per-place stable sort: `sky` by `decayLevel` desc then `daysQuiet` desc; `gate` risen-rank first (every risen before every zombie) then zombie block by `decayLevel` asc; `ground`/`crypt` by `daysQuiet` asc; treat null/NaN `decayLevel`/`daysQuiet` as 0; rely on stable `Array.prototype.sort` for ties
    - Reuse the decay-ordering idea from `orderZombies` for the gate zombie block rather than reimplementing a comparator from scratch
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_
  - [x] 3.2 Write property test for `orderForPlace`
    - **Property 2: orderForPlace is a stable, per-place-correct permutation**
    - Encode: result is a permutation (same multiset) of the input and the input array is unmutated; sky key `(decay, quiet)` monotonic descending; gate — no `i<j` with `result[i].state="zombie"` and `result[j].state="risen"`, and the zombie block is `decayLevel` non-decreasing; ground/crypt `daysQuiet` non-decreasing; equal-key rows retain input order (stability); total on null/NaN keys
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9**

- [x] 4. Implement `paginate` (pure)
  - [x] 4.1 Implement `paginate` in `lib/estate-view.ts`
    - Generic `paginate<T>(rows, size)`: normalize `size` to `max(1, trunc(size))` (size ≤ 0 or non-finite collapses to 1); empty input returns exactly one empty plot `[[]]`; otherwise slice into fixed-size plots in order
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 4.2 Write property test for `paginate`
    - **Property 3: paginate partitions the rows**
    - Encode: flattening the plots in order equals the input exactly (order + multiplicity); empty input ⇒ `[[]]`; non-empty input ⇒ every plot non-empty, every non-last plot length exactly `size`, last plot length in `1..size`, plot count `ceil(n/size)`; `size ≤ 0`/non-finite behaves as `size = 1`
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [x] 5. Implement `plaqueCopy` (pure)
  - [x] 5.1 Implement `plaqueCopy` and a shared pluralization helper in `lib/estate-view.ts`
    - `plaqueCopy(place, count, risenCount?)`: normalize `count`/`risenCount` to non-negative integers (clamp ≥ 0, truncate, NaN/∞ → 0); per-place templates with correct grammar at 0/1/n; gate appends a separate risen clause only when `risenCount > 0` ("1 has risen" / "n have risen"), ignored for the other three places; always returns a non-empty string, never throws
    - Export the `plural`/`verb` helper so `SummaryLine` can reuse it in task 11
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_
  - [x] 5.2 Write property test for `plaqueCopy`
    - **Property 4: plaqueCopy singular/plural correctness for 0/1/many incl. the gate risen clause**
    - Encode: count 0 → empty-copy with no digit; count 1 → singular noun+verb (never "1 …s"); count ≥ 2 → plural; gate with risenCount 0 omits the risen clause, 1 ends "1 has risen", ≥ 2 ends "n have risen"; non-gate ignores risenCount; any finite/negative/fractional/NaN input yields a non-empty string without throwing
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**
  - [x] 5.3 Write unit snapshot tests for exact plaque copy strings
    - Assert the exact mock strings: "48 undead shamble here, waiting for a verdict · 1 has risen" (count 48, risen 1), the same base with 0 risen, "1 ghost still wanders", "No one sealed away yet"
    - _Requirements: 4.1, 4.2, 4.5_

- [x] 6. Checkpoint - Ensure all pure-function tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Wire derived view state and routing into `SceneView`
  - [x] 7.1 Add `parsePlaceId` and deep-link resolution to `lib/estate-view.ts`
    - `parsePlaceId(at?: string): PlaceId | null` returns a valid place id or null for absent/empty/unknown; add an initial-view resolver that applies precedence `?at=` (valid) > place of the deep-linked `[repo]` (via `selectInitialCreature` + `placeOf`) > map
    - _Requirements: 10.2, 10.3, 11.1, 11.2, 11.3, 11.4_
  - [x] 7.2 Write unit tests for `parsePlaceId` and deep-link precedence
    - Each valid id, unknown strings, empty/undefined → null; precedence resolution for `?at=` wins over deep-link place over map; unmatched `[repo]` → map with no selection
    - _Requirements: 10.2, 10.3, 11.1, 11.2, 11.3, 11.4_
  - [x] 7.3 Add `view`/`plotIndex`/`activeFilter` state and client-only history wiring to `SceneView`
    - Add `view: "map" | PlaceId`, `plotIndex`, `activeFilter`, keeping the existing `selected`/`lightsOn`/`soundOn`; initialize `view` once from a new optional `at?` prop and the deep-link resolver; add `onEnterPlace`/`onReturn` that call `window.history.pushState`/`replaceState` (client-only, no Next navigation) and set state; register a `popstate` listener on mount (view ← history state ⟶ `parsePlaceId(location.search)` ⟶ "map") and remove it on unmount; keep `renderedAt` read once and never reset state across client navigation
    - Clamp `plotIndex` into `0..plots.length-1` before render
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 8.3_
  - [x] 7.4 Forward `?at=` from the server pages for initial render only
    - In `app/g/[username]/page.tsx`, `app/g/[username]/[repo]/page.tsx`, and `app/estate/page.tsx`, await `searchParams` alongside `params` and pass the raw `at` string to `SceneView` as `at?`; keep the single `renderedAt` clock read and `loadGraveyard` call unchanged; `[repo]` page keeps forwarding `initialRepo`
    - _Requirements: 10.4, 11.1_
  - [x] 7.5 Write integration tests for client-side routing
    - Entering a place pushes one history entry carrying `?at=place` without re-running the server page; returning pushes one entry without `at`; popstate restores the view; no refetch / no renderedAt change / no state reset across navigation
    - _Requirements: 10.5, 10.6, 10.7, 10.8_

- [x] 8. Build the estate map and place plaques
  - [x] 8.1 Implement `EstateMap` and `Place` components
    - `EstateMap` composites the reused `Backdrop`/`Sky`/`Moon`/`Atmosphere` stack, the reused `TurningSoon` notice (shown iff `pickTurningSoon` is non-null), and four `Place` links in display order sky, gate, ground, crypt; each `Place` is one keyboard-focusable link activatable by click and Enter that calls `onEnterPlace`
    - `Place` renders the plaque: Cinzel place name, IM Fell italic count line via `plaqueCopy(place, count)` (gate uses `plaqueCopy("gate", zombieCount, risenCount)`), the place CTA, and the first `min(3, rowCount)` representatives from `orderForPlace(place, rows)` rendered with the reused creature components; an empty place stays visible, renders no representatives, and uses lower opacity
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 8.2 Write component tests for `EstateMap`/`Place`
    - Four focusable place links in order; plaque name/count-line/CTA present; representative count is `min(3, rowCount)` and never fewer than 1 when rows exist, taken from the head of `orderForPlace`; empty place visible, quieter, no representatives; turning-soon notice present iff a turning-soon ghost exists
    - _Requirements: 1.2, 1.5, 1.6, 2.4, 2.5_

- [x] 9. Build the place view and its controls
  - [x] 9.1 Implement `PlaceView`, `PlaceHeading`, `DepthRows`, `FilterChips`, `Pager`, `ReturnToGate`
    - `PlaceView` reuses the backdrop stack; applies the active filter, then `orderForPlace(place, rows)`, then `paginate(ordered, PLOT_SIZE)`; renders the current plot across up to three `DepthRows` (front row largest/brightest, back rows smaller/dimmer) using the reused `creatureScale` for per-row scale; renders `PlaceHeading` (a `tabIndex={-1}` focus target), `FilterChips`, `Pager`, and `ReturnToGate`
    - `FilterChips`: for `sky` one chip per ghost decay word (healthy, fading, flickering, about to turn); for `gate` one chip per zombie decay word (fresh, rotting, decayed, skeletal, ancient) plus a `Risen` chip; each chip shows its count and is dimmed+disabled at count 0; selecting a decay word / Risen / all narrows the set; `ground`/`crypt` render no decay chips
    - `Pager`: "Plot X of Y" (1-based); "‹ Nearer the gate" moves to the PREVIOUS plot (`plotIndex − 1`, fresher creatures) and is disabled on the first plot (`plotIndex === 0`); "Deeper into the dark ›" moves to the NEXT plot (`plotIndex + 1`) and is disabled on the last plot (`plotIndex === plots.length − 1`); `plotIndex` clamped into range
    - `ReturnToGate`: keyboard-focusable control activatable by click/Enter/Space that returns the view to the map
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 9.1, 9.2, 9.3_
  - [x] 9.2 Write component tests for `PlaceView` and its controls
    - ≤ 3 depth rows with non-increasing scale/brightness front-to-back; 12 creatures per plot, no "+N more"; filter chips change the visible set and show counts, zero-count chips dimmed/disabled, `ground`/`crypt` show none; pager shows "Plot X of Y" and clamps, "Nearer the gate" decrements the plot and is disabled on the first plot while "Deeper into the dark" increments the plot and is disabled on the last plot; return control reachable and returns to map with focus moved to the originating place link (or map heading fallback)
    - _Requirements: 5.1, 5.2, 5.5, 8.1, 8.3, 8.7, 8.8, 8.9, 9.2, 9.3_

- [x] 10. Implement the travel transition and wire it to place entry
  - [x] 10.1 Implement `TravelTransition` and run it on place entry
    - `TravelTransition` overlay owned by `SceneView` during the transition window; motion path ~1200 ms (±100): parallax-zoom at least two backdrop layers at distinct rates toward the place, raise a fog layer to full occlusion before swapping map→place content, fade the place title in, and raise creatures on a fixed per-creature stagger via the reused `animationDelay` so all raises finish before the end; skippable by any key/pointer; reduced-motion path does a 300 ms crossfade with no zoom/fog/stagger; on arrival move focus to `PlaceHeading`; overlay is `aria-hidden` and does not trap focus; returning to the map moves focus to the originating place link (fallback: map heading) with no travel
    - Wire `onEnterPlace` (task 7.3) to start travel after the client-only `pushState`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_
  - [x] 10.2 Write component tests for travel
    - Focus lands on `PlaceHeading` after arrival on both paths; reduced-motion crossfades without stagger; any key/click skips to the arrived state; return moves focus to the originating place link / map heading fallback
    - _Requirements: 13.3, 13.4, 13.5, 13.6, 13.7_

- [x] 11. Wire the turning-soon "Go to it" jump
  - [x] 11.1 Add the "Go to it" action to the map turning-soon notice
    - Render a keyboard-focusable "Go to it" action on the `TurningSoon` notice only while a turning-soon ghost exists; on activation (click/Enter/Space) compute `ordered = orderForPlace("sky", skyRows)`, `plots = paginate(ordered, PLOT_SIZE)`, `plotIndex = plots.findIndex(plot => plot.some(r => r.name === name))`, then set `view="sky"`, `selected=name`, that `plotIndex`, `activeFilter="all"`, and perform the same client-only `pushState` + travel as a normal place entry
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - [x] 11.2 Write integration test for "Go to it"
    - Activation opens `sky` with the turning-soon ghost selected, on the plot containing it, with the filter cleared to all; no action rendered when no turning-soon ghost exists
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 12. Extend lights-on register for map and place
  - [x] 12.1 Add a sortable Place column to `LightsOnTable` and preserve/restore view state
    - Add a Place column to `LightsOnTable` whose value is `PLACES[placeOf(row)].name`, sortable alongside the existing Repository / State / Quiet-for / Decay columns, fed the full `rows`; keep it presentational/server-renderable
    - In `SceneView`, render `LightsOnTable` (full `rows`) whenever `lightsOn` is true from either the map or a place; keep `view`/`plotIndex`/`activeFilter`/`selected` independent of `lightsOn` so toggling off restores the exact prior view with no travel (instant swap)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_
  - [x] 12.2 Write tests for the lights-on Place column and restore
    - Table has one row per repository across all four places with a sortable Place column from `placeOf`; toggling lights on then off restores view/plotIndex/filter/selection without running travel
    - _Requirements: 14.2, 14.4, 14.5, 14.6_

- [x] 13. Fix header, summary, and footer chrome
  - [x] 13.1 Update `Header`, `SummaryLine`, and `Footer`
    - `Header`: blackletter wordmark (keep `font-wordmark`), username in a bordered Cinzel badge/pill (uppercase, letter-spaced) replacing the plain muted span, summary line in letter-spaced Cinzel, styled bordered toggles for Lights-on and Sound
    - `SummaryLine`: use the exported pluralization helper from task 5.1 so count 1 renders the singular noun, count ≥ 2 and count 0 render the plural noun, per segment
    - `Footer`: legend presents the five lifecycle states grouped under their four places
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_
  - [x] 13.2 Write component tests for chrome fixes
    - Username badge, letter-spaced Cinzel summary, styled toggles present; summary singular at 1, plural at 0 and ≥ 2; footer legend groups the five states under the four places
    - _Requirements: 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

- [x] 14. Integration - replace the single-scene rendering with map/place views
  - [x] 14.1 Switch `SceneView` to render `EstateMap` / `PlaceView` / `LightsOnTable` by state
    - Replace the single `Scene` render path: when `lightsOn` render the register, else when `view==="map"` render `EstateMap`, else render `PlaceView` for the current place; thread all handlers (`onEnterPlace`, `onReturn`, filter/plot/select, turning-soon "Go to it") and the `TravelTransition`; ensure the three route pages (`/g/[username]`, `/g/[username]/[repo]`, `/estate`) drive the map/place model end to end with the deep-link precedence from task 7
    - After the switch, remove the scene components no longer rendered (e.g. `components/scene/Zone.tsx`, `components/scene/MoreGroup.tsx`, plus any others made unreachable by the switch — plots replace the zone cap / "+N more", _Requirement 5.5_) and delete the tests that ONLY covered those removed components; explicitly KEEP the pure functions in `lib/scene-view.ts` and their property tests (`capZone` and the other exported pure helpers may remain exported and tested even if no component uses them) — do not remove any pure function or its property test
    - _Requirements: 1.1, 10.1, 10.2, 11.1, 14.1, 5.5_
  - [x] 14.2 Write end-to-end integration tests for the wired routes
    - `/g/[username]` shows the map; `?at=` opens the place; `/g/[username]/[repo]` opens the containing place with the creature selected (unless `?at=` overrides); `/estate` behaves identically for the bundled estate; lights-on reachable from map and place
    - _Requirements: 1.1, 10.1, 10.2, 11.1, 14.1_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tests are a required deliverable for this project: every test task (property tests, unit tests, integration tests, component tests) must be completed and is not optional.
- Each task references specific requirement sub-clauses for traceability; the four pure functions each cite their correctness property (Property 1 → R3, Property 2 → R6, Property 3 → R7, Property 4 → R4).
- Property tests use the repo's existing `fast-check` and are placed immediately after the code they validate so errors surface early.
- `lib/lifecycle.ts` is frozen and modified by no task; all new logic is a pure view-model over `GraveyardRow`s plus presentational components.
- Checkpoints (tasks 6 and 15) ensure incremental validation at natural breaks.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "5.2", "5.3", "7.1"] },
    { "id": 3, "tasks": ["7.2", "7.3"] },
    { "id": 4, "tasks": ["7.4", "8.1", "9.1", "12.1", "13.1"] },
    { "id": 5, "tasks": ["7.5", "8.2", "9.2", "10.1", "12.2", "13.2"] },
    { "id": 6, "tasks": ["10.2", "11.1"] },
    { "id": 7, "tasks": ["11.2", "14.1"] },
    { "id": 8, "tasks": ["14.2"] }
  ]
}
```
