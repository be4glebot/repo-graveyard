# Implementation Plan: Explorable Worlds

## Overview

Delivery follows the design's order. Step 0 adds a dev-only review harness and capture tools, then takes baseline screenshots of the original app (no feature code changes). Step 1 builds the foundation (pure libs with properties, world components, tokens, fixtures, dispatcher with the gate unchanged). Steps 2, 3 and 4 switch the Restless Sky, Hallowed Ground and the Crypt to worlds, one at a time. Step 5 adds the Effects_Table sync test, the source-scan tests, the full-suite run and the final sign-off.

Language: TypeScript (design uses TypeScript). Capture tools are Node ESM (`.mjs`) with built-ins only.

### Standing rules for every task

Every task repeats these in its own "Rules" line. Sub-agents execute one task each.

- Edit source with the file tools only. No PowerShell for editing source files.
- Do not run `next build`. Do not start a dev server from a task (the user starts `npm run dev` when a capture task needs it).
- Add no dependency. `package.json` and the lockfile stay unchanged.
- Never delete, skip or weaken a test. An existing assertion may change only where a task names it (Req 17.5) and records the reason in the task notes and in the commit-ready summary.
- A task runs only its own test files (`npx vitest --run <file>`). Checkpoints run the step's affected files plus the Req 17.4 files. The full suite, `tsc --noEmit` and `eslint` run only in the final checkpoint (task 18).
- Visual-verification tasks use real screenshots from `docs/design-review/tools/capture.mjs`. A step is not done until its review has no fail. Judgement comes from the stored screenshots, not from tests alone (Req 20.7).

## Tasks

- [x] 1. Step 0: Review harness and capture tools (no feature code)
  - [x] 1.1 Create `lib/review-cases.ts` and its unit test
    - Add `ReviewCase` (`ghosts-3`, `ghosts-12`, `tombstones-3`, `tombstones-12`, `coffins-3`, `coffins-12`, `empty`) and `buildReviewRows(case)` returning deterministic `GraveyardRow[]` with names and `daysQuiet` that span the decay levels
    - Add `tests/unit/review-cases.test.ts`: row counts, states, determinism, unique names, decay levels covered for the 12-case sets
    - _Requirements: 20.3, 20.1_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/review-cases.test.ts`.

  - [x] 1.2 Add the dev-only `/dev/review` harness
    - Create `app/dev/review/page.tsx` (calls `notFound()` when `process.env.NODE_ENV === "production"`; reads async `searchParams` `place`, `case`, `reduced`) and `components/dev/ReviewHarness.tsx` (client component rendering the existing `PlaceView` with the hover card provider and theme shell over `buildReviewRows`)
    - Renders the ORIGINAL `PlaceView`; do not edit any existing component
    - Add `tests/dom/ReviewHarness.test.tsx`: renders each place and case, empty case renders, unknown params fall back, production guard calls `notFound`
    - Check the Next 16 docs in `node_modules/next/dist/docs/` for async `searchParams` before writing
    - _Requirements: 20.1, 20.2, 17.1_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/ReviewHarness.test.tsx`.

  - [x] 1.3 Create the CDP client and page probes under `docs/design-review/tools/`
    - `cdp.mjs`: small command and event client over the global `WebSocket`, no npm packages
    - `page-probes.mjs`: seam probe (mean luminance of 4 rows above and below each `[data-blend-zone]` join as a share of full scale, limit 10 percent; edge check for the solid night-sky fallback) and geometry probe (tag, chrome and creature rectangles); export the pure luminance and difference helpers
    - Add `tests/unit/capture-tools.test.ts` covering the pure helpers (luminance mean, difference share, edge-row check on synthetic pixel arrays)
    - _Requirements: 20.1, 19.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/capture-tools.test.ts`.

  - [x] 1.4 Create `capture.mjs` and the review template
    - `capture.mjs`: find Chrome or Edge (`CHROME_PATH` or standard Windows paths), launch headless with a temporary profile, set viewports 1440x900, 1920x1080, 390x844 (mobile), 360x740 (mobile), optional reduced-motion emulation, set `scrollTop` for depth 0, 0.5, 1, capture travel frames at about 0, 1150 and 2200 ms, write files named `YYYY-MM-DD-<step>-<place>-<case>-<w>x<h>-d<d>.png` (baselines `YYYY-MM-DD-baseline-<place>-<case>-<w>x<h>.png`)
    - Target the dev server the user starts; never start one. If no browser is found, print the checked paths and exit non-zero
    - Export the pure filename builder behind a main-module guard; add its test to `tests/unit/capture-tools.test.ts` (append, do not replace existing cases)
    - `docs/design-review/tools/TEMPLATE-review.md`: header, statement that judgement was made from stored screenshots, side-by-side table, pass/fail rows for Req 18.1-18.12 and 19.1-19.11 plus the Req 20.5 extra checks, seam table, 3-Creature gap table, reduced-motion and travel notes, iteration log, verdict
    - _Requirements: 20.1, 20.3, 20.4, 20.5, 20.7_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/capture-tools.test.ts`.

- [x] 2. Checkpoint - Step 0 tools
  - Run only: `tests/unit/review-cases.test.ts`, `tests/dom/ReviewHarness.test.tsx`, `tests/unit/capture-tools.test.ts`, plus the Req 17.4 files listed in Notes
  - Confirm with `git status` that no file outside `lib/review-cases.ts`, `app/dev/`, `components/dev/`, `docs/design-review/tools/`, and the new tests changed
  - Ensure all tests pass, ask the user if questions arise.
  - Rules: no fixes by weakening tests; no `next build`; no new deps; no full suite, tsc or lint.

- [x] 3. Step 0: Baseline screenshots of the original
  - [x] 3.1 Capture Baseline_Screenshots
    - Ask the user to start `npm run dev` and wait for confirmation
    - Run `node docs/design-review/tools/capture.mjs` for the Hub (`/estate`), gate, sky, ground and crypt at all four viewports, scroll position 0, for the Review_Cases the original supports, saved as `docs/design-review/YYYY-MM-DD-baseline-<place>-<case>-<w>x<h>.png`
    - If the script cannot run, ask the user to capture the matrix by hand at the Review_Viewports and record their confirmation
    - Make no feature code change
    - _Requirements: 17.1, 20.1, 20.2_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files (capture only).

  - [x] 3.2 Verify the baseline set and write baseline notes
    - Add `tests/unit/baseline-manifest.test.ts` asserting every expected baseline filename exists, is a PNG, and follows the naming pattern
    - Write `docs/design-review/YYYY-MM-DD-baseline-notes.md` listing the files, tool used (or manual confirmation), and one line per place on what the original looks like
    - Confirm with `git status` that only docs, images and the new test changed
    - _Requirements: 17.1, 20.2_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/baseline-manifest.test.ts`.

- [x] 4. Step 1: Foundation, pure modules and properties
  - [x] 4.1 Export the shared hash helpers from `lib/estate-view.ts`
    - Export `xmur3`, `mulberry32` and `SCATTER_BRIGHTNESS_STEP` (0.18) with no behaviour change
    - Add `tests/unit/estate-view-exports.test.ts` asserting the exports exist, `scatterLayout` output for a fixed input is unchanged, and the brightness step equals the value `DEPTH_ROWS` uses
    - _Requirements: 7.3, 7.4, 17.8_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/estate-view-exports.test.ts` and `tests/dom/DepthScatter.test.tsx`.

  - [x] 4.2 Implement `lib/contrast.ts`
    - `parseHex` and `contrastRatio` (WCAG relative luminance), pure, no imports from react, next or server-only
    - _Requirements: 18.5, 17.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the tests in 4.3.

  - [x] 4.3 Write property test for contrast
    - **Property 14 (ratio part): Contrast ratio is a well-formed measure**
    - In `tests/property/contrast.property.test.ts`: ratio in [1, 21], symmetric, equals 1 for equal colours, at least 100 runs, tag comment `Feature: explorable-worlds, Property 14`
    - **Validates: Requirements 18.5, 17.11**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/contrast.property.test.ts`.

  - [x] 4.4 Implement `lib/world-layout.ts` part A
    - Types (`WorldPlace`, `WorldInput`, `Rect`, `WorldSlot`, `WorldFeature`, `Stratum`, `BlendZone`, `WorldLayout`), `WORLD_CONFIG`, `LAYOUT_MIN_VH` 700 and the 812 fallback, `worldLength`, column rules (desktop and compact), per-name look from `mulberry32(xmur3("world|" + place + "|" + name))` (band, scale, brightness, mirror, tilt), and `computeWorldLayout` for 0 and 1 names (single screen, one stratum, single creature centred in the middle 60 percent)
    - Pure: no clock, DOM, storage or randomness besides the seeded hash
    - _Requirements: 6.1, 6.2, 6.3, 6.11, 6.12, 6.15, 13.4, 16.8, 16.10, 17.8_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the property files named in 4.5 to 4.8 that already exist.

  - [x] 4.5 Write property test for World_Length monotonicity
    - **Property 1: World_Length never decreases as the Plot grows**
    - In `tests/property/world-layout-length.property.test.ts` with shared generators (`arbPlace`, `arbNames`, `arbViewport`); at least 100 runs
    - **Validates: Requirements 6.1, 17.9**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-length.property.test.ts`.

  - [x] 4.6 Write property test for one-screen worlds
    - **Property 2: Zero or one Creature gives exactly one screen**
    - Append to `tests/property/world-layout-length.property.test.ts`; at least 100 runs
    - **Validates: Requirements 3.10, 6.2, 6.3, 8.10, 9.11, 16.1**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-length.property.test.ts`.

  - [x] 4.7 Write property test for length ranges and caps
    - **Property 3: Small counts stay in 1.25 to 1.5 and large counts stay under the cap**
    - Append to `tests/property/world-layout-length.property.test.ts`; domain 360 <= W <= 1920, Vh >= 700; at least 100 runs
    - **Validates: Requirements 6.4, 6.7, 6.8, 7.2, 8.12, 9.3**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-length.property.test.ts`.

  - [x] 4.8 Write property test for compact columns
    - **Property 19: Compact column count follows the width rule**
    - Append to `tests/property/world-layout-length.property.test.ts`; at least 100 runs
    - **Validates: Requirements 13.4**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-length.property.test.ts`.

  - [x] 4.9 Implement `lib/world-layout.ts` part B (slots)
    - Small-count placement (slot 0 in the first screen, last slot below it), grid placement with zigzag offset and seeded jitter, body and plaque rectangles clamped to the side margins, `domOrder` sorted by `(cy, cx)`, urgency order fills the first screen
    - Handle NaN, negative and zero viewport sizes and empty-string names
    - _Requirements: 6.4, 6.5, 6.6, 6.9, 6.10, 7.10, 12.6, 16.9, 16.11, 16.12_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the existing `tests/property/world-layout-length.property.test.ts`.

  - [x] 4.10 Implement `lib/world-layout.ts` part C (ground path, crypt chambers, strata, features, blends)
    - Ground single-column path with alternating sides and centreline samples, crypt chambers of 4 in Plot order, strata partitioning `[0, heightPx]` with at most `1.0 Vh_eff` each, `0.15 Vh` Blend_Zones, rule-of-thirds focal per stratum, features (moon, cloud-bank, entry-gate, mausoleum, crypt-entry, stairs, far-wall)
    - _Requirements: 6.5, 7.1, 8.1, 8.2, 9.1, 9.12, 18.1, 19.6_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the existing `tests/property/world-layout-length.property.test.ts`.

  - [x] 4.11 Write property test for blank stretches
    - **Property 4: No long blank stretches**
    - In `tests/property/world-layout-placement.property.test.ts`; at least 100 runs
    - **Validates: Requirements 6.5**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-placement.property.test.ts`.

  - [x] 4.12 Write property test for placement coverage
    - **Property 5: Placement covers the first screen and the rest of the world**
    - Append to `tests/property/world-layout-placement.property.test.ts`; at least 100 runs
    - **Validates: Requirements 6.6, 7.2, 7.11, 8.11, 9.3, 16.8**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-placement.property.test.ts`.

  - [x] 4.13 Write property test for bounds and chrome clearance
    - **Property 6: Everything stays inside the world and clear of the chrome**
    - Append to `tests/property/world-layout-placement.property.test.ts`; widths 200 to 2600, heights 0 to 1800 including NaN and negative; at least 100 runs
    - **Validates: Requirements 3.3, 6.9, 11.4, 13.6, 16.9, 16.10, 16.11, 16.12**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-placement.property.test.ts`.

  - [x] 4.14 Write property test for plaque overlap
    - **Property 7: Plaque rectangles never overlap**
    - Append to `tests/property/world-layout-placement.property.test.ts`; at least 100 runs
    - **Validates: Requirements 6.10**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-placement.property.test.ts`.

  - [x] 4.15 Write property test for determinism and name-only looks
    - **Property 8: Layout is deterministic and each Creature's look depends only on its name**
    - In `tests/property/world-layout-structure.property.test.ts`; at least 100 runs
    - **Validates: Requirements 6.11, 6.12, 7.3, 7.4, 16.9**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-structure.property.test.ts`.

  - [x] 4.16 Write property test for strata and chambers
    - **Property 9: Strata and chambers partition the world correctly**
    - Append to `tests/property/world-layout-structure.property.test.ts`; at least 100 runs
    - **Validates: Requirements 7.1, 9.1, 9.12, 18.1, 19.6**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-structure.property.test.ts`.

  - [x] 4.17 Write property test for DOM order, urgency and the path
    - **Property 12: DOM order is visual order, urgency fills the first screen, the path descends**
    - Append to `tests/property/world-layout-structure.property.test.ts`; at least 100 runs
    - **Validates: Requirements 3.7, 7.10, 8.1, 8.2, 10.10, 12.6**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-layout-structure.property.test.ts`.

  - [x] 4.18 Implement `lib/world-motion.ts`
    - `BAND_RATES` (0.88, 0.94, 1, 1.06, 1.12), `GESTURE_TAP_MAX_PX` 8, `depthPosition`, `stratumAt`, `bandOffset` (pointer maxima 8, 16, 26; creature band pointer 0; all zero when reduced), `ambientBrightness` (1 at 0, at least 0.8 at 1), `scrollTargetFor`, `classifyGesture`
    - Pure, no DOM, clock or randomness
    - _Requirements: 5.1, 5.6, 5.8, 5.10, 9.4, 10.5, 17.8_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the property files named in 4.19 to 4.23 that already exist.

  - [x] 4.19 Write property test for depth position
    - **Property 10: Depth position is total and clamped**
    - In `tests/property/world-motion.property.test.ts`; NaN, infinite, negative and zero inputs included; at least 100 runs
    - **Validates: Requirements 5.10, 6.14, 17.9**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-motion.property.test.ts`.

  - [x] 4.20 Write property test for band offsets
    - **Property 11: Band offsets are ordered, additive and zero under reduced motion**
    - Append to `tests/property/world-motion.property.test.ts`; at least 100 runs
    - **Validates: Requirements 5.1, 5.6, 5.8, 7.5, 8.4, 8.5**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-motion.property.test.ts`.

  - [x] 4.21 Write property test for tap versus scroll
    - **Property 13: A gesture is a tap exactly when it moves 8 px or less**
    - Append to `tests/property/world-motion.property.test.ts`; at least 100 runs
    - **Validates: Requirements 4.3, 4.4, 13.8, 13.9**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-motion.property.test.ts`.

  - [x] 4.22 Write property test for crypt ambient brightness
    - **Property 16: Crypt ambient brightness never rises and never drops below 80 percent**
    - In `tests/property/world-motion-scroll.property.test.ts`; at least 100 runs
    - **Validates: Requirements 9.4**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-motion-scroll.property.test.ts`.

  - [x] 4.23 Write property test for scroll targets
    - **Property 17: Scrolling to a Creature puts it in the central 60 percent**
    - Append to `tests/property/world-motion-scroll.property.test.ts`; at least 100 runs
    - **Validates: Requirements 10.5, 10.6**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-motion-scroll.property.test.ts`.

  - [x] 4.24 Implement `lib/world-art.ts`
    - `PLATE_SIZE`, `WORLD_ART` (the Plate and Crop table of the design), `computeCrop`, `plateToStage`, `bleedPx`; the painted-moon lock reuses the existing `PAINTED_MOON` values
    - Pure, no DOM, no new image file
    - _Requirements: 7.6, 19.1, 19.2, 19.3, 19.5, 19.10_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the test in 4.25.

  - [x] 4.25 Write property test for crop geometry
    - **Property 15: Crop geometry is uniform, inside the plate, within the upscale limit, and covered by the bleed**
    - In `tests/property/world-art.property.test.ts`; at least 100 runs; includes the 1.75 upscale limit over every `WORLD_ART` stratum at 1920 px and the reduced 8 px overscan
    - **Validates: Requirements 7.6, 19.1, 19.2, 19.3, 19.10**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-art.property.test.ts`.

  - [x] 4.26 Implement `lib/world-light.ts`
    - `LIGHT_SOURCES` (one entry per place, token names only), `shadowFor(place, band)`, `rimFor(place, row)` (glow alpha follows recency)
    - Add `tests/unit/world-light.test.ts`: exactly one `(sx, sy)` per place, shadow opacity follows band brightness, rim glow differs for different `daysQuiet`, handles missing data
    - _Requirements: 18.6, 18.7, 18.12_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/world-light.test.ts`.

  - [x] 4.27 Implement `lib/world-effects.ts` and `docs/EFFECTS_TABLE.md`
    - `WORLD_EFFECTS` registry with the design's rows, `effectProps(id)` helper, `freshEarth(daysQuiet)` (uses the active threshold from `LIFECYCLE_CONFIG`, no magic number), `ghostLanternLevel(decayLevel)`
    - Write `docs/EFFECTS_TABLE.md` with the same rows as a markdown table
    - Add `tests/unit/world-effects.test.ts`: ambient count per place is 4 or fewer, ids unique, every row has kind and description
    - _Requirements: 15.6, 18.8, 18.9, 18.10_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/world-effects.test.ts`.

  - [x] 4.28 Write property test for data-derived details
    - **Property 18: Data-derived details are deterministic functions of real fields**
    - In `tests/property/world-effects.property.test.ts`; at least 100 runs
    - **Validates: Requirements 18.10**
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/world-effects.property.test.ts`.

- [x] 5. Step 1: Foundation, components, tokens and wiring
  - [x] 5.1 Add tokens and shared CSS to `app/globals.css`
    - `@theme` tokens: `--world-pad-top/bottom`, `--world-fixture-top`, `--world-mist-sky/ground/crypt` (0.18, 0.2, 0.15), `--light-<place>-sx|sy|rim|glow|shadow`, stone and brass families, `--text-tag|label|body`, `--world-creature-scroll-margin`, `--world-reveal-ms`, `--world-ambient-floor`
    - Classes: `fixture-rail|ledge|sign|marker`, `camera-drift`, `world-*` band classes, reveal and offscreen-pause rules (`transform` and `opacity` only), Hub cue classes (`place-cue-*`), `env-mist`, `env-mist-near`, and the reduced-motion block. Put all shared CSS here so later tasks in other waves do not edit this file
    - Add `tests/property/contrast.property.test.ts` case (append): **Property 14 (token part)** every declared text and surface token pair read from `globals.css` is at least 4.5; add `tests/unit/world-tokens.test.ts`: pad tokens equal `WORLD_CONFIG` values, mist tokens within caps (0.25, crypt 0.2), no hex in new component code yet
    - **Validates: Requirements 11.1, 11.3, 15.7, 15.9, 18.5, 18.6**
    - _Requirements: 2.1, 2.5, 5.7, 11.1, 12.4, 15.7, 15.9, 18.4, 18.5_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/property/contrast.property.test.ts` and `tests/unit/world-tokens.test.ts`.

  - [x] 5.2 Add `CreatureTag`, `CreatureShadow` and optional `Creature` props
    - Create `components/world/CreatureTag.tsx` (grave marker, hanging, lantern and stake variants; `data-testid="scatter-plaque"`, `aria-hidden`, full name in `title`, text at least 12 px) and `components/world/CreatureShadow.tsx` (`data-testid="creature-shadow"`, `aria-hidden`)
    - Extend `components/creatures/Creature.tsx` with optional `size`, `tag`, `shadow`; mirror applies to art only; output is byte-identical when the props are absent
    - Add `tests/dom/CreatureTag.test.tsx`: tag is a descendant of the button, name not announced twice, button border box unchanged by the tag, existing Creature tests still pass
    - _Requirements: 18.7, 18.11, 10.3_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/CreatureTag.test.tsx` and `tests/dom/Creature.test.tsx`.

  - [x] 5.3 Create `lib/place-pipeline.ts`, `GatePlaceView` and the `PlaceView` dispatcher
    - Move `applyFilter` and `placePlots` into `lib/place-pipeline.ts`; move the current `PlaceView` body unchanged into `components/scene/GatePlaceView.tsx`; make `PlaceView` a thin dispatcher with an empty `WORLD_PLACES` set so every place still renders the old stage (same props)
    - Add `tests/unit/place-pipeline.test.ts` and `tests/dom/PlaceViewDispatch.test.tsx` (gate output identical, dispatcher passes props through)
    - No existing assertion changes
    - _Requirements: 1.8, 17.3, 17.13_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the two new files and `tests/dom/PlaceView.test.tsx`.

  - [x] 5.4 Build `useWorldScroll` and `WorldScroller`
    - Region element with `role="region"`, place-name label, `tabIndex=0`, `overflow-y-auto overflow-x-clip overscroll-contain touch-pan-y`, scroll-padding from tokens, 2 px candle focus ring; one passive scroll listener, one `requestAnimationFrame` per frame, writes `--world-scroll` and `--world-depth`, no `getBoundingClientRect` in the scroll path, `ResizeObserver` fallback to window height then 812; reset to 0 on filter or Plot change; save and restore on `panelOpen`; pause writes while `travel.active`
    - Add `tests/dom/WorldScroller.test.tsx` per the design table (classes, scrollTop 0 on entry, restore within 1 px, one write per frame with fake rAF, zero React renders per scroll, passive-only listeners)
    - _Requirements: 3.1, 3.2, 3.5, 3.8, 3.9, 3.10, 5.3, 5.4, 5.9, 6.13, 12.1, 12.4, 14.6, 13.1_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldScroller.test.tsx`.

  - [x] 5.5 Build `useScrollGuard` and `useScrollForward`
    - Tap versus scroll guard using `classifyGesture`, swallow pointer-origin clicks after a drag over 8 px or within 120 ms of a scroll, never swallow keyboard clicks, no wheel or touch listeners; chip-row vertical drag forwards `scrollBy`; integrate the guard into `WorldScroller.tsx`
    - Add `tests/dom/WorldNoNavigation.test.tsx`: wheel, touchmove, scroll and Escape cause zero calls to `onEnterPlace`, `onReturn`, `onSelect`; 9 px drag then click does not activate; 8 px tap activates once; Enter and Space activate once
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8, 4.9, 13.3, 13.8, 13.9, 17.10_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldNoNavigation.test.tsx` and `tests/dom/WorldScroller.test.tsx`.

  - [x] 5.6 Build `useDiscovery` and `DepthMarker`
    - `useDiscovery`: one `IntersectionObserver` rooted at the scroller, sets `data-revealed` once, toggles `data-offscreen`, presets reveal attributes when reduced motion or no observer
    - `DepthMarker`: `nav` with `ol` of native buttons, `aria-current="true"`, visible label, `aria-live="polite"` updated only on Stratum change and at most once per second, hidden at `lengthVh === 1`, step click uses `scrollIntoView({ block: "start" })` with `behavior: "auto"` under reduced motion
    - Add `tests/dom/DepthMarker.test.tsx` and `tests/dom/useDiscovery.test.tsx`
    - _Requirements: 11.6, 11.7, 11.8, 11.9, 11.10, 12.8, 12.9, 14.4, 14.5, 7.7_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the two new test files.

  - [x] 5.7 Build `CropLayer` and `EnvMist`
    - `CropLayer`: clipped wrapper (`data-decor-clip`, `aria-hidden`, `inert`) on `--color-night-sky`, CSS background crop from `computeCrop`, edge mask, `onError` hides only the image
    - `EnvMist`: one non-tiled `fog-wisps` crop, `place-mist-far` and `place-mist-near` test ids, fixed token opacity, sway under motion only; never reads zombie counts
    - Add `tests/dom/EnvMist.test.tsx`: no `scene-fog` ids, opacity token within caps, static under reduced motion; `tests/dom/CropLayer.test.tsx`
    - _Requirements: 3.4, 15.9, 19.1, 19.3, 19.4, 8.13, 16.7, 12.12_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the two new test files.

  - [x] 5.8 Build `WorldStage` and `WorldCreatures`
    - Stage of `heightPx`, one `ol` per Stratum, `li` with `data-testid="scatter-creature"` and `data-name`, layer `data-testid="depth-scatter"`, positions `left: %` and `top: px`, creature band at rate 1 with no pointer offset, shadows and tags wired through `Creature` props, `li` z-order by `cy`
    - Add `tests/dom/WorldCreatures.test.tsx`: ol/li structure, existing testids preserved, tab order follows `domOrder`, shadows only for standing states, no ghost shadow
    - _Requirements: 3.7, 5.2, 12.5, 12.6, 18.7, 18.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldCreatures.test.tsx`.

  - [x] 5.9 Apply Fixture classes to the chrome
    - Class-name-only changes in `FilterChips.tsx`, `Pager.tsx`, `ReturnToGate.tsx` using `fixture-*` (no pills, soft shadows or cards); testids, semantics and handlers unchanged; gate chrome gains the same classes
    - Add `tests/unit/fixture-classes.test.ts` (no `rounded-full`, `shadow-`, `bg-white`, progress or tab roles) and keep `tests/dom/PlaceView.test.tsx` green
    - Record any assertion in `PlaceView.test.tsx` that reads a changed class name, and update only that assertion with the reason (Req 17.5)
    - _Requirements: 11.1, 11.5, 11.11, 18.4_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/fixture-classes.test.ts` and `tests/dom/PlaceView.test.tsx`.

  - [x] 5.10 Compose `WorldPlaceView`
    - Shell per the DOM skeleton: root `h-dvh` with no overflow utility, scroller, sticky top and bottom chrome (heading, return, chips, DepthMarker, pager), `WorldStage`, legibility gradients (18 vh), `LanternCursor`, `Atmosphere`, `useParallax` reuse, compact bottom bar with safe-area padding, heading focus once on entry, focus return after the panel; art slot is generic (per-place art arrives in later steps); renders no `scene-fog`
    - Add `tests/dom/WorldPlaceView.test.tsx` per the design table (tab order, marker hidden at L=1, `aria-hidden` and `inert` on decor, 3-ghost sky has 2 Strata, crypt chamber count, no fog)
    - _Requirements: 3.1, 11.2, 11.3, 12.6, 12.7, 12.11, 12.12, 13.2, 15.1, 15.5_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldPlaceView.test.tsx`.

  - [x] 5.11 Wire `panelOpen` and `revealRequest`
    - `SceneView` passes `panelOpen` and `revealRequest` to `PlaceView`; set the request in `onGoToTurningSoon` and in the `?repo=` open of `useRepoDeepLink`; `WorldPlaceView` switches filter to all, switches Plot, then sets `scrollTop = scrollTargetFor(...)` before the panel opens; no match changes nothing; Gate ignores both props
    - Add `tests/dom/WorldReveal.test.tsx`; keep `tests/dom/SceneView.test.tsx`, `tests/deepLink.test.ts` green
    - _Requirements: 10.5, 10.6, 10.7, 10.8, 3.9_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldReveal.test.tsx`, `tests/dom/SceneView.test.tsx`, `tests/deepLink.test.ts`.

  - [x] 5.12 Hub cues, empty Landmark and drift
    - `Place.tsx` and `EstateMap.tsx`: per-place cue element using `place-cue-*`, CSS `:hover` inside fine-pointer media and `:focus-visible`, `camera-drift` on background (pause while `travel.active`), empty Landmark stays at opacity 1 with `saturate(0.4)` and an unlit lantern
    - Update `tests/dom/EstateMap.test.tsx` assertion near lines 269 to 273 (`expect(opacity).toBeLessThan(skyOpacity)`): empty Landmarks now keep opacity 1 and are desaturated by `filter` (Req 2.6 replaces the original 0.45 opacity rule); assert `opacity === 1` and the saturate filter instead. Update the matching header comment and change no other assertion (Req 17.5)
    - Add Hub cue tests to `tests/dom/EstateMap.test.tsx` (cue classes, no pointer listener on coarse pointer, plaque wording unchanged)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 17.5_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/EstateMap.test.tsx`.

  - [x] 5.13 Gate drift and the `-4%` bleed
    - `PlaceBackground.tsx`: gate bleed `-4%`, `camera-drift` wrapper (6 px peak, off under reduced motion); gate output otherwise unchanged and no World_Scroller
    - Add gate assertions to `tests/dom/GateDrift.test.tsx` (bleed value, drift class, reduced-motion off, no `world-scroller`); keep `tests/dom/PlaceView.test.tsx` green
    - If any existing assertion reads the `-3%` bleed, change only that assertion and record the reason (Req 17.5)
    - _Requirements: 1.8, 5.7, 19.3_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/GateDrift.test.tsx` and `tests/dom/PlaceView.test.tsx`.

  - [x] 5.14 Extend `LayoutRobustness` for the clip rules
    - Append assertions: `overflow-clip` and `overflow-x-clip` only on `WorldScroller` and `data-decor-clip` wrappers that hold no focusable element and are not ancestors of a Creature or control; only fog strips carry `overflow-hidden`; world root has no overflow utility
    - Change no existing assertion in this task
    - _Requirements: 3.2, 3.4, 3.11, 17.6_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/LayoutRobustness.test.tsx`.

  - [x] 5.15 Extend `PointerEvents` and add `WorldPointerEvents`
    - Append to `tests/dom/PointerEvents.test.tsx` a world case; add `tests/dom/WorldPointerEvents.test.tsx`: every full-cover layer is `pointer-events-none`; a click at a Creature's centre reaches its button
    - _Requirements: 15.2, 17.7_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/PointerEvents.test.tsx` and `tests/dom/WorldPointerEvents.test.tsx`.

  - [x] 5.16 Add `WorldReducedMotion` and `HoverCardWorld` tests
    - `tests/dom/WorldReducedMotion.test.tsx`: band transforms absent, reveal attributes preset, no ambient animation classes, programmatic scroll uses `behavior: "auto"`
    - `tests/dom/HoverCardWorld.test.tsx`: card repositions on the next frame or closes after the scroller scrolls; tag does not change the button rect. No change to `HoverCardLayer`
    - _Requirements: 5.8, 10.3, 10.4, 11.10, 12.8_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only the two new test files.

- [x] 6. Checkpoint - Step 1 foundation
  - Run only the Step 1 files: every `tests/property/*` file added in tasks 4 and 5, `tests/unit/{estate-view-exports,world-light,world-effects,world-tokens,place-pipeline,fixture-classes}.test.ts`, and the new DOM tests from task 5, plus the Req 17.4 files listed in Notes
  - Confirm every property runs at least 100 cases and no test is skipped
  - Ensure all tests pass, ask the user if questions arise.
  - Rules: no fixes by weakening tests; no `next build`; no new deps; no full suite, tsc or lint.

- [x] 7. Step 1: Visual verification (Hub and gate)
  - [x] 7.1 Capture Step 1 screenshots
    - Ask the user to start `npm run dev`; capture the Hub and the gate at 1440x900, 1920x1080, 390x844, 360x740, scroll 0/50/100% where scrollable, reduced-motion shots, empty-place Hub, and travel frames at about 0, 1150, 2200 ms; save as `YYYY-MM-DD-step1-<place>-<case>-<w>x<h>-d<d>.png`
    - Worlds exist but no place is switched yet; include the `/dev/review` 12-creature gate case
    - _Requirements: 20.3, 20.4_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files (capture only).

  - [x] 7.2 Write the Step 1 Visual_Review
    - Write `docs/design-review/YYYY-MM-DD-foundation-review.md` from the template: before/after (baseline vs new) critique with pass/fail and a one-line justification per applicable criterion (Hub cues, empty Landmark, gate drift, no seams, controls readable, reduced motion, travel frames)
    - State that judgement was made from the stored screenshots. Any fail sends the work back to the failing task, then recapture and rewrite. Step 2 does not start until the review has no fail
    - _Requirements: 20.5, 20.6, 20.7, 17.12_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files unless re-iterating a failing task (then only that task's tests).

- [x] 8. Step 2: The Restless Sky
  - [x] 8.1 Build `SkyArt`
    - `components/world/SkyArt.tsx`: `place-sky` Crops per Stratum from `WORLD_ART` (high-air moon crop, flipped mid-sky, cloud-bank), CSS star field, cloud wisps via `EnvMist` at the sky token, data `Moon` positioned with `plateToStage` in the same band wrapper as the painted moon (within 2 px at every depth), edge masks and Blend_Zone crossfades with `data-blend-zone`
    - Add `tests/dom/SkyArt.test.tsx`: moon lock offset, Crop count per layout, aria-hidden and inert, no repeated Plate
    - _Requirements: 7.5, 7.6, 7.12, 18.2, 19.1, 19.5, 19.7, 19.8_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/SkyArt.test.tsx`.

  - [x] 8.2 Build the sky empty scene
    - `components/world/EmptyScene.tsx` (sky variant): moon, stars, cloud banks, empty lantern hook, copy on a carved plaque hanging from the hook at contrast at least 4.5; one screen, no scrollbar
    - Add `tests/dom/EmptyScene.sky.test.tsx`
    - _Requirements: 16.1, 16.4, 16.5, 7.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/EmptyScene.sky.test.tsx`.

  - [x] 8.3 Wire sky art, ghost light and reveal into the world
    - `WorldPlaceView.tsx` and `WorldCreatures.tsx`: mount `SkyArt` and the sky empty scene; ghosts get `rimFor` glow and `ghostLanternLevel` lantern tag (added to the existing wrapper `filter`, no new SVG filter); `ghost-rim-glow`, `ghost-lantern`, `star-twinkle`, `cloud-drift` carry `data-effect`; one-shot Discovery_Reveal for ghosts; decay rendering unchanged
    - Add `tests/dom/WorldSkyWiring.test.tsx`
    - _Requirements: 7.7, 7.8, 7.9, 18.6, 18.7, 18.10_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldSkyWiring.test.tsx` and `tests/dom/WorldPlaceView.test.tsx`.

  - [x] 8.4 Switch `sky` to `WorldPlaceView` and update sky assertions in two test files
    - Add `"sky"` to `WORLD_PLACES` in the dispatcher
    - `tests/dom/PlaceView.test.tsx`: update only the sky assertions that read percent `top` from `scatter-creature` to read pixel `top` (positions are now `left %`, `top px`); update the sky root-class assertions that expect `min-h-dvh overflow-y-auto` to expect the world root (`h-dvh`, scroller carries `overflow-y-auto`); record each assertion and reason (Req 17.5)
    - `tests/dom/CompactPlaceView.test.tsx`: update only the sky geometry assertions to read the world layout `columns` and rectangles inside the width; record each assertion and reason
    - Failures in `SceneLayoutClickability.test.tsx` and `LayoutRobustness.test.tsx` are expected until task 8.5 and are not edited here
    - _Requirements: 17.3, 17.5, 3.1_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/PlaceView.test.tsx` and `tests/dom/CompactPlaceView.test.tsx`.

  - [x] 8.5 Update sky assertions in `SceneLayoutClickability` and `LayoutRobustness`
    - `tests/dom/SceneLayoutClickability.test.tsx`: the creature-rect helper reads `left %`, `top px` and `size` from the world `li` instead of percent `left/top` plus inner `scale()`; reason: world slots are pixel-positioned; keep the clickability expectations
    - `tests/dom/LayoutRobustness.test.tsx`: the sky `scatter-creature` cap of 12 counts `li` elements; the root-class check for the sky scene root moves to the world root (`h-dvh`, no overflow utility) with the scroller carrying `overflow-y-auto`; reason: sky is now a world; every other assertion unchanged
    - _Requirements: 17.5, 17.6, 3.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/SceneLayoutClickability.test.tsx` and `tests/dom/LayoutRobustness.test.tsx`.

  - [x] 8.6 Add sky world DOM tests
    - `tests/dom/WorldSky.test.tsx`: 3-ghost sky has two Strata and a length in 1.25 to 1.5, most urgent ghost in the first screen, 12 ghosts across at least two Strata, ghost decay classes identical to the original for the same rows, no `scene-fog`, empty sky renders the finished scene
    - _Requirements: 6.4, 7.1, 7.2, 7.3, 7.9, 7.10, 15.9_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldSky.test.tsx`.

- [x] 9. Checkpoint - Step 2 Sky
  - Run only: every Step 2 test file from task 8, `tests/dom/WorldPlaceView.test.tsx`, `tests/dom/WorldScroller.test.tsx`, plus the Req 17.4 files listed in Notes
  - Confirm gate, ground and crypt output are unchanged (their existing tests in the Req 17.4 files pass untouched)
  - Ensure all tests pass, ask the user if questions arise.
  - Rules: no fixes by weakening tests; no `next build`; no new deps; no full suite, tsc or lint.

- [x] 10. Step 2: Visual verification (Restless Sky)
  - [x] 10.1 Capture sky screenshots
    - Ask the user to start `npm run dev`; capture sky for `ghosts-3` (3-ghost demo), `empty` and `ghosts-12` at 1440x900, 1920x1080, 390x844, 360x740, scroll 0/50/100% (0 only where length is 1), plus reduced-motion shots and travel frames; run the seam probe at depth 0, 0.25, 0.5, 0.75, 1
    - Save as `YYYY-MM-DD-sky-<case>-<w>x<h>-d<d>.png`
    - _Requirements: 20.3, 20.4, 19.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files (capture only).

  - [x] 10.2 Write the sky Visual_Review
    - Write `docs/design-review/YYYY-MM-DD-sky-review.md`: baseline vs new side by side, pass/fail with one-line justification for Req 18.1 to 18.12 and 19.1 to 19.11 and the Req 20.5 checks (no Seam, stretch or edge; controls readable; creatures grounded; empty state complete; reduced motion; length and gap rules for the 3-ghost case; "does not read as generated"); seam table and gap table filled from the probes
    - Any fail or "not better than the original" means iterate: fix the failing task, recapture, rewrite. Step 3 does not start until there is no fail
    - _Requirements: 20.5, 20.6, 20.7, 17.12_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files unless re-iterating a failing task (then only that task's tests).

- [x] 11. Step 3: Hallowed Ground
  - [x] 11.1 Build `GroundArt`
    - `components/world/GroundArt.tsx`: `place-ground` Crops (gate-path, flipped grass mid-path with focal `fy` at least 0.48, mausoleum-approach), `mg-fence` gate centerpiece once plus `mg-fence-tile` repeated horizontally (the only repeat), `mausoleum` once at `H - 0.35 Vh`, `fg-frame` edge pieces, CSS path ribbon (`ceil(H / 90)` radial gradients from the layout `path`), path lanterns, `EnvMist` at the ground token; band rates 0.88 background, 0.94 mid-ground, 1.12 foreground
    - Add `tests/dom/GroundArt.test.tsx`
    - _Requirements: 8.3, 8.4, 8.5, 8.9, 19.4, 19.5, 19.7, 19.8, 18.2_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/GroundArt.test.tsx`.

  - [x] 11.2 Build the ground empty scene
    - Extend `EmptyScene.tsx`: entry gate, fence, worn path, mausoleum, two lit lanterns, one unmarked plot (mound and stake) carrying the copy on a carved plaque at contrast at least 4.5
    - Add `tests/dom/EmptyScene.ground.test.tsx`
    - _Requirements: 16.1, 16.2, 16.5, 8.10_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/EmptyScene.ground.test.tsx`.

  - [x] 11.3 Wire ground art, fresh earth, ravens and reveal
    - `WorldPlaceView.tsx` and `WorldCreatures.tsx`: mount `GroundArt` and the ground empty scene; `freshEarth` mound on tombstones from `daysQuiet`; at most two perched ravens placed by name hash; one-shot candle-glow Discovery_Reveal (800 ms or less); grave marker tags; tilt from the layout; Tombstone size, moss and crack unchanged; `data-effect` on each
    - Add `tests/dom/WorldGroundWiring.test.tsx`
    - _Requirements: 8.6, 8.7, 8.8, 18.10, 18.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldGroundWiring.test.tsx` and `tests/dom/WorldPlaceView.test.tsx`.

  - [x] 11.4 Switch `ground` to `WorldPlaceView` and update ground assertions in two test files
    - Add `"ground"` to `WORLD_PLACES`
    - `tests/dom/PlaceView.test.tsx` and `tests/dom/CompactPlaceView.test.tsx`: update only the ground assertions that depend on percent positions, the old root classes, or a ground fog expectation (grep for `scene-fog` first; only a zero-fog assertion for ground is already satisfied), each recorded with the reason (Req 17.5)
    - Failures in `SceneLayoutClickability.test.tsx` and `LayoutRobustness.test.tsx` are expected until task 11.5
    - _Requirements: 17.3, 17.5, 8.9_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/PlaceView.test.tsx` and `tests/dom/CompactPlaceView.test.tsx`.

  - [x] 11.5 Update ground assertions in `SceneLayoutClickability` and `LayoutRobustness`
    - Same kinds of changes as task 8.5 for ground: world `li` rect helper; root-class check moves to the world root; every other assertion unchanged; record each assertion and reason
    - _Requirements: 17.5, 17.6, 3.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/SceneLayoutClickability.test.tsx` and `tests/dom/LayoutRobustness.test.tsx`.

  - [x] 11.6 Add ground world DOM tests
    - `tests/dom/WorldGround.test.tsx`: tombstones descend and alternate sides, single tombstone centred within 5 percent, 2 to 3 tombstones length 1.25 to 1.5 with mausoleum feature, art-load failure keeps night-sky fallback and controls, no `scene-fog` or `scene-fog-near`, mist opacity unchanged when zombie count changes
    - _Requirements: 8.1, 8.2, 8.9, 8.11, 8.12, 8.13, 15.9_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldGround.test.tsx`.

- [x] 12. Checkpoint - Step 3 Hallowed Ground
  - Run only: every Step 3 test file from task 11, `tests/dom/WorldSky.test.tsx`, `tests/dom/WorldPlaceView.test.tsx`, plus the Req 17.4 files listed in Notes
  - Confirm gate and crypt output are unchanged and the sky still passes
  - Ensure all tests pass, ask the user if questions arise.
  - Rules: no fixes by weakening tests; no `next build`; no new deps; no full suite, tsc or lint.

- [x] 13. Step 3: Visual verification (Hallowed Ground)
  - [x] 13.1 Capture ground screenshots
    - Ask the user to start `npm run dev`; capture ground for `empty`, `tombstones-3` and `tombstones-12` at all four viewports, scroll 0/50/100% (0 only where length is 1), reduced-motion shots, travel frames, and seam probes at depth 0, 0.25, 0.5, 0.75, 1
    - Save as `YYYY-MM-DD-ground-<case>-<w>x<h>-d<d>.png`
    - _Requirements: 20.3, 20.4, 19.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files (capture only).

  - [x] 13.2 Write the ground Visual_Review
    - Write `docs/design-review/YYYY-MM-DD-ground-review.md` with the same structure and pass/fail rules as task 10.2, including the empty cemetery and the 3-tombstone length and gap rules, a check that the candle direction stays single (lantern from the left), and path continuity from gate to mausoleum
    - Any fail means iterate and rewrite. Step 4 does not start until there is no fail
    - _Requirements: 20.5, 20.6, 20.7, 17.12_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files unless re-iterating a failing task (then only that task's tests).

- [x] 14. Step 4: The Crypt
  - [x] 14.1 Build `CryptArt`
    - `components/world/CryptArt.tsx`: `place-crypt` Crops per Stratum (entry, chamber-1 warm, chamber-2 flipped and cool at brightness 0.85, chamber-3 offset 25 percent at brightness 0.7), stair steps and arch Blend_Zones (CSS gradients), wall-torch glow, chain-shadow gradient, `EnvMist` as dust at the crypt token (0.15), ambient-darkness overlay with opacity `1 - ambientBrightness(depth)` driven by `--world-depth`
    - Add `tests/dom/CryptArt.test.tsx`
    - _Requirements: 9.2, 9.4, 9.6, 9.10, 18.2, 19.5, 19.7, 19.8_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/CryptArt.test.tsx`.

  - [x] 14.2 Build the crypt empty scene
    - Extend `EmptyScene.tsx`: vaulted ceiling, wall niches, torch light, iron-banded sealed door over the archway carrying the copy as a plate at contrast at least 4.5, steps leading down, drifting dust
    - Add `tests/dom/EmptyScene.crypt.test.tsx`
    - _Requirements: 16.1, 16.3, 16.5, 9.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/EmptyScene.crypt.test.tsx`.

  - [x] 14.3 Wire crypt art, chambers, hanging tags and chain reveal
    - `WorldPlaceView.tsx` and `WorldCreatures.tsx`: mount `CryptArt` and the crypt empty scene; chamber grouping by `ceil(count / 4)`; hanging coffin tags; coffin art and sealed-state encoding unchanged; torch and chain one-shot reveals (600 ms or less); coffin opacity stays 1 and plaque contrast stays at least 4.5 under the darkness overlay; `data-effect` on each
    - Add `tests/dom/WorldCryptWiring.test.tsx`
    - _Requirements: 9.1, 9.5, 9.7, 9.8, 9.9, 9.12, 18.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldCryptWiring.test.tsx` and `tests/dom/WorldPlaceView.test.tsx`.

  - [x] 14.4 Switch `crypt` to `WorldPlaceView` and update crypt assertions in two test files
    - Add `"crypt"` to `WORLD_PLACES` (the gate stays on `GatePlaceView`)
    - `tests/dom/PlaceView.test.tsx` and `tests/dom/CompactPlaceView.test.tsx`: update only crypt assertions that depend on percent positions, the old root classes, or fog expectations, each recorded with the reason (Req 17.5)
    - Failures in `SceneLayoutClickability.test.tsx` and `LayoutRobustness.test.tsx` are expected until task 14.5
    - _Requirements: 17.3, 17.5_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/PlaceView.test.tsx` and `tests/dom/CompactPlaceView.test.tsx`.

  - [x] 14.5 Update crypt assertions in `SceneLayoutClickability` and `LayoutRobustness`
    - Same kinds of changes as task 8.5 for the crypt; record each assertion and reason; after this task no place other than the gate renders the old stage, so also confirm no remaining assertion still expects the old stage for sky, ground or crypt
    - _Requirements: 17.5, 17.6, 3.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/SceneLayoutClickability.test.tsx` and `tests/dom/LayoutRobustness.test.tsx`.

  - [x] 14.6 Add crypt world DOM tests
    - `tests/dom/WorldCrypt.test.tsx`: 1 to 4 coffins one chamber, 5 to 8 two, 9 to 12 three (every chamber except the last holds 4), 2 to 4 coffins length 1.25 to 1.5, coffin plaque contrast at depth 1, no fog ids, mist at or under 0.2, filter or Plot change recomputes chambers
    - _Requirements: 9.1, 9.3, 9.5, 9.10, 9.12_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/dom/WorldCrypt.test.tsx`.

- [x] 15. Checkpoint - Step 4 Crypt
  - Run only: every Step 4 test file from task 14, `tests/dom/WorldSky.test.tsx`, `tests/dom/WorldGround.test.tsx`, `tests/dom/WorldPlaceView.test.tsx`, plus the Req 17.4 files listed in Notes
  - Confirm the gate output is unchanged
  - Ensure all tests pass, ask the user if questions arise.
  - Rules: no fixes by weakening tests; no `next build`; no new deps; no full suite, tsc or lint.

- [x] 16. Step 4: Visual verification (Crypt)
  - [x] 16.1 Capture crypt screenshots
    - Ask the user to start `npm run dev`; capture crypt for `empty`, `coffins-3` and `coffins-12` at all four viewports, scroll 0/50/100% (0 only where length is 1), reduced-motion shots, travel frames, and seam probes at depth 0, 0.25, 0.5, 0.75, 1
    - Save as `YYYY-MM-DD-crypt-<case>-<w>x<h>-d<d>.png`
    - _Requirements: 20.3, 20.4, 19.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files (capture only).

  - [x] 16.2 Write the crypt Visual_Review
    - Write `docs/design-review/YYYY-MM-DD-crypt-review.md` with the same structure and pass/fail rules as task 10.2, including chamber differences (stone, torch, darkness), stairs and arch Blend_Zones, the empty crypt, and the 3-coffin length and gap rules
    - Any fail means iterate and rewrite. Step 5 does not start until there is no fail
    - _Requirements: 20.5, 20.6, 20.7, 17.12_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files unless re-iterating a failing task (then only that task's tests).

- [x] 17. Step 5: Final tests
  - [x] 17.1 Add the Effects_Table sync test
    - `tests/unit/world-effects-sync.test.ts`: ids in `WORLD_EFFECTS` equal the rows of `docs/EFFECTS_TABLE.md` equal the set of `data-effect` and `effectProps` ids in the sources (every registry id has a table row and a component use, and the reverse); ambient count per place is 4 or fewer
    - Fix a missing row or tag in the source (never remove the test or loosen the match) and record each fix
    - _Requirements: 15.6, 15.8, 18.8, 18.9, 14.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/world-effects-sync.test.ts`.

  - [x] 17.2 Add the source-scan tests
    - `tests/unit/world-source-scan.test.ts` per the design list: dependency names in `package.json` and the lockfile equal a pinned snapshot; `public/art/` file set pinned and every file under 150 KB; no `#hex`, `rgb(`, `hsl(` or non-`next/font` fonts in new component files; `overflow-hidden` only in fog strips; `overflow-clip` and `overflow-x-clip` only in `WorldScroller` and `data-decor-clip` wrappers; `bg-repeat` only with `mg-fence-tile`; new keyframes animate only `transform` and `opacity`; pad and mist tokens equal the TS constants and stay within caps; pure libs import nothing from react, next or server-only and never reference `window`, `document`, `localStorage`, `Date` or `Math.random`; `WORLD_ART` variation rules; Fixture classes free of banned patterns
    - Fix any violation in the source (never loosen the scan) and record each fix
    - _Requirements: 14.7, 14.8, 15.7, 17.6, 17.8, 17.9, 19.4, 19.5, 19.9, 5.5, 11.11_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run only `tests/unit/world-source-scan.test.ts`.

- [x] 18. Final checkpoint - Full suite, type check and lint
  - This is the only checkpoint that runs the full suite: `npx vitest --run`, then `npx tsc --noEmit`, then `npx eslint`
  - Confirm the Req 17.4 files and every property file ran with zero failures and zero skips, and each property ran at least 100 cases
  - Fix failures in source or in tasks that own them; never delete, skip or weaken a test
  - Ensure all tests pass, ask the user if questions arise.
  - Rules: no `next build`; no new deps; file tools for any fix; never delete/weaken tests.

- [x] 19. Final visual review and user sign-off
  - [x] 19.1 Re-capture the full matrix
    - Ask the user to start `npm run dev`; capture the Hub, gate and all three worlds for every Review_Case at all four viewports, depth 0/50/100%, reduced-motion shots, and travel frames for every place; name files `YYYY-MM-DD-final-<place>-<case>-<w>x<h>-d<d>.png`
    - _Requirements: 20.3, 20.4, 20.8_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files (capture only).

  - [x] 19.2 Write the combined final Visual_Review
    - Write `docs/design-review/YYYY-MM-DD-final-review.md`: combined before/after for all places and the Hub with pass/fail per criterion, the seam and gap tables, the list of tests run in task 18, and a note that Lighthouse (mobile, median of 3) and the 50 fps scroll measurement need a production build and are left for the user to run, with the exact steps; state that judgement came from the stored screenshots
    - Any fail returns to the failing task before sign-off is requested
    - _Requirements: 20.5, 20.6, 20.7, 20.8, 14.1, 14.9_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files unless re-iterating a failing task (then only that task's tests).

  - [x] 19.3 Ask for and record the user's sign-off
    - Present the final review and screenshots to the user and ask for written sign-off in the conversation; do not mark the feature complete without it
    - Record the user's confirmation (quote and date) in the final review. If the user rejects, return to the task they name
    - _Requirements: 20.8, 20.9_
    - Rules: file tools only; no `next build`; no new deps; never delete/weaken tests; run no test files.

- [x] 20. Targeted repair pass (post sign-off; no redesign, no commit, push or deploy)
  - [x] 20.1 Investigate: version mismatch and defect reproduction
    - Confirm HEAD equals origin/main and contains no world code, so the Vercel site shows the old stages while the working tree has the worlds
    - Reproduce each reported defect in a real browser (CDP tools in `docs/design-review/tools/`) on the OLD code (temporary `git worktree` of HEAD on port 3100, remove it afterwards, never delete the real `node_modules`) and the NEW working tree; classify each as existing defect or new regression; save before shots under `docs/design-review/repair/before-*.png`
    - Defects: (1) 1280x720 wrapped header overlaps Return to the gate in Sky/Ground/Crypt; (2) lifecycle legend overlaps bottom pagination and, at narrow widths, the sample-estate notice overlaps pagination; (3) scrolling sprites and nameplates pass behind fixed headings and filters, obscuring labels; (4) Crypt hard horizontal background join and poorly grounded coffins; (5) near 737 px the hub dusk-scheduler message overlaps Beyond the Gate text; (6) pointer clicks sometimes only preview or do nothing while Enter opens records (test real mouse and touch in all four environments, explain the root cause and which previews are intentional)
    - Write `docs/design-review/repair/phase1-findings.md` with measurements and root-cause file/line; no source changes
    - Rules: no `next build`; no new deps; run no test suites.

  - [x] 20.2 Fix layout overlaps (defects 1, 2, 5)
    - Fix the header/Return overlap, legend/pagination and notice/pagination overlaps, and the hub 737 px overlap, in the smallest way that preserves artwork, transitions, filters, deep links and actions; fix existing defects too when they sit in the same components
    - Add focused regression tests (DOM structure plus a real-browser geometry script under `docs/design-review/tools/` that asserts no rect overlap at the failing widths)
    - Rules: no `next build`; no new deps; never delete/weaken tests; update an assertion only if the feature clearly contradicts it, with the reason recorded.

  - [x] 20.3 Fix scroll occlusion and the Crypt (defects 3, 4)
    - Make creature sprites and nameplates not obscure fixed headings/filters labels while scrolling (keep legibility gradients, safe top clearance and scroll-padding consistent; do not hide creatures from interaction)
    - Remove the hard horizontal Crypt background join and ground the coffins (contact shadow, base alignment) without changing the artwork files
    - Add regression tests (layout/clearance properties or DOM tests plus the seam probe at the Crypt joins)
    - Rules: no `next build`; no new deps; never delete/weaken tests.

  - [x] 20.4 Fix repository activation (defect 6)
    - From the 20.1 root cause, make a pointer click or tap on a repository open its record reliably (mouse and touch), while keeping intentional hover/focus previews and Enter/Space behaviour, deep links and actions
    - Add regression tests covering click, tap, drag-then-click (still suppressed), keyboard, and preview-then-click
    - Rules: no `next build`; no new deps; never delete/weaken tests.

  - [x] 20.5 Verify in a real browser, run checks and a production build
    - Verify all four environments (Hub/Gate, Sky, Ground, Crypt) at desktop (1280x720, 1440x900) and narrow widths (737, 390, 360), including scrolling, return navigation, and opening/closing records; save after shots under `docs/design-review/repair/after-*.png`
    - Run the full `npx vitest --run`, `npx tsc --noEmit`, `npx eslint .` and `npm run build` (a production build is explicitly requested here; clean up `.next` side effects only if it was not present before; do not deploy)
    - Write `docs/design-review/repair/repair-report.md`: fixes with before/after screenshot names, existing-vs-regression table, remaining issues
    - Rules: no new deps; never delete/weaken tests; no commit, push or deploy.
- [x] 21. Hallowed Ground visual polish (Ground only; no broad redesign, no commit or deploy)
  - [x] 21.1 Path end, two-row tombstone arrangement and fog blending
    - End the stepping-stone path just before the fence; no stones continue over the fence or behind the heading (`GroundArt` path ribbon and `layout.path`)
    - Arrange the existing repository tombstones in two staggered rows on each side of the path (closer to it, clear walking corridor, readable non-overlapping labels); sparse plots (1, 2, 3 tombstones) handled naturally, no duplicated repositories, same Plot pagination and `domOrder`; update `computeWorldLayout` ground placement only, keeping the property tests green (update an assertion only where clearly contradicted, with the reason recorded)
    - Fix the fog's visible rectangular cutoffs and stretched-strip appearance (`EnvMist` / ground mist): smooth edge blending throughout scroll and animation, keep the existing atmosphere and opacity caps, reduced-motion static
    - Check localhost `/g/defunkt` Hallowed Ground plots 1 and 3 at one wide desktop size and one narrow size, top and scrolled views; before/after shots under `docs/design-review/polish-ground/`
    - Add focused regression tests; run relevant checks (ground/world DOM and property tests, tsc, eslint on changed files)
    - Rules: no new deps; no `next build`; never delete/weaken tests; limited to the ground scene; preserve repository interactions.
- [x] 22. Ground zoom-out robustness (fog coverage and tombstone placement at extreme zoom)
  - [x] 22.1 Fix fog coverage and tombstone placement when zoomed far out or in
    - Zoomed far out (e.g. 25-50 percent browser zoom, CSS viewport 2900x1800 up to about 5800x3600) and far in (300-500 percent, CSS viewport about 300x200): the ground fog must cover the whole screen with wisps (no cut-off edges, no empty bands), and tombstones must keep a natural position (no huge gaps, hugging the path, not scattered or stuck at odd edges)
    - Likely causes: fog box sized from a fixed or capped stage width/height, `WORLD_CONFIG` widths clamped at 1920 or heights unbounded, slot positions using fixed px offsets from a viewport that is far larger than the layout design range, 12% overscan insufficient; fix in `EnvMist`/`CropLayer`/`GroundArt` and `placeGround` in `lib/world-layout.ts` with minimal, scoped changes (sky and crypt keep their look)
    - Verify in a real browser using CDP device metrics at CSS viewports 2880x1620, 3840x2160, 5120x2880 and 320x480, 400x300 on `/g/defunkt` Hallowed Ground plots 1 and 3 (top and scrolled); before/after shots under `docs/design-review/polish-ground/zoom-*.png`; open and look at them
    - Add focused regression tests (layout property or unit tests for very wide and very small widths, fog box covers viewport); keep existing properties green; no assertion weakening
    - Rules: Ground scene only; no new deps; no `next build`; no commit or deploy.
- [x] 23. Fix GroundArt hydration mismatch (ground-path style)
  - [x] 23.1 Fix the React hydration error on `ground-path` in `GroundArt`
    - Next dev overlay: "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties" at `components/world/GroundArt.tsx` (~line 449) on the `data-testid="ground-path"` div (`data-stones={4}`, style `backgroundImage: radial-gradient(ellipse 18px 6px at 530.3266222634074px 355px ...)`, `opacity: 0.85`); client and server style differ
    - Find the cause (viewport width/height differing between server render and client first render, long unrounded floats, non-deterministic style key order, layout measured in render) and fix so the first client render equals the server render (use the same deterministic fallback until mounted, round coordinates), keeping the visuals unchanged
    - Check other world components for the same pattern (SkyArt, CryptArt, EnvMist, CropLayer, WorldPlaceView) and fix the same class of issue if present
    - Verify in a real browser on `/g/defunkt` Hallowed Ground (and Sky, Crypt) that no hydration warnings appear in the console (capture console errors via CDP, hard reload, several viewport sizes), add a regression test (render to string with SSR fallback vs client first render equality, rounded coordinates), run relevant tests, tsc and eslint on changed files
    - Rules: no new deps; no `next build`; never weaken tests; no commit or deploy.
- [x] 24. UX polish and intuitiveness pass (user feedback)
  - [x] 24.1 Worlds: bottom gap, hidden scrollbar, enter-place animation
    - Scrolling all the way down in a world shows a visible gap (empty band) at the end: find which place(s) and viewports, and close it so the world ends on art/mausoleum/floor with no clear gap
    - Hide the ugly scrollbar on the right of the world scroller (`scrollbar-width: none` and `::-webkit-scrollbar` hidden) while keeping wheel, touch, keyboard scrolling and the depth marker as the progress cue
    - The enter-place travel animation (clicking a place on the Hub) looks weird: reproduce in a real browser (frames at several ms), identify the cause (e.g. mist flash, layout jump when the world mounts, scroll reset, drift, opacity pop) and smooth it without removing the transition
    - Rules: keep artwork, deep links, interactions; reduced-motion respected; focused tests; before/after shots under `docs/design-review/ux-polish/`
  - [x] 24.2 Turning-soon notice flashing and better seance candle visuals
    - The turning-soon notice ("X turns in N days" with GO TO IT) should softly flash/pulse to draw attention (opacity/transform/box-glow only, urgency scaled by days left, static under reduced motion, no seizure-risk strobing: max about 1.5 Hz)
    - Improve the seance candle visuals (the candle/ritual visuals in the seance room and its entry: find them under `components/seance` and the seance CSS; more convincing flame with soft glow, flicker, wax drips or holder; keep the existing tests passing, the seance CSS stays last in `app/globals.css`, only transform/opacity/filter per the existing seance rules, no hex literals, reduced-motion static)
    - Rules: focused tests; before/after shots under `docs/design-review/ux-polish/`
  - [x] 24.3 Rebrand Get a badge as sharing, and add (?) explanations
    - Rename the user-facing "Get a badge" / "Badge for this repo" to intuitive "Share your graveyard" (header button, dialogs, per-repo "Share this repo" / panel action), explaining in plain words what it gives (a small live image to paste in a GitHub README that shows the repo's ghost/zombie state) with a short intro line in the dialogs, plain labels for Markdown/HTML ("Paste into your README"), and a (?) help button using an accessible disclosure/tooltip pattern (keyboard reachable, visible focus ring, dismissible with Escape) explaining it
    - Intuitiveness audit of the header and place controls: add short (?) or tooltip/aria help to unclear labels (Lights on/off, Sound, Visit, Plot x of y, Nearer the gate / Deeper into the dark, the filter chips, Return to the gate), using plain wording; keep existing testids and behaviour; update existing tests only where text assertions are clearly contradicted by the rename, with reasons recorded
    - Rules: no new deps; `/badge` and `/api/badge` routes and URLs unchanged; focused tests
- [x] 25. Feedback round 2: notice pulse, badge styles, resolution overlaps
  - [x] 25.1 Turning-soon notice: whole notice pulses and never overlaps the Restless Sky plaque
    - The whole notice (pill, text, border, glow) should pulse together, not only a halo behind it (keep the 1.5 Hz cap, urgency scaling, reduced-motion static, legible text)
    - On the Hub the notice overlaps the top of "The Restless Sky" plaque at some resolutions: position it so it never overlaps any plaque, ghosts or the whisper at any width (reproduce at several sizes, including about 1024x500 and 1024x550, 1280x720, 1440x900, 737, 390), e.g. anchored above the Sky sprites with measured clearance or moved into a reserved lane
  - [x] 25.2 Make the badge styles intuitive
    - "Haunted vs Flat" is unclear: replace the radio hints with side-by-side live preview thumbnails of both styles for the actual repo/graveyard, plain names (for example "Spooky" and "Plain") with one-line explanations of when to use each ("Spooky: crimson and ghost colours, matches this site; Plain: neutral grey shield that blends with other README badges"), selection highlighting the chosen preview, keeping the underlying style values and URLs unchanged; the dialog preview updates
  - [x] 25.3 Resolution overlap sweep
    - Sweep real-browser sizes (widths 320, 360, 390, 414, 600, 700, 737, 768, 820, 1024, 1180, 1280, 1366, 1440, 1536, 1920, 2560; heights 480, 500, 550, 600, 720, 768, 800, 900, 1080) across Hub, Gate, Sky, Ground, Crypt, with live graveyards (/g/be4glebot with a turning-soon notice, /g/defunkt) and /estate, including the new "Share your graveyard" header label, the notice, plaques, whisper, chips, pager, legend, depth marker, return button, heading; fix every overlap found, in the relevant components only; also check the header wordmark font (the "Repo Graveyard" logo appeared in a plain sans red face in recent screenshots instead of the blackletter) and fix if regressed
    - Rules for all: no new deps; no `next build`; never weaken tests; reduced motion respected; focused tests; shots under `docs/design-review/ux-polish/`
## Notes

- Every task with tests is required. There are no optional `*` tasks.
- Req 17.4 files (the "Req 17.4 files" in checkpoints): `tests/dom/EstateMap.test.tsx`, `PlaceView.test.tsx`, `CompactGeometry.test.tsx`, `CompactPlaceView.test.tsx`, `PointerEvents.test.tsx`, `LayoutRobustness.test.tsx`, `DepthScatter.test.tsx`, `SceneLayoutClickability.test.tsx`, `TravelTransition.test.tsx`, `TravelFade.test.tsx`, `Parallax.test.tsx`, `ReducedMotion.test.tsx`, `HoverCardPosition.test.tsx`. Zero failures and zero skips at the end of every step.
- The design lists one `world-layout.property.test.ts`. Tasks split it into `world-layout-length`, `world-layout-placement` and `world-layout-structure`, and the motion properties into `world-motion` and `world-motion-scroll`, so tasks in the same wave never write the same file. Property numbers and requirement references are unchanged.
- Open points from the design (landmark features list, harness before baselines, 140 px versus 160 px columns, region semantics) are choices the owner should confirm at sign-off.
- Lighthouse and the 50 fps scroll measurement need a production build, which tasks must not create. They are listed as user-run steps in the final review.
- Each test file named in a task is created by that task. Checkpoints name files by step, so the checkpoint agent lists the matching files with the file tools.
- Property tests use `fast-check` with at least 100 runs and carry the tag comment `Feature: explorable-worlds, Property N: <title>`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.24", "4.26", "4.27"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.25", "4.28"] },
    { "id": 6, "tasks": ["4.5", "4.9", "4.18"] },
    { "id": 7, "tasks": ["4.6", "4.10", "4.19"] },
    { "id": 8, "tasks": ["4.7", "4.11", "4.15", "4.20"] },
    { "id": 9, "tasks": ["4.8", "4.12", "4.16", "4.21"] },
    { "id": 10, "tasks": ["4.13", "4.17", "4.22"] },
    { "id": 11, "tasks": ["4.14", "4.23"] },
    { "id": 12, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 13, "tasks": ["5.4", "5.7", "5.9", "5.12", "5.13"] },
    { "id": 14, "tasks": ["5.5", "5.6", "5.8"] },
    { "id": 15, "tasks": ["5.10"] },
    { "id": 16, "tasks": ["5.11", "5.14", "5.15", "5.16"] },
    { "id": 17, "tasks": ["7.1"] },
    { "id": 18, "tasks": ["7.2"] },
    { "id": 19, "tasks": ["8.1", "8.2"] },
    { "id": 20, "tasks": ["8.3"] },
    { "id": 21, "tasks": ["8.4"] },
    { "id": 22, "tasks": ["8.5", "8.6"] },
    { "id": 23, "tasks": ["10.1"] },
    { "id": 24, "tasks": ["10.2"] },
    { "id": 25, "tasks": ["11.1", "11.2"] },
    { "id": 26, "tasks": ["11.3"] },
    { "id": 27, "tasks": ["11.4"] },
    { "id": 28, "tasks": ["11.5", "11.6"] },
    { "id": 29, "tasks": ["13.1"] },
    { "id": 30, "tasks": ["13.2"] },
    { "id": 31, "tasks": ["14.1", "14.2"] },
    { "id": 32, "tasks": ["14.3"] },
    { "id": 33, "tasks": ["14.4"] },
    { "id": 34, "tasks": ["14.5", "14.6"] },
    { "id": 35, "tasks": ["16.1"] },
    { "id": 36, "tasks": ["16.2"] },
    { "id": 37, "tasks": ["17.1", "17.2"] },
    { "id": 38, "tasks": ["19.1"] },
    { "id": 39, "tasks": ["19.2"] },
    { "id": 40, "tasks": ["19.3"] },
    { "id": 41, "tasks": ["20.1"] },
    { "id": 42, "tasks": ["20.2", "20.3"] },
    { "id": 43, "tasks": ["20.4"] },
    { "id": 44, "tasks": ["20.5"] },
    { "id": 45, "tasks": ["21.1"] },
    { "id": 46, "tasks": ["22.1"] },
    { "id": 47, "tasks": ["23.1"] },
    { "id": 48, "tasks": ["24.1", "24.2", "24.3"] },
    { "id": 49, "tasks": ["25.1", "25.2"] },
    { "id": 50, "tasks": ["25.3"] }
  ]
}
```
