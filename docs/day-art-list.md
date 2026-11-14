# Day art list: estate hub, The Open Sky, The Garden Gate, The Keepsake Vault

Purpose: every image these four scenes render, with enough alignment data to paint day versions that drop in without code changes. Nothing here is generated or edited. Sizes were read with a one-off read-only `sharp` metadata call on the files under `public/art/` and `public/art/day/`.

Place names (day copy): hub = the estate map, Sky = The Open Sky (`place` id `sky`), Gate = The Garden Gate (`gate`), Vault = The Keepsake Vault (`crypt`). The Memorial Garden (`ground`) already has day art and is not repeated except where it shares files.

Format per asset: file, exact pixel size, opaque or transparent, what the night version shows, alignment facts.

## 0. What day renders today (read this first)

The design doc says non-ground worlds "keep night art under day tokens". The code has moved on: in day these four scenes draw **no night plate at all**. They draw a CSS gradient from `components/scene/DayPalette.tsx` (tokens `--color-day-sky-top`, `-sky-horizon`, `-meadow-far`, `-meadow-near`), plus the **sun** and the creatures.

| Scene | Night backdrop | Day backdrop now | Switch |
|---|---|---|---|
| Hub | `Sky` gradient + `Backdrop` (`bg-far`, `mg-fence-tile`, `mg-fence`, `fg-frame`) + `Moon` + `Fog` | `DayPalette variant="full"`; `Backdrop` returns `null`; `Fog` returns `null`; `Moon` renders `Sun` | `Sky.tsx`, `Backdrop.tsx`, `Fog.tsx`, `Moon.tsx` |
| Open Sky | `SkyArt`: three `place-sky` crops, stars, bank shade, `Moon` | `DayPalette variant="sky"` per band, no stars, no bank shade, `Sun` | `SkyArt.tsx` |
| Garden Gate | `PlaceBackground` (`place-gate`), `Fog` dense + thin | `DayPalette variant="full"`, no brightness filter, no fog | `PlaceBackground.tsx` |
| Keepsake Vault | `CryptArt`: `place-crypt` crops, ceiling, torches, darkness overlay | `DayPalette variant="meadow"`, no torches, no darkness | `CryptArt.tsx` |

So a day image for any of these scenes **replaces a CSS gradient**, not a night photo. Day files therefore have no night twin to match pixel for pixel, except where the table below says the alignment comes from the night plate's crop geometry. If you paint `place-sky`, `place-gate` or `place-crypt` day plates, keep the night crop focal points readable (section 2 to 4), because the crop code would reuse them unchanged.

Creatures are the same files in day and night, except the tombstone (`tomb-arch-fresh` has a day file, used by the Memorial Garden; none of these four scenes renders tombstones). In day the creature brightness filter is dropped (`WorldCreatures.tsx`), so creatures show as painted.

## 1. Shared creature art (rendered in all four scenes)

All transparent WebP, one file per state and decay level. Chosen by `creatureImage(state, decayLevel)` in `lib/scene-view.ts`; path is `/art/<basename>.webp` through `themeArt(theme, ...)`. None has a day twin, so day falls back to the night file.

| File | Pixels | Alpha | Night version shows | Rendered in |
|---|---|---|---|---|
| `ghost-0.webp` | 592x600 | transparent | healthy ghost (decay 0, under 14 days quiet) | hub (Sky place), Open Sky, any ghost anywhere |
| `ghost-1.webp` | 600x586 | transparent | fading ghost (14 to 30 days) | same |
| `ghost-2.webp` | 600x583 | transparent | flickering ghost (30 to 60 days) | same |
| `ghost-3.webp` | 600x600 | transparent | about-to-turn ghost (60 to 90 days) | same |
| `zombie-0.webp` | 600x600 | transparent | fresh zombie (90 days to 6 months) | hub (Gate place), Garden Gate |
| `zombie-1.webp` | 600x594 | transparent | rotting (6 to 12 months) | same |
| `zombie-2.webp` | 600x597 | transparent | decayed (1 to 2 years) | same |
| `zombie-3.webp` | 573x600 | transparent | skeletal (2 to 3 years) | same |
| `zombie-4.webp` | 600x598 | transparent | ancient (3+ years) | same |
| `risen.webp` | 590x600 | transparent | risen zombie, faint cyan glow, standing | hub (Gate place), Garden Gate |
| `coffin.webp` | 600x318 | transparent | chained coffin | hub (Crypt place), Keepsake Vault |
| `tomb-arch-fresh.webp` | 398x600 | transparent | arched tombstone (day file exists: `day/tomb-arch-fresh.webp`, 398x600, transparent) | hub only, as a Ground representative; not in Sky, Gate or Vault |

Alignment facts for creatures:

- Box size: `CREATURE_BASE_SIZE = 140` px (`lib/estate-view.ts`). In the three scene stages the art is drawn at `140 x scale`, with `scale` from `nameLook(place, name)` (`lib/world-layout.ts`): band 0 about 0.775, band 1 about 0.925, band 2 about 1.075, plus or minus 0.06 jitter, inside `SCATTER_SCALE_MIN/MAX` = 0.7 to 1.15. Rendered width is therefore about 98 to 161 px.
- Hub representatives: decorative, 135 px for ghost, zombie and risen, 90 px for tombstone and coffin (`decorativeArtSize` in `Creature.tsx`), up to 3 per place, bottom-aligned (`items-end`) in a 140 px high row.
- Feet anchor: slot `cy` is the box centre; feet are at `cy + size / 2` and plaques sit above the feet (`plaqueLiftPx`). Contact shadows come from `CreatureShadow` in code, so the painted art must not carry its own ground shadow.
- Mirroring: the Open Sky mirrors about a third of ghosts (`mirrored` in `nameLook`, sky only). Ground tombstones tilt by up to `TOMBSTONE_TILT_DEG`. Keep ghost art free of baked-in text or one-sided lighting.
- Aspect: files are near-square except `coffin` (600x318); both are shown at their own aspect inside the box.
- Night light is dimmed by `brightness(slot.brightness)` per depth band; day shows them unfiltered, so any day backdrop must be lighter-mid-tone enough for the pale ghost art to stay readable.

## 2. Estate map / hub (`EstateMap.tsx`)

### 2.1 Night images

| Layer | File | Pixels | Alpha | Night version shows | Alignment |
|---|---|---|---|---|---|
| Backdrop far | `bg-far.webp` | 1536x1024 | opaque | sky, castle on a cliff, hills | `<FadeArt>` `object-cover object-top`, in a `-inset-[3%]` box (106% of the viewport), `brightness(0.6)`, parallax factor `--f-far` (least) |
| Fence tile | `mg-fence-tile.webp` | 266x595 | transparent | one seamless iron fence section | `background-repeat: repeat-x`, `background-size: auto 100%`, `background-position: 0 bottom`, in a `-inset-[3%] top-[43%]` box, `brightness(0.5)`; the only tile that repeats |
| Fence gate | `mg-fence.webp` | 1536x595 | transparent | gate centrepiece with pillars, drawn once over the tiles | `no-repeat`, `background-size: auto 100%`, `center bottom`, same box and filter, parallax `--f-mid` |
| Foreground | `fg-frame.webp` | 1536x1024 | transparent | dead tree and thorns framing the edges | `background-size: 100% 100%`, `left top`, `-inset-[4%]`, `brightness(0.35)`, parallax `--f-fg` (most) |
| Moon | `moon.webp` | 512x512 | transparent | the data-encoding moon (colour = health) | fixed map position `right-[24%] top-[8%]`, 130 px disc, `Moon.tsx` |
| Far fog | `fog-wisps.webp` | 1536x1024 | transparent | dense wisps | `repeat-x`, `auto 100%`, bottom band, `mix-blend-mode: screen`, opacity = `fogDensity(zombies)` times 0.55 at most, 90 s drift; null at 0 zombies |
| Near fog | `fog-wisps-thin.webp` | 1536x1024 | transparent | thin wisps | same, opacity times 0.25, 55 s drift the other way; null at 0 zombies |
| Creatures | see section 1 | | | up to 3 representatives per place | place centres below |

Also CSS only (no file): night sky gradient (`Sky`), stars, bats and trees from `Atmosphere`, lightning.

Place centres (percent of the board, `PLACE_POSITIONS`, mirrors `PLACE_CENTERS` in `lib/estate-view.ts`; desktop, each link is centred on the point):

| Place | left | top |
|---|---|---|
| sky (Open Sky) | 46% | 20% |
| ground (Memorial Garden) | 20% | 50% |
| crypt (Keepsake Vault) | 78% | 48% |
| gate (Garden Gate) | 46% | 78% |

Each link is a representatives row (min height 140 px) over a plaque up to 260 px wide. Below 768 px the places stack in one column.

### 2.2 Day today

`DayPalette variant="full"` (sky to meadow, hard blend at 52% to 62% of the height), a `Sun` where the moon sits, no fog, no backdrop plates.

### 2.3 Day files that would fit

| Proposed file | Size | Alpha | Alignment |
|---|---|---|---|
| `day/bg-far.webp` | 1536x1024 | opaque | same box and `object-cover object-top` as night; keep the horizon at about 52% to 62% of the height so the four place links, centred at 20%, 48% to 50% and 78%, land on ground not sky; the sun is code-placed at `right-[24%] top-[8%]`, so leave that area clear |
| `day/mg-fence-tile.webp`, `day/mg-fence.webp`, `day/fg-frame.webp` | 266x595, 1536x595, 1536x1024 | transparent | reuse the existing Memorial Garden day files; they already match these sizes and slot into `Backdrop` unchanged if `themeArt` is applied there |

Not required: the hub is functional with only a `bg-far` day plate.

## 3. The Open Sky (`WorldPlaceView` > `SkyArt`)

### 3.1 Night images

| Layer | File | Pixels | Alpha | Night version shows | Alignment |
|---|---|---|---|---|---|
| Sky plate crops | `place-sky.webp` | 1536x1024 | opaque | cloudy night sky with a painted moon | three crops through `CropLayer` (`PLATE_SIZE["place-sky"]` = 1536x1024), `WORLD_ART.sky` table below, wrapper fill `--color-night-sky` |
| Moon | `moon.webp` | 512x512 | transparent | data moon drawn over the painted moon | centre and size from `skyMoonPlacement` = `plateToStage(crop, element, 0.75, 0.14)`, diameter = `0.065 x 1536 x crop.scale` (about 100 px native, so 125 to 175 px at 1280 to 1920 wide) |
| Creatures | ghost-0 to ghost-3 | section 1 | | ghosts only | slots from `computeWorldLayout("sky", ...)`; a third mirrored |

Crop table (`WORLD_ART.sky` in `lib/world-art.ts`; `fx/fy` = focal on the plate, `ax/ay` = where it lands in the crop):

| Stratum | focal | anchor | flip | offset | night filter |
|---|---|---|---|---|---|
| `high-air` | 0.75, 0.14 (the painted moon) | 0.75, 0.22 | none | none | `brightness(0.8)` |
| `mid-sky` | 0.30, 0.50 | 0.50, 0.50 | horizontal | none | `brightness(0.75)` |
| `cloud-bank` | 0.35, 0.86 | 0.35, 0.66 | none | x +0.30 | `brightness(0.8)` |

Constraints: `MAX_UPSCALE` = 1.75 at 1920 px wide. Bands include a bleed (`bleedPx`, at least 8 px) and a 6% edge mask. The empty sky (`EmptyScene`, zero ghosts) uses one crop with the same moon focal and anchor 0.75, 0.22 at `brightness(0.8)`, plus the sun at the same moon coordinates in day. The loading shell `ShellBackdrop` also draws `place-sky` at brightness 0.8.

Also CSS only: star field (`STARS`), cloud wisps (`EnvMist`), bank shade.

### 3.2 Day today

`DayPalette variant="sky"` in each band, no stars, no bank shade, `Sun` at the painted-moon placement, creatures unfiltered.

### 3.3 Day files that would fit

| Proposed file | Size | Alpha | Alignment |
|---|---|---|---|
| `day/place-sky.webp` | 1536x1024 | opaque | must keep the same three crops working: a sun position at 75% x, 14% y of the plate (diameter about 100 px, or leave the sky clear there because the code `Sun` is drawn on top); the flipped `mid-sky` crop mirrors the left half, so avoid text or one-sided landmarks; the `cloud-bank` crop looks at 35% x, 86% y, so put soft cloud there |

To apply it, add `"/art/place-sky.webp": "/art/day/place-sky.webp"` to `DAY_ART` and route `SkyArt` through `themeArt`. Not done in this task.

## 4. The Garden Gate (`GatePlaceView`, id `gate`)

### 4.1 Night images

| Layer | File | Pixels | Alpha | Night version shows | Alignment |
|---|---|---|---|---|---|
| Place backdrop | `place-gate.webp` | 1536x1024 | opaque | muddy path to a wrought-iron gate under a red dusk sky | `PlaceBackground`: `next/image` with `fill`, `object-cover`, in a `-4%` inset box (`GATE_BLEED_INSET`, wider than the other places for the idle drift), `brightness(0.85)`, `camera-drift` of 6 px, top and bottom legibility gradients of at least 15% height each; solid `--color-night-sky` fill underneath |
| Far fog | `fog-wisps.webp` | 1536x1024 | transparent | dense wisps | z 10, below creatures; parallax about 16 px; null at 0 zombies |
| Near fog | `fog-wisps-thin.webp` | 1536x1024 | transparent | thin wisps | z 25, above creatures; parallax about 26 px |
| Creatures | zombie-0 to zombie-4, risen | section 1 | | zombies and risen | `DepthScatter`: back, middle and front depth rows, scale 0.7 to 1.15, seeded by name; freshest zombies nearest the gate |

Not cropped through `CropLayer`: this place has no crop table. Cover math is plain `object-cover`, so the focal region is the image centre. The painted gate sits near the middle of the plate; keep it there. Also CSS only: ancient-zombie lightning, `Atmosphere`.

### 4.2 Day today

`DayPalette variant="full"`, no brightness filter, no fog, no lightning change.

### 4.3 Day files that would fit

| Proposed file | Size | Alpha | Alignment |
|---|---|---|---|
| `day/place-gate.webp` | 1536x1024 | opaque | `object-cover` over the viewport plus 4% bleed, so the central 80% of the width and height must hold everything important; leave the lower 40% open for creature rows and plaques; the same path and gate position as the night plate keeps the zombies standing on the path |

## 5. The Keepsake Vault (`WorldPlaceView` > `CryptArt`, id `crypt`)

### 5.1 Night images

| Layer | File | Pixels | Alpha | Night version shows | Alignment |
|---|---|---|---|---|---|
| Chamber crops | `place-crypt.webp` | 1536x1024 | opaque | vaulted stone hall with chains, candles and a red banner | one crop per chamber via `CropLayer`; table below; ambient darkness overlay on top |
| Creatures | `coffin.webp` | 600x318 | transparent | chained coffins | 4 per chamber (`CHAMBER_SIZE`), 2 columns, slots from `computeWorldLayout("crypt", ...)`; chain reveal animation runs in code |

Crop table (`WORLD_ART.crypt`):

| Stratum | focal | anchor | flip | offset | filter / tint |
|---|---|---|---|---|---|
| `entry` | 0.47, 0.42 | 0.50, 0.55 | none | none | `brightness(0.7)` |
| `chamber-1` | 0.50, 0.60 | 0.50, 0.55 | none | x -0.30 | none, warm tint |
| `chamber-2` | 0.50, 0.60 | 0.50, 0.55 | horizontal | none | `brightness(0.85)`, cool tint |
| `chamber-3` | 0.30, 0.62 | 0.40, 0.55 | none | x +0.25 | `brightness(0.7)` |
| later chambers | alternate the `chamber-2` crop (offset x -0.25) and the `chamber-3` crop (offset x +0.50) | | | | |

The empty vault (`EmptyScene`) uses one crop: focal 0.50, 0.45, anchor 0.50, 0.45, `brightness(0.7)`, no edge mask. Also CSS only: ceiling and ribs, torch glow, arch and steps, rail edges, chain shadow, dust through `EnvMist`, blend zones. The loading shell also draws `place-crypt`.

### 5.2 Day today

`DayPalette variant="meadow"` per chamber, none of the dark decor, no darkness overlay, no blend zones.

### 5.3 Day files that would fit

| Proposed file | Size | Alpha | Alignment |
|---|---|---|---|
| `day/place-crypt.webp` | 1536x1024 | opaque | the same crops are cut from it several times with flips and offsets of 25 to 30%, so it needs a uniform, tileable-looking interior with no single landmark; the lower half is where coffin rows stand |

## 6. The sun (all four scenes plus the empty sky)

`components/scene/Sun.tsx`, used wherever `Moon` would render in day (`Moon.tsx` swaps it in with the same placement).

| File | Status | Size | Alpha | Night counterpart | Alignment |
|---|---|---|---|---|---|
| `public/art/day/sun.webp` | **to be supplied** (not on disk; `Sun.tsx` requests `/art/day/sun.webp` and hides the image on error) | suggested 512x512, same as `moon.webp` | transparent | `moon.webp` (512x512, transparent) | square, disc centred, `object-contain` in a round box; keep the disc at about 70% to 80% of the canvas with a soft rays or halo fading to full transparency before the edge, so no square outline shows |

Placements: hub `right-[24%] top-[8%]`, 130 px box. Open Sky: centre and diameter from `skyMoonPlacement` (about 125 to 175 px at 1280 to 1920 wide). Empty sky: `moon.x, moon.y, moonD` from the crop of `PAINTED_MOON` (fx 0.75, fy 0.14, `diamFrac` 0.065). Displayed sizes stay under about 190 px, so 512 px has margin for 2x screens.

CSS fallback (current, already live): a `rounded-full` disc with `radial-gradient(circle at 50% 50%, --color-day-sun-core 0%, --color-day-sun-mid 55%, --color-day-sun-edge 100%)` and `box-shadow: 0 0 110px 36px --color-day-sun-glow` (scaled by `glowScale`). Tokens: core `#fff6d6`, mid `#ffd98a`, edge `#f0a43c`, glow `rgb(255 200 90 / 0.55)`. The painted image, when present, draws over this disc, so keep it opaque enough to cover the disc or intentionally transparent to let the glow show.

## 7. Assets shared between scenes

| Asset | Used by |
|---|---|
| `ghost-0..3` | hub (Sky place), Open Sky |
| `zombie-0..4`, `risen` | hub (Gate place), Garden Gate |
| `coffin` | hub (Crypt place), Keepsake Vault |
| `tomb-arch-fresh` (night and day) | hub (Ground place), Memorial Garden |
| `moon` (night) / `sun` (day) | hub, Open Sky, empty sky; the Moon is also used in the Gate and Vault only if placed there (it is not today) |
| `fog-wisps`, `fog-wisps-thin` | hub, Garden Gate, Memorial Garden; also the shell fog and travel transition (`fog-wisps`); none has day art, none renders in day |
| `place-sky` | Open Sky crops, empty sky, loading shell, travel preload |
| `place-gate` | Garden Gate, loading shell, travel preload, site metadata fallback image (`lib/site-meta.ts`) |
| `place-crypt` | Keepsake Vault crops, empty vault, loading shell, travel preload |
| `place-ground` (night and day) | Memorial Garden (day done), loading shell |
| `bg-far`, `mg-fence`, `mg-fence-tile`, `fg-frame` | hub `Backdrop`; `mg-fence*`, `fg-frame`, `mausoleum` also in the Memorial Garden (day versions exist) |

The travel transition preloads `/art/place-<place>.webp` through `themeArt`, so adding a day plate to `DAY_ART` also changes what is preloaded.

## 8. Summary of day files and their status

| File | Scene | Pixels | Alpha | Status |
|---|---|---|---|---|
| `day/sun.webp` | hub, Open Sky, empty sky | 512x512 suggested | transparent | to be supplied (CSS sun fallback live) |
| `day/place-sky.webp` | Open Sky | 1536x1024 | opaque | optional |
| `day/place-gate.webp` | Garden Gate | 1536x1024 | opaque | optional |
| `day/place-crypt.webp` | Keepsake Vault | 1536x1024 | opaque | optional |
| `day/bg-far.webp` | hub | 1536x1024 | opaque | optional |
| `day/mg-fence*.webp`, `day/fg-frame.webp`, `day/tomb-arch-fresh.webp`, `day/mausoleum.webp`, `day/place-ground.webp`, `day/bird-*.webp` | Memorial Garden / hub reuse | already on disk | per file | done |

Verification run: metadata read from every `.webp` in `public/art/` and `public/art/day/`; no file was written.
