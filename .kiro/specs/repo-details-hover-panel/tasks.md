# Implementation Plan: Repo details — hover card + detail panel

## Overview

This plan builds Spec 3 incrementally, additively and presentationally over the frozen lifecycle classification and the existing scene. It sequences the work so the pure, property-tested modules (`lib/repoDetails/*`, `lib/repoRow.ts`, the data-layer mapping) land before the React surfaces that consume them, and each step wires into the previous ones with no big-bang integration.

Conventions pulled from the design's Testing Strategy, applied throughout:

- Tests run under **Vitest**: unit tests in `tests/**/*.test.ts` (node env), DOM tests in `tests/**/*.test.tsx` (jsdom env), **fast-check** property tests under `tests/property/` at **≥ 100 iterations**, tagged `Feature: repo-details-hover-panel, Property N: <name>`.
- DOM tests use `@testing-library/react` + `@testing-library/user-event`; **`@testing-library/jest-dom` is NOT installed** — use plain DOM assertions, matching the existing `tests/dom/*` pattern.
- Verify with `vitest --run` and `tsc --noEmit`. **Do NOT run `next build` while the dev server is running** (both use Turbopack and will contend); the dev server must be started manually in a separate terminal.
- **Existing tests MUST NOT be deleted without asking.** This spec adds new tests and extends existing test files only.
- `lib/lifecycle.ts` classification code (`classify`, `daysQuiet`, `isFinished`/`countSignals`) and all thresholds stay untouched; `RepoFacts.primaryLanguage` stays `string | null` (not widened).

## Tasks

- [x] 1. Extend the data layer with the new repository fields (additive, `primaryLanguage` unchanged)
  - [x] 1.1 Extend `GRAVEYARD_QUERY`, `RawRepoNode`, and `mapRepoNode` in `lib/github.ts`
    - Add to each repository node in the single existing query: `forkCount`, `color` on the existing `primaryLanguage { name }` selection, and `repositoryTopics(first: 5) { nodes { topic { name } } }`. No new queries; keep the ≤ 6 pages × ≤ 50 repos page size unchanged.
    - Extend `RawRepoNode`: `primaryLanguage: { name: string; color: string | null } | null`, `forkCount: number`, `repositoryTopics: { nodes: { topic: { name: string } }[] }`.
    - Extend `mapRepoNode`: keep `primaryLanguage` as `node.primaryLanguage?.name ?? null` (unchanged string shape); add `languageColor = node.primaryLanguage?.color ?? null`, `forkCount = node.forkCount`, `topics = node.repositoryTopics.nodes.map(n => n.topic.name).slice(0, 5)`.
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_
    - _Design: Data layer / lib/github.ts_

  - [x] 1.2 Add the three additive fields to `RepoFacts` in `lib/lifecycle.ts`
    - Add `languageColor: string | null`, `forkCount: number`, `topics: string[]` (length 0..5) to the `RepoFacts` interface.
    - Do NOT widen `primaryLanguage` (stays `string | null`); do NOT edit `classify`, `daysQuiet`, `isFinished`/`countSignals`, or any threshold in `LIFECYCLE_CONFIG`.
    - _Requirements: 1.3, 1.4, 9.6_
    - _Design: Data layer / lib/lifecycle.ts (three additive fields)_

  - [x] 1.3 Extend the cache zod schema in `lib/cache.ts`
    - Add `languageColor: z.string().nullable()`, `forkCount: z.number().int().nonnegative()`, `topics: z.array(z.string()).max(5)`; keep `primaryLanguage: z.string().nullable()` unchanged so old-shape cached payloads are treated as a miss.
    - _Requirements: 1.3_
    - _Design: Data layer / lib/cache.ts_

  - [x] 1.4 Extend the estate fixture schema and resolver in `lib/estate-schema.ts` and `lib/estate.ts`
    - Add to `estateRepoSchema` optional `languageColor` (`z.string().nullable().optional()`, default `null`), optional `forkCount` (`z.number().int().nonnegative().optional()`, default 0), optional `topics` (`z.array(z.string()).max(5).optional()`, default `[]`). Keep `primaryLanguage` as the string form.
    - Update `resolveEstate` to emit the three new additive `RepoFacts` fields with those defaults.
    - _Requirements: 1.3, 1.4, 1.5, 1.7_
    - _Design: Data layer / lib/estate-schema.ts + lib/estate.ts_

  - [x] 1.5 Extend `tests/github.test.ts` with unit tests for the query and mapping
    - Assert `GRAVEYARD_QUERY` includes `forkCount`, `primaryLanguage { name color }`, and `repositoryTopics(first: 5)`, and still issues ≤ 6 pages of ≤ 50 (Req 1.1, 1.2).
    - Example `mapRepoNode` cases: `primaryLanguage` stays the plain name string and the color lands on `languageColor`; absent language → both null; absent topics → `[]`; > 5 topics → first 5 in order; `forkCount` carried unchanged.
    - Do not delete existing assertions.
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_
    - _Design: Testing Strategy / Unit tests_

  - [x] 1.6 Extend `tests/property/github-mapping.property.test.ts` for Property 8
    - **Property 8: Node mapping maps language into two fields, caps topics, and preserves forkCount**
    - **Validates: Requirements 1.4, 1.5, 1.6**
    - Reuse the local `RawRepoNode` generator; assert missing language → `primaryLanguage = null` and `languageColor = null`, else name→`primaryLanguage` (string) and `color ?? null`→`languageColor`; absent topics → `[]`; > 5 topics → first 5 in order; `forkCount` unchanged. Tag `Feature: repo-details-hover-panel, Property 8: Node mapping maps language into two fields`. ≥ 100 iterations.
    - _Requirements: 1.4, 1.5, 1.6_
    - _Design: Correctness Properties / Property 8_

- [x] 2. Implement the pure link/security modules in `lib/repoDetails/` with property tests
  - [x] 2.1 Implement `lib/repoDetails/githubUrl.ts`
    - `buildGitHubUrl(owner, name)` returns `https://github.com/` + `encodeURIComponent(owner)` + `/` + `encodeURIComponent(name)`. Pure + total; never a `javascript:`/`data:`/other scheme for any input.
    - _Requirements: 9.1, 11.6, 11.8_
    - _Design: Pure detail logic / lib/repoDetails/githubUrl.ts_

  - [x] 2.2 Write property test `tests/property/githubUrl.property.test.ts`
    - **Property 1: GitHub URL origin is always github.com and never a dangerous scheme**
    - **Validates: Requirements 9.1, 11.6, 11.8**
    - Generators include adversarial owner/name (`javascript:`, `data:`, `..`, slashes, whitespace, unicode, percent-encoded). Assert parsed origin is exactly `https://github.com` and scheme exactly `https`. Tag `Feature: repo-details-hover-panel, Property 1: GitHub URL origin is always github.com`. ≥ 100 iterations.
    - _Requirements: 9.1, 11.6, 11.8_
    - _Design: Correctness Properties / Property 1_

  - [x] 2.3 Implement `lib/repoDetails/homepage.ts`
    - `isValidHttpsHomepage(raw)` returns true iff the parsed scheme is exactly `https:` (try/catch, never throws). `homepageDomain(raw)` returns the host (registered domain + subdomains) with no scheme/path/query/fragment when valid, else `null`.
    - _Requirements: 9.2, 9.3, 11.7, 11.8_
    - _Design: Pure detail logic / lib/repoDetails/homepage.ts_

  - [x] 2.4 Write property test `tests/property/homepage.property.test.ts`
    - **Property 2: Homepage validator accepts only https and never throws**
    - **Validates: Requirements 9.2, 9.3, 11.7, 11.8**
    - For any string or null: `isValidHttpsHomepage` true iff scheme is exactly `https`, never throws; when true `homepageDomain` returns a non-empty host with no scheme/path/query/fragment, else `null`. Tag `Feature: repo-details-hover-panel, Property 2: Homepage validator accepts only https`. ≥ 100 iterations.
    - _Requirements: 9.2, 9.3, 11.7, 11.8_
    - _Design: Correctness Properties / Property 2_

- [x] 3. Implement the pure duration + explanation modules in `lib/repoDetails/`
  - [x] 3.1 Implement `lib/repoDetails/quietPhrase.ts`
    - `quietPhrase({ pushedAt, createdAt }, renderedAt)` reuses the ISO-parse + `msPerDay` discipline from `lib/lifecycle.ts`: prefer `pushedAt` else `createdAt`; fixed fallback phrase when neither usable; clamp negative/future durations to the zero-duration phrase; compose years/months granularity. Pure + total, reads no clock.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.8_
    - _Design: Pure detail logic / lib/repoDetails/quietPhrase.ts_

  - [x] 3.2 Write property test `tests/property/quietPhrase.property.test.ts`
    - **Property 3: Quiet phrase is total, deterministic, and clamps future timestamps**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.8**
    - Generators include valid ISO, null, and unparseable strings plus future `renderedAt`. Assert same non-empty string for same inputs, never throws/`NaN`/`undefined`; future reference → zero-duration phrase; absent `pushedAt` → computed from `createdAt`; both unusable → fixed fallback. Tag `Feature: repo-details-hover-panel, Property 3: Quiet phrase is total, deterministic`. ≥ 100 iterations.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.8_
    - _Design: Correctness Properties / Property 3_

  - [x] 3.3 Implement `lib/repoDetails/explanationLine.ts`
    - One plain-English sentence stating the REAL reason, derived only from the classification result + the SAME facts/predicates `lib/lifecycle.ts` uses: `daysQuiet`/`quietPhrase` for the quiet clause, `isFinished`/`countSignals` (releases, homepage, README bytes > threshold, finished keyword, popularity) for tombstones, `facts.isArchived`/`facts.isFork`, and `revivedAt` + remaining revive window for risen. Re-derives no classification and changes no threshold. Pure + total, reads no clock. For tombstones the sentence names at least one finished signal `countSignals` found.
    - _Requirements: 6.3, 11.5, 11.8_
    - _Design: Pure detail logic / lib/repoDetails/explanationLine.ts_

  - [x] 3.4 Write example unit tests `tests/explanationLine.test.ts`
    - One example sentence per state asserting the real-reason wording: ghost last-push phrasing, zombie "no signs it was finished", risen revive-date + days-remaining, tombstone naming README/releases, coffin "Archived on GitHub".
    - _Requirements: 6.3, 11.5_
    - _Design: Testing Strategy / Unit tests_

  - [x] 3.5 Write property test `tests/property/explanationLine.property.test.ts`
    - **Property 4: Explanation line is total and deterministic**
    - **Validates: Requirements 6.3, 11.5, 11.8**
    - **Property 5: Tombstone explanation names a real finished signal**
    - **Validates: Requirements 6.3, 11.5**
    - Generators build facts spanning every state and, for tombstones, every combination of finished signals. Property 4: same single non-empty sentence for same inputs, reads no clock, never throws/`NaN`/`undefined`. Property 5: a tombstone sentence mentions at least one actual `countSignals` finished signal. Tags `Feature: repo-details-hover-panel, Property 4: Explanation line is total and deterministic` and `Feature: repo-details-hover-panel, Property 5: Tombstone explanation names a real finished signal`. ≥ 100 iterations each.
    - _Requirements: 6.3, 11.5, 11.8_
    - _Design: Correctness Properties / Property 4, Property 5_

- [x] 4. Implement the validated view-model `lib/repoRow.ts` (validate-first pipeline stage)
  - [x] 4.1 Implement `RepoLanguage`, `RepoRow`, `repoRowSchema`, and `buildRepoRows`
    - Declare `RepoLanguage { name; color }` (UI-only, not a `RepoFacts` field type) and the `RepoRow` interface. `repoRowSchema` enforces Req 1.3 ranges (`forkCount` 0..2,147,483,647, `primaryLanguage` null or `{ name 1..255, color? }`, `topics` max 5, non-negative integer counts).
    - `buildRepoRows(repos: RepoFacts[]): RepoRow[]` composes each record — `primaryLanguage: facts.primaryLanguage === null ? null : { name: facts.primaryLanguage, color: facts.languageColor }` — then `safeParse`s each row; on success push in original order; on failure `console.warn` naming the repo and offending field and skip only that row. Pure + total, never throws for the page.
    - _Requirements: 1.3, 1.8_
    - _Design: Data layer / lib/repoRow.ts; Error Handling_

  - [x] 4.2 Write example unit tests `tests/repoRow.test.ts`
    - Skip-and-warn example cases (negative `forkCount`, > 5 topics) keeping other valid rows; assert `primaryLanguage` composed into `{ name, color }` from `RepoFacts.primaryLanguage` + `RepoFacts.languageColor`.
    - _Requirements: 1.3, 1.8_
    - _Design: Testing Strategy / Unit tests_

  - [x] 4.3 Write property test `tests/property/repoRow.property.test.ts`
    - **Property 7: Repo-row validation never throws for a page and keeps all valid records**
    - **Validates: Requirements 1.3, 1.8**
    - Generators mix valid rows with field-violating rows; assert `buildRepoRows` returns exactly the valid records in original order, skips invalid ones, never throws. Tag `Feature: repo-details-hover-panel, Property 7: Repo-row validation never throws for a page`. ≥ 100 iterations.
    - _Requirements: 1.3, 1.8_
    - _Design: Correctness Properties / Property 7_

- [x] 5. Implement the pure deep-link helpers in `lib/repoDetails/deepLink.ts`
  - [x] 5.1 Implement `matchRepoParam` and `withRepoParam`
    - `matchRepoParam(rows, param)` returns the loaded repo name whose `name` equals `param` case-insensitively, else `null`. `withRepoParam(search, repo)` returns a search string with `repo` set or removed while preserving `at`. Pure + total.
    - _Requirements: 8.1, 8.2, 8.4, 8.7_
    - _Design: Deep-link controller / lib/repoDetails/deepLink.ts_

  - [x] 5.2 Write unit tests `tests/deepLink.test.ts`
    - `matchRepoParam` case-insensitive match and miss (→ null); `withRepoParam` sets, removes, and preserves `at` in all orderings.
    - _Requirements: 8.1, 8.2, 8.4, 8.7_
    - _Design: Testing Strategy_

- [x] 6. Checkpoint — ensure all pure-module tests pass
  - Run `vitest --run` and `tsc --noEmit`; confirm the three additive `RepoFacts` fields type-check and `primaryLanguage` stays `string | null`. Do not run `next build` while the dev server is running. Ensure all tests pass, ask the user if questions arise.

- [x] 7. Wire validation-before-classification into `SceneView`
  - [x] 7.1 Thread `buildRepoRows` as the first pipeline stage and key rows by name
    - In `SceneView` run `buildRepoRows(repoFacts)` first; build the validated name set; pass only that validated set into classification (`buildRows`) so a skipped repo has neither a creature nor a row. Expose a `RepoRow[]` lookup keyed by name for both surfaces. No threshold or classification change.
    - _Requirements: 1.8_
    - _Design: Key architectural decisions #1; Pipeline order_

  - [x] 7.2 Write property test `tests/property/repoRows-no-orphans.property.test.ts`
    - **Property 6: Only validated repos become creatures (no orphans)**
    - **Validates: Requirements 1.8**
    - Generators mix valid and field-violating `RepoFacts`; assert the classified creature-name set equals the `buildRepoRows` name set, and a name absent from the rows yields a null-rendering surface. Tag `Feature: repo-details-hover-panel, Property 6: Only validated repos become creatures`. ≥ 100 iterations.
    - _Requirements: 1.8_
    - _Design: Correctness Properties / Property 6_

  - [x] 7.3 Write DOM test `tests/dom/SceneViewPipeline.test.tsx`
    - A `RepoFacts` set containing an invalid record renders creatures only for validated names (invalid repo has neither a creature nor a row), demonstrating validation precedes classification and no orphan creatures. Plain DOM assertions.
    - _Requirements: 1.8_
    - _Design: Testing Strategy / DOM tests_

- [x] 8. Implement the shared `ExternalLink` component and plain-text rendering
  - [x] 8.1 Implement `components/detail/ExternalLink.tsx`
    - Render `<a target="_blank" rel="noopener noreferrer">` with a trailing "↗" marker and a visually hidden `sr-only` "(opens in a new tab)" span. Render description/topics as React text children (never `dangerouslySetInnerHTML`).
    - _Requirements: 9.4, 9.5_
    - _Design: Components / ExternalLink.tsx; PlainText rendering_

  - [x] 8.2 Write DOM test `tests/dom/ExternalLink.test.tsx`
    - Assert `target`/`rel`/↗ marker/sr-only text present; assert an HTML-significant string passed as text content renders literally (no injected markup). Plain DOM assertions.
    - _Requirements: 9.4, 9.5_
    - _Design: Testing Strategy / DOM tests_

- [x] 9. Implement the hover-card interaction state and layer
  - [x] 9.1 Implement `components/detail/HoverCardProvider.tsx` (isolated state)
    - Hold `{ openFor: string | null; trigger: "pointer" | "focus" | null }`, the 250 ms dwell timer, 150 ms close-grace timer, single-open enforcement, a "panel open or travel running" suppression flag, and a "suppress reopen on focus-return after panel close" flag. Read pointer capability once via `matchMedia("(hover: hover) and (pointer: fine)")` to gate pointer-triggered cards on coarse devices. Expose memoized, stable-identity callbacks: `onPointerEnter`, `onPointerLeave`, `onFocus`, `onBlur`, `closeNow`.
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.9, 2.10, 2.11, 2.12, 2.13, 5.4_
    - _Design: Hover card / HoverCardProvider.tsx; Key architectural decisions #2_

  - [x] 9.2 Implement `components/detail/HoverCardLayer.tsx` (portal, positioning)
    - Subscribe to the provider; render at most one card in a portal at `z-[60]` above lantern (z 35) and fog. Anchor within 12 px; flip through ordered `below → above → right → left` with an 8 px viewport margin; clamp top-left into viewport when nothing fits. While open, re-measure `getBoundingClientRect` and re-run flip/clamp on `scroll` (capture), `resize`, and each parallax frame (hooked into `useParallax`'s per-frame signal), rAF-throttled; close when the anchor leaves the viewport. Attach listeners only while open and tear down on close. Keyboard-focus mode: `role="tooltip"` with an `id` referenced by `aria-describedby`, no focusable elements, opens within 50 ms. Reduced motion: opacity-only, no positional slide.
    - _Requirements: 2.3, 2.7, 2.8, 4.1, 4.2, 4.3, 4.4, 10.4_
    - _Design: Hover card / HoverCardLayer.tsx; Key architectural decisions #3_

  - [x] 9.3 Implement `components/detail/HoverCard.tsx` (content)
    - Return `null` on row-lookup miss. Else show name; `Decay_Word` + `Quiet_Phrase` via `quietPhrase`; description clamped to 2 lines with ellipsis as plain text, or "No epitaph was written." when empty/whitespace; language name + color dot (fixed fallback color when none); star count as non-negative integer; "Open on GitHub ↗" `ExternalLink` to `buildGitHubUrl(owner, name)`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
    - _Design: Hover card / HoverCard.tsx_

  - [x] 9.4 Wire interaction props into `Creature` within `DepthScatter` only
    - Add optional `onHoverStart`, `onHoverEnd`, `onFocusStart`, `onBlurEnd`, `hoverCardId` (for `aria-describedby`) to `Creature`, threaded from the context's stable callbacks via `DepthScatter`; keep existing click/Enter/Space activation (`onSelect`). Plaque rest maps to the same creature intent. Leave `EstateMap` representatives non-interactive — no hover context wiring, no `hoverCardId`, place-button navigation unchanged.
    - _Requirements: 2.1, 2.2, 2.13, 10.1_
    - _Design: Hover card / Creature.tsx (only within DepthScatter); component tree_

  - [x] 9.5 Write DOM test `tests/dom/HoverCard.test.tsx`
    - Dwell open after 250 ms and cancel if pointer leaves before dwell (2.1, 2.2); single card at a time (2.4); move-into-card keeps it open (2.5); close after 150 ms grace (2.6); keyboard focus opens immediately as `role="tooltip"` via `aria-describedby` with no focusable children (2.3); Escape closes (2.8); blur closes (2.7); no reopen on focus-return after panel close (2.10); suppressed while the panel is open, closed via `closeNow()` when it opens (2.11, 2.12); with `SceneView`'s travel state active no Hover_Card opens, and when a travel starts while a card is open the card closes via `closeNow()` (2.11, 2.12); coarse pointer never opens on pointer interaction (2.9); content + plain-text/"No epitaph" (3.1–3.8); reduced-motion no-slide (10.4). Plain DOM assertions.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 3.1-3.8, 10.4_
    - _Design: Testing Strategy / DOM tests_

  - [x] 9.6 Write DOM test `tests/dom/HoverCardIsolation.test.tsx`
    - Assert opening/closing a card does not re-render the creature layer (creature render spy not called on hover changes).
    - _Requirements: 2.13_
    - _Design: Testing Strategy / DOM tests_

  - [x] 9.7 Write DOM test `tests/dom/HoverCardPosition.test.tsx`
    - Anchored within 12 px (4.1); flips in ordered directions to stay in-viewport (4.2); clamps when nothing fits (4.3); renders above lantern + fog (4.4). While open, moving the anchor via `scroll`/`resize`/simulated parallax frame re-runs flip/clamp within 12 px, and moving fully off-screen closes the card. Stub `getBoundingClientRect`/viewport.
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
    - _Design: Testing Strategy / DOM tests_

- [x] 10. Checkpoint — ensure hover-card tests pass
  - Run `vitest --run` and `tsc --noEmit`. Do not run `next build` while the dev server is running. Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement the detail panel dialog
  - [x] 11.1 Implement `components/detail/DetailPanel.tsx` shell and modal behavior
    - Props `{ row; owner; classification; facts; renderedAt; isFixture; revivedAt?; onClose }`. Return `null` when `row` is undefined (lookup miss) and apply no inert/scroll-lock. Render the `DetailPanel` portal OUTSIDE the element that receives `inert`, so the panel and its overlay are never inert; `inert` goes only on the scene root element, which must not contain the portal target. On open set `inert` on that scene root, lock page scroll capturing `window.scrollY`; on close and in effect cleanup remove `inert`, release scroll lock, restore scroll position. Layout: `≥768px` right-side drawer 420 px (clamped to viewport width), `<768px` bottom sheet `max-height: 85vh` scrollable, branch via `matchMedia("(min-width: 768px)")`. Overlay 35–50% opacity, scene visible, click-to-close. `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → heading id. Focus first control within 100 ms, trap Tab/Shift+Tab with wrap, Escape/close within 100 ms, return focus to opening creature or persistent fallback. Close control with accessible name "Close record" and `candle-400` focus ring. Reduced motion: fade 0→1 within 200 ms, no slide. Opening does not start travel, change place, or change filter.
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 10.3_
    - _Design: Detail panel / DetailPanel.tsx; Key architectural decisions #5, #6; Error Handling_

  - [x] 11.2 Implement `DetailPanel` content
    - Name + owner (6.1); creature type + `Decay_Word` as pill badges (6.2); `Explanation_Line` via `explanationLine` using the passed `facts`/`revivedAt` (6.3); description as plain text or "No epitaph was written." (6.4, 6.5); up to 5 topic chips as plain text (6.6); star/fork/open-issue counts as non-negative integers (6.7); language name + color dot (6.8); created + last-push dates relative to `renderedAt` (6.9); "Archived" badge when archived (6.10); "Fork" badge when a fork (6.11); "Open on GitHub ↗" primary `ExternalLink` (6.12); homepage `ExternalLink` showing only its domain when valid https, omitted entirely otherwise (6.13, 9.2, 9.3); empty `<section aria-label="Actions" data-slot="actions" />` with no text/controls (6.14).
    - _Requirements: 6.1-6.14, 9.2, 9.3_
    - _Design: Detail panel / DetailPanel content_

  - [x] 11.3 Wire `SceneView` selection to render `DetailPanel`
    - Use the existing `handleSelect`/`selected` entry point (click/Enter/Space already wired through `Creature` → `DepthScatter` → `PlaceView`) to render `DetailPanel` when a repo is selected and the panel is open, passing the validated `RepoRow`, owner, classification, facts, `renderedAt`, `isFixture`, and `revivedAt`. Close any open hover card as the panel opens.
    - `SceneView` sets the `HoverCardProvider` suppression flag while `travel.active` is true, and calls `closeNow()` when a travel starts, the same way it does when the panel opens.
    - _Requirements: 2.11, 2.12, 5.1, 5.3, 5.8_
    - _Design: Key architectural decisions #5_

  - [x] 11.4 Write DOM test `tests/dom/DetailPanel.test.tsx`
    - Opens on click/Enter/Space (5.1), Space suppresses page scroll (5.2), closes same-creature hover card as it opens (5.3), coarse tap opens panel directly (5.4), drawer vs bottom-sheet by width (5.5, 5.6), overlay dims + click-close (5.7), open does not start travel/change place/change filter (5.8); content 6.1–6.14 incl. empty `Actions_Slot` landmark with no controls and the explanation naming the real reason (6.3); dialog semantics (7.1), focus-in (7.2), focus trap wrap (7.3), close control accessible name (7.4), Escape + close within 100 ms (7.5), focus return (7.6) + persistent fallback (7.7), candle-400 ring (7.8); reduced-motion fade (10.3); plain-text description renders HTML literally (9.5); external-link attributes (9.4); while open scene root carries `inert` and loses it on close; the panel dialog and overlay are not inside an inert subtree (no ancestor of the dialog has `inert`, and the dialog is focusable/operable while the scene root is inert); scroll locked while open and restored on close/unmount; defensive: lookup miss renders nothing and applies no inert/scroll lock. Plain DOM assertions.
    - _Requirements: 5.1-5.8, 6.1-6.14, 7.1-7.8, 9.4, 9.5, 10.3_
    - _Design: Testing Strategy / DOM tests_

- [x] 12. Implement the deep-link controller in `SceneView`
  - [x] 12.1 Implement `useRepoDeepLink()` and integrate with `?at=`
    - On initial render read `?repo=`; if it matches a loaded repo case-insensitively (via `matchRepoParam`) open that panel without pushing history; if it matches nothing leave all panels closed. On in-page open `history.pushState` setting `?repo=<name>` preserving `?at=` (via `withRepoParam`), recording that the open pushed an entry. On in-page close: if the open pushed an entry call `history.back()`; if it came from a loaded URL that already carried `?repo=` call `history.replaceState` to strip `?repo=` preserving `?at=`. Extend the existing `popstate` listener so Back while open closes the panel and is never a no-op. Client-only; no server re-render, `renderedAt`/rows frozen.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
    - _Design: Deep-link controller / useRepoDeepLink()_

  - [x] 12.2 Write DOM test `tests/dom/RepoDeepLink.test.tsx`
    - In-page open pushes `?repo=` preserving `?at=` (8.1); load with case-insensitive matching `?repo=` opens without pushing (8.2); in-page close after a push calls `history.back()` (8.3); loaded-URL open close strips `?repo=` via `replaceState` preserving `?at=` (8.4); Back while open closes and is not a no-op (8.5); non-matching `?repo=` leaves all panels closed (8.7); no server re-render / `renderedAt` unchanged (8.6). Plain DOM assertions.
    - _Requirements: 8.1-8.7_
    - _Design: Testing Strategy / DOM tests_

- [x] 13. Implement sample-estate fixture handling
  - [x] 13.1 Thread `isFixture` and render the "Sample repository" note
    - Pass `isFixture = (mode === "estate")` to the panel and hover card for the `DepthScatter` fixture creatures. When true, render no `GitHub_Link`/`Homepage_Link`; show a "Sample repository" note in the panel in place of the external links and in the hover card where the GitHub link would be. Ensure these render in the DOM on the `/estate` route.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
    - _Design: Sample estate (Req 12)_

  - [x] 13.2 Write DOM test on the `/estate` data path
    - Extend `tests/dom/SceneView.test.tsx` or add `tests/dom/SceneViewEstateDetail.test.tsx`: fixture creatures (inside a place via `DepthScatter`) show the "Sample repository" note and render no external links (12.2–12.5). Do not delete existing assertions.
    - _Requirements: 12.2, 12.3, 12.4, 12.5_
    - _Design: Testing Strategy / DOM tests_

  - [x] 13.3 Write DOM test `tests/dom/EstateMapNonInteractive.test.tsx`
    - Assert estate-map creature representatives (`EstateMap.tsx`) are not wired to the hover context: hovering/focusing a representative opens no hover card, and activating the place button navigates into the place without opening a detail panel.
    - _Requirements: 10.1_
    - _Design: Scope: interactive creatures only (DepthScatter)_

- [x] 14. Cross-cutting behavior across places and lights modes
  - [x] 14.1 Write DOM test `tests/dom/CrossPlaceModes.test.tsx`
    - Assert hover/panel behave identically across sky, gate, ground, and crypt and with lights on vs off. Plain DOM assertions.
    - _Requirements: 10.1, 10.2_
    - _Design: Testing Strategy / DOM tests_

- [x] 15. Final checkpoint — full verification
  - Run `vitest --run` (all unit, DOM, and property tests at ≥ 100 iterations) and `tsc --noEmit`. Confirm `lib/lifecycle.ts` classification and thresholds remain unchanged and `RepoFacts.primaryLanguage` is still `string | null`. Do not run `next build` while the dev server is running. Ensure all tests pass, ask the user if questions arise.

## Notes

- All test tasks (unit, DOM, and property tests) are required and must be completed; none are optional.
- Each task references the specific requirement clauses and design section it implements for traceability.
- Pure, property-tested modules (`lib/repoDetails/*`, `lib/repoRow.ts`, the data-layer mapping) land before the React surfaces that consume them.
- All eight correctness properties are covered: P1 (2.2), P2 (2.4), P3 (3.2), P4+P5 (3.5), P6 (7.2), P7 (4.3), P8 (1.6).
- Existing tests MUST NOT be deleted without asking. Verify with `vitest --run` and `tsc --noEmit`; never run `next build` while the dev server is running.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.3", "3.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.4", "3.2", "5.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "3.3"] },
    { "id": 3, "tasks": ["1.5", "1.6", "3.4", "3.5", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "8.1"] },
    { "id": 5, "tasks": ["7.1", "8.2", "9.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "9.2", "9.3"] },
    { "id": 7, "tasks": ["9.4", "11.1"] },
    { "id": 8, "tasks": ["9.5", "9.6", "9.7", "11.2"] },
    { "id": 9, "tasks": ["11.3"] },
    { "id": 10, "tasks": ["11.4", "12.1"] },
    { "id": 11, "tasks": ["12.2", "13.1"] },
    { "id": 12, "tasks": ["13.2", "13.3", "14.1"] }
  ]
}
```
