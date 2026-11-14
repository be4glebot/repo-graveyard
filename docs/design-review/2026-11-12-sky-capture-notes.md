# Sky capture notes (2026-11-12)

Tool: `node docs/design-review/tools/capture.mjs --step sky --places sky --cases ghosts-3,empty,ghosts-12 --reduced --travel`, headless Chrome/Edge over CDP, against `npm run dev` at http://localhost:3000 (responded 200 on `/dev/review?place=sky&case=ghosts-3`).

Files: 96 PNGs, viewports 1440x900, 1920x1080, 390x844, 360x740.

| Set | Output |
|---|---|
| Sky ghosts-3, empty, ghosts-12 | `2026-11-12-sky-sky-<case>-<w>x<h>-d<0,0.5,1>.png` |
| Reduced motion | same, case suffixed `-reduced` |
| Travel frames (hub to sky) | `2026-11-12-sky-sky-travel-t0/t1150/t2200[-reduced]-<w>x<h>-d0.png` |

## Notes

- Filenames read `sky-sky-...`: `buildFilename` writes `<step>-<place>-<case>`, and the step name is `sky`. The task's `sky-<case>` pattern would need step `sky` with the place dropped; not changed.
- Depths 0/0.5/1 were captured for every case, including `empty`, which may be length 1. Duplicates at d0.5 and d1 for a one-screen case are expected. Drop them in the review if they match d0.
- **Seam probe not run.** `capture.mjs` has no seam probe flag and no 0.25/0.75 depths in its defaults. `page-probes.mjs` has the pure helpers (`runSeamProbe`, `blendJoinsExpression`) but nothing calls them. The depths 0.25 and 0.75 can be captured with `--depths 0,0.25,0.5,0.75,1`, but the probe table for 10.2 needs the probe wired in (a tool change) or a manual run. Flag this for 10.2.
- Travel frames were taken from `/estate` by clicking `estate-place-sky`. Not opened.
- Only `sky-sky-ghosts-3-1440x900-d0.5.png` was opened. It shows the world rendering: heading, filter chips, 3 ghosts with name tags, pager, and a "Altitude: high" label with two dots at the right edge. That label looks like unstyled text (possibly a screen-reader-only or debug element showing). A Next dev "2 Issues" badge is bottom left. Both are for the 10.2 review.
- No feature code changed. No tool bug fixes were needed. No tests run.
