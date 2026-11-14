# Requirements Document

## Introduction

Repo Graveyard already has separate environments joined by a cinematic travel transition. The estate map (`EstateMap`) is the hub with four clickable places: The Restless Sky (ghosts), Beyond the Gate (zombies and risen), Hallowed Ground (tombstones) and The Crypt (coffins). Each place is a `PlaceView` made of a painted `PlaceBackground`, pointer-parallax bands, fog, a seeded `DepthScatter` of creatures, and floating chrome (heading, filter chips, pager, return control). `TravelTransition` runs a ~2.2 s pull-in with the cut at 1150 ms, and navigation uses `history.pushState` with `?at=<place>`.

Today each place is a single-screen stage. The scene root is `min-h-dvh` and the creature layer is `h-full` with absolute children, so a place cannot extend past one viewport. Its only camera movement is pointer parallax. Many repos are handled by pagination (12 creatures per plot on desktop, fewer on compact layouts) rather than by exploring.

This feature takes a HYBRID approach. The app does not become one long scrolling page. The hub, the separate places and the cinematic transitions stay. Inside the Restless Sky, Hallowed Ground and the Crypt, the stage becomes a bounded, scrollable world with camera movement, scroll-linked parallax and discovery. Beyond the Gate keeps its current layout and gains only the shared control treatment and the gentle camera drift. Repo clicking, the detail panel, hover cards, deep links, data handling and existing tests must not regress.

The feature must work with realistic, small data. A typical demo account has only a few ghosts and no tombstones or coffins, so a place with 2 or 3 Creatures gets a compact, purposeful scroll of about 1.25 to 1.5 screens, and an empty place stays exactly one screen but is a complete, art-directed scene rather than a background with a message.

The art-direction goal is equally important: Repo Graveyard should read as a professionally art-directed interactive experience, not as generated images with UI laid on top. Each screen has one clear focal point and separated foreground, mid-ground and background tiers. Each place has one consistent light source, controls are fixtures made of the place's own materials (iron, stone, candle-lit brass), repositories are physical objects that stand on the ground and carry their own tags, and every visual effect encodes data or serves the story. The existing illustrations were drawn for one screen, so extended worlds are built by layered composition (cropped base plates, blend zones and transparent mid and foreground plates) and never by stretching, tiling or exposing the edges of a plate. Work is verified by looking at real screenshots against the original, not only by automated tests.

Work is delivered incrementally: baseline screenshots first, then a shared foundation, then the Sky, Hallowed Ground and the Crypt one at a time, then a final visual checkpoint. No new dependencies are added, and existing artwork under `public/art/` is reused.

## Glossary

- **Hub**: The `EstateMap` view at `/estate` and `/g/[username]` with no `?at=` value, showing the four place landmarks.
- **Landmark**: A `Place` button on the Hub (plaque plus representative creatures) that opens its place.
- **Place_View**: The `PlaceView` component, the in-place scene for one place.
- **Explorable_World**: A Place_View whose stage can be taller than one viewport and is explored by scrolling. Applies to the Restless Sky, Hallowed Ground and the Crypt.
- **World_Scroller**: The single vertical scroll container inside an Explorable_World that holds the world stage. It uses `overflow-y: auto` and `overflow-x: clip` (utilities `overflow-y-auto overflow-x-clip`) and never carries the `overflow-hidden` class.
- **Viewport_Height**: The height of the World_Scroller's visible area in CSS pixels.
- **World_Length**: The total scrollable height of an Explorable_World, expressed as a multiple of Viewport_Height.
- **Depth_Position**: The scroll offset of the World_Scroller divided by its maximum scroll offset, from 0 (start) to 1 (end).
- **Strata**: The ordered vertical sections of an Explorable_World (for example altitude bands in the sky, path segments in the cemetery, chambers and stair landings in the crypt).
- **World_Layout**: The pure function in `lib/` that maps a creature count, viewport size and place to a World_Length and one seeded slot per creature.
- **Scroll_Parallax**: Parallax driven by the World_Scroller's scroll offset, as distinct from the existing pointer parallax from `useParallax`.
- **Band_Rate**: The ratio of a band's on-screen vertical speed to the scroll speed. A Band_Rate of 1 moves with the content, below 1 moves slower, above 1 moves faster.
- **Camera_Drift**: A slow, low-amplitude idle translation of background layers that is independent of pointer and scroll input.
- **In_World_Controls**: The filter chips, plot pager, return-to-hub control and depth marker, presented as fixtures of the place rather than as overlays on the painting.
- **Creature**: A repository rendered by `Ghost`, `Risen`, `Zombie`, `Tombstone` or `Coffin`.
- **Plot**: One page of Creatures produced by `paginate`, at most `PLOT_SIZE` (12) on desktop and `compactPlotSize` on compact layouts.
- **Compact_Layout**: The layout active when `useIsCompact` reports a viewport narrower than 768 px.
- **Reduced_Motion**: The state in which `prefers-reduced-motion: reduce` is active, as reported to Place_View through the `reducedMotion` prop.
- **Navigation_Action**: Any call to `onEnterPlace`, `onReturn` or `history.pushState` / `popstate` view changes.
- **Detail_Panel**: The existing repository detail panel opened by selecting a Creature.
- **Discovery_Reveal**: A one-time, transform-and-opacity-only reveal of a Creature or Strata feature when it first enters the viewport.
- **Estate_Experience**: The existing set of features that must keep working: travel transition, `?at=` and `?repo=` deep links, back/forward, hover cards, lantern cursor, fog, lightning, whispers, the daytime version of the same world (Lights on) with its "View as list" accessibility view, and overrides.
- **Data_Fog**: The existing fog layers (`scene-fog` and `scene-fog-near`) whose density encodes the number of zombies (more limbo, more fog), as stated in `.kiro/steering/design.md`. Data_Fog renders only where it renders today (the Hub and Beyond the Gate).
- **Environmental_Mist**: A low-opacity ground mist, haze or dust layer used for depth, blending and atmosphere inside an Explorable_World. Environmental_Mist has no data meaning, has a fixed per-place density, and is a different layer from Data_Fog.
- **Plate**: One of the existing opaque or alpha artwork files in `public/art/`. Opaque plates (`place-sky`, `place-ground`, `place-crypt`, `place-gate`, `bg-far`) are 1536x1024 with no alpha. `fg-frame` and `fog-wisps` are 1536x1024. `mg-fence` is 1536x595 alpha, `mg-fence-tile` is 266x595 alpha, `mausoleum` is 440x600 alpha and `moon.webp` is 512x512 alpha.
- **Crop**: A uniformly scaled rectangular region of a Plate, chosen with a focal point and assigned to one Stratum.
- **Seam**: A visible discontinuity at the join of two Crops, Plates or blend zones, or an exposed edge of a Plate.
- **Bleed**: The extra Plate area beyond the visible area that absorbs parallax, drift and pointer displacement so that no Plate edge is exposed.
- **Blend_Zone**: A region where adjacent Strata are joined by a gradient mask, haze or darkness band, a crossfade between Crops, or an architectural transition such as stairs or arches.
- **Light_Source**: The single light direction and colour temperature of a place: moon for the Restless Sky, lantern and moonlight for Hallowed Ground, torch for the Crypt.
- **Contact_Shadow**: A shadow element under a standing Creature that anchors the Creature to the ground, cast opposite to the place's Light_Source.
- **Fixture**: A control or plaque that is built as an object belonging to the place (carved signpost, iron rail, stone ledge, brass-lit plate, grave marker tag, hanging coffin tag, ghost lantern tag).
- **Effects_Table**: The documented table, with a matching code registry, that maps every visual effect in an Explorable_World to a data field or a story purpose.
- **Baseline_Screenshots**: Real browser screenshots of the original (pre-feature) Hub and places, stored under `docs/design-review/` with dated filenames.
- **Visual_Review**: A written side-by-side critique, saved under `docs/design-review/`, that compares current screenshots to Baseline_Screenshots with pass or fail for each criterion of Requirements 18 and 19.
- **Review_Viewports**: Desktop 1440x900 and 1920x1080, mobile 390x844 and 360x740.
- **Review_Cases**: The data cases for the Visual_Review: the 3-ghost demo (Sky), the empty cemetery (Hallowed Ground), the empty crypt, a 3-Creature case for Hallowed Ground and the Crypt, and a 12-Creature case for each place.

## Requirements

### Requirement 1: Hybrid structure is preserved

**User Story:** As a visitor, I want the app to keep its separate environments and cinematic entrances, so that exploring still feels like travelling between places and not like reading one long page.

#### Acceptance Criteria

1. WHEN the Hub is rendered, THE Hub SHALL render exactly four Landmarks in the DOM order sky, gate, ground, crypt, each with `data-testid` equal to `estate-place-<id>` for ids `sky`, `gate`, `ground` and `crypt`.
2. WHEN a Landmark is activated by click or by the Enter key, THE Hub SHALL start the existing travel transition into the matching Place_View with a total duration of 2200 ms and a cut at 1150 ms.
3. WHERE Reduced_Motion is active, WHEN a Landmark is activated by click or by the Enter key, THE Hub SHALL run the crossfade travel transition with a total duration of 300 ms and a cut at 150 ms.
4. WHEN the travel transition reaches its cut, THE Place_View SHALL replace the Hub with the Place_View of the activated Landmark and SHALL call `history.pushState` exactly once with a URL whose query contains `at=<place>`.
5. THE Hub SHALL present all four Landmarks within a single viewport-fitted composition at widths from 360 px to 1920 px, so that each Landmark is activatable without scrolling the Hub to a different section (at Compact_Layout widths the single-column flow of Requirement 2 criterion 7 applies).
6. WHEN the browser back or forward button changes the history entry, THE SceneView SHALL resolve the visible view (Hub or the Place_View named by `?at=`) from the `popstate` event, run no travel transition, and call `history.pushState` zero times.
7. IF the `?at=` value in the URL is not one of `sky`, `gate`, `ground` or `crypt`, THEN THE SceneView SHALL show the Hub and SHALL not throw an error.
8. THE Beyond_the_Gate Place_View SHALL keep its current single-stage layout, filter chips, pager, Data_Fog and gate-only lightning, and SHALL render no World_Scroller.

### Requirement 2: The Hub as a living world map

**User Story:** As a visitor, I want the Hub to feel like a place I am standing in, so that choosing where to go feels like picking a direction in a game world.

#### Acceptance Criteria

1. WHILE the pointer hovers a Landmark or a Landmark has keyboard focus, THE Landmark SHALL show an environment-specific cue (lantern glow for the sky and ground, mist lift for the gate, torch flicker for the crypt) within 200 ms of the hover or focus starting, using only transform, opacity and filter, in addition to the existing scale response.
2. WHEN the hover or focus on a Landmark ends, THE Landmark SHALL remove the environment-specific cue within 400 ms.
3. THE Hub SHALL display each Landmark's plaque with its place name, count line and call-to-action from `PLACES` and `plaqueCopy`, unchanged in wording.
4. WHERE Reduced_Motion is not active, THE Hub SHALL apply Camera_Drift to its background layers with a peak displacement of no more than 12 px, and SHALL pause Camera_Drift while a travel transition is active.
5. WHILE Reduced_Motion is active, THE Hub SHALL hold its background layers at zero displacement, and THE Landmark SHALL show its environment-specific cue as a static style change (for example a fixed glow or opacity change) with no animation or transition.
6. IF a place has zero Creatures, THEN THE Landmark SHALL stay visible at opacity 1 with its plaque text at a contrast ratio of at least 4.5:1, remain activatable by click and by Enter or Space, and still show the environment-specific cue on hover and focus, and THE Landmark SHALL signal the empty state through an unlit lantern and desaturated artwork (using `filter`), not through reduced opacity of the Landmark or its text.
7. WHILE the Hub is shown in the Compact_Layout (viewport width below 768 px, down to 360 px), THE Hub SHALL keep its single-column vertical flow with all four Landmarks fully inside the viewport width, no horizontal scrolling, and each Landmark at a touch target of at least 44 by 44 CSS pixels.
8. WHILE the device reports a coarse pointer or no hover, THE Hub SHALL show the environment-specific cue on keyboard or touch focus only, and SHALL attach no pointer-driven cue listener.

### Requirement 3: Scrollable world container

**User Story:** As a visitor, I want a place to extend beyond one screen with a deliberate scroll, so that moving through it feels like exploring a location.

#### Acceptance Criteria

1. THE Place_View for the Restless Sky, Hallowed Ground and the Crypt SHALL contain exactly one World_Scroller, and THE Place_View for Beyond the Gate SHALL contain zero World_Scrollers.
2. THE World_Scroller SHALL use `overflow-y: auto` together with `overflow-x: clip`, SHALL not carry the `overflow-hidden` class, and no other ancestor of a control, a Creature or the In_World_Controls SHALL use `overflow: hidden`, `overflow: clip` or `overflow: auto`.
3. THE World_Scroller SHALL keep its horizontal scroll offset at 0 at every viewport width from 360 px to 1920 px, by keeping all of its content (Creatures, controls and layers) within its own width, because `overflow-x: clip` computes to `hidden` when `overflow-y` is `auto` (the scroller is still a scroll container, so focus or `scrollIntoView` could otherwise scroll it sideways).
4. THE Explorable_World SHALL place every decorative layer that must clip its own edges (Bleed wrappers, fog strips, Environmental_Mist strips) as a sibling of the layers holding Creatures and controls and never as an ancestor of a Creature, a control or the In_World_Controls, and each such clipping element SHALL contain no focusable element.
5. THE World_Scroller SHALL set `overscroll-behavior: contain` so that reaching either end does not scroll the page behind it or trigger a browser pull-to-refresh or history gesture.
6. WHEN the user scrolls the World_Scroller with wheel, trackpad, touch, scrollbar or keyboard, THE Place_View SHALL change only the scroll offset and the Scroll_Parallax outputs, and SHALL not change the selected Creature, the active filter, the current Plot or the URL.
7. THE Place_View SHALL render every Creature of the current Plot in the DOM at every Depth_Position, so that assistive technology and keyboard users can reach all Creatures.
8. WHEN a place is entered, THE World_Scroller SHALL start at a scroll offset of 0 (Depth_Position 0).
9. WHEN the Detail_Panel is closed, THE World_Scroller SHALL restore the scroll offset it had at the moment the Detail_Panel opened, within 1 px.
10. IF the World_Length is 1 or less, THEN THE World_Scroller SHALL have no vertical scrollable overflow, and its scroll offset SHALL remain 0.
11. THE implementation SHALL keep passing the existing `LayoutRobustness` assertions, which check by class name that the `EstateMap` and `PlaceView` roots carry `overflow-y-auto` and not `overflow-hidden`, that no ancestor of the places band or of a control carries `overflow-hidden`, and that the only elements carrying `overflow-hidden` are decorative fog strips that wrap no focusable element, and SHALL extend that test in the same step (as Requirement 17 criterion 5 allows) to assert criteria 2 and 4 for the `overflow-clip` and `overflow-x-clip` utilities.

### Requirement 4: Scrolling never triggers navigation

**User Story:** As a visitor on any device, I want scrolling to be safe, so that I never leave a place or open a repository by accident.

#### Acceptance Criteria

1. WHEN the World_Scroller is at Depth_Position 0 or 1 and the user continues a wheel, trackpad, touch or keyboard scroll gesture in the same direction, THE Place_View SHALL perform no Navigation_Action, SHALL not call `onSelect`, and SHALL leave the Detail_Panel state and the URL unchanged.
2. WHEN a wheel, touch-move or scroll event occurs on the World_Scroller, THE Place_View SHALL perform no Navigation_Action and SHALL not call `onSelect`.
3. WHEN a touch gesture moves more than 8 px in any direction between touch start and release, THE Place_View SHALL treat the gesture as a scroll and SHALL not activate the Creature, filter chip, pager button or return control under the release point.
4. WHEN a touch gesture moves 8 px or less between touch start and release on a Creature, filter chip, pager button or return control, THE Place_View SHALL treat the gesture as a tap and SHALL activate that single element exactly once.
5. WHEN the user activates the return control, a Landmark, or the turning-soon "Go to it" control by click, Enter or Space, THE Place_View SHALL perform exactly one Navigation_Action for that activation.
6. IF an event other than a click, Enter or Space activation on the return control, a Landmark or the turning-soon "Go to it" control occurs, THEN THE Place_View SHALL perform no Navigation_Action.
7. THE Place_View SHALL register no non-passive wheel or touch listener on the World_Scroller.
8. WHEN the user presses Escape while the Detail_Panel is closed, THE Place_View SHALL perform no Navigation_Action and SHALL keep focus on its current element.
9. WHILE a scroll gesture is in progress or momentum scrolling continues, THE Place_View SHALL not activate a Creature, filter chip, pager button or return control from the scroll's trailing click or touch-end event.

### Requirement 5: Scroll-linked camera and parallax

**User Story:** As a visitor, I want the scenery to move at different speeds as I scroll, so that each place has visible depth, while everything I can click stays exactly where it appears.

#### Acceptance Criteria

1. WHERE Reduced_Motion is not active, WHEN the World_Scroller scroll offset changes, THE Explorable_World SHALL translate five bands (background, mid-ground, creature, near-mist, foreground) such that the creature band has a Band_Rate of exactly 1, the background band has a Band_Rate greater than 0 and less than the mid-ground band's Band_Rate, the mid-ground band has a Band_Rate less than 1, the near-mist band has a Band_Rate greater than 1 and less than the foreground band's Band_Rate, and the foreground band has the largest Band_Rate.
2. THE Explorable_World SHALL treat Scroll_Parallax as an offset of decorative art only, and SHALL position every interactive element (Creatures, their Fixtures and plaques, hit areas, In_World_Controls) at Band_Rate 1 on the real scroll position, so that hit-testing, hover cards and keyboard scroll-into-view use exact positions.
3. THE Explorable_World SHALL write Scroll_Parallax values as CSS custom properties on the World_Scroller root and SHALL read them in `calc()` transforms, so that a scroll event causes 0 React state updates and 0 React re-renders.
4. WHEN scroll events fire, THE Explorable_World SHALL write Scroll_Parallax custom properties at most once per animation frame, using the most recent scroll offset.
5. THE Explorable_World SHALL animate only `transform` and `opacity` for Scroll_Parallax and Discovery_Reveal.
6. WHERE pointer parallax is available, THE Explorable_World SHALL keep the existing `--px` and `--py` pointer parallax for decorative bands only and SHALL compose it additively with Scroll_Parallax, so that the rendered translation of each decorative band equals the sum of its pointer offset and its scroll offset, and the creature band receives 0 px of pointer offset.
7. WHERE Reduced_Motion is not active, THE Explorable_World SHALL apply Camera_Drift to the background band with a peak displacement of 12 px or less on each axis.
8. WHILE Reduced_Motion is active, THE Explorable_World SHALL apply 0 px of Scroll_Parallax, Camera_Drift and pointer parallax translation to every band, SHALL give every band a Band_Rate of 1, SHALL keep native scrolling reaching the same scroll offsets as when Reduced_Motion is not active, and SHALL cover the full World_Length with art at Band_Rate 1 so that no Seam is exposed (the Bleed MAY shrink to the minimum overscan defined in Requirement 19 criterion 3).
9. WHILE a travel transition is active, THE Explorable_World SHALL hold Scroll_Parallax and Camera_Drift at their current values, and WHEN the travel transition ends, THE Explorable_World SHALL resume them from the current scroll offset without a visible jump greater than 1 px.
10. IF the World_Scroller has a Viewport_Height of 0 or a maximum scroll offset of 0, THEN THE Explorable_World SHALL set Depth_Position to 0 and SHALL write finite (non-NaN) Scroll_Parallax values.

### Requirement 6: World adapts to repository count

**User Story:** As a developer with few or many repositories, I want the world to be exactly as long as it needs to be, so that I never scroll through empty space, and a small graveyard still has a little to explore.

#### Acceptance Criteria

1. THE World_Layout SHALL compute World_Length as a non-decreasing function of the Plot's Creature count, for counts from 0 to `PLOT_SIZE` (12), for each place and for each viewport size from 360 px to 1920 px wide.
2. IF the Plot has zero Creatures, THEN THE World_Layout SHALL return a World_Length of exactly 1 and no Creature slots, and THE Place_View SHALL show the complete empty scene defined in Requirement 16 with no vertical scrollbar.
3. IF the Plot has exactly 1 Creature, THEN THE World_Layout SHALL return a World_Length of exactly 1, for the Restless Sky, Hallowed Ground and the Crypt, at desktop and Compact_Layout widths.
4. IF the Restless Sky or Hallowed Ground has between 2 and 3 Creatures, or the Crypt has between 2 and 4 coffins (one chamber), THEN THE World_Layout SHALL return a World_Length greater than or equal to 1.25 and less than or equal to 1.5, at desktop and at Compact_Layout widths.
5. WHEN a Plot of any size has a World_Length greater than 1, THE World_Layout SHALL ensure that the vertical span between any two consecutive items among the viewport top, each Creature slot centre, each landmark feature of Requirement 7, 8 or 9 (the path continuing to the mausoleum, the stair descent, the cloud bank) and the world bottom contains no more than 0.6 Viewport_Height without a Creature slot or a landmark feature, so that the extra length comes from purposeful composition and not from blank gaps.
6. WHEN a Plot has 2 or more Creatures and a World_Length greater than 1, THE World_Layout SHALL place at least one Creature slot centre within the first Viewport_Height and at least one Creature slot centre or landmark feature below the first Viewport_Height boundary.
7. WHEN the Plot has 12 Creatures at a desktop viewport (768 px wide or more), THE World_Layout SHALL return a World_Length of at most 3.
8. WHEN the Plot has 12 Creatures at a Compact_Layout, THE World_Layout SHALL return a World_Length of at most 4.
9. THE World_Layout SHALL return exactly one slot per Creature, with slot coordinates lying inside the world bounds and every slot centre at least one Creature base size away from each chrome edge.
10. THE World_Layout SHALL guarantee that no two Creature plaque rectangles overlap, matching the existing `DepthScatter` guarantee, at every viewport width from 360 px to 1920 px.
11. THE World_Layout SHALL return identical World_Length and slot output for identical inputs (count, viewport size, place, names), with all variation derived from the seeded hash of the repository name.
12. IF `daysQuiet`, `pushedAt` or other row data is missing for a Creature, THEN THE World_Layout SHALL still place that Creature using only the repository name hash.
13. WHEN the active filter or Plot changes, THE Place_View SHALL recompute the World_Length from the new Plot and SHALL reset the World_Scroller to Depth_Position 0 within the same render commit.
14. WHEN the viewport is resized, THE Place_View SHALL recompute the World_Layout and SHALL clamp the Depth_Position to the range 0 to 1 inclusive.
15. IF the World_Scroller's measured Viewport_Height is 0, THEN THE World_Layout SHALL use the window height, or 812 px if the window is unavailable, as the Viewport_Height.

### Requirement 7: The Restless Sky explores altitude

**User Story:** As a developer, I want to climb through the sky and find ghosts floating at different heights, so that fading projects feel like they are drifting out of reach.

#### Acceptance Criteria

1. IF the Plot has more than 4 Creatures, THEN THE Restless_Sky SHALL arrange its Creatures across at least two altitude Strata, with at least 1 Creature in each Stratum.
2. IF the Plot has 2 or 3 Creatures, THEN THE Restless_Sky SHALL use a World_Length between 1.25 and 1.5 inclusive with two Strata (high air, then a cloud bank), placing the ghost with the fewest days until it turns into a zombie within the first Viewport_Height and at least one other ghost below the first Viewport_Height boundary.
3. THE Restless_Sky SHALL assign each ghost exactly one depth band (back, middle or front), derived only from the seeded hash of the repository name, so that the same repository name always receives the same band.
4. THE Restless_Sky SHALL scale and dim each ghost according to its depth band using the existing `DEPTH_ROWS` brightness and scale values, with the front band no smaller and no dimmer than the middle band, and the middle band no smaller and no dimmer than the back band.
5. WHEN the user scrolls the Restless_Sky, THE Restless_Sky SHALL move the cloud, star and moon layers at Band_Rates strictly lower than the creature band's Band_Rate of 1.
6. THE Restless_Sky SHALL keep the data-encoding `Moon` component in the same background band as the painted moon and positioned over it at every Depth_Position from 0 to 1, with a horizontal and vertical offset of no more than 2 px between the two on screen, and SHALL keep the moon inside the first Viewport_Height at Depth_Position 0.
7. WHERE Reduced_Motion is not active, WHEN a ghost first enters the viewport, THE Restless_Sky SHALL apply a single Discovery_Reveal to that ghost, using only transform and opacity, and SHALL not repeat the reveal for that ghost when it re-enters the viewport.
8. WHILE Reduced_Motion is active, THE Restless_Sky SHALL show every ghost fully visible at its final position and opacity with no Discovery_Reveal.
9. THE Restless_Sky SHALL render each ghost's glow, translucency, flicker and decay level exactly as the decay level (0 to 3) of the ghost's repository dictates today, regardless of its depth band or altitude Stratum.
10. THE Restless_Sky SHALL order ghosts with `orderForPlace` before assigning slots, so that the ghosts with the fewest days until they turn into zombies occupy the slots visible within the first Viewport_Height at Depth_Position 0.
11. IF the Plot has exactly 1 Creature, THEN THE Restless_Sky SHALL place it within the first Viewport_Height as Requirement 16 criterion 4 specifies.
12. THE Restless_Sky SHALL compose its sky continuously from top to bottom of the World_Length: thin high air with stars at the top, thickening cloud banks toward the bottom, the painted moon within the first Viewport_Height, with no visible change of tone or texture at any Blend_Zone between Strata (Requirement 19).

### Requirement 8: Hallowed Ground is a walkable path

**User Story:** As a developer, I want to walk a cemetery path past my finished projects, so that each tombstone feels like a place I can visit.

#### Acceptance Criteria

1. WHEN the Plot has 2 or more tombstones, THE Hallowed_Ground SHALL place the tombstones along a single continuous path that starts at the entry gate at Depth_Position 0 and ends at the far mausoleum at Depth_Position 1, with each successive tombstone positioned lower in the World_Scroller than the one before it.
2. THE Hallowed_Ground SHALL alternate the horizontal offset of successive tombstones to the left and right of the path centreline, with every tombstone plaque rectangle staying fully inside the horizontal bounds of the World_Scroller at viewport widths from 360 px to 1920 px.
3. THE Hallowed_Ground SHALL render the path, fence, mausoleum and mist layers using only the existing `place-ground`, `mg-fence-tile`, `mausoleum` and `fog-wisps` artwork plus CSS gradients, with no new image file, subject to Requirement 19.
4. WHEN the user scrolls the Hallowed_Ground, THE Hallowed_Ground SHALL move the fence, path and foreground decorative layers at Band_Rates greater than the background band's Band_Rate, while Tombstones and their plaques stay at Band_Rate 1.
5. WHILE Reduced_Motion is active, THE Hallowed_Ground SHALL render the fence, path and foreground layers at the same scroll rate as the content, with no Scroll_Parallax offset.
6. THE Hallowed_Ground SHALL render each tombstone's size, moss level and crack level with the same values as before this feature for identical row data, with no change to the Tombstone component's data encoding.
7. WHERE Reduced_Motion is not active, WHEN a tombstone first enters the viewport, THE Hallowed_Ground SHALL play that tombstone's candle-glow Discovery_Reveal once, lasting no more than 800 ms, using only `transform` and `opacity`, and SHALL not replay it on later scrolls.
8. WHILE Reduced_Motion is active, THE Hallowed_Ground SHALL show every tombstone's candle glow in its final state from first render, with no reveal animation.
9. THE Hallowed_Ground SHALL render Environmental_Mist as a low-lying ground mist whose density is a fixed per-place value (a single `@theme` token with an opacity no greater than 0.25) that helps depth and blending, SHALL render it with the same density for any zombie count, SHALL render no Data_Fog layer (`scene-fog` or `scene-fog-near`) there, and SHALL keep Environmental_Mist visually distinct from Data_Fog (Requirement 15 criterion 9).
10. WHILE the Plot has zero tombstones, THE Hallowed_Ground SHALL show the complete empty scene of Requirement 16 criterion 2 and use a World_Length of exactly 1.
11. WHILE the Plot has exactly one tombstone, THE Hallowed_Ground SHALL centre the tombstone on the path within the first screen and use a World_Length of exactly 1, with no vertical scrollbar.
12. WHILE the Plot has 2 or 3 tombstones, THE Hallowed_Ground SHALL use a World_Length between 1.25 and 1.5 inclusive in which the path continues from the last tombstone to the far mausoleum, which is fully visible at Depth_Position 1.
13. IF the artwork for the path, fence or mausoleum fails to load, THEN THE Hallowed_Ground SHALL keep the solid `--color-night-sky` background, keep every tombstone and control visible and activatable, and show no broken-image indicator.

### Requirement 9: The Crypt descends through chambers

**User Story:** As a developer, I want to descend into the crypt chamber by chamber, so that sealed repositories feel buried and worth discovering.

#### Acceptance Criteria

1. WHEN the Crypt renders a Plot with 1 to 12 coffins, THE Crypt SHALL divide the Plot into ceil(count / 4) chambers, in Plot order, with each chamber holding between 1 and 4 coffins and every chamber except the last holding exactly 4.
2. THE Crypt SHALL separate adjacent chambers with a Blend_Zone built from stairs or arches, and each chamber SHALL differ from its neighbour in stone treatment, torch-light treatment and darkness treatment.
3. WHEN the Plot has 2 to 4 coffins, THE Crypt SHALL render one chamber reached by a stair descent from the crypt entry, SHALL use a World_Length between 1.25 and 1.5 inclusive, and SHALL show at least one coffin within the first Viewport_Height and at least one coffin or the chamber's far wall below the first Viewport_Height boundary.
4. WHEN the user scrolls the Crypt, THE Crypt SHALL set ambient brightness to a value that is non-increasing as Depth_Position increases, equal to the entry brightness at Depth_Position 0, and no lower than 75 percent of the entry brightness at Depth_Position 1.
5. WHILE ambient brightness is reduced, THE Crypt SHALL keep the text of each coffin plaque at a contrast ratio of at least 4.5:1 against the surface directly behind it, and SHALL keep each coffin's opacity at 1.
6. THE Crypt SHALL reuse the `place-crypt` and `coffin` artwork, and MAY vary chambers by cropping, tinting and horizontally flipping that artwork, without adding any new image file.
7. WHERE Reduced_Motion is not active, WHEN a chamber first enters the viewport, THE Crypt SHALL play a Discovery_Reveal of that chamber's torch light and of each of its coffins' chains once, over no more than 600 ms, using only `transform` and `opacity`.
8. WHILE Reduced_Motion is active, THE Crypt SHALL render every chamber's torch light and every coffin's chains in their final revealed state with no animation.
9. THE Crypt SHALL keep chained-coffin art and sealed-state encoding identical to their current rendering in every chamber and at every Depth_Position.
10. THE Crypt SHALL render Environmental_Mist as a fixed-density dust and torch haze (a single `@theme` token with an opacity no greater than 0.2), SHALL render it with the same density for any zombie count, SHALL render no Data_Fog layer there, and SHALL keep it visually distinct from Data_Fog (Requirement 15 criterion 9).
11. WHEN the Plot has zero coffins, THE Crypt SHALL show the complete empty scene of Requirement 16 criterion 3 with a World_Length of exactly 1.
12. WHEN the active filter or Plot changes, THE Crypt SHALL recompute its chambers from the new Plot, using the same grouping rule as criterion 1.

### Requirement 10: Repository interactions are unchanged

**User Story:** As a returning user, I want selecting repositories to work exactly as before, so that exploring adds depth without breaking my workflow.

#### Acceptance Criteria

1. WHEN a Creature inside an Explorable_World is clicked, or has keyboard focus and receives an Enter or Space key press, THE Place_View SHALL call `onSelect` exactly once with that Creature's repository name.
2. WHEN `onSelect` is called for a Creature, THE SceneView SHALL open the Detail_Panel for that repository and set `?repo=<name>` using the same URL update method as before this feature, within 300 ms.
3. WHILE the pointer hovers a Creature or keyboard focus rests on it, and the World_Scroller has a scroll offset greater than 0, THE HoverCardLayer SHALL place the hover card within 4 px of the position it would have for the same Creature at the same on-screen location before this feature.
4. WHEN the World_Scroller scrolls while a hover card is open, THE HoverCardLayer SHALL dismiss the card or reposition it to the Creature's on-screen position within 100 ms of the scroll event, so that the card never stays at a position more than 4 px from the Creature's on-screen position.
5. WHEN a deep link with `?repo=<name>` resolves to a Creature of the current place in an Explorable_World, THE Place_View SHALL scroll the World_Scroller so that the Creature's vertical centre lies within the central 60 percent of the Viewport_Height, and THEN THE SceneView SHALL open the Detail_Panel.
6. WHEN the turning-soon "Go to it" control is activated for a ghost, THE Place_View SHALL open the Restless_Sky, set the filter to "all", call `onSelect` once with that ghost's repository name, and scroll the ghost's vertical centre into the central 60 percent of the Viewport_Height.
7. IF a deep link or "Go to it" target is not in the current Plot, THEN THE Place_View SHALL change to the Plot that contains the Creature before scrolling to it.
8. IF a deep link `?repo=<name>` matches no Creature in the loaded graveyard, THEN THE SceneView SHALL leave the World_Scroller at its current offset, open no Detail_Panel, and perform no error-producing action beyond what it did before this feature.
9. THE Place_View SHALL keep drag-to-override, the keyboard-accessible override menu, the daytime version of the same world, the "View as list" accessibility view and the séance flow reachable and producing the same results as before this feature, at every Depth_Position from 0 to 1.
10. THE Place_View SHALL keep no more than `PLOT_SIZE` (12) Creatures animated at once, counted across all Creatures in the current Plot whether or not they are on screen.

### Requirement 11: Controls integrated with the environment

**User Story:** As a visitor, I want the place controls to look like part of the world and stay readable, so that I never fight with text floating over a painting.

#### Acceptance Criteria

1. THE Place_View SHALL render the return control, the filter chips, the pager and the depth marker each as a Fixture of the place (a carved signpost, lantern-lit rail or stone ledge) built in the shared material language of Requirement 18 criterion 4, using `@theme` tokens for every colour and no hardcoded hex values.
2. THE In_World_Controls SHALL show text at a contrast ratio of at least 4.5:1 against the surface directly behind it, measured at Depth_Position 0, 0.5 and 1.
3. THE Place_View SHALL present the place heading and subtitle on a legibility surface that keeps a contrast ratio of at least 4.5:1 against the brightest region of the painted background behind it.
4. THE In_World_Controls SHALL keep a gap of at least 8 CSS pixels between their bounding boxes and the bounding box of every Creature (a Creature's bounding box includes its own mounted plaque or tag, which is part of the Creature and not an In_World_Controls element), at every Depth_Position and at viewport widths from 360 px to 1920 px.
5. THE In_World_Controls SHALL keep their existing `data-testid` values, accessible names, native `<button>` elements and `aria-pressed` / `aria-label` semantics.
6. THE depth marker SHALL show the current Strata as a visible text label (for example "Chamber 2 of 4" or "Altitude: high") that updates when the Strata changes, and its `aria-live="polite"` region SHALL be updated only when the Strata changes and at most once per second.
7. THE depth marker SHALL be a list of native `<button>` elements, one per Strata step, operable by Tab, Enter and Space, with `aria-current="true"` on the current step and an accessible name containing the step's label.
8. WHEN the user activates a depth marker step by click, Enter or Space, THE Place_View SHALL scroll the World_Scroller so that the first Strata boundary of the chosen step is at the top of the Viewport_Height (below the `scroll-padding` of Requirement 12 criterion 4), within 8 px.
9. IF an Explorable_World has a World_Length of exactly 1, THEN THE Place_View SHALL hide the depth marker steps and keep the return control, filter chips and pager visible and usable.
10. WHILE Reduced_Motion is active, THE Place_View SHALL scroll to a depth marker target without smooth animation and SHALL show Fixture hover and focus states as static style changes.
11. THE In_World_Controls SHALL contain none of these dashboard elements: cards with soft box shadows, progress bars with percentage labels, and tab bars.

### Requirement 12: Keyboard and screen reader exploration

**User Story:** As a keyboard or screen reader user, I want to explore every world without a pointer, so that the experience is available to everyone.

#### Acceptance Criteria

1. THE World_Scroller SHALL carry `role="region"`, an accessible name that contains the place name from `PLACES` (for example "The Restless Sky"), `tabIndex={0}`, and a focus ring at least 2 px wide in `--color-candle-400` whenever it has keyboard focus, and SHALL not trap focus: Tab and Shift+Tab SHALL move focus out of it, and its key handling SHALL leave Tab and Escape to the browser.
2. WHILE the World_Scroller has focus, WHEN the user presses Arrow Up, Arrow Down, Page Up, Page Down, Home, End, Space or Shift+Space, THE Place_View SHALL scroll the World_Scroller using native scrolling behaviour, with Home reaching Depth_Position 0 and End reaching Depth_Position 1.
3. WHEN a Creature, filter chip, pager button or return control receives keyboard focus, THE World_Scroller SHALL scroll so that the focused element is fully inside the Viewport_Height and not overlapped by any In_World_Controls element, with no scrolling when it is already fully visible and uncovered.
4. THE World_Scroller SHALL define `scroll-padding-top` and `scroll-padding-bottom` from `@theme` tokens equal to the height of the top and bottom Fixtures plus 8 px (and Creatures SHALL define a `scroll-margin` token), so that native focus scrolling and depth marker scrolling stop clear of fixed Fixtures without scripted measurement.
5. THE Place_View SHALL expose each Strata's Creatures as an ordered list (`<ol>` with `<li>` items) inside the World_Scroller, with the Creature's existing button, role, accessible name and `data-testid` unchanged inside the `<li>`.
6. THE Place_View SHALL order Creatures in the DOM and in the tab sequence by their visual position from top to bottom, and left to right for Creatures whose slots share the same row (the DOM order follows the slot position and not the urgency ordering used to assign slots), and the tab sequence among all elements SHALL be: `PlaceHeading`, return control, filter chips, depth marker, Creatures, pager.
7. WHEN a place is entered, THE Place_View SHALL move focus to the `PlaceHeading` exactly once, and SHALL not move focus to the World_Scroller or any Creature as a result of the entry.
8. WHILE Reduced_Motion is active, WHEN a scroll is requested programmatically (focus-driven scroll, depth marker step, deep link or "Go to it" activation), THE Place_View SHALL set the scroll offset instantly with `behavior: "auto"`, without smooth animation.
9. THE Place_View SHALL expose the place name and the current Strata label through the depth marker's `aria-live="polite"` region, as specified in Requirement 11 criterion 6, and SHALL announce nothing while the Strata is unchanged.
10. IF a Creature is focused while the World_Scroller scrolls it out of view by pointer or wheel input, THEN THE Place_View SHALL keep keyboard focus on that Creature without moving the scroll offset.
11. WHEN the Detail_Panel closes, THE Place_View SHALL return focus to the Creature that opened it, if that Creature is still in the current Plot, and otherwise to the `PlaceHeading`.
12. THE Explorable_World SHALL mark every decorative layer (Plates, Crops, Environmental_Mist, vignettes, Contact_Shadows, ambient effects) with `aria-hidden="true"` and, for layers that contain no interactive content, `inert`, so that decorations are absent from the accessibility tree and the tab sequence.

### Requirement 13: Mobile and touch

**User Story:** As a phone user, I want to explore a world with my thumb, so that touch scrolling feels natural and nothing is cut off.

#### Acceptance Criteria

1. WHILE the Compact_Layout is active, THE World_Scroller SHALL scroll vertically by native touch scrolling and SHALL have `touch-action: pan-y`.
2. WHILE the Compact_Layout is active, THE Place_View SHALL render the existing bottom bar containing the pager, with bottom padding of at least `env(safe-area-inset-bottom)`, and THE bottom bar SHALL not cover any Creature or Creature plaque at any Depth_Position.
3. WHILE the Compact_Layout is active, THE Place_View SHALL render the filter chips in a single row that scrolls horizontally, and a vertical touch gesture that starts on the chip row SHALL scroll the World_Scroller.
4. WHILE the Compact_Layout is active, THE World_Layout SHALL place Creatures in `min(creature count, floor(available width / 140))` columns, where available width is the World_Scroller width minus its horizontal padding and 140 CSS px is the minimum slot width, so that the layout has at least 2 columns when the count is 2 or more and the available width is at least 280 px, exactly 1 column when the count is 1, never more columns than Creatures, and no empty column forced, with no two Creature plaque rectangles overlapping.
5. WHILE the Compact_Layout is active, THE Place_View SHALL render each Creature, filter chip, pager button and return control with a touch target of at least 44 by 44 CSS pixels.
6. THE Place_View SHALL fit its content at every viewport width from 360 px to 1920 px inclusive, so that the document and the World_Scroller have a horizontal scroll width equal to their client width.
7. WHILE the device reports a coarse pointer or no hover, THE Place_View SHALL attach no pointer parallax listener (`--px` and `--py` stay unchanged during touch input).
8. WHEN a touch gesture ends after moving 8 px or less, THE Place_View SHALL treat it as a tap and SHALL activate the Creature, chip, pager button or return control under the release point exactly once.
9. IF a touch gesture moves more than 8 px before release, THEN THE Place_View SHALL treat it as a scroll and SHALL not activate any Creature, chip, pager button or return control, and SHALL not call `onSelect`.

### Requirement 14: Performance and resource budget

**User Story:** As a visitor on a mid-range laptop or phone, I want smooth motion, so that the atmosphere never costs readability or responsiveness.

#### Acceptance Criteria

1. WHILE the user scrolls an Explorable_World whose current Plot has 12 Creatures, THE Explorable_World SHALL sustain a median frame rate of at least 50 frames per second, with no more than 5 percent of frames longer than 33 ms, measured over a continuous 5-second scroll from Depth_Position 0 to 1 on a mid-range laptop (4 CPU cores, integrated graphics) in a production build.
2. WHILE a Creature is neither on screen nor hovered nor in the existing hero set (the at most four Creatures chosen by `pickFilterHeroes`), THE Explorable_World SHALL apply no `feTurbulence` or `feDisplacementMap` filter to that Creature.
3. WHILE the Plot has 12 Creatures, THE Explorable_World SHALL apply `feTurbulence` and `feDisplacementMap` filters to no more than 5 Creatures at once: the hero set of at most 4 plus the one hovered Creature.
4. WHILE a Creature lies entirely outside the World_Scroller's visible area, THE Explorable_World SHALL set that Creature's CSS animations to a paused state.
5. WHEN a Creature that was outside the visible area re-enters it, THE Explorable_World SHALL resume that Creature's CSS animations within one animation frame.
6. WHEN the World_Scroller emits scroll events, THE Explorable_World SHALL listen with passive listeners, coalesce work to at most one `requestAnimationFrame` callback per frame, and call `getBoundingClientRect` on no more than one element per animation frame.
7. THE Explorable_World SHALL add zero entries to the `dependencies` and `devDependencies` of `package.json`.
8. THE Explorable_World SHALL reuse existing files in `public/art/` and SHALL add no new image file larger than 150 KB (153,600 bytes); Requirement 19 criterion 9 defines the allowed derived art.
9. WHEN Lighthouse runs in mobile-default mode against a production build of `/estate`, THE Estate_Experience SHALL score 80 or higher in the Performance category on the median of 3 runs.
10. IF the Plot has 12 Creatures and the measured frame rate in criterion 1 drops below 50 frames per second, THEN THE Explorable_World SHALL be treated as failing this requirement and no filter or animation SHALL be added to compensate for it.
11. THE Explorable_World SHALL run no more than 4 simultaneous ambient effects per place, as Requirement 18 criterion 8 defines.

### Requirement 15: Atmosphere and readability preserved

**User Story:** As a visitor, I want exploration to keep the gothic look, so that the world feels handcrafted and not like a generic scroll page.

#### Acceptance Criteria

1. THE Explorable_World SHALL render its layers in this z-order from back to front: sky, background, mid-ground, far Environmental_Mist, foreground art, creatures (each with its mounted plaque), near Environmental_Mist, lantern, atmosphere (including the `fg-frame` vignette), chrome, with every Creature's plaque text above all art and mist layers, at every Depth_Position.
2. THE Explorable_World SHALL set `pointer-events: none` on every decorative full-cover layer (sky, background, mid-ground, mist, foreground art, atmosphere, legibility gradients, lantern), and no foreground decorative layer SHALL cover a Creature's plaque or hit area, so that a click at the centre of any Creature within the viewport reaches that Creature's button.
3. WHILE the lights-off state is active, THE LanternCursor SHALL follow the pointer to within 1 frame of lag at Depth_Position 0, 0.5 and 1.
4. WHEN the lights-on state is toggled at any Depth_Position, THE Explorable_World SHALL switch the lantern on or off without changing the World_Scroller's scroll offset.
5. THE Explorable_World SHALL attach a top legibility gradient and a bottom legibility gradient to the visible area of the World_Scroller (not to the world stage), each with a height of at least 15 percent of Viewport_Height, so that their on-screen position is unchanged across all scroll offsets.
6. THE Explorable_World SHALL map every visual effect and every added visual detail to a row of the Effects_Table with a purpose of data (a named Creature row field such as `state`, `decayLevel` or `daysQuiet`), story (environmental storytelling that makes no data claim) or blend (depth, seam hiding or legibility), and SHALL render no effect that lacks a row.
7. THE Explorable_World SHALL take every colour from `@theme` tokens (no hex, `rgb()` or `hsl()` literal in new component code) and SHALL use only fonts supplied by `next/font`.
8. IF a new visual cannot be mapped to a row of the Effects_Table, THEN THE Explorable_World SHALL omit that visual and SHALL render the remaining layers in the required z-order without error.
9. THE Explorable_World SHALL keep Environmental_Mist distinct from Data_Fog by using separate component names, separate `data-testid` values (`place-mist-*`, never `scene-fog` or `scene-fog-near`) and separate CSS classes, SHALL cap Environmental_Mist opacity at 0.25, and SHALL NOT vary Environmental_Mist with the zombie count, so that a visitor never reads Environmental_Mist as the limbo encoding (the steering rule "Fog density = number of zombies" applies to Data_Fog only).

### Requirement 16: Empty and edge states stay complete

**User Story:** As a user with an empty or tiny graveyard, I want every place to look finished, so that nothing feels broken or unfinished.

#### Acceptance Criteria

1. IF a filter yields zero Creatures in a Plot, THEN THE Place_View SHALL show the complete empty scene of criteria 2 to 4 for that place at a World_Length of exactly 1, SHALL keep every filter chip enabled and activatable by click, Enter and Space, and SHALL show no vertical scrollbar on the World_Scroller.
2. WHILE Hallowed Ground has zero tombstones, THE Hallowed_Ground SHALL render a finished cemetery at one screen: the worn path, the entry gate, the fence, the mausoleum, lit lanterns along the path, and one unmarked plot waiting for a first tombstone, lit by the place's Light_Source.
3. WHILE the Crypt has zero coffins, THE Crypt SHALL render a finished crypt at one screen: the chamber architecture (vaulted ceiling and wall niches), torch light, a sealed door at the far end, steps leading down, and drifting dust, lit by the place's Light_Source.
4. WHILE the Restless Sky has zero ghosts, THE Restless_Sky SHALL render a finished night sky at one screen: the moon, star field, cloud banks and an empty lantern hook, lit by the place's Light_Source.
5. THE empty copy of each place SHALL be integrated into the scene on an object of that scene (a carved plaque, a ledger on a stone ledge or a plate on the sealed door), at a contrast ratio of at least 4.5:1, and SHALL NOT render as text floating directly over the artwork.
6. WHEN a filter chip is activated from the zero-Creature state and the new filter yields at least one Creature, THE Place_View SHALL replace the empty scene with the Creatures and reset the World_Scroller to Depth_Position 0.
7. IF the painted background image fails to load, THEN THE Place_View SHALL render the solid `--color-night-sky` fallback behind all layers, SHALL keep every Creature, plaque and In_World_Controls element rendered and operable, and SHALL keep text in the In_World_Controls at a contrast ratio of at least 4.5:1 against the fallback.
8. IF the Plot has exactly one Creature, THEN THE World_Layout SHALL return a World_Length of exactly 1 and place the Creature's slot centre within 5 percent of the horizontal centre and within the middle 60 percent of the Viewport_Height of the first screen, and THE World_Scroller SHALL show no vertical scrollbar.
9. IF `daysQuiet`, `pushedAt` or any other row data for a Creature is missing, null or not a finite number, THEN THE World_Layout SHALL place that Creature using only the seeded hash of the repository name, SHALL return a slot within the world bounds, and SHALL not throw or produce NaN values.
10. IF the World_Scroller's measured height is 0, THEN THE World_Layout SHALL use the window height as Viewport_Height, and IF the window is unavailable, THEN THE World_Layout SHALL use 812 px.
11. IF the repository name of a Creature is an empty string, THEN THE World_Layout SHALL still return a slot within the world bounds for that Creature, using the seeded hash of the empty string.
12. IF the viewport width is below 360 px or above 1920 px, THEN THE Place_View SHALL render every Creature, chip and pager button within the viewport width with no horizontal scrolling, and SHALL clamp all World_Layout slots to the world bounds.

### Requirement 17: Incremental delivery and no regressions

**User Story:** As a maintainer, I want to ship this in small safe steps, so that each step can be verified and reverted on its own.

#### Acceptance Criteria

1. THE implementation SHALL capture Baseline_Screenshots (Requirement 20 criterion 2) before changing any code, deliver the shared foundation (World_Scroller, World_Layout, Scroll_Parallax, depth marker, In_World_Controls, art-composition helpers) as a step that is completed and verified before any place-specific step begins.
2. THE implementation SHALL deliver the Restless Sky, Hallowed Ground and the Crypt as three separate steps, in that order, after the shared foundation, followed by a final visual checkpoint step (Requirement 20).
3. WHEN a place-specific step completes, THE implementation SHALL leave the Place_View of every other place, including Beyond the Gate, with unchanged rendered output and unchanged behaviour.
4. WHEN a step completes, THE test files `tests/dom/EstateMap.test.tsx`, `PlaceView.test.tsx`, `CompactGeometry.test.tsx`, `CompactPlaceView.test.tsx`, `PointerEvents.test.tsx`, `LayoutRobustness.test.tsx`, `DepthScatter.test.tsx`, `SceneLayoutClickability.test.tsx`, `TravelTransition.test.tsx`, `TravelFade.test.tsx`, `Parallax.test.tsx`, `ReducedMotion.test.tsx` and `HoverCardPosition.test.tsx` SHALL all pass with zero failures and zero skipped tests.
5. IF an existing assertion in those test files contradicts this feature (for example the Landmark opacity 0.45 of the original Requirement 2 criterion 6, or the original zero-fog assertions for Hallowed Ground and the Crypt), THEN THE implementation SHALL update that assertion in the same step and record in the matching task the assertion changed and the reason, and SHALL leave every other assertion in those files unchanged.
6. THE implementation SHALL keep the `LayoutRobustness` rule that only decorative fog strips carry the `overflow-hidden` class and wrap no focusable element, and SHALL apply the rules of Requirement 3 criteria 2 and 4 to every new layer, so that the test fails if any new layer other than a fog strip carries `overflow-hidden`, or if any `overflow-clip` or `overflow-x-clip` element other than the World_Scroller is an ancestor of a Creature or a control.
7. THE implementation SHALL extend `PointerEvents` coverage so that every new full-cover layer is asserted to be `pointer-events-none` and a click at a Creature's position reaches the Creature.
8. THE World_Layout SHALL be a pure function in `lib/` whose inputs are limited to creature count, viewport size, place and repository names, and SHALL read no storage, clock, DOM or randomness other than the seeded hash of the repository name.
9. THE implementation SHALL use the existing devDependencies `fast-check` (`^4.10.2`) and `vitest` (`^5.1.0`), which are already listed in `package.json`, SHALL change `package.json` and the lockfile in no way, and SHALL include fast-check property tests for the World_Layout, each running at least 100 generated cases, covering: World_Length is non-decreasing as Creature count increases, for counts 0 to 12 and for any viewport width from 360 px to 1920 px; World_Length equals exactly 1 when the count is 0 or 1; World_Length lies in 1.25 to 1.5 inclusive for 2 or 3 Creatures (Sky, Hallowed Ground) and 2 to 4 coffins (Crypt) at desktop and Compact_Layout widths; no vertical span without a Creature slot or landmark feature exceeds 0.6 Viewport_Height; column count equals `min(count, floor(available width / 140))` in the Compact_Layout; every slot lies within the world bounds; no two Creature plaque rectangles overlap; output is deeply equal for identical inputs; Depth_Position is clamped to the range 0 to 1 for any scroll offset (including negative and larger than the maximum) and any world height, including a height of 0, without returning NaN.
10. THE implementation SHALL include DOM tests asserting that wheel, touch-move and scroll events on the World_Scroller cause zero calls to `onEnterPlace`, `onReturn` and `onSelect`.
11. THE implementation SHALL include fast-check property tests (at least 100 generated cases each) for the pure art-composition helpers of Requirement 19 criterion 10 and the contrast helper of Requirement 18 criterion 5.
12. IF any test required by criteria 4, 7, 9, 10 or 11 fails at the end of a step, or the Visual_Review required by Requirement 20 fails for that step, THEN THE implementation SHALL treat that step as incomplete and SHALL NOT begin the next step.
13. THE implementation SHALL keep each step independently revertible, so that reverting one step's changes leaves the app building with no type errors and with all tests from criterion 4 passing.

### Requirement 18: Art direction and visual hierarchy

**User Story:** As a visitor, I want each place to look professionally art-directed, so that it feels like a crafted game environment and not like generated images with a UI on top.

#### Acceptance Criteria

1. THE Explorable_World SHALL define for every Strata one focal point (the highest-urgency Creature, a landmark such as the moon, mausoleum or sealed door, or the empty-state object) in a composition table, SHALL place that focal point at or near a rule-of-thirds intersection of the Strata's screen frame (within 10 percent of the frame width and height), and SHALL be reviewed pass or fail in the Visual_Review.
2. THE Explorable_World SHALL separate each frame into background, mid-ground and foreground tiers, with the background tier lowest in contrast, saturation and detail, the mid-ground tier holding the Creatures at full contrast, and the foreground tier darker than the mid-ground tier and kept to the frame edges, as pass or fail in the Visual_Review.
3. THE Hallowed_Ground path, the Crypt stairs and arches, and the Restless_Sky cloud banks SHALL act as leading lines that direct the eye from the foreground toward the Strata's focal point.
4. THE In_World_Controls and Creature plaques SHALL share one material language defined by `@theme` tokens (iron, stone and candle-lit brass), SHALL be mounted to a surface of the place (a post, rail, ledge, hook or chain), and SHALL use no pill-shaped, soft-shadow or flat translucent-card styling.
5. THE Place_View SHALL use the font roles of `.kiro/steering/design.md` (Cinzel for headings, labels and buttons; IM Fell English for narrative text, epitaphs and whispers; the monospace for facts and numbers) at a documented type scale of `@theme` tokens, SHALL render no text smaller than 12 CSS px, SHALL render no text directly over artwork without a legibility surface, and SHALL keep every text and its surface at a contrast ratio of at least 4.5:1, verified by a pure contrast function over token pairs and by sampling the Review screenshots.
6. THE Explorable_World SHALL define one Light_Source token set per place (a light direction token and a colour-temperature token: moon for the Restless Sky, lantern and moonlight for Hallowed Ground, torch for the Crypt), and SHALL derive every Creature's Contact_Shadow direction, rim light and shading from that place's tokens, with no second light direction in the same place.
7. THE Explorable_World SHALL render one Contact_Shadow element (`data-testid="creature-shadow"`) for every standing Creature (zombie, risen, tombstone and coffin), and every ghost SHALL carry a rim light and a soft glow in the place's Light_Source colour temperature in place of a ground shadow.
8. THE Explorable_World SHALL run at most 4 simultaneous ambient effects per place (not counting Creature data encodings and one-shot Discovery_Reveals), and SHALL list every effect with its purpose in the Effects_Table of Requirement 15 criterion 6.
9. THE Explorable_World SHALL NOT render any effect whose only purpose is decoration, so that every effect encodes a data field, serves a story purpose or serves blending, and a test SHALL assert that every effect registered in code has an Effects_Table row and the reverse.
10. THE Explorable_World SHALL tie each environmental storytelling detail to real data wherever the data exists (for example fresh earth on a tombstone from a small `daysQuiet`, moss from `daysQuiet`, chain length on a coffin from its sealed state, a ghost's lantern brightness from its `decayLevel`), SHALL derive any detail that resembles a data encoding from a real field and never from randomness, and MAY add story-only details (path wear, wax drips, worn steps, at most two ravens placed by the seeded hash) that make no data claim and are marked `story` in the Effects_Table.
11. THE Explorable_World SHALL render each Creature as a physical object in its place: scaled and shaded by its depth band using the existing `DEPTH_ROWS` values, standing on a Contact_Shadow or lit by its rim light, and carrying its label as a mounted tag that is a DOM descendant of the Creature's button and moves with it (a grave marker tag on a tombstone, a hanging tag on a coffin, a lantern tag on a ghost), and SHALL NOT render a label as a floating element positioned independently of its Creature.
12. THE Visual_Review SHALL pass the checklist item "does not read as generated": no uniform bloom applied to every element, no identical glow repeated across all Creatures, no gradient-only panels standing in for objects, and no decorative particles without an Effects_Table row.

### Requirement 19: Artwork across extended environments

**User Story:** As a visitor, I want the artwork to stay beautiful as I scroll, so that I never see stretching, seams, repeats or abrupt changes of scenery.

#### Acceptance Criteria

1. THE Explorable_World SHALL scale every Plate uniformly (equal horizontal and vertical scale), preserving its aspect ratio, using `object-fit: cover` or an equivalent uniform scale with a per-Stratum focal point (`object-position`), and SHALL never scale a Plate non-uniformly.
2. THE Explorable_World SHALL choose a Crop of the base Plate per Stratum with intelligent cropping by focal point, so that every screen reads as a composed frame, and SHALL limit the effective upscale of any Crop to 1.75 times its native pixel density at a 1920 px wide viewport.
3. THE Explorable_World SHALL size the Bleed of each moving layer to exceed its maximum combined Scroll_Parallax, pointer parallax and Camera_Drift displacement at every Depth_Position and at a viewport width of 360 px (with the minimum overscan of 8 CSS px applying when Reduced_Motion is active), and SHALL soften every outer edge of a Plate with an edge mask, so that no Plate edge is exposed at any scroll position.
4. THE Explorable_World SHALL repeat only `mg-fence-tile` (the seamless tile), and only horizontally, SHALL NOT tile or repeat any other Plate, and SHALL render each landmark (the moon, mausoleum, gate and sealed door) at most once per world.
5. WHERE the same Plate is cropped more than once in one world, THE Explorable_World SHALL vary each additional Crop by a flip (horizontal for the ground and the crypt; either axis for the sky), an offset of at least 25 percent of the Crop size, or a scale difference of at least 15 percent, and SHALL mask the join with a Blend_Zone, so that no two visible Crops are identical.
6. THE Explorable_World SHALL join adjacent Strata with a Blend_Zone of at least 12 percent of Viewport_Height, built from a gradient mask, a haze or darkness band, a crossfade between Crops, or an architectural transition (stairs, arches), so that no environmental change is abrupt.
7. THE Explorable_World SHALL build every extended world as layers: a base Plate Crop per Stratum, plus transparent mid-ground and foreground Plates (`mg-fence`, `mg-fence-tile`, `fg-frame`, `mausoleum`, `fog-wisps`) and CSS gradients, and SHALL NOT stretch or vertically tile an opaque Plate (`place-*`, `bg-far`) over the full World_Length.
8. THE Explorable_World SHALL compose each place as a continuous journey: the Restless Sky as high thin air with stars at the top and thickening cloud with the moon lower in the first screen; Hallowed Ground as one path from the gate to the far mausoleum; the Crypt as a descent in which each chamber is a distinct Crop and tint joined by stairs or arches.
9. THE implementation SHALL add no new image file larger than 150 KB, SHALL create new art only as CSS gradients or as CSS crops of existing files (which add no file), and MAY add a crop derived offline with `sharp` only if `sharp` is available without changing `package.json`, the derived file stays under 150 KB, and the Visual_Review report names the file and its size; CSS-only composition is preferred.
10. THE implementation SHALL implement the Crop geometry as a pure function in `lib/` (inputs: Plate size, viewport size, Stratum focal point, Bleed; outputs: crop rectangle and scale) with property tests asserting that the crop rectangle lies inside the Plate, that horizontal scale equals vertical scale, that the upscale limit of criterion 2 holds, and that the Bleed covers the displacement of criterion 3.
11. THE Visual_Review SHALL include a Seam check that, for every recorded Blend_Zone join, compares the mean luminance of the 4 pixel rows above and below the join in screenshots at Depth_Position 0, 0.25, 0.5, 0.75 and 1 and reports a difference of at most 10 percent of full scale, that confirms no row or column along the viewport edge shows the solid `--color-night-sky` fallback, and that records a visual check of stretch, repeat and edge exposure for each Stratum.

### Requirement 20: Visual verification against the original

**User Story:** As the product owner, I want every environment checked by looking at real screenshots against the original, so that "looks better" is demonstrated and not assumed.

#### Acceptance Criteria

1. THE implementation SHALL capture screenshots with the tooling found by checking `.kiro/settings/mcp.json`, which declares only the `graveyard` MCP server and no Playwright MCP server, and `package.json`, which has no Playwright dependency, and therefore THE implementation SHALL use a throwaway Node script that drives the locally installed Chrome or Edge through the DevTools Protocol (using no package from npm and no change to `package.json`) against a dev server the user starts manually (`npm run dev`), stored outside the app and test code (under `docs/design-review/tools/`), and IF that script cannot run THEN the implementation SHALL ask the user to capture the screenshots manually in the browser at the Review_Viewports and SHALL record the user's confirmation.
2. BEFORE changing any code, THE implementation SHALL capture Baseline_Screenshots of the original Hub and of each original place (Sky, Beyond the Gate, Hallowed Ground, Crypt) for the Review_Cases that exist in the original (the original places are single-screen, so scroll position 0 only), at all Review_Viewports, and SHALL store them under `docs/design-review/` with filenames of the form `YYYY-MM-DD-baseline-<place>-<case>-<width>x<height>.png`.
3. WHEN an environment (Sky, Hallowed Ground, Crypt, and the Hub if touched) is implemented, THE implementation SHALL capture screenshots of the real rendered result at all Review_Viewports, at Depth_Position 0, 0.5 and 1 (position 0 only where World_Length is 1), for these Review_Cases: Sky with the 3-ghost demo, empty and 12 ghosts; Hallowed Ground empty, 3 tombstones and 12 tombstones; Crypt empty, 3 coffins and 12 coffins; stored as `YYYY-MM-DD-<step>-<place>-<case>-<width>x<height>-d<position>.png`.
4. WHEN an environment is implemented, THE implementation SHALL also capture that environment with Reduced_Motion emulated, and SHALL capture frames of its travel transition at approximately 0 ms, 1150 ms and 2200 ms (or a recording if the tooling supports it), and SHALL confirm that the transition still looks right.
5. WHEN an environment is implemented, THE implementation SHALL write a Visual_Review at `docs/design-review/YYYY-MM-DD-<place>-review.md` that compares the new screenshots with the Baseline_Screenshots side by side and gives pass or fail, with a one-line justification, for each criterion of Requirement 18 criteria 1 to 12 and Requirement 19 criteria 1 to 11, and for these checks: no visible Seam, stretch or edge at any scroll position, controls readable, Creatures grounded, empty states complete (including the Sky with zero ghosts, the empty cemetery and the empty crypt), Reduced_Motion appearance, and the World_Length and gap rules of Requirement 6 for the 3-Creature case.
6. IF the Visual_Review contains any fail, or states that the result does not look better than the original against the criteria of Requirements 18 and 19, THEN THE implementation SHALL treat the step as incomplete, SHALL iterate on the implementation, SHALL capture new screenshots and SHALL rewrite the review, exactly as for a failing test.
7. THE implementation SHALL state in each Visual_Review that the judgement was made by the agent from the stored screenshots, with the written critique, and SHALL NOT claim that automated tests alone establish visual quality.
8. WHEN all environments are complete, THE implementation SHALL run a final checkpoint that re-captures the full matrix of criterion 3 for all places and the Hub, re-runs the test files of Requirement 17 criterion 4 and the property tests of Requirement 17 criteria 9 and 11, writes a combined Visual_Review at `docs/design-review/YYYY-MM-DD-final-review.md`, and then asks the user for sign-off, because the agent's judgement of "looks better" is subjective.
9. THE implementation SHALL NOT mark the feature complete until the user has confirmed the final sign-off in writing in the conversation, and the final Visual_Review SHALL record that confirmation.
