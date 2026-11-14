# Visual Review: ground (ground)

- Date: 2026-11-12
- Place: ground
- Step: ground
- Tool: `docs/design-review/tools/capture.mjs --step ground --places ground --cases tombstones-3,empty,tombstones-12 --depths 0,0.25,0.5,0.75,1 --reduced --travel --seam`
- Commit / change set: working tree, task 13.2 (fixes in `components/world/GroundArt.tsx`)

## Method statement

This judgement was made by the agent from the stored screenshots listed below, with the written critique in this file. Automated tests alone do not establish visual quality (Req 20.7).

## Screenshots reviewed

Opened with read_file (final state unless marked "pre-fix"). Naming: `2026-11-12-ground-ground-<case>[-reduced]-<WxH>-d<d>.png`.

- tombstones-3: 1440x900 d0, d0.5, d1 (d0 and d1 re-viewed after the last fix); 390x844 d0, d1; 1920x1080 d0 (pre-fix); 360x740 d0 (after fix round 1)
- tombstones-12: 1440x900 d0, d0.5, d1; 390x844 d0, d0.5; 1440x900 reduced d0.5; 1440x900 d0.5 re-viewed after the last fix
- empty: 1440x900 d0 and 390x844 d0 (after fix round 2)
- travel: `2026-11-12-ground-ground-travel-t1150-1440x900-d0.png` (normal motion)
- baseline: `2026-11-12-baseline-ground-tombstones-3-1440x900.png`

NOT viewed (so not judged): the other depths (d0.25, d0.75) of every case, all 1920x1080 and 360x740 shots after the final fix, the t0 / t2200 travel frames, all reduced-motion travel frames, and the baselines for tombstones-12 and empty. They exist on disk. The seam probe (numeric) covers every case and viewport.

## Side by side with the baseline

| Case | Viewport | Baseline file | New file (d0 / d0.5 / d1) | Better than the original? | Note |
|---|---|---|---|---|---|
| tombstones-3 | 1440x900 | `2026-11-12-baseline-ground-tombstones-3-1440x900.png` | `...tombstones-3-1440x900-d0/d0.5/d1.png` | yes | Layered fence, haze, path, mausoleum and fog now read as a journey. |
| tombstones-3 | 1920x1080 | not compared | `...tombstones-3-1920x1080-d0.png` (pre-fix only) | not judged | Pre-fix shot only. |
| tombstones-3 | 390x844 | not compared | `...390x844-d0/d1` | not judged against baseline | Looks coherent on its own. |
| tombstones-3 | 360x740 | not compared | `...360x740-d0` (after round 1) | not judged against baseline | |

Only one baseline was opened. "Better than the original" is therefore judged for tombstones-3 at 1440x900 only.

## Requirement 18: Art direction and visual hierarchy

Rows are judged from the shots listed above only.

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 18.1 | Focal point per Stratum at a rule-of-thirds point | Pass | The gate sits at the top centre at d0, the mausoleum at the lower centre at d1 (tombstones-12). |
| 18.2 | Background, mid-ground, foreground tiers | Pass | Fence and haze, then the grass with path and stones, then tombstones and near fog. |
| 18.3 | Leading lines toward the focal point | Pass | The flagstone path runs from the gate down to the mausoleum. |
| 18.4 | One material language for controls and plaques | Pass | Dark stone plaques with tan Cinzel text across the nav, the zone tooltip and the name tags. |
| 18.5 | Font roles, 12 px minimum, 4.5:1 contrast, legibility surfaces | Pass (visual only) | Tags and nav are legible on dark plaques. Contrast ratios and the 12 px minimum were not measured. |
| 18.6 | One Light_Source per place; shadows and rim from it | Pass | Candles on stones and lantern orbs share a warm key; the highlight on each flagstone is lit from the top left. |
| 18.7 | Contact_Shadow for standing Creatures | Pass | Tombstones sit on a dark base shadow. |
| 18.8 | At most 4 ambient effects, all in the Effects_Table | Not verified | The Effects_Table was not compared against the code in this pass. |
| 18.9 | No decorative-only effects; code and table agree | Not verified | As above. |
| 18.10 | Storytelling details tied to real data | Pass | Name tags, stone size and moss, and the "12 finished works at rest" count come from the data. |
| 18.11 | Creatures are physical objects with mounted tags | Pass | Tags are mounted and tilted at about ±6°. They stay legible; "COBWEB-SCHEDULER-SER…" is truncated with an ellipsis. |
| 18.12 | "Does not read as generated" | Pass after round 2 | Round 1 read as flat pale discs. They now have a lit edge, a dark seam and a body tone. Lantern orbs still float slightly above the path. |

## Requirement 19: Artwork across extended environments

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 19.1 | Uniform Plate scaling with focal `object-position` | Pass (visual only) | No stretching seen in the viewed shots. |
| 19.2 | Intelligent Crop; upscale at most 1.75x at 1920 px | Not verified | The 1920 shots were not re-viewed and the upscale ratio was not measured. |
| 19.3 | Bleed exceeds displacement; edge masks; no exposed edge | Pass (viewed shots) | No solid edge in the viewed shots. fallbackEdges is 0 in every probe case. |
| 19.4 | Only `mg-fence-tile` repeats; landmarks appear once | Pass | The fence repeats; the gate and mausoleum each appear once. |
| 19.5 | Repeated Crops varied and masked | Pass | No repeated Crop seen. |
| 19.6 | Blend_Zones of at least 12 percent Viewport_Height | Not verified | Zone height was not measured. Blend quality is judged under 19.11. |
| 19.7 | Layered build; no stretched or tiled opaque Plate | Pass | |
| 19.8 | Continuous journey composition | Pass | Gate to haze to path to mausoleum is continuous. |
| 19.9 | No new image over 150 KB | Pass | No file under `public/art` is over 150 KB. |
| 19.10 | Crop geometry pure function with property tests | Not checked here | Not part of the visual pass. |
| 19.11 | Seam check | Pass | See the seam table. Max 3.86 percent against a 10 percent limit. |

## Requirement 20.5 extra checks

| Check | Pass/Fail | One-line justification |
|---|---|---|
| No visible Seam, stretch or edge at any scroll position | Pass for the viewed shots | A hard horizontal band at about y=690 in the first 390x844 shot (pre-fix) is gone in the final 390x844 d0 and d0.5. I did not identify what caused it or what removed it. The probe is clean. |
| Controls readable | Pass | Nav and tooltip plaques are readable. The zone tooltip can cover part of a tombstone at the right edge. |
| Creatures grounded | Pass | |
| Empty state complete | Partial | Empty 1440 and 390 d0 were checked after the fix. The ribbon and lanterns no longer paint over the plaque copy. Zero ghosts and empty crypt are other places and were not reviewed here. |
| Reduced_Motion appearance | Partial | One reduced shot viewed (tombstones-12 1440 d0.5): static and consistent. |
| World_Length and gap rules of Req 6 for the 3-Creature case | Not verified | See the gap table. |

## Seam table (Req 19.11)

Source: `docs/design-review/2026-11-12-ground-seam-probe.json` (probe share = luminance difference across a join as a share of full scale; limit 10 percent). Each row is the maximum over all probed depths 0 to 1.

| Blend_Zone join | Case / viewport | Max diff | Pass/Fail |
|---|---|---|---|
| haze | tombstones-3 1440x900 | 0.10% | Pass |
| haze | tombstones-3 1920x1080 | 0.53% | Pass |
| haze | tombstones-3 390x844 | 0.77% | Pass |
| haze | tombstones-3 360x740 | 1.93% | Pass |
| haze | tombstones-3 reduced (1440 / 1920 / 390 / 360) | 0.39% / 0.50% / 1.12% / 1.84% | Pass |
| crossfade + haze | tombstones-12 1440x900 | 0.40% | Pass |
| haze | tombstones-12 1920x1080 / 390x844 / 360x740 | 0.16% / 0.80% / 2.57% | Pass |
| crossfade + haze | tombstones-12 reduced 1440x900 | 3.86% | Pass |
| haze | tombstones-12 reduced 1920 / 390 / 360 | 0.31% / 1.28% / 2.32% | Pass |
| none (single Stratum, no join) | empty, all viewports, normal and reduced | no joins probed | Pass |

Per-depth values are in the JSON. They were not copied here.

Edge check: the probe reports `fallbackEdges` empty for all 24 case and viewport combinations, which means no solid `--color-night-sky` edge was detected. By eye, no solid edge was seen in the shots I viewed. A per-edge table was not produced.

Per-Stratum visual check: not done per Stratum. Overall, no stretch or repeat was visible in the viewed shots other than the intended fence tiling.

## 3-Creature gap table (Req 6)

Not verified in this review. I did not measure World_Length or vertical gaps from the screenshots, and I did not run the layout tests for it. Check the layout unit and property tests before treating Req 6 as covered. In the tombstones-3 shots, the first tombstone is in the first screen and the mausoleum is reached below the last tombstone at d1.

## Reduced-motion notes

Only tombstones-12 1440x900 reduced d0.5 was viewed. It shows static fog and no visible drift or parallax offset, and it looks consistent with the normal shot. The other reduced shots were not opened.

## Travel transition notes

Only the ~1150 ms normal-motion frame at 1440x900 was viewed.

| Frame | File | Looks right? | Note |
|---|---|---|---|
| ~0 ms | `...travel-t0-1440x900-d0.png` | not viewed | |
| ~1150 ms | `...travel-t1150-1440x900-d0.png` | yes | Mid-transition. The fence and the path are drawn with no tear. The HUD shows the estate header over the ground, as expected during travel. |
| ~2200 ms | `...travel-t2200-1440x900-d0.png` | not viewed | |

## Iteration log

| Round | Date | Fails found | Change made | Screenshots re-captured |
|---|---|---|---|---|
| 1 | 2026-11-12 | Flagstones vanished against the grass (near-black stone colour). | `STONE_COLOR` is now a candle-tan `color-mix` (34 percent). | Full ground set |
| 2 | 2026-11-12 | Flagstones read as blurred discs at 34 percent. The path ribbon and lanterns painted over the empty-cemetery plaque. | Flat ellipse gradient, 22 percent mix. Ribbon and lanterns suppressed when `layout.slots.length === 0`. | Full ground set |
| 3 | 2026-11-12 | Stones still read as flat pale ovals (18.12). | Each stone has a top-left highlight, a body tone and a dark seam. | Full ground set |

`tests/dom/GroundArt.test.tsx` passes after round 3 (10 tests). No test assertion was changed. I only ran that one test file.

## Verdict

- Any fail remaining among the items I checked: no
- Items not verified: 18.8, 18.9, 19.2, 19.6, the Req 6 gap table, and the shots listed under "NOT viewed"
- Does the result look better than the original against Requirements 18 and 19: yes for tombstones-3 at 1440x900, the only baseline I compared
- Verdict: PASS for what was viewed and measured. This is a partial review: the not-verified items above need a follow-up before the step is treated as fully signed off.
- User sign-off (final review only): n/a
