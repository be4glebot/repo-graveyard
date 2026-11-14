# Crypt capture notes (2026-11-12)

Task 16.1 (explorable-worlds). Tool: `node docs/design-review/tools/capture.mjs --step crypt --places crypt --cases coffins-3,empty,coffins-12 --depths 0,0.25,0.5,0.75,1 --reduced --travel --seam`, headless Chrome/Edge over CDP, against `npm run dev` at http://localhost:3000 (`/dev/review?place=crypt&case=coffins-3` returned 200).

Files: 144 PNGs (120 case shots + 24 travel frames) plus `2026-11-12-crypt-seam-probe.json`. Viewports 1440x900, 1920x1080, 390x844, 360x740.

| Set | Output |
|---|---|
| Crypt coffins-3, empty, coffins-12 | `2026-11-12-crypt-crypt-<case>-<w>x<h>-d<0,0.25,0.5,0.75,1>.png` |
| Reduced motion | same, case suffixed `-reduced` |
| Travel frames (hub to crypt) | `2026-11-12-crypt-crypt-travel-t0/t1150/t2200[-reduced]-<w>x<h>-d0.png` |
| Seam probe | `2026-11-12-crypt-seam-probe.json` (120 entries: 3 cases x 2 motion modes x 4 viewports x 5 depths) |

## Seam probe

The JSON shape differs from ground: each entry has a `seams` array (zone, y, above, below, share, pass) and `fallbackEdges`.

- 86 seam measurements across 80 entries. No fallback edges reported.
- Zones: `stairs` (all cases with coffins) and `arch` (coffins-12 only, 22 measurements, all pass).
- **`stairs` has 21 failing measurements** (share above the pass limit; the failing ones sit around 10 to 14%). Largest: 14.3% (coffins-3-reduced, 360x740, d0), then 14.2% (coffins-3, 360x740, d0), 14.0% (coffins-12-reduced, 360x740, d0).
- Failures by case: coffins-3 4, coffins-3-reduced 8, coffins-12 4, coffins-12-reduced 5 (21 in total, all `stairs`). Every case/motion pair fails at 1440x900, and at 360x740 and 390x844 it fails at more depths in reduced motion (up to 4 at 360x740). The worst values are at d0 on the narrowest viewport.
- I did not confirm the exact pass limit for `stairs` from the tool source; I read it from each entry's `pass` flag. Check it in 16.2.
- The 40 `empty` entries (both motion modes) have no seams at all. Same as ground: probably expected for a one-screen empty world, but not confirmed.

## Notes

- Filenames read `crypt-crypt-...`: `buildFilename` writes `<step>-<place>-<case>`, and the step name is `crypt`. Not changed (same as sky and ground).
- Depths 0.25/0.5/0.75/1 were captured for every case, including `empty` and any case that is one screen long. Duplicates of d0 are expected there. Drop them in the review.
- The task text says "scroll 0/50/100%", and this capture also includes 25% and 75%.
- Travel frames were taken from `/estate` by clicking the crypt place. Not opened.
- Mistake on my side: I ran `capture.mjs --help` to check flags. The tool has no help mode and started a default baseline run (hub, gate, sky, ground partially) that I let time out. It rewrote some `2026-11-12-baseline-*` PNGs in `docs/design-review/` (up to `baseline-ground-empty-1440x900`). They are regenerated from the same pages, but anyone relying on the earlier baseline shots should recapture them. `docs/design-review/` is untracked, so git can't restore them.
- I did not open any PNGs. Visual review is for 16.2.
- No feature code changed. No tool changes were needed. No tests run.
