# Design Document

## Overview

Six small, independent fixes. Each item names the files to change, the approach and the tests. Findings below come from reading the current code.

Constraints for implementation:
- Edit only through file tools. No shell-based edits.
- Run per-task tests only (`npx vitest --run <file>`). Do not run `next build`.
- Never delete or weaken a test. Add new tests or extend files; if a frozen test conflicts with a change, stop and report.
- Pure logic stays in `lib/` and takes inputs as parameters. Colours come from `@theme` tokens in `app/globals.css`.

## Architecture

### Item 1: Instant night sky (Req 1)

What blocks first paint today:
- `components/scene/Backdrop.tsx` draws `bg-far`, `mg-fence-tile`, `mg-fence` and `fg-frame` as CSS `background-image` divs. They have no preload hint, no `priority` and no `sizes`. The only base is a flat `--color-night-sky-top` fill, so the map reads as black until the webp arrives.
- `EstateMap.tsx` mounts `<Backdrop />` and `<Moon rows={rows} />` inside `BG_PARALLAX` wrappers. `PlaceBackground.tsx` already uses `next/image` with `priority` and `sizes="100vw"` for place art.
- `components/scene/Fog.tsx` tiles `/art/fog-wisps.webp` (435 KB) as a CSS background.

Approach:
- Add a token-based CSS gradient layer (night-sky top to bruised crimson horizon, plus a moon glow radial and a faint fog band) as the first child of `Backdrop`. It renders in the server HTML, so it shows before any image.
- Add a small client component `components/scene/FadeArt.tsx`. It renders a `next/image` (`fill`, `alt=""`, `sizes`, optional `priority`) at `opacity: 0`, set to 1 in `onLoad` with a 700 ms opacity transition. It reads `prefers-reduced-motion` and drops the transition when reduced. An `onError` leaves the gradient visible.
- Use `FadeArt` for `bg-far` with `priority` and `sizes="106vw"` (the plate is `-inset-[3%]`, so 106% of the viewport). Keep the existing `layer-*` and `layer-idle-drift` classes so parallax is untouched. Before editing, grep `tests/` for `Backdrop` and `bg-far`. If a frozen test asserts the CSS `backgroundImage` url, keep that CSS background and meet Req 1.4 with `ReactDOM.preload("/art/bg-far.webp", { as: "image", fetchPriority: "high", imageSizes: "106vw" })` instead of `next/image`.
- Fog re-encode: check whether `sharp` resolves from `node_modules` (Next ships it). If yes, a one-off script re-encodes `public/art/fog-wisps.webp` at lower quality until it is under 300 KB, keeping dimensions. If not, leave the file and report (Req 1.6). Do not install packages.

Files: `components/scene/Backdrop.tsx`, new `components/scene/FadeArt.tsx`, `app/globals.css` (gradient utility using tokens), `public/art/fog-wisps.webp` (conditional).

Tests: new `tests/dom/BackdropFirstPaint.test.tsx` covers the gradient layer in the initial markup, opacity 0 until the image `load` event then 1, no transition under a mocked reduced-motion query, and `priority`/`sizes` on the bg-far image. A smoke test (`fs.statSync`) checks fog size only if the re-encode ran.

### Item 2: Single-brand titles (Req 2)

Current state: `lib/site-meta.ts` sets template `%s · Repo Graveyard`. `app/estate/page.tsx` exports `title: "Repo Graveyard — Sample Estate"`, which becomes "Repo Graveyard — Sample Estate · Repo Graveyard". `app/g/[username]/[repo]/page.tsx` returns a plain string title (same doubling). `app/g/[username]/page.tsx` already uses `{ absolute }`.

Approach: change both to `title: { absolute: ... }` with the same wording. Add a pure helper `resolveTitle(title, template)` in `lib/site-meta.ts` that mimics Next's rule (absolute wins; a string is wrapped in the template; default has no template) so titles can be tested without the Next runtime.

Files: `app/estate/page.tsx`, `app/g/[username]/[repo]/page.tsx`, `lib/site-meta.ts`.

Tests: extend `tests/dom/metadata.test.ts` with new cases (existing cases stay; if one asserts the string form of the repo title, add a new case for the absolute form and report the conflict rather than editing the old one). New property test `tests/property/titles.property.test.ts`.

### Item 3: Whisper clears place cards (Req 3)

Current state: in `components/scene/EstateMap.tsx` the whisper sits in `absolute inset-x-0 bottom-[16%] z-40 flex justify-center`. The gate place card is centred at `left-[46%] top-[78%]` (`PLACE_POSITIONS.gate`), so between 768 and 1440 px the whisper (about 84% down, centred) lands on "Beyond the Gate". The turning-soon notice is at `top-[14%]`. `Whisper.tsx` itself has no positioning.

Approach:
- Add to `lib/estate-view.ts` a pure `whisperLane(vw, vh)` returning a rect for the whisper, and pure `estateChromeRects(vw, vh)` returning rects for the four place cards (from the `PLACE_POSITIONS` percentages and a card size constant), header and legend. Whisper goes in the bottom strip below the lowest place card (`bottom-[3%]`, max width ~60% of viewport, left-aligned clear of the legend), with the lane computed so `lane.top >= gateCard.bottom + gap`. If vh is too small for that, the lane moves to the gap between the sky card and the upper band, whichever has clearance.
- `EstateMap.tsx` reads the lane constants (a `WHISPER_BOTTOM_PCT` exported from `lib/estate-view.ts`) in place of the literal `bottom-[16%]`. Keep `data-testid="scene-whisper"`.
- Before editing, read the header and legend components used by `Scene`/`EstateMap` for their real sizes, and feed those into `estateChromeRects`.

Files: `lib/estate-view.ts`, `components/scene/EstateMap.tsx`.

Tests: new `tests/unit/whisper-lane.test.ts` (example widths 768, 800, 1024, 1280, 1440 with heights 700 to 1000: no intersection with any card, header or legend) and a property test over width 768 to 1440 and height 600 to 1200.

### Item 4: Centred sparse compact rows (Req 4)

Current state: `compactStackLayout` in `lib/estate-view.ts` places `feet[0] = top + max(tall[0], up[0])` and, when `rows === 1`, sets `feet[0] = max(feet[0], bottom - down[0])`. That pushes a single row to the bottom of the band, which reads as off-centre against the top chrome.

Approach: in the `rows === 1` branch, compute the row's vertical extent `[feet - max(tall, up), feet + max(0, down)]` and set `feet[0]` so that extent's midpoint equals `(top + bottom) / 2`, then clamp into `[top + max(tall, up), bottom - max(0, down)]`. The `rows > 1` path and the `n === 0` early return stay unchanged.

Files: `lib/estate-view.ts` only (`CompactPlaceView` and `DepthScatter` call this function and need no change).

Tests: add `tests/property/compact-centre.property.test.ts` and extend the existing compact layout tests with a new describe block. Run the existing `tests/dom/CompactPlaceView.test.tsx` and the estate-view property file to confirm nothing regressed.

### Item 5: Painted moon (Req 5)

Current state: `components/scene/Moon.tsx` is a server component drawing a CSS disc with craters and a `boxShadow` glow. Usages: `EstateMap.tsx` (fixed map position), `PlaceBackground.tsx` (sky place, `placement`), `GateScene.tsx` (landing, `fillParent` and `glowScale`), `EmptyGraveyard.tsx` (`placement`). `lib/scene-view.ts` has `moonTreatment` and `summaryCounts`.

Approach:
- Make `Moon` a client component (`"use client"`; props stay serialisable, so `EmptyGraveyard` as a server component still works).
- Inside the existing wrapper, render `next/image` of `/art/moon.webp` (`fill`, `alt=""`, `sizes` from the diameter, `unoptimized` not needed) over the glow. Keep the wrapper, positioning, `boxShadow` glow and `placement` logic as is. Local state `imageFailed` flips on `onError`; when true, render the existing crater disc (Drawn_Moon) with its current fill.
- The wrapper drops its solid `backgroundColor` while the image is shown (the image is transparent), so the disc does not show behind it; it is kept for the fallback.
- Bloodmoon: when `moonTreatment(rows) === "blood-red"`, apply a tint to the image via a CSS filter class (`.moon-blood` in `app/globals.css`, built from tokens: sepia, saturate and hue-rotate tuned toward `bloodmoon-100`) and keep `--color-moon-blood` for the Drawn_Moon. Check `globals.css` for an existing `bloodmoon-100` token; add it only if missing.
- Expose `data-moon-source="image" | "drawn"` and `data-moon-treatment` on the wrapper for tests.

Files: `components/scene/Moon.tsx`, `app/globals.css`.

Tests: new `tests/dom/MoonArt.test.tsx`: image rendered for each usage mode (default, `placement`, `fillParent`); `error` event switches to `drawn`; blood-red rows set the treatment on both sources; glow `boxShadow` matches the old value. Run existing Moon-related tests first (grep `tests/` for `Moon`) and keep them green unchanged.

### Item 6: Lint warnings (Req 6)

- `components/detail/HoverCardProvider.tsx`: remove `useCallback` from the React import (line 5), confirm nothing else uses it.
- `tests/dom/SceneLayoutPreservation.test.tsx`: change `renderSky(count, handlers = {})` (line 37) to `renderSky(count)`. Confirm no call passes a second argument; leave every assertion as is.
- Run `npx eslint` on those two files only, then the `SceneLayoutPreservation` test.

## Components and Interfaces

```ts
// lib/site-meta.ts
export function resolveTitle(
  title: string | { absolute: string } | { default: string; template: string },
  template: string | null,
): string;

// lib/estate-view.ts
export interface ChromeRect { left: number; top: number; right: number; bottom: number }
export function whisperLane(vw: number, vh: number): ChromeRect;
export function estateChromeRects(vw: number, vh: number): {
  placeCards: ChromeRect[]; header: ChromeRect; legend: ChromeRect;
};
export function rectsIntersect(a: ChromeRect, b: ChromeRect): boolean;
```

`FadeArt` props: `{ src: string; sizes: string; priority?: boolean; className?: string; style?: CSSProperties }`.

## Data Models

No new persisted data. `ChromeRect` and the title union above are the only new types.

## Error Handling

- Image load failure (backdrop plate, moon): decorative image is hidden and the gradient or Drawn_Moon remains. No broken-image box.
- Non-finite viewport values in the new pure functions are coerced to 0 (reuse `finiteOrZero`), so they never throw.
- Fog re-encode tooling missing: report and leave the file unchanged.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system. Properties bridge human-readable specs and machine-verifiable guarantees.*

### Property 1: Brand appears once in every resolved title

For any GitHub-valid username and repo name, resolving the title of the root default, `/estate`, `/g/[username]` and `/g/[username]/[repo]` through `resolveTitle` with the root template yields a string containing "Repo Graveyard" exactly once.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 2: Whisper never intersects chrome

For any viewport width in 768 to 1440 and any height in 600 to 1200, the rectangle from `whisperLane` does not intersect any place card, the header or the legend rectangle from `estateChromeRects`.

**Validates: Requirements 3.1, 3.2**

### Property 3: A single compact row is vertically centred

For any scene width, any band with positive height and any placement list with `1 <= n <= compactColumns(width)`, the vertical midpoint of the row's extent from `compactStackLayout` equals the band midpoint, within 1 px, unless clamping to the band applies. All rects stay inside the band when the band is tall enough.

**Validates: Requirements 4.1**

### Property 4: Multi-row layouts are unchanged

For any placement list with `n > compactColumns(width)`, the output of `compactStackLayout` equals the output of the pre-change implementation (kept as a reference copy inside the test).

**Validates: Requirements 4.2**

### Property 5: Compact layout is total

For any width, band and scene height, including non-finite numbers, and any placement list including the empty one, `compactStackLayout` does not throw and returns exactly `n` placements.

**Validates: Requirements 4.3**

### Property 6: Bloodmoon treatment follows moonTreatment

For any list of graveyard rows, the `Moon` wrapper carries the blood-red treatment, for both the image and the Drawn_Moon, if and only if `moonTreatment(rows)` is `"blood-red"`.

**Validates: Requirements 5.4**

## Testing Strategy

- Property tests use fast-check with at least 100 runs, tagged `Feature: polish-pass-2e, Property N: <title>`, placed under `tests/property/`.
- Example and DOM tests (Vitest and Testing Library, matching `tests/dom/`) cover Req 1.1 to 1.3, 2.1, 2.2, 3.3, 5.1 to 5.3.
- Smoke checks (eslint on two files, `priority`/`sizes` presence, fog file size) cover Req 1.4 to 1.6 and 6.1 to 6.3.
- Run only the test files named per task. Do not run `next build`. Do not delete or weaken any existing test.
