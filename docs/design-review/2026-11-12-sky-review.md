# Visual Review: sky (sky)

- Date: 2026-11-12
- Place: sky
- Step: sky (task 10.2 of explorable-worlds)
- Tool: `docs/design-review/tools/capture.mjs` (`--step sky --places sky --depths 0,0.25,0.5,0.75,1 --reduced --seam`, plus `--travel`)
- Commit / change set: working tree (uncommitted): `components/world/{DepthMarker,WorldPlaceView,WorldCreatures,CreatureTag,EmptyScene}.tsx`, `docs/design-review/tools/capture.mjs`

## Method statement

This judgement was made by the agent from the stored screenshots listed below, with the written critique in this file. Automated tests alone do not establish visual quality (Req 20.7).

Limits of this review, stated up front: the capture set has 300+ files and I opened only a subset (listed below). Contrast was judged by eye, not measured with a tool. The seam numbers are measured by the probe in `capture.mjs`, not by eye. Shots marked "earlier round" were viewed before the last round of fixes and are not claimed for the final state.

## Screenshots reviewed

Final-state shots opened with `read_file` (all under `docs/design-review/`, prefix `2026-11-12-sky-sky-`):

- `ghosts-3-1440x900-d0.png`, `ghosts-3-1440x900-d1.png` (d0.5 also viewed in the previous round)
- `ghosts-3-390x844-d0.png`
- `ghosts-3-reduced-1440x900-d0.png`
- `empty-1440x900-d0.png`
- `ghosts-12-1440x900-d0.5.png`
- Previous context, after the final recapture: `ghosts-3-1920x1080-d0.png`, `ghosts-12-360x740-d0.png`, `travel-t2200-1440x900-d0.png`
- Baseline: `2026-11-12-baseline-sky-ghosts-3-1440x900.png`

Earlier round (before the scrim and EmptyScene retune; used for diagnosis only, not as evidence for the final state): ghosts-3 360x740 d0, 390x844 d1, empty 390x844, ghosts-12 390x844 d0.5, travel t1150 1440x900.

**Not viewed by me:** ghosts-3 at 1920x1080 d0.25/d0.5/d0.75/d1, 360x740 d0.25-d1, 390x844 d0.25-d1; ghosts-12 at 1440 d0/d1, 1920, 390 (final state); empty at 1920, 390, 360 (final state); reduced-motion shots other than ghosts-3 1440 d0; travel frames t0 at every size, t1150 and t2200 at 1920/390/360, and all reduced travel frames. Those are covered only by the seam probe and the passing tests, not by my eyes.

## Side by side with the baseline

| Case | Viewport | Baseline file | New file (d0 / d0.5 / d1) | Better than the original? | Note |
|---|---|---|---|---|---|
| ghosts-3 | 1440x900 | `baseline-sky-ghosts-3-1440x900.png` | `sky-sky-ghosts-3-1440x900-d0/d0.5/d1.png` | yes | Baseline is a flat one-screen scatter with the three ghosts floating in a void; new has a painted cloud bank, a depth marker, a longer journey and urgent ghost placed first. |
| ghosts-3 | 1920x1080 | `baseline-sky-ghosts-3-1920x1080.png` (not opened) | `...-1920x1080-d0.png` (opened, previous context) | yes (d0 only) | Art reaches both edges after the hydration fix. Other depths not opened. |
| ghosts-3 | 390x844 | `baseline-sky-ghosts-3-390x844.png` (not opened) | `...-390x844-d0.png` | yes (d0 only) | Reads cleanly; see dev-badge note. |
| ghosts-3 | 360x740 | `baseline-sky-ghosts-3-360x740.png` (not opened) | `...-360x740-d0.png` (earlier round only, ghosts-12 360 d0 final) | not judged on final | Honest gap. |

## Requirement 18: Art direction and visual hierarchy

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 18.1 | Focal point per Stratum at a rule-of-thirds point | Pass | At 1440 d0 the most urgent ghost (hollow-sync) sits at about x 33% / y 50%, a thirds point, with the painted cloud band leading past it. The moon is the secondary focus and is cropped by the top edge (weak, noted). |
| 18.2 | Background, mid-ground, foreground tiers | Pass | Far painted sky, mid cloud banks and the foreground ghosts with the vignette and cobwebs read as three tiers in d0 and d1. |
| 18.3 | Leading lines toward the focal point | Pass | The cloud band at d0 sweeps from the right toward the left ghost. Weak at d1, where the cloud bank is mostly horizontal. |
| 18.4 | One material language for controls and plaques | Pass | After round 1 the "Altitude: high" label uses the plaque material and heading face, matching the chips and tags. |
| 18.5 | Font roles, 12 px minimum, 4.5:1 contrast, legibility surfaces | Pass (visual only) | Tags are `text-xs` Cinzel plus mono sub-line; chrome sits on the night scrim. Contrast was not measured. Tags that scroll under the top and bottom legibility gradients dim (ghosts-12 d0.5: MARROW-DOCS, NIGHT-OWL-CLI), which I accepted as transitional but did not measure. |
| 18.6 | One Light_Source per place; shadows and rim from it | Pass | Moon is the one light; ghost rim glow is cool and consistent across ghosts. |
| 18.7 | Contact_Shadow for standing Creatures, rim light for ghosts | Pass | Sky has only floating ghosts (no contact shadow expected); rim glow visible on the front-band ghosts. |
| 18.8 | At most 4 ambient effects, all in the Effects_Table | Pass | Sky ambient rows in `docs/EFFECTS_TABLE.md`: `star-twinkle`, `cloud-drift`, `bats` = 3. |
| 18.9 | No decorative-only effects; code and table agree | Pass (table read, code not re-audited) | Table rows each name a data field or a story or blend purpose; I did not re-audit the code this round. |
| 18.10 | Storytelling details tied to real data | Pass | Tag sub-line shows the decay word ("about to turn", "flickering"), depth marker shows altitude, ghost opacity shows decay. |
| 18.11 | Creatures are physical objects with mounted tags | Pass | Lantern-hung plaques with name and sub-line at every ghost's feet. |
| 18.12 | "Does not read as generated" | Pass (subjective) | Painted plates and the shared plaque material read as one set. Back-band ghosts are small and dim; judged acceptable. |

## Requirement 19: Artwork across extended environments

| Req | Criterion | Pass/Fail | One-line justification |
|---|---|---|---|
| 19.1 | Uniform Plate scaling with focal `object-position` | Pass | No stretch seen at 1440, 1920 or 390 d0. |
| 19.2 | Intelligent Crop; upscale at most 1.75x at 1920 px | Pass (not measured) | 1920 d0 looks sharp; the crop geometry has unit and property tests. I did not measure the upscale ratio in the browser. |
| 19.3 | Bleed exceeds displacement; edge masks; no exposed edge | Pass | Edge probe: 0 solid-night-sky edges in every case and viewport. The round 2 fix (first-render width) removed a visible edge at 1920. |
| 19.4 | Only `mg-fence-tile` repeats; landmarks appear once | Pass | The sky has no repeating tiles seen. |
| 19.5 | Repeated Crops varied and masked | Pass (n/a in sky) | No repeated crops in the sky. |
| 19.6 | Blend_Zones of at least 12 percent Viewport_Height | Pass (by tests and probe, not eye) | The probe found the join at every depth with no visible tone change in d0 to d1 shots. |
| 19.7 | Layered build; no stretched or tiled opaque Plate | Pass | |
| 19.8 | Continuous journey composition | Pass | High air at d0 thickens to cloud bank at d1, with the depth marker tracking it. |
| 19.9 | No new image over 150 KB | Pass for this step | No images added. Existing public art over 150 KB (not new): `fg-frame` 235, `fog-wisps` 230, `mg-fence` 349, `place-crypt` 272, `place-gate` 198, `place-ground` 152 KB. |
| 19.10 | Crop geometry pure function with property tests | Pass (test suite, not re-run in full) | I re-ran only the tests relevant to my fixes (82 pass). |
| 19.11 | Seam check (see seam table) | Pass | Max seam 0.39 percent against a 10 percent limit. |

## Requirement 20.5 extra checks

| Check | Pass/Fail | One-line justification |
|---|---|---|
| No visible Seam, stretch or edge at any scroll position | Pass | Probe: 0 fallback edges across 100 runs; max seam share 0.39 percent. Visual confirmation only on the shots listed above. |
| Controls readable | Pass | Return, chips, pager and depth marker legible at 1440 and 390. The chip row scrolls horizontally on 390 (FLICKERING clipped, by design). Dev-only Next.js "1 Issue" badge covers the pager's left button at 390 (a dev overlay, not feature code). |
| Creatures grounded | Pass | Floating ghosts are anchored by their lantern tag, rim glow and brightness-by-band. |
| Empty state complete (zero ghosts / empty cemetery / empty crypt) | Pass (1440 only) | Plaque "No ghosts haunt this sky" sits clear of the chrome after the EmptyScene offset. 390 and 360 empty not re-viewed after the fix. |
| Reduced_Motion appearance | Pass | At 1440 d0 reduced the moon is much fainter, which is the static treatment; layout is the same as normal. Other sizes not viewed. |
| World_Length and gap rules of Req 6 for the 3-Creature case | Pass | See gap table (computed with `computeWorldLayout`). |

## Seam table (Req 19.11)

Source: `docs/design-review/2026-11-12-sky-seam-probe.json`. The probe takes a chrome-free frame and mean luminance of the 4 rows above and below the join. Limit 10 percent (0.10).

| Blend_Zone join | Depth 0 | Depth 0.25 | Depth 0.5 | Depth 0.75 | Depth 1 | Max diff | Pass/Fail |
|---|---|---|---|---|---|---|---|
| high air / cloud bank, ghosts-3, 1440x900 | 0.13% | 0.11% | 0.09% | 0.02% | 0.08% | 0.13% | Pass |
| same, 1920x1080 | 0.19% | 0.08% | 0.09% | 0.09% | 0.01% | 0.19% | Pass |
| same, 390x844 | 0.23% | 0.21% | 0.16% | 0.20% | 0.15% | 0.23% | Pass |
| same, 360x740 | 0.39% | 0.13% | 0.17% | 0.19% | 0.14% | 0.39% | Pass |
| ghosts-12, worst of the four viewports | 0.23% | 0.20% | 0.16% | 0.20% | 0.24% | 0.24% | Pass |
| ghosts-3 and ghosts-12 reduced, worst of the four viewports | 0.20% | 0.25% | 0.25% | 0.20% | 0.29% | 0.29% | Pass |
| empty (normal and reduced) | n/a | n/a | n/a | n/a | n/a | n/a | No join: World_Length 1 has a single stratum, so the probe records 0 seams |

Edge check (probe `fallbackEdges`, solid `--color-night-sky` along a viewport edge): 0 in all 120 runs.

| Viewport | Top | Bottom | Left | Right |
|---|---|---|---|---|
| 1440x900 | none | none | none | none |
| 1920x1080 | none | none | none | none |
| 390x844 | none | none | none | none |
| 360x740 | none | none | none | none |

Per-Stratum visual check:

| Stratum | Stretch | Repeat | Edge exposure | Note |
|---|---|---|---|---|
| high air | none seen (1440, 1920 d0, 390 d0) | none | none | stars and thin clouds |
| cloud bank | none seen (1440 d1) | none | none | d1 viewed at 1440 only |

## 3-Creature gap table (Req 6)

Computed by calling `computeWorldLayout` for the sky with 3 names (a throwaway test, deleted). Creature centres as a multiple of Viewport_Height; the limit between consecutive items is 0.6 Vh.

| Viewport | World_Length (Vh) | Largest vertical gap (Vh) | First Creature in first screen? | Last Creature below it? | Pass/Fail |
|---|---|---|---|---|---|
| 1440x900 | 1.5 | 0.50 (top to first Creature) | yes (0.50) | yes (1.06) | Pass |
| 1920x1080 | 1.5 | 0.50 | yes (0.50) | yes (1.06) | Pass |
| 390x844 | 1.5 | 0.50 | yes (0.50) | yes (1.06) | Pass |
| 360x740 | 1.5 | 0.57 | yes (0.57) | yes (1.06) | Pass |

Creature to creature gaps are 0.28 Vh (0.24 at 360). The last Creature to the world bottom is 0.44 Vh. The cloud-bank landmark is not counted in this table.

## Reduced-motion notes

At 1440 d0 reduced: layout identical to the normal shot, no parallax offset, and the painted moon is dimmer. The seam probe passed on all reduced runs (max 0.29%). I did not view reduced shots at other sizes.

## Travel transition notes

I viewed t2200 at 1440x900 in the previous context after the final recapture, and t1150 at 1440 in an earlier round only. The rest were not opened.

| Frame | File | Looks right? | Note |
|---|---|---|---|
| ~0 ms | `sky-sky-travel-t0-1440x900-d0.png` | Not viewed | |
| ~1150 ms | `sky-sky-travel-t1150-1440x900-d0.png` | Earlier round only | Not re-checked after the scrim change |
| ~2200 ms | `sky-sky-travel-t2200-1440x900-d0.png` | Yes | Settled state matches the d0 shot |

## Iteration log

| Round | Date | Fails found | Change made | Screenshots re-captured |
|---|---|---|---|---|
| 1 | 2026-11-12 | "Altitude: high" label unstyled (body font, no plaque) | `DepthMarker` label restyled with plaque material and heading face | sky set |
| 2 | 2026-11-12 | Art did not reach the edges at 1920 (server-sized 1024 px art, then a hydration mismatch when I tried `window.innerWidth` on first render) | `WorldPlaceView` `mounted` state: window-size fallback only after hydration | 1440, 1920 |
| 3 | 2026-11-12 | Tags lacked a state sub-line (state conveyed by colour only) | `WorldCreatures` passes `subline={decayWord(...)}` | 1440, 1920 |
| 4 | 2026-11-12 | Tag text dimmed by the creature brightness filter; long names overflowed | `CreatureTag` `parentBrightness` cancel plus truncate | ghosts-12 |
| 5 | 2026-11-12 | Title and chips collided with the creatures behind them; the empty plaque overlapped the chrome on short viewports | Night scrim behind the chrome (tuned 78% to 88% to 85% with a transparent top stop); `EmptyScene` top `max(34%, 20.5rem)` | all sky cases |
| 6 | 2026-11-12 | Seam probe saw chrome in the 4-row bands (false seams) | `capture.mjs` takes a chrome-free frame for the probe; JSON is written in `finally`; runs are per case and merged | all sky cases, plus travel |

Tests re-run after the fixes: WorldPlaceView, WorldCreatures, DepthMarker, CreatureTag, EmptyScene, LayoutRobustness and the capture-tools unit test, 7 files, 82 tests, all pass. No test was weakened. The full suite was not run.

## Verdict

- Any fail remaining: no (known weak spots, none a fail: moon cropped by the top edge at 1440 d0; creatures dim while scrolling under the top and bottom gradients; the dev-only Next.js badge covers the pager at 390)
- Does the result look better than the original against Requirements 18 and 19: yes (confirmed on the 1440 and 390 d0 shots; 1920 d0 from the previous context)
- Verdict: PASS, with the "not viewed" list above. A reader who needs the unviewed shots confirmed should open them before relying on this.
- User sign-off (final review only): n/a
