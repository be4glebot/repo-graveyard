# Visual Review: crypt (crypt)

- Date: 2026-11-12
- Place: crypt
- Step: crypt
- Tool: `docs/design-review/tools/capture.mjs --step crypt --places crypt --cases coffins-3,empty,coffins-12 --depths 0,0.25,0.5,0.75,1 --reduced --travel --seam`
- Commit / change set: working tree, task 16.2 (seam fixes in `components/world/CryptArt.tsx`)

## Method statement

This judgement was made by the agent from the stored screenshots listed below, with the written critique in this file. Automated tests alone do not establish visual quality (Req 20.7).

## Screenshots reviewed

Opened with read_file. Naming: `2026-11-12-crypt-crypt-<case>[-reduced]-<WxH>-d<d>.png`.

- coffins-3: 1440x900 d0, d0.25, d0.5, d0.75, d1; 390x844 d0, d1; 1920x1080 d0; 360x740 d0; reduced 1440x900 d0.5
- coffins-12: 1440x900 d0, d0.25, d0.5, d1; 390x844 d0, d0.5, d1; 1920x1080 d0; 360x740 d0; reduced 1440x900 d0.5
- empty: 1440x900 d0; 390x844 d0; reduced 1440x900 d0.5 (this shot renders the Haunted Estate hub strip above a zoomed-out crypt chamber, not the single-place `/g/[username]` Crypt view the other shots use — see the note under Reduced_Motion below)
- travel: `2026-11-12-crypt-crypt-travel-t1150-1440x900-d0.png` (normal motion)
- baseline: `2026-11-12-baseline-crypt-coffins-3-1440x900.png`

NOT viewed (so not judged visually): the other depths (d0.25, d0.75) of coffins-12 at non-1440 viewports, coffins-3 and coffins-12 at 1920x1080/360x740 for depths other than d0, empty at 1920x1080/360x740, the t0 and t2200 travel frames, every reduced-motion travel frame, and the baselines for coffins-12 and empty. They exist on disk. The seam probe (numeric, all 120 entries) covers every case, viewport, depth and motion mode regardless of whether the screenshot was opened.

## Side by side with the baseline

| Case | Viewport | Baseline file | New file (d0 / d0.5 / d1) | Better than the original? | Note |
|---|---|---|---|---|---|
| coffins-3 | 1440x900 | `2026-11-12-baseline-crypt-coffins-3-1440x900.png` | `...coffins-3-1440x900-d0/d0.5/d1.png` | yes | The original is one flat, evenly lit chamber with "sealed" text tags and no leading lines. The new version opens on an arch and descending stairs, moves through a tinted chamber with torches and dust, and ends in a second chamber; it reads as a descent rather than a static room. |
| coffins-3 | 1920x1080 | not compared | `...coffins-3-1920x1080-d0.png` | not judged against baseline | Looks coherent on its own; arch and stairs scale with the wider frame with no stretching. |
| coffins-3 | 390x844 | not compared | `...390x844-d0/d1` | not judged against baseline | Coherent; chamber 2 (d1) keeps its torches and tint at the narrow width. |
| coffins-3 | 360x740 | not compared | `...360x740-d0` | not judged against baseline | Coherent at the narrowest width. |

Only one baseline was opened (coffins-3 at 1440x900). "Better than the original" is judged for that case/viewport only.

## Requirement 18: Art direction and visual hierarchy

Rows are judged from the shots listed above only.

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 18.1 | Focal point per Stratum at a rule-of-thirds point | Pass | The entry's arch opening sits at top-centre; each chamber's torch pair and coffin cluster sit lower-centre, close to a rule-of-thirds point in the viewed shots. |
| 18.2 | Background, mid-ground, foreground tiers | Pass | Background is the painted `place-crypt` Crop per chamber (tinted, lower detail); mid-ground holds the arch, stairs, torches and coffins at full contrast; foreground is the dark rail edge at the entry and the chain-shadow in chamber 1, both kept to the frame edges. |
| 18.3 | Leading lines toward the focal point | Pass | The stair treads and the arch's elliptical opening both point down and inward toward the chamber beyond, visible in coffins-3 and coffins-12 at every viewed depth. |
| 18.4 | One material language for controls and plaques | Pass | The nav buttons, pager and coffin tags are all dark stone/iron plaques with tan Cinzel-style text, matching the gate and ground reviews. |
| 18.5 | Font roles, 12 px minimum, 4.5:1 contrast, legibility surfaces | Pass (visual only) | Tags, heading and pager are legible on dark plaques in every viewed shot. Contrast ratios and the 12 px minimum were not measured here. |
| 18.6 | One Light_Source per place; shadows and rim from it | Pass | Torches provide one warm key light per chamber; the ambient darkness overlay shades consistently from that key. No second light direction was seen. |
| 18.7 | Contact_Shadow for standing Creatures | Pass | Coffins sit on a dark contact shadow in every viewed shot. |
| 18.8 | At most 4 ambient effects, all in the Effects_Table | Not verified | The Effects_Table was not compared against the code in this pass. |
| 18.9 | No decorative-only effects; code and table agree | Not verified | As above. |
| 18.10 | Storytelling details tied to real data | Pass | Chain-shadow on chamber 1 and the "N sealed away" subtitle reflect real coffin counts; torch and tint placement follow the chamber index, not randomness. |
| 18.11 | Creatures are physical objects with mounted tags | Pass | Coffin tags sit directly under each coffin and move with it across the viewed depths; no floating label was seen. |
| 18.12 | "Does not read as generated" | Pass | Chambers differ in tint and crop (chamber-1 warm, chamber-2 flipped and cool, chamber-3 offset per `cryptSpecFor`); torch glows are not uniform bloom; no gradient-only panel stands in for a coffin. |

## Requirement 19: Artwork across extended environments

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 19.1 | Uniform Plate scaling with focal `object-position` | Pass (visual only) | No stretching seen in the viewed shots at any viewport, including 1920x1080 and 360x740. |
| 19.2 | Intelligent Crop; upscale at most 1.75x at 1920 px | Not verified | The upscale ratio was not measured; the 1920x1080 shot viewed looked proportionate by eye. |
| 19.3 | Bleed exceeds displacement; edge masks; no exposed edge | Pass | No exposed Plate edge in the viewed shots; the seam probe's `fallbackEdges` is empty for all 120 entries, meaning no solid `--color-night-sky` edge was detected at any viewport or depth. |
| 19.4 | Only `mg-fence-tile` repeats; landmarks appear once | Pass | The crypt uses no `mg-fence-tile`; no other tile or repeat was seen. Arch and stairs render once at the entry only. |
| 19.5 | Repeated Crops varied and masked | Pass | `cryptSpecFor` flips chamber-2 and offsets chamber-3 (and alternates flip/offset beyond that per the code), and the viewed chamber-1/chamber-2 shots in coffins-12 read as distinct scenes, not a repeat. |
| 19.6 | Blend_Zones of at least 12 percent Viewport_Height | Not verified | Zone height was not measured against `WORLD_CONFIG.BLEND_VH` in this pass. |
| 19.7 | Layered build; no stretched or tiled opaque Plate | Pass | Background Crop, mid-ground arch/stairs/torches/dust, and foreground rail/chain layers are visibly separate; no opaque Plate was stretched across the full World_Length. |
| 19.8 | Continuous journey composition | Pass | Entry (arch + stairs) into chamber 1 (warm) into chamber 2 (cool, flipped) reads as a descent, confirmed in the coffins-12 shots across d0/d0.5/d1. |
| 19.9 | No new image over 150 KB | Pass | This step added no new image file; the stair/arch/zone changes are CSS gradients and masks only (`STAIR_MASK`, `ZONE_MASK`, the softened `STAIR_STEPS` gradient). |
| 19.10 | Crop geometry pure function with property tests | Not checked here | Not part of this visual pass. |
| 19.11 | Seam check | Pass | See the seam table below. Max 0.83 percent against a 10 percent limit, down from 21 failing measurements (worst 14.3 percent) before this task's fix. |

## Requirement 20.5 extra checks

| Check | Pass/Fail | One-line justification |
|---|---|---|
| No visible Seam, stretch or edge at any scroll position | Pass for the viewed shots and for the full probe | No seam band was visible by eye in any viewed shot (including the narrow 360x740/390x844 shots that previously failed the probe at up to 14.3 percent). The numeric probe confirms this for all 120 entries (0 fails, max 0.83 percent). |
| Controls readable | Pass | Nav, pager, heading and coffin tags stayed legible on the dark chamber art in every viewed shot. |
| Creatures grounded | Pass | Coffins sit on their contact shadows in every viewed shot; none appear to float. |
| Empty state complete | Partial | `empty` 1440x900 d0 and 390x844 d0 show "NO COFFINS LIE SEALED HERE" with no stray stair/arch artifact. The `empty-reduced` 1440x900 d0.5 shot unexpectedly rendered the Haunted Estate hub view (header strip with ghost/zombie/tombstone counts, a lone coffin) rather than the single-place Crypt empty state the other `empty` shots show — likely a capture routing quirk for that specific flag combination, not a code issue confirmed here; flagging rather than asserting a cause. |
| Reduced_Motion appearance | Partial | coffins-3 and coffins-12 reduced 1440x900 d0.5 were viewed and look static and consistent with the normal shots (torches don't flicker, dust layers hold still). The `empty-reduced` shot is the anomaly noted above and was not usable for judging the empty reduced state. |
| World_Length and gap rules of Req 6 for the 3-Creature case | Not verified | Not measured from screenshots or layout tests in this pass. |

## Seam table (Req 19.11)

Source: `docs/design-review/2026-11-12-crypt-seam-probe.json` (probe share = luminance difference across a join as a share of full scale; limit 10 percent). Values below are the maximum over all probed depths (0, 0.25, 0.5, 0.75, 1) for each zone / case / viewport combination, taken from all 120 entries (post-fix capture).

| Blend_Zone join | Case / viewport | Max diff | Pass/Fail |
|---|---|---|---|
| stairs | coffins-3, 1440x900 | 0.39% | Pass |
| stairs | coffins-3, 1920x1080 | 0.26% | Pass |
| stairs | coffins-3, 390x844 | 0.59% | Pass |
| stairs | coffins-3, 360x740 | 0.83% | Pass |
| stairs | coffins-3-reduced, 1440x900 / 1920x1080 / 390x844 / 360x740 | 0.29% / 0.19% / 0.54% / 0.66% | Pass |
| stairs | coffins-12, 1440x900 / 1920x1080 / 390x844 / 360x740 | 0.33% / 0.24% / 0.40% / 0.43% | Pass |
| stairs | coffins-12-reduced, 1440x900 / 1920x1080 / 390x844 / 360x740 | 0.25% / 0.27% / 0.41% / 0.56% | Pass |
| arch | coffins-12, 1440x900 / 1920x1080 / 390x844 / 360x740 | 0.17% / 0.15% / 0.38% / 0.52% | Pass |
| arch | coffins-12-reduced, 1440x900 / 1920x1080 / 390x844 / 360x740 | 0.28% / 0.29% / 0.62% / 0.56% | Pass |
| none (single Stratum, no join) | empty, all viewports, normal and reduced | no joins probed | Pass |

Per-depth values are in the JSON; they were not copied here. Total: 0 of 120 entries fail (down from 21 failing `stairs` measurements before the fix, worst 14.3 percent, recorded in `2026-11-12-crypt-capture-notes.md`).

Edge check: `fallbackEdges` is empty for all 120 entries, meaning no solid `--color-night-sky` edge was detected at any case, viewport, depth or motion mode. By eye, no solid edge was seen in the shots viewed. A per-edge table was not produced.

Per-Stratum visual check: not done per Stratum individually. Overall, no stretch or unintended repeat was visible in the viewed shots; the chamber Crops differ from each other per `cryptSpecFor`'s flip/offset rule.

## 3-Creature gap table (Req 6)

Not verified in this review. World_Length and vertical gaps were not measured from the screenshots, and the layout tests for it were not run here. In the viewed coffins-3 shots, the first coffin (lantern-api) is visible at d0 near the entry and the chain-shadow/chamber contents are reached by d1.

## Reduced-motion notes

coffins-3 and coffins-12 reduced 1440x900 d0.5 were viewed: both show static torch glow and static dust, with no visible drift, consistent with the normal-motion shot at the same depth. The `empty-reduced` shot rendered the Haunted Estate hub rather than the single-place Crypt empty state (see the Req 20.5 table) and was not usable for that specific case. Other reduced shots (other depths, other viewports) were not opened.

## Travel transition notes

Only the ~1150 ms normal-motion frame at 1440x900 was viewed.

| Frame | File | Looks right? | Note |
|---|---|---|---|
| ~0 ms | `...travel-t0-1440x900-d0.png` | not viewed | |
| ~1150 ms | `...travel-t1150-1440x900-d0.png` | yes | Mid-transition into the crypt. The estate header overlays the scene as expected during travel, with no tearing in the arch, stairs or chamber art. |
| ~2200 ms | `...travel-t2200-1440x900-d0.png` | not viewed | |

## Iteration log

| Round | Date | Fails found | Change made | Screenshots re-captured |
|---|---|---|---|---|
| 1 | 2026-11-12 | 21 `stairs` seam measurements failing (worst 14.3%, limit 10%); seam sat right at the stair band's hard-edged bottom where the darkness gradient held full opacity to the bottom instead of fading out. | Changed the darkness gradient from fading straight to opaque to `transparent, rgb(0 0 0 / 0.55) 50%, transparent` so it dissolves before the band edge. | Targeted coffins-3 recapture, `--seam` only |
| 2 | 2026-11-12 | Seam still present at the stair tread's own hard mask edge (the old mask only faded the left/right sides, not the bottom). | Replaced the single horizontal-fade stair mask with `STAIR_MASK`: a two-layer mask (`linear-gradient` horizontal fade intersected with a vertical fade, `black 0, black 45%, transparent 92%`), via `maskComposite: intersect`. | Targeted coffins-3 recapture, `--seam` only |
| 3 | 2026-11-12 | Residual seam at the Blend_Zone overlay's own top/bottom edges (the overlay itself had no vertical fade). | Added `bandMask(fadeTop, fadeBottom)` to the mid/fg band wrappers and a new `ZONE_MASK` (`transparent, black 30%, black 70%, transparent`) to the Blend_Zone overlay div. | Full crypt set, `--seam --travel --reduced` |
| 4 | 2026-11-12 | The stair tread's own repeating-gradient texture still read as a slightly harsh line under close inspection (not failing the probe but visually sharper than the surrounding art). | Softened the `STAIR_STEPS` repeating-linear-gradient with `filter: blur(2px)` and `opacity: 0.55`. | Full crypt set, `--seam --travel --reduced` |

Final state: 0 of 120 seam measurements fail; max share is 0.83 percent against the 10 percent limit (previously 21 fails, worst 14.3 percent).

`tests/dom/CryptArt.test.tsx`, `tests/dom/WorldCryptWiring.test.tsx` and `tests/dom/WorldCrypt.test.tsx` all pass after the round-4 change. No test assertion was changed in any of these files.

## Verdict

- Any fail remaining among the items I checked: no
- Items not verified: 18.8, 18.9, 19.2, 19.6, 19.10, the Req 6 gap table
- Items partially verified: the empty state and Reduced_Motion rows, because the `empty-reduced` capture returned the Haunted Estate hub view instead of the single-place Crypt empty state; the other empty/reduced shots that were opened show no issue
- Does the result look better than the original against Requirements 18 and 19: yes, for coffins-3 at 1440x900, the only baseline opened. The flat single-chamber original with text-tag coffins and no leading lines is replaced by an arch-and-stairs entry into tinted, torch-lit chambers.
- Verdict: PASS for what was viewed and measured, with 0 seam failures remaining. This is a partial review: the not-verified items above, and the empty-reduced capture anomaly, need a follow-up before the step is treated as fully signed off.
- User sign-off (final review only): n/a
