# Final capture notes (2026-11-13)

Task 19.1 (explorable-worlds). Tool: `node docs/design-review/tools/capture.mjs --step final --places hub,gate,sky,ground,crypt --depths 0,0.25,0.5,0.75,1 --reduced --travel --seam`, headless Chrome/Edge over CDP, against `npm run dev` at http://localhost:3000 (root responded 200 before the run). `--step final` was passed explicitly, so no baseline file was touched.

Files: 536 PNGs plus `2026-11-13-final-seam-probe.json`. Viewports 1440x900, 1920x1080, 390x844, 360x740. The date prefix is 2026-11-13 (the tool uses today's date), so these do not collide with the 2026-11-12 sets.

| Set | Output |
|---|---|
| Case shots (hub, gate: ghosts-3; sky: ghosts-3, empty, ghosts-12; ground: empty, tombstones-3, tombstones-12; crypt: empty, coffins-3, coffins-12) | `2026-11-13-final-<place>-<case>-<w>x<h>-d<0,0.25,0.5,0.75,1>.png` (440 files: 11 cases x 2 motion modes x 4 viewports x 5 depths) |
| Reduced motion | same, case suffixed `-reduced` |
| Travel frames | `2026-11-13-final-<place>-travel-t0/t1150/t2200[-reduced]-<w>x<h>-d0.png` (96 files: 4 places x 3 frames x 2 modes x 4 viewports) |
| Seam probe | `2026-11-13-final-seam-probe.json` (440 entries: hub 40, gate 40, sky 120, ground 120, crypt 120) |

## Seam probe

Pass limit is the tool's `pass` flag (share below 10%). Shares in the JSON are fractions.

| Place | Zone | Measurements | Max share | Failures |
|---|---|---|---|---|
| sky | haze | 80 | 0.5% | 0 |
| ground | haze | 76 | 3.9% | 0 |
| ground | crossfade | 6 | 0.3% | 0 |
| crypt | stairs | 64 | 0.9% | 0 |
| crypt | arch | 22 | 0.6% | 0 |

- **Seam failures: none.** 0 failing seam measurements and 0 failing fallback edges (no fallback edges were reported at all).
- This is a change from the earlier crypt capture (21 `stairs` failures, up to 14.3%). The probe now reports at most 0.9% for `stairs`.
- Hub and gate entries have no blend zones (empty `seams`), as expected. The `empty` cases of the worlds also have no seams.

## Notes

- Travel frames exist for sky, ground, crypt and gate (4 places). I did not confirm that the tool takes hub travel frames; the hub is the start of every travel, so I did not expect them. No `final-hub-travel` files were written.
- Depths 0.25/0.5/0.75/1 were captured for every case, including one-screen cases and `empty`. Duplicates of d0 are expected there.
- Filenames read `final-<place>-...` as the task asks (no doubled place name, since the step name is `final`).
- I did not open any PNGs. Visual judgement is for 19.2.
- No feature code or tool changes. No tests run. I did not run `--help` or any other flag outside the documented ones.
