# Visual Review: Hub and gate (Step 1, foundation)

- Date: 2026-11-12
- Place: hub (and the gate, as the only place a world could be shown against the baseline)
- Step: Step 1 foundation
- Tool: `docs/design-review/tools/capture.mjs` (rounds `step1` and `step1r2`)
- Commit / change set: Step 1 foundation (tasks 1 to 6) plus the Header wrap fix from round 1 of the iteration log

## Method statement

This judgement was made by the agent from the stored screenshots listed below, with the written critique in this file. Automated tests alone do not establish visual quality (Req 20.7). Anything I did not open is marked "not viewed". Nothing was measured by pixel tools: luminance, contrast ratios and seam numbers are NOT measured, so those rows say so.

Important context: at the end of Step 1 no place is switched to a world yet. The Hub and the gate render with the original components, so the expected result is "same as the baseline, no regression". Criteria that need a world (drift, seams, blend zones, crops, World_Length, empty Landmark) are marked N/A until Steps 2 to 5.

## Screenshots reviewed

Opened and looked at:

- Baseline: `2026-11-12-baseline-hub-ghosts-3-1440x900.png`, `-390x844.png`; `2026-11-12-baseline-gate-ghosts-3-1440x900.png`, `-390x844.png`
- Step 1 Hub: `step1-hub-ghosts-3-1440x900-d0.png`, `-d1.png`; `step1-hub-ghosts-3-390x844-d0.png`; `step1-hub-ghosts-3-reduced-360x740-d0.png`
- Step 1 gate: `step1-gate-ghosts-3-1440x900-d0.png`, `-d0.5.png`, `-d1.png`; `step1-gate-ghosts-3-390x844-d0.png`, `-d1.png`; `step1-gate-ghosts-12-1440x900-d0.png`; `step1-gate-empty-1440x900-d0.png`
- Travel: `step1-gate-travel-t0-1440x900-d0.png`, `t1150`, `t2200`, and `step1-gate-travel-t1150-reduced-1440x900-d0.png`
- Round 2 (after fix): `step1r2-hub-ghosts-3-390x844-d0.png`, `step1r2-hub-ghosts-3-360x740-d0.png`

Not viewed (exist on disk, not judged): all 1920x1080 files, all 360x740 gate files, `-d0.5` Hub files, the other reduced files, the other travel frames (t0/t2200 reduced, and all 390/360/1920 travel frames), `step1r2-gate-*`. Conclusions about those are not made.

## Side by side with the baseline

| Case | Viewport | Baseline file | New file (d0 / d0.5 / d1) | Better than the original? | Note |
|---|---|---|---|---|---|
| hub ghosts-3 | 1440x900 | baseline-hub-ghosts-3-1440x900 | step1 d0 viewed, d1 viewed, d0.5 not viewed | same (no regression) | d0 is the baseline composition. d1 is the page scrolled about 35 px; nothing breaks. |
| hub ghosts-3 | 1920x1080 | baseline file | not viewed | not judged | |
| hub ghosts-3 | 390x844 | baseline-hub-ghosts-3-390x844 | d0 viewed (round 1), step1r2 d0 viewed | yes (after fix) | Round 1 was identical to the baseline: the Menu button covered the "Haunted Estate" badge. Fixed in round 1 of the log. |
| hub ghosts-3 | 360x740 | not viewed | reduced d0 and step1r2 d0 viewed | yes (after fix) | Same overlap before the fix; the badge now wraps under the wordmark. |
| gate ghosts-3 | 1440x900 | baseline-gate-ghosts-3-1440x900 | d0, d0.5, d1 viewed | same | d0.5 and d1 equal d0, so the gate does not scroll yet. d0 shows bolder filter chips and return button than d0.5 and d1 (see notes). |
| gate ghosts-3 | 1920x1080 | baseline file | not viewed | not judged | |
| gate ghosts-3 | 390x844 | baseline-gate-ghosts-3-390x844 | d0, d1 viewed | same | Layout matches. In the baseline shot the controls look bolder than in step1, the reverse of desktop. |
| gate ghosts-3 | 360x740 | not viewed | not viewed | not judged | |

## Requirement 18: Art direction and visual hierarchy

Judged on what Step 1 can show (Hub and unswitched gate).

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 18.1 | Focal point per Stratum at a rule-of-thirds point | N/A | Worlds not switched; the Hub keeps the gate arch as its focal point, as in the baseline. |
| 18.2 | Background, mid-ground, foreground tiers | N/A | No world yet; Hub and gate show the original three plates, unchanged. |
| 18.3 | Leading lines toward the focal point | N/A | Not yet; the gate path still leads to the gate at 1440. |
| 18.4 | One material language for controls and plaques | Pass | Hub plaques, filter chips, return and pager share the dark glass, gold-edge look in all viewed shots. |
| 18.5 | Font roles, 12 px minimum, 4.5:1 contrast, legibility surfaces | Not verified | Font roles are right (blackletter, Cinzel, IM Fell, mono). Contrast was not measured. The "Open the gate" crimson text and the "Restless Sky" plaque look low-contrast to my eye; this is unchanged from the baseline, so I recorded it as a risk for Step 2 and not a Step 1 fail. |
| 18.6 | One Light_Source per place | N/A | Not yet applicable. |
| 18.7 | Contact_Shadow, rim light | N/A | Creature art is unchanged. |
| 18.8 | At most 4 ambient effects, all in the Effects_Table | Not verified | Could not be read from stills. |
| 18.9 | No decorative-only effects; code and table agree | Not verified | Covered by the unit tests, not by the pictures. |
| 18.10 | Storytelling details tied to real data | Pass | Hub shows the "turns in 15 days" notice, the whisper about dusk-scheduler, plaques with counts. |
| 18.11 | Creatures are physical objects with mounted tags | Pass | Gate creatures keep their name plaques with state in every viewed gate shot. |
| 18.12 | "Does not read as generated" | Pass | The painted Hub and gate read as a single hand-made piece; no new art was added in Step 1. |

## Requirement 19: Artwork across extended environments

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 19.1 | Uniform Plate scaling with focal `object-position` | N/A | No world plates in use yet. |
| 19.2 | Intelligent Crop; upscale at most 1.75x at 1920 px | N/A | |
| 19.3 | Bleed exceeds displacement; edge masks; no exposed edge | N/A | Original backdrops: no exposed edge seen at 1440 or 390. |
| 19.4 | Only `mg-fence-tile` repeats; landmarks appear once | N/A | |
| 19.5 | Repeated Crops varied and masked | N/A | |
| 19.6 | Blend_Zones of at least 12 percent Viewport_Height | N/A | |
| 19.7 | Layered build; no stretched or tiled opaque Plate | N/A | |
| 19.8 | Continuous journey composition | N/A | |
| 19.9 | No new image over 150 KB | N/A | No image added in Step 1 (not re-checked by listing `public/art/`; pinned by the source-scan test later in task 17.2). |
| 19.10 | Crop geometry pure function with property tests | N/A | Tests, not pictures. |
| 19.11 | Seam check | N/A | No joins exist yet. |

## Requirement 20.5 extra checks

| Check | Pass/Fail | One-line justification |
|---|---|---|
| No visible Seam, stretch or edge at any scroll position | Pass (limited) | Hub d0 and d1 at 1440, gate d0/d0.5/d1 at 1440 and d0/d1 at 390 show no seam or exposed edge. 1920 and 360 gate not viewed. |
| Controls readable | Pass (after fix) | Round 1 failed at 390 and 360: Menu covered the Haunted Estate badge. Round 2 shots show both separate. The disabled pager and zero-count chips are dim by design. The dev "N" indicator and "1 Issue" pill cover the whisper text and the mobile Nearer button; they exist only in `next dev`, not in the product. |
| Creatures grounded | Pass | Zombies and ghosts on the gate and Hub keep their feet, bases and name plaques as in the baseline. Contact shadows are not part of Step 1. |
| Empty state complete (zero ghosts / empty cemetery / empty crypt) | N/A | `gate-empty` shows the original empty gate (the plain backdrop and 0-count chips). The new empty Landmark arrives with the place steps. The harness has no empty Hub case, since `/estate` is a fixed fixture. |
| Reduced_Motion appearance | Pass (limited) | Hub reduced at 360 and gate travel t1150 reduced at 1440 look static and complete. Other reduced shots not viewed. |
| World_Length and gap rules of Req 6 for the 3-Creature case | N/A | The gate is not a world yet, so there is no length to judge; the 3-creature gate fits one screen. |

## Seam table (Req 19.11)

N/A in Step 1: no Blend_Zone exists, and I did not measure luminance. Edge check, by eye only:

| Viewport | Top | Bottom | Left | Right |
|---|---|---|---|---|
| 1440x900 | no solid night-sky band seen | none | none | none |
| 1920x1080 | not viewed | not viewed | not viewed | not viewed |
| 390x844 | none | none | none | none |
| 360x740 | none (hub only) | none (hub only) | none | none |

Per-Stratum visual check: N/A, there are no Strata yet.

## 3-Creature gap table (Req 6)

N/A for Step 1: the gate does not use a world. Rows are filled in at Step 2 to Step 5.

| Viewport | World_Length (Vh) | Largest vertical gap (Vh) | First Creature in first screen? | Last Creature below it? | Pass/Fail |
|---|---|---|---|---|---|
| 1440x900 | N/A | N/A | N/A | N/A | N/A |
| 1920x1080 | N/A | N/A | N/A | N/A | N/A |
| 390x844 | N/A | N/A | N/A | N/A | N/A |
| 360x740 | N/A | N/A | N/A | N/A | N/A |

## Reduced-motion notes

Hub at 360x740 with reduced motion: static, fully composed, no half-faded elements. Gate travel at about 1150 ms reduced (1440): the gate is already in place with its heading and chips, with no mist, so the crossfade is short as intended. Not viewed: reduced gate shots and 1920.

## Travel transition notes

Only the 1440x900 normal frames and the t1150 reduced frame were viewed.

| Frame | File | Looks right? | Note |
|---|---|---|---|
| ~0 ms | step1-gate-travel-t0-1440x900-d0.png | yes | The Hub with the whisper and plaques, the header unchanged. |
| ~1150 ms | step1-gate-travel-t1150-1440x900-d0.png | yes, with a note | Heavy grey mist fills the view; creatures show faintly through. The header and bottom legend stay put. The mist is much lighter than the rest of the palette, which is a bit harsh, but it is the existing travel effect and it is only on screen for a moment. Not changed in Step 1. |
| ~2200 ms | step1-gate-travel-t2200-1440x900-d0.png | yes | The gate is fully arrived: heading, six chips, six creatures, pager. |

## Iteration log

| Round | Date | Fails found | Change made | Screenshots re-captured |
|---|---|---|---|---|
| 1 | 2026-11-12 | Controls readable (20.5): on the Hub at 390 and 360 wide the Menu button covered the "Haunted Estate" badge, because the wordmark and badge row did not wrap (present in the baseline too). | `components/ui/Header.tsx`: the wordmark/badge row now wraps below 768 px (`flex-nowrap` removed, `gap-y-1`). Tests run: `tests/dom/Chrome.test.tsx`, `tests/dom/LayoutRobustness.test.tsx` (58 passed). | `step1r2-hub-ghosts-3-390x844-d0`, `-360x740-d0`, and the gate pair `step1r2-gate-ghosts-3-390x844-d0`, `-360x740-d0` (gate pair not viewed). Hub pair viewed: badge under the wordmark, Menu clear. |

## Verdict

- Any fail remaining: no (among the items I viewed). Not verified: contrast ratios (18.5), the effects count (18.8, 18.9), all 1920x1080 shots, the 360 gate, and most reduced and travel frames.
- Does the result look better than the original against Requirements 18 and 19: not yet judgeable beyond the mobile header fix. Step 1 adds no visible world art, so the Hub and gate match the baseline on desktop.
- Verdict: PASS for Step 1 (no fail among the viewed shots, one fail found and fixed in round 1). The unviewed items above should be glanced at before the final review.
- User sign-off (final review only): not applicable to this step.
