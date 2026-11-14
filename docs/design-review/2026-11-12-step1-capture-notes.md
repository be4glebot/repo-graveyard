# Step 1 capture notes (2026-11-12)

Tool: `docs/design-review/tools/capture.mjs --step step1`, headless Chrome/Edge over CDP, against `npm run dev` at http://localhost:3000 (responded 200 on `/estate`).

Files: 120 PNGs named `2026-11-12-step1-<place>-<case>-<w>x<h>-d<d>.png`. Viewports 1440x900, 1920x1080, 390x844, 360x740.

| Set | Command scope | Output |
|---|---|---|
| Hub (`/estate`, ghosts-3) | `--places hub,gate --cases ghosts-3 --reduced` | scroll depths d0, d0.5, d1, normal and `-reduced` |
| Gate ghosts-3 | same run | same depths, normal and reduced |
| Gate ghosts-12 and empty | `--places gate --cases ghosts-12,empty --reduced` | same depths, normal and reduced |
| Travel frames (hub to gate) | `--travel` on the first run | `gate-travel-t0`, `-t1150`, `-t2200`, normal and `-reduced`, all 4 viewports |

## Notes

- The harness has no empty case for the Hub. `/estate` is a fixed fixture, so the "empty-place Hub" is covered by the Hub shot only. The empty gate is captured as `gate-empty`. Flag this in the 7.2 review.
- Travel frames were taken only for the gate, because `capture.mjs` skips the hub for travel and the other places are not switched yet.
- Only `step1-hub-ghosts-3-1440x900-d0.png` has been opened so far. It shows the Hub with the four signposts, the turning-soon notice, the whisper line and the plaques at the bottom. The rest are for the 7.2 review.
- No feature code changed. No tools bug fixes were needed.
