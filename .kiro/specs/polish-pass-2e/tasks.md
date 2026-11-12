# Implementation Plan: Polish Pass 2e

## Overview

Six independent fixes, ordered so each can run alone with no file conflicts: lint, titles, compact centring, whisper lane, Moon art, then first paint. Tasks 3 and 4 both touch `lib/estate-view.ts`, and tasks 5 and 6 both touch `app/globals.css`, so they run strictly one after another. All tests are required.

Rules for every task:
- Edit only through file tools (no shell-based edits).
- Run only that task's own test files with `npx vitest --run <file>`.
- Never delete or weaken an existing test. If a frozen test conflicts with a change, stop and report it.
- Do not run `next build`.

## Tasks

- [x] 1. Clean lint warnings
  - [x] 1.1 Remove the unused imports and parameter
    - In `components/detail/HoverCardProvider.tsx`, remove `useCallback` from the React import after confirming nothing else uses it
    - In `tests/dom/SceneLayoutPreservation.test.tsx`, change `renderSky(count, handlers = {})` to `renderSky(count)`; confirm no call passes a second argument and leave every assertion unchanged
    - Edit via file tools only; do not run `next build`
    - _Requirements: 6.1, 6.2_

  - [x] 1.2 Verify lint and the touched test
    - Run `npx eslint components/detail/HoverCardProvider.tsx tests/dom/SceneLayoutPreservation.test.tsx` and confirm zero warnings and zero errors
    - Run only `npx vitest --run tests/dom/SceneLayoutPreservation.test.tsx`
    - Never delete or weaken tests
    - _Requirements: 6.3_

- [x] 2. Single-brand page titles
  - [x] 2.1 Use absolute titles and add the resolver helper
    - Add pure `resolveTitle(title, template)` to `lib/site-meta.ts` (absolute wins; a string is wrapped in the template; a default object has no template)
    - Change `app/estate/page.tsx` and `app/g/[username]/[repo]/page.tsx` to `title: { absolute: ... }` with the same wording
    - Edit via file tools only; do not run `next build`
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Extend metadata tests
    - Add new cases to `tests/dom/metadata.test.ts` for the absolute estate and repo titles; keep existing cases unchanged (if one asserts the string form of the repo title, add a new case and report the conflict)
    - Run only `npx vitest --run tests/dom/metadata.test.ts`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 Write property test for the single brand
    - Create `tests/property/titles.property.test.ts`, at least 100 runs, tagged `Feature: polish-pass-2e, Property 1: Brand appears once in every resolved title`
    - **Property 1: Brand appears once in every resolved title**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - Run only `npx vitest --run tests/property/titles.property.test.ts`

- [x] 3. Centre sparse compact rows
  - [x] 3.1 Centre the single row in `compactStackLayout`
    - In `lib/estate-view.ts`, in the `rows === 1` branch, set `feet[0]` so the row extent `[feet - max(tall, up), feet + max(0, down)]` has its midpoint at `(top + bottom) / 2`, then clamp into `[top + max(tall, up), bottom - max(0, down)]`
    - Leave the `rows > 1` path and the `n === 0` early return unchanged
    - Edit via file tools only; do not run `next build`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 3.2 Write property tests for compact centring
    - Create `tests/property/compact-centre.property.test.ts`, at least 100 runs per property, tagged `Feature: polish-pass-2e`
    - **Property 3: A single compact row is vertically centred**
    - **Property 4: Multi-row layouts are unchanged** (keep a reference copy of the old implementation inside the test)
    - **Property 5: Compact layout is total** (include non-finite numbers and the empty list)
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Run only `npx vitest --run tests/property/compact-centre.property.test.ts`

  - [x] 3.3 Extend existing compact layout tests and check regressions
    - Add a new describe block (single row centred, zero creatures returns empty) to the existing compact layout test file; do not edit existing cases
    - Run only that file, `tests/dom/CompactPlaceView.test.tsx`, and the estate-view property file
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Whisper clears place cards
  - [x] 4.1 Add whisper lane helpers
    - Read the header and legend components used by `Scene`/`EstateMap` for their real sizes
    - In `lib/estate-view.ts`, add `ChromeRect`, `rectsIntersect`, `estateChromeRects(vw, vh)` (four place cards from `PLACE_POSITIONS` plus a card-size constant, header, legend), `whisperLane(vw, vh)` and exported `WHISPER_BOTTOM_PCT`
    - Place the lane in the bottom strip below the lowest place card with a gap; fall back to the gap between the sky card and the upper band if vh is too small; coerce non-finite values with `finiteOrZero`
    - Edit via file tools only; do not run `next build`
    - _Requirements: 3.1, 3.2_

  - [x] 4.2 Wire the lane into `EstateMap`
    - In `components/scene/EstateMap.tsx`, replace the literal `bottom-[16%]` with `WHISPER_BOTTOM_PCT` and keep `data-testid="scene-whisper"`
    - Run only the existing EstateMap tests that cover this file
    - _Requirements: 3.1, 3.2_

  - [x] 4.3 Write whisper lane unit and property tests
    - Create `tests/unit/whisper-lane.test.ts`: at widths 768, 800, 1024, 1280 and 1440 with heights 700 to 1000, the lane intersects no place card, header or legend
    - Add a property test (width 768 to 1440, height 600 to 1200, at least 100 runs), tagged `Feature: polish-pass-2e, Property 2: Whisper never intersects chrome`
    - **Property 2: Whisper never intersects chrome**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Run only these two new files

- [x] 5. Painted moon art
  - [x] 5.1 Render the Moon_Image with a Drawn_Moon fallback
    - Grep `tests/` for `Moon` and run those existing tests first; they must stay green unchanged
    - In `components/scene/Moon.tsx`, add `"use client"`, render `next/image` of `/art/moon.webp` (`fill`, `alt=""`, `sizes` from the diameter) over the glow; keep wrapper, positioning, `boxShadow` glow, `placement`, `fillParent`, `glowScale` and reduced-motion behaviour
    - Add `imageFailed` state flipped by `onError`; when true render the existing crater disc; drop the solid wrapper `backgroundColor` while the image shows
    - Apply the blood-red treatment through a `.moon-blood` class in `app/globals.css` built from tokens (check for an existing `bloodmoon-100` token; add only if missing) when `moonTreatment(rows) === "blood-red"`, and keep `--color-moon-blood` for the Drawn_Moon
    - Expose `data-moon-source="image" | "drawn"` and `data-moon-treatment` on the wrapper
    - Edit via file tools only; do not run `next build`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.2 Write Moon art DOM tests
    - Create `tests/dom/MoonArt.test.tsx`: image rendered for default, `placement` and `fillParent` modes; `error` event switches to `drawn`; glow `boxShadow` matches the old value; blood-red rows set the treatment for both sources
    - **Property 6: Bloodmoon treatment follows moonTreatment** (fast-check over row lists, at least 100 runs, tagged `Feature: polish-pass-2e, Property 6`)
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - Run only `npx vitest --run tests/dom/MoonArt.test.tsx` plus the existing Moon-related files

- [x] 6. Instant night sky on first load
  - [x] 6.1 Add the gradient layer and `FadeArt`
    - Grep `tests/` for `Backdrop` and `bg-far`. If a frozen test asserts the CSS `backgroundImage` url, keep that CSS background and use `ReactDOM.preload("/art/bg-far.webp", { as: "image", fetchPriority: "high", imageSizes: "106vw" })` instead of `next/image`
    - Add a token-based gradient utility to `app/globals.css` (night-sky top to bruised crimson horizon, moon glow radial, faint fog band)
    - Create `components/scene/FadeArt.tsx` (props `src`, `sizes`, `priority?`, `className?`, `style?`): `next/image` with `fill`, `alt=""`, opacity 0 until `onLoad`, then 1 over 700 ms; no transition under `prefers-reduced-motion`; `onError` leaves the gradient visible
    - In `components/scene/Backdrop.tsx`, render the gradient as the first child and use `FadeArt` for `bg-far` with `priority` and `sizes="106vw"`; keep `layer-*` and `layer-idle-drift` classes
    - Edit via file tools only; do not run `next build`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 6.2 Write first-paint DOM tests
    - Create `tests/dom/BackdropFirstPaint.test.tsx`: gradient layer present in the initial markup; image opacity 0 until the `load` event then 1; no transition under a mocked reduced-motion query; `priority` and `sizes` on the bg-far image (or the preload call in the fallback case)
    - Run only `npx vitest --run tests/dom/BackdropFirstPaint.test.tsx` plus any existing Backdrop tests
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 6.3 Re-encode the fog image or report the limitation
    - Check whether `sharp` resolves from `node_modules`; do not install packages
    - If yes, use a one-off script to re-encode `public/art/fog-wisps.webp` at lower quality until it is under 300 KB, keeping dimensions, then delete the script
    - If not, leave the file unchanged and report the limitation in the task result
    - If re-encoded, add an `fs.statSync` size check to `tests/dom/BackdropFirstPaint.test.tsx` and run only that file
    - _Requirements: 1.5, 1.6_

- [x] 7. Final checkpoint - Run the full suite once
  - Run `npx vitest --run` (full suite), `npx tsc --noEmit` and `npm run lint` once each
  - Fix any failure without deleting or weakening tests; do not run `next build`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Every test task is required; none are optional.
- Per-task runs use only that task's own test files; the full suite runs only in task 7.
- Tasks run strictly one wave at a time because tasks 3 and 4 share `lib/estate-view.ts` and tasks 5 and 6 share `app/globals.css`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["2.3"] },
    { "id": 5, "tasks": ["3.1"] },
    { "id": 6, "tasks": ["3.2"] },
    { "id": 7, "tasks": ["3.3"] },
    { "id": 8, "tasks": ["4.1"] },
    { "id": 9, "tasks": ["4.2"] },
    { "id": 10, "tasks": ["4.3"] },
    { "id": 11, "tasks": ["5.1"] },
    { "id": 12, "tasks": ["5.2"] },
    { "id": 13, "tasks": ["6.1"] },
    { "id": 14, "tasks": ["6.2"] },
    { "id": 15, "tasks": ["6.3"] }
  ]
}
```
