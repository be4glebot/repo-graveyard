# Requirements Document

## Introduction

Graveyard Badges are embeddable SVG badges for README files. Each badge shows either a whole graveyard summary or a single repo's state, and links back to the graveyard so every badge spreads the project. Two public endpoints, `GET /api/badge/[owner]` and `GET /api/badge/[owner]/[repo]`, return SVG built as a plain string (no image libraries, no new dependencies). Data comes from the existing `loadGraveyard` and `classify` functions with the existing graveyard cache and no overrides. Badges never break a README: every failure returns HTTP 200 with a grey badge. The graveyard page gets a "Get a badge" dialog and the detail panel gets a "Badge for this repo" action, both offering a live preview, a style toggle and copyable Markdown and HTML snippets.

## Glossary

- **Badge_Service**: The route handlers at `/api/badge/[owner]` and `/api/badge/[owner]/[repo]`.
- **Badge_Builder**: The pure function module that turns a label, a message, a colour set and a style into an SVG string.
- **Width_Table**: The per-character width table for Verdana 11px used by the Badge_Builder to size text.
- **Summary_Badge**: A badge showing the counts of each non-zero state in one owner's graveyard.
- **Repo_Badge**: A badge showing the state and decay level of one repository.
- **Haunted_Style**: The default style (`?style=haunted`): night background, crimson label, using the site's theme token colours.
- **Flat_Style**: The neutral light style (`?style=flat`), similar to shields.io.
- **Fallback_Badge**: A grey badge with the message "not found" or "unavailable". Every Fallback_Badge is cached with `public, s-maxage=300`, except the one returned for a Badge_Limiter rejection, which is sent with `no-store`.
- **Badge_Limiter**: A generous abuse guard built with `createBucketLimiter` at 600 requests per hour per IP. Its rejections are per-client, so their responses are never stored by a shared cache.
- **Badge_Dialog**: The accessible dialog opened by the "Get a badge" button on the graveyard page.
- **Repo_Badge_Dialog**: The accessible dialog or inline panel opened by the "Badge for this repo" action in the detail panel.
- **Detail_Panel**: The existing per-repo detail panel.
- **Site_URL**: The base URL returned by `resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)`, the same resolver used for metadata.
- **Snippet**: A copyable Markdown or HTML text that embeds a badge and links to the graveyard.
- **Mobile_Menu**: The existing menu shown below 768 px viewport width.

## Requirements

### Requirement 1: Summary badge endpoint

**User Story:** As a developer, I want a badge summarising my whole graveyard, so that my profile README shows the state of my projects.

#### Acceptance Criteria

1. WHEN a GET request is received at `/api/badge/[owner]` with a valid owner, THE Badge_Service SHALL return an SVG Summary_Badge with the label "repo graveyard".
2. THE Badge_Service SHALL build the Summary_Badge message from the non-zero state counts only, joined by the separator and ordered ghosts, risen, zombies, at rest, sealed (for example "3 ghosts · 1 zombie · 2 at rest"), where the separator is the literal string space + U+00B7 (MIDDLE DOT) + space (" · "), and in code and tests the separator SHALL be written with the `\u00B7` escape so that it cannot be mis-encoded.
3. WHEN a state count equals 1, THE Badge_Service SHALL use the singular noun for that state ("ghost", "risen", "zombie", "at rest", "sealed").
4. WHEN every state count equals 0, THE Badge_Service SHALL use the message "empty".
5. THE Badge_Service SHALL obtain repos from `loadGraveyard` and states from `classify` with no override applied, so the existing graveyard cache applies.
6. THE Badge_Service SHALL colour the Summary_Badge value segment by the most urgent non-zero state, in the order zombie, ghost, risen, tombstone, coffin.
7. WHEN every state count equals 0, THE Badge_Service SHALL colour the value segment with a neutral colour distinct from the five state colours.
8. IF the owner is invalid, unknown or cannot be loaded, THEN THE Badge_Service SHALL respond as specified in Requirement 5.

### Requirement 2: Per-repo badge endpoint

**User Story:** As a developer, I want a badge for one repo, so that the repo's README shows where the project stands.

#### Acceptance Criteria

1. WHEN a GET request is received at `/api/badge/[owner]/[repo]` with an owner and repo that match a repo in the loaded graveyard, THE Badge_Service SHALL return an SVG Repo_Badge with the label "repo graveyard".
2. THE Badge_Service SHALL build the Repo_Badge message from the repo's state name and, for ghost and zombie states, the decay level name (for example "ghost · fading" or "zombie · rotting"), joined by the separator, which is the literal string space + U+00B7 (MIDDLE DOT) + space (" · "), and in code and tests the separator SHALL be written with the `\u00B7` escape so that it cannot be mis-encoded.
3. WHILE a repo has a state without a decay level (tombstone or coffin), THE Badge_Service SHALL use the state name alone as the message ("at rest" for tombstone, "sealed" for coffin).
4. THE Badge_Service SHALL colour the Repo_Badge value segment with one colour per state, so that the five states (ghost, risen, zombie, tombstone, coffin) each have a colour distinct from the other four.
5. THE Badge_Service SHALL match the repo name case-insensitively against the loaded graveyard.
6. THE Badge_Service SHALL NOT include day counts or dates in the Repo_Badge message, so that cached badges do not show stale numbers.
7. IF the owner or repo is invalid, unknown or cannot be loaded, THEN THE Badge_Service SHALL respond as specified in Requirement 5.

### Requirement 3: Badge styles

**User Story:** As a developer, I want to pick a badge style, so that the badge suits my README.

#### Acceptance Criteria

1. WHEN the `style` query parameter is absent or equals `haunted` (case-sensitive), THE Badge_Builder SHALL render Haunted_Style with a night background, a crimson label segment, and every fill and text colour taken from the site's theme tokens.
2. WHEN the `style` query parameter equals `flat` (case-sensitive), THE Badge_Builder SHALL render Flat_Style with a light background, a two-segment label and value layout, and colours that differ from Haunted_Style.
3. IF the `style` query parameter holds any value other than `haunted` or `flat`, including an empty string or a value longer than 32 characters, THEN THE Badge_Service SHALL render Haunted_Style and return a valid badge without an error response.
4. THE Badge_Builder SHALL compute each segment's width as the sum of the Width_Table Verdana 11px widths of its characters plus a fixed horizontal padding of 10 pixels on each side, rounded up to a whole pixel.
5. IF a character is missing from the Width_Table, THEN THE Badge_Builder SHALL use a fixed default width of 7 pixels for that character and SHALL still produce a well-formed badge.
6. THE Badge_Builder SHALL include in every badge a `<title>` element, `role="img"`, and an `aria-label` attribute whose text is identical to the `<title>` text and contains the full badge text (label and value) in both styles.

### Requirement 4: Caching and abuse guard

**User Story:** As the site operator, I want badges cached and lightly guarded, so that README traffic stays cheap without blocking GitHub's image proxy.

#### Acceptance Criteria

1. WHEN the Badge_Service returns a successful badge, THE Badge_Service SHALL set `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
2. WHEN the Badge_Service receives a badge request, THE Badge_Service SHALL count the request against the Badge_Limiter for the client IP and allow up to 600 requests per 60-minute window per IP, with no other rate limit applied to badge requests.
3. IF the Badge_Limiter rejects a request, THEN THE Badge_Service SHALL return the "unavailable" Fallback_Badge as a valid grey SVG image with HTTP status 200 and `Cache-Control: no-store`, so that a shared CDN cannot cache one client's throttle for other clients, and SHALL NOT return an error status or an empty body.
4. IF the Badge_Limiter store is unavailable or does not respond within 500 milliseconds, THEN THE Badge_Service SHALL serve the requested badge without limiting and SHALL still complete the response.

### Requirement 5: Error handling that never breaks a README

**User Story:** As a developer, I want badges to always render an image, so that a failure never leaves a broken image in my README.

#### Acceptance Criteria

1. IF the owner does not exist on GitHub, THEN THE Badge_Service SHALL return a grey Fallback_Badge with the message "not found" and HTTP status 200.
2. IF the owner exists and the repo is not in the loaded graveyard, THEN THE Badge_Service SHALL return a grey Fallback_Badge with the message "not found" and HTTP status 200.
3. IF `loadGraveyard` fails with a rate-limit, upstream, or unexpected error, THEN THE Badge_Service SHALL return a grey Fallback_Badge with the message "unavailable" and HTTP status 200.
4. WHEN the Badge_Service returns a Fallback_Badge for any reason other than Badge_Limiter rejection (invalid name, unknown owner, unknown repo, loader failure or unexpected error), THE Badge_Service SHALL set `Cache-Control: public, s-maxage=300`; WHEN the Badge_Service returns a Fallback_Badge because the Badge_Limiter rejected the request, THE Badge_Service SHALL set `Cache-Control: no-store` instead.
5. IF the owner path segment fails the existing username validation, or the repo path segment is empty, longer than 100 characters, or contains any character other than letters, digits, `.`, `_` and `-`, THEN THE Badge_Service SHALL return a grey Fallback_Badge with the message "not found" and HTTP status 200 without calling `loadGraveyard`.
6. THE Badge_Service SHALL use the existing username validation for owner names and a repo-name pattern of letters, digits, `.`, `_` and `-` from 1 to 100 characters.
7. WHEN the Badge_Service returns a Fallback_Badge, THE Badge_Service SHALL return a well-formed SVG that is under 4 KB, contains a `<title>` element stating the fallback message, and loads no external images or fonts.
8. THE Badge_Service SHALL escape any owner or repo text it places in a Fallback_Badge, and SHALL use only the fixed messages "not found" and "unavailable" as fallback messages.

### Requirement 6: Output safety

**User Story:** As the site operator, I want badge output to be inert, so that user-controlled text cannot inject markup or scripts.

#### Acceptance Criteria

1. THE Badge_Builder SHALL escape each of the characters `&`, `<`, `>`, `"` and `'` as its corresponding XML entity in every text node and attribute value placed in the SVG, so that the output parses as well-formed XML for any input string, including empty strings, strings of 1 to 10,000 characters, and strings containing unicode or control characters.
2. THE Badge_Builder SHALL truncate any label or message longer than 64 characters to 63 characters followed by a single ellipsis character, so that the result is never longer than 64 characters, and SHALL leave text of 64 characters or fewer unchanged.
3. THE Badge_Builder SHALL emit SVG that contains no `<script` element, no attribute whose name begins with `on`, no `<foreignObject` element, and no `href`, `xlink:href` or `url(` reference to an external resource, regardless of the input.
4. THE Badge_Builder SHALL produce SVG under 4,096 bytes for any input, including inputs of 10,000 characters and inputs made entirely of characters that expand when escaped.
5. THE Badge_Service SHALL respond with `Content-Type: image/svg+xml; charset=utf-8` and `X-Content-Type-Options: nosniff` on every response, including error and fallback responses.
6. THE Badge_Builder SHALL use vector shapes and system font stacks only, with no external images, no embedded raster data and no web fonts.
7. THE Badge_Builder SHALL be a pure function that takes text, colours and style as parameters, returns the same output for the same parameters on every call, and performs no I/O.
8. IF a colour or style parameter is not in the set of values the Badge_Builder accepts, THEN THE Badge_Builder SHALL substitute a default value from that set, so that no unvalidated colour or style text appears in the output.

### Requirement 7: Get a badge dialog on the graveyard page

**User Story:** As a graveyard owner, I want a "Get a badge" dialog, so that I can copy a ready-made snippet for my README.

#### Acceptance Criteria

1. WHILE the graveyard page shows a real (non-estate) graveyard and the viewport width is 768 px or above, THE Graveyard_Page SHALL show a "Get a badge" button in the header area that is reachable by keyboard and shows a visible focus ring.
2. WHILE the graveyard page shows a real (non-estate) graveyard and the viewport width is below 768 px, THE Mobile_Menu SHALL contain a "Get a badge" item, and THE Graveyard_Page SHALL NOT show the header "Get a badge" button.
3. WHEN the user activates "Get a badge" by click, tap, Enter or Space, THE Badge_Dialog SHALL open as a modal dialog with an accessible name, move keyboard focus into the dialog, and make content outside the dialog inert to pointer and keyboard interaction.
4. WHEN the user presses Escape or activates a close control while the Badge_Dialog is open, THE Badge_Dialog SHALL close and return keyboard focus to the element that opened it.
5. WHILE the Badge_Dialog is open, THE Badge_Dialog SHALL show a live preview of the Summary_Badge for the current owner in the selected style.
6. IF the Summary_Badge preview image fails to load, THEN THE Badge_Dialog SHALL show a text message indicating the preview is unavailable, and SHALL keep both Snippets visible and copyable.
7. THE Badge_Dialog SHALL offer a style toggle with exactly two options, haunted and flat, with haunted selected by default each time the dialog opens.
8. WHEN the user changes the style, THE Badge_Dialog SHALL update the preview and both Snippets to use the selected style within 100 ms, without closing the dialog.
9. THE Badge_Dialog SHALL show a Markdown Snippet of the form `[![Repo Graveyard](SITE/api/badge/OWNER)](SITE/g/OWNER)`, where SITE is the Site_URL and OWNER is the percent-encoded owner name.
10. THE Badge_Dialog SHALL show an HTML Snippet that embeds the same badge image URL as the Markdown Snippet inside a link to `SITE/g/OWNER`.
11. WHERE the selected style is flat, THE Badge_Dialog SHALL append `?style=flat` to the badge image URL, and not to the link URL, in both Snippets.
12. THE Badge_Dialog SHALL percent-encode the owner name in every URL it builds, so that an owner name containing reserved characters (such as `/`, `?`, `#`, or `%`) produces a single path segment in each URL.
13. WHEN the user activates a Snippet's copy control, THE Badge_Dialog SHALL place the full text of that Snippet on the clipboard and show a "Copied" confirmation for 2 seconds.
14. IF writing to the clipboard fails, THEN THE Badge_Dialog SHALL show a message indicating the copy failed and SHALL leave the Snippet text selectable for manual copying.
15. WHILE the graveyard page shows the Haunted Estate sample, THE Graveyard_Page SHALL hide the header "Get a badge" button and THE Mobile_Menu SHALL hide the "Get a badge" item, because sample graveyards do not exist on GitHub.

### Requirement 8: Badge for this repo in the detail panel

**User Story:** As a developer, I want a per-repo badge snippet in the detail panel, so that I can put the repo's state in its own README.

#### Acceptance Criteria

1. WHILE the Detail_Panel shows a repo that is not a Haunted Estate sample repo, THE Detail_Panel SHALL show a "Badge for this repo" action whose rendered height and font size are each smaller than those of the "Get a badge" button.
2. WHEN the user activates "Badge for this repo" by click, tap, or the Enter or Space key, THE Repo_Badge_Dialog SHALL open and show a live preview of the Repo_Badge, the style toggle, a Markdown Snippet, and an HTML Snippet.
3. THE Repo_Badge_Dialog SHALL build each Snippet to link the badge image at `SITE/api/badge/OWNER/REPO` to the page at `SITE/g/OWNER/REPO`, with Site_URL as SITE and OWNER and REPO each percent-encoded, using the Markdown form `[![Repo Graveyard](SITE/api/badge/OWNER/REPO)](SITE/g/OWNER/REPO)`.
4. WHERE the selected style is flat, THE Repo_Badge_Dialog SHALL append `?style=flat` to the badge image URL in the live preview, the Markdown Snippet, and the HTML Snippet.
5. WHEN the user changes the style toggle, THE Repo_Badge_Dialog SHALL update the live preview and both Snippets, and SHALL leave the Detail_Panel state unchanged.
6. IF the Repo_Badge image in the live preview fails to load, THEN THE Repo_Badge_Dialog SHALL show a message indicating the preview is unavailable, keep both Snippets visible and unchanged, and keep the style toggle operable.
7. WHILE the Detail_Panel shows a Haunted Estate sample repo, THE Detail_Panel SHALL hide the "Badge for this repo" action, because sample repos do not exist on GitHub.

### Requirement 9: Dialog accessibility and copy feedback

**User Story:** As a keyboard or screen reader user, I want the badge dialogs to behave like the site's other dialogs, so that they are usable without a mouse.

#### Acceptance Criteria

1. WHEN a badge dialog opens, THE dialog SHALL move focus to the first interactive element inside the dialog.
2. WHILE a badge dialog is open, THE dialog SHALL keep focus inside the dialog, so that Tab on the last interactive element moves focus to the first, and Shift+Tab on the first moves focus to the last.
3. WHEN the user presses Escape while a badge dialog is open, THE dialog SHALL close and return focus to the element that opened it.
4. WHEN the user activates a Copy button, THE dialog SHALL write the matching Snippet to the clipboard and announce the text "Copied" in an `aria-live="polite"` region.
5. IF writing to the clipboard fails, THEN THE dialog SHALL announce a message indicating the copy failed in the `aria-live` region, keep the Snippet text visible and user-selectable, and keep the dialog open.
6. THE dialog SHALL reuse the existing dialog patterns and themed button styles, and every interactive element in the dialog SHALL show a visible focus ring when it has keyboard focus.
7. WHILE `prefers-reduced-motion` is set, THE dialog SHALL open and close without animation.
8. IF the badge preview image fails to load, THEN THE dialog SHALL replace the preview with a text fallback that names the owner (and repo for the repo dialog), and keep all Snippets and Copy buttons available.
9. WHEN a badge dialog is closed by any means (Escape, close button, or backdrop click), THE dialog SHALL clear the "Copied" or copy-failure announcement so it is not shown again when the dialog reopens.

### Requirement 10: Automated tests

**User Story:** As a maintainer, I want the badge feature covered by automated tests, so that regressions in output safety and error handling are caught.

#### Acceptance Criteria

1. THE test suite SHALL include fast-check property tests for the Badge_Builder that run at least 100 generated cases per property (including empty, 1,000-character and unicode strings) and verify that: (a) escaping makes any input string XML-safe, meaning the output contains no unescaped `<`, `>`, `&`, `"` or `'` within text or attribute content and parses as well-formed XML; (b) SVG width never decreases as text length grows, all else equal; (c) output is under 4 KB (4,096 bytes) for every generated input; and (d) output contains no `<script` (case-insensitive) and no `href` or `xlink:href` attribute pointing to an external URL.
2. THE test suite SHALL include route tests for the Summary_Badge and the Repo_Badge, covering both styles for each, that verify the response body is a well-formed SVG containing the expected label and message for a known fixture.
3. THE test suite SHALL include one route test per error case (unknown user, unknown repo, invalid name, rate-limited, loader failure) for each of the Summary_Badge and the Repo_Badge (where the case applies), verifying that the HTTP status is 200, that the badge uses the grey colour, that the message is "not found" or "unavailable" as appropriate, and that `Cache-Control` contains `s-maxage=300` for every case except rate-limited; for the rate-limited case, the test SHALL verify that `Cache-Control` equals exactly `no-store` and does not contain `s-maxage`.
4. THE test suite SHALL include route tests for a successful response of the Summary_Badge and the Repo_Badge verifying the exact `Cache-Control` value, the exact `Content-Type` value and a `X-Content-Type-Options` header equal to `nosniff`.
5. THE test suite SHALL include DOM tests for the Badge_Dialog and the Repo_Badge_Dialog verifying that: Snippets are rendered for each style; activating copy writes the Snippet to the clipboard and shows a message in the aria-live region; the style toggle switches the displayed Snippets; initial focus lands on the first focusable element in the dialog; Tab and Shift+Tab cycle focus within the dialog; and pressing Escape closes the dialog and returns focus to the element that opened it.
6. THE test suite SHALL include a property or unit test verifying that, for any Summary_Badge state counts, the message lists only states with a count greater than zero, and that the message reads "empty" when all counts are zero.
7. THE test suite SHALL include a test verifying that the Summary_Badge and Repo_Badge messages, and the full SVG output of each, never contain the character U+00C2 (capital A with circumflex), and that the separator between message parts is exactly " \u00B7 " (space, U+00B7, space), with the separator written using the `\u00B7` escape in the test source.
8. THE test suite SHALL include DOM tests verifying that, while the graveyard page shows the Haunted Estate sample, the header "Get a badge" button and the Mobile_Menu "Get a badge" item are both absent, and that both are present on a real (non-estate) graveyard at the matching viewport widths.
9. THE test suite SHALL be runnable with `npx vitest --run`, and the code SHALL pass `npx tsc` and `npm run lint`.

### Requirement 11: Dependency and scope limits

**User Story:** As a maintainer, I want the feature kept small and read-only, so that it adds no dependency or write risk.

#### Acceptance Criteria

1. THE Badge_Builder SHALL generate SVG markup as a string using only built-in language facilities and no image-generation or image-rendering library.
2. THE Badge_Service SHALL add zero new entries to the `dependencies` and `devDependencies` of `package.json`.
3. THE Badge_Service SHALL issue only read operations against GitHub and SHALL issue zero write requests.
4. THE Badge_Service SHALL build every badge from GitHub-derived data alone and SHALL apply zero owner overrides (server-stored) and zero localStorage overrides.
5. THE Badge_Service SHALL import `server-only` modules only in route handlers, so that the Badge_Builder can be imported without error from unit tests and from dialog components.
6. IF a badge request needs data that is unavailable from GitHub, THEN THE Badge_Service SHALL return a valid fallback SVG per Requirement 5 and SHALL leave all stored data unchanged.
