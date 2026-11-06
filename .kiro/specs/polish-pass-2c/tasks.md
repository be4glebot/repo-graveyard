# Implementation Plan: 2C Polish Pass

## Overview

This plan turns the 2C Polish Pass design into incremental coding steps over the existing Next.js 16 / React 19 / TypeScript / Tailwind v4 / Framer Motion estate map. Pure view-model logic (`scatterLayout`, `coverRect`, layout constants) lands first with its property tests, then the presentational components that consume it (`Plaque`, restyled chips/buttons, `useParallax`, `LanternCursor`, `PlaceBackground` + `Moon`, two-site `Fog`, `DepthScatter`), then integration into `PlaceView`/`EstateMap`/`SceneView` and `TravelTransition`, and finally a full verification pass.

Hard constraints shaping every task:

- **Tests are required, not optional** (Req 8.1). No test sub-task is marked with `*` in this plan. Every in-scope requirement ends with automated coverage.
- **Preservation** (Req 8.2/8.3): no existing component or test is deleted. `DepthRows.tsx` is retained but no longer rendered by `PlaceView`.
- **Frozen fog contract** (Req 6.4/6.7/8.4): `fogDensity` in `lib/scene-view.ts` is reused unchanged and never duplicated; the `scene-fog` testid and its null-iff-0-zombies behavior stay. Existing fog tests must keep passing.

Implementation language: **TypeScript / React** (per the design; no pseudocode used).

## Tasks

- [x] 1. Pure layout logic and constants in `lib/estate-view.ts`
  - [x] 1.1 Add layout constants and the `PAINTED_MOON` / `PARALLAX_MAX_*` values
    - In `lib/estate-view.ts` export `SCATTER_SCALE_MIN = 0.7`, `SCATTER_SCALE_MAX = 1.15`, `TOMBSTONE_TILT_DEG = 6`, `PLAQUE_W` and `PLAQUE_H` (px at scale 1; `PLAQUE_W` is the single source of truth for both the Plaque fixed max width and the no-overlap rectangle width), `MOBILE_BREAKPOINT = 768`, `PAINTED_MOON = { fx: 0.75, fy: 0.14, diamFrac: 0.065 }`, and `PARALLAX_MAX_BG = 8` / `PARALLAX_MAX_CREATURES = 16` / `PARALLAX_MAX_NEAR_FOG = 26`
    - Keep `PLOT_SIZE = 12` and `DEPTH_ROWS = 3` unchanged
    - _Requirements: 2.5, 4.7, 4.8, 5.5, 5.9, 5.10, 7.4_

  - [x] 1.2 Implement `coverRect` pure cover-math helper
    - Add `CoverInput` / `CoverRect` interfaces and `coverRect(input): CoverRect` to `lib/estate-view.ts`
    - Standard cover fit: `scale = max(viewW/imageW, viewH/imageH)`, centered offsets, `cx`/`cy`/`diameter` in the element's coordinate space; guard zero/negative dimensions with a centered default so no `NaN`/`Infinity`
    - _Requirements: 4.7, 4.8_

  - [x] 1.3 Implement `scatterLayout` with `xmur3`/`mulberry32` and tombstone tilt
    - Add `ScatterPlacement` interface and `scatterLayout(names, rows, seed): ScatterPlacement[]` to `lib/estate-view.ts`
    - Inline pure `xmur3` and `mulberry32` (no RNG library, no `Math.random`); seed each name stream via `xmur3(seed + "|" + name)`
    - One record per name in input order (no add/omit/dup); empty `names` → `[]`; assign each name to one of `rows` depth bands with disjoint `scale` sub-ranges in [0.7,1.15] and disjoint `brightness` sub-ranges so front > middle > back strictly for both; mark exactly `round(n/3)` records `mirrored` deterministically; derive a per-name `tilt` in [-6,6] deg for ground tombstones; choose `x`/`y` from per-row jittered slots whose pitch (from `PLAQUE_W`/`PLAQUE_H`) guarantees no plaque-rectangle overlap at 1440 and 1280 px
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 1.4 Write property tests for `coverRect` and `scatterLayout` determinism/shape
    - Append to `tests/property/estate-view.property.test.ts` using `fast-check` (≥100 runs), tagged `Feature: polish-pass-2c`
    - **Property 1: Determinism of placement** — tagged `Property 1: Determinism of placement`; two calls with equal inputs are field-by-field and order equal; empty `names` → `[]`; exactly one record per name in order; strict cross-row `scale`/`brightness` ordering; `mirrored` count equals `round(n/3)`
    - Plus a `coverRect` cover-math property (image cover-scaled center maps to viewport center; diameter scales linearly with image width)
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 4.7, 4.8**
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 4.7, 4.8, 8.1_

  - [x] 1.5 Write property test for no plaque overlap at 1440 and 1280
    - Append to `tests/property/estate-view.property.test.ts`, tagged `Feature: polish-pass-2c, Property 2: No plaque overlap`
    - **Property 2: No plaque overlap** — for `names` length 1–12 and any `seed`, compute each plaque rectangle (`PLAQUE_W × PLAQUE_H × scale` at the record's on-screen `x`/`y`) at widths `fc.constantFrom(1440, 1280)` and assert no axis-aligned rectangle pair intersects
    - **Validates: Requirements 5.9**
    - _Requirements: 5.9, 8.1_

- [x] 2. Theme tokens, UI-polish classes, and polish keyframes in `app/globals.css`
  - [x] 2.1 Add `@theme` tokens and `.btn2` / `.chip2` / `.chip2.on` / `.plq` classes
    - Add night-cover / iron / plaque / chip-on token families (e.g. `--color-night-cover`, `--color-iron-*`, `--color-plaque-bg-top/bottom`, `--color-plaque-border`, `--color-chip-bg-top/bottom`, `--color-chip-on-*`) derived from the boards' gradients; no hardcoded hex in components
    - Add `.btn2` (bevelled iron, Cinzel uppercase), `.chip2` (inactive plaque), `.chip2.on` (crimson active), `.plq` (one Cinzel name line + one mono sub-line) classes bound to those tokens
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 2.2 Add parallax / fog / flicker keyframes (transform & opacity only)
    - Add fog drift keyframes animating `transform: translateX(0 → -50%)` and `translateX(0 → 50%)` on a double-width strip (never `background-position`), a lantern flicker keyframe varying `opacity`/brightness by ≤±10% at a 125–500ms loop, and any parallax idle-drift keyframe; all gated to pause under `prefers-reduced-motion: reduce`
    - _Requirements: 9.1, 9.2, 3.3, 6.5, 6.6_

- [x] 3. `Plaque` component and restyled chips/buttons
  - [x] 3.1 Create `components/ui/Plaque.tsx`
    - `PlaqueProps { name, sub, scale? }`; render `.plq` with exactly one Cinzel name line and one mono sub-line; fixed max width equal to `PLAQUE_W` with `text-overflow: ellipsis` + `overflow: hidden` + `white-space: nowrap` on the name line; expose the full name via both `title` and `aria-label`; never mirrored
    - _Requirements: 7.4, 5.11_

  - [x] 3.2 Restyle `FilterChips`, `ReturnToGate`, and `Pager`
    - Apply `.chip2` to inactive chips and `.chip2.on` to the active filter in `components/scene/FilterChips.tsx` (active visually distinct, crimson); apply `.btn2` to `ReturnToGate` and `Pager` buttons
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.3 Write `tests/dom/UiPolish.test.tsx`
    - Assert chips carry `.chip2` (inactive) / `.chip2.on` (active, visually distinct); iron buttons carry `.btn2`; the plaque has exactly one Cinzel name line and one mono sub-line, a fixed max width, ellipsized long names, and the full name in `title` + `aria-label`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1_

- [x] 4. `useParallax` hook and its DOM test
  - [x] 4.1 Create `components/scene/useParallax.ts`
    - `useParallax(rootRef, { reducedMotion })`: attach a `pointermove` listener gated by `matchMedia("(hover: hover) and (pointer: fine)")`; coalesce moves into one `requestAnimationFrame` tick; the tick reads `getBoundingClientRect()`, normalizes/clamps the pointer to [-1,1] per axis, and writes `--px`/`--py` via `style.setProperty` with no `setState`; when `reducedMotion` is active or the media query does not match, do not attach the listener or schedule a frame and leave `--px`/`--py` unchanged; guard `window`/`matchMedia`/`requestAnimationFrame` for SSR; clean up listener and cancel pending frame on unmount
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.2 Write `tests/dom/Parallax.test.tsx`
    - **Property 4: Parallax disabled under reduced motion; enabled otherwise** (DOM test per design, not PBT) — render a Scene_Root, dispatch `pointermove`, advance one faked rAF: with `reducedMotion={true}` assert `--px`/`--py` unchanged and rAF not called; with `reducedMotion={false}` (fine+hover) assert `--px`/`--py` parse as finite numbers in [-1,1]; assert each band's max offset matches the pinned maxima (bg ≈8, creatures ≈16, near fog ≈26)
    - **Validates: Requirements 2.6, 2.8**
    - _Requirements: 2.3, 2.5, 2.6, 2.7, 2.8, 8.1_

- [x] 5. `LanternCursor` overlay and its DOM test
  - [x] 5.1 Create `components/scene/LanternCursor.tsx`
    - `LanternCursorProps { lightsOn, reducedMotion }`; render in the lantern band (z 35, below chrome) with `pointer-events: none`; when `lightsOn` render `null`; choose lantern vs static vignette via `matchMedia("(hover: hover) and (pointer: fine)")`; lantern is a full-cover plain `radial-gradient` driven by imperatively-written `--lx`/`--ly` (transparent warm centre ~300px ±30px → ~`rgba(0,0,0,0.5)` outside for ~45–55% dim, no `mix-blend-mode`); `pointermove` updates `--lx`/`--ly` within a frame via the same rAF strategy; `pointerleave` eases `--lx`/`--ly` back to 50%/50% via CSS transition; `focusin` moves the centre to the focused creature's bounding-box centre; flicker keyframe applied only when `reducedMotion` is inactive; coarse/no-hover renders a static soft vignette; guard SSR/no-`matchMedia`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 7.5_

  - [x] 5.2 Write `tests/dom/LanternCursor.test.tsx`
    - Assert: lights-off + fine/hover renders the overlay (z 35, below chrome) with `pointer-events: none` and a plain radial-gradient (no `mix-blend-mode`); lights-on renders nothing; coarse/no-hover renders the static vignette; `focusin` moves the light centre; `pointerleave` eases `--lx`/`--ly` back to 50%/50%
    - _Requirements: 3.2, 3.4, 3.6, 3.7, 3.8, 8.1_

- [x] 6. `PlaceBackground` + Sky `Moon` placement and DOM tests
  - [x] 6.1 Create `components/scene/PlaceBackground.tsx`
    - `PlaceBackgroundProps { place }`; full-cover painted image per place with exact brightness (sky 0.8, gate 0.85, ground 0.55, crypt 0.7) via `filter: brightness()`; `inset: -3%` bleed (the element the background parallax transform moves; bleed > `PARALLAX_MAX_BG` 8px); top and bottom dark gradients each ≥15% viewport height from `--color-night-cover` tokens; always render a solid `--color-night-sky` fallback fill so an image load error still shows creatures/header; `pointer-events: none`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.5, 9.1_

  - [x] 6.2 Nest the Sky `Moon` inside `PlaceBackground` using `coverRect`
    - Measure the `PlaceBackground` element's own box (including the -3% bleed) with a `ResizeObserver` (re-measure on resize); feed `viewW`/`viewH` + `PAINTED_MOON` to `coverRect`; on the sky place render `Moon` as a child of the same element (Background band z 0, `--d: 0.15`) so it shares the painting's transform
    - _Requirements: 4.7, 4.8, 4.9, 2.5_

  - [x] 6.3 Change `Moon` to accept an optional `coverRect` placement
    - Add `placement?: { cx, cy, diameter }` to `MoonProps`; when provided (sky place) position the disc at `cx/cy` sized to `diameter` instead of the fixed `right-[24%] top-[8%]`; keep health-encoding fill distinct from the painted moon; unchanged placement on the map
    - _Requirements: 4.7, 4.8, 4.9_

  - [x] 6.4 Write `tests/dom/PlaceBackground.test.tsx`
    - Assert each place renders its image with the correct brightness filter, ≥15%-height top/bottom gradients, `pointer-events: none`, and that the solid fallback fill remains on image `onError` with creatures/header still rendering
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1_

- [x] 7. Two-site `Fog` and its tests (frozen density contract)
  - [x] 7.1 Extend `components/scene/Fog.tsx` to a `layer` prop with two render sites
    - Add `FogProps { zombieCount, layer: "dense" | "thin", reducedMotion? }`; derive opacity only from the existing `fogDensity(zombieCount)` (no second density fn); `layer="dense"` keeps the existing `scene-fog` root (same `data-testid`, `data-fog-density`, null-iff-0-zombies early-out), opacity = `Fog_Opacity`, `fog-wisps`, ~90s one direction; `layer="thin"` is a separate sibling `data-testid="scene-fog-near"`, also null iff 0 zombies, opacity = `Fog_Opacity * 0.25`, `fog-wisps-thin`, ~55s opposite direction; drift via `translateX` on a double-width strip (never `background-position`); `reducedMotion` pauses both at a fixed offset; both `pointer-events: none`
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.5, 9.1, 9.2_

  - [x] 7.2 Write fog-opacity property test (Property 3)
    - Append a **new** describe block to `tests/property/scene-view.property.test.ts` (leave the existing Property 5 `fogDensity` block untouched), tagged `Feature: polish-pass-2c, Property 3: Fog opacity encodes zombie count`, `fc.nat({ max: 10000 })`, ≥100 runs
    - **Property 3: Fog opacity encodes zombie count** — `Fog_Opacity(n) == 0` iff `n == 0`, `> 0` when `n > 0`, non-decreasing, bounded [0,1]; the ×0.25 thin derivative is 0 iff `n == 0`; both built on the frozen `fogDensity`
    - **Validates: Requirements 6.4**
    - _Requirements: 6.4, 8.1_

  - [x] 7.3 Write `tests/dom/Fog.test.tsx`
    - Assert `scene-fog` (dense, far band below creatures) and `scene-fog-near` (thin, near band above creatures / below plaques) both present iff zombies > 0 and carry the Dense/×0.25 Thin opacities from the same `fogDensity` call; both drift via `translateX` not `background-position`; both pause under reduced motion
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 8.1_

- [x] 8. `DepthScatter` renderer and its DOM tests
  - [x] 8.1 Create `components/scene/DepthScatter.tsx`
    - `DepthScatterProps { place, plot, selectedName, onSelect, filterHeroes?, reducedMotion }`; memoize `scatterLayout(plot.map(r => r.name), DEPTH_ROWS, place)`; creatures layer (z 20) absolutely positioned at `x`/`y`, scaled by `scale`, brightness-filtered, `scaleX(-1)` on the creature image only when `mirrored`; ground tombstones get the seeded `tilt`; a single plaque layer (z 30, above creatures and near fog) with one `Plaque` per creature at the same `x`, never mirrored
    - _Requirements: 5.1, 5.8, 5.11_

  - [x] 8.2 Add width branch and gate fresh-zombie wander to `DepthScatter`
    - Read container width via `ResizeObserver` / container query: ≥768px uses the scatter positions, <768px uses a two-column staggered layout (column/row pitch guaranteeing no plaque overlap); for `place === "gate"` with `reducedMotion` inactive, fresh (decay 0) zombies get a `translateX`-only horizontal wander 8–24px around `x` with seeded duration 7–12s and seeded delay; decay 1–4 keep their existing lurch/twitch; with `reducedMotion` active fresh zombies render at `x` with no wander
    - _Requirements: 5.9, 5.10, 5.12, 5.13, 5.14, 9.1_

  - [x] 8.3 Write `tests/dom/DepthScatter.test.tsx`
    - Assert: one plaque per creature; the plaque layer is a single layer (z 30) above every creature and above the near fog; plaques fixed max width + ellipsize + full name in `title`/`aria-label`; a mirrored creature flips only the creature image, not the plaque text; below 768px uses two-column layout; ground tombstones carry a tilt; gate fresh zombies get wander and decay 1–4 do not; reduced motion drops the wander
    - _Requirements: 5.8, 5.10, 5.11, 5.12, 5.13, 5.14, 8.1_

  - [x] 8.4 Checkpoint: run the suite before integration
    - Run `npm run test` and fix any failures in the newly built pure logic/components from groups 1–8 before starting integration; confirm the pre-existing suite still passes so integration begins from a green baseline
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 8.1, 8.4_

- [x] 9. Integration into `PlaceView`, `EstateMap`, `SceneView`, and `TravelTransition`
  - [x] 9.0 Implement the Requirement 1 layout fixes (scroll + place fit + header)
    - Find and REMOVE any `h-screen` / `overflow-hidden` lock on the `SceneView`, `EstateMap`, and `PlaceView` root elements that prevents scrolling; replace with `min-h-dvh` and allow vertical scrolling so nothing is clipped
    - Reposition the four estate-map places so all four fit within 1440×900 AND 1280×720 WITHOUT scrolling (they currently render at y≈843–1163, which overflows); adjust the `PLACE_POSITIONS` percentages in `EstateMap.tsx` accordingly
    - Make the header controls wrap or condense below 900px viewport height so they never overlap scene content at any width ≥360px
    - On viewport width <768px, stack the map places vertically (a single-column vertical flow) instead of the absolute board arrangement
    - Task 9.4 then VERIFIES this structurally (no `overflow: hidden` ancestors on places/controls, header stays in its own box, controls reachable)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 9.1 Wire `PlaceView` to the new polish layers
    - Add `data-scene-root` + root `ref` and call `useParallax(rootRef, { reducedMotion })`; render `PlaceBackground place={place}` in the z-0 Background band (Sky `Moon` nested inside for sky); mount `Fog layer="dense"` (z 10, below creatures) and `Fog layer="thin"` (z 25, above creatures) for gate and hallowed ground, none for sky/crypt; swap `<DepthRows>` for `<DepthScatter place={place} ... reducedMotion={reducedMotion}>` (do not delete `DepthRows.tsx`); render `LanternCursor` in the z-35 band below chrome; thread `lightsOn`/`reducedMotion` from `SceneView`
    - Apply parallax transforms per band using the pinned maxima from the design: the background (and the Sky `Moon` nested inside it) gets `translate3d(calc(var(--px,0)*8px), calc(var(--py,0)*8px), 0)`; far fog, creatures, and plaques get `translate3d(calc(var(--px,0)*16px), calc(var(--py,0)*16px), 0)`; near fog gets `translate3d(calc(var(--px,0)*26px), calc(var(--py,0)*26px), 0)`; chrome and the lantern get NO parallax transform
    - _Requirements: 2.1, 2.5, 3.1, 3.7, 4.1, 4.2, 4.3, 4.4, 4.9, 5.1, 6.1, 8.2, 8.3_

  - [x] 9.2 Wire `EstateMap` to the new polish layers
    - Add `data-scene-root` + root `ref` and `useParallax(rootRef, { reducedMotion })`; mount estate-wide `Fog layer="dense"` + `Fog layer="thin"` for the estate zombie count; render `LanternCursor` below chrome; keep the reused `Sky`/`Backdrop`/map `Moon` stack
    - Apply the same parallax scheme using the pinned maxima: the reused backdrop/`Sky`/map-`Moon` stack gets `translate3d(calc(var(--px,0)*8px), calc(var(--py,0)*8px), 0)`; the place links and far fog get `translate3d(calc(var(--px,0)*16px), calc(var(--py,0)*16px), 0)`; near fog gets `translate3d(calc(var(--px,0)*26px), calc(var(--py,0)*26px), 0)`; chrome and the lantern get none
    - _Requirements: 2.1, 2.5, 3.1, 3.7, 6.1, 6.2, 6.3_

  - [x] 9.3 Thread `lightsOn`/`reducedMotion` from `SceneView` and preload in `TravelTransition`
    - Pass `SceneView`'s `lightsOn`/`reducedMotion` to `EstateMap`/`PlaceView` (and on to `LanternCursor`/`useParallax`/`Fog`/`DepthScatter`) without lifting new state; in `TravelTransition` preload the destination place's `PlaceBackground` image (`new Image()` in a start effect or a hidden priority `next/image`), leaving existing travel timing unchanged
    - _Requirements: 3.3, 3.5, 6.5, 6.6, 9.4_

  - [x] 9.4 Write layout-robustness and performance-budget DOM assertions
    - Add/extend DOM tests asserting every place and control is reachable/unclipped at 1440×900, 1280×720, and 390×844, Header controls stay within their box, chips/pager stay keyboard- and pointer-reachable below 1440px (Req 1); assert at most 12 animated creatures per view and that looping animations use only `transform`/`opacity` where testable (Req 9)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.1, 9.3, 8.1_

- [x] 10. Final verification and preservation checkpoint
  - [x] 10.1 Run the full suite, lint, and build; confirm preservation
    - Run `npm run test`, `npm run lint`, `npm run build`; confirm the full pre-existing suite still passes — especially the fog tests (`tests/dom/PlaceView.test.tsx`, `tests/dom/EstateMap.test.tsx` `scene-fog` presence/absence), `tests/property/scene-view.property.test.ts` Property 5 (`fogDensity`), `tests/dom/PointerEvents.test.tsx`, `tests/dom/TravelTransition.test.tsx`, and the existing `estate-view` property tests; confirm no existing component (incl. `DepthRows.tsx`) or test was deleted; fix any failures before completing
    - _Requirements: 6.7, 8.1, 8.2, 8.3, 8.4_

## Notes

- No test sub-task is marked optional: tests are a required deliverable for this pass (Req 8.1), so every test task above must be implemented.
- Each task references the specific requirement sub-clauses it satisfies for traceability, and property/DOM test tasks name the design property they validate.
- The frozen `fogDensity` contract (`lib/scene-view.ts`) is reused, never duplicated or changed; `Fog_Opacity` and its ×0.25 thin derivative both derive from the same call.
- `DepthRows.tsx` and all existing tests are preserved; `DepthRows` is simply no longer rendered by `PlaceView`.
- Mid-plan checkpoint 8.4 runs `npm run test` after the pure logic and standalone components (groups 1–8) are built and before integration (group 9) begins, so integration starts from a green baseline.
- Task 9.0 implements the Requirement 1 layout fixes (scroll + place fit + header) that task 9.4 verifies structurally.
- The per-band parallax maxima are pinned in 9.1/9.2: background 8px, creatures/plaques/far fog 16px, near fog 26px, chrome/lantern none.
- Checkpoint task 10 runs the full build/test/lint and confirms the pre-existing suite stays green.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.2"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.1", "3.2", "4.1", "7.1"] },
    { "id": 2, "tasks": ["1.4", "1.5", "3.3", "4.2", "5.1", "6.1", "6.3", "7.2", "7.3", "8.1"] },
    { "id": 3, "tasks": ["5.2", "6.2", "8.2"] },
    { "id": 4, "tasks": ["6.4", "8.3"] },
    { "id": 5, "tasks": ["8.4"] },
    { "id": 6, "tasks": ["9.0"] },
    { "id": 7, "tasks": ["9.1", "9.2"] },
    { "id": 8, "tasks": ["9.3"] },
    { "id": 9, "tasks": ["9.4", "10.1"] }
  ]
}
```
