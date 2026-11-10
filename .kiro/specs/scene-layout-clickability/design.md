# Scene Layout Clickability Bugfix Design

## Overview

Three layout defects in the place scene make creatures unclickable, crowd the title area, and leave small plots bunched at the left. The fix has three parts:

1. Make full-width chrome wrappers click-through (`pointer-events: none`) and re-enable pointer events only on real controls.
2. Move the stage bands down (every top ≥ 0.36, sky 0.38–0.85) and add a top limit to `resolvePlacement` so no creature or plaque rect rises above `max(sceneH / 3, chromeBottom)`.
3. Change `scatterLayout` so a plot with fewer creatures than `MAX_SCATTER_COLS` spreads them in evenly spaced, centred lanes across the full width.

No application code changes are made by this spec. Implementation happens when the tasks are executed.

## Glossary

- **Bug_Condition (C)**: The inputs that trigger a defect (see Bug Details).
- **Property (P)**: The desired behavior for inputs where C holds.
- **Preservation**: Behavior for inputs where C does not hold, which must not change.
- **place-chrome**: `data-testid="place-chrome"` in `components/scene/PlaceView.tsx`. In the current code this is the absolutely positioned wrapper (`absolute left-0 z-50 p-6`) around `ReturnToGate`.
- **place-title-block**: `data-testid="place-title-block"` in `PlaceView.tsx`. A full-width (`inset-x-0 z-40`) column holding the heading, subtitle and `FilterChips`. It is the full-width box that actually covers creatures.
- **chrome rect**: The bounding box used by tests and layout: the union of the `place-chrome` and `place-title-block` rects.
- **STAGE_BANDS**: `Record<PlaceId, { top, bottom }>` in `lib/estate-view.ts`; scene-height fractions that bound creature feet `y` per place.
- **scatterLayout**: Pure seeded layout in `lib/estate-view.ts` returning `x`, `y`, `scale`, `row`, and more per creature.
- **resolvePlacement**: Pure function in `lib/estate-view.ts` that turns a placement into pixel creature and plaque rects (edge clamp, height cap, plaque nudge).
- **topLimitPx**: New input to `resolvePlacement`: `max(sceneH / 3, chromeBottomPx)`. No creature or plaque rect may have `top < topLimitPx`.
- **usable width**: `sceneW − 2 × SCENE_EDGE_MARGIN_PX`.
- **lane**: One of `L = min(n, MAX_SCATTER_COLS)` evenly spaced horizontal slots, with centres at `(j + 0.5) / L` of the usable width.

## Bug Details

### Bug Condition

Defect 1 occurs when a creature's centre point is covered by a full-width wrapper that is not click-through: `place-title-block` (`inset-x-0`, no `pointer-events-none`), the pager wrapper (`inset-x-0 bottom-16 z-50`), and the site-header wrapper (`inset-x-0 top-0 z-50`). The `place-chrome` wrapper has the same flaw. The footer wrapper is already `pointer-events-none`. Defect 2 occurs because the sky band starts at 0.20 and creatures rise up to `CREATURE_BASE_SIZE × scale` (up to 161px) above their feet line, so even a band top of 0.36 is not enough on its own; a back-row creature at 0.36 × 900 = 324px feet with a 108px body reaches y = 216, above 300. Defect 3 occurs because each row fills columns from `col 0` with `cellCentre = (col + 0.5 + phase) / (MAX_SCATTER_COLS + 0.5)` (a ≤ 3-creature plot puts one creature per row at columns 0, so x ≈ 0.11–0.22).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SceneState { place, names[1..12], sceneW, sceneH }
  OUTPUT: boolean

  RETURN clickBlocked(input)       // elementFromPoint(centre of some creature) != that creature
      OR aboveThirdOrOnChrome(input) // some creature/plaque rect has top < sceneH/3, or intersects chromeRect
      OR packedLeft(input)         // n >= 2 AND (max x - min x) < 0.4 * usableWidth
                                   //   while every row has fewer creatures than MAX_SCATTER_COLS
END FUNCTION
```

### Examples

- Restless Sky at 1440x900 with 3 ghosts: `repo-graveyard` has its centre at y ≈ 75–182; `elementFromPoint` there returns `place-chrome`, expected the creature's button. A click does nothing.
- Sky place with 1 ghost: the back-row creature feet land at 0.20 × 900 = 180px, so its top edge is near 70px, over the title; expected top ≥ 300px and below the chrome rect.
- 3 creatures at 1440x900: creature x values all < 400 (for example 0.11, 0.22, 0.11 of width); expected lanes at about 1/6, 1/2, 5/6 of the width, so spread ≈ 960px.
- 2 creatures: expected lanes at 1/4 and 3/4, spread ≈ 720px (≥ 40% of the usable width 1408px = 563px).
- 1 creature: a single creature is centred (spread is not constrained).
- Edge: 12 creatures (4 per row): the existing staggered grid is used; no change.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Real controls (Return, filter chips, pager buttons, header badge, Lights-on and Sound toggles) remain clickable and focusable.
- Full rows (4 creatures) keep the current staggered column grid and the no-overlap guarantee for plaque rects.
- The mobile two-column layout (< 768px) is unchanged.
- `scatterLayout` stays pure and deterministic; mirror count, scale and brightness ordering are unchanged.
- Edge margins (16px), unmirrored plaques, hover card, selection and travel transition behavior are unchanged.

**Scope:**
All inputs where no chrome wrapper covers a creature, every rect already sits below `topLimitPx`, and the plot already fills its rows are unaffected. This includes:
- Plots with 10–12 creatures (full rows).
- Mouse and keyboard interaction with chrome controls.
- Mobile-width renders.

## Hypothesized Root Cause

1. **Click-through missing on chrome wrappers**: `place-chrome`, `place-title-block`, the pager wrapper and the `site-header` wrapper have no `pointer-events-none`. They sit at z-40 or z-50, above the creatures layer (z-20) and the plaque layer (z-30). The decorative overlays in `PlaceView` are already `pointer-events-none`, so only these wrappers were missed.
2. **Stage bands too high and no top limit**: `STAGE_BANDS.sky.top = 0.2` puts feet near the title. The creature body extends upward from the feet by up to `140 × scale`, and nothing keeps the body or plaque below the chrome. Changing the bands alone cannot satisfy the "top edge ≥ sceneH/3" rule.
3. **Per-row left-fill column assignment**: `scatterLayout` assigns `col = colCursor[band] % MAX_SCATTER_COLS` and maps with `/(MAX_SCATTER_COLS + 0.5)`, so a row with k < max creatures uses the first k cells. With `n ≤ 3`, front-first row assignment gives one creature per row, each in column 0.
4. **Test environment gap (risk)**: jsdom has no layout engine, so `elementFromPoint` and rect geometry cannot be observed directly without a helper. The existing `PointerEvents.test.tsx` asserts structure (class names) only.

## Correctness Properties

Property 1: Bug Condition - Creatures are clickable, below the top third, clear of the chrome, and spread across the width

_For any_ scene state where the bug condition holds (isBugCondition returns true), with 1–12 names in every place at 1440x900 and 1280x720, the fixed layout SHALL (a) return the creature itself from a hit test at each creature's centre, (b) place every creature rect and plaque rect with `top ≥ sceneH / 3` and outside the chrome rect, and (c) for n ≥ 2 have a horizontal spread (max x − min x) of at least 40% of the usable width.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Unaffected layout and interaction behavior

_For any_ scene state where the bug condition does NOT hold (full rows, mobile width, chrome controls, determinism, margins), the fixed code SHALL produce the same result as the original code, preserving control activation, the staggered full-row grid, plaque no-overlap, the mobile layout, deterministic `scatterLayout` output, and the 16px edge margins.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `components/scene/PlaceView.tsx`

1. **Click-through wrappers**: Add `pointer-events-none` to `place-chrome`, `place-title-block` and the pager wrapper. Add `pointer-events-auto` to the real controls inside them: the `ReturnToGate` button, the `FilterChips` buttons (the chip container, not the full column), and the `Pager` buttons. `PlaceHeading` stays non-interactive, but it must remain a focus target (`tabIndex={-1}`), which works with `pointer-events: none`.
2. **Chrome rect measurement**: Measure the union of `place-chrome` and `place-title-block` bounding rects (via `ResizeObserver`) and pass `chromeBottomPx` to `DepthScatter`. Fall back to a constant derived from `--site-header-h` until measured.

**File**: `components/scene/SceneView.tsx`

3. **Header wrapper**: Add `pointer-events-none` to the `site-header` wrapper and `pointer-events-auto` to the interactive parts of `Header` (badge link, toggles). Keep the footer wrapper as is.

**File**: `components/scene/DepthScatter.tsx`

4. **Pass the top limit**: Compute `topLimitPx = max(sceneH / 3, chromeBottomPx)` and pass it to `resolvePlacement`. Resolve rows front-first as now.

**File**: `lib/estate-view.ts`

5. **STAGE_BANDS**: Set `sky: { top: 0.38, bottom: 0.85 }`, and set `gate`, `ground`, `crypt` to tops of at least 0.36 (current 0.46, 0.42, 0.45 already satisfy this) with every `bottom` at most 0.85, since the pager top is about 0.856 of a 720px scene. Confirm against the measured pager rect in tests. Update the `STAGE_BAND_MIN_HEIGHT` comments.
6. **resolvePlacement top limit**: Add an optional `topLimitPx` parameter (default `0` so existing callers and tests are unaffected). After sizing, enforce `creatureRect.top ≥ topLimitPx` and `plaqueRect.top ≥ topLimitPx` by lowering the feet line to `topLimitPx + creatureH` (down to the front-row ground line). If that no longer fits, shrink the creature toward `CREATURE_HEIGHT_FLOOR_FRAC × sceneH` before moving it. The function stays pure.
7. **scatterLayout lane spread**: Replace per-row left-fill with plot-level lanes. Let `L = min(n, MAX_SCATTER_COLS)`. Each row with `k_r` creatures takes `k_r` distinct lanes, spaced as evenly as possible across the `L` lanes, with a deterministic per-row rotation so single-creature rows take different lanes (3 creatures yield lanes 0, 1, 2 across `L = 3`). Lane centres are `(j + 0.5) / L`. Rows that are full (`k_r = MAX_SCATTER_COLS`) keep the current formula, including the odd-row stagger, so full plots are unchanged. Keep x-jitter inside the cell so same-row plaques still cannot overlap.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

Test stack: vitest, jsdom, Testing Library and fast-check. jsdom has no layout engine, so the hit-test test (b) needs a small helper that stubs `getBoundingClientRect` from the component's inline styles or the `resolvePlacement` output, and implements `elementFromPoint` by walking the DOM in z-index order and skipping elements whose effective `pointer-events` is `none` (read from the `pointer-events-none` class or inline style, since Tailwind CSS is not loaded). If this proves too weak, a real-browser check (for example Playwright) is an option, but it is not part of the current stack and would be a decision for the user.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write the three required tests against the current code. Run them on the UNFIXED code to observe failures.

**Test Cases**:
1. **Hit-test at creature centre**: Render `PlaceView` for sky with 3 ghosts at 1440x900 with stubbed rects; assert the hit element is inside the creature (will fail on unfixed code: returns `place-title-block`/`place-chrome`).
2. **Top-third and chrome exclusion**: For 1–12 names in each place at 1440x900 and 1280x720, assert every creature and plaque rect has `top ≥ sceneH / 3` and does not intersect the chrome rect (will fail on unfixed code, especially for sky).
3. **Horizontal spread**: For n = 2 and 3, assert the spread is ≥ 40% of the usable width (will fail on unfixed code; x values all < 400).
4. **n = 1 and n = 12 edge cases**: Assert no crash and that the rects stay inside the margins (may pass on unfixed code).

**Expected Counterexamples**:
- Hit test returns a chrome wrapper at the creature centre.
- Sky creature rect tops below 300px at 900 height (for example about 70–200px).
- Spread of about 0.11–0.22 of the width for 3 creatures.
- Possible causes: missing `pointer-events-none`, band top 0.20 with no top limit, left-fill columns.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := layoutAndRender_fixed(input)
  ASSERT expectedBehavior(result)
END FOR

FUNCTION expectedBehavior(result)
  RETURN FORALL c IN result.creatures:
           hitTest(c.centre) = c
           AND c.creatureRect.top >= sceneH / 3 AND c.plaqueRect.top >= sceneH / 3
           AND NOT intersects(c.creatureRect, chromeRect) AND NOT intersects(c.plaqueRect, chromeRect)
         AND (n < 2 OR spread(result.creatures) >= 0.4 * usableWidth)
END FUNCTION
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT original(input) = fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for full-row plots, mobile widths, chrome controls and determinism, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Full-row grid preservation**: For 12 names (4 per row), `x` values from `scatterLayout` equal the unfixed values; plaque rects never overlap.
2. **Control activation preservation**: Return, chips and pager buttons still fire their handlers when clicked.
3. **Mobile layout preservation**: Width < 768 still yields `data-layout="two-column"` with unchanged positions.
4. **Determinism and mirror count preservation**: Equal inputs give equal outputs; exactly `round(n / 3)` mirrored.
5. **Existing suites**: `tests/property/estate-view.property.test.ts`, `tests/unit/estate-view.test.ts`, `tests/dom/PointerEvents.test.tsx`, `DepthScatter.test.tsx`, `LayoutRobustness.test.tsx`, `PlaceView.test.tsx` and `SceneView*.test.tsx` all pass. Tests that pin old band values need review (for example the stage-band y property reads the production `STAGE_BANDS`, so it should follow the change).

### Unit Tests

- `STAGE_BANDS` tops ≥ 0.36, sky is 0.38–0.85, bottoms ≤ 0.85.
- `resolvePlacement` with `topLimitPx` keeps creature and plaque rect tops ≥ the limit.
- `scatterLayout` lane x values for n = 1, 2, 3, and a partial row such as n = 5.
- Wrapper classes: `place-chrome`, `place-title-block`, pager wrapper and `site-header` carry `pointer-events-none`; controls carry `pointer-events-auto`.

### Property-Based Tests

- For random names (1–12), each place, and each of 1440x900 and 1280x720: all creature and plaque rects are below `sceneH / 3` and clear of the chrome rect.
- For random names with n ≥ 2 and a non-full plot: spread ≥ 40% of the usable width.
- For random full plots: x, scale, brightness and mirrored values equal the pre-fix output; plaque no-overlap holds.

### Integration Tests

- Render `PlaceView` with a stubbed layout for every place and assert the hit test at each creature centre returns that creature.
- Click a creature at the previously blocked position (sky, 3 ghosts) and assert `onSelect` fires.
- Click Return, a filter chip and a pager button and assert each handler fires.
