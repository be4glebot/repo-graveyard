# Implementation Plan: landing-mobile-states

## Overview

Spec 2D gives the landing page, the sub-768 px layout and every edge state the same haunted look as the graveyard scene. The plan follows the design's slices: pure lib modules first, shared UI, landing, metadata, header, compact place layout, detail sheet, edge states, loading and 404, then cross-cutting checks and a final checkpoint. Implementation language is TypeScript (Next.js 16, Tailwind v4, Vitest, fast-check).

## Tasks

- [x] 1. Pure lib modules: username validator, site metadata, edge-state copy
  - [x] 1.1 Add `validateUsernameInput` to `lib/username.ts`
    - Export `USERNAME_EMPTY_MESSAGE`, `USERNAME_INVALID_MESSAGE`, `UsernameCheck` and `validateUsernameInput(raw)`; keep `isValidUsername` unchanged
    - Trim first, then empty check, then `isValidUsername`; return the trimmed username on success
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 1.2 Create `lib/site-meta.ts`
    - Export `SITE_URL_FALLBACK`, `OG_IMAGE_READY = false`, `OG_IMAGE_ALT`, `resolveSiteUrl`, `buildRootMetadata` (Decision A)
    - `resolveSiteUrl` never throws and falls back to `http://localhost:3000`
    - While `OG_IMAGE_READY` is false the single image is `/art/place-gate.webp`; when true it is `/og/repo-graveyard-1200x630.jpg` at 1200 x 630
    - _Requirements: 3.1, 3.2, 3.4, 3.6, 3.7_

  - [x] 1.3 Create `lib/edge-states.ts`
    - Export `EdgeKind`, `edgeCopy`, `emptyGraveyardLine`, `resetInMinutes` (ceil, minimum 1, `undefined` for unknown), `LOADING_NAME_MAX`, `LOADING_GENERIC`, `loadingLabel`, `usernameFromPath`
    - Use the copy table from the design (static strings, no digits, in `voice.md` tone)
    - `loadingLabel` decodes inside try/catch and truncates by code points
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.5, 8.6_

  - [x] 1.4 Write property test for username validation
    - File `tests/property/lms-username.property.test.ts`, at least 100 runs
    - **Property 1: Username validation is total and consistent**
    - **Validates: Requirements 2.2, 2.3, 2.4**

  - [x] 1.5 Write property test for site URL resolution
    - File `tests/property/lms-site-url.property.test.ts`
    - **Property 2: Site URL resolution always yields an absolute URL**
    - **Validates: Requirements 3.7**

  - [x] 1.6 Write property test for root metadata
    - File `tests/property/lms-root-metadata.property.test.ts`
    - **Property 3: Root metadata is complete for any site URL**
    - **Validates: Requirements 3.1, 3.4**

  - [x] 1.7 Write property test for the reset countdown
    - File `tests/property/lms-reset-minutes.property.test.ts`
    - **Property 5: Reset countdown rounds up and has a minimum of one**
    - **Validates: Requirements 7.3**

  - [x] 1.8 Write property test for edge copy
    - File `tests/property/lms-edge-copy.property.test.ts`
    - **Property 6: Edge copy is short, kind of voice and date free**
    - **Validates: Requirements 7.2, 7.5, 7.7**

  - [x] 1.9 Write property test for the empty graveyard line
    - File `tests/property/lms-empty-line.property.test.ts`
    - **Property 7: Empty graveyard line names the owner**
    - **Validates: Requirements 7.6**

  - [x] 1.10 Write property test for the loading label
    - File `tests/property/lms-loading-label.property.test.ts`
    - **Property 8: Loading label is safe, bounded and falls back**
    - **Validates: Requirements 8.1, 8.5, 8.6**

- [x] 2. Compact layout pure functions in `lib/estate-view.ts`
  - [x] 2.1 Add constants, `stageBand` and the shared plaque-lift helper
    - Export `COMPACT_MAX_WIDTH_PX = MOBILE_BREAKPOINT - 1`, `COMPACT_SLOT_ROWS`, `COMPACT_COLUMN_MIN_PX`, `COMPACT_MAX_COLUMNS`, `COMPACT_SLOT_GAP_PX`, `COMPACT_CREATURE_MIN_PX`, `PLAQUE_BELOW_FEET_MAX_PX`, `COMPACT_CHROME_FALLBACK_PX` (each at least the real rendered height)
    - Implement `stageBand` (coerce non-finite to 0, clamp top into `[0, H]`, bottom into `[top, H]`)
    - Extract the plaque lift rule used by `resolvePlacement` into one helper without changing existing behavior; leave `STAGE_BANDS` untouched
    - _Requirements: 5.5, 5.7, 5.9, 5.10, 5.11_

  - [x] 2.2 Add `compactColumns`, `compactPlotSize`, `layoutCompactChrome` and `compactStackLayout`
    - Follow Decision D: 2 to 4 columns, plot size `min(columns * COMPACT_SLOT_ROWS, PLOT_SIZE)`
    - `compactStackLayout` returns a `ResolvedPlacement` for every input (never throws), keeps rects inside the band and the edge margins, and uses the shared plaque-lift helper
    - _Requirements: 5.1, 5.3, 5.4, 5.6, 5.7, 5.10_

  - [x] 2.3 Write property test for `stageBand` totality
    - File `tests/property/lms-stage-band-total.property.test.ts`
    - **Property 9: Stage band is total, non-negative and inside the scene**
    - **Validates: Requirements 5.9, 5.10**

  - [x] 2.4 Write property test for `stageBand` tracking limits
    - File `tests/property/lms-stage-band-tracks.property.test.ts`
    - **Property 10: Stage band tracks the measured limits**
    - **Validates: Requirements 5.5, 5.9**

  - [x] 2.5 Write property test for compact chrome boxes
    - File `tests/property/lms-compact-chrome.property.test.ts`
    - **Property 11: Compact chrome boxes are ordered and disjoint**
    - **Validates: Requirements 5.1, 5.4**

  - [x] 2.6 Write property test for compact creatures inside the band
    - File `tests/property/lms-compact-stack.property.test.ts`
    - **Property 12: Compact creatures and plaques stay inside the stage band**
    - **Validates: Requirements 5.6, 5.7**

- [x] 3. Shared UI building blocks
  - [x] 3.1 Create `components/ui/useMedia.ts`
    - `useSyncExternalStore` over `matchMedia` with a server snapshot parameter; safe when `matchMedia` is missing (SSR, jsdom)
    - _Requirements: 1.5, 1.6, 4.10, 9.3_

  - [x] 3.2 Create `components/ui/ThemedButton.tsx` and `components/ui/ReloadButton.tsx`
    - `ThemedButton` renders a `Link` or `button` with `.btn2` plus `iron` or `crimson` variant, `min-h-11 min-w-11`, and a `candle-400` focus-visible ring
    - `ReloadButton` is a client component with optional `onReload` prop defaulting to `window.location.reload()`, touched only inside the click handler (Decision B)
    - Tokens only, no color literals
    - _Requirements: 2.10, 7.5, 7.8, 8.9, 9.1, 9.2_

  - [x] 3.3 Create `ShellBackdrop`, `ShellFog` and `ThemedShell` in `components/scene/`
    - `ShellBackdrop`: `next/image` with explicit 1536 x 1024, `alt=""`, solid `--color-night-sky` fill always behind, `onError` hides the image, optional `priority`
    - `ShellFog`: two layers using existing `.fog-wisps` and `.fog-wisps-thin`, fixed token opacity, no drift under Reduced_Motion
    - `ThemedShell` (server): backdrop, fog, header with wordmark link to `/`, centred content slot
    - _Requirements: 1.1, 1.7, 1.8, 7.1, 7.10, 8.4_

  - [x] 3.4 Write unit tests for `ThemedButton` and `ReloadButton`
    - Link `href` and label, 44 px classes, focus ring class, `ReloadButton` calls the injected `onReload`
    - _Requirements: 7.5, 7.8, 8.9_

- [x] 4. Landing page
  - [x] 4.1 Update `components/landing/UsernameForm.tsx`
    - Use `validateUsernameInput`; button "Open the gate" as a crimson `ThemedButton`; focus the input and keep its value on rejection; clear the message in `onChange`; `role="alert"` messages; navigate to `/g/{encodeURIComponent(username)}`
    - Update `tests/landing-form.test.tsx` in place: new button label, plus focus-on-rejection, value-preserved and message-cleared cases; do not delete any existing test or case
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.4, 9.9_

  - [x] 4.2 Create `GateScene`, `HowItWorks` and `LandingFooter`
    - `components/landing/GateScene.tsx` (client): shell layers plus Moon, pointer parallax via `useParallax` with bands capped at 8, 16 and 24 px, no listener or animation under Reduced_Motion, priority hint on the largest image only
    - `HowItWorks`: `<ol>` of three steps with `ghost-0`, `zombie-0`, `risen` images and empty `alt`
    - `LandingFooter`: "Built with Kiro", link to `https://github.com/be4glebot/repo-graveyard`, and the sentence "Art generated with ChatGPT; planning help from Claude"
    - _Requirements: 1.1, 1.5, 1.6, 1.7, 1.8, 2.7, 2.8, 2.9, 2.11_

  - [x] 4.3 Rewrite `app/page.tsx`
    - One `h1` "Repo Graveyard" in `font-wordmark` with crimson glow, one tagline "Every abandoned repo leaves something behind." in `font-narrative`, token gradient Scrim behind the text, then form, Estate link "Tour the Haunted Estate" (`/estate`, secondary `ThemedButton`), `HowItWorks`, `LandingFooter`
    - DOM order gives Tab order: input, "Open the gate", Estate link, footer link
    - _Requirements: 1.2, 1.3, 1.4, 2.6, 2.10, 2.11_

  - [x] 4.4 Write landing page DOM tests
    - Tagline, single `h1`, three steps in document order, footer `href` and label, disclosure sentence, Estate link `href`, Tab order, one priority image, image `error` event leaves h1, tagline and form present
    - _Requirements: 1.2, 1.3, 1.8, 2.6, 2.7, 2.8, 2.9, 2.10, 9.5_

- [x] 5. Page metadata and Open Graph image (Decision A)
  - [x] 5.1 Wire metadata in `app/layout.tsx`, `.env.example` and the per-user title
    - `export const metadata = buildRootMetadata(resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL))`
    - Add `NEXT_PUBLIC_SITE_URL=https://your-deployment.example.com` to `.env.example`
    - Change `generateMetadata` in `app/g/[username]/page.tsx` to return `{ absolute: "Repo Graveyard — {username}" }` so the rendered string is unchanged
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 3.8_

  - [x] 5.2 Add `public/og/README.md` with the manual export steps
    - Document: open `public/art/place-gate.webp`, set canvas 1200 x 630, cover-fit and centre, optionally add the wordmark, export JPEG quality 80 to 85 under 300 KB, save as `public/og/repo-graveyard-1200x630.jpg`, then set `OG_IMAGE_READY = true` in `lib/site-meta.ts`
    - Do not generate the image with a script or runtime route
    - _Requirements: 3.2, 3.3_

  - [x] 5.3 Write property test for the per-user title
    - File `tests/property/lms-user-title.property.test.ts`
    - **Property 4: Per-user title text is unchanged**
    - **Validates: Requirements 3.5**

  - [x] 5.4 Write the conditional share-image test
    - If `OG_IMAGE_READY` is false, assert metadata uses `/art/place-gate.webp`
    - If true, assert `public/og/repo-graveyard-1200x630.jpg` exists, is at most 300 KB, and its JPEG header reports 1200 x 630
    - Also assert `.env.example` contains `NEXT_PUBLIC_SITE_URL`
    - _Requirements: 3.2, 3.3, 3.8_

- [x] 6. Compact header and Menu disclosure
  - [x] 6.1 Create `components/scene/useHeaderHeightVar.ts`
    - `ResizeObserver` on the header wrapper; while compact, write `--site-header-h` in px on the scene root, updating within one animation frame
    - _Requirements: 4.12_

  - [x] 6.2 Update `components/ui/Header.tsx`
    - Single non-wrapping row below 768 px with Wordmark, truncating username badge and Estate badge in estate mode
    - "Menu" button (`aria-expanded`, `aria-controls`, 44 px target) and a panel holding the visit form, Lights toggle and Sound toggle; closed on load; CSS-driven visibility (`max-[767px]:hidden`, `min-[768px]:flex`) per Decision E
    - Escape closes and refocuses the button; valid submit closes; rejected submit keeps it open with the text; `matchMedia` change to wide closes it; use `validateUsernameInput`; wire `useHeaderHeightVar`
    - Desktop layout unchanged
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [x] 6.3 Write Menu_Disclosure and header-height tests
    - `aria-expanded` false then true, `aria-controls` matches the panel id, click toggles, Escape closes and focuses the button, controls inside the panel, valid submit closes, rejected submit keeps it open, `matchMedia` change closes it
    - `useHeaderHeightVar` with a stub `ResizeObserver`; keep `Chrome.test.tsx` passing unchanged
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.12, 9.6_

- [x] 7. Compact place layout
  - [x] 7.1 Update `components/scene/DepthScatter.tsx`
    - Add optional `compactBand` prop; when scene width is at most `COMPACT_MAX_WIDTH_PX` and the band is set, use `compactStackLayout`
    - Delete `mobilePosition` and its helper; widths of 768 px and above keep the existing desktop branches
    - _Requirements: 5.6, 5.8, 5.10, 5.11_

  - [x] 7.2 Update `components/scene/PlaceView.tsx`
    - While compact: one flow column (`data-testid="place-chrome"`) with return link, `PlaceHeading` and single-row horizontally scrolling chips; Pager in `data-testid="place-bottom-bar"` fixed to the bottom with safe-area padding
    - Measure column bottom and bar top (with `COMPACT_CHROME_FALLBACK_PX` before measurement), pass `stageBand(...)` to `DepthScatter`, re-place within 100 ms of a change, page by `compactPlotSize(sceneW)`
    - At 768 px and above keep current markup, `top: var(--site-header-h)` and `STAGE_BANDS`
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.8, 5.11_

  - [x] 7.3 Write geometry and compact-layout tests
    - Geometry test over widths 375, 430, 431, 600, 700, 767 and heights 667, 812, 1024 (named example 375 x 812) for all four places using `scatterLayout`, `compactStackLayout`, `layoutCompactChrome`, `rectsIntersect`: zero chrome pairs intersect, zero creature or plaque rects intersect chrome
    - At 700 px assert `compactColumns` is greater than 2 and more than two distinct column centres are used
    - `DepthScatter` regression at 700 px with a `compactBand`; `mobilePosition` no longer exported
    - Update `tests/dom/SceneView.test.tsx` in place only if the DOM changed; existing `STAGE_BANDS`, `scatterLayout` and `resolvePlacement` suites stay green
    - _Requirements: 5.4, 5.6, 5.11, 9.7_

- [x] 8. Full-height detail sheet
  - [x] 8.1 Update `components/detail/DetailPanel.tsx`
    - Below 768 px: `inset-0 h-dvh w-full rounded-none overflow-y-auto overscroll-contain`, sticky opaque header row, close button `min-h-11 min-w-11`; remove `max-h-[85vh]`
    - At 768 px and above the 420 px right panel is unchanged; keep existing focus trap, scroll lock, Escape and opener restore (body fallback without throwing if the opener is gone)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 8.2 Update `tests/dom/DetailPanel.test.tsx` in place
    - Replace the 375 px `max-h-[85vh]` assertion with the full-height classes; add sticky close and 44 px class checks; repeat the full-height assertion at 700 px; keep 768 px assertions; extend `stubMedia` for the second query
    - Add a test that closing with a removed opener does not throw
    - _Requirements: 6.1, 6.3, 6.6, 6.7_

- [x] 9. Themed edge-state pages
  - [x] 9.1 Restructure `components/scene/SceneErrorState.tsx`
    - Render inside `ThemedShell`; `not-found` and `invalid-username` share the not-found copy with "Try again" (`/`) and "Tour the Haunted Estate" (`/estate`); `rate-limited` uses the locked copy with countdown only when `resetInMinutes` is defined; `server-error` has its own copy with `ReloadButton`
    - `role="alert"`, exhaustive `switch` with `never` guard, all actions are `ThemedButton`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7, 7.8, 7.9_

  - [x] 9.2 Create `components/scene/EmptyGraveyard.tsx`
    - Server component in the shell with the `place-ground` backdrop, a full pale `Moon` (confirm `moonTreatment([])`, else add a small treatment override prop), heading "Nothing buried here yet.", `emptyGraveyardLine(username)`, Estate button, `role="status"`
    - _Requirements: 7.1, 7.6, 7.8, 7.9_

  - [x] 9.3 Write edge-state DOM tests and update existing ones in place
    - Copy and links for every kind, `role="alert"` vs `role="status"`, countdown present only when known, empty state includes the username
    - Update existing error-state tests for the "Tour the Haunted Estate" label and the split server-error copy; do not delete any test
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.9, 9.8_

- [x] 10. Loading page, app 404 and page wiring
  - [x] 10.1 Create `GraveyardLoading` and `app/g/[username]/loading.tsx`
    - `GraveyardLoading` renders `ThemedShell` with a `role="status"` line, initial text `LOADING_GENERIC`; a Suspense-wrapped client child reads `usePathname()`, applies `usernameFromPath` and `loadingLabel`; no spinner element
    - `loading.tsx` renders `GraveyardLoading`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 10.2 Create `app/not-found.tsx`
    - Shell, `edgeCopy("app-not-found")`, "Return to the gate" (`/`) and "Tour the Haunted Estate" (`/estate`) as `ThemedButton`s
    - _Requirements: 8.7, 8.8, 8.9_

  - [x] 10.3 Wire `app/g/[username]/page.tsx`
    - Suspense fallback becomes `GraveyardLoading`; zero public repos renders `EmptyGraveyard`; import `resetInMinutes` from `lib/edge-states` and remove the private helper; keep the `{ absolute }` title from 5.1
    - _Requirements: 7.3, 7.6, 8.1, 8.4_

  - [x] 10.4 Write loading and 404 DOM tests
    - Generic text first, `role="status"`, no `animate-spin` or `role="progressbar"`, markup-like username rendered as literal text, long username truncated, fog and shell present
    - Not-found page copy, both link `href`s and labels, both reachable by Tab
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.9, 9.8_

- [x] 11. Cross-cutting quality checks
  - [x] 11.1 Write the source-scan and threshold tests
    - Scan new and changed component files and fail on any hex, `rgb(a)` or `hsl(a)` literal
    - Assert `COMPACT_MAX_WIDTH_PX === MOBILE_BREAKPOINT - 1` and that `max-[767px]`, `min-[768px]` and `matchMedia` strings match them, with no `430` or `431` literal left
    - _Requirements: 2.11, 5.11, 9.1_

  - [x] 11.2 Write the token contrast test
    - Parse `app/globals.css`; assert WCAG contrast of at least 4.5 for landing text tokens against every Scrim stop and the solid fallback, and at least 3.0 for the `candle-400` focus ring
    - _Requirements: 1.4, 1.8, 9.2_

  - [x] 11.3 Write the reduced-motion tests
    - With `matchMedia` stubbed to reduce: `GateScene` attaches no pointer listener and adds no animation classes; `ShellFog` and edge components render without drift or transitions longer than 0 ms
    - _Requirements: 1.6, 7.10, 9.3_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Run `npx vitest --run`, `npx tsc` and `npm run lint`; all must report zero failures. Never run `next build`
  - Confirm the count of existing test files and cases has not decreased
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 9.9, 9.10, 9.11_

## Notes

- All tasks and sub-tasks, including every test task, are required. None are optional.
- **Verification constraints:** only `npx vitest --run`, `npx tsc` and `npm run lint` are allowed. Never run `next build`. Never delete existing tests; update them in place (`tests/landing-form.test.tsx`, `tests/dom/DetailPanel.test.tsx`, existing error-state tests, and `tests/dom/SceneView.test.tsx` only if the DOM changed).
- **File edits:** if no built-in file-write tool is available, edits are done by the spec-task sub-agent, not PowerShell.
- **Open Graph image (Decision A):** the user supplies the JPEG at `public/og/repo-graveyard-1200x630.jpg`, following `public/og/README.md` (task 5.2). Until then `OG_IMAGE_READY` stays `false` in `lib/site-meta.ts` and metadata uses `/art/place-gate.webp`, so no task or test is blocked. After committing the JPEG, the user flips `OG_IMAGE_READY` to `true`; that is the only code change, and the conditional test in 5.4 then enforces 1200 x 630 and 300 KB. Agents must not flip the flag or generate the image.
- Property tests use one file per property (names in each task) so tasks never share a file. Each runs at least 100 runs and is tagged `Feature: landing-mobile-states, Property N: <title>`.
- Requirement 8.8 (HTTP 404 from `app/not-found.tsx`) cannot be verified with the allowed tooling; the user checks it by hand with `npm run dev` and an unknown path.
- Requirement 9.7 deviation: the compact path does not call `resolvePlacement` or `plaqueRect`, so the geometry test uses `compactStackLayout` and `layoutCompactChrome` with `rectsIntersect`; their existing property tests still cover those two functions.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "2.1", "3.1", "3.2", "5.2", "6.1", "8.1"] },
    { "id": 1, "tasks": ["1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "2.2", "3.3", "3.4", "4.1", "5.1", "6.2", "8.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "2.6", "4.2", "5.3", "5.4", "6.3", "7.1", "9.1", "9.2", "10.1", "10.2"] },
    { "id": 3, "tasks": ["4.3", "7.2", "9.3", "10.3", "10.4"] },
    { "id": 4, "tasks": ["4.4", "7.3"] },
    { "id": 5, "tasks": ["11.1", "11.2", "11.3"] }
  ]
}
```
