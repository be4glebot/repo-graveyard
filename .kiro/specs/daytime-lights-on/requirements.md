# Requirements Document

## Introduction

Lights On becomes the daytime version of the same haunted world, replacing the current plain "paper register" view. The Hallowed Ground world ships day art for this pilot. Every other world keeps its night art and receives day tokens around it. Toggling Lights On changes only the theme. The register table remains available as a "View as list" modal for accessibility.

Day art files are already placed in `public/art/day/`. They are verified, never edited. Day state is session-only and is not persisted.

## Glossary

- **Scene**: The graveyard scene rendered by `SceneView`, rooted at the element `#scene-root`.
- **Scene_Root**: The DOM element `#scene-root` that carries the `data-theme` attribute.
- **Theme**: Either `night` (default) or `day`.
- **Lights_On**: The toggle in the Header that switches the Theme to `day`.
- **Day_Tokens**: Theme tokens defined in `app/globals.css` under `[data-theme="day"]`: warm light and haze, with no lantern glow and no fog darkness.
- **Theme_Art_Map**: The module `lib/theme-art.ts` that maps each night asset path to its day asset path.
- **Day_Art**: The eight webp files in `public/art/day/`: place-ground, mg-fence, mg-fence-tile, mausoleum, tomb-arch-fresh, fg-frame, bird-perch, bird-fly.
- **Hallowed_Ground**: The world rendered through `WorldPlaceView`, `GroundArt` and `CropLayer`.
- **View_State**: The current view, plot, filter, selected repo and scroll position of the Scene.
- **Birds**: The day-mode perched birds and the flying bird.
- **Perch_Bird**: A bird rendered from `bird-perch.webp` (160x160, facing left) on an inner gate pillar of `mg-fence`.
- **Fly_Bird**: The bird rendered from `bird-fly.webp`, a 384x64 strip of four 96x64 frames played in order 1-2-3-4.
- **Register_Table**: The `LightsOnTable` component listing every repo.
- **List_Dialog**: A modal dialog that contains the Register_Table and opens over the Scene.
- **View_As_List_Link**: The "View as list" control in the Header and in the mobile Menu.
- **Asset_Check_Script**: A script that reads the Day_Art files and reports pixel size and alpha presence.
- **Steering_Docs**: `.kiro/steering/design.md`, `.kiro/steering/product.md` and the explorable-worlds spec notes.
- **Reduced_Motion**: The `prefers-reduced-motion: reduce` media setting.

## Requirements

### Requirement 1: Verify day art

**User Story:** As a developer, I want the Day_Art files verified before use, so that wiring does not rely on wrong dimensions or missing transparency.

#### Acceptance Criteria

1. THE Asset_Check_Script SHALL report the pixel width, pixel height and alpha presence of each of the eight Day_Art files.
2. THE Asset_Check_Script SHALL compare each Day_Art file against these expected sizes: place-ground 1536x1024, mg-fence 1536x595, mg-fence-tile 266x595, mausoleum 440x600, tomb-arch-fresh 398x600, fg-frame 1536x1024, bird-perch 160x160, bird-fly 384x64.
3. THE Asset_Check_Script SHALL report whether place-ground is fully opaque and whether fg-frame has a transparent centre.
4. IF a Day_Art file is missing, has a size that differs from its expected size, or has unexpected alpha, THEN THE Asset_Check_Script SHALL exit with a non-zero code and name the file and the mismatch.
5. THE Asset_Check_Script SHALL leave every Day_Art file byte-for-byte unchanged.
6. THE wiring work SHALL begin only after the Asset_Check_Script reports no mismatches.

### Requirement 2: Daytime theme

**User Story:** As a viewer, I want Lights On to show a daytime version of the same world, so that I can see the graveyard in warm light.

#### Acceptance Criteria

1. WHILE Lights_On is active, THE Scene_Root SHALL carry the attribute `data-theme="day"`.
2. WHILE Lights_On is inactive, THE Scene_Root SHALL carry the attribute `data-theme="night"`.
3. WHILE the Theme is `day`, THE Scene SHALL apply Day_Tokens for warm light and haze in every world.
4. WHILE the Theme is `day`, THE Scene SHALL omit the lantern cursor and the fog darkness layer.
5. THE Scene SHALL define every Day_Token in `app/globals.css` and SHALL reference tokens instead of hardcoded hex colors in components.
6. WHEN the viewer toggles Lights_On, THE Scene SHALL keep the same view, plot, filter, selected repo and scroll position.
7. WHEN the viewer toggles Lights_On, THE Scene SHALL keep the Scene mounted instead of rendering a replacement view.
8. WHEN the page reloads, THE Scene SHALL start in the `night` Theme.
9. THE Scene SHALL store the Theme in React state only and SHALL NOT write the Theme to localStorage or any other storage.

### Requirement 3: Theme art mapping with night fallback

**User Story:** As a viewer, I want day art to replace night art where it exists and night art everywhere else, so that no world looks broken in daytime.

#### Acceptance Criteria

1. THE Theme_Art_Map SHALL map each night asset used by Hallowed_Ground to its Day_Art file: the plate to place-ground, the fence to mg-fence, the fence tile to mg-fence-tile, the mausoleum to mausoleum, the fresh tomb arch to tomb-arch-fresh, and the foreground frame to fg-frame.
2. WHEN the Theme is `day` and a day file exists for a night asset, THE Theme_Art_Map SHALL resolve the day path.
3. WHEN the Theme is `night`, THE Theme_Art_Map SHALL resolve the night path.
4. IF the Theme is `day` and no day file exists for a night asset or for a world, THEN THE Theme_Art_Map SHALL resolve the night path for that asset.
5. WHILE the Theme is `day` and the world is the gate, estate map, crypt or sky, THE Scene SHALL render night art with Day_Tokens applied around it.
6. WHILE the Theme is `day`, THE Hallowed_Ground SHALL render every art path through the Theme_Art_Map instead of hardcoded `/art/*.webp` paths.
7. THE Theme_Art_Map SHALL be a pure function that takes the Theme and the night path as parameters and performs no I/O.
8. WHILE the Theme is `day`, THE Hallowed_Ground SHALL size and crop the day assets using the existing PLATE_SIZE and crop table values, because the day files match the night dimensions listed in this spec.

### Requirement 4: Birds

**User Story:** As a viewer, I want birds in the daytime scene, so that the day version feels alive instead of haunted.

#### Acceptance Criteria

1. WHILE the Theme is `day` in Hallowed_Ground, THE Scene SHALL NOT render the night ravens (drawn in code by `WorldCreatures`) and SHALL render Birds in their place.
2. WHILE the Theme is `day` in Hallowed_Ground, THE Scene SHALL render one Perch_Bird on each inner gate pillar of mg-fence.
3. THE Scene SHALL position the left Perch_Bird at x=28.5% of the gate width and y=18% of the gate height, measured from the gate's top-left.
4. THE Scene SHALL position the right Perch_Bird at x=71.3% of the gate width and y=18% of the gate height, measured from the gate's top-left.
5. THE Scene SHALL mirror the right Perch_Bird horizontally so that the right Perch_Bird faces right.
6. WHILE the Theme is `day` in Hallowed_Ground, THE Scene SHALL render a Fly_Bird that crosses the sky at intervals.
7. THE Fly_Bird SHALL animate using a CSS `steps(4)` animation over the four 96x64 frames of bird-fly, in order 1-2-3-4.
8. WHILE Reduced_Motion is set, THE Scene SHALL render Birds with no CSS animation and SHALL NOT render the Fly_Bird crossing.
9. THE Birds SHALL be decorative, hidden from assistive technology, and non-interactive so that they do not intercept clicks on creatures or plots.
10. WHILE the Theme is `night`, THE Scene SHALL render no Birds.

### Requirement 5: View as list dialog

**User Story:** As a viewer using assistive technology, I want the register table still available, so that I can read every repo as a list.

#### Acceptance Criteria

1. THE Header SHALL show a View_As_List_Link.
2. THE mobile Menu SHALL show a View_As_List_Link.
3. WHEN the viewer activates a View_As_List_Link, THE Scene SHALL open the List_Dialog containing the Register_Table over the Scene.
4. WHILE the List_Dialog is open, THE Scene SHALL stay mounted so that view, plot, filter, selected repo and scroll position remain unchanged.
5. WHILE the List_Dialog is open, THE List_Dialog SHALL trap keyboard focus within the dialog and expose `role="dialog"` with an accessible name.
6. WHEN the viewer presses Escape or activates the close control, THE List_Dialog SHALL close.
7. WHEN the List_Dialog closes, THE Scene SHALL return keyboard focus to the View_As_List_Link that opened it.
8. THE Scene SHALL no longer replace the Scene with the Register_Table when Lights_On is active.
9. THE View_As_List_Link SHALL have a visible focus ring and be reachable by keyboard.

### Requirement 6: Themed loading and opening states

**User Story:** As a viewer, I want loading and opening states to match the active theme, so that the daytime mode feels consistent.

#### Acceptance Criteria

1. WHILE the Theme is `day`, THE Scene SHALL render its loading state using Day_Tokens.
2. WHILE the Theme is `day`, THE Scene SHALL render its opening and transition states using Day_Tokens.
3. WHEN the viewer toggles Lights_On during a loading or opening state, THE Scene SHALL switch that state to the active Theme without restarting the load.

### Requirement 7: Lights On control copy

**User Story:** As a viewer, I want the Lights On control and its copy to describe the daytime view, so that the label is accurate.

#### Acceptance Criteria

1. THE Header SHALL replace the Lights_On hint "bright, plain list" with copy that describes a daytime view of the same world.
2. WHILE the Theme is `day`, THE Scene SHALL use kind, warm copy in every day-mode string.
3. THE Header SHALL keep the Lights_On control keyboard reachable with a visible focus ring and an accessible pressed state.

### Requirement 8: Steering and spec notes

**User Story:** As a maintainer, I want steering and spec notes to describe Lights On as daytime, so that future work follows the new design.

#### Acceptance Criteria

1. THE Steering_Docs SHALL describe Lights On as the daytime version of the same world, scoped to Hallowed_Ground day art for this pilot.
2. THE Steering_Docs SHALL remove the "paper register" Lights On description.
3. THE Steering_Docs SHALL remove the sinister-copy table.
4. THE Steering_Docs SHALL describe the Register_Table as the "View as list" accessibility view.
5. THE Steering_Docs SHALL state that day copy stays kind and warm.

### Requirement 9: Tests

**User Story:** As a maintainer, I want automated tests and checks for the pilot, so that regressions are caught.

#### Acceptance Criteria

1. THE test suite SHALL include a test that toggling Lights_On preserves view, plot, filter, selected repo and scroll position.
2. THE test suite SHALL include a test that day asset paths resolve through the Theme_Art_Map and that any asset or world without a day file falls back to the night path.
3. THE test suite SHALL include a test that Birds have no animation under Reduced_Motion.
4. THE test suite SHALL include a test that activating the View_As_List_Link opens the List_Dialog containing the Register_Table and that closing returns focus to the link.
5. THE test suite SHALL update existing tests that pass `lightsOn`: `tests/dom/Chrome.test.tsx`, `tests/dom/HeaderBadge.test.tsx`, `tests/dom/HeaderMenu.test.tsx` and `tests/dom/LanternCursor.test.tsx`.
6. WHERE the Theme_Art_Map is a pure function, THE test suite SHALL include a property test that every night path resolves to a non-empty path under `/art/` for either Theme.

### Requirement 10: Execution constraints

**User Story:** As the spec owner, I want the execution constraints recorded, so that the work follows the agreed process.

#### Acceptance Criteria

1. THE tasks.md SHALL stage the work as a small spec and SHALL run each task through the spec-task sub-agent, using file tools for all code and document edits. The only shell use allowed is the single targeted test or script command that a task names (for example `npx vitest --run <file>` or `node scripts/check-day-art.mjs`), plus the final-checkpoint commands.
2. WHEN a task completes, THE task SHALL run only the tests affected by that task.
3. WHEN all tasks complete, THE final task SHALL run the full test suite, `tsc` and lint.
4. THE tasks SHALL NOT run `next build`.
5. THE tasks SHALL NOT modify any file in `public/art/day/`.
