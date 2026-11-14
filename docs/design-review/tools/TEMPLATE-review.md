# Visual Review: <place> (<step>)

- Date: YYYY-MM-DD
- Place: <sky | ground | crypt | hub | final>
- Step: <step name>
- Tool: `docs/design-review/tools/capture.mjs` (or manual capture confirmed by the user)
- Commit / change set: <ref>

## Method statement

This judgement was made by the agent from the stored screenshots listed below, with the written critique in this file. Automated tests alone do not establish visual quality (Req 20.7).

## Screenshots reviewed

List every file used (names follow `YYYY-MM-DD-<step>-<place>-<case>-<w>x<h>-d<d>.png`).

## Side by side with the baseline

| Case | Viewport | Baseline file | New file (d0 / d0.5 / d1) | Better than the original? | Note |
|---|---|---|---|---|---|
| | 1440x900 | | | yes / no | |
| | 1920x1080 | | | yes / no | |
| | 390x844 | | | yes / no | |
| | 360x740 | | | yes / no | |

## Requirement 18: Art direction and visual hierarchy

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 18.1 | Focal point per Stratum at a rule-of-thirds point | | |
| 18.2 | Background, mid-ground, foreground tiers | | |
| 18.3 | Leading lines toward the focal point | | |
| 18.4 | One material language for controls and plaques | | |
| 18.5 | Font roles, 12 px minimum, 4.5:1 contrast, legibility surfaces | | |
| 18.6 | One Light_Source per place; shadows and rim from it | | |
| 18.7 | Contact_Shadow for standing Creatures, rim light for ghosts | | |
| 18.8 | At most 4 ambient effects, all in the Effects_Table | | |
| 18.9 | No decorative-only effects; code and table agree | | |
| 18.10 | Storytelling details tied to real data | | |
| 18.11 | Creatures are physical objects with mounted tags | | |
| 18.12 | "Does not read as generated" | | |

## Requirement 19: Artwork across extended environments

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 19.1 | Uniform Plate scaling with focal `object-position` | | |
| 19.2 | Intelligent Crop; upscale at most 1.75x at 1920 px | | |
| 19.3 | Bleed exceeds displacement; edge masks; no exposed edge | | |
| 19.4 | Only `mg-fence-tile` repeats; landmarks appear once | | |
| 19.5 | Repeated Crops varied and masked | | |
| 19.6 | Blend_Zones of at least 12 percent Viewport_Height | | |
| 19.7 | Layered build; no stretched or tiled opaque Plate | | |
| 19.8 | Continuous journey composition | | |
| 19.9 | No new image over 150 KB (name file and size if any) | | |
| 19.10 | Crop geometry pure function with property tests | | |
| 19.11 | Seam check (see seam table) | | |

## Requirement 20.5 extra checks

| Check | Pass/Fail | One-line justification |
|---|---|---|
| No visible Seam, stretch or edge at any scroll position | | |
| Controls readable | | |
| Creatures grounded | | |
| Empty state complete (zero ghosts / empty cemetery / empty crypt) | | |
| Reduced_Motion appearance | | |
| World_Length and gap rules of Req 6 for the 3-Creature case | | |

## Seam table (Req 19.11)

Mean luminance of the 4 rows above and below each join, as a share of full scale. Limit 10 percent.

| Blend_Zone join | Depth 0 | Depth 0.25 | Depth 0.5 | Depth 0.75 | Depth 1 | Max diff | Pass/Fail |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Edge check: no row or column along the viewport edge shows solid `--color-night-sky`.

| Viewport | Top | Bottom | Left | Right |
|---|---|---|---|---|
| 1440x900 | | | | |
| 1920x1080 | | | | |
| 390x844 | | | | |
| 360x740 | | | | |

Per-Stratum visual check:

| Stratum | Stretch | Repeat | Edge exposure | Note |
|---|---|---|---|---|
| | | | | |

## 3-Creature gap table (Req 6)

| Viewport | World_Length (Vh) | Largest vertical gap (Vh) | First Creature in first screen? | Last Creature below it? | Pass/Fail |
|---|---|---|---|---|---|
| 1440x900 | | | | | |
| 1920x1080 | | | | | |
| 390x844 | | | | | |
| 360x740 | | | | | |

## Reduced-motion notes

Describe the appearance with `prefers-reduced-motion: reduce` (no parallax offset, static mist, minimum overscan, no drift).

## Travel transition notes

Frames at about 0 ms, 1150 ms and 2200 ms (normal and reduced motion). Confirm the transition still looks right.

| Frame | File | Looks right? | Note |
|---|---|---|---|
| ~0 ms | | | |
| ~1150 ms | | | |
| ~2200 ms | | | |

## Iteration log

| Round | Date | Fails found | Change made | Screenshots re-captured |
|---|---|---|---|---|
| 1 | | | | |

## Verdict

- Any fail remaining: yes / no
- Does the result look better than the original against Requirements 18 and 19: yes / no
- Verdict: PASS / FAIL (a fail means the step is incomplete; iterate, re-capture and rewrite this review)
- User sign-off (final review only): <quote of the user's written confirmation>
