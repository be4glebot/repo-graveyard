# Requirements Document

## Introduction

Spec 2D makes the first impression and every edge state feel like the same haunted world as the graveyard scene. Three areas are covered:

1. **Landing page** (`app/page.tsx`): replace the unstyled Spec 1 placeholder with a full-bleed gate scene, the blackletter wordmark, a haunted tagline, a themed username form, a three-step "How it works" row, a footer with the required AI-art disclosure, real page metadata and a static Open Graph image.
2. **Mobile (any width below 768 px)**: fix the broken header, place chrome, pager and creature placement, and make the detail panel a full-height sheet.
3. **Edge states**: themed not-found, rate-limited, server-error and empty-graveyard pages, a themed loading state for `/g/[owner]`, and a themed app-level 404.

Everything reuses the existing art in `public/art/`, the `@theme` tokens in `app/globals.css`, the `next/font` faces in `app/fonts.ts`, and the existing pure layout functions in `lib/estate-view.ts`. No new image assets are required.

Findings from reading the existing code that shape these requirements:

- `UsernameForm` labels its button "Visit graveyard" and `tests/landing-form.test.tsx` asserts that label. The button becomes "Open the gate", so that test is updated in place, not deleted.
- `Header` has no owner chip yet (owner mode is a later spec). On mobile, "owner chip" means the existing `header-username-badge` and the Haunted Estate badge.
- `PlaceView` places chrome with the fixed `--site-header-h` (7rem) and a fallback chrome height. `STAGE_BANDS` are fractions of scene height, and `topLimitPx` is the only measured input, so on a phone the bands can place creatures under the header or the pager.
- `DetailPanel` is a bottom sheet capped at `max-h-[85vh]` below the desktop breakpoint.
- `SceneErrorState` covers `not-found`, `invalid-username`, `rate-limited` and `server-error`, but folds `server-error` into the rate-limit copy and uses ad hoc button classes. An empty graveyard (0 public repos) has no dedicated state, and `app/g/[username]/` has no `loading.tsx`. The app has no `not-found.tsx`.
- `public/art/` already holds `place-gate`, `bg-far`, `mg-fence`, `fg-frame`, `fog-wisps`, `fog-wisps-thin`, `ghost-0`, `zombie-0`, `risen`, `tomb-arch-fresh` and `mausoleum`.

## Glossary

- **Landing_Page**: The route `/`, rendered by `app/page.tsx`.
- **Gate_Scene**: The full-bleed background of the Landing_Page, built from `place-gate`, `fog-wisps`, `fog-wisps-thin` and the Moon.
- **Scrim**: A token-based dark gradient placed behind a text block on the Landing_Page to keep text legible over the Gate_Scene art.
- **Wordmark**: The text "Repo Graveyard" set in the `font-wordmark` (UnifrakturMaguntia) face with the crimson glow.
- **Username_Form**: The client form `components/landing/UsernameForm.tsx` that validates a GitHub username and navigates to `/g/{username}`.
- **Estate_Link**: The secondary link on the Landing_Page that goes to `/estate`.
- **How_It_Works_Row**: The row of three steps on the Landing_Page, each with a small creature image.
- **Landing_Footer**: The footer of the Landing_Page.
- **Site_Header**: The `Header` component shown above the map and place views.
- **Menu_Disclosure**: The mobile "Menu" button and the panel it expands, holding the visit form, the Lights toggle and the Sound toggle.
- **Mobile_Viewport**: A viewport whose width is narrower than `MOBILE_BREAKPOINT` (768 px), that is 767 px or less, and whose height is at least 667 px.
- **Place_Chrome**: In a place view, the return link, the place title block, the filter chips, the Pager and the place navigation, taken together.
- **Bottom_Bar**: The single mobile container that holds the Pager and the place navigation.
- **Chrome_Box**: The measured bounding box of one Place_Chrome element or of the Site_Header.
- **Stage_Band**: The vertical range of a place view in which creatures and plaques are placed.
- **Creature_Box**: The bounding box of a creature image or of its name plaque, as computed by `resolvePlacement` and `plaqueRect`.
- **Detail_Sheet**: The `DetailPanel` when shown on a Mobile_Viewport.
- **Themed_Button**: A button or link styled with the shared iron or crimson plaque classes (`btn2` or the crimson action style) from `app/globals.css`, using `@theme` tokens only.
- **Edge_State_Page**: One of the pages shown for not-found, rate-limited, server-error, or empty-graveyard.
- **Themed_Shell**: The scene background, fog and Site_Header treatment shared by every Edge_State_Page, the loading page and the app 404.
- **Loading_Page**: `app/g/[username]/loading.tsx`.
- **App_Not_Found_Page**: `app/not-found.tsx`.
- **Reduced_Motion**: The `prefers-reduced-motion: reduce` media preference.
- **Token**: A color, font or motion value defined in `app/globals.css` under `@theme`.

## Requirements

### Requirement 1: Landing gate scene and title

**User Story:** As a first-time visitor, I want the landing page to open on the haunted gate, so that I know at once what world I am entering.

#### Acceptance Criteria

1. THE Landing_Page SHALL render the Gate_Scene as a full-bleed background covering 100% of the viewport width and height at viewport widths from 320 px to 2560 px, using `place-gate.webp`, `fog-wisps.webp`, `fog-wisps-thin.webp` and the Moon.
2. THE Landing_Page SHALL render "Repo Graveyard" as the only `h1` on the page, using the `font-wordmark` face and the crimson glow.
3. THE Landing_Page SHALL render exactly one tagline line, "Every abandoned repo leaves something behind.", in the `font-narrative` face.
4. THE Landing_Page SHALL render the tagline, the Username_Form and the other text blocks on a token-based dark Scrim (a gradient) placed behind the text block, and the text color Tokens SHALL meet a contrast ratio of at least 4.5:1 against the Scrim's darkest stop and against the solid fallback background.
5. WHILE Reduced_Motion is not active, THE Gate_Scene SHALL drift the two fog layers and apply pointer parallax to the art, with each parallax layer displacing no more than 24 px from its resting position.
6. WHILE Reduced_Motion is active, THE Gate_Scene SHALL render with no fog drift, no pointer parallax and no idle animation, leaving every layer at its resting position.
7. THE Landing_Page SHALL load the Gate_Scene background through `next/image` with explicit width and height values and a priority hint on the largest background image only.
8. IF a Gate_Scene image file fails to load, THEN THE Landing_Page SHALL still render the h1, the tagline and the form over a solid token-based dark fallback background, and the text color Tokens SHALL meet a contrast ratio of at least 4.5:1 against that fallback.

### Requirement 2: Landing form, how-it-works and footer

**User Story:** As a visitor, I want a themed way to open a graveyard or tour the sample estate, so that I can try the app in one step.

#### Acceptance Criteria

1. THE Username_Form SHALL render a text input labeled "GitHub username" and a primary Themed_Button labeled "Open the gate".
2. WHEN the Username_Form is submitted with an empty or whitespace-only value, THE Username_Form SHALL show the message "A username is required" in an element with `role="alert"`, SHALL NOT navigate, SHALL keep the entered value in the input, and SHALL move keyboard focus to the input.
3. IF the submitted value fails `isValidUsername`, THEN THE Username_Form SHALL show the message "That doesn't look like a valid GitHub username" in an element with `role="alert"`, SHALL NOT navigate, SHALL keep the entered value in the input, and SHALL move keyboard focus to the input.
4. WHEN the Username_Form is submitted with a value that passes `isValidUsername`, THE Username_Form SHALL trim leading and trailing whitespace, clear any visible validation message, and navigate to `/g/{encodeURIComponent(username)}`.
5. WHEN the user edits the input value after a validation message is shown, THE Username_Form SHALL remove that message within 100 ms of the edit.
6. THE Landing_Page SHALL render the Estate_Link with the text "Tour the Haunted Estate", styled as a secondary Themed_Button, whose `href` is `/estate`.
7. THE Landing_Page SHALL render the How_It_Works_Row as an ordered list of exactly three steps in this order: "Visit a graveyard", "Hold a séance", "Revive it in Kiro".
8. THE How_It_Works_Row SHALL show exactly one existing creature image per step: `ghost-0.webp`, `zombie-0.webp` and `risen.webp` respectively, each with an empty `alt` attribute because the step text names the step.
9. THE Landing_Footer SHALL render the text "Built with Kiro", a link whose `href` is `https://github.com/be4glebot/repo-graveyard`, and the sentence "Art generated with ChatGPT; planning help from Claude".
10. THE Landing_Page SHALL give every interactive element a visible `candle-400` focus ring when it has keyboard focus, and SHALL order keyboard tab focus as: input, "Open the gate", Estate_Link, then footer link.
11. THE Landing_Page SHALL use only Tokens for color and only `next/font` faces for type, with zero hardcoded hex color values in its styles.

### Requirement 3: Page metadata and Open Graph image

**User Story:** As someone sharing the app, I want a real title, description and preview card, so that a pasted link looks finished.

#### Acceptance Criteria

1. THE root layout SHALL export metadata containing a title template, a description of 50 to 160 characters, `metadataBase` read from the `NEXT_PUBLIC_SITE_URL` environment variable, Open Graph fields (`title`, `description`, `type`, `siteName`) and a Twitter `summary_large_image` card.
2. THE Landing_Page SHALL reference exactly one static Open Graph image of 1200 by 630 pixels, composed from existing art in `public/art/`, committed as a file and no larger than 300 KB.
3. THE Open Graph image SHALL be served as a static file without runtime image generation on any request.
4. THE Open Graph image SHALL include alt text of 1 to 200 characters that contains "Repo Graveyard" and describes the gate scene.
5. THE existing per-user title "Repo Graveyard — {username}" on `/g/[username]` SHALL remain unchanged.
6. IF a page other than the Landing_Page does not define its own Open Graph image, THEN THE root layout metadata SHALL supply the same static Open Graph image as the fallback for that page.
7. IF `NEXT_PUBLIC_SITE_URL` is missing or not a valid absolute URL, THEN THE root layout SHALL fall back to `http://localhost:3000` so that Open Graph and Twitter image URLs remain absolute.
8. THE `.env.example` file SHALL contain a `NEXT_PUBLIC_SITE_URL` entry with a placeholder value.

### Requirement 4: Compact mobile header and Menu

**User Story:** As a phone user, I want a header that does not collide with the scene title, so that I can read the page and still reach the controls.

#### Acceptance Criteria

1. WHILE the viewport is a Mobile_Viewport, THE Site_Header SHALL render the Wordmark and the username badge on a single row with no wrapping onto a second row, and SHALL render the Haunted Estate badge on that same row WHILE in estate mode.
2. WHILE the viewport is a Mobile_Viewport, THE Site_Header SHALL render a "Menu" button that controls the Menu_Disclosure, with a touch target of at least 44 by 44 CSS pixels.
3. WHILE the viewport is a Mobile_Viewport, THE Menu_Disclosure SHALL hold the visit form, the Lights toggle and the Sound toggle, and THE Site_Header SHALL NOT render them outside the Menu_Disclosure.
4. WHILE the viewport is a Mobile_Viewport, THE Menu_Disclosure SHALL be closed on initial page load.
5. THE "Menu" button SHALL expose `aria-expanded` set to `true` when the Menu_Disclosure is open and `false` when it is closed, and `aria-controls` set to the id of the Menu_Disclosure panel.
6. WHEN the user activates the "Menu" button, THE Site_Header SHALL toggle the Menu_Disclosure between open and closed.
7. WHEN the Menu_Disclosure is open and the user presses Escape, THE Site_Header SHALL close the Menu_Disclosure and return keyboard focus to the "Menu" button.
8. WHEN a visit form submit inside the Menu_Disclosure triggers navigation, THE Site_Header SHALL close the Menu_Disclosure.
9. IF a visit form submit inside the Menu_Disclosure is rejected by form validation and does not navigate, THEN THE Site_Header SHALL keep the Menu_Disclosure open and preserve the entered username text.
10. WHEN the viewport changes from a Mobile_Viewport to a width wider than a Mobile_Viewport while the Menu_Disclosure is open, THE Site_Header SHALL close the Menu_Disclosure and render the desktop layout.
11. WHILE the viewport is wider than a Mobile_Viewport, THE Site_Header SHALL keep the current desktop layout with the visit form and toggles inline and no "Menu" button.
12. WHILE the viewport is a Mobile_Viewport, THE Site_Header SHALL expose its rendered height, measured in CSS pixels, as the top offset used by Place_Chrome in place of the fixed `--site-header-h` value, and SHALL update that offset within one animation frame WHEN the Menu_Disclosure opens or closes or the header height changes.

### Requirement 5: Mobile place chrome and stage bands

**User Story:** As a phone user, I want the place title, filters, pager and creatures laid out without overlap, so that every creature is visible and tappable.

#### Acceptance Criteria

1. WHILE the viewport is a Mobile_Viewport, THE Place_Chrome SHALL stack in this top-to-bottom order: the return link, the place title block, the filter chips, then the stage.
2. WHILE the viewport is a Mobile_Viewport, THE filter chips SHALL scroll horizontally inside a single row and SHALL NOT wrap onto a second row.
3. WHILE the viewport is a Mobile_Viewport, THE Place_Chrome SHALL render the Pager and the place navigation inside one Bottom_Bar fixed to the bottom of the place view.
4. WHILE the viewport is a Mobile_Viewport, THE place view SHALL keep every pair of Chrome_Boxes (the Site_Header, the return link, the title block, the filter chips and the Bottom_Bar) non-intersecting, meaning the intersection area of any two Chrome_Box rectangles is 0 px².
5. WHILE the viewport is a Mobile_Viewport, THE place view SHALL compute the top limit of the Stage_Band from the measured bottom of the lowest top Chrome_Box and the bottom limit from the measured top of the Bottom_Bar.
6. WHILE the viewport is a Mobile_Viewport, THE place view SHALL keep every Creature_Box, including plaques, fully inside the area between those two measured limits (0 px tolerance) and at least `SCENE_EDGE_MARGIN_PX` from the left and right edges.
7. IF a Chrome_Box height has not been measured yet, THEN THE place view SHALL use a fallback height that is at least the known mobile chrome height for that Chrome_Box, so that no Creature_Box sits under chrome on first paint.
8. WHEN a measured Chrome_Box height changes (for example on orientation change, window resize or filter chip content change), THE place view SHALL recompute the Stage_Band limits and re-place the creatures within 100 ms of the measurement change.
9. THE Stage_Band computation SHALL be a pure function in `lib/estate-view.ts` that takes the scene height, the top chrome bottom and the bottom bar top in pixels, and returns a top and bottom in pixels, so that it can be tested without a DOM.
10. IF the measured limits leave a Stage_Band with a height of 0 px or less (top ≥ bottom), THEN THE Stage_Band function SHALL return a band with a non-negative height, with top and bottom clamped inside the scene height, and the place view SHALL still render every creature without throwing an error.
11. WHILE the viewport is wider than a Mobile_Viewport, THE place view SHALL keep the current desktop `STAGE_BANDS` behavior unchanged.

### Requirement 6: Full-height detail sheet on mobile

**User Story:** As a phone user, I want the detail panel to use the whole screen, so that the facts and séance are readable.

#### Acceptance Criteria

1. WHILE the viewport is a Mobile_Viewport, THE Detail_Sheet SHALL occupy 100% of the viewport width and 100% of the dynamic viewport height, and SHALL remain fully visible (no part of the sheet hidden behind the browser toolbar) as the toolbar shows or hides.
2. WHILE the viewport is a Mobile_Viewport, THE Detail_Sheet SHALL scroll its content vertically within the sheet when the content is taller than the sheet, and SHALL NOT scroll the page behind it.
3. WHILE the viewport is a Mobile_Viewport and the Detail_Sheet is open, THE Detail_Sheet SHALL keep the close control visible at the top of the sheet at every scroll position, with a touch target of at least 44 by 44 CSS pixels.
4. WHEN the Detail_Sheet opens, THE Detail_Sheet SHALL move keyboard focus into the sheet, keep Tab and Shift+Tab navigation within the sheet, and lock background page scrolling.
5. WHEN the user presses Escape or activates the close control while the Detail_Sheet is open, THE Detail_Sheet SHALL close, unlock background page scrolling, and return keyboard focus to the element that opened it.
6. IF the element that opened the Detail_Sheet no longer exists when the sheet closes, THEN THE Detail_Sheet SHALL move keyboard focus to the document body's first focusable element and SHALL NOT throw an error.
7. WHILE the viewport is wider than a Mobile_Viewport, THE DetailPanel SHALL render as a 420 px wide panel on the right-hand side of the viewport.

### Requirement 7: Themed edge-state pages

**User Story:** As a visitor who hits a dead end, I want an in-character page with a way forward, so that I am never stranded.

#### Acceptance Criteria

1. THE Themed_Shell SHALL render every Edge_State_Page on the scene background with fog and the Site_Header treatment.
2. IF the graveyard load returns `not-found` or `invalid-username`, THEN THE Edge_State_Page SHALL show the heading "No one by that name rests here", an explanation of 1 to 2 sentences and at most 200 characters that says no graveyard was found for the entered name, a "Try again" Themed_Button linking to `/`, and a "Tour the Haunted Estate" Themed_Button linking to `/estate`.
3. IF the graveyard load returns `rate-limited` and the reset time is known, THEN THE Edge_State_Page SHALL show the heading "The gates are locked for now", the reopen countdown in whole minutes (rounded up, minimum 1 minute), and a "Tour the Haunted Estate" Themed_Button linking to `/estate`.
4. IF the graveyard load returns `rate-limited` and the reset time is unknown, THEN THE Edge_State_Page SHALL show the heading "The gates are locked for now", an explanation with no countdown, and a "Tour the Haunted Estate" Themed_Button linking to `/estate`.
5. IF the graveyard load returns `server-error`, THEN THE Edge_State_Page SHALL show a heading and body whose text differs from the rate-limited heading and body, a "Try again" Themed_Button that reloads the same path, and a "Tour the Haunted Estate" Themed_Button linking to `/estate`.
6. IF the graveyard load succeeds with zero public repositories, THEN THE Edge_State_Page SHALL show an empty cemetery under a full moon, the heading "Nothing buried here yet.", a line that includes the owner's username, and a "Tour the Haunted Estate" Themed_Button linking to `/estate`.
7. THE Edge_State_Page copy SHALL follow the in-character voice in `voice.md`: kind, never blaming, no gore, and no hard-coded dates or day counts.
8. THE Edge_State_Page SHALL give every Themed_Button a minimum touch target of 44 by 44 px and a visible `candle-400` focus ring.
9. THE Edge_State_Page SHALL expose its main message in an element with `role="alert"` for not-found, rate-limited and server-error, and `role="status"` for the empty graveyard.
10. WHILE Reduced_Motion is active, THE Themed_Shell SHALL render fog without drift.

### Requirement 8: Loading page and app 404

**User Story:** As a visitor, I want the app to show something in-world while it loads or when a page does not exist, so that I never see a blank screen.

#### Acceptance Criteria

1. WHILE a request to `/g/[username]` is pending, THE Loading_Page SHALL render in the Themed_Shell the text "Digging up {username}'s graveyard…" with the username URL-decoded and rendered as escaped text, so that markup characters in the username are displayed literally and never interpreted.
2. WHILE a request to `/g/[username]` is pending, THE Loading_Page SHALL render fog and SHALL NOT render a spinner or any other rotating progress indicator.
3. WHILE the Loading_Page is displayed, THE Loading_Page SHALL render its status text in an element with `role="status"`.
4. WHILE a request to `/g/[username]` is pending, THE Loading_Page SHALL render the Themed_Shell background and fog in the first painted frame, so that no frame shows an empty viewport, including before the username is resolved.
5. IF the username cannot be resolved or URL-decoded while the Loading_Page is displayed, THEN THE Loading_Page SHALL render the status text "Digging up this graveyard…" without a username and SHALL keep the Themed_Shell and fog visible.
6. IF the username is longer than 39 characters, THEN THE Loading_Page SHALL display the first 39 characters of the username followed by an ellipsis, so that the status text does not overflow the viewport width at 320 px.
7. WHEN a request matches no route, THE App_Not_Found_Page SHALL render in the Themed_Shell a heading in the existing voice, a "Return to the gate" Themed_Button linking to `/`, and a "Tour the Haunted Estate" Themed_Button linking to `/estate`.
8. WHEN a request matches no route, THE App_Not_Found_Page SHALL respond with HTTP status 404.
9. WHEN a visitor navigates by keyboard on the App_Not_Found_Page, THE App_Not_Found_Page SHALL make both Themed_Buttons reachable in tab order, each with a visible focus ring.

### Requirement 9: Cross-cutting quality and verification

**User Story:** As the maintainer, I want the new surfaces covered by automated tests and the project rules, so that regressions are caught before judges see them.

#### Acceptance Criteria

1. THE landing, mobile and edge-state components SHALL use only Tokens for color, only `next/font` faces for type, and zero hardcoded hex, rgb, rgba, hsl or hsla color literals in component source files.
2. THE landing, mobile and edge-state components SHALL keep every interactive element reachable with the Tab key in DOM order, and SHALL render a visible focus ring with a contrast ratio of at least 3:1 against its adjacent background whenever that element has keyboard focus.
3. WHILE Reduced_Motion is active, THE landing, mobile and edge-state components SHALL run zero CSS animations, zero CSS transitions longer than 0 ms and zero Framer Motion animations.
4. THE project test suite SHALL include DOM tests for the Username_Form covering empty input (submission blocked, no navigation, an error indication shown), invalid input (submission blocked, no navigation, an error indication shown), valid input (navigation to `/g/{username}`), the Estate_Link `href`, and the "Open the gate" label.
5. THE project test suite SHALL include DOM tests for the Landing_Page copy, covering the tagline, the three How_It_Works_Row steps in document order, every footer link `href` and label, and the required art disclosure sentence.
6. THE project test suite SHALL include DOM tests for the Menu_Disclosure covering: `aria-expanded` equal to `false` when closed and `true` when open; `aria-controls` referencing the id of the disclosure panel; opening and closing by click; pressing Escape while open closing the disclosure and moving focus to the "Menu" button; and the controls rendering inside the disclosure panel and not outside it.
7. THE project test suite SHALL include a geometry test over viewport widths 375 to 767 px and heights 667 to 1024 px (with 375 by 812 px as the named example) that uses the pure functions in `lib/estate-view.ts` (`scatterLayout`, `resolvePlacement`, `plaqueRect`, `rectsIntersect` and the Stage_Band function from Requirement 5) and asserts, for every place, that zero pairs of Chrome_Boxes intersect and zero Creature_Boxes intersect any Chrome_Box.
8. THE project test suite SHALL include DOM tests for the Edge_State_Page, Loading_Page and App_Not_Found_Page covering the copy specified in Requirements 7 and 8 and the `href` and label of each Themed_Button link.
9. WHEN the Landing_Page button label changes, THE existing test `tests/landing-form.test.tsx` SHALL be updated in place to assert the new label, and the total count of existing test files and existing test cases SHALL NOT decrease.
10. THE verification for this spec SHALL use only `vitest` run in single-run mode, `tsc` and `npm run lint`, SHALL report zero failing tests, zero type errors and zero lint errors, and SHALL NOT run `next build`.
11. IF any of the verification commands in criterion 10 reports a failure, THEN THE verification SHALL be reported as failed, and the failing command and its failing test names or file locations SHALL be listed in the report.
