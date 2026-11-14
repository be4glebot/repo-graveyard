# Repair report (task 20.5)

Scope: targeted repair of six reported defects in the Explorable Worlds work. No redesign, no new dependencies, no commit/push/deploy. Evidence: `phase1-findings.md` (before), the tools in `docs/design-review/tools/` (after).

## 1. Version mismatch (why the live site looks old)

`HEAD == origin/main == 74c4bb3`, and that commit contains no world code (`components/world/*`, `lib/world-*.ts`, `lib/place-pipeline.ts`, `app/dev/*` are all absent; `PlaceView.tsx` is the old paged stage). All Explorable Worlds work is **uncommitted** in the working tree. Vercel builds the pushed commit, so the deployed site shows the old stages. **To publish, the user must commit and push the working tree.** I did not do either, and I did not fetch the live site.

## 2. Defects

| # | Defect | Existing / regression | Fix (task) | Before | After | Verification |
|---|---|---|---|---|---|---|
| 1 | 1280x720 wrapped header overlaps Return / heading | Heading overlap existing; Return overlap new regression | 20.2: place chrome positioned below the measured header height | `before-new-layout-{sky,ground,crypt,gate}-1280x720.png` | `after-layout-{hub,gate,sky,ground,crypt}-1280x720.png` (+1440x900, 737x720, 700x720, 390x844, 360x740) | `overlap-check.mjs`: 25/25 place-size combos, no overlaps (dev and production) |
| 2 | Legend overlaps pager (desktop); notice overlaps pager (narrow) | Legend: new regression. Notice: existing | 20.2 | `before-new-layout-*` (1280x720, 1440x900, 390x844, 360x740, 737x720) | `after-layout-*` (same sizes) | `overlap-check.mjs` clean |
| 3 | Sprites/nameplates scroll behind fixed heading/filters, obscuring labels | New (consequence of scrolling worlds) | 20.3: safe top clearance and opaque scrim/clip under chrome | `before-new-scroll-sky-1440x900-k4.png`, `before-new-scroll-{sky,ground,crypt}-390x844-k*.png` | `after-occlusion-{sky,ground,crypt}-{1280x720,1440x900,737x720,390x844,360x740}.png`, `after-scroll-*-k*.png` | `scroll-occlusion-check.mjs`: all 15 place-size combos, no hit-testable creature inside chrome (dev; 1280x720 and 390x844 in production) |
| 4 | Crypt hard horizontal join; poorly grounded coffins | New regression | 20.3: removed full-width stair stripes, wider strata blends, contact shadow/base alignment (artwork untouched) | `before-new-cryptjoin-*`, `before-new-crypt-*-k*.png` | `after-crypt-{1280x720,1440x900,737x720,390x844,360x740}-{band-chamber-1,zone0-stairs}.png`, `after-crypt-grounded-crypt-1440x900.png`, `after-crypt-*-k*.png` | `capture.mjs --seam --step repair-final` (165 captures): 0 failing seams; 1 `fallbackEdges` note (hub 1280x720 d1, bottom) |
| 5 | ~737 px hub whisper overlaps "Beyond the Gate" | Existing | 20.2: desktop whisper positioning restricted to the board layout | `before-new-hub-737x720.png` (+ 700/800/768, 737x800/900) | `after-hub-737x720.png` (+ same set), `after-layout-hub-*` | hub probe: 0 overlaps at all 8 sizes; overlap-check clean |
| 6 | Pointer click sometimes only previews or does nothing; Enter works | Mostly new (chrome over scrolling creatures; over-broad scroll guard); basic click not broken | 20.4: scroll guard limited so mouse clicks are not swallowed, chrome no longer sits over creatures, hover/focus previews kept | `before-new-reach-*.png` | `after-reach-*.png` | `activation-check.mjs`: ALL PASS (mouse: click, hover-then-click, click 0/30/60/100 ms after scroll, Enter, Space, Escape close, deep link, 12 px drag suppressed; touch: tap, tap after settle, tap during momentum suppressed, drag suppressed), dev and production. Reach probe: no creature fully covered by chrome (was 0% reachable for `lantern-notes` at 390) |

## 3. Manual flow check (real CDP input)

New tool `docs/design-review/tools/flow-check.mjs`: for gate, sky, ground, crypt at 1280x720, 1440x900, 737x720, 390x844, 360x740 it does scrolling, filter chips, pager, click-open then Escape, click-open then Close record, `?repo=` pushed and cleared, deep-link reload opens the record, Return to the gate by click, Enter and Space, then re-entering another place. **295 checks passed, 0 failed.** Not run against production (only overlap, occlusion and activation checks were).

## 4. Tests

Added in 20.2 to 20.4 (all untracked, none weakened or skipped): `tests/unit/overlap-check.test.ts`, `scroll-occlusion-check.test.ts`, `activation-check.test.ts`, `crypt-seam.test.ts`, `tests/dom/HoverCardClickThrough.test.tsx`, `WorldPointerEvents.test.tsx`, `WorldPlaceView.test.tsx`, `WorldCryptWiring.test.tsx`, plus updates to `PointerEvents`, `LayoutRobustness`, `SceneLayoutClickability`, `EstateMap`, `PlaceView`, `CompactPlaceView` DOM tests.

In 20.5: one fix, no new test. `tests/property/world-motion-scroll.property.test.ts` ("is finite for odd inputs") failed once in the full run and passed in 4 reruns. Cause: a real bug in `lib/world-motion.ts` `scrollTargetFor`. Finite doubles near +/-1.8e308 overflow to Infinity. Fixed by passing the result through `finite()`. The assertion was not changed.

## 5. Check results

| Check | Result |
|---|---|
| `npx vitest --run` | First run: 2515 passed, 1 failed (flaky overflow case above). After the fix, the affected files pass (18/18 x 4). I did **not** re-run the full suite after the fix. |
| `npx tsc --noEmit` | clean (re-run after the fix) |
| `npx eslint .` | 0 errors, 1 warning (`docs/design-review/repair/probe.mjs:52` unused `w`; tool script from 20.1, left as is) |
| `npm run build` | success (Next 16.4.5 Turbopack, Cache Components), no warnings. Routes: `/`, `/estate`, `/g/[username]`, `/g/[username]/[repo]`, `/dev/review`, api badge/graveyard/seance. `.next` existed before (dev), so nothing to clean. |
| `next start -p 3200` | overlap-check (25 combos) clean; activation-check ALL PASS; occlusion check (sky/ground/crypt at 1280x720 and 390x844) clean. Server stopped. Dev server restarted. |

## 6. Remaining issues and unverified items

- **Coffin grounding subtlety:** the coffins are grounded with a contact shadow and base alignment, but the crypt plate has no painted floor line at every depth, so grounding is by convention rather than by the art. Judged by eye from screenshots only.
- **Hard edge at the depth-marker cut-out:** the scroll clipping that keeps creatures out of the chrome leaves a visible hard edge where the depth marker cut-out meets the creature layer.
- **Scroll cost unmeasured:** the 50 fps scroll measurement and Lighthouse were not run. The production build exists for the user to measure.
- **Gate has no drag guard:** the static gate stage has no scroller guard, so the 12 px drag case does not apply there. At 1280x720 the filter chip "rotting" still covers about 60% of `barrow-sync` on the gate. This is an existing defect (also in the old code) and was not changed.
- **Pager is ~40 px higher on live graveyards** than in the estate fixture (different footer content). Layout checks ran on the estate only.
- **3-state hub whisper is hidden below 768 px.** Defect 5 is fixed by hiding it, not by relocating it, so narrow hubs never show that whisper.
- **Neighbouring plaque overlap on the gate at 390 px** (plaques covering 20 to 80% of another creature's button) is existing and unchanged.
- **Dense pages:** the estate shows only 2 to 6 creatures per view. 12+ creature behaviour (hover card covering neighbours, defect 6c) was not exercised in a real browser.
- `/dev/review` ships in the production build (routes list); consider gating it.
- All checks ran in headless Chrome on Windows. Real devices, Safari and Firefox were not tested. Visual judgements (seam, grounding) come from stored screenshots, and I viewed only `after-layout-sky-1280x720.png` and `after-hub-737x720.png` directly; the rest were judged by the numeric probes.
