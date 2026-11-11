# Implementation Plan: Revive in Kiro

## Overview

The plan builds the pure brief builder first (`lib/revive-brief.ts`), then the dialog and button components, then the additive wiring in `KiroSlot.tsx` and `SeanceRegion.tsx`, then the DOM tests and the source scan. The language is TypeScript. Tests use Vitest and fast-check v4.

Constraints for every task:

- Verification commands are limited to `npx vitest --run`, `npx tsc --noEmit` and `npm run lint`. Do not run `next build`.
- Do not delete or change any existing test. If the Spec 4 empty-slot test in `tests/dom/SeanceVerdict.test.tsx` appears to need a change, stop and ask the user before editing it. Under this design it should pass unchanged.
- Edit files with the file-editing tools, not PowerShell.
- Edits to existing Spec 4 files are limited to `components/seance/KiroSlot.tsx` and `components/seance/SeanceRegion.tsx`.
- No new runtime dependency, no network request, no hard-coded colour literals in new component sources.

Property tests are split into one file per property under `tests/property/` (named `revive-p<N>-<topic>.property.test.ts`) so they can run in parallel. Each runs at least 100 times (`numRuns: 100`) and starts with the comment `// Feature: revive-in-kiro, Property N: <title>`.

## Tasks

- [x] 1. Build the pure text foundation in `lib/revive-brief.ts`
  - [x] 1.1 Create `lib/revive-brief.ts` with the shared exports and text pipeline
    - Export the constants `BRIEF_FILE_NAME`, `BRIEF_SIZE_CAP` (8192), `PROMPT_SIZE_CAP` (2048), `DATA_NOTICE`, `EMPTY_PLACEHOLDER`, `ESTATE_DEMO_NOTICE` and the `ReviveFacts` interface
    - Implement `utf8Length`, `isEstateOwner` (true when `owner.trim() === ""`), `slugify` (falls back to `repo`), and `sanitiseInline` (scrub lone surrogates, collapse line breaks and whitespace, neutralise the Data_Notice repeatedly, `(empty)` placeholder, escape fences, escape block-start characters)
    - Implement `escapeName` (backslash-escape `\ [ ] ( )` and `<`, `(unknown)` placeholder) and `buildCloneCommand` with strict percent-encoding of each segment (empty segment becomes `unknown`)
    - No `server-only` import, no `Date`, no randomness, no I/O. Functions never throw for any string input
    - _Requirements: 5.1, 5.7, 5.9, 5.11, 6.1, 6.2, 6.3, 6.7, 6.9, 6.10, 7.9, 3.8, 3.16_

  - [x] 1.2 Create the shared fast-check generators in `tests/property/revive-arbitraries.ts`
    - Export `hostileText` (binary Unicode with astral characters and lone surrogates, markdown fragments, Data_Notice variants, empty and whitespace-only strings), `hostileResult` (0 to 4 items), `oversizeResult` (schema-maximum astral text), `facts` (hostile names, GitHub-style names, empty owner), and marker-token helpers
    - Reuse `validSeanceResult` from the existing `tests/property/seance-arbitraries.ts` and do not modify that file
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 1.3 Write property test for sanitised text
    - **Property 2: Sanitised text is one inert line**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.7, 6.10, 7.9**

  - [x] 1.4 Write property test for names and the clone command
    - **Property 6: Names cannot break the link, and the clone command is inert**
    - **Validates: Requirements 3.8, 6.9**

  - [x] 1.5 Write property test for slugs
    - **Property 8: Slugs are always valid**
    - **Validates: Requirements 5.7, 5.9**

- [x] 2. Implement the brief and prompt renderers with size caps
  - [x] 2.1 Add `renderReviveBrief`, `buildReviveBrief` and `buildKiroPrompt` to `lib/revive-brief.ts`
    - Render the brief layout from the design: title, repository link, state, `causeHeading(state)` section, numbered unfinished business with the Data_Notice line before each blockquote evidence line, the "No unfinished business was found." line, First step, How to use this in Kiro. Never use `voice`
    - Implement `ellipsize` and the deterministic size loop: shorten detail then evidence from the last item backwards, then remove items from the end and add the "Some items were left out to keep this brief short." line. Support `options.capBytes` (including `Infinity`) as a test seam
    - Render the prompt layout (read REVIVAL.md first, spec `revive-{slug}`, EARS, Data_Notice, repository name, First step) and shorten First step then repository name until it is at most 2048 bytes
    - Cuts happen on raw text at code-point boundaries and never split a surrogate pair or an added escape
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.10, 5.12, 6.4, 6.5, 6.6, 6.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 2.2 Write property test for determinism
    - **Property 1: Builders are deterministic**
    - **Validates: Requirements 5.1, 5.12, 7.7, 8.3**

  - [x] 2.3 Write property test for fixed brief structure
    - **Property 3: The brief keeps a fixed structure for any model text**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.10, 6.4, 6.5, 6.6, 6.7, 8.6**

  - [x] 2.4 Write property test for hostile text and document skeleton
    - **Property 4: Hostile text cannot change the document skeleton**
    - **Validates: Requirements 6.1, 6.6, 6.7, 8.7**

  - [x] 2.5 Write property test for content survival when nothing is cut
    - **Property 5: Content survives when nothing is cut**
    - **Validates: Requirements 5.3, 8.4**

  - [x] 2.6 Write property test for prompt grounding
    - **Property 7: The prompt is grounded and carries no foreign model text**
    - **Validates: Requirements 5.7, 5.8, 5.10, 6.8**

  - [x] 2.7 Write property test for size caps
    - **Property 9: Size caps hold for any input**
    - Measure bytes with `new TextEncoder().encode(text).length` and assert `utf8Length` agrees
    - **Validates: Requirements 7.1, 7.2, 7.6, 8.5**

  - [x] 2.8 Write property test for ordered shortening
    - **Property 10: Shortening is ordered, bounded and a no-op when unneeded**
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.8**

  - [x] 2.9 Write property test for well-formed Unicode
    - **Property 11: Output is well-formed Unicode and escapes are never split**
    - **Validates: Requirements 7.9**

  - [x] 2.10 Write unit tests in `tests/unit/revive-brief.test.ts`
    - `isEstateOwner("")` and `("  ")` are true, `("octo")` is false
    - Empty owner gives `git clone https://github.com/unknown/{repo}.git` and a link with no `//` segment
    - A `revive` entry from `data/estate.json` produces the expected section order
    - `unfinishedBusiness: []` renders the single "No unfinished business" line, and a title of `---` renders escaped
    - _Requirements: 3.16, 5.2, 5.4, 6.6, 6.10_

- [x] 3. Implement `components/seance/ReviveDialog.tsx`
  - [x] 3.1 Build the portaled modal dialog
    - Props `{ result, facts, onClose, onAnnounce }`. Portal to `document.body` at `z-[80]`, `role="dialog"`, `aria-modal="true"`, labelled by the visible `h2` "Raise it in Kiro", with scrolling and wrapping classes for 390 px to 1440 px
    - DOM order: backdrop, heading, Close button (initial focus), Clone_Command in `font-fact`, the estate notice (`data-testid="estate-demo-note"`, only when `isEstateOwner(facts.owner)`), an `ol` of exactly three steps, the three action buttons in order ("Copy clone command", "Copy Kiro prompt", "Download REVIVAL.md"), an always-mounted `role="status"` `aria-live="polite"` paragraph, and the failure textareas shown only after a copy failure
    - Register one `window` capture-phase `keydown` listener while mounted. It handles Escape (close) and Tab (wrap inside the dialog, pull focus in if outside) with `preventDefault()` and `stopPropagation()`, and removes itself on unmount
    - Implement copy through `navigator.clipboard.writeText` in try/catch, and download through Blob, object URL, hidden anchor named `REVIVAL.md` and a module-level 1000 ms revoke. Export the five announcement strings as constants. Announce to the local status (clear then set on the next animation frame) and through `onAnnounce`. Actions never move focus and are never disabled
    - Entry animation uses `motion-safe:` variants plus a 200 ms opacity fade. Tokens only, no colour literals, no `dangerouslySetInnerHTML`, no network call
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

- [x] 4. Implement `components/seance/ReviveInKiro.tsx`
  - [x] 4.1 Build the button and open state
    - Client component with `open` state and a button ref. Native `<button type="button">` with visible text "Revive in Kiro", one `aria-hidden="true"` flame SVG using `currentColor`, the `seance-focus` class, and token-only classes (`border-ghost-300`, `text-moon-100`, `bg-night-800`, hover `bg-night-sky`, glow from `--color-glow-ghost`, `motion-safe:transition-colors`). No animation or transform
    - Render `ReviveDialog` when open. On close, set `open` to false and focus the button
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.5_

- [x] 5. Wire the slot into the séance
  - [x] 5.1 Update `components/seance/KiroSlot.tsx` additively
    - Add optional props `{ result?, facts?, onAnnounce? }`. Render `ReviveInKiro` only when `result?.verdict === "revive"` and `facts` and `onAnnounce` are present. Otherwise render `<div data-slot="revive-in-kiro"></div>` with no children, so `<KiroSlot />` stays empty and the existing Spec 4 test passes unchanged
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 8.1_

  - [x] 5.2 Update `components/seance/SeanceRegion.tsx` additively
    - Destructure `owner` from the existing props and change only the `KiroSlot` JSX to pass `result`, `facts={{ owner, repo, state: creatureState }}` and `onAnnounce={announceCopy}`. Change nothing else in the file and make no new request
    - Run `npx tsc --noEmit` and `npx vitest --run tests/dom/SeanceVerdict.test.tsx` to confirm the existing test still passes without edits
    - _Requirements: 1.4, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2_

- [x] 6. Add DOM tests for slot and button
  - [x] 6.1 Write `tests/dom/ReviveInKiro.test.tsx`
    - Exactly one Revive_Button for `revive` and an empty slot (zero children, zero text) for `finish`, `seal`, absent result and an unknown verdict, for live data and every `revive` estate fixture. The slot is the next sibling after the Verdict_Card and exists once
    - No Revive_Button during the ritual, veil, weak and silent phases of `SeanceRegion`
    - Button markup: native button of type `button`, visible text, one `aria-hidden` svg, no `img`, Tab order directly after the Verdict_Card, Enter and Space each activate once, same label and enabled state for estate and live data
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 2.1, 2.4, 2.5, 2.6, 2.9, 8.8_

- [x] 7. Add DOM tests for the dialog
  - [x] 7.1 Write `tests/dom/ReviveDialog.test.tsx`
    - Role, `aria-modal`, label, three actions in order, Close control, three-step list. Focus moves in on open. Tab and Shift+Tab wrap, also with the fallback textareas visible
    - Escape, Close and backdrop click each close the dialog and return focus to the button
    - With the real `DetailPanel` mounted: Escape closes only the dialog, the panel stays open and the scene root stays `inert`. Clicking the dialog heading then pressing Tab keeps focus inside the dialog and never on the panel's Close control, including wrap at both ends
    - Estate note: with `owner=""` exactly one `[data-testid="estate-demo-note"]` appears directly after the Clone_Command with text equal to `ESTATE_DEMO_NOTICE`, absent for `owner="octo"`, and the button label, action labels, enabled state and focusable count are identical. Add one test with the real `DetailPanel` in estate mode opening the dialog from a `revive` fixture
    - Class assertions for `motion-safe:`, `max-h`, `overflow-y-auto` and `break-all`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.11, 3.12, 3.16, 1.4, 8.9_

- [x] 8. Add DOM tests for copy, download and announcements
  - [x] 8.1 Write `tests/dom/ReviveActions.test.tsx`
    - Mock `navigator.clipboard.writeText`, `URL.createObjectURL`, `URL.revokeObjectURL`, `HTMLAnchorElement.prototype.click` and use fake timers. Spy on `fetch` and assert it is never called
    - "Copy clone command" and "Copy Kiro prompt" call the clipboard once with the exact strings. A rejecting or missing clipboard shows the failure announcement and the two selectable textareas, keeps the dialog open and focus on the control, and leaves the action enabled
    - Download creates one Blob of type `text/markdown;charset=utf-8`, sets the file name `REVIVAL.md`, and revokes once with the created URL within 10 s. A throwing `createObjectURL` or click announces the download failure and revokes
    - "Copied clone command", "Copied Kiro prompt" and "Downloaded REVIVAL.md" appear in `[data-seance-copy-status]` and in the dialog status element after success
    - _Requirements: 3.14, 3.15, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.10, 8.10, 8.11, 8.12, 8.14_

- [x] 9. Add the source scan test
  - [x] 9.1 Write `tests/unit/revive-source-scan.test.ts`
    - Read `components/seance/ReviveInKiro.tsx`, `components/seance/ReviveDialog.tsx`, `components/seance/KiroSlot.tsx` and `lib/revive-brief.ts`; assert zero matches for hex colour literals, `rgb(`, `rgba(`, `hsl(`, `hsla(` and `dangerouslySetInnerHTML`
    - For `lib/revive-brief.ts` also assert no `Date`, `Math.random`, `fetch` or `localStorage`
    - _Requirements: 3.10, 4.9, 5.11, 8.13_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Run `npx vitest --run`, `npx tsc --noEmit` and `npm run lint`, and fix any failure in the new files. Confirm no existing test file was changed. Ask the user if questions arise, and ask before touching any Spec 4 test.

## Notes

- Each task references specific requirements for traceability.
- Property tests validate the 11 correctness properties from the design, one sub-task per property.
- Property tests live in separate files per property (a small deviation from the single-file layout in the design) so the sub-tasks can run in parallel.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "3.1"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["6.1", "7.1", "8.1", "9.1"] }
  ]
}
```
