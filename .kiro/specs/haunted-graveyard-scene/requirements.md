# Requirements Document

## Introduction

This feature renders the haunted graveyard scene: the signature visual surface of Repo Graveyard. It takes the classified repositories produced by the existing lifecycle engine (`lib/lifecycle.ts`, states ghost / risen / zombie / tombstone / coffin, ghost decay 0–3, zombie decay 0–4) and paints them into a gothic night scene built from three parallax art plates, code-drawn atmosphere that encodes real data (moon, fog, lightning, vignette, grain, cobwebs, bats), and one creature per repository positioned by state and ordered by decay. The same scene renders a live graveyard at `/g/[username]`, a deep-link variant at `/g/[username]/[repo]` that pre-selects a creature, and the bundled sample at `/estate` (the Haunted Estate), which loads invented fixture data from `data/estate.json` with dates stored as "days ago" offsets so the sample looks identical on any test day. A "Lights on" toggle shows the same data as a warm-paper sortable table for accessibility and verification.

The visual and behavioral source of truth is `.kiro/steering/design.md` and `.kiro/steering/product.md`, with the approved compositions `docs/design-canvas/ArtPreview.dc.html` (the full scene) and `docs/design-canvas/Creatures.dc.html` (every decay level). This spec consumes the lifecycle classification unchanged; it does not redefine any threshold. Sound is explicitly deferred to a later spec: this feature leaves hook points but implements no audio. Moon, fog, and lightning stay drawn in code because they encode data.

## Glossary

- **Scene**: The full-viewport gothic night composition rendered at `/g/[username]`, `/g/[username]/[repo]`, and `/estate`, layering parallax art, code-drawn atmosphere, creatures, and chrome.
- **Scene_Renderer**: The React component tree that builds the Scene from a list of classified repositories plus a "now" value.
- **Classified_Repo**: A repository already resolved to a `state` (ghost / risen / zombie / tombstone / coffin), a `decayLevel` (0–3 for ghost, 0–4 for zombie, otherwise null), `daysQuiet`, `name`, and `url`, as produced by `buildRows` in `lib/graveyard-view.ts` on top of `classify` in `lib/lifecycle.ts`.
- **Parallax_Backdrop**: The three painted plates from `public/art` — `bg-far` (sky, castle, hills; opaque), `mg-fence` (gate centerpiece) with `mg-fence-tile` repeated horizontally to fill the width, and `fg-frame` (tree and thorns; transparent) in front — each translated a different amount in response to the pointer plus a slow idle drift.
- **Atmosphere_Layer**: The code-drawn effects composited over the Parallax_Backdrop: moon, fog, lightning, vignette, film grain, cobwebs, and bats.
- **Creature**: The visual representation of one Classified_Repo: a `next/image` chosen from `public/art` by state and decay level, wrapped in a focusable button with an accessible name.
- **Creature_Image_Map**: The total function from (`state`, `decayLevel`) to an art asset basename: ghost → `ghost-0`…`ghost-3`, zombie → `zombie-0`…`zombie-4`, risen → `risen`, tombstone → `tomb-arch-fresh`, coffin → `coffin`.
- **Zone**: A region of the Scene that holds one kind of Creature: the sky band (ghosts), the left edge grave (risen), inside/in front of the fence (tombstones), the foreground outside the fence (zombies), and the crypt at the right (coffins at the mausoleum door).
- **Scene_Summary**: The header line counting souls and each state, e.g. "16 souls · 4 ghosts · 1 risen · 6 zombies · 3 at rest · 2 sealed".
- **Turning_Soon_Notice**: The crimson header notice naming a ghost within 30 days of becoming a zombie, with a countdown.
- **Whisper**: A single italic data-driven line shown transiently in the Scene, one at a time, announced to screen readers.
- **Lights_On_View**: The alternate warm-paper sortable table showing the same data with no effects, styled per step 1 of `docs/design-canvas/LightsOut.dc.html`.
- **Haunted_Estate**: The sample Scene at `/estate`, populated from `data/estate.json` with invented data and relative "days ago" dates; overrides are not persisted.
- **Estate_Fixture**: The bundled file `data/estate.json` of invented repositories covering every state and decay level, with dates as "days ago" offsets and pre-written diagnoses and séances for later specs.
- **Reduced_Motion**: The user agent state reported by the `prefers-reduced-motion: reduce` media query.

---

## Requirements

### Requirement 1: Scene Routes

**User Story:** As a visitor, I want the graveyard scene to render for a live username, for a deep-linked creature, and for the bundled sample, so that I can view any graveyard through the same experience.

#### Acceptance Criteria

1. WHEN a path of the form `/g/[username]` is requested with a username of 1–39 characters containing only alphanumeric characters and hyphens, not starting or ending with a hyphen, AND that username's Classified_Repos load successfully, THE Scene_Renderer SHALL render the Scene populated from those Classified_Repos.
2. WHEN a path of the form `/g/[username]/[repo]` is requested and `[repo]` matches a loaded repository name by exact, case-insensitive comparison, THE Scene_Renderer SHALL render the Scene with that repository's Creature in the selected state on first paint.
3. IF a path of the form `/g/[username]/[repo]` is requested and `[repo]` does not match any loaded repository name under exact, case-insensitive comparison, THEN THE Scene_Renderer SHALL render the Scene with no Creature selected.
4. WHEN the path `/estate` is requested, THE Scene_Renderer SHALL render the Scene populated from the Estate_Fixture and SHALL NOT issue any GitHub or network API call.
5. IF a requested username does not satisfy the format in criterion 1, THEN THE Scene_Renderer SHALL render a not-found indication and SHALL NOT issue any GitHub or network API call.
6. IF a username's Classified_Repos fail to load because the user is not found, THEN THE Scene_Renderer SHALL render a distinct not-found indication consistent with `.kiro/steering/design.md` and SHALL NOT render a partial Scene.
7. IF a username's Classified_Repos fail to load because the GitHub source is unreachable, THEN THE Scene_Renderer SHALL render a distinct unreachable indication consistent with `.kiro/steering/design.md` and SHALL NOT render a partial Scene.
8. THE Scene_Renderer SHALL render the same Zone layout, palette, typography, and copy tone defined in `.kiro/steering/design.md` and shown in `docs/design-canvas/ArtPreview.dc.html` for every route in criteria 1, 2, and 4.

---

### Requirement 2: Parallax Backdrop

**User Story:** As a visitor, I want a painted, layered night backdrop that shifts gently as I move, so that the scene feels like a deep gothic matte painting rather than a flat image.

#### Acceptance Criteria

1. THE Parallax_Backdrop SHALL render three layers from `public/art`, back to front: `bg-far` as an opaque plate, `mg-fence` as the gate centerpiece with `mg-fence-tile` repeated horizontally to fill at least the full viewport width, and `fg-frame` as a transparent plate in front of the Creatures.
2. IF any of the three layer image assets (`bg-far`, `mg-fence`, `mg-fence-tile`, or `fg-frame`) fails to load, THEN THE Parallax_Backdrop SHALL continue rendering every successfully loaded layer and SHALL render the remaining scene without a broken-image placeholder for the missing layer.
3. WHILE Reduced_Motion is not active, THE Parallax_Backdrop SHALL translate each layer horizontally and vertically by an amount proportional to the pointer offset from the viewport center, applying translation factors such that for equal pointer offset the displacement of `mg-fence` is strictly greater than that of `bg-far` and the displacement of `fg-frame` is strictly greater than that of `mg-fence`.
4. WHILE Reduced_Motion is not active AND the pointer is stationary or absent, THE Parallax_Backdrop SHALL apply a continuous looping idle drift to each layer, in addition to any pointer-driven translation, with each layer's per-cycle peak displacement no greater than 50 percent of that layer's maximum pointer-driven displacement.
5. THE Parallax_Backdrop SHALL apply a brightness filter of at most 0.6 to each of the three layers so that every backdrop layer stays darker than the Creatures. This is verified by the design-review loop, not by a property test.
6. WHILE Reduced_Motion is active, THE Parallax_Backdrop SHALL render all three layers at their centered rest position with zero pointer-driven translation and zero idle drift.

---

### Requirement 3: Code-Drawn Atmosphere

**User Story:** As a judge, I want every atmospheric effect to encode a real fact about the repositories, so that the spookiness is never decoration only.

#### Acceptance Criteria

1. WHEN the Scene renders, THE Atmosphere_Layer SHALL draw the moon in code positioned over the Parallax_Backdrop.
2. WHEN the count of zombies plus risen Creatures is greater than the count of ghosts plus tombstone Creatures, THE Atmosphere_Layer SHALL render the moon in the blood-red treatment defined in `.kiro/steering/design.md`; otherwise THE Atmosphere_Layer SHALL render the moon in the pale treatment.
3. WHEN the Scene renders, THE Atmosphere_Layer SHALL set fog density on a continuous scale such that density is 0 percent if and only if the zombie Creature count is 0, density is 100 percent if and only if the zombie Creature count is 20 or more, and for a zombie Creature count between 1 and 19 inclusive the density is strictly between 0 and 100 percent and monotonic non-decreasing in the zombie Creature count.
4. WHERE the number of ancient zombie Creatures (zombie decay level 4) is greater than zero, THE Atmosphere_Layer SHALL set the lightning interval, in seconds, to `max(7, 16 − 3 × (ancientCount − 1))` where `ancientCount` is the number of ancient zombie Creatures (zombie decay level 4), which yields 16 seconds at 1 ancient zombie, 13 at 2, 10 at 3, and 7 seconds at 4 or more, SHALL render each flash as a brief dim overlay of at most 70 percent opacity, and SHALL render no more than one flash per interval. These bounds exist for photosensitivity safety.
5. IF the number of ancient zombie Creatures is zero, THEN THE Atmosphere_Layer SHALL render no lightning flashes.
6. WHEN the Scene renders, THE Atmosphere_Layer SHALL render in code a vignette, a film-grain overlay drawn from SVG noise, cobwebs in both top corners, and between 2 and 5 bats, as set dressing.
7. THE Atmosphere_Layer SHALL render the film-grain overlay at an opacity between 7 and 8 percent inclusive.
8. THE Atmosphere_Layer SHALL render all set dressing with a brightness filter of at most 0.6 so that set dressing stays darker than the Creatures and remains low-contrast. This is verified by the design-review loop, not by a property test.
9. WHILE Reduced_Motion is active, THE Atmosphere_Layer SHALL render the moon, fog, vignette, grain, and cobwebs as static elements and SHALL render no lightning flashes and no bat motion.

---

### Requirement 4: Creature Image Selection

**User Story:** As a visitor, I want each repository drawn as the creature that matches its state and decay, so that the picture of a project always tells the truth about it.

#### Acceptance Criteria

1. WHEN a Classified_Repo is in the ghost state with decay level N (0 ≤ N ≤ 3), THE Creature_Image_Map SHALL return the art basename `ghost-N`.
2. WHEN a Classified_Repo is in the zombie state with decay level N (0 ≤ N ≤ 4), THE Creature_Image_Map SHALL return the art basename `zombie-N`.
3. WHEN a Classified_Repo is in the risen state, THE Creature_Image_Map SHALL return the art basename `risen`.
4. WHEN a Classified_Repo is in the tombstone state, THE Creature_Image_Map SHALL return the art basename `tomb-arch-fresh`.
5. WHEN a Classified_Repo is in the coffin state, THE Creature_Image_Map SHALL return the art basename `coffin`.
6. THE Creature_Image_Map SHALL return exactly one basename from the set {`ghost-0`, `ghost-1`, `ghost-2`, `ghost-3`, `zombie-0`, `zombie-1`, `zombie-2`, `zombie-3`, `zombie-4`, `risen`, `tomb-arch-fresh`, `coffin`} for every Classified_Repo produced by `classify` in `lib/lifecycle.ts`, and SHALL NOT throw for any such input.
7. THE Creature_Image_Map SHALL return an identical basename for repeated calls with the same state and decay level.
8. THE Creature_Image_Map SHALL read the state and decay level from the Classified_Repo and SHALL NOT recompute any lifecycle threshold.
9. WHEN the Scene_Renderer renders a Creature, THE Scene_Renderer SHALL render it with a `next/image` element whose declared width and height are positive integers greater than zero.

---

### Requirement 5: Creature Placement by Zone

**User Story:** As a visitor, I want each creature placed in the zone and order that matches its state and decay, so that the layout itself reads as data.

#### Acceptance Criteria

1. WHEN the Scene_Renderer renders a Scene, THE Scene_Renderer SHALL place each ghost Creature in the sky band, each risen Creature at the left edge climbing out of a grave, each tombstone Creature in front of the fence, each zombie Creature in the foreground outside the fence, and each coffin Creature at the mausoleum door in the crypt at the right, matching the zone boundaries shown in `docs/design-canvas/ArtPreview.dc.html`.
2. IF a lifecycle state has zero Creatures to render, THEN THE Scene_Renderer SHALL render that state's zone with no Creatures and SHALL NOT alter the placement of any other zone.
3. WHEN the Scene_Renderer renders zombie Creatures, THE Scene_Renderer SHALL order them so that distance from the gate is monotonic non-decreasing as decay level increases, placing the lowest decay level (newest) nearest the gate and the highest decay level farthest from the gate, AND MAY assign two distinct decay levels equal distances from the gate provided that the ordering is never reversed.
4. IF two or more zombie Creatures share the same decay level, THEN THE Scene_Renderer SHALL order them among themselves by their input order (pushed-at descending, as produced by the loader) so placement is deterministic.
5. WHEN the Scene_Renderer renders a tombstone Creature, THE Scene_Renderer SHALL apply a darkness level and a tilt angle that each increase monotonically and without decrease as that Creature's `daysQuiet` increases, such that a Creature with a strictly greater `daysQuiet` is rendered at least as dark and at least as tilted as one with a lesser `daysQuiet`, per the tombstone treatment in `.kiro/steering/design.md` and `docs/design-canvas/Creatures.dc.html`.

---

### Requirement 6: Creature Motion Encodes Decay

**User Story:** As a visitor, I want each creature's movement to encode how neglected its project is, so that motion carries the same meaning as the art.

#### Acceptance Criteria

1. WHILE Reduced_Motion is not active, THE Scene_Renderer SHALL animate a ghost Creature at decay level 0 with a slow drifting path, a breathing scale, and an animated ripple on its shroud.
2. WHILE Reduced_Motion is not active, THE Scene_Renderer SHALL animate a ghost Creature at decay level 1 drifting in the opposite horizontal direction from decay level 0, with a slowly pulsing opacity.
3. WHILE Reduced_Motion is not active, THE Scene_Renderer SHALL animate a ghost Creature at decay level 2 by blinking out and reappearing a short distance away, with a stutter on return, on a repeating interval between 3 and 12 seconds.
4. WHILE Reduced_Motion is not active, THE Scene_Renderer SHALL animate a ghost Creature at decay level 3 sinking toward the ground with a red-and-cyan split glitch on a repeating interval between 3 and 12 seconds.
5. WHILE Reduced_Motion is not active, THE Scene_Renderer SHALL animate zombie Creatures at decay levels 0 through 2 lurching in place, with each higher decay level animating at a longer cycle duration than the level below it.
6. WHILE Reduced_Motion is not active, THE Scene_Renderer SHALL animate zombie Creatures at decay levels 3 and 4 as mostly still with a sudden twitch on a repeating interval between 3 and 12 seconds.
7. WHILE Reduced_Motion is not active, THE Scene_Renderer SHALL animate a risen Creature with a cyan pulse.
8. THE Scene_Renderer SHALL apply a distinct per-Creature animation delay so that no two Creatures in the same zone begin their animation cycle at the same time.
9. THE Scene_Renderer SHALL implement Creature movement using only CSS transform and opacity properties, AND MAY apply SVG or CSS filter effects (specifically the decay-level-0 shroud ripple and the decay-level-3 red-and-cyan split glitch) to at most 4 Creatures on screen at one time, prioritising the hovered or focused Creature and the turning-soon ghost.
10. WHILE Reduced_Motion is active, THE Scene_Renderer SHALL render every Creature with no motion while continuing to convey decay through the selected image and the same static opacity it would use to encode that decay level.

---

### Requirement 7: Scene Header and Chrome

**User Story:** As a visitor, I want a header that names the estate, summarizes it, and lets me act, so that I can read the state of the graveyard and navigate at a glance.

#### Acceptance Criteria

1. THE Scene_Renderer SHALL render the wordmark "Repo Graveyard" in the UnifrakturMaguntia blackletter typeface with the crimson glow defined in `.kiro/steering/design.md`.
2. WHERE the active route is `/estate`, THE Scene_Renderer SHALL render a "Haunted Estate" badge in the header.
3. THE Scene_Renderer SHALL render the Scene_Summary as a single line counting the total souls and the counts of ghosts, risen, zombies, tombstones (labeled "at rest"), and coffins (labeled "sealed"), in that order, each count paired with its label and separated by " · " (for example, "16 souls · 4 ghosts · 1 risen · 6 zombies · 3 at rest · 2 sealed"), with all counts computed from the Classified_Repos.
4. IF any category count in the Scene_Summary is zero, THEN THE Scene_Renderer SHALL render that count as "0" with its label rather than omitting the category.
5. THE Scene_Renderer SHALL render a text input that accepts a GitHub username of 1 to 39 characters, and WHEN the visitor submits a non-empty value, THE Scene_Renderer SHALL navigate to that username's Scene.
6. IF the visitor submits the username input with an empty or whitespace-only value, THEN THE Scene_Renderer SHALL remain on the current Scene and render a validation message indicating that a username is required.
7. THE Scene_Renderer SHALL render a "Lights on" toggle control and a sound toggle control in the header, each displaying its current on/off state.
8. WHERE at least one ghost Creature has 30 or fewer whole days remaining until becoming a zombie, THE Scene_Renderer SHALL render a Turning_Soon_Notice naming that ghost and a countdown of the remaining whole days until turning, styled with the crimson-700 fill and crimson-400 border and glow defined in `.kiro/steering/design.md`; and WHERE more than one ghost Creature has 30 or fewer whole days remaining until turning, THE Scene_Renderer SHALL name the one with the fewest whole days left, breaking ties by the most recent push (latest `pushedAt` first).
9. WHEN the visitor activates the Turning_Soon_Notice, THE Scene_Renderer SHALL open the named ghost's Creature as the selected Creature.
10. THE Scene_Renderer SHALL render a footer strip with the sample-estate plaque aligned to the left edge and the legend/key aligned to the right edge, positioned so that no part of the footer strip overlaps the rendered bounds of any Creature.

---

### Requirement 8: Whispers

**User Story:** As a visitor, I want occasional whispers that narrate real facts, so that the scene feels alive without ever startling me.

#### Acceptance Criteria

1. THE Scene_Renderer SHALL display at most one Whisper at a time.
2. THE Scene_Renderer SHALL render each Whisper in the IM Fell English italic treatment and SHALL compose its text from a verifiable fact that is derived from data of a currently loaded repository.
3. IF the data required to compose a Whisper's text is unavailable, THEN THE Scene_Renderer SHALL suppress that Whisper and SHALL leave the previously displayed scene state unchanged.
4. THE Scene_Renderer SHALL show successive Whispers with a minimum interval of 20 seconds between the start of one Whisper and the start of the next.
5. WHEN a Whisper has been displayed for 8 seconds, THE Scene_Renderer SHALL auto-fade that Whisper over a transition of 1 second until it is no longer visible.
6. THE Scene_Renderer SHALL mark the Whisper region with `role="status"` so that assistive technologies announce it politely.
7. WHILE Reduced_Motion is active, THE Scene_Renderer SHALL render and remove Whispers without fade animation by toggling visibility instantly.
8. WHEN Reduced_Motion is active or the motion toggle disables motion, THE Scene_Renderer SHALL stop showing new Whispers within 1 second and SHALL remove any currently visible Whisper, and the sound toggle SHALL have no effect on Whispers.

---

### Requirement 9: Creature Accessibility and Interaction

**User Story:** As a keyboard and screen-reader user, I want every creature to be a labeled focusable control that reacts gently, so that I can explore the graveyard without relying on sight, color, or motion.

#### Acceptance Criteria

1. THE Scene_Renderer SHALL render each Creature as a focusable button element with an accessible name that includes the repository name, the state, and a human-readable time quiet, for example "weather-app, zombie, abandoned 8 months".
2. IF a Creature's repository name, state, or time-quiet value is unavailable when the accessible name is composed, THEN THE Scene_Renderer SHALL omit only the unavailable field, retain the remaining fields in the accessible name, and still render the Creature as a focusable button.
3. WHEN a Creature receives pointer hover or keyboard focus, THE Scene_Renderer SHALL rotate the Creature toward the pointer by at most 8 degrees and increase its glow intensity, completing the transition within 200 milliseconds and producing no positional translation greater than 2 pixels.
4. THE Scene_Renderer SHALL render on every focused Creature a focus indicator in the candle-400 color that is at least 2 CSS pixels thick and continuously visible for the full duration that the Creature holds focus.
5. THE Scene_Renderer SHALL convey each Creature's state through its accessible name text in addition to color and motion, such that the state remains fully determinable from the accessible name text when color and motion are disregarded.
6. WHEN a Creature is activated by mouse click, the Enter key, or the Space key, THE Scene_Renderer SHALL mark that Creature as the single selected Creature and remove the selected status from any previously selected Creature.

---

### Requirement 10: Lights On View

**User Story:** As a judge or an accessibility-focused user, I want a plain sortable table of the same data, so that I can verify and scan the graveyard without effects.

#### Acceptance Criteria

1. WHEN the visitor activates the "Lights on" toggle, THE Scene_Renderer SHALL replace the Scene with the Lights_On_View showing the same set and count of Classified_Repos as the Scene.
2. WHILE the Lights_On_View is active, THE Lights_On_View SHALL render in the warm-paper style of step 1 of `docs/design-canvas/LightsOut.dc.html`: a paper background (`#f6f3ea`), ink text, a tan accent, an IM Fell English headline, repository names in a monospace face, and soft pill state tags.
3. THE Lights_On_View SHALL present the repositories in a table with at least the columns Repository, State, and Last push, sorted by Last push descending by default, and WHEN the visitor activates a column header, THE Lights_On_View SHALL re-sort the rows by that column.
4. WHILE the Lights_On_View is active, THE Lights_On_View SHALL render with no parallax, no atmosphere effects, no creature motion, and no whisper effects, and SHALL present a steady, non-flickering view.
5. IF Classified_Repos are unavailable when the "Lights on" toggle is activated, THEN THE Scene_Renderer SHALL render the Lights_On_View's empty or error state consistent with `.kiro/steering/design.md` rather than a broken table.
6. WHEN the visitor activates the toggle again, THE Scene_Renderer SHALL return to the Scene showing the same data within the same session.

---

### Requirement 11: Scaling and Creature Capping

**User Story:** As a visitor with anywhere from one to hundreds of repositories, I want the scene to stay intact, so that it never breaks or overflows regardless of how many repos I have.

#### Acceptance Criteria

1. WHEN a Scene is populated from exactly one Classified_Repo, THE Scene_Renderer SHALL render that single Creature positioned within the bounds of its assigned Zone with no Creature or group element extending beyond the Zone's boundary.
2. WHEN a Scene is populated from 100 or more Classified_Repos, THE Scene_Renderer SHALL render all Zones such that every Creature and group element remains within its Zone's boundary and no Zone overlaps another Zone.
3. WHERE the number of Creatures in a Zone exceeds that Zone's visible cap of 12, THE Scene_Renderer SHALL render exactly 12 Creatures plus one "+N more" group where N equals the count of remaining Creatures in that Zone not individually rendered; and WHERE the number of Creatures in a Zone is at or below the visible cap of 12, THE Scene_Renderer SHALL render no "+N more" group for that Zone.
4. WHEN the visitor activates a "+N more" group, THE Scene_Renderer SHALL display a scrollable list containing one entry for each of the N remaining repositories in that Zone, with each entry showing the repository name.
5. IF a "+N more" group is expanded and the visitor activates the group a second time, THEN THE Scene_Renderer SHALL collapse the list and restore the group to its "+N more" summary state while keeping the Zone layout within its boundary.
6. THE Scene_Renderer SHALL scale each rendered Creature's display size down as its Zone's Creature count grows, to no less than 60 percent of full size, such that at a viewport width of 1280 pixels or greater the 12 visible Creatures plus the "+N more" group all fit within the Zone's bounds without overflow.

---

### Requirement 12: Haunted Estate Fixture

**User Story:** As a judge or first-time visitor, I want a one-click sample graveyard that shows everything, so that I can see the full experience without a GitHub account.

#### Acceptance Criteria

1. THE Estate_Fixture SHALL be a bundled file at `data/estate.json` containing at least one invented repository whose username, repository name, and commit messages do not reference any real person or project.
2. THE Estate_Fixture SHALL include at least one repository for every lifecycle state, at least one repository for each ghost decay level in the range 0 to 3 inclusive, and at least one repository for each zombie decay level in the range 0 to 4 inclusive.
3. THE Estate_Fixture SHALL store each repository's push date and creation date as an integer "days ago" offset relative to the fixture load date rather than a fixed calendar date, such that the resolved lifecycle state, ghost decay level, and zombie decay level for every repository are identical regardless of the calendar day on which the fixture is loaded.
4. THE Estate_Fixture SHALL include a non-empty pre-written diagnosis and a non-empty pre-written séance for every repository it contains.
5. WHEN the `/estate` Scene is rendered, THE Scene_Renderer SHALL display a brass plaque containing the exact text "Sample estate. Enter your own name at the gate."
6. WHEN a visitor sets an override on a Creature in the Haunted_Estate, THE Scene_Renderer SHALL apply the override to the current visit only.
7. WHEN a visitor sets an override on a Creature in the Haunted_Estate, THE Scene_Renderer SHALL NOT write the override to any persistent storage, such that reloading the `/estate` Scene restores the Creature to its fixture-defined state.
8. IF the file at `data/estate.json` cannot be loaded or parsed, THEN THE Scene_Renderer SHALL render a full-page error state that replaces the `/estate` Scene entirely, rather than an inline banner within a rendered Scene shell, indicating that the sample estate is unavailable, AND SHALL NOT render a partial or empty graveyard.
9. THE test suite SHALL validate `data/estate.json` against a zod schema that defines the required shape of every repository entry, including its state and decay fields, its "days ago" offsets, and its pre-written diagnosis and séance, such that a malformed or incomplete fixture fails the unit tests rather than reaching users.

---

### Requirement 13: Deferred Sound Hook Points

**User Story:** As a developer, I want sound left for a later spec but not blocked, so that this scene ships now and audio can be added without rework.

#### Acceptance Criteria

1. THE Scene_Renderer SHALL render the sound toggle control in a visible, interactive state while playing no audio in response to any interaction with it.
2. WHEN a user activates the sound toggle control, THE Scene_Renderer SHALL update the control's displayed on/off state without loading, decoding, or playing any audio asset.
3. THE Scene_Renderer SHALL NOT load, decode, or play any audio asset during this feature.
4. THE Scene_Renderer SHALL render the moon, fog, and lightning effects through its own drawing code with zero runtime dependencies on any audio module or audio asset.

---

### Requirement 14: Scene Performance

**User Story:** As a visitor, I want the scene to stay smooth even with many repositories, so that it feels polished rather than janky.

#### Acceptance Criteria

1. WHEN a Scene is populated with approximately 100 Creatures on a mid-range laptop, THE Scene_Renderer SHALL sustain approximately 60 frames per second during idle animation. This frame-rate target is verified by the design-review / performance loop rather than by a property test.
2. THE Scene_Renderer SHALL render all art with explicit width and height sizes.
3. THE Scene_Renderer SHALL preload the three parallax plates.
4. THE Scene_Renderer SHALL lazy-load Creature images that are below the fold.

---

## Correctness Properties

These properties are expressed for property-based testing with fast-check, matching the existing suites under `tests/property/`. They constrain the pure, testable seams of this feature; purely visual timing and layout behaviors are verified by the design-review loop rather than by property tests.

### Property 1: Creature image matches state and decay (required)

For any Classified_Repo, the asset basename returned by the Creature_Image_Map is determined solely by its state and decay level, as follows:

- ghost with decay level N (0 ≤ N ≤ 3) → `ghost-N`
- zombie with decay level N (0 ≤ N ≤ 4) → `zombie-N`
- risen → `risen`
- tombstone → `tomb-arch-fresh`
- coffin → `coffin`

The map is total: for every state produced by `classify` in `lib/lifecycle.ts`, and every decay level that state can carry (ghost 0–3, zombie 0–4, others null), the function returns exactly one of the basenames above and never throws. This is the required executable property and SHALL be tested with fast-check over arbitraries that generate every state and the full decay range for ghost and zombie. (Maps to Requirement 4.)

### Property 2: Zombie ordering is monotonic by decay near the gate

For any list of zombie Classified_Repos, the placement order the Scene_Renderer assigns never puts a higher-decay zombie nearer the gate than a lower-decay zombie: sorting is monotonic non-decreasing in decay level with increasing distance from the gate. (Maps to Requirement 5.3.)

### Property 3: Moon treatment follows the health comparison

For any list of Classified_Repos, the moon treatment is the blood-red treatment if and only if (zombie count + risen count) > (ghost count + tombstone count), and the pale treatment otherwise. (Maps to Requirement 3.2.)

### Property 4: Summary counts partition the repositories

For any list of Classified_Repos, the Scene_Summary's per-state counts are non-negative, sum to the total number of repositories, and the total equals the "souls" figure. (Maps to Requirement 7.3.)

### Property 5: Fog density is monotonic in zombie count

For any list of Classified_Repos, the fog density is monotonic non-decreasing in the zombie count and is clamped to the range 0 to 100 percent inclusive. This SHALL be tested with fast-check over arbitraries that generate varying zombie counts. (Maps to Requirement 3.3.)

### Property 6: Lightning interval is monotonic and bounded

For any ancient-zombie count of at least 1, the lightning interval equals `max(7, 16 − 3 × (ancientCount − 1))` seconds, so it is monotonic non-increasing in the ancient-zombie count and bounded within 7 to 16 seconds inclusive, and lightning is absent when the ancient-zombie count is zero. This SHALL be tested with fast-check over arbitraries that generate the full ancient-zombie count range. (Maps to Requirement 3.4 and 3.5.)

### Property 7: Tombstone darkness and tilt are monotonic in daysQuiet

For any pair of tombstone Classified_Repos, tombstone darkness and tilt are each monotonic non-decreasing in `daysQuiet`, so a greater `daysQuiet` is rendered at least as dark and at least as tilted. This SHALL be tested with fast-check over arbitraries that generate varying `daysQuiet` values. (Maps to Requirement 5.5.)

### Property 8: Zone capping partitions the Creatures

For any Zone Creature count C, the number of individually rendered Creatures equals min(C, 12) and the "+N more" value N equals max(0, C − 12). This SHALL be tested with fast-check over arbitraries that generate Zone counts spanning below, at, and above the cap. (Maps to Requirement 11.3.)

### Property 9: Estate fixture conforms to its schema (fixture-validation test)

The bundled `data/estate.json` parses successfully against the estate zod schema, with every repository entry conforming to the required shape (state and decay fields, "days ago" offsets, and the pre-written diagnosis and séance), so a broken or incomplete fixture is caught by the test suite before it reaches users. Unlike the generated-input properties above, this is a schema-conformance unit test over the fixed, bundled fixture rather than a fast-check generated-input property. (Maps to Requirement 12.9.)
