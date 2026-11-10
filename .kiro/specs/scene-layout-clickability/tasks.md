# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Creatures clickable, below top third, clear of chrome, spread across width
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases: every place with 1–12 names at 1440x900 and 1280x720, and Restless Sky with 3 ghosts
  - Test (a): every creature rect and plaque rect has `top >= sceneH / 3` and does not intersect the chrome rect (union of `place-chrome` and `place-title-block`)
  - Test (b): DOM hit test with stubbed rects and a pointer-events-aware `elementFromPoint` helper; the hit at each creature centre is that creature
  - Test (c): for n = 1, 2, 3 the horizontal spread (max x − min x) is at least 40% of the usable width when n >= 2
  - Bug Condition from design: `clickBlocked OR aboveThirdOrOnChrome OR packedLeft`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (for example the hit test returns `place-chrome`, sky tops near 70px, 3-creature x values all below 400)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Unaffected layout and interaction behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: `scatterLayout` output for full plots (12 names, 4 per row), determinism, mirror count `round(n / 3)`, scale and brightness ordering
  - Observe on UNFIXED code: Return, filter chip and pager buttons fire their handlers; mobile width (< 768) yields `data-layout="two-column"`; footer wrapper is `pointer-events-none`
  - Write property-based tests capturing these observed behaviors (full-row `x` values equal the baseline, plaque no-overlap at 1440 and 1280, 16px edge margins)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for unclickable creatures, creatures above the top third, and left-packed small plots

  - [x] 3.1 Make full-width chrome wrappers click-through
    - Add `pointer-events-none` to `place-chrome`, `place-title-block`, and the pager wrapper in `PlaceView.tsx`
    - Add `pointer-events-auto` to `ReturnToGate`, the `FilterChips` buttons, and the `Pager` buttons
    - Add `pointer-events-none` to the `site-header` wrapper in `SceneView.tsx` and `pointer-events-auto` to the interactive parts of `Header`
    - Keep the footer wrapper as is
    - _Bug_Condition: isBugCondition(input) where clickBlocked(input)_
    - _Expected_Behavior: expectedBehavior(result) from design (hit test returns the creature)_
    - _Preservation: Preservation Requirements from design (controls stay clickable)_
    - _Requirements: 2.1, 3.1, 3.6_

  - [x] 3.2 Move stage bands down and add a top limit
    - Update `STAGE_BANDS`: sky 0.38–0.85; gate, ground and crypt tops >= 0.36 and bottoms <= 0.85
    - Add optional `topLimitPx` to `resolvePlacement` (default 0) so creature and plaque rect tops are >= the limit, shrinking toward the height floor only if needed
    - Measure the chrome rect in `PlaceView` and pass `topLimitPx = max(sceneH / 3, chromeBottomPx)` through `DepthScatter`
    - Update comments tied to `STAGE_BAND_MIN_HEIGHT` and review any existing tests that pin old band values
    - _Bug_Condition: isBugCondition(input) where aboveThirdOrOnChrome(input)_
    - _Expected_Behavior: expectedBehavior(result) from design (rects below sceneH / 3 and clear of chrome)_
    - _Preservation: Preservation Requirements from design (edge margins, plaque no-overlap, mobile layout)_
    - _Requirements: 2.2, 3.2, 3.3, 3.5_

  - [x] 3.3 Spread small plots across the full width
    - In `scatterLayout`, use plot-level lanes `L = min(n, MAX_SCATTER_COLS)` with centres `(j + 0.5) / L`, distributed evenly across rows with a deterministic per-row rotation
    - Keep the existing staggered grid for full rows
    - Keep x-jitter inside the cell so same-row plaques cannot overlap; keep output deterministic with one record per name in input order
    - _Bug_Condition: isBugCondition(input) where packedLeft(input)_
    - _Expected_Behavior: expectedBehavior(result) from design (spread >= 40% of usable width for n >= 2)_
    - _Preservation: Preservation Requirements from design (full rows, determinism, mirror count)_
    - _Requirements: 2.3, 3.2, 3.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Creatures clickable, below top third, clear of chrome, spread across width
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Unaffected layout and interaction behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all existing tests still pass after the fix

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Do not delete existing tests without asking. Verify with `vitest --run` and `tsc --noEmit`; never run `next build` while the dev server is running.
- Write and run the exploration test (1) and the preservation tests (2) on UNFIXED code before any fix.
- Sub-tasks 3.1, 3.2 and 3.3 touch different concerns but 3.2 and 3.3 both edit `lib/estate-view.ts`, so they run in sequence.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2"] },
    { "id": 2, "tasks": ["3.3"] },
    { "id": 3, "tasks": ["3.4", "3.5"] },
    { "id": 4, "tasks": ["4"] }
  ]
}
```
