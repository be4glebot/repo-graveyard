# Ground capture notes (2026-11-12)

Task 13.1 (explorable-worlds). Tool: `node docs/design-review/tools/capture.mjs --step ground --places ground --cases tombstones-3,empty,tombstones-12 --depths 0,0.25,0.5,0.75,1 --reduced --travel --seam`, headless Chrome/Edge over CDP, against `npm run dev` at http://localhost:3000 (`/dev/review?place=ground&case=tombstones-3` returned 200).

Files: 144 PNGs (120 case shots + 24 travel frames) plus `2026-11-12-ground-seam-probe.json`. Viewports 1440x900, 1920x1080, 390x844, 360x740.

| Set | Output |
|---|---|
| Ground tombstones-3, empty, tombstones-12 | `2026-11-12-ground-ground-<case>-<w>x<h>-d<0,0.25,0.5,0.75,1>.png` |
| Reduced motion | same, case suffixed `-reduced` |
| Travel frames (hub to ground) | `2026-11-12-ground-ground-travel-t0/t1150/t2200[-reduced]-<w>x<h>-d0.png` |
| Seam probe | `2026-11-12-ground-seam-probe.json` (120 entries: 3 cases x 2 motion modes x 4 viewports x 5 depths) |

## Seam probe

- 80 seam measurements, all with `pass: true` (zone `haze`, limit 10% of full scale). Largest difference share was 1.8%. No fallback edges reported.
- The 40 entries with no seam are all the `empty` case (both motion modes, every viewport and depth): the probe found no blend join to measure there. Likely expected for an empty world, but not confirmed. Check in 13.2 that `empty` really has no join.
- Only the `haze` zone appeared. No other zones were measured for ground.

## Notes

- Filenames read `ground-ground-...`: `buildFilename` writes `<step>-<place>-<case>`, and the step name is `ground`. The task's `ground-<case>` pattern would need the place dropped; not changed (same as the sky capture).
- Depths 0.25/0.5/0.75/1 were captured for every case, including `empty` and any case that is one screen long. Duplicates of d0 are expected there. Drop them in the review.
- The task text says "scroll 0/50/100%", and this capture also includes 25% and 75%.
- Travel frames were taken from `/estate` by clicking the ground place. Not opened.
- I did not open any PNGs. Visual review is for 13.2.
- No feature code changed. No tool changes were needed (the seam probe is now wired in via `--seam`). No tests run.
