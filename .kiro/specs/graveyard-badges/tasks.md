# Implementation Plan: Graveyard Badges

## Overview

Build the badge feature bottom-up in TypeScript: first the pure core (`lib/badge.ts`, `lib/badge-messages.ts`, `lib/badge-snippets.ts`), then the `server-only` service and the two route files, then the shared client dialog, then the wiring into `Header` and `DetailPanel`. Every task that adds code also adds its tests in the same task, and all tests are required (none are optional). Each step is wired into the previous one, so no code is left orphaned.

## Execution guidance

- **Allowed commands:** only `npx vitest --run`, `npx tsc --noEmit` and `npm run lint` may be run. Never run `next build`. Never start a dev server.
- **Existing tests:** never delete or weaken an existing test without asking the user first.
- **Dependencies:** add no entries to `dependencies` or `devDependencies`. Use only built-in facilities, Vitest and fast-check (already installed).
- **File edits:** make every file edit with the file-write and file-edit tools (or through the spec-task execution sub-agent if the main agent has no write tool). Do not create or modify files through PowerShell redirection, `Set-Content` or similar.
- **Separator:** write the badge separator as the `\u00B7` escape in all source and test files. Never type the literal middle-dot character, and never let the text `\u00C2` appear in output.
- **Next.js 16:** `params` is a `Promise` in route handlers. Export no segment config from the badge routes. Read `node_modules/next/dist/docs/` before writing route code if unsure.
- **Theme:** components use Tailwind theme tokens, not hex. The only hex values live in `BADGE_PALETTE` in `lib/badge.ts`.
- **Test locations:** unit and route tests in `tests/unit/*.test.ts` (node), property tests in `tests/property/*.test.ts`, DOM tests in `tests/dom/*.test.tsx` (jsdom). Property tests use `numRuns >= 100` and a comment `// Feature: graveyard-badges, Property N: <title>`.

## Tasks

- [x] 1. Pure SVG badge builder and its safety tests
  - [x] 1.1 Implement `lib/badge.ts`
    - Export `SEPARATOR` (`" \u00B7 "`), `ELLIPSIS`, size and padding constants, `BadgeStyle`, `BadgeTone`, `BadgeParams`, `BADGE_PALETTE` (closed set, looked up with `Object.hasOwn`), `FALLBACK_NOT_FOUND`, `FALLBACK_UNAVAILABLE`
    - Implement `parseBadgeStyle`, `sanitizeBadgeText`, `truncateBadgeText` (by code point, 63 plus ellipsis), `escapeXml`, `textWidthPx`, `segmentWidthPx`, `isValidRepoName` and `buildBadge`
    - Width_Table for Verdana 11px (printable ASCII plus U+00B7), default 7 px for unknown code points, ellipsis charged the table maximum width
    - Emit a single `<text>` per segment with `textLength`, `<title>` and `aria-label` with identical text, `role="img"`, no gradients, filters, `url(`, `<image>`, `<style>` or links
    - Haunted and Flat layouts; last-resort guard returns a minimal fallback SVG if output reaches 4,096 bytes or building throws
    - No `server-only`, React or Next imports
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 11.1, 11.5_

  - [x] 1.2 Add a strict XML well-formedness helper at `tests/helpers/xml.ts` with its own unit test
    - Tokenizer checks balanced tags, quoted unique attributes, only the five entities and numeric references, no raw `<` or `&` in content, characters within the XML 1.0 `Char` range
    - `tests/unit/xml-helper.test.ts` covers known-good and known-bad fixtures (unclosed tag, raw `&`, duplicate attribute, bad entity, control character)
    - _Requirements: 10.1_

  - [x] 1.3 Write property tests for the builder in `tests/property/badge-builder.test.ts`
    - **Property 1: Output is well-formed XML for any input**
    - **Property 2: Truncation never exceeds 64 and never alters short text**
    - **Property 3: Output is under 4,096 bytes** (include worst-case `'"&<` runs, four-byte emoji, 10,000-character inputs, and both fallback badges)
    - **Property 4: Output is inert**
    - **Property 5: Width is monotone in text length** (including across the 64-character truncation point)
    - **Property 6: Segment widths follow the width formula**
    - **Property 7: Builder is deterministic and substitutes defaults**
    - **Property 8: Accessible name is identical and complete**
    - Generators cover empty, 1,000-character, 10,000-character, unicode, control-character and lone-surrogate strings
    - **Validates: Requirements 3.4, 3.5, 3.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 10.1**

  - [x] 1.4 Write unit tests for palette and width table
    - `tests/unit/badge-palette.test.ts`: every `BADGE_PALETTE` hex value appears in the `@theme` block of `app/globals.css`; the five state fills are pairwise distinct; the neutral fill differs from all five; contrast of each fill/text pair is at least 4.5; the fallback fill is the grey fill
    - `tests/unit/badge-width-table.test.ts`: spot-check known Verdana widths, ellipsis uses the table maximum, unknown code point uses 7, Haunted and Flat output differ in colours
    - `tests/unit/badge-flat-haunted.test.ts`: default style is Haunted, `flat` yields a light two-segment layout, label is always `repo graveyard` when requested by callers
    - _Requirements: 1.7, 2.4, 3.1, 3.2, 3.4, 3.5, 6.8_

- [x] 2. Message composition and name validation
  - [x] 2.1 Implement `lib/badge-messages.ts`
    - `summaryMessage` (order ghost, risen, zombie, at rest, sealed; non-zero only; singular when n is 1; `"empty"` when all zero; invalid counts treated as 0), `summaryTone` (zombie, ghost, risen, tombstone, coffin; `"neutral"` when empty), `repoMessage` (reuses `decayWord`; no digits), `repoTone`
    - Join parts with `SEPARATOR` imported from `lib/badge.ts`
    - Pure module: no `server-only`, React or Next imports
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 2.2, 2.3, 2.4, 2.6_

  - [x] 2.2 Write property tests for messages in `tests/property/badge-messages.test.ts`
    - **Property 9: Summary message lists exactly the non-zero states** (message-composition test: only counts above zero listed, `"empty"` when all zero, singular at 1, separator is exactly `" \u00B7 "`)
    - **Property 10: Summary tone follows urgency**
    - **Property 11: Repo message and tone depend only on state and decay** (null, negative, fractional and out-of-range decay levels)
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.6, 1.7, 2.2, 2.3, 2.4, 2.6, 10.6**

  - [x] 2.3 Write property tests for style and repo-name validation in `tests/property/badge-validation.test.ts`
    - **Property 12: Style parsing is exact** (`"flat"` only; `""`, `"FLAT"`, `"haunted"`, over-32-character strings and null give haunted)
    - **Property 13: Repo-name validation matches the pattern** (the loader-not-called half of this property is asserted in task 6.2)
    - **Validates: Requirements 3.1, 3.3, 5.5, 5.6**

  - [x] 2.4 Write the separator and "Â" unit test in `tests/unit/badge-separator.test.ts`
    - Summary and Repo messages, and the full SVG output of each, never contain U+00C2
    - The separator between message parts is exactly space, U+00B7, space, and the test source writes it with the `\u00B7` escape
    - Source scan: `lib/badge.ts`, `lib/badge-messages.ts`, `lib/badge-snippets.ts` contain no literal U+00B7 or U+00C2 character
    - _Requirements: 1.2, 2.2, 10.7_

- [x] 3. Snippet builder
  - [x] 3.1 Implement `lib/badge-snippets.ts`
    - `encodeSegment` (`encodeURIComponent` plus `! ' ( ) *`), `BadgeTarget`, `BadgeSnippets`, `buildBadgeSnippets(site, target, style)` returning `imageUrl`, relative `previewUrl`, `linkUrl`, `markdown`, `html`
    - `?style=flat` only on image and preview URLs, and only for flat; HTML attribute values escaped with `escapeXml`
    - Markdown form `[![Repo Graveyard](IMG)](LINK)`; owner links to `SITE/g/OWNER`, repo links to `SITE/g/OWNER/REPO`
    - Pure module: no `server-only`, React or Next imports
    - _Requirements: 7.9, 7.10, 7.11, 7.12, 8.3, 8.4_

  - [x] 3.2 Write property tests for snippets in `tests/property/badge-snippets.test.ts`
    - **Property 18: Snippets are single-segment, correctly styled, and round-trip** (owners and repos containing `/`, `?`, `#`, `%`, `(`, `)`, spaces and unicode; both targets; both styles)
    - **Validates: Requirements 7.9, 7.10, 7.11, 7.12, 8.3, 8.4**

- [x] 4. Checkpoint - pure core
  - Run `npx vitest --run`, `npx tsc --noEmit` and `npm run lint`. Ensure all tests pass, ask the user if questions arise.

- [x] 5. Badge service
  - [x] 5.1 Implement `lib/badge-service.ts` (`import "server-only"`)
    - Export `BadgeServiceDeps`, `BADGE_BUCKET`, `BADGE_LIMIT` (600), `BADGE_WINDOW_MS` (3,600,000), `SUCCESS_CACHE_CONTROL`, `FALLBACK_CACHE_CONTROL` (`public, s-maxage=300`), `THROTTLED_CACHE_CONTROL` (`no-store`), and `handleBadgeRequest(request, owner, repo, deps?)`
    - Order: parse style, limiter (`createBucketLimiter` with a failure-flagging store wrapper, `clientIp`, `Promise.race` against a 500 ms timer that is cleared afterwards), validate owner with `isValidUsername` and repo with `isValidRepoName`, `loadGraveyard`, `buildGraveyardPayload` with no overrides, case-insensitive repo lookup, build badge
    - Limiter denial returns the `unavailable` fallback with `no-store`; store throw, hang or timeout fails open
    - Map `not-found` and `invalid-username` to `not found`; `rate-limited`, `server-error` and thrown errors to `unavailable`; invalid names return `not found` without calling the loader
    - Every response is HTTP 200 with `Content-Type: image/svg+xml; charset=utf-8` and `X-Content-Type-Options: nosniff` through one `svgResponse` helper; fallbacks never contain owner or repo text; a hard-coded minimal SVG is the last resort if building throws
    - Log only error kinds with a `[badge]` prefix, never tokens or headers; read-only against GitHub
    - _Requirements: 1.1, 1.5, 1.8, 2.1, 2.5, 2.7, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.5, 11.3, 11.4, 11.5, 11.6_

- [x] 6. Route handlers and server tests
  - [x] 6.1 Add `app/api/badge/[owner]/route.ts` and `app/api/badge/[owner]/[repo]/route.ts`
    - Each exports only `GET`, types `params` as a `Promise`, awaits it inside a guard so a failure still returns the `unavailable` fallback, and calls `handleBadgeRequest`
    - Export no segment config
    - _Requirements: 1.1, 2.1, 5.3, 6.5, 11.5_

  - [x] 6.2 Write property tests for the service in `tests/property/badge-service.test.ts`
    - Mock `load` and the limiter; stub `fetch` to throw so no network is used
    - **Property 13 (loader half): the loader is never called for an invalid owner or repo name**
    - **Property 14: Repo lookup is case-insensitive**
    - **Property 15: Summary counts equal an override-free classification tally**
    - **Property 16: Every service response honours the contract** (status 200, exact `Content-Type`, `nosniff`, well-formed SVG, exact `Cache-Control` per case, limiter denial is exactly `no-store` with no `s-maxage`)
    - **Property 17: Fallback body does not depend on user text**
    - **Validates: Requirements 1.5, 2.1, 2.5, 4.1, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.8, 6.5, 11.4, 11.6**

  - [x] 6.3 Write route tests in `tests/unit/badge-routes.test.ts`
    - Summary badge and Repo badge, each in haunted and flat style, for a known fixture graveyard: well-formed SVG, label `repo graveyard`, expected message
    - Success headers: exact `Cache-Control` of `public, s-maxage=3600, stale-while-revalidate=86400`, exact `Content-Type` of `image/svg+xml; charset=utf-8`, `X-Content-Type-Options: nosniff`
    - One test per error case (unknown user, unknown repo, invalid name, rate-limited, loader failure) for each route where it applies: status 200, grey fallback fill, `not found` or `unavailable` as specified, `s-maxage=300` in `Cache-Control`
    - Limiter rejection: status 200, `unavailable`, `Cache-Control` equals exactly `no-store` and contains no `s-maxage`; a later allowed request for the same URL returns a normal cacheable badge
    - Every error and fallback response also carries the exact `Content-Type` and `nosniff`
    - Limiter configuration (bucket `badge`, 600, 3,600,000 ms, keyed by client IP); fail-open cases with fake timers (store throws, `consume` never resolves, resolves at 499 ms)
    - Invalid style values (`""`, `FLAT`, 33 characters) return a valid Haunted badge
    - Route files export only `GET`, no segment config, and await `ctx.params`
    - _Requirements: 1.1, 1.8, 2.1, 2.7, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.5, 10.2, 10.3, 10.4_

- [x] 7. Shared badge dialog
  - [x] 7.1 Implement `components/badge/BadgeDialog.tsx`, `GetBadgeDialog.tsx` and `RepoBadgeDialog.tsx`
    - `BadgeDialog` props: `target`, `onClose`, `openerRef`; portal to `document.body`, `role="dialog"`, `aria-modal`, `aria-labelledby`; site origin from `resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL).origin`
    - Style state starts at `haunted`; snippets derived with `buildBadgeSnippets` every render so the preview and both snippets update in one commit
    - DOM order: heading, Close, preview `<img>` keyed by `previewUrl` (`onError` swaps in a text fallback naming the owner and repo), two native radio inputs for style, Markdown textarea and Copy, HTML textarea and Copy, `role="status" aria-live="polite"` region
    - Modal behaviour: remember opener, set `inert` on other `document.body` children and restore only those it changed, focus the first focusable element, window-level capture `keydown` handler for Escape and Tab edge wrapping that stops propagation, return focus to the opener on unmount, backdrop click and Close call `onClose`
    - Copy through `navigator.clipboard.writeText` in `try/catch`: `Copied` announced and cleared after 2,000 ms, failure announced with textareas left selectable, timer cleared on unmount
    - `seance-focus` ring on every control, only `motion-safe:` transitions, Tailwind tokens only (no hex)
    - `GetBadgeDialog` passes an owner target; `RepoBadgeDialog` passes a repo target
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 7.2 Write DOM tests in `tests/dom/BadgeDialog.test.tsx` covering both dialogs
    - Markdown and HTML snippets render for each style (owner dialog and repo dialog); `?style=flat` only on the image URL
    - Style toggle switches the preview `src` and both snippets within one `act`; haunted is selected again after close and reopen
    - Copy writes the exact snippet to a mocked `navigator.clipboard.writeText` and the live region reads `Copied`, then clears after 2,000 ms (fake timers); rejected clipboard and missing clipboard show the failure message, keep the dialog open and keep the textareas readable
    - Preview `error` event shows the text fallback naming the owner (and repo) while snippets, Copy buttons and the toggle stay operable
    - Initial focus lands on the first focusable element; Tab on the last and Shift+Tab on the first wrap inside the dialog
    - Escape, Close and backdrop click each close the dialog and return focus to the opener; reopening shows an empty live region
    - `role="dialog"`, `aria-modal`, accessible name; sibling content is `inert` while open and restored on close; every control has `seance-focus`; no unconditional `transition-*` class
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.13, 7.14, 8.2, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.5_

- [x] 8. Wire dialogs into Header and DetailPanel
  - [x] 8.1 Update `components/ui/Header.tsx`
    - `badgeAvailable = mode !== "estate" && username !== ""`
    - At 768 px and above (`!useIsCompact()`) render a "Get a badge" button in the right cluster (`min-h-11 text-sm`, themed border and visible focus ring); below 768 px render a "Get a badge" item in the Menu panel and no header button; never both
    - Render nothing badge-related for the Haunted Estate
    - Open `GetBadgeDialog` with `openerRef` (button or menu item, falling back to the Menu button); the Menu item does not close the Menu on activation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.15_

  - [x] 8.2 Write DOM tests in `tests/dom/HeaderBadge.test.tsx`
    - With `matchMedia` stubbed at 1024 px a real graveyard shows the header button and no Menu item; at 500 px it shows the Menu item and no header button
    - With `mode="estate"` (and with an empty username) both are absent at both widths
    - Button and Menu item open the dialog by click, Enter and Space, and keyboard focus returns to the opener on close
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.15, 10.8_

  - [x] 8.3 Update `components/detail/DetailPanel.tsx`
    - In the Actions section add a "Badge for this repo" button after the séance button, hidden when `isFixture` is true
    - Size it smaller than the header button (`h-9 px-2 text-xs`), same border and focus-ring tokens
    - Open `RepoBadgeDialog` for `owner` and `row.name` with an `openerRef`; opening the dialog and changing style leave panel state unchanged
    - _Requirements: 8.1, 8.2, 8.5, 8.7_

  - [x] 8.4 Write DOM tests in `tests/dom/DetailPanelBadge.test.tsx`
    - "Badge for this repo" is present for a real repo and absent when `isFixture` is true
    - It carries `h-9` and `text-xs` while the header button carries `min-h-11` and `text-sm`
    - Opening via click, Enter and Space shows the preview, style toggle, Markdown and HTML snippets; changing style leaves the panel heading and open state intact; Escape closes only the dialog
    - _Requirements: 8.1, 8.2, 8.5, 8.7, 10.5, 10.8_

- [x] 9. Scope and dependency guards
  - [x] 9.1 Write source-scan tests in `tests/unit/badge-source-scan.test.ts`
    - `lib/badge.ts`, `lib/badge-messages.ts` and `lib/badge-snippets.ts` import no `server-only`, `react`, `next/*` or package
    - `lib/badge-service.ts` and the two route files import `server-only` (or are server-only via the service), and no client component imports them
    - `package.json` `dependencies` and `devDependencies` match a recorded list so no entry was added
    - No code under `lib/badge*` or the badge routes issues a non-GET request or imports override stores (`overrides`, `ownerOverrides`)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 10. Final checkpoint - full verification
  - Run `npx vitest --run`, `npx tsc --noEmit` and `npm run lint`; fix any failure without deleting existing tests. Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 10.9_

## Notes

- All test tasks are required; none carry the optional `*` marker.
- Each property test references its design property number and the requirements it validates.
- Rendering in real browsers and GitHub's image proxy is checked manually once by embedding a deployed badge in a scratch README; the dialogs' visual quality is covered by the `/design-review` pass.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "5.1", "7.1"] },
    { "id": 3, "tasks": ["6.1", "7.2", "8.1", "8.3"] },
    { "id": 4, "tasks": ["6.2", "6.3", "8.2", "8.4", "9.1"] }
  ]
}
```
git log -p --all | Select-String -Pattern "sk-ant-[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}" | Select-Object -First 5