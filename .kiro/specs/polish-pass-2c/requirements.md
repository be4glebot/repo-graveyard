# Requirements Document

## Introduction

The 2C Polish Pass hardens and finishes the Repo Graveyard estate map (the gate/landing scene) and its four places so that every atmospheric effect stays readable, data-driven, and robust across viewport sizes. The four places are The Restless Sky (ghosts), Beyond the Gate (zombies and risen), Hallowed Ground (tombstones), and The Crypt (coffins).

This pass covers seven areas: layout robustness at three reference viewports, pointer parallax driven by CSS variables through `requestAnimationFrame`, a lights-off lantern cursor, per-place painted backgrounds with exact brightness values and an exactly-aligned data moon, organic seeded creature placement with non-overlapping plaques, two drifting fog layers whose density still encodes zombie count, and UI polish that matches the approved boards.

The authoritative sources for this spec are the steering design file (especially the "Place backgrounds and fog (Spec 2C)", "Creature art", "Scene layout", and "Motion" sections), the two polish boards, and the new place/fog art. They are included here:

#[[file:.kiro/steering/design.md]]
#[[file:docs/design-canvas/PolishGate.dc.html]]
#[[file:docs/design-canvas/PolishPlaces.dc.html]]
#[[file:public/art/place-sky.webp]]
#[[file:public/art/place-gate.webp]]
#[[file:public/art/place-ground.webp]]
#[[file:public/art/place-crypt.webp]]
#[[file:public/art/fog-wisps.webp]]
#[[file:public/art/fog-wisps-thin.webp]]

The scope is presentational polish over the already-classified estate view model. The frozen lifecycle classification and the existing fog, scene, and place view-model functions are not changed except where this document explicitly requires new presentational behavior.

## Glossary

- **Scene_Root**: The top-level DOM element of either the estate map root or a place root that owns the parallax CSS variables and the lantern cursor overlay.
- **Place**: One of the four named locations: The Restless Sky (`sky`, ghosts), Beyond the Gate (`gate`, zombies and risen), Hallowed Ground (`ground`, tombstones), The Crypt (`crypt`, coffins).
- **Place_Background**: The painted WebP backdrop for a Place, drawn `background-size: cover` and darkened with a brightness filter.
- **Data_Moon**: The code-drawn moon in the Sky place whose colour encodes overall health and which is positioned exactly over the painted moon in `place-sky`.
- **Painted_Moon**: The moon baked into the `place-sky` image at image coordinates x 75%, y 14%, diameter ≈6.5% of the image width.
- **Cover_Math**: The coordinate transform that maps a point given in source-image fractions to on-screen pixels for an element sized with `background-size: cover` (or an equivalently covered image).
- **Parallax_Variables**: The two CSS custom properties `--px` and `--py` written on the Scene_Root (the estate map root or a place root) to drive layered parallax across the background, creature, and near-fog layers.
- **Reduced_Motion**: The user state reported by the `prefers-reduced-motion: reduce` media query.
- **Lantern_Cursor**: The lights-off overlay, where lights-off is the default readable mode: inside a warm radial light (~300 px radius) that follows the pointer the scene is at full brightness plus a faint warm tint, while outside the radius the scene is dimmed to approximately 45–55% brightness. On coarse-pointer (touch / no-hover) devices there is no lantern; a static soft vignette is rendered instead.
- **Plaque**: The bevelled iron name panel for a creature, rendered in the style of the boards' `.plq` class (Cinzel name, mono sub-line).
- **scatterLayout**: The pure function `scatterLayout(names, rows, seed)` that returns a per-name placement record `{ x, y, scale, brightness, mirrored }`.
- **Depth_Row**: One of the ordered bands (back, middle, front) that creatures are placed within; nearer rows render larger and brighter.
- **Fog_Dense**: The far fog layer painted from `fog-wisps` (behind the creatures, ~90 s loop, one direction), whose opacity equals Fog_Opacity.
- **Fog_Thin**: The near fog layer painted from `fog-wisps-thin` (in front of the creatures' feet, ~55 s loop, the other direction), whose opacity equals Fog_Opacity × 0.25.
- **Fog_Opacity**: The opacity applied to the fog layers, computed by reusing the existing fog density function (no second density function is introduced), which encodes the zombie count for the Place.
- **Travel_Transition**: The animated transition played when moving between the estate map and a place, which preloads the destination place's background image before or while transitioning.
- **Reference_Viewports**: The three viewport sizes this pass is verified against: 1440×900 (desktop board width), 1280×720 (laptop), and 390×844 (mobile).
- **Chip**: A decay-word filter control rendered in the style of the boards' `.chip2` (inactive) and `.chip2.on` (active crimson) classes.
- **Iron_Button**: A control rendered in the style of the boards' `.btn2` class (bevelled iron plaque, Cinzel caps).
- **Overlay**: Any non-interactive visual layer drawn over the scene (fog, lantern light, vignette, gradients).

## Requirements

### Requirement 1: Layout robustness across viewports

**User Story:** As a visitor on any device, I want every place and control to be visible or reachable, so that no content is lost regardless of my screen size.

#### Acceptance Criteria

1. WHERE the viewport is 1440×900, 1280×720, or 390×844, THE Scene_Root SHALL render every Place and every control so that each is either fully within the viewport bounds or reachable by scrolling.
2. THE Scene_Root SHALL render every Place and every control such that no part of any Place or control is clipped, truncated, or hidden by an ancestor element with `overflow: hidden`.
3. WHERE the viewport width is at least 360 px, THE Header SHALL lay out its return, lights, and sound controls within the Header's own bounding box so that no Header control overlaps any scene content rendered beneath the Header.
4. WHILE the viewport width is below the board width of 1440 px, THE Scene_Root SHALL keep every filter Chip and every pager control reachable by keyboard (via Tab/Shift+Tab focus order) and by pointer (click or tap within the control's hit area).
5. IF the viewport is narrower than 360 px, THEN THE Scene_Root SHALL keep every Place and every control reachable by scrolling without clipping any control's hit area.

### Requirement 2: Pointer parallax via CSS variables

**User Story:** As a visitor, I want the scene layers to shift subtly as I move the pointer, so that the estate map and each place feel like a deep painted matte rather than a flat image.

#### Acceptance Criteria

1. THE Scene_Root SHALL be either the estate map root or a place root, and every criterion in this requirement SHALL apply to each Scene_Root.
2. WHILE Reduced_Motion is not active, WHEN a `pointermove` event occurs over the Scene_Root, THE Scene_Root SHALL schedule exactly one parallax update through `requestAnimationFrame`, coalescing any `pointermove` events received before the next animation frame into that single scheduled update.
3. WHEN the scheduled parallax update runs, THE Scene_Root SHALL write pointer-derived numeric values to the CSS custom properties `--px` and `--py` on the Scene_Root element, where each value lies within the inclusive range -1 to 1 representing the pointer's normalized horizontal and vertical offset from the Scene_Root center.
4. WHEN the scheduled parallax update runs, THE Scene_Root SHALL derive `--px` and `--py` from pointer position without storing the pointer position in React state, such that no React re-render is triggered by the update.
5. THE Scene_Root SHALL order the parallax layers from least movement to most as background (least), then creatures, then near fog (most), and SHALL scale each layer's rendered parallax offset by that layer's depth factor such that, for any two layers, the layer with the greater depth (farther) has a smaller or equal absolute offset than the layer with the lesser depth (nearer) for identical `--px` and `--py` values.
6. WHILE Reduced_Motion is active, IF a `pointermove` event occurs over the Scene_Root, THEN THE Scene_Root SHALL leave the values of `--px` and `--py` unchanged and SHALL NOT schedule a `requestAnimationFrame` parallax update.
7. WHERE the device reports `pointer: coarse`, THE Scene_Root SHALL NOT apply pointer parallax and SHALL instead retain the existing slow idle drift of the scene layers.
8. WHEN a `pointermove` event is dispatched to the Scene_Root in an automated test AND Reduced_Motion is not active, THE Scene_Root SHALL, after the next animation frame, expose both `--px` and `--py` as parseable numeric values on the Scene_Root element, verifiable via an automated assertion.

### Requirement 3: Lights-off lantern cursor

**User Story:** As a visitor exploring with lights off (the default), I want a lantern that brightens where I look while the rest of the scene stays dim but readable, so that the scene feels suspenseful without hiding content.

#### Acceptance Criteria

1. WHILE lights-off mode is active AND the device reports `pointer: fine`, THE Lantern_Cursor SHALL render a warm radial light with a radius of 300 px (±30 px) centred on the current pointer position, SHALL render the scene inside the radius at full brightness plus a faint warm tint, and SHALL dim the scene outside the radius to approximately 45–55% of full brightness.
2. WHILE lights-off mode is active, WHEN the pointer position changes, THE Lantern_Cursor SHALL update the light centre to the new pointer position within 100 ms.
3. WHILE lights-off mode is active AND Reduced_Motion is not active, THE Lantern_Cursor SHALL apply a flicker to the radial light that varies its brightness by no more than ±10% of the steady-state brightness at a rate between 2 Hz and 8 Hz.
4. WHEN keyboard focus moves to a creature, THE Lantern_Cursor SHALL move the centre of the radial light to the bounding-box centre of the focused creature within 100 ms.
5. IF Reduced_Motion is active, THEN THE Lantern_Cursor SHALL render the radial light at steady-state brightness with no flicker.
6. WHERE the device reports `pointer: coarse`, THE Lantern_Cursor SHALL NOT render a pointer-following lantern and SHALL instead render a static soft vignette over the scene.
7. WHILE lights-on mode is active, THE Lantern_Cursor SHALL render no lantern and no vignette.
8. THE Lantern_Cursor SHALL set `pointer-events: none` such that it never intercepts pointer clicks or keyboard focus.

### Requirement 4: Per-place painted backgrounds and aligned data moon

**User Story:** As a visitor, I want each place to have its own painted ground that stays dark enough for creatures to read, so that each place feels distinct and the data stays legible.

#### Acceptance Criteria

1. THE Sky Place SHALL render `place-sky` as its Place_Background drawn to cover the viewport with a brightness filter of 0.8 (±0.02).
2. THE Gate Place SHALL render `place-gate` as its Place_Background drawn to cover the viewport with a brightness filter of 0.85 (±0.02).
3. THE Ground Place SHALL render `place-ground` as its Place_Background drawn to cover the viewport with a brightness filter of 0.55 (±0.02).
4. THE Crypt Place SHALL render `place-crypt` as its Place_Background drawn to cover the viewport with a brightness filter of 0.7 (±0.02).
5. THE Place_Background SHALL render a top dark gradient and a bottom dark gradient, each spanning at least 15% of the viewport height, so that the header and the pager remain visually distinguishable from the painting behind them.
6. IF a Place_Background image fails to load, THEN THE Place SHALL render a solid dark fallback fill and SHALL continue to display its creatures and header without error.
7. WHEN the Sky Place is rendered, THE Data_Moon SHALL be positioned over the Painted_Moon by computing the Painted_Moon's on-screen centre from image coordinates x 75%, y 14% using the same Cover_Math as the Place_Background, so that the Data_Moon centre falls within 1% of viewport width of the Painted_Moon centre.
8. WHEN the Sky Place is rendered, THE Data_Moon SHALL be sized so that its diameter equals 6.5% (±0.5%) of the painted image width after the same Cover_Math is applied.
9. WHEN the Sky Place is rendered, THE Data_Moon SHALL set its fill colour from the overall health value so that health is encoded as a visible colour distinct from the Painted_Moon.

### Requirement 5: Organic seeded creature placement

**User Story:** As a visitor, I want creatures scattered naturally with readable name plaques, so that the scene looks painted rather than tabular and every name stays visible.

#### Acceptance Criteria

1. THE scatterLayout function SHALL be the layout function used in all four Places — ghosts in the Sky, tombstones in Hallowed Ground, coffins in the Crypt, and zombies in the Gate — and SHALL be a pure function that, given `names`, `rows`, and `seed`, returns exactly one placement record `{ x, y, scale, brightness, mirrored }` per name in `names`, with no additional, missing, or duplicated records.
2. FOR ALL invocations with equal inputs `names`, `rows`, and `seed`, THE scatterLayout function SHALL return placement records that are equal field-by-field and in the same order, without reading any external or nondeterministic state.
3. IF `names` is empty, THEN THE scatterLayout function SHALL return an empty collection of placement records.
4. THE scatterLayout function SHALL assign each name to exactly one Depth_Row among back, middle, and front.
5. THE scatterLayout function SHALL assign each placement record a `scale` within the inclusive range 0.7 to 1.15 and SHALL order rows so that every front-row record has a strictly greater `scale` than every middle-row record, and every middle-row record has a strictly greater `scale` than every back-row record.
6. THE scatterLayout function SHALL assign `brightness` so that every front-row record has a strictly greater `brightness` than every middle-row record, and every middle-row record has a strictly greater `brightness` than every back-row record.
7. THE scatterLayout function SHALL mark as `mirrored` a count of names equal to round(total name count / 3), setting `mirrored` to a boolean value on every record.
8. WHEN the Ground Place renders tombstones, THE Ground Place SHALL apply to each tombstone a seeded rotation within the inclusive range -6 to 6 degrees derived from `seed`, such that the tilt is deterministic for equal inputs.
9. WHEN the layout is rendered at 1440 px viewport width or at 1280 px viewport width, THE Scene_Root SHALL position creatures so that, for 1 to 12 names occupying a single plot, the bounding rectangle of each Plaque shares no overlapping area with the bounding rectangle of any other Plaque, verified as a property-based test across varied `names` and `seed` inputs.
10. WHERE the viewport width is below 768 px, THE Scene_Root SHALL arrange creatures in a two-column staggered layout and SHALL position Plaques so that the bounding rectangle of each Plaque shares no overlapping area with the bounding rectangle of any other Plaque.
11. THE Scene_Root SHALL render all Plaques in a single layer stacked above every creature so that no creature's rendered area covers any part of a Plaque.
12. WHILE Reduced_Motion is not active, THE Gate Place SHALL animate each fresh zombie with a horizontal wander whose displacement stays within 8 to 24 pixels left and right of its placed `x` position, where each fresh zombie uses its own seeded wander duration within the inclusive range 7 to 12 seconds and its own seeded start delay.
13. WHILE Reduced_Motion is not active, THE Gate Place SHALL animate each decay-level 1 through 4 zombie with its existing lurch and twitch behavior rather than the fresh-zombie wander.
14. WHILE Reduced_Motion is active, THE Gate Place SHALL render fresh zombies at their placed `x` position with no wander animation.

### Requirement 6: Two drifting fog layers encoding zombie count

**User Story:** As a visitor, I want fog that drifts in two layers and thickens with the undead, so that the atmosphere reads as data about how crowded the limbo is.

#### Acceptance Criteria

1. THE estate map, the Gate Place, and the Hallowed Ground Place SHALL each render fog layers, and THE Sky Place and the Crypt Place SHALL NOT render any fog layer.
2. WHERE fog is rendered, THE scene SHALL render Fog_Dense from `fog-wisps` behind the creatures (at a lower stacking depth than every creature), repeated horizontally with no visible seam at the tiling boundary, drifting in a single horizontal direction on a loop of 90 s ± 5 s, at an opacity equal to Fog_Opacity.
3. WHERE fog is rendered, THE scene SHALL render Fog_Thin from `fog-wisps-thin` in front of the creatures' feet (at a higher stacking depth than every creature), repeated horizontally with no visible seam at the tiling boundary, drifting in the horizontal direction opposite to Fog_Dense on a loop of 55 s ± 5 s, at an opacity equal to Fog_Opacity × 0.25.
4. THE scene SHALL compute Fog_Opacity by reusing the existing fog density function as a non-decreasing function of the zombie count, bounded to the range 0.0 to 1.0 inclusive, such that Fog_Opacity equals 0 if and only if the zombie count equals 0, and consequently both Fog_Dense opacity and Fog_Thin opacity equal 0 if and only if the zombie count equals 0, for every zombie count from 0 to 10000 (verified by a property-based test).
5. IF Reduced_Motion is active, THEN THE scene SHALL hold both Fog_Dense and Fog_Thin at a fixed horizontal offset so that no drift animation advances while Reduced_Motion remains active.
6. WHEN Reduced_Motion becomes inactive, THE scene SHALL resume the drift of Fog_Dense and Fog_Thin.
7. THE scene SHALL preserve every existing fog invariant and every existing fog test unchanged, neither modifying nor removing any of them.

### Requirement 7: UI polish matching the boards

**User Story:** As a visitor, I want the buttons and chips to look like forged iron plaques from the boards, so that the controls feel part of the gothic world.

#### Acceptance Criteria

1. THE Iron_Button SHALL be rendered as a bevelled iron plaque with its text label set in the Cinzel font family and transformed to uppercase capitals, matching the boards' `.btn2` style.
2. WHILE a Chip is in the inactive state, THE Chip SHALL be rendered as a bevelled plaque with its text label set in the Cinzel font family and transformed to uppercase capitals, matching the boards' `.chip2` style.
3. WHILE a Chip is the active filter, THE Chip SHALL be rendered with the crimson active styling matching the boards' `.chip2.on` style, such that the active Chip is visually distinguishable from every inactive Chip.
4. THE Plaque SHALL be rendered as a bevelled iron plaque containing exactly one name line set in the Cinzel font family and exactly one sub-line set in a monospace font family, matching the boards' `.plq` style.
5. THE Overlay layers SHALL each set the CSS property `pointer-events` to the value `none`, such that pointer events pass through every Overlay layer to the elements beneath it.

### Requirement 8: Preservation of existing components and tests

**User Story:** As a maintainer, I want existing work protected, so that a polish pass never silently removes behavior or coverage.

#### Acceptance Criteria

1. THE 2C Polish Pass SHALL include automated tests as a required deliverable, and SHALL NOT be considered complete if any requirement in scope lacks automated test coverage verifying its acceptance criteria.
2. IF completing a requirement appears to require deleting an existing component or an existing test, THEN THE implementer SHALL request explicit user approval before performing the deletion and SHALL preserve the component or test unchanged until approval is received.
3. WHILE the 2C Polish Pass is in progress, THE implementer SHALL retain every pre-existing component and every pre-existing test that has not received explicit user approval for deletion.
4. WHEN the 2C Polish Pass test suite is executed, THE 2C Polish Pass SHALL result in all existing fog invariant tests completing with a passing outcome and zero failures.

### Requirement 9: Animation performance budget

**User Story:** As a visitor on modest hardware, I want the animations to stay cheap to render, so that the scene animates smoothly without jank.

#### Acceptance Criteria

1. THE 2C Polish Pass SHALL animate every looping animation using only the CSS properties `transform` and `opacity`, and SHALL NOT animate any layout-affecting or paint-heavy property.
2. THE scene SHALL implement fog drift via `translateX` on a fog layer that is twice the strip width so that the drift wraps seamlessly, and SHALL NOT implement fog drift by animating `background-position`.
3. THE scene SHALL animate at most 12 animated creatures per view at one time.
4. WHEN the Travel_Transition runs, THE Travel_Transition SHALL preload the destination Place's Place_Background image before or while transitioning.

## Correctness Properties (for later property-based tests)

These properties restate the testable invariants above so they can be lifted into property-based tests during design and implementation:

- **Determinism of placement** (Requirement 5.2): for all `names`, `rows`, `seed`, `scatterLayout(names, rows, seed)` equals a second call with the same inputs.
- **No plaque overlap** (Requirement 5.9): for all placements produced by `scatterLayout` for 1 to 12 names in a single plot rendered at 1440 px or 1280 px width, no two plaque rectangles intersect.
- **Fog opacity encodes zombie count** (Requirement 6.4): for all zombie counts `n`, `Fog_Opacity(n) == 0` if and only if `n == 0`, and `Fog_Opacity(n) > 0` whenever `n > 0`.
- **Parallax disabled under reduced motion** (Requirements 2.6, 2.8): for all `pointermove` events, when Reduced_Motion is active the Scene_Root leaves `--px`/`--py` unchanged, and when it is not active a `pointermove` sets both to numeric values.
- **Looping animations use only transform and opacity** (Requirement 9.1): for all looping animations in the pass, the set of animated CSS properties is a subset of `{ transform, opacity }`. (Not required to be a property-based test.)
