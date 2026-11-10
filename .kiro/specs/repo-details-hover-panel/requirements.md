# Requirements Document

## Introduction

Spec 3 — "3 repo details: hover card + detail panel" — lets a visitor inspect any creature in the graveyard and jump to its GitHub repository. Every creature, whatever its state (ghost, zombie, risen, tombstone, coffin) and wherever it stands (sky, gate, ground, crypt), gains two inspection surfaces layered on top of the already-classified scene:

- A lightweight **hover card** (pointer devices only) that appears when the pointer rests on a creature or its plaque, or immediately on keyboard focus, showing a compact summary and an "Open on GitHub" link.
- A full **detail panel** (opened by click, Enter, or Space) rendered as a right-side drawer on desktop and a bottom sheet on narrow viewports, styled per `docs/design-canvas/Seance.dc.html` (iron and parchment, Cinzel headings), showing the repo's facts, a plain-English explanation of why it is the creature it is, status badges, and links out.

This spec also extends the existing single GraphQL graveyard query with the few repository fields these surfaces need (fork count, language color, and topics), without adding queries or shrinking the page size, and updates the zod/domain shape and its tests to match.

The detail panel ships only its **shell and details** now. The séance interaction is Spec 4 and Revive in Kiro is Spec 6; the panel reserves a clearly marked, empty actions slot for them and renders no placeholder or disabled buttons.

The authoritative sources for this spec are the steering files (`product.md` lifecycle and principles, `tech.md` GitHub-data and read-only rules, `design.md` detail-panel and accessibility sections, `voice.md`), the detail-panel visual reference, and the existing data layer. They are included here:

#[[file:.kiro/steering/product.md]]
#[[file:.kiro/steering/tech.md]]
#[[file:.kiro/steering/design.md]]
#[[file:.kiro/steering/voice.md]]
#[[file:docs/design-canvas/Seance.dc.html]]
#[[file:lib/github.ts]]
#[[file:lib/lifecycle.ts]]

The scope is additive and presentational over the frozen lifecycle classification and the existing scene. No lifecycle threshold is changed. The app stays strictly read-only against GitHub: no new OAuth scopes and no write calls.

## Glossary

- **Creature**: The on-screen representation of one repository in one of the five lifecycle states (ghost, zombie, risen, tombstone, coffin). Each Creature is a focusable button carrying its repository's display data.
- **Plaque**: The iron name panel attached to a Creature, as defined in `design.md` (Cinzel name, mono sub-line). Resting the pointer on the Plaque behaves the same as resting on its Creature.
- **Hover_Card**: The small tombstone-styled popover that summarizes a repository and offers an "Open on GitHub" link. It appears only on fine-pointer, hover-capable devices. On keyboard focus it is exposed as a non-interactive `role="tooltip"` summary referenced via the Creature's `aria-describedby` and contains no focusable elements; pointer users may move into it to click the Open on GitHub link.
- **Detail_Panel**: The modal drawer (desktop) or bottom sheet (narrow viewport) that shows a repository's full details and links.
- **Actions_Slot**: An empty, labelled region at the bottom of the Detail_Panel reserved for the séance (Spec 4) and Revive in Kiro (Spec 6). In this spec it renders as an empty landmark region (e.g. `<section aria-label="Actions" data-slot="actions">`) with no visible text, no "coming soon" marker, and no controls; it may have zero height until Specs 4/6 fill it.
- **Repo_Row**: The per-repository data record carried into the scene, derived from the GraphQL query and the lifecycle classification; the data source for both the Hover_Card and the Detail_Panel.
- **Owner**: The validated GitHub account login whose graveyard is being viewed (from the `/g/[username]` route or the estate fixture). Combined with a repository name to build the GitHub link.
- **Decay_Word**: The plain-English state label for a Creature at its decay level (e.g. "healthy", "fading", "flickering", "about to turn" for ghosts; "fresh", "rotting", "decayed", "skeletal", "ancient" for zombies; and the plain labels for risen, tombstone, and coffin), as defined by the lifecycle in `product.md`.
- **Quiet_Phrase**: A deterministic human-readable duration describing how long a repository has been quiet, formatted from `pushedAt` (or `createdAt` when `pushedAt` is absent) relative to an injected `renderedAt`, e.g. "quiet for 2 years 3 months".
- **Explanation_Line**: A one-line plain-English sentence stating why a Creature is the state it is, derived only from the classification and facts (e.g. "No commits for 2 years 3 months.").
- **Rendered_At**: The ISO 8601 "now" timestamp injected into pure formatters and view-model functions; the system clock is never read inside pure functions.
- **Fine_Pointer_Device**: A device reporting `(pointer: fine)` and `(hover: hover)` (e.g. mouse or trackpad).
- **Coarse_Pointer_Device**: A device that does not report both `(pointer: fine)` and `(hover: hover)` (e.g. touch-only).
- **Reduced_Motion**: The user state reported by the `prefers-reduced-motion: reduce` media query.
- **GitHub_Link**: The external URL `https://github.com/{Owner}/{name}` built only from the validated Owner and repository name.
- **Homepage_Link**: The external link shown only when a repository's `homepageUrl` is a valid `https` URL; its visible text is the URL's domain only.
- **External_Link**: Any link that navigates off-site (GitHub_Link, Homepage_Link); rendered with `target="_blank"`, `rel="noopener noreferrer"`, an "↗" marker, and visually hidden "(opens in a new tab)" text.
- **Repo_Query_Param**: The `repo` query-string parameter (`?repo=<name>`) used to deep-link directly to an open Detail_Panel, set alongside the existing `?at=` place parameter via `history.pushState`.
- **Sample_Estate**: The sample graveyard rendered at the `/estate` route from the estate fixture data rather than from a live GitHub account.
- **Fixture_Repository**: A repository record that originates from the estate fixture (not from live GitHub) and is displayed within the Sample_Estate.

## Requirements

### Requirement 1: Repository data fields

**User Story:** As a visitor inspecting a creature, I want its description, language, popularity, topics, and dates available, so that the hover card and detail panel can describe the repository accurately.

#### Acceptance Criteria

1. THE Graveyard_Query SHALL request, for every repository node, the fields `name`, `description`, `url`, `homepageUrl`, `primaryLanguage` (both `name` and `color`), `stargazerCount`, `forkCount`, `issues` total count (restricted to open issues), `pushedAt`, `createdAt`, `isArchived`, `isFork`, and the first 5 entries of `repositoryTopics`.
2. THE Graveyard_Query SHALL load repositories using at most 6 page queries, each requesting at most 50 repositories per page (maximum 300 repositories total).
3. THE Repo_Row schema SHALL include `forkCount` as an integer in the range 0 to 2,147,483,647, `primaryLanguage` as either null or an object with a required `name` string (1 to 255 characters) and an optional `color` string, and `topics` as a list of 0 to 5 strings.
4. IF a repository node has no `primaryLanguage`, THEN THE node mapping SHALL set `primaryLanguage` to null.
5. IF a repository node has no topics, THEN THE node mapping SHALL set `topics` to an empty list.
6. IF a repository node exposes more than 5 topics, THEN THE node mapping SHALL retain only the first 5 topics in their original order and discard the remainder.
7. IF a repository node omits the `description` or `homepageUrl` field or returns it as null, THEN THE node mapping SHALL set the corresponding field to null and SHALL retain the remaining fields of that record.
8. IF a repository record fails validation (for example a negative `forkCount` or a `topics` list exceeding 5 entries), THEN THE Repo_Row validation SHALL skip only that record, SHALL emit a console warning naming the offending repository and field, SHALL NOT throw for the page, and SHALL still render all other valid repositories.

### Requirement 2: Hover card appearance and dismissal

**User Story:** As a visitor using a mouse, I want a quick summary to appear when I hover a creature, so that I can scan a repository without opening the full panel.

#### Acceptance Criteria

1. WHERE the device is a Fine_Pointer_Device, WHEN the pointer has rested continuously on a Creature or its Plaque for 250 milliseconds, THE Hover_Card SHALL open for that Creature's repository.
2. IF the pointer leaves a Creature and its Plaque before the 250 millisecond dwell completes, THEN THE scene SHALL cancel the pending Hover_Card so that no Hover_Card opens for that Creature.
3. WHEN a Creature receives keyboard focus, THE Hover_Card SHALL open for that Creature's repository within 50 milliseconds and without any dwell delay, exposing the Hover_Card with `role="tooltip"`, referencing the Hover_Card from the Creature's `aria-describedby`, and containing no focusable elements.
4. WHILE a Hover_Card is open, IF a second Creature triggers a Hover_Card, THEN THE scene SHALL close the first Hover_Card so that at most one Hover_Card is open at a time.
5. WHEN the pointer moves from a Creature or its Plaque into that Creature's open Hover_Card within 150 milliseconds, THE Hover_Card SHALL remain open so that the Open on GitHub link is clickable.
6. WHEN the pointer leaves both a Creature and its open Hover_Card and does not re-enter either within 150 milliseconds, THE Hover_Card SHALL close.
7. WHEN the focused Creature loses keyboard focus, THE Hover_Card SHALL close.
8. WHEN the Escape key is pressed WHILE a Hover_Card is open, THE Hover_Card SHALL close.
9. WHERE the device is a Coarse_Pointer_Device, THE scene SHALL NOT open a Hover_Card on any pointer interaction.
10. WHEN keyboard focus returns to a Creature because the Detail_Panel closed, THE scene SHALL NOT open that Creature's Hover_Card.
11. WHILE a travel transition is running or WHILE the Detail_Panel is open, THE scene SHALL NOT open any Hover_Card.
12. WHEN a travel transition starts or WHEN the Detail_Panel opens, THE scene SHALL close any open Hover_Card.
13. WHEN a Hover_Card opens or closes, THE scene SHALL NOT re-render the creature layer, isolating the Hover_Card open/close state in a dedicated component or context so that the creatures do not re-render on hover changes.

### Requirement 3: Hover card content

**User Story:** As a visitor, I want the hover card to show the key facts about a repository, so that I can judge it at a glance.

#### Acceptance Criteria

1. THE Hover_Card SHALL display the repository name.
2. THE Hover_Card SHALL display the Decay_Word together with the Quiet_Phrase computed from the repository's timestamps relative to the injected Rendered_At.
3. WHERE a repository has a description whose text contains at least one non-whitespace character, THE Hover_Card SHALL display the description clamped to at most 2 lines, appending an ellipsis when the text exceeds 2 lines.
4. IF a repository has no description or a description containing only whitespace, THEN THE Hover_Card SHALL display the text "No epitaph was written.".
5. WHERE a repository has a primary language with a defined color, THE Hover_Card SHALL display a color dot filled with that language color alongside the language name.
6. WHERE a repository has a primary language with no defined color, THE Hover_Card SHALL display the language name with a color dot filled with a single fixed fallback color.
7. THE Hover_Card SHALL display the repository star count as a non-negative integer value.
8. THE Hover_Card SHALL display an "Open on GitHub ↗" External_Link to the repository's GitHub_Link.

### Requirement 4: Hover card positioning

**User Story:** As a visitor, I want the hover card to stay fully on screen and above other overlays, so that I can always read and click it.

#### Acceptance Criteria

1. WHEN a Creature's Plaque is hovered, THE Hover_Card SHALL be anchored within 12 pixels of the hovered Plaque.
2. IF the Hover_Card would extend beyond a viewport edge, THEN THE Hover_Card SHALL reposition relative to the anchor in the first available direction from the ordered set (below, above, right, left) such that the entire Hover_Card is within the viewport bounds with a minimum margin of 8 pixels from every viewport edge.
3. IF no single repositioning direction keeps the entire Hover_Card within the viewport bounds (for example, the Hover_Card is larger than the available viewport space), THEN THE Hover_Card SHALL be clamped so that its top-left corner remains within the viewport bounds and the Hover_Card remains at least partially scrollable or visible for interaction.
4. WHILE the Hover_Card is displayed, THE Hover_Card SHALL render at a stacking order above the lantern cursor overlay and above all fog overlays.

### Requirement 5: Opening the detail panel

**User Story:** As a visitor, I want to open a full detail panel for a creature, so that I can read everything known about the repository.

#### Acceptance Criteria

1. WHEN a Creature is activated by click, by the Enter key, or by the Space key, THE scene SHALL open the Detail_Panel for that Creature's repository.
2. WHEN a Creature is activated by the Space key, THE scene SHALL suppress the default page-scroll behavior of the Space key.
3. WHEN a Creature is activated WHILE that Creature's Hover_Card is open, THE scene SHALL close the Hover_Card as the Detail_Panel opens.
4. WHERE the device is a Coarse_Pointer_Device, WHEN a Creature is tapped, THE scene SHALL open the Detail_Panel directly without first opening a Hover_Card.
5. WHERE the viewport width is at least 768 pixels, THE Detail_Panel SHALL render as a right-side drawer 420 pixels wide, clamped to the viewport width when the viewport is narrower than 420 pixels.
6. WHERE the viewport width is below 768 pixels, THE Detail_Panel SHALL render as a bottom sheet no taller than 85% of the viewport height, with its content scrollable when it overflows.
7. WHILE the Detail_Panel is open, THE scene behind the Detail_Panel SHALL be dimmed by an overlay of 35% to 50% opacity and SHALL remain visible, AND clicking the overlay SHALL close the Detail_Panel.
8. WHEN the Detail_Panel opens, THE scene SHALL NOT start a travel transition, SHALL NOT change the current place, and SHALL NOT change the active filter.

### Requirement 6: Detail panel content

**User Story:** As a visitor, I want the detail panel to present the repository's facts and the reason for its state, so that I understand both what it is and why.

#### Acceptance Criteria

1. THE Detail_Panel SHALL display the repository name and the Owner.
2. THE Detail_Panel SHALL display the creature type (one of ghost, zombie, risen, tombstone, coffin) and its decay state as a Decay_Word.
3. THE Detail_Panel SHALL display the Explanation_Line as exactly one plain-English sentence stating why the repository is that creature.
4. WHERE a repository has a description whose text contains at least one non-whitespace character, THE Detail_Panel SHALL display the description as plain text, uninterpreted as HTML.
5. IF a repository has no description or a description containing only whitespace, THEN THE Detail_Panel SHALL display the text "No epitaph was written.".
6. WHERE a repository has at least one topic, THE Detail_Panel SHALL display each topic (at most 5) as a separate small chip rendered as plain text, uninterpreted as HTML.
7. THE Detail_Panel SHALL display the star count, fork count, and open issue count each as a non-negative integer value.
8. THE Detail_Panel SHALL display the primary language name with a color dot.
9. THE Detail_Panel SHALL display the created date and the last-push date derived relative to the injected Rendered_At.
10. WHERE a repository is archived on GitHub, THE Detail_Panel SHALL display an "Archived" badge.
11. WHERE a repository is a fork, THE Detail_Panel SHALL display a "Fork" badge.
12. THE Detail_Panel SHALL display an "Open on GitHub ↗" External_Link to the repository's GitHub_Link as the primary link.
13. WHERE a repository has a valid Homepage_Link, THE Detail_Panel SHALL display the Homepage_Link showing only its domain.
14. THE Detail_Panel SHALL render the Actions_Slot at its bottom as an empty labelled region (for example `<section aria-label="Actions" data-slot="actions">`) containing no visible text, no "coming soon" marker, and no interactive, placeholder, or disabled controls; the region MAY have zero height.

### Requirement 7: Detail panel accessibility

**User Story:** As a keyboard or screen-reader user, I want the detail panel to behave as a proper dialog, so that I can operate it without a mouse and never get lost.

#### Acceptance Criteria

1. THE Detail_Panel SHALL expose `role="dialog"` with `aria-modal="true"` and an `aria-labelledby` referencing its heading.
2. WHEN the Detail_Panel opens, THE scene SHALL move keyboard focus to the first focusable control within the Detail_Panel within 100 milliseconds of the open animation completing.
3. WHILE the Detail_Panel is open, THE Detail_Panel SHALL trap Tab and Shift+Tab focus within its own controls, wrapping from the last control to the first on Tab and from the first control to the last on Shift+Tab.
4. THE Detail_Panel SHALL provide a close control with an accessible name.
5. WHEN the Escape key is pressed or the close control is activated, THE Detail_Panel SHALL close within 100 milliseconds.
6. WHEN the Detail_Panel closes, THE scene SHALL return keyboard focus to the Creature that opened it.
7. IF the Creature that opened the Detail_Panel is no longer present when the Detail_Panel closes, THEN THE scene SHALL move keyboard focus to a persistent focusable element in the scene so that focus is never lost to the document body.
8. WHILE the Detail_Panel's close control has keyboard focus, THE Detail_Panel SHALL display a visible focus ring in the `candle-400` focus color.

### Requirement 8: Deep linking the detail panel

**User Story:** As a visitor, I want to share a link that opens a specific creature's panel, so that others land on the same view.

#### Acceptance Criteria

1. WHEN the Detail_Panel is opened by an in-page action, THE scene SHALL set the Repo_Query_Param to the opened repository's name by pushing a new history entry via `history.pushState`, preserving the existing `?at=` place parameter unchanged.
2. WHEN a page URL is loaded with a Repo_Query_Param whose value is an exact, case-insensitive match of a loaded repository's name, THE scene SHALL open that repository's Detail_Panel without pushing a new history entry.
3. WHILE the Detail_Panel was opened by an in-page action that pushed a history entry, WHEN the Detail_Panel is closed by any in-page action (the Escape key, the close control, or an overlay click), THE scene SHALL call `history.back()`.
4. WHILE the Detail_Panel was opened from a loaded URL that already carried the Repo_Query_Param and no new history entry was pushed, WHEN the Detail_Panel is closed by any in-page action (the Escape key, the close control, or an overlay click), THE scene SHALL remove the Repo_Query_Param using `history.replaceState`, preserving the existing `?at=` place parameter unchanged.
5. WHEN the browser Back action is invoked WHILE the Detail_Panel is open, THE scene SHALL close the Detail_Panel, and the browser Back action SHALL NOT become a no-op.
6. THE scene SHALL open, deep-link, and close the Detail_Panel without a server re-render and without changing the `renderedAt` timestamp.
7. IF a loaded URL's Repo_Query_Param does not match any loaded repository under exact, case-insensitive comparison, THEN THE scene SHALL leave every Detail_Panel closed.

### Requirement 9: Link construction and security

**User Story:** As a visitor, I want links to be safe and point only where expected, so that no untrusted content can redirect or script the page.

#### Acceptance Criteria

1. THE GitHub_Link SHALL be constructed only as `https://github.com/{Owner}/{name}` using the validated Owner and repository name, and SHALL NOT incorporate any other field from the repository data.
2. IF a repository's `homepageUrl` is absent, empty, or does not parse as a URL whose scheme is exactly `https`, THEN THE scene SHALL NOT display a Homepage_Link and SHALL omit the link element entirely.
3. WHERE a Homepage_Link is displayed, THE scene SHALL show as its visible text only the host portion of the URL (the registered domain and any subdomains) with no scheme, path, query, or fragment.
4. THE scene SHALL render every External_Link with `target="_blank"`, `rel="noopener noreferrer"`, an "↗" marker, and visually hidden "(opens in a new tab)" text that is exposed to assistive technology but not visually rendered.
5. THE scene SHALL render every repository description and every topic as plain text such that any HTML-significant characters are displayed literally, and SHALL NOT parse, evaluate, or inject either value as HTML or script.
6. WHEN the scene constructs or renders any link or repository content, THE scene SHALL use only read access, SHALL NOT request any additional OAuth scope beyond those already granted, and SHALL NOT issue any write, update, or delete call to GitHub.

### Requirement 10: Works across places and modes

**User Story:** As a visitor, I want inspection to work everywhere in the scene and in every viewing mode, so that no creature is unreachable.

#### Acceptance Criteria

1. WHERE a Creature is rendered in any place (sky, gate, ground, or crypt), WHEN that Creature is hovered, focused, or activated, THE scene SHALL open the Hover_Card or the Detail_Panel according to Requirements 2 and 5 identically in every place.
2. WHERE a Creature is rendered with lights on or with lights off, WHEN that Creature is hovered, focused, or activated, THE scene SHALL open the Hover_Card or the Detail_Panel identically in both modes.
3. WHERE Reduced_Motion is active, WHEN the Detail_Panel opens, THE Detail_Panel SHALL appear by fading its opacity from 0 to 1 within 200 milliseconds and SHALL NOT apply a positional slide transform.
4. WHERE Reduced_Motion is active, WHEN the Hover_Card opens, THE Hover_Card SHALL appear without a positional slide transform.

### Requirement 11: Deterministic formatting

**User Story:** As a developer, I want the duration phrasing, explanation line, and link builders to be deterministic and total, so that they can be property-tested and never produce invalid output.

#### Acceptance Criteria

1. THE Quiet_Phrase formatter SHALL be a pure function of a repository's timestamps and the injected Rendered_At, reading no system clock and performing no I/O, producing the same phrase for the same inputs.
2. WHERE a repository has no `pushedAt`, THE Quiet_Phrase formatter SHALL compute the duration from `createdAt`.
3. IF a repository has neither `pushedAt` nor `createdAt`, THEN THE Quiet_Phrase formatter SHALL return a fixed fallback phrase rather than throwing.
4. IF the duration between a repository's reference timestamp and the injected Rendered_At is negative (a future timestamp), THEN THE Quiet_Phrase formatter SHALL clamp the duration to zero.
5. THE Explanation_Line SHALL be a pure function of the classification and facts plus the injected Rendered_At, reading no system clock, producing the same sentence for the same inputs.
6. THE GitHub_Link builder SHALL always produce a URL on the `https://github.com/` origin and SHALL never produce a `javascript:`, `data:`, or other-scheme URL for any Owner or repository name input, including inputs containing scheme-like prefixes or percent-encoded characters.
7. THE Homepage validator SHALL accept a URL only when its parsed scheme is exactly `https` and SHALL return a rejection result (never throw) for every other scheme or unparseable input.
8. THE Quiet_Phrase formatter, the Explanation_Line builder, the GitHub_Link builder, and the Homepage validator SHALL be total: no input causes them to throw or to return `NaN` or `undefined`.

### Requirement 12: Sample estate fixtures

**User Story:** As a visitor exploring the sample estate, I want fixture repositories shown without external links, so that the demo stays self-contained and never points at real GitHub pages.

#### Acceptance Criteria

1. WHERE the Sample_Estate is rendered at the `/estate` route, THE scene SHALL render Fixture_Repository records from the estate fixture rather than from live GitHub.
2. WHERE a repository is a Fixture_Repository, THE scene SHALL NOT display a GitHub_Link or a Homepage_Link for that repository.
3. WHERE a repository is a Fixture_Repository, THE Detail_Panel SHALL display a "Sample repository" note in place of the external links.
4. WHERE a repository is a Fixture_Repository, WHEN the Hover_Card would show the GitHub_Link, THE Hover_Card SHALL display a "Sample repository" note in place of that link.
5. WHERE the Sample_Estate is rendered at the `/estate` route, THE scene SHALL expose the absence of external links and the presence of the "Sample repository" note in the DOM so that a DOM test on the `/estate` path can assert both conditions.
