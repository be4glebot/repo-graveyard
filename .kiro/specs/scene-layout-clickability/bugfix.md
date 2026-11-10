# Bugfix Requirements Document

## Introduction

At 1440x900 (Restless Sky, 3 ghosts) the place scene has three layout defects. First, full-width chrome wrappers sit above the creatures and intercept pointer events, so a creature such as `repo-graveyard` (y ≈ 75–182) cannot be clicked: `elementFromPoint` at its centre returns the `place-chrome` container. Second, creatures can be placed in the upper part of the scene, up to the title area, because the stage bands start as high as 0.20. Third, a plot with fewer creatures than the maximum column count packs them into the first columns, so three creatures all sit at x < 400 instead of using the full width.

Together these make creatures unreachable, crowd the title, and leave most of the scene empty. This spec fixes all three without changing unrelated scene behavior.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a creature's centre lies under a full-width chrome wrapper (the `place-chrome` container, the `place-title-block` column, the pager wrapper, or the site-header wrapper) THEN the system returns that wrapper from `elementFromPoint` at the creature's centre, so clicks and hovers never reach the creature.

1.2 WHEN a place is rendered at 1440x900 or 1280x720 THEN the system can position a creature's top edge, or its plaque, above one third of the scene height (the sky band starts at 0.20), and can overlap the bounding box of the place chrome.

1.3 WHEN a depth row holds fewer creatures than the maximum number of columns (for example 3 creatures in Restless Sky) THEN the system fills columns from the left, so all creatures sit in the leftmost part of the scene (x < 400 at 1440 wide) and the rest of the width stays empty.

### Expected Behavior (Correct)

2.1 WHEN a creature's centre lies under a full-width chrome wrapper THEN the system SHALL render those wrappers with `pointer-events: none` and re-enable `pointer-events: auto` only on their real controls (Return, filter chips, pager buttons, header badge and toggles, and any other buttons or links), so `elementFromPoint` at each creature's centre returns that creature.

2.2 WHEN a place is rendered with 1 to 12 creatures at 1440x900 or 1280x720 THEN the system SHALL place every creature rectangle and every plaque rectangle entirely below one third of the scene height and outside the place chrome bounding box, and SHALL define every place's stage band with a top of at least 0.36 of the scene height (sky 0.38–0.85) and a bottom above the pager.

2.3 WHEN a row holds fewer creatures than the maximum column count THEN the system SHALL distribute the plot's creatures in evenly spaced, centred columns across the whole usable width, so that 3 creatures span left, centre and right, and for n ≥ 2 creatures the horizontal spread (max x − min x) is at least 40% of the usable width.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user clicks, hovers, or focuses a real control (Return, filter chips, pager buttons, header badge, Lights-on and Sound toggles) THEN the system SHALL CONTINUE TO activate that control exactly as before.

3.2 WHEN a plot has the maximum number of creatures per row THEN the system SHALL CONTINUE TO use the existing staggered column grid, and no two plaque rectangles SHALL overlap (at 1440 and 1280 wide).

3.3 WHEN the viewport is narrower than the 768px mobile breakpoint THEN the system SHALL CONTINUE TO use the two-column staggered mobile layout.

3.4 WHEN `scatterLayout` is called with equal inputs THEN the system SHALL CONTINUE TO return deterministic, field-by-field equal records, with one record per name in input order, depth-ordered scale and brightness, and exactly `round(n / 3)` mirrored records.

3.5 WHEN a creature is shown in any place THEN the system SHALL CONTINUE TO keep it and its plaque inside the 16px scene edge margins, with plaques never mirrored and the hover card, selection, and travel transition behaving as before.

3.6 WHEN the footer is rendered THEN the system SHALL CONTINUE TO keep its wrapper non-interactive while its legend and plaque content remain visible.

3.7 WHEN the existing test suite is run THEN the system SHALL CONTINUE TO pass all existing tests.
