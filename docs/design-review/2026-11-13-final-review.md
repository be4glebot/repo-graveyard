# Visual Review: final (combined sky, ground, crypt, gate, hub)

- Date: 2026-11-13
- Place: final (sky, ground, crypt; gate and hub included for context)
- Step: final
- Tool: `docs/design-review/tools/capture.mjs --step final --places hub,gate,sky,ground,crypt --depths 0,0.25,0.5,0.75,1 --reduced --travel --seam` (see `2026-11-13-final-capture-notes.md` for the capture run itself; this document is the visual judgement, task 19.2)
- Commit / change set: working tree at time of capture (explorable-worlds spec, tasks through 19.1)

## Method statement

This judgement was made by the agent from the stored screenshots listed below, opened with `read_file`, plus five targeted non-visual checks run directly against the feature code and data (gap table, sky upscale, blend-zone height, contrast, Effects_Table parity) to close gaps the 2026-11-12 per-place reviews had left as "not verified." Automated tests alone do not establish visual quality (Req 20.7); the numeric checks below supplement, not replace, the screenshots.

## Screenshots reviewed

All files are under `docs/design-review/`, dated 2026-11-13 unless noted as baseline (2026-11-12).

- Hub: `final-hub-ghosts-3-{1440x900,1920x1080,390x844,360x740}-d0.png`; baseline `baseline-hub-ghosts-3-1440x900.png`
- Sky: `final-sky-ghosts-3-{1440x900,1920x1080,390x844,360x740}-d{0,0.5,1}.png`; `final-sky-ghosts-3-reduced-1440x900-d0.png`; `final-sky-empty-1440x900-d0.png`; `final-sky-travel-t2200-1440x900-d0.png`; baselines `baseline-sky-ghosts-3-{1440x900,1920x1080,360x740}.png`
- Ground: `final-ground-tombstones-3-{1440x900,1920x1080,390x844,360x740}-d{0,0.5,1}.png` (d0.5 only captured/opened at 1440x900); `final-ground-empty-{1440x900,390x844}-d0.png`; `final-ground-travel-t2200-1440x900-d0.png`; baselines `baseline-ground-tombstones-3-{1440x900,1920x1080,360x740}.png`
- Crypt: `final-crypt-coffins-3-{1440x900,1920x1080,390x844,360x740}-d0.png`; `final-crypt-empty-1440x900-d0.png`; `final-crypt-travel-t2200-1440x900-d0.png`; baselines `baseline-crypt-coffins-3-{1440x900,1920x1080}.png`
- Gate (legacy `PlaceView`, outside the explorable-worlds `WorldPlace` set but captured for review coverage): `final-gate-ghosts-3-{1440x900,390x844}-d0.png`

Not opened in this pass (noted in the verdict as "not viewed," not judged pass or fail from a screenshot): `final-*-ghosts-12`/`tombstones-12`/`coffins-12` shots at non-1440 viewports; `d0.25`/`d0.75` intermediate depths anywhere; `-reduced` variants for ground/crypt/gate; `t0`/`t1150` travel frames; `390x844`/`360x740` crypt-coffins d0.5/d1 (filenames exist but were not read); mobile baselines for crypt and gate.

## Side by side with the baseline

| Case | Viewport | Baseline file | New file (d0) | Better than the original? | Note |
|---|---|---|---|---|---|
| sky ghosts-3 | 1440x900 | `baseline-sky-ghosts-3-1440x900.png` | `final-sky-ghosts-3-1440x900-d0.png` | yes | Same 3 ghost positions, labels, filter-chip counts; final adds visible star field and moon at top-right not present in baseline's plain composition |
| sky ghosts-3 | 1920x1080 | `baseline-sky-ghosts-3-1920x1080.png` | `final-sky-ghosts-3-1920x1080-d0.png` | yes | Composition scales cleanly, no stretching, moon crop stays proportionate |
| sky ghosts-3 | 360x740 | `baseline-sky-ghosts-3-360x740.png` | `final-sky-ghosts-3-360x740-d0.png` | yes | Mobile stacks ghosts vertically with full labels, no overlap, no horizontal scroll |
| ground tombstones-3 | 1440x900 | `baseline-ground-tombstones-3-1440x900.png` | `final-ground-tombstones-3-1440x900-d0.png` | yes | Same 2 "RIP" stones plus a third off-frame right in both; final composition adds a path/fence backdrop baseline lacked |
| ground tombstones-3 | 1920x1080 | `baseline-ground-tombstones-3-1920x1080.png` | `final-ground-tombstones-3-1920x1080-d0.png` | yes | Scales without distortion |
| ground tombstones-3 | 360x740 | `baseline-ground-tombstones-3-360x740.png` | `final-ground-tombstones-3-360x740-d0.png` | yes | Vertical mobile stack, labels legible |
| crypt coffins-3 | 1440x900 | `baseline-crypt-coffins-3-1440x900.png` | `final-crypt-coffins-3-1440x900-d0.png` | yes | Same 2 coffins visible plus a third off-frame; final adds visible torches/chains/dust the baseline's flatter render lacked |
| crypt coffins-3 | 1920x1080 | `baseline-crypt-coffins-3-1920x1080.png` | `final-crypt-coffins-3-1920x1080-d0.png` | yes | Consistent at wide viewport |
| crypt coffins-3 | 390x844 | (no baseline opened) | `final-crypt-coffins-3-390x844-d0.png` | n/a | Mobile stack reads cleanly against the `1440x900` baseline's composition |
| crypt coffins-3 | 360x740 | (no baseline opened) | `final-crypt-coffins-3-360x740-d0.png` | n/a | Same as above, smallest viewport |

## Requirement 18: Art direction and visual hierarchy

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 18.1 | Focal point per Stratum at a rule-of-thirds point | Pass | Moon and gate/crypt-entry features sit off-center in all opened screenshots, consistent with the layout's `focal` fractions in `lib/world-layout.ts` |
| 18.2 | Background, mid-ground, foreground tiers | Pass | Sky shows cloud/star backdrop behind creatures; ground shows fence/path behind tombstones; crypt shows arches/torches behind coffins, in every opened screenshot |
| 18.3 | Leading lines toward the focal point | Pass | Crypt's archway and ground's path both draw the eye inward in all opened crypt/ground shots |
| 18.4 | One material language for controls and plaques | Pass | Name plaques (dark parchment chip with label) look identical across sky/ground/crypt/gate in every screenshot opened |
| 18.5 | Font roles, 12 px minimum, 4.5:1 contrast, legibility surfaces | Pass | Contrast checked directly against real tokens in `app/globals.css` (not estimated from pixels): `plaque-name` vs `plaque-bg-top/bottom` = 14.27/16.09, `plaque-sub` = 6.83/7.70, `iron-label` = 11.44/12.84, `chip-label` = 10.27/11.20, `chip-on-label` = 13.98/18.13, `stone-text` = 14.04, `stone-text-muted` = 9.71, `brass-text` = 11.22, `brass-text-muted` = 10.38, `tag-text` = 14.36 — all ≥ 6.8:1, comfortably over the 4.5:1 floor |
| 18.6 | One Light_Source per place; shadows and rim from it | Pass | Each opened screenshot shows a single consistent warm glow source (sky: moon top-right; ground: path lanterns; crypt: torches/center arch) |
| 18.7 | Contact_Shadow for standing Creatures, rim light for ghosts | Pass | Tombstones and coffins show grounded shadow in opened shots; ghosts show a soft rim glow |
| 18.8 | At most 4 ambient effects, all in the Effects_Table | Pass | Checked directly against `WORLD_EFFECTS` in `lib/world-effects.ts`: sky has 3 ambient effects (`star-twinkle`, `cloud-drift`, `bats`), ground has 2 (`ground-mist`, `path-lantern-flicker`), crypt has 2 (`torch-flicker`, `crypt-dust`) — all ≤ 4 |
| 18.9 | No decorative-only effects; code and table agree | Pass | `docs/EFFECTS_TABLE.md` was diffed against the live `WORLD_EFFECTS` export: all 23 ids, places, kinds, fields and ambient flags match exactly, same order |
| 18.10 | Storytelling details tied to real data | Pass | Chip counts (e.g. "3 ghosts still wander", "3 finished works at rest", "3 sealed away") match the row counts in every opened screenshot |
| 18.11 | Creatures are physical objects with mounted tags | Pass | Every creature in every opened screenshot has a plaque/tag directly below or beside it, not floating free |
| 18.12 | "Does not read as generated" | Pass | Painted textures (stone, cloth, metal) are visible and non-repeating in all opened screenshots; no visible tiling artifact in the frames opened |

## Requirement 19: Artwork across extended environments

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 19.1 | Uniform Plate scaling with focal `object-position` | Pass | Moon stays in the same relative position across 1440x900/1920x1080/360x740 sky screenshots |
| 19.2 | Intelligent Crop; upscale at most 1.75x at 1920 px | Pass | Measured directly via `skyBandGeometry`'s `crop.scale` at width 1920: 1.26x at heights 900/1080 (motion on or reduced), 1.51x at height 1440 normal motion, 1.26x at height 1440 reduced — all under the 1.75 cap (`MAX_UPSCALE` in `lib/world-art.ts`) |
| 19.3 | Bleed exceeds displacement; edge masks; no exposed edge | Pass | Fallback-edge probe (`2026-11-13-final-seam-probe.json`) reports 0 fallback edges across all 440 case entries |
| 19.4 | Only `mg-fence-tile` repeats; landmarks appear once | Pass | Single moon, single gate, single crypt entry visible per opened screenshot; no duplicated landmark |
| 19.5 | Repeated Crops varied and masked | Pass | No visibly identical repeated crop in any opened screenshot |
| 19.6 | Blend_Zones of at least 12 percent Viewport_Height | Pass | Measured directly via `computeWorldLayout`: blend-zone height is exactly 15.0% of `viewportH` (`WORLD_CONFIG.BLEND_VH = 0.15`) at every viewport tested (1440x900, 1920x1080, 390x844, 360x740) for sky, ground and crypt — above the 12% floor |
| 19.7 | Layered build; no stretched or tiled opaque Plate | Pass | No stretching artifact visible in any opened screenshot at any viewport |
| 19.8 | Continuous journey composition | Pass | Travel frame at t2200 for sky/ground/crypt shows the full app shell (header, souls counter, breadcrumb) with the place's scene continuing underneath, consistent with the single-journey design |
| 19.9 | No new image over 150 KB (name file and size if any) | Not verified | Not checked in this pass; would require inspecting `public/art/` file sizes directly, out of scope for a screenshot-based review |
| 19.10 | Crop geometry pure function with property tests | Pass | `tests/property/world-art.property.test.ts` exists and is a property test file for the crop geometry (not re-run here; presence confirmed by file listing) |
| 19.11 | Seam check (see seam table) | Pass | 0 of 248 seam measurements failed (see seam table below) |

## Requirement 20.5 extra checks

| Check | Pass/Fail | One-line justification |
|---|---|---|
| No visible Seam, stretch or edge at any scroll position | Pass | 0 seam failures and 0 fallback edges in the probe; no visible seam in any opened screenshot |
| Controls readable | Pass | All button/chip/pager labels legible in every opened screenshot at every viewport |
| Creatures grounded | Pass | Tombstones/coffins sit on visible ground/floor in every opened screenshot; ghosts hang in open sky with no floor expected |
| Empty state complete (zero ghosts / empty cemetery / empty crypt) | Pass | `final-sky-empty`, `final-ground-empty`, `final-crypt-empty` at 1440x900 (and ground-empty at 390x844) all show the correct in-character empty message with 0 counts in filter chips |
| Reduced_Motion appearance | Pass | `final-sky-ghosts-3-reduced-1440x900-d0.png` shows the same static composition as the non-reduced d0 frame, no motion artifact |
| World_Length and gap rules of Req 6 for the 3-Creature case | Pass | See gap table below; largest gap for n=3 across all three places and four viewports is 26.2% of Vh_eff, well inside a readable single screen |

## Seam table (Req 19.11)

Numbers come directly from `2026-11-13-final-seam-probe.json` (produced by task 19.1's capture run with `--seam`), not re-derived; `share` is the tool's mean-luminance difference across the 4 rows above/below each blend-zone join, as a fraction of full scale. Limit is 10%.

| Place | Blend_Zone kind | Measurements | Max share | Failures |
|---|---|---|---|---|
| sky | haze | 80 | 0.51% | 0 |
| ground | haze | 76 | 3.86% | 0 |
| ground | crossfade | 6 | 0.28% | 0 |
| crypt | stairs | 64 | 0.87% | 0 |
| crypt | arch | 22 | 0.62% | 0 |

Total: 248 seam measurements, 0 failures. Fallback edges reported: 0 (across all 440 case entries in the probe).

This closes the prior "not verified" gap from the 2026-11-12 crypt review, which had reported up to 21 failing `stairs` measurements (max 14.3%) before a fix; the current run shows 0 failures (max 0.87%), confirming that fix held.

Edge check (visual, from opened screenshots): no row or column along the viewport edge shows solid `--color-night-sky` in any sky/ground/crypt screenshot opened, at any viewport.

| Viewport | Top | Bottom | Left | Right |
|---|---|---|---|---|
| 1440x900 | clear | clear | clear | clear |
| 1920x1080 | clear | clear | clear | clear |
| 390x844 | clear | clear | clear | clear |
| 360x740 | clear | clear | clear | clear |

## 3-Creature gap table (Req 6)

Computed directly from `computeWorldLayout({ place, names: [3 names], viewportW, viewportH })`; gap is the largest distance between any two adjacent creature/feature Y-centers, as a fraction of the layout's `heightPx`.

| Place | Viewport | World_Length (Vh) | Largest vertical gap (fraction of Vh_eff) | First Creature in first screen? | Last Creature below it? | Pass/Fail |
|---|---|---|---|---|---|---|
| sky | 1440x900 | 1.5 | 0.187 | yes | yes | Pass |
| sky | 1920x1080 | 1.5 | 0.187 | yes | yes | Pass |
| sky | 390x844 | 1.5 | 0.188 | yes | yes | Pass |
| sky | 360x740 | 1.5 | 0.235 | yes | yes | Pass |
| ground | 1440x900 | 1.5 | 0.249 | yes | yes | Pass |
| ground | 1920x1080 | 1.5 | 0.256 | yes | yes | Pass |
| ground | 390x844 | 1.5 | 0.262 | yes | yes | Pass |
| ground | 360x740 | 1.5 | 0.257 | yes | yes | Pass |
| crypt | 1440x900 | 1.5 | 0.187 | yes | yes | Pass |
| crypt | 1920x1080 | 1.5 | 0.187 | yes | yes | Pass |
| crypt | 390x844 | 1.5 | 0.186 | yes | yes | Pass |
| crypt | 360x740 | 1.5 | 0.162 | yes | yes | Pass |

All 12 combinations stay well under half the viewport height for the largest single gap, and the opened screenshots for every one of these cases (sky/ground/crypt at 1440x900, 1920x1080, 360x740, plus 390x844 for crypt) confirm creatures are visibly spread across the frame with no empty majority of the screen.

## Reduced-motion notes

`final-sky-ghosts-3-reduced-1440x900-d0.png`, compared to the non-reduced `final-sky-ghosts-3-1440x900-d0.png`: identical creature positions, labels and chip counts. No visible parallax offset or drift artifact in the static frame (motion differences would only show over time, which a single still cannot capture; the two stills being visually identical at rest is the expected and correct state).

Not opened: reduced-motion stills for ground, crypt or gate. Based on the identical sky result and the shared `EnvMist`/`Atmosphere` implementation referenced in `lib/world-effects.ts`, no reduced-motion-specific regression is expected there, but this is inferred, not directly viewed.

## Travel transition notes

Only the t2200 frame was opened per place (t0 and t1150 were not opened in this pass).

| Frame | File | Looks right? | Note |
|---|---|---|---|
| ~2200 ms (sky) | `final-sky-travel-t2200-1440x900-d0.png` | yes | Full app shell with header/souls-counter/breadcrumb visible, "THE RESTLESS SKY · 4 ghosts still wander" heading and chip counts consistent with the estate's 15-soul fixture |
| ~2200 ms (ground) | `final-ground-travel-t2200-1440x900-d0.png` | yes | "HALLOWED GROUND · 3 finished works at rest", two named tombstones visible, consistent chrome |
| ~2200 ms (crypt) | `final-crypt-travel-t2200-1440x900-d0.png` | yes | "THE CRYPT · 2 sealed away", one named coffin visible, consistent chrome |

Not opened: t0 and t1150 frames for any place, and t2200 for gate. The three t2200 frames opened are internally consistent with each other (same header chrome, same breadcrumb pattern) and with the per-place d0 case shots reviewed above, so no inconsistency was found, but the full travel sequence was not visually walked frame by frame.

## Tests run in task 18 (final checkpoint), re-confirmed for this review

Re-ran the same three commands task 18 specifies, directly, rather than assuming the prior run still holds:

| Command | Result |
|---|---|
| `npx vitest --run` | 263 test files passed, 2476 tests passed, 0 failed, 0 skipped |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 0 warnings |

Test files include the explorable-worlds-specific suites named across tasks 4-17: `tests/property/world-layout-length.property.test.ts`, `tests/property/world-layout-placement.property.test.ts`, `tests/property/world-layout-structure.property.test.ts`, `tests/property/world-art.property.test.ts`, `tests/property/world-effects.property.test.ts`, `tests/property/world-motion.property.test.ts`, `tests/property/world-motion-scroll.property.test.ts`, `tests/property/contrast.property.test.ts`, `tests/unit/world-layout.test.ts`, `tests/unit/world-art.test.ts`, `tests/unit/world-effects.test.ts`, `tests/unit/world-effects-sync.test.ts`, `tests/unit/world-source-scan.test.ts`, `tests/unit/world-light.test.ts`, `tests/unit/world-motion.test.ts`, `tests/unit/world-tokens.test.ts`, `tests/unit/contrast.test.ts`, `tests/unit/review-cases.test.ts`, `tests/unit/place-pipeline.test.ts`, `tests/unit/capture-tools.test.ts`, `tests/unit/baseline-manifest.test.ts`, `tests/unit/fixture-classes.test.ts`, `tests/unit/estate-view-exports.test.ts`, plus the full pre-existing suite (badge, lifecycle, séance, scene, revive, graveyard-view, etc. — 263 files total, listed by running `Get-ChildItem tests -Recurse -Filter "*.test.ts*"`).

Property tests run with fast-check at a minimum of 100 cases per the design's convention (`Feature: explorable-worlds, Property N: <title>` tag comments); this was not re-counted file-by-file in this pass, but no property test reported fewer runs than configured, and all passed.

## Lighthouse and 50 fps scroll: left for the user (need a production build)

Per the design notes ("Lighthouse and the 50 fps scroll measurement need a production build, which tasks must not create"), this task does not run `next build`, so these two checks were not performed here. Exact steps for the user to run them:

**Lighthouse (mobile, median of 3) against `/estate`:**
1. `npm run build`
2. `npm run start` (serves the production build, default port 3000)
3. In Chrome DevTools, open the Lighthouse panel on `http://localhost:3000/estate`, set Device to "Mobile", and run the audit 3 times
4. Take the median Performance score across the 3 runs; Requirement 19 criterion 9 requires 80 or higher

**50 fps scroll measurement on a 12-Creature Plot:**
1. `/dev/review` (the harness used for the 12-Creature capture cases in this review) returns 404 once `NODE_ENV=production` (see the check in `app/dev/review/page.tsx`), so it cannot be used against the production build. Use a real `/g/[username]` graveyard that happens to have 12 or more repos in one lifecycle bucket (sky/ghost, ground/tombstone or crypt/coffin) against the production build (`npm run build && npm run start`), so the measurement reflects production performance
2. In Chrome DevTools, open the Performance panel, start a recording, scroll through the full World_Length of that place at a steady rate, then stop
3. Check the frame rate in the recorded timeline; Requirement 19 criterion 10 requires no drop below 50 fps, and no filter or animation may be removed or weakened just to pass this measurement

## Gaps closed from the 2026-11-12 "not verified" items

| Gap (from 2026-11-12 per-place reviews) | How it was closed | Result |
|---|---|---|
| World_Length / gap table not measured | Computed directly from `computeWorldLayout` for sky/ground/crypt, n ∈ {0,1,3,12}, all 4 viewports | All gaps stay under 36% of Vh_eff even in the worst single-creature mobile case; n=3 table above is clean |
| Effects_Table vs code parity (18.8/18.9) not diffed | Dumped `WORLD_EFFECTS` at runtime and compared field-by-field against `docs/EFFECTS_TABLE.md` | Exact match: 23 ids, same places/kind/field/ambient, same order |
| 1920 upscale limit (19.2) not measured | Computed `skyBandGeometry(...).crop.scale` at width 1920 across heights 900/1080/1440, reduced and normal | Max 1.51x, under the 1.75x cap |
| Blend-zone height (19.6) not measured | Computed `computeWorldLayout(...).blendZones[].height / viewportH` for sky/ground/crypt at all 4 viewports | Exactly 15.0% everywhere, above the 12% floor |
| Contrast not checked against real tokens | Parsed real hex values from `app/globals.css` and ran `contrastRatio` from `lib/contrast.ts` on every plaque/chip/stone/brass/tag text-background pair, plus `crimson-500` on `night-sky` | All pairs ≥ 3.56:1; all actual text-role pairs ≥ 5.5:1. `crimson-500` (3.56:1) is only used as a button/border fill color (`ThemedButton.tsx`, `SeanceStates.tsx`), never as small body text on `night-sky`, so it does not need to clear 4.5:1 |

No failures were found during this pass, so no feature-code fix, re-capture under `--step final2`, or iteration round was needed.

## Iteration log

| Round | Date | Fails found | Change made | Screenshots re-captured |
|---|---|---|---|---|
| 1 | 2026-11-13 | None. All screenshots opened matched their baselines or showed correct empty/reduced-motion/travel behavior; all five numeric gap-closing checks (gap table, Effects_Table parity, 1920 upscale, blend-zone height, contrast) passed against real code and data. | None required. | None required. |

## What was truly viewed vs not

**Viewed (opened with `read_file` in this pass or the prior session before summarization, and used as evidence above):**
- Hub: d0 at all 4 viewports, vs 1440x900 baseline
- Sky ghosts-3: d0/d0.5/d1 at all 4 viewports, vs 1440x900/1920x1080/360x740 baselines; empty at 1440x900; reduced at 1440x900; travel t2200 at 1440x900
- Ground tombstones-3: d0 at all 4 viewports, d0.5 at 1440x900, d1 at 1920x1080/390x844/360x740, vs 1440x900/1920x1080/360x740 baselines; empty at 1440x900 and 390x844; travel t2200 at 1440x900
- Crypt coffins-3: d0 at all 4 viewports, vs 1440x900/1920x1080 baselines; empty at 1440x900; travel t2200 at 1440x900
- Gate ghosts-3 (legacy `PlaceView`, not a `WorldPlace`): d0 at 1440x900 and 390x844

**Not viewed (exist as files but not opened, so not judged from a screenshot):**
- All `ghosts-12`/`tombstones-12`/`coffins-12` case shots
- `d0.25` and `d0.75` intermediate depths for every case
- `-reduced` stills for ground, crypt and gate (only sky's reduced still was opened)
- `t0` and `t1150` travel frames for every place; `t2200` for gate
- Crypt coffins-3 d0.5/d1 at 390x844/360x740 (filenames exist, not opened)
- Baselines for crypt and gate at 390x844/360x740, and for gate at 1920x1080

These gaps are in depth/case/motion coverage breadth, not in the five numerical checks (gap table, Effects_Table, upscale, blend zone, contrast), which were measured exhaustively against the real code rather than sampled from screenshots.

## Verdict

- Any fail remaining: no
- Does the result look better than the original against Requirements 18 and 19: yes — every opened final screenshot shows richer backdrop art (stars, moon, fence, path, torches, chains) than the corresponding 2026-11-12 baseline while preserving the same creature positions, labels and counts
- Verdict: PASS
- User sign-off (final review only): not requested in this task (reserved for task 19.3)

## Sign-off

- Date: 2026-11-13
- Who: the user
- Decision: approved ("Sign off: approved"), given in the conversation after reviewing this document (verdict PASS; 263 test files / 2476 tests passing, `tsc` and `eslint` clean)
- Still open, user-run steps: the Lighthouse audit (mobile, median of 3, `/estate`) and the 50 fps scroll measurement on a 12-Creature Plot both need a production build and have not been performed. Their steps are in the "Lighthouse and 50 fps scroll" section above.
- Coverage note: the "Not viewed" screenshot list above stands. Those files were not opened and were not judged from a screenshot, and the approval does not change that.
