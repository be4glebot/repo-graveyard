# Hallowed Ground polish (task 21.1)

Shots: `shoot.mjs <tag>` against live /g/defunkt (GitHub fetch worked), plots 1 and 3, 1440x900 and 390x844.
"top" = scrollTop 0 (fence visible), "scrolled" = 55% of the world.
Files: `before-*.png`, `after-*.png` (plot1/plot3, top/scrolled, plus metrics json).

## Before
- Stones ran over the fence/gate and up behind the heading and chrome.
- One tombstone per step pressed to the far edges (about 490 px off the path at 1440).
- Fog: wisps cropped to a hard 420 px slab with a 6% linear edge: visible straight bands.

## Iteration 1 (kept)
- `pathSpan` / `ribbonStones`: stones only from below the fence base (+12 px, never above the top chrome clearance) to 10 px above the mausoleum base.
- `placeGround`: inner lane at corridor/2 + plaque half, outer lane one plaque width (+12 px) beyond; pairs alternate lanes, so each side holds two staggered rows. Counts up to 4 stay in the inner lane. Width too small for two lanes: one lane per side (old far-edge placement on narrow screens).
- Fog: `feather` radial mask (closest-side ellipse, eased), box 12% wider than the viewport on each side, mist layer >= 1.2x the box so the sway never shows an edge. Sky and crypt keep the linear mask.

## After (read in the viewer)
- 1440 top: no stones on the fence or under the heading; Unicorn / github-gem flank the path with a clear corridor, facebook in the outer lane; labels readable, no overlaps.
- 1440 scrolled: four x bands visible, staggered; fog has no rectangular border.
- 390: single lane per side, same as before (width cannot hold more). A later tombstone body can still cover the lower edge of the label above it at 390 (pre-existing z-order, unchanged).

## Checks
- overlap-check ground: no overlaps at 1280x720, 1440x900, 737x720, 700x720, 390x844, 360x740.
- activation-check ground (mouse + touch): ALL PASS.
- Test assertion updated: GroundArt "exactly ceil(H/90) stones" -> stones inside `pathSpan` (at most ceil(H/90)); reason: the requested clamp removes stones by design.

# Zoom extremes (task 22.1)

Shots: `shoot.mjs zoom-before|zoom-after --sizes WxH` at CSS viewports 2880x1620, 3840x2160, 5120x2880, 320x480, 400x300, plots 1 and 3, top and scrolled. `probe.mjs WxH` prints mist/image boxes. Headless Chrome crashes when it captures a page this large at dsf 1, so `shoot.mjs` now uses dsf 0.5 (> 2000 wide) or 0.3 (> 4000) and `--disable-gpu` (CSS size unchanged; the PNG is just smaller). Large shots show dark rectangles from tiles the headless rasteriser had not painted; they are capture artefacts, not page bugs.

## Root causes
- Fog: the wide-screen cut-off was NOT in the ground's own feathered mist (that already scaled with the viewport) but in the per-stratum mist that `WorldPlaceView` renders for every place (`EnvMist` without `width`): a fixed 2048 px layer centred in a box as wide as the stage. At 3840 it was a 2048 px slab with hard vertical edges (zoom-before-3840x2160-plot1-scrolled.png, zoom-before-5120x2880-*); probe at 5120: image 1488..3536 in a 5105 px box.
- Tombstones: lane offsets are fixed px from the path (corridor 160 + plaque), correct up to 1920 but a thin column on 3840+ screens where the painted path is scaled up. Tiny viewports were already on the one-lane rules; bounds/overlap hold (property test below).

## Fix
- `EnvMist`: new `mistLayerWidth(viewportW, feather)` (>= stage (+12% overscan each side when feathered) x 1.2 for sway, never below the old 2048) and a `viewportW` prop used when no `width` is given. `WorldPlaceView` passes `viewportW` to both stratum mist layers; `GroundArt` uses the same helper (same value as before). Ordinary screens (<= ~1700) are unchanged. This also covers sky and crypt on wide screens (only widens the layer, same look).
- `placeGround`: corridor scale `spread = clamp(w / 1920, 1, 2)` (`GROUND_DESIGN_W`, `GROUND_SPREAD_MAX` in config): inner lane = 80 * spread + plaque half; outer lane follows. Unchanged for w <= 1920.

## After (read in the viewer)
- zoom-after-3840x2160-plot1-scrolled.png and zoom-after-5120x2880-plot1-scrolled.png: wisps run edge to edge with soft ends; stones flank the path a bit wider.
- zoom-after-400x300 / 320x480: unchanged (single lane).

## Not fixed (outside the ground art)
- At 320x480 and 400x300 the chrome (header, return button, title, pager) fills the whole screen, so the first screen shows almost no scene and the heading overlaps the pager and the "mausoleum approach" depth tag; the "scrolled" shots look like the top ones. Needs a compact-chrome pass.
- Painted plates and set dressing are scaled by cover, so on 3840+ the art is soft/magnified while stones stay px-sized (natural browser-zoom behaviour).
- On a 5000 px wide stage the mist is the same bottom-anchored 420 px strip per stratum; bands between strata stay clear by design.
