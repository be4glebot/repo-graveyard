# Implementation Plan: Daytime Lights On

## Overview

Lights On becomes a daytime theme of the same scene. The work runs in order: verify the day art, add the pure `themeArt` module, add the theme state and day tokens, wire art paths, add birds, add the "View as list" dialog, theme the loading and opening states, update steering notes, then update tests and run the final checks.

Execution rules for every task:
- Edit files with file tools (read, write, replace, append), not PowerShell. The only shell use allowed is the single targeted test or script command named in a task.
- Run only the tests the task affects (for example `npx vitest --run tests/unit/theme-art.test.ts`). Never use watch mode.
- Never run `next build`.
- Never modify any file in `public/art/day/`.
- Language: TypeScript (Next.js 16, Tailwind v4, Vitest, fast-check). Components use tokens from `app/globals.css`, never hex colors.

## Tasks

- [x] 1. Verify the day art
  - [x] 1.1 Confirm `sharp` resolves and add the asset check script
    - Use `list_directory` on `node_modules/sharp`. If it exists, leave `package.json` dependencies alone. If it does not, add `sharp` to `devDependencies` in `package.json` (edit the file; do not run an install unless the module is still missing afterwards, then run `npm install` once).
    - Create `scripts/check-day-art.mjs`. It opens the eight files in `public/art/day/` read-only and reports width, height and `hasAlpha` for each.
    - Expected sizes: place-ground 1536x1024, mg-fence 1536x595, mg-fence-tile 266x595, mausoleum 440x600, tomb-arch-fresh 398x600, fg-frame 1536x1024, bird-perch 160x160, bird-fly 384x64.
    - Check that `place-ground` is fully opaque and that the centre region of `fg-frame` is transparent.
    - Export a pure `compareDayArt(report): string[]` that returns one mismatch message per problem, naming the file. Run the file-reading `main` only when the script is executed directly (guard with `import.meta.url` vs `process.argv[1]`), so the unit test can import `compareDayArt` without side effects. The script exits non-zero when the list is non-empty or a file is missing, and never writes any file.
    - Add `"check:day-art": "node scripts/check-day-art.mjs"` to the `package.json` scripts.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.5_

  - [x] 1.2 Write unit tests for `compareDayArt`
    - Create `tests/unit/check-day-art.test.ts`. Cover a clean report, a wrong size, a missing file, an opaque `fg-frame` centre, and an alpha-bearing `place-ground`.
    - Run `npx vitest --run tests/unit/check-day-art.test.ts`.
    - _Requirements: 1.4_

  - [x] 1.3 Run the asset check and gate the wiring work on it
    - Run `node scripts/check-day-art.mjs` once. If it exits non-zero, stop, report the mismatches and do not start task 2.
    - Do not edit or convert any image to fix a mismatch.
    - _Requirements: 1.6_

- [x] 2. Add the pure theme art module
  - [x] 2.1 Create `lib/theme-art.ts`
    - Export `type Theme = "night" | "day"`, `DAY_ART` (the six night-to-day mappings from the design), `themeArt(theme, nightPath)` with night fallback, and `themeFilter(theme, nightFilter, dayToken)`.
    - Export `PERCH_BIRDS` (left x=0.285 y=0.18 unmirrored, right x=0.713 y=0.18 mirrored), `BIRD_PERCH_NATIVE`, `BIRD_FLY_FRAME` (96x64, 4 frames), a perch size ratio constant, and `perchBirdBox(gate)`.
    - No I/O, no clock, no React imports.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 4.3, 4.4, 4.5_

  - [x] 2.2 Write property test for night identity
    - Create `tests/property/theme-art.property.test.ts`, tagged `Feature: daytime-lights-on, Property 1`.
    - **Property 1: Night theme is the identity**
    - **Validates: Requirements 3.3**

  - [x] 2.3 Write property test for day mapping and night fallback
    - Same file. Generate arbitrary strings (including unicode and `..`) and the keys of `DAY_ART`.
    - **Property 2: Day theme maps known assets and falls back to night for the rest**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5**

  - [x] 2.4 Write property test for resolved path shape
    - Same file. Any `/art/*.webp` input resolves to a non-empty path under `/art/`, deterministically, for either theme.
    - **Property 3: Resolved art paths stay under `/art/` and are deterministic**
    - **Validates: Requirements 3.7, 9.6**

  - [x] 2.5 Write property test for perch bird placement
    - Same file. Gate sizes from `fc.integer({ min: 1, max: 4000 })`.
    - **Property 4: Perch bird placement follows the gate box**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [x] 2.6 Write unit tests for `lib/theme-art.ts`
    - Create `tests/unit/theme-art.test.ts`. Check that every `DAY_ART` value exists under `public/` (read with `fs.existsSync`), that the keys are exactly the six night assets, and that unknown worlds and paths fall back to night.
    - Run `npx vitest --run tests/unit/theme-art.test.ts tests/property/theme-art.property.test.ts`.
    - _Requirements: 3.1, 3.4, 9.2_

- [x] 3. Theme state, day tokens and scene root
  - [x] 3.1 Add `ThemeProvider` and mount it
    - Create `components/scene/ThemeProvider.tsx` with `useState<Theme>("night")`, exporting `ThemeProvider` and `useTheme(): { theme, setTheme }`. No localStorage, cookie or URL param. `useTheme` outside a provider returns `night` with a no-op setter so isolated component tests keep working.
    - Wrap `children` in `ThemeProvider` in `app/layout.tsx`.
    - _Requirements: 2.8, 2.9_

  - [x] 3.2 Set `data-theme` on `#scene-root` and remove the paper-register early return
    - In `components/scene/SceneView.tsx`, replace the local `lightsOn` state with `useTheme()` and derive `lightsOn = theme === "day"` for the Header toggle.
    - Set `data-theme={theme}` on the existing `#scene-root` element. Remove the `if (lightsOn) { return ... }` branch, its control bar, and the now-unused imports and props.
    - Pass `theme` to `EstateMap`, `PlaceView` (`GatePlaceView`), `WorldPlaceView` and `LanternCursor` in place of `lightsOn` (their props are renamed in task 3.4, which runs first). Travel components get `theme` in task 7.2.
    - _Requirements: 2.1, 2.2, 2.6, 2.7, 5.8_

  - [x] 3.3 Add day tokens to `app/globals.css`
    - Add `--color-day-haze`, `--color-day-light`, `--motion-bird-fly` and `--motion-bird-cross` under `@theme`.
    - Add a `[data-theme="day"]` block that overrides the scene foreground and backdrop tokens with warm values, sets `--art-filter-ground` and `--art-filter-fence` to `none`, and defines `--day-wash` (a soft warm gradient, used with `pointer-events: none`).
    - Use existing token names for overrides. Define no hex colors in components.
    - _Requirements: 2.3, 2.5_

  - [x] 3.4 Switch `LanternCursor` and fog to the theme
    - `components/scene/LanternCursor.tsx`: replace `lightsOn: boolean` with `theme: Theme` and return `null` when `theme === "day"`.
    - `components/scene/Fog.tsx` and `ShellFog` (locate with `grep_search`): return `null` when the theme is `day`. Leave `EnvMist` unchanged except for a tuning pass: in day, reduce its opacity through a day token so it reads as haze.
    - Replace `lightsOn?: boolean` with `theme?: Theme` (default `"night"`) in `EstateMap`, `GatePlaceView` and `WorldPlaceView`, and update `components/dev/ReviewHarness.tsx` to `theme="night"`.
    - Run `npx vitest --run tests/dom/LanternCursor.test.tsx` after task 9.2 updates it; until then fix type errors only.
    - _Requirements: 2.3, 2.4, 3.5_

  - [x] 3.5 Write DOM test for the theme attribute and state
    - Create `tests/dom/SceneView.theme.test.tsx`. Toggling Lights On sets `data-theme="day"` on `#scene-root` and back to `night`; the scene root is the same DOM node; a fresh mount starts as `night`; no `localStorage.setItem` call happens.
    - Run `npx vitest --run tests/dom/SceneView.theme.test.tsx`.
    - _Requirements: 2.1, 2.2, 2.7, 2.8, 2.9_

- [x] 4. Wire art paths through `themeArt`
  - [x] 4.1 Theme `CropLayer`
    - `components/world/CropLayer.tsx`: add `theme?: Theme` (default `"night"`) and build `src` with `themeArt(theme, \`/art/${plate}.webp\`)`. Leave `PLATE_SIZE`, `computeCrop` and the crop table unchanged.
    - _Requirements: 3.6, 3.8_

  - [x] 4.2 Theme `GroundArt`
    - `components/world/GroundArt.tsx`: add `theme?: Theme`. Wrap the `mg-fence-tile`, `mg-fence` and `mausoleum` URLs in `themeArt`, pass `theme` to both `CropLayer`s (`place-ground`, `fg-frame`), and replace the night `brightness(...)` filters with `themeFilter(...)` using the day tokens.
    - `components/world/WorldPlaceView.tsx`: forward `theme` to `GroundArt`.
    - No hardcoded `/art/*.webp` string may remain outside a `themeArt` call.
    - _Requirements: 3.1, 3.6, 3.8_

  - [x] 4.3 Theme `Creature`
    - `components/creatures/Creature.tsx`: read `useTheme()` and build the `Image` `src` with `themeArt(theme, \`/art/${basename}.webp\`)` so `tomb-arch-fresh` resolves to the day file and every other creature keeps its night art.
    - _Requirements: 3.1, 3.4, 3.6_

  - [x] 4.4 Write source-scan and render tests for the wiring
    - Create `tests/unit/theme-art-wiring.test.ts`. Assert that `GroundArt.tsx` and `CropLayer.tsx` contain no `/art/*.webp` literal outside a `themeArt(` call, and that none of the touched components contain hex colors.
    - Add a DOM assertion that `CropLayer` and a tombstone `Creature` render `/art/day/...` sources in day and `/art/...` in night.
    - Run `npx vitest --run tests/unit/theme-art-wiring.test.ts`.
    - _Requirements: 3.2, 3.6, 2.5_

- [x] 5. Birds and ravens
  - [x] 5.1 Create `components/world/DayBirds.tsx`
    - `PerchBirds`: rendered inside the `data-testid="ground-fence-gate"` div of `GroundArt`. Each bird is an absolutely positioned box at `left = x * 100%`, `top = y * 100%`, with width and height from the perch size constant, background `url(/art/day/bird-perch.webp)`. The right bird uses `transform: scaleX(-1)` so it faces right.
    - `FlyBird`: rendered in the `z-40` pointer-events-none band of `WorldPlaceView`. An outer wrapper runs the `bird-cross` animation across the sky at intervals; the inner sprite is 96x64 (scaled) with `background-size: 400% 100%` and a `bird-flap` animation using `steps(4)` that plays frames 1-2-3-4.
    - Both are `aria-hidden="true"`, `pointer-events: none`, with no `tabIndex`. They render only when the theme is `day` and the place is `ground`.
    - When `reducedMotion` is true, `FlyBird` returns `null` and `PerchBirds` carries no animation class.
    - Add `bird-cross` and `bird-flap` keyframes, the `.bird-fly` and `.bird-fly-cross` classes, and a `@media (prefers-reduced-motion: reduce)` block with `animation: none` to `app/globals.css`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [x] 5.2 Mount birds and skip ravens in day
    - Render `PerchBirds` in `GroundArt` and `FlyBird` in `WorldPlaceView`, passing `theme` and `reducedMotion`.
    - `components/world/WorldCreatures.tsx`: skip the `data-part="raven"` span when `theme === "day"` (pass `theme` through from `WorldPlaceView`).
    - _Requirements: 4.1, 4.10_

  - [x] 5.3 Write DOM tests for birds
    - Create `tests/dom/DayBirds.test.tsx`. Day on ground renders two perch birds and one fly bird; night renders none; birds are `aria-hidden` with `pointer-events: none`; right bird is mirrored; fly sprite uses `steps(4)`; with `reducedMotion` there is no fly bird and no animation class on perch birds; day ground renders no `data-part="raven"` element.
    - Run `npx vitest --run tests/dom/DayBirds.test.tsx`.
    - _Requirements: 4.1, 4.2, 4.5, 4.7, 4.8, 4.9, 4.10, 9.3_

- [x] 6. View as list dialog
  - [x] 6.1 Create `components/scene/ListDialog.tsx`
    - Props `{ open, onClose, rows, username }`. Renders `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at a heading, a visible close button with a focus ring, and `<LightsOnTable rows={rows} username={username} />`.
    - Trap focus and close on Escape, following the pattern in `components/badge/BadgeDialog.tsx` (reuse its helper if exported, otherwise copy the pattern).
    - _Requirements: 5.3, 5.5, 5.6_

  - [x] 6.2 Add the "View as list" link to the Header and mobile Menu
    - `components/ui/Header.tsx`: add `listOpen` state, `listOpenerRef`, `listButtonRef` (desktop) and `listMenuItemRef` (inside the `menuOpen` panel). Render both links as `<button type="button">` with the same `focus-visible` ring classes as neighbouring controls, only when `rows` is provided.
    - Render `ListDialog` from the Header, passing `rows` and the username (if `Header` has no username prop, add an optional one and pass it from `SceneView`). On close, return focus to `listOpenerRef.current`; extend the existing compact re-point effect to cover `listOpen`, falling back to the Menu button.
    - The scene stays mounted behind the dialog; no scene state changes on open or close.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.9_

  - [x] 6.3 Write DOM tests for the dialog
    - Create `tests/dom/ListDialog.test.tsx`. Activating "View as list" (desktop and in the Menu) opens a `role="dialog"` with an accessible name containing the register table; Tab stays inside; Escape and Close both close it; focus returns to the opener link.
    - Run `npx vitest --run tests/dom/ListDialog.test.tsx`.
    - _Requirements: 5.3, 5.5, 5.6, 5.7, 9.4_

- [x] 7. Themed loading, opening states and copy
  - [x] 7.1 Theme the loading shell
    - `ThemedShell` (locate with `grep_search`): read `useTheme()` and set `data-theme`. `ShellBackdrop` passes its image through `themeArt` and falls back to night for the gate plate. `ShellFog` already returns `null` in day (task 3.4).
    - `components/scene/GraveyardLoading.tsx`: pick a warm day string from `useTheme()` (for example "Walking the grounds…"); keep the night string unchanged.
    - _Requirements: 6.1, 7.2_

  - [x] 7.2 Theme the opening and travel states
    - `components/scene/TravelTransition.tsx`: `TravelRunner` and `TravelFog` take `theme`. In day, use `--day-wash` and `--color-day-haze` in place of the dark wash and fog art. Do not key timers or the `travel` state on `theme`, so a toggle mid-transition does not restart anything.
    - Pass `theme` from `SceneView`.
    - _Requirements: 6.2, 6.3_

  - [x] 7.3 Update the toggle hint and day copy
    - `components/ui/Header.tsx`: set the Lights on hint to "Lights on shows the same world in daylight. Lights off brings the night back." Keep the toggle keyboard reachable with its pressed state.
    - Review day-mode strings you touched (loading, opening, list dialog heading) and keep them kind and warm.
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 7.4 Write tests for themed states
    - Create `tests/dom/ThemedStates.test.tsx`. Loading renders the day string and `data-theme="day"` when the provider theme is day and the night string otherwise; toggling the theme while a travel transition is active leaves it mounted and does not reset its progress.
    - Run `npx vitest --run tests/dom/ThemedStates.test.tsx`.
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Steering and spec notes
  - [x] 8.1 Update `.kiro/steering/design.md`
    - Replace "### Lights-on must be beautiful too" with a "Lights on is the daytime world" section: same world in warm light, Hallowed Ground has painted day art for this pilot, other worlds use night art under day tokens, day copy stays kind and warm.
    - Delete "### The copy turns sinister" and its table.
    - Rewrite the 0.0 s and 1.0 s rows of the lights-out opening table and the "Lights on (header button) plays it in reverse" bullet so they no longer describe a plain paper register. Update the "Loading" line under the empty, loading and error states the same way, and any "always in lights-on mode" label text.
    - Replace the `## "Lights on" mode` paragraph with the daytime description plus a note that the register table is the "View as list" accessibility view. Add "day theme" to the `design-review.md` lights-on line if that file exists.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.2 Update `.kiro/steering/product.md` and the explorable-worlds notes
    - In `.kiro/steering/product.md` and the files under `.kiro/specs/explorable-worlds/` (use `grep_search` for "lights on", "Lights on", "paper register", "plain list"), change every plain-table description of Lights On to "daytime version of the same world" and describe the register table as the "View as list" accessibility view. Remove any sinister-copy table found there.
    - Do not edit `.kiro/specs/daytime-lights-on/`.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.3 Write a steering text check
    - Create `tests/unit/steering-lights-on.test.ts`. Assert `.kiro/steering/design.md` contains no "paper register" and no "copy turns sinister" and does contain "View as list".
    - Run `npx vitest --run tests/unit/steering-lights-on.test.ts`.
    - _Requirements: 8.2, 8.3, 8.4_

- [x] 9. State preservation and existing test updates
  - [x] 9.1 Add the state-preservation test
    - Create `tests/dom/LightsOnState.test.tsx`. Mount `SceneView`, set a view, plot, filter and selected repo and a scroll position, toggle Lights On and back, and assert all five values are unchanged. Also assert the list dialog open and close leaves them unchanged.
    - Run `npx vitest --run tests/dom/LightsOnState.test.tsx`.
    - _Requirements: 2.6, 5.4, 9.1_

  - [x] 9.2 Update the four existing tests that pass `lightsOn`
    - `tests/dom/LanternCursor.test.tsx`: `lightsOn` becomes `theme` ("day" renders nothing, "night" renders the lantern).
    - `tests/dom/Chrome.test.tsx`, `tests/dom/HeaderBadge.test.tsx`, `tests/dom/HeaderMenu.test.tsx`: use the new toggle hint, expect the extra "View as list" link (desktop and Menu), and drop expectations about the paper-register view or `data-lights-on`.
    - Run `npx vitest --run tests/dom/LanternCursor.test.tsx tests/dom/Chrome.test.tsx tests/dom/HeaderBadge.test.tsx tests/dom/HeaderMenu.test.tsx`.
    - _Requirements: 9.5, 5.1, 5.2, 7.1_

- [x] 10. Final checkpoint
  - [x] 10.1 Run the full suite, `tsc` and lint
    - Run `npx vitest --run`, `npx tsc --noEmit` and `npm run lint`. Fix failures in files this spec touched. Report any failure that comes from code outside this spec instead of changing it.
    - Do not run `next build`. Confirm `git status` shows no change under `public/art/day/`.
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 10.3, 10.4, 10.5_

- [x] 11. Hallowed Ground fully day (browser-reported bugs; verify at 1440x800 on `/estate` and `/g/be4glebot`, which has 0 finished repos and so uses the empty-ground composition)
  - [x] 11.1 Route every night art URL through `themeArt`
    - Fix the empty-ground composition so these test ids resolve through `themeArt(theme, ...)`: `empty-ground-plate-image`, `empty-ground-gate-image`, `empty-ground-fence-left-image`, `empty-ground-fence-right-image`, `empty-ground-mausoleum-image`. Locate the component with `grep_search` for `empty-ground-`.
    - Use `grep_search` over `components/`, `app/` and `lib/` for every `/art/` string that bypasses `themeArt` and fix each one.
    - Add entries to `DAY_ART` in `lib/theme-art.ts` only where a matching file exists under `public/art/day/`. Where no day file exists, fall back to the day palette (see 12.7).
    - Update `tests/unit/theme-art.test.ts` if `DAY_ART` keys change.
    - Run `npx vitest --run tests/unit/theme-art.test.ts`.
    - _Requirements: 3.1, 3.2, 3.6, 3.8_

  - [x] 11.2 Add a source-scan test for night art literals
    - Create `tests/unit/theme-art-scan.test.ts`. Read every `.ts` and `.tsx` file under `components/` and `app/` with `fs` and fail on any `/art/*.webp` literal that is not inside a `themeArt(` call.
    - Allowlist only `lib/theme-art.ts` and data files (for example `data/estate.json`), each with a comment justifying the exception.
    - Run `npx vitest --run tests/unit/theme-art-scan.test.ts`.
    - _Requirements: 3.2, 3.6_

  - [x] 11.3 Remove night atmosphere and dimming in day
    - In day, render no `env-mist` or fog-wisp layers, no candles, no lantern lights and no ravens. Edit the components that render them (find with `grep_search` for `env-mist`, `candle`, `lantern`, `raven`) to return `null` when `theme === "day"`.
    - Remove the `scene-vignette` cream/brown haze in day (no vignette, or a barely-there warm edge set through a day token in `app/globals.css`).
    - Painted day art must not be dimmed: no `brightness(...)` filter in day (use `themeFilter` with `none`).
    - Create `tests/dom/DayAtmosphere.test.tsx`. Day renders none of: `env-mist`, fog wisps, candles, lantern lights, ravens, a dark vignette and any brightness filter on day art. Night still renders them.
    - Run `npx vitest --run tests/dom/DayAtmosphere.test.tsx`.
    - _Requirements: 2.3, 2.4, 3.5, 4.10_

  - [x] 11.4 Delete the flying bird entirely
    - Remove `FlyBird` from `components/world/DayBirds.tsx` and its mount in `components/world/WorldPlaceView.tsx`. Keep only the two perched robins (`PerchBirds`).
    - Remove the `bird-cross` and `bird-flap` keyframes, the `.bird-fly` and `.bird-fly-cross` classes and the `--motion-bird-fly` and `--motion-bird-cross` tokens from `app/globals.css`.
    - Remove the `BIRD_FLY_FRAME` constant and any `bird-fly` asset reference from `lib/theme-art.ts`, and the `bird-fly` expectations from `scripts/check-day-art.mjs`, `tests/unit/check-day-art.test.ts` and `tests/unit/theme-art.test.ts`. Do not touch any file in `public/art/day/`.
    - Update `tests/dom/DayBirds.test.tsx` (drop fly-bird cases, keep perch-bird and no-raven cases) and `tests/property/theme-art.property.test.ts` if it references the removed constants.
    - Run `npx vitest --run tests/dom/DayBirds.test.tsx tests/unit/theme-art.test.ts tests/unit/check-day-art.test.ts tests/property/theme-art.property.test.ts`.
    - _Requirements: 4.1, 4.2, 4.5_

  - [x] 11.5 Day styling and copy for the empty-state card
    - Style the empty-state card ("No tombstones rest here yet") and its grave marker for day with parchment background, dark ink and a visible border, using day tokens in `app/globals.css` (find the component with `grep_search` for `No tombstones rest here yet`, likely `components/scene/EmptyGraveyard.tsx`).
    - In day, show the copy "No memorials yet. A stone will be placed here when a project is finished." Night copy stays unchanged. Until 12.1 lands, keep the string local to the component; 12.1 moves it to `lib/day-copy.ts`.
    - Add a DOM case in `tests/dom/DayAtmosphere.test.tsx` for the day copy and the unchanged night copy.
    - Run `npx vitest --run tests/dom/DayAtmosphere.test.tsx`.
    - _Requirements: 7.2, 7.3_

- [x] 12. Non-scary day everywhere
  - [x] 12.1 Create `lib/day-copy.ts` and wire all UI strings through it
    - Create `lib/day-copy.ts` as a pure module (no I/O, no React) holding every day string and a lookup `dayCopy(theme, key)` that returns the night string when `theme === "night"`.
    - Place names: The Restless Sky -> The Open Sky, Beyond the Gate -> The Garden Gate, Hallowed Ground -> The Memorial Garden, The Crypt -> The Keepsake Vault.
    - Counts: ghosts -> drifting, zombies -> dozing, risen -> waking, at rest -> remembered, sealed -> kept.
    - Pager: "Nearer the gate" and "Further down the path". Turning banner: "needs a little care". Empty-state copy from 11.5.
    - Wire every UI use (header, summary line, pager, legend, turning-soon notice, place titles; find with `grep_search` in `components/scene/`, `components/ui/` and `components/world/`) through the lookup using `useTheme()`. Data, ids and test ids stay unchanged.
    - Run `npx vitest --run tests/dom/Chrome.test.tsx tests/dom/DayAtmosphere.test.tsx`.
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 12.2 Test the day copy
    - Create `tests/unit/day-copy.test.ts`. Assert that no day string matches `/dead|grave|crypt|zombie|ghost|dark|haunted|sinister/i`, and that every night string equals its previous value.
    - Run `npx vitest --run tests/unit/day-copy.test.ts`.
    - _Requirements: 7.2, 7.3_

  - [x] 12.3 Turning-soon banner in day
    - Change the red "turns in N days" turning-soon notice into a warm gold banner reading "needs a little care" in day. Add the gold tokens (background, border, ink) to the `[data-theme="day"]` block in `app/globals.css`; use no hex in components (find the component with `grep_search` for `turns in`, likely `components/scene/TurningSoon.tsx`).
    - Add a DOM test `tests/dom/TurningSoonDay.test.tsx`: day shows the day copy and no red class or token, night is unchanged.
    - Run `npx vitest --run tests/dom/TurningSoonDay.test.tsx`.
    - _Requirements: 2.5, 7.2_

  - [x] 12.4 Day typography and contrast
    - In `app/layout.tsx`, add one `next/font/google` soft storybook display face (for example Fraunces) exposed as a CSS variable, and register it as a font token in `app/globals.css` under `@theme`.
    - In day, the blackletter "Repo Graveyard" wordmark uses the new face with warm dark ink (not red); headings and body keep a readable warm serif.
    - Create `lib/contrast.ts` with a pure `contrastRatio(fg, bg)` and `tests/unit/day-contrast.test.ts` that reads the day token pairs (text on background) from `app/globals.css` and asserts each is at least 4.5:1.
    - Run `npx vitest --run tests/unit/day-contrast.test.ts`.
    - _Requirements: 2.5, 7.2_

  - [x] 12.5 Sun replaces the moon in day
    - Create `components/scene/Sun.tsx`: a warm glowing CSS sun (radial gradient from tokens) layered over an optional image from `themeArt("day", "/art/day/sun.webp")`. Do not add the image file. When the file is absent, handle it with `onError` (hide the image) or background layering so the CSS sun still shows.
    - Mount `Sun` where `Moon` is mounted (find with `grep_search` for `Moon`) and render the moon only in night.
    - Create `tests/dom/Sun.test.tsx`: day renders the sun and no moon, night renders the moon and no sun, and an image `error` event leaves the CSS sun rendered.
    - Run `npx vitest --run tests/dom/Sun.test.tsx`.
    - _Requirements: 2.3, 2.5, 3.5_

  - [x] 12.6 Day chrome
    - In day, give the header, buttons, cards, pager, legend and badges light parchment backgrounds, dark ink text, visible borders and the candle focus ring. No translucent-dark layer sits over bright art.
    - Add day tokens to `app/globals.css` only; components use token classes, no hex. Edit `components/ui/Header.tsx`, `components/scene/Pager.tsx`, the legend and badge components (find with `grep_search`).
    - Create `tests/dom/DayChrome.test.tsx`: in day, the chrome elements carry the day token classes and none carry a dark translucent background class; night is unchanged.
    - Run `npx vitest --run tests/dom/DayChrome.test.tsx`.
    - _Requirements: 2.5, 7.1_

  - [x] 12.7 Day palette for worlds without day art
    - Worlds without day art (`EstateMap` hub, The Open Sky, The Garden Gate, The Keepsake Vault) render a day palette background (warm sky gradient, soft meadow, from day tokens in `app/globals.css`) instead of dimmed night art. No gothic night art is visible in day.
    - Creatures that lack day art keep their art but with no dark overlays or brightness filters.
    - Edit `components/scene/EstateMap.tsx`, `components/scene/GatePlaceView.tsx`, `components/scene/PlaceBackground.tsx` and `components/world/WorldPlaceView.tsx` as needed.
    - Create `tests/dom/DayPalette.test.tsx`: day renders no night `/art/` plate (no `<img>` or CSS `url(/art/` that is not under `/art/day/`, creatures excepted) for each of those worlds.
    - Run `npx vitest --run tests/dom/DayPalette.test.tsx tests/unit/theme-art-scan.test.ts`.
    - _Requirements: 2.3, 3.4, 3.5, 3.6_

- [x] 13. Docs
  - [x] 13.1 Write `docs/day-art-list.md`
    - Cover the estate map/hub, The Open Sky, The Garden Gate and The Keepsake Vault. For every image each scene renders (including creatures `ghost-0..3`, `zombie-0..4`, `risen`, coffins and the sun), use the same format as the Hallowed Ground list in the existing design and requirements: file name, exact pixel size, opaque or transparent, what the night version shows, alignment facts, and which assets are shared between scenes.
    - Read actual sizes read-only, either with a one-off `sharp` metadata read (no writes) or from constants in existing code. Do not generate or modify any image.
    - _Requirements: 1.1, 1.2, 10.5_

- [x] 14. Final checkpoint
  - [x] 14.1 Run the full suite, `tsc`, lint and browser check
    - Run the affected tests first, then `npx vitest --run`, `npx tsc --noEmit` and `npm run lint`. Fix failures in files this spec touched; report failures from code outside this spec instead of changing them.
    - Check `docs/design-review/` for a headless browser script. If one exists, run it to verify 1440x800 on `/estate` and `/g/be4glebot`. Report anything that could not be verified.
    - Do not run `next build`. Confirm `git status` shows no change under `public/art/day/`.
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 10.3, 10.4, 10.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. The Property 1–4 tests, the dialog test and the birds test are the ones to keep if time is short.
- Task 1.3 gates everything after it: wiring starts only when the asset check exits 0.
- Task 3.4 changes the `LanternCursor` signature before its test is updated in task 9.2, so type errors in that test are expected until then.
- Running tests, the asset script, `tsc` and lint needs the command runner; all code and doc edits use file tools.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "3.1", "3.3"] },
    { "id": 4, "tasks": ["3.4"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["3.5", "4.1", "4.3"] },
    { "id": 7, "tasks": ["4.2"] },
    { "id": 8, "tasks": ["4.4", "5.1"] },
    { "id": 9, "tasks": ["5.2", "6.1"] },
    { "id": 10, "tasks": ["5.3", "6.2"] },
    { "id": 11, "tasks": ["6.3", "7.1", "7.2"] },
    { "id": 12, "tasks": ["7.3", "8.1"] },
    { "id": 13, "tasks": ["7.4", "8.2"] },
    { "id": 14, "tasks": ["8.3", "9.1", "9.2"] },
    { "id": 15, "tasks": ["10.1"] },
    { "id": 16, "tasks": ["11.1"] },
    { "id": 17, "tasks": ["11.2", "11.3"] },
    { "id": 18, "tasks": ["11.4"] },
    { "id": 19, "tasks": ["11.5"] },
    { "id": 20, "tasks": ["12.1"] },
    { "id": 21, "tasks": ["12.2", "12.3"] },
    { "id": 22, "tasks": ["12.4"] },
    { "id": 23, "tasks": ["12.5"] },
    { "id": 24, "tasks": ["12.6"] },
    { "id": 25, "tasks": ["12.7"] },
    { "id": 26, "tasks": ["13.1"] },
    { "id": 27, "tasks": ["14.1"] }
  ]
}
```
