# Requirements Document

## Introduction

The Estate Map & Places feature restructures the single full-bleed graveyard scene into a two-level navigation model. The default **estate map** keeps the painted backdrop, moon, atmosphere, and turning-soon notice, but presents the classified repositories as **four places**, each a focusable link with a glowing plaque and a few representative creatures. Selecting a place opens a **place view** that lays its creatures out in depth rows across paginated plots, with decay-word filter chips, a pager, and a return control. Travelling into a place plays a short, skippable transition; reduced-motion users get a crossfade.

The hard constraint is that lifecycle classification is frozen: the single source of truth in the lifecycle module is not modified. All new behavior is a pure view-model mapping over already-classified rows plus presentational components. Four new pure functions — place mapping, per-place ordering, pagination, and plaque copy — carry the new domain logic and are property-tested.

This document derives the requirements from the approved design so that the design's four correctness properties can each cite specific requirement IDs.

## Glossary

- **Estate_Map**: The default view that shows the painted backdrop and the four places as focusable links.
- **Place**: One of four named locations on the Estate_Map: The Restless Sky (`sky`), Beyond the Gate (`gate`), Hallowed Ground (`ground`), The Crypt (`crypt`).
- **Place_View**: The in-place view showing one place's creatures in depth rows across paginated plots.
- **Lifecycle_State**: One of the five frozen classifications of a repository: `ghost`, `zombie`, `risen`, `tombstone`, `coffin`.
- **Graveyard_Row**: An already-classified repository record carrying at least `state`, `name`, `decayLevel`, and `daysQuiet`.
- **Plaque**: The labeled panel on a place link showing the Cinzel place name, an IM Fell italic count line, and a call to action.
- **Plot**: A fixed-size page of creatures within a Place_View (12 creatures per plot).
- **Decay_Word**: A human-readable label derived from a row's existing `decayLevel` band (ghost: healthy/fading/flickering/about to turn; zombie: fresh/rotting/decayed/skeletal/ancient).
- **Filter_Chip**: A selectable control in a Place_View that narrows the visible creatures to one Decay_Word, to Risen, or to all.
- **Server_Page**: The Next.js server component at `/g/[username]`, `/g/[username]/[repo]`, and `/estate` that performs request-time work and reads the clock once.
- **SceneView**: The client shell component that owns all interactive view state and calls only pure functions.
- **renderedAt**: The single request-time clock value read once by the Server_Page and never changed thereafter.
- **Travel_Transition**: The skippable animated transition played when entering a place from the map.
- **Lights_On_Table**: The warm-paper sortable register listing every repository across all four places.
- **placeOf**: The pure function mapping a Graveyard_Row's Lifecycle_State to exactly one Place.
- **orderForPlace**: The pure function producing a stable, per-place ordering of a place's rows.
- **paginate**: The pure function splitting rows into fixed-size plots.
- **plaqueCopy**: The pure function producing a place's singular/plural-correct count line.

## Requirements

### Requirement 1: Estate map default view

**User Story:** As a visitor, I want the estate map as the default view with the familiar painted scene, so that I can see the whole estate and choose where to go.

#### Acceptance Criteria

1. WHEN the Estate_Map is shown, THE SceneView SHALL render the reused backdrop, sky, moon, and atmosphere layers.
2. WHEN the Estate_Map is shown, THE SceneView SHALL render exactly four places in the display order sky, gate, ground, crypt.
3. WHEN the Estate_Map is shown AND `pickTurningSoon` returns a non-null turning-soon ghost, THE SceneView SHALL render the reused turning-soon notice naming that ghost.
4. WHEN the Estate_Map is shown AND `pickTurningSoon` returns null, THE SceneView SHALL render no turning-soon notice.
5. THE Estate_Map SHALL render each of the four places as exactly one keyboard-focusable link that is activatable by mouse click and by the Enter key, and that on activation opens that place.
6. WHERE a place contains zero rows, THE Estate_Map SHALL keep that place visible, render no representative creatures for it, and render it at a lower opacity than any place that contains one or more rows.

### Requirement 2: Place plaque content

**User Story:** As a visitor, I want each place to show a clear plaque, so that I understand what each place holds before I enter.

#### Acceptance Criteria

1. THE Estate_Map SHALL render each place plaque with the place name in the Cinzel display face.
2. THE Estate_Map SHALL render each place plaque with a count line in the IM Fell italic face whose text is the string returned by `plaqueCopy` for that place.
3. THE Estate_Map SHALL render each place plaque with a call-to-action label for that place.
4. WHERE a place contains one or more rows, THE Estate_Map SHALL display a number of representative creatures equal to the smaller of 3 and that place's row count, and never fewer than 1 when the place has rows.
5. THE Estate_Map SHALL select a place's representatives as the first N rows of `orderForPlace` for that place, where N is the count defined in criterion 4, preserving that ordering.

### Requirement 3: Place model (state-to-place mapping)

**User Story:** As a maintainer, I want the five lifecycle states mapped onto four places without changing classification, so that the navigation model is a pure view over frozen data.

#### Acceptance Criteria

1. THE placeOf SHALL map a row whose Lifecycle_State is `ghost` to the place `sky`.
2. THE placeOf SHALL map a row whose Lifecycle_State is `zombie` to the place `gate`.
3. THE placeOf SHALL map a row whose Lifecycle_State is `risen` to the place `gate`.
4. THE placeOf SHALL map a row whose Lifecycle_State is `tombstone` to the place `ground`.
5. THE placeOf SHALL map a row whose Lifecycle_State is `coffin` to the place `crypt`.
6. THE placeOf SHALL return one of exactly the four defined place identifiers (`sky`, `gate`, `ground`, `crypt`) for every one of the five Lifecycle_States, never returning undefined and never throwing.
7. WHEN rows are grouped by `placeOf`, THE SceneView SHALL assign every row to exactly one place and SHALL omit no row, such that the sum of the four place group sizes equals the input row count.
8. THE Estate_Map feature SHALL NOT modify the lifecycle classification logic.

### Requirement 4: Plaque copy (singular/plural correctness)

**User Story:** As a visitor, I want plaque counts phrased correctly, so that the copy reads naturally for zero, one, or many.

#### Acceptance Criteria

1. WHEN a place count is 0, THE plaqueCopy SHALL return that place's empty-copy string containing no digit character.
2. WHEN a place count is 1, THE plaqueCopy SHALL return a string containing the singular noun and singular verb for that place and SHALL NOT append the letter "s" to the singular noun.
3. WHEN a place count is 2 or greater, THE plaqueCopy SHALL return a string containing the plural noun and plural verb for that place.
4. WHERE the place is `gate` AND the risen count is 0, THE plaqueCopy SHALL omit the risen clause entirely, returning only the zombie base clause.
5. WHERE the place is `gate` AND the risen count is 1, THE plaqueCopy SHALL end the risen clause with the text "1 has risen".
6. WHERE the place is `gate` AND the risen count is 2 or greater, THE plaqueCopy SHALL end the risen clause with the count followed by the text "have risen".
7. WHERE the place is not `gate`, THE plaqueCopy SHALL ignore the risen count, producing identical output for any risen-count value.
8. IF the count or risen count is negative or fractional, THEN THE plaqueCopy SHALL normalize the value to a non-negative integer by clamping to a minimum of 0 and truncating toward zero before producing output.
9. THE plaqueCopy SHALL return a non-empty string for every finite count and risen count, and SHALL treat NaN or infinite inputs as 0, without throwing.

### Requirement 5: Place view depth rows and plots

**User Story:** As a visitor, I want a place to present its creatures in readable depth rows and pages, so that a crowded place stays legible.

#### Acceptance Criteria

1. WHEN a Place_View is shown, THE SceneView SHALL lay out the current plot across at least one and at most three depth rows.
2. THE Place_View SHALL render each further-back depth row at a scale no larger than, and a brightness no greater than, the row in front of it, with the front row largest and brightest.
3. THE Place_View SHALL use the existing `creatureScale` helper for per-row creature sizing.
4. THE paginate SHALL place at most 12 creatures in each plot.
5. THE Place_View SHALL render every creature in the current plot individually with no "+N more" collapse and no zone cap omission.

### Requirement 6: Per-place ordering

**User Story:** As a visitor, I want each place ordered to tell its own story, so that the most relevant creatures appear first.

#### Acceptance Criteria

1. WHERE the place is `sky`, THE orderForPlace SHALL order rows by `decayLevel` descending and then by `daysQuiet` descending so the most urgent ghosts appear first.
2. WHERE the place is `gate`, THE orderForPlace SHALL place every risen row before every zombie row.
3. WHERE the place is `gate`, THE orderForPlace SHALL order the zombie rows by `decayLevel` ascending so the freshest zombies appear first.
4. WHERE the place is `ground`, THE orderForPlace SHALL order rows by `daysQuiet` ascending so the newest at rest appear first.
5. WHERE the place is `crypt`, THE orderForPlace SHALL order rows by `daysQuiet` ascending so the newest sealed away appear first.
6. THE orderForPlace SHALL preserve the input order of any rows that compare equal on the place's ordering key.
7. THE orderForPlace SHALL return a result that is a permutation of the input rows containing the same multiset of rows.
8. THE orderForPlace SHALL NOT mutate the input array.
9. IF a row's `decayLevel` or `daysQuiet` is null, undefined, or not a finite number, THEN THE orderForPlace SHALL treat that value as 0 for comparison and SHALL NOT throw.

### Requirement 7: Pagination partition

**User Story:** As a maintainer, I want pagination to partition the rows exactly, so that every creature appears on exactly one plot and the pager is always coherent.

#### Acceptance Criteria

1. THE paginate SHALL produce plots whose in-order concatenation equals the input rows in order and multiplicity.
2. WHEN the input rows are empty, THE paginate SHALL return exactly one plot of length 0.
3. WHEN the input rows are non-empty, THE paginate SHALL make every plot non-empty.
4. WHEN the input rows are non-empty, THE paginate SHALL make every plot except possibly the last contain exactly the plot size, and THE last plot SHALL contain between 1 and the plot size inclusive.
5. IF the requested plot size is 0, negative, or not a finite number, THEN THE paginate SHALL use a plot size of 1.

### Requirement 8: Pager and filter chips

**User Story:** As a visitor, I want to page and filter within a place, so that I can move through plots and narrow the creatures by decay.

#### Acceptance Criteria

1. THE Place_View SHALL render a pager showing "Plot X of Y" where X is the 1-based current plot index and Y is the total plot count.
2. THE Place_View SHALL label the forward pager control "Nearer the gate" and the backward pager control "Deeper into the dark".
3. IF the plot index is below 0, THEN THE Place_View SHALL clamp it to 0, and IF the plot index is above the plot count minus 1, THEN THE Place_View SHALL clamp it to the plot count minus 1, before rendering.
4. WHERE the place is `sky`, THE Place_View SHALL render one filter chip per ghost Decay_Word in the order healthy, fading, flickering, about to turn.
5. WHERE the place is `gate`, THE Place_View SHALL render one filter chip per zombie Decay_Word in the order fresh, rotting, decayed, skeletal, ancient, plus a Risen chip.
6. THE Place_View SHALL display each filter chip with the count of place rows matching that chip's decay band or state.
7. WHERE a filter chip's count is 0, THE Place_View SHALL render that chip dimmed and disabled.
8. WHEN a Decay_Word chip is selected, THE Place_View SHALL show only the rows at that decay band and hide all others.
9. WHEN the Risen chip is selected at the gate, THE Place_View SHALL show only the risen rows and hide all others.
10. WHEN the all filter is active, THE Place_View SHALL show every row for the place.
11. WHERE the place is `ground` or `crypt`, THE Place_View SHALL render no decay filter chips.

### Requirement 9: Return to the gate

**User Story:** As a visitor, I want to leave a place and go back to the map, so that I can choose a different place.

#### Acceptance Criteria

1. WHILE the view is a place, THE Place_View SHALL render a "Return to the gate" control that is reachable by keyboard focus.
2. WHEN the return control is activated by pointer click or by the Enter or Space key, THE SceneView SHALL set the view to the Estate_Map.
3. WHEN the return control sets the view to the Estate_Map, THE SceneView SHALL move keyboard focus to the originating place link, falling back to the Estate_Map's primary heading when that link is unavailable.

### Requirement 10: Routing and client-side navigation

**User Story:** As a visitor, I want place selection reflected in the URL and the browser buttons, so that places are shareable and back/forward works.

#### Acceptance Criteria

1. WHEN the route is `/g/[username]` or `/estate` with no `at` parameter present, THE SceneView SHALL show the Estate_Map.
2. WHEN the `at` parameter equals exactly one of `sky`, `gate`, `ground`, or `crypt`, THE SceneView SHALL show the place identified by that value.
3. IF the `at` parameter is absent, empty, or not exactly one of `sky`, `gate`, `ground`, or `crypt`, THEN THE SceneView SHALL show the Estate_Map.
4. THE Server_Page SHALL read the `at` parameter only during the initial server render and SHALL NOT read it again after client hydration.
5. WHEN a visitor enters a place from the map, THE SceneView SHALL add exactly one pushed browser history entry whose URL carries that place in the `at` parameter and SHALL NOT trigger a re-run of the Server_Page.
6. WHEN a visitor returns to the map, THE SceneView SHALL add exactly one pushed browser history entry whose URL omits the `at` parameter and SHALL NOT trigger a re-run of the Server_Page.
7. WHILE navigating between the map and places on the client, THE SceneView SHALL NOT refetch the graveyard data, SHALL NOT read a new renderedAt value, and SHALL NOT reset its interactive state.
8. WHEN a browser back or forward action fires a popstate event, THE SceneView SHALL set the view from the history state's view value if present, otherwise from the current URL's `at` parameter if it is a valid place identifier, otherwise to the Estate_Map.

### Requirement 11: Deep-link repository resolution

**User Story:** As a visitor following a repository link, I want to land in the place that holds that repository with it selected, so that deep links open the right spot.

#### Acceptance Criteria

1. WHEN the route is `/g/[username]/[repo]` AND the repo segment matches exactly one row AND no valid `at` parameter is present, THE SceneView SHALL open the place containing that row with the matching creature selected.
2. IF a valid `at` parameter (exactly one of `sky`, `gate`, `ground`, or `crypt`) is present, THEN THE SceneView SHALL set the view from the `at` parameter in preference to the deep-linked repository place.
3. IF no valid `at` parameter is present AND the repo segment matches exactly one row, THEN THE SceneView SHALL select the place containing that row.
4. IF no valid `at` parameter is present AND the repo segment matches no row, THEN THE SceneView SHALL show the Estate_Map with no creature selected.

### Requirement 12: Turning-soon "Go to it"

**User Story:** As a visitor, I want the turning-soon notice to take me straight to that ghost, so that I can find the at-risk repository immediately.

#### Acceptance Criteria

1. WHILE a turning-soon ghost exists, THE turning-soon notice on the Estate_Map SHALL render a "Go to it" action reachable by keyboard focus.
2. WHEN the "Go to it" action is activated by pointer click or by the Enter or Space key, THE SceneView SHALL set the view to the `sky` place.
3. WHEN the "Go to it" action is activated, THE SceneView SHALL select the turning-soon ghost.
4. WHEN the "Go to it" action is activated, THE SceneView SHALL show the plot that contains the turning-soon ghost.
5. WHEN the "Go to it" action is activated, THE SceneView SHALL set the active filter to all so the selected ghost is not filtered out.
6. IF no turning-soon ghost exists, THEN THE Estate_Map SHALL NOT render the "Go to it" action.

### Requirement 13: Travel transition

**User Story:** As a visitor, I want a short transition when entering a place, so that the move feels like travelling into the estate.

#### Acceptance Criteria

1. WHEN a visitor enters a place from the map AND reduced motion is not requested, THE Travel_Transition SHALL run for 1200 milliseconds plus or minus 100 milliseconds.
2. WHILE the Travel_Transition runs, THE Travel_Transition SHALL parallax-zoom at least two backdrop layers toward the place at distinct rates, raise a fog layer to full occlusion before swapping the content from map to place, fade the place title from transparent to opaque, and raise each creature on a fixed per-creature stagger delay such that all creature raises complete before the transition ends.
3. WHILE the Travel_Transition is running, WHEN any key is pressed or any pointer is activated, THE Travel_Transition SHALL halt its animation and present the arrived state immediately.
4. WHERE reduced motion is requested, THE Travel_Transition SHALL perform a 300 millisecond crossfade from the map to the place with no parallax zoom, no fog wipe, and no staggered raise.
5. WHEN the Travel_Transition reaches the arrived state, THE SceneView SHALL move keyboard focus to the place heading.
6. WHEN a visitor returns to the map AND an originating place link is available, THE SceneView SHALL move focus to that originating place link.
7. WHEN a visitor returns to the map AND no originating place link is available, THE SceneView SHALL move focus to the Estate_Map's primary heading.

### Requirement 14: Lights-on register from map and place

**User Story:** As a reader, I want the lights-on register from anywhere with a place column, so that I can read the full sortable list and return to where I was.

#### Acceptance Criteria

1. WHEN lights-on is enabled from the Estate_Map or from a Place_View, THE SceneView SHALL render the Lights_On_Table with exactly one row per repository across all four places.
2. THE Lights_On_Table SHALL include a sortable Place column whose value for each row is the place display name derived from `placeOf` for that row.
3. THE Lights_On_Table SHALL include the Place column alongside the existing Repository, State, Quiet-for, and Decay columns.
4. WHILE lights-on is toggled on, THE SceneView SHALL preserve the view, plot index, active filter, and selected creature that were in effect immediately before lights-on was enabled.
5. WHEN lights-on is disabled, THE SceneView SHALL restore the view, plot index, active filter, and selected creature preserved in criterion 4, falling back to the Estate_Map when no prior view was recorded.
6. WHEN lights-on is disabled, THE SceneView SHALL swap back to the preserved view without running the Travel_Transition.

### Requirement 15: Header, summary, and footer chrome

**User Story:** As a visitor, I want the chrome to match the painted boards, so that the interface reads consistently.

#### Acceptance Criteria

1. THE Header SHALL render the wordmark in the blackletter face.
2. THE Header SHALL render the username in a bordered Cinzel badge.
3. THE Header SHALL render the summary line in a letter-spaced Cinzel treatment.
4. THE Header SHALL render the lights-on and sound toggles in the styled bordered toggle treatment.
5. WHEN a summary segment count is 1, THE SummaryLine SHALL render the singular noun form for that segment.
6. WHEN a summary segment count is 2 or greater, THE SummaryLine SHALL render the plural noun form for that segment.
7. WHEN a summary segment count is 0, THE SummaryLine SHALL render the plural noun form for that segment.
8. THE Footer legend SHALL present the five lifecycle states grouped under their four places.
