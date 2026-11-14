# Phase 1 findings (task 20.1): version mismatch and defect reproduction

Investigation only. No source files were changed. Tooling added: `docs/design-review/repair/probe.mjs`
(CDP probe built on `docs/design-review/tools/cdp.mjs`; modes `layout hub scroll crypt cryptjoin click touch hovercover reach wheel momentum inspect`).
Raw data: `docs/design-review/repair/data-{old,new}-*.json`. Before shots: `docs/design-review/repair/before-*.png`.
Run in headless Chrome, `/estate` (sample estate), entering each place by clicking `estate-place-<id>`.

## 1. Why the Vercel site shows the old stages

- `git rev-parse HEAD origin/main` → both `74c4bb305dcdb9cf98601cd90c4556fc321f3d36`.
- `git ls-tree -r HEAD --name-only` has no `components/world/*`, no `lib/world-*.ts`, no `app/dev/*`.
  `components/scene/PlaceView.tsx` in HEAD is the old paged stage (the working tree renames it to `GatePlaceView.tsx` and adds a new dispatching `PlaceView.tsx`).
- `git status --short`: 94 entries, all Explorable Worlds work uncommitted (`components/world/`, `lib/world-*.ts`, `lib/place-pipeline.ts`, `lib/review-cases.ts`, `app/dev/`, `components/dev/`, 40+ tests, `.kiro/specs/explorable-worlds/`, `docs/design-review/`).
- Vercel builds the pushed commit, so the deployed site is OLD. Confirmed by behaviour: OLD has no `[data-world-scroller]` in any place (probe `scroll`: "no world scroller" for sky/ground/crypt at 1280, 1440, 390).

OLD = detached worktree of `74c4bb3` on :3100. NEW = working tree on :3000.
Setup notes: Turbopack refuses a `node_modules` junction outside its root, so the temporary worktree's `next.config.ts` got `turbopack.root = C:/Users/zachg/projects` (worktree only, deleted with it). `.env.local` was copied.
Cleanup done: dev server on :3100 stopped; junction removed with `cmd /c rmdir` (link only); `git worktree remove --force` + `prune`; `git worktree list` shows only the main repo; real `node_modules` verified present; `git status` still 94 entries.

## 2. Summary table

| # | Defect | OLD (HEAD) | NEW (working tree) | Class |
|---|---|---|---|---|
| 1a | 1280x720 site header box overlaps the place heading (9 px) | yes | yes | existing defect |
| 1b | 1280x720 site header box overlaps **Return to the gate** (214.6 x 9 px) | no (return y=136) | yes (return y=112) | **new regression** |
| 2a | Lifecycle legend overlaps the pager (desktop) | no | yes: 165 x 34 px at 1280x720, 85 x 34 px at 1440x900 | **new regression** |
| 2b | Sample-estate notice (plaque) overlaps the pager at narrow widths | yes: 241 x 20 (390, 360), 152.7 x 20 (737) | yes: same 241 x 20, 151 x 20 | existing defect |
| 3 | Sprites and nameplates pass behind fixed heading / filters / header while scrolling | n/a (stages do not scroll) | yes | **new** (consequence of scrolling worlds) |
| 4 | Crypt hard horizontal join; coffins not grounded | no join (one cover plate) | yes (stair tread lines, strata seam) | **new regression** |
| 5 | ~737 px hub: dusk-scheduler whisper overlaps "Beyond the Gate" | yes, 118 x 48 px | yes, identical | existing defect |
| 6a | Creature behind fixed chrome receives the click instead | gate only: filter chip over barrow-sync at 1280x720 | many (see 3.6) | partly existing, mostly **new** |
| 6b | Pointer click swallowed within 120 ms of any scroll event | n/a (no scroller) | yes | **new** (by design of `useScrollGuard`, but over-broad) |
| 6c | Hover card covers a neighbouring creature | yes (sky: 2 of 12 pairs) | not reproducible in estate (too few creatures per view) | existing, latent |
| 6d | Plain mouse and touch click on a visible, uncovered creature | opens (all 4 places) | opens (all 4 places) | not a defect |

## 3. Per-defect detail

Rects are `getBoundingClientRect` (px). "Overlap" = intersection width x height.

### 3.1 Defect 1: wrapped header vs Return / heading (1280x720)

| place | element pair | overlap |
|---|---|---|
| sky | `scene-header` box (y 16-121) vs `return-to-gate` (24,112, 214.6x34) | 214.6 x 9 (NEW only) |
| sky | `scene-header` vs `place-heading` (446.9,112, 371.1x68) | 371.1 x 9 (OLD and NEW) |
| sky | Sound toggle (457.5,85, 157.7x34, bottom 119) vs heading | 157.7 x 7 (OLD and NEW) |
| sky | Visit button vs return | 38.6 x 9 (NEW only) |
| ground | header vs heading | 411.2 x 9; Sound vs heading 157.7 x 7; Lights vs heading 22.6 x 7 (OLD 15.1 x 7) |
| crypt | header vs heading | 222.7 x 9; Sound vs heading 94.1 x 7 (OLD 86.6 x 7) |
| gate | header vs heading | 372.5 x 9; Sound vs heading 157.7 x 7 (OLD and NEW) |

At 1440x900 the header is one row (h 59) and nothing overlaps. 737/390/360 are compact and show no header/return overlap.

Root cause:
- `components/ui/Header.tsx:191` and `:249`/`:254`: `[@media(max-height:899px)]:flex-col` turns the header into two stacked rows at 720 px tall, so it grows to 105 px (16 to 121).
- `components/scene/SceneView.tsx:696-697`: the site header wrapper is `absolute ... min-h-[var(--site-header-h)]` and `--site-header-h` is a fixed `7rem` = 112 px (`app/globals.css:12`). `useHeaderHeightVar` only publishes the measured height while compact (`components/scene/useHeaderHeightVar.ts:28`), so at 1280x720 (not compact) the real header (121 px bottom) is 9 px taller than the variable.
- Place chrome is placed at `top: var(--site-header-h)`: NEW `components/world/WorldPlaceView.tsx:312` (return is `absolute left-6 top-0` inside it, line ~316, so it lands at y=112), OLD `components/scene/GatePlaceView.tsx:480-486` wrapped the return in `p-6`, putting it at y=136, which hid the problem. The heading is at 112 in both, hence the existing 9 px heading overlap (`.place-title-clear` in `app/globals.css:603` only adds top padding below 1100 px).

Shots: `before-new-layout-{sky,ground,crypt,gate}-1280x720.png`, `before-old-layout-*-1280x720.png`.

### 3.2 Defect 2: legend vs pager, notice vs pager

Desktop legend vs pager (NEW only), same in sky, ground, crypt:
- 1280x720: pager (377.5,678, 510.1x34), legend (722.6,678, 541.4x34) → overlap 164.9 x 34.
- 1440x900: pager (457.5,858, 510.1x34), legend (882.6,858, 541.4x34) → overlap 84.9 x 34.
- OLD 1280x720: pager y=616-656 (above legend 678-712); OLD 1440x900: pager y=796-836, legend 858-892. No overlap.
- The screenshot (`before-new-scroll-sky-1440x900-k4.png`) shows "DEEPER INTO THE DARK" printed over "THE RESTLESS SKY".

Narrow (OLD and NEW): pager vs `scene-footer-plaque` (16,y, 241x20): 241 x 20 at 390 and 360, 151 x 20 (NEW) / 152.7 x 20 (OLD) at 737 (gate 143.5 x 20 NEW). Plaque is pinned left (`x 16-257`), pager is full width centred.

Root cause:
- NEW pager sits in `components/world/WorldPlaceView.tsx:461-475`, a `sticky bottom-0` bar with only `0.5rem` bottom padding, i.e. on the same row as the footer legend/plaque (`components/scene/Footer.tsx:70`, `py-2`, legend line 96-99, `max-[767px]:hidden`).
- OLD desktop pager was `absolute inset-x-0 bottom-16` (`components/scene/GatePlaceView.tsx:~519`), 64 px up, clear of the footer. Compact OLD used `fixed bottom-0` and already overlapped the plaque (`GatePlaceView.tsx:~463`), now copied into the world view.
- Also NEW only, 360x740: `depth-marker` overlaps heading (110-115 x 3.5) and, in sky, chips (122.7 x 30) (`components/world/DepthMarker.tsx:86`, `absolute right-2 top-1/2 z-50`).

Shots: `before-{new,old}-layout-*-{1280x720,1440x900,737x720,390x844,360x740}.png`.

### 3.3 Defect 3: sprites and nameplates under fixed headings / filters

NEW only. Per scroll step (9 steps, 0 to 100%), counts of creature plaques (`scatter-plaque`) that intersect heading / chips / return / header / pager:
- sky 1280x720: 4 of 9 steps; sky 1440x900: 5 of 9; sky 390x844: 8 of 9
- ground 1280x720: 1/9; 390: 5/9; crypt 1280x720: 4/9; 1440x900: 2/9; 390: 6/9
- Example (sky 1280x720, step 6 of 8): hollow-atlas plaque under chips 112 x 14 px, under heading 44 x 16 px; sprite under header 149 x 59 px. Step 8: plaque under header 112 x 43 px.
- Screenshot: `before-new-scroll-sky-1440x900-k4.png` shows the "HOLLOW-ATLAS / about to turn" plaque half hidden by the "All 4" chip.

Root cause: top chrome is `sticky top-0 z-50` inside the scroller (`WorldPlaceView.tsx:289`) with a scrim only 15rem (desktop) / 22rem (compact) tall whose opaque part is the 30%-62% band (`WorldPlaceView.tsx:296-308`), while the creature layer (z-20, `WorldCreatures.tsx`) scrolls the whole stage and plaques are `z-10` inside the button (`CreatureTag.tsx:54`). The scrim fades to `transparent 100%` and starts transparent for the top 30%, so sprites show through between header and chips and plaques are cut by chip borders. Scroll padding is not applied to the creature layout, so no creature is kept out of the chrome band. The 18vh gradient (`WorldPlaceView.tsx:~482-494`) is `z-30` and `inert`, a soft dim rather than a clip.

### 3.4 Defect 4: Crypt join and grounding

- OLD: one `place-crypt` cover plate behind a paged stage; `before-old-crypt-1440x900-k0.png` shows a continuous wall-to-floor image, no seam.
- NEW (`cryptjoin` probe, chrome and creatures hidden, scanning ±70 rows around each join):
  - 1440x900 / 1280x720: strata `entry` (top 0, h 518/414) and `chamber-1` (top 329/263, h 968/774), stairs blend zone top 383/306, h 135/108. Largest row-to-row luminance step 5.8 (2.3 percent of scale), 8-10 percent of columns: faint but visible parallel horizontal lines (the stair-tread stripes spanning full width) in `before-new-cryptjoin-1440x900-band-chamber-1.png`, y≈330-420.
  - 390x844: step 12.9 (5.1 percent), 59 percent of columns change at one row (strata join near y 308-352; `before-new-cryptjoin-390x844-band-chamber-1.png` shows a hard dark bar edge across the full width). Stair blend zone: 9.0, 31 percent.
- Coffins are not grounded: coffin `null-pointer-bistro` (top 374 / h 151) sits mid-wall over the entry/chamber seam, `tin-can-chat` (top 882) is stranded below; there is no floor contact (`before-new-crypt-1440x900-k2.png`: coffin floats at y 210-290 against the wall; k4: second coffin has plaque but no shadow on the floor line).

Root cause:
- `components/world/CryptArt.tsx`: `STAIR_STEPS` (a `repeating-linear-gradient` of 2 px dark seams every 18 px, line ~157) is painted full-width in the entry's mid band with only a vertical fade (`STAIR_MASK`), and again as the blend-zone background at `opacity .35` (`blendBackground`, ~190). Each stratum is a separate `CropLayer` of the same plate with different flip/filter/brightness (`cryptSpecFor`, ~54-71), masked only by `bandMask` over the blend height (`z.height`, 108-135 px); at 390 px wide the crops differ most, so the seam is a visible step.
- Placement: coffin y comes from `computeWorldLayout` (strata and slots) without a floor line in the plate; `CreatureShadow` (`components/world/CreatureShadow.tsx`, `shadowFor('crypt', …)` in `lib/world-light.ts`) draws a soft shadow but not on a defined floor, and the plate has its floor only in the lower third.

### 3.5 Defect 5: hub whisper at 737 px

- 737x720, 737x800, 737x900: whisper `dusk-scheduler is still waiting for you…` rect (287.4, 612.6, 118.0 x 48.0). Overlaps `estate-place-gate`: 118 x 48; "Beyond the Gate" text 118 x 25; "5 undead shamble here, waiting" 118 x 14.3.
- 700x720: 96.6 x 48 (same elements). 768, 800, 1280, 1440: no overlap.
- OLD identical numbers → existing defect. Shots: `before-{old,new}-hub-737x720.png` (and 737x800/900, 700x720).

Root cause: `components/scene/EstateMap.tsx` (whisper wrapper, ~line 285-300) positions the whisper with the desktop board constants `WHISPER_TOP_PCT = 44`, `WHISPER_CENTER_PCT = 49`, `WHISPER_WIDTH_CSS = calc(58% - (PLACE_CARD_W_PX + 32)px)` (`lib/estate-view.ts`) at every width. Below 768 px (`md:`) the places are not on the board: they flow in one column (`EstateMap.tsx` "relative flex flex-col … pt-40"), so the absolutely positioned whisper (44 percent of the scrollable map height) lands on the gate card. The width formula leaves only 118 px at 737 px, so the 2-line clamp still collides.

### 3.6 Defect 6: pointer click only previews or does nothing, Enter works

#### What works (OLD and NEW)
Real `Input.dispatchMouseEvent` (instant, 100 ms and 500 ms hover before click; the 500 ms case has the hover card open) and real `Input.dispatchTouchEvent` taps (390x844 with touch emulation):

| env | OLD mouse | NEW mouse | OLD touch | NEW touch |
|---|---|---|---|---|
| gate | 18/18 open | 18/18 | 5/5 | 5/5 |
| sky | 12/12 | 9/9 | 4/4 | 3/3 |
| ground | 9/9 | 6/6 | 3/3 | 2/2 |
| crypt | 6/6 | 3/3 | 2/2 | 1/1 |

So an uncovered click at the creature centre reliably opens the record with hover-card preview, focus, or none; `?repo=` is pushed. The plain handler chain is correct: `Creature.tsx` `onClick={activate}` → `onSelect` → `SceneView.handleSelect` → `deepLink.open` (`components/detail/useRepoDeepLink.ts:~86`).

#### Intentional previews (not defects)
- `HoverCardProvider.tsx`: pointer hover opens a card after `DWELL_MS = 250` (pointer-capable only, `(hover: hover) and (pointer: fine)`); focus (keyboard or the focus a mouse press gives) opens a non-interactive tooltip; Escape closes; the card is suppressed while the panel is open or a travel runs (`SceneHoverBridge`, `SceneView.tsx`). Clicking while the card is open still opens the record (500 ms variant). Touch never gets a hover card.

#### Defects found
1. **Fixed chrome sits over scrolling creatures and steals the click (NEW; partly existing).** `reach` probe: a 5x5 grid of points inside each creature button, `elementFromPoint` ≠ the creature. Worst reachable share and the element on top:
   - 1440x900: sky `cobweb-cli` 60% (filter chip "about to turn"), `hollow-atlas` 80% (chips); crypt `tin-can-chat` 40% (`pager-deeper`).
   - 1280x720: sky `hollow-atlas` 60% (chips + Lights/Sound toggles), crypt `null-pointer-bistro` 40% (Lights toggle and header), ground `ember-notes` 75% (return, header, toggle).
   - 390x844: sky `lantern-notes` **0%** (`pager-deeper` covers all 25 points), `cobweb-cli` 36% (depth marker, chips), ground `willow-ui` 32% (depth marker), `harvest-engine` 20% (`pager-nearer`), crypt `tin-can-chat` 20% (`pager-deeper`).
   - Effect: the click hits Deeper/Nearer (changes page), a filter chip (changes filter), Return (leaves the place) or a header toggle, not the creature. Shots `before-new-reach-*.png`.
   - OLD: stages did not scroll, so only the static case shows (gate 1280x720: filter chip over `barrow-sync` 60%) plus neighbouring plaques covering 20-40% of a button (`plaque`, `plaque-name`) at 390 and in the crypt.
   - Root cause: `WorldPlaceView.tsx:289` chips row `pointer-events-auto` (line ~327), `ReturnToGate` and `Pager` buttons, `DepthMarker.tsx:86` (`pointer-events-auto … z-50`), and the site header (`pointer-events-auto` children) all z-50 over the `z-20` creature layer, with nothing keeping creatures out of those rects. The creature remains scrollable under them (same cause as defect 3).
   - Note: some `world-stage` hits on tombstones are not defects: tombstones carry a CSS tilt (`WorldCreatures.tsx` `rotate(slot.tilt)`) so the axis-aligned rect includes empty corners.
2. **`useScrollGuard` swallows legitimate mouse clicks right after any scroll event (NEW).** `components/world/useScrollGuard.ts:7` `SCROLL_MOMENTUM_MS = 120`; the capture `click` listener (lines 58-69) calls `stopPropagation()` and `preventDefault()` when `now() - lastScroll <= 120` for **every** pointer click (`detail > 0`), including mouse. `momentum` probe (1 px scroll, then press/release `gap` ms later): clicks at 0, 30 and 60 ms after the scroll event do **not** open the record in sky, ground and crypt; 100 ms and 150 ms open. Idle pages emit 0 scroll events (3 s sample), so nothing self-triggers. In real use a wheel or trackpad scroll generates a stream of scroll events for ~100-300 ms; a click inside that window silently does nothing, which reproduces "pointer click did nothing, Enter works" (Enter has `detail === 0` and is never swallowed). The hover card stays visible because it is separate from the click.
   - Also: the guard's drag flag `moved` is set by any 8+ px `pointermove` while a pointer is down, so a click after a slight drag on the creature is dropped (intentional, needs to stay), but `moved` is only cleared on click or the next `pointerdown` (lines 38-69).
3. **Hover card can cover a neighbouring creature (OLD sky, latent in NEW).** `HoverCardLayer.tsx` places the card below the anchor (`GAP = 12`, `computeCardPosition`), `fixed z-[60]`, `pointer-events: auto` when pointer-triggered (line ~160). In OLD sky at 1440x900 the card for `cobweb-cli` (1128,471 to 1416,625.5) covers `fenwick-timer`'s centre and vice versa (2 of 12 pairs; also at 1280x720). Clicking the covered creature hits the card, so nothing opens. Shots `before-old-hovercover-sky-{1440x900,1280x720}.png`. NEW estate shows 0 of 6/2/0 pairs only because few creatures are in view at once; the card code is unchanged, so with denser pages the same applies (the review harness has no hover card layer, so I could not test the 12-creature cases).

Not reproduced: pointer events lost because of `li { pointer-events: none }` (button has `pointer-events: auto`, hit tests ok), a React-state race between hover-open and click, or touch taps (all pass).

Which are existing? 6c existing; 6a mostly regression (NEW scrolling worlds put every creature under chrome at some scroll position); 6b regression (new hook); basic activation not broken.

## 4. Root-cause hypotheses for Phase 2 (ordered by task)

- 20.2 (defects 1, 2, 5)
  - Header: use the measured header height as `--site-header-h` also when not compact (`useHeaderHeightVar.ts:28`), or lay out the return/heading below `max(7rem, header height)`; restore the OLD `p-6` offset for the return (`WorldPlaceView.tsx:312-316`).
  - Pager: raise it above the footer row (OLD used `bottom-16` on desktop), or keep the legend out of the pager's x-range; on compact, stack pager above the plaque.
  - Whisper: apply `WHISPER_*` only from `md:`; below 768 px place it in the flow or hide while overlapping.
- 20.3 (defects 3, 4)
  - Make the top scrim opaque up to the chips' bottom (it is transparent for its top 30%) or clip the creature layer / add top safe-area padding to the scroll content; keep plaques `z-10` below chrome as now.
  - Crypt: remove or heavily fade the full-width `STAIR_STEPS` stripes, widen the blend between strata crops (esp. narrow widths), give coffins a floor line and a contact shadow.
- 20.4 (defect 6)
  - Make chrome that overlays scrolling creatures not receive clicks where a creature is under it, or keep creatures out of the chrome band (shared fix with defect 3); at minimum disable pointer events on the pager/chips background and give them a solid backing so the thing under the pointer is what the user sees.
  - Limit `useScrollGuard` momentum suppression to touch (`PointerEvent.pointerType === 'touch'`) or shorten the window and clear it on any `pointerdown` that follows a scroll end; keep the 8 px drag rule and keyboard exemption.
  - Position the hover card so it does not cover other creatures' hit areas (or `pointer-events: none` for the card body except its links).

## 5. Method limits

- Estate fixture only: 3 to 6 creatures per view. Dense (12+) cases could not be exercised with real dialogs because `/dev/review` has no hover layer or detail panel and exists only in the working tree.
- Headless Chrome 1440x900 / 1280x720 / 737 / 390 / 360; mobile emulation (`Emulation.setTouchEmulationEnabled`) for touch.
- Crypt "hard join" measured by row luminance steps on chrome-free frames; the visual judgement is from the stored screenshots.
- Vercel itself was not fetched; the mismatch conclusion comes from git state and the OLD worktree behaving as described.
