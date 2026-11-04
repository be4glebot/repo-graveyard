# Repo Graveyard — art prompt pack

Generate these in ChatGPT (or any image tool whose terms let you own and use the output). Keep every asset in **one chat** so the style stays consistent, and generate the **first image of each family** before the variants ("same character, same pose, same framing, now…").

Save as PNG, then convert to WebP (squoosh.app) and drop into `public/art/`. Log every file in `CREDITS.md`:
`public/art/ghost-0.webp — generated with ChatGPT image generation, edited by me`.

---

## 1. Style anchor (paste at the start of EVERY prompt)

> Dark gothic storybook illustration. Rough hand-inked linework with scratchy cross-hatching, dry-brush charcoal texture, smudged and uneven edges, visible paper grain and grime. Desaturated palette: ash grey, bone white, bruised purple-black, sickly olive green, with one accent of deep blood red. Heavy shadow, strong readable silhouette, cold moonlight from the upper right. Dreadful and unsettling, wrong proportions, but NOT gory (no blood spatter, no organs), NOT cute, NOT cartoonish, NOT photorealistic. No text, no border, no logo.

For creatures and cut-out props, add:

> Transparent background, full figure centered, nothing cropped, no ground, no cast shadow, 1024×1024.

If the background comes back solid, remove it in Photopea or remove.bg.

**The fear rules:** elongated limbs, fingers too long, heads at broken angles, pinprick eyes deep in hollow sockets, mouths stretched too far, torn cloth, a body that is *slightly wrong*. Dread comes from wrongness and stillness, not gore.

---

## 2. Ghosts (4 decay levels = days quiet)

All facing three-quarters toward the viewer, floating, same pose across levels so the swap feels like decay.

- **ghost-0 · Healthy:** A tall wailing wraith in a tattered burial shroud, elongated hollow eye sockets, jaw stretched long in a silent scream, long thin fingers trailing from torn sleeves, the lower body dissolving into wisps of smoke. A faint cold blue light glows inside the shroud.
- **ghost-1 · Fading:** Same wraith, same pose. The inner glow is dimmer, the edges of the shroud fray and thin out, the body more transparent.
- **ghost-2 · Flickering:** Same wraith. The shroud is ripped into hanging strips, black streaks run down from the eye sockets, parts of the body are breaking into drifting ash.
- **ghost-3 · About to turn:** Same wraith, half dissolved, the form glitching apart into ash and smoke. The eye sockets glow faint blood red, and grey rot creeps up from the bottom of the shroud as if it is becoming a corpse.

## 3. Zombies (5 decay levels = months/years quiet)

All lurching left-to-right, same pose across levels.

- **zombie-0 · Fresh:** A gaunt shambling corpse lurching forward, spine hunched, one arm reaching out with too-long fingers, the head hanging at a broken angle, jaw slack, pinprick yellow eyes in sunken sockets, torn burial clothes, grey-green mottled skin.
- **zombie-1 · Rotting:** Same corpse, same pose. Skin darker and peeling, clothes shredded to rags, dirt caked on the legs.
- **zombie-2 · Decayed:** Same corpse. The trailing arm is gone below the elbow, ribs show through a torn shirt, part of the skull shows through the scalp.
- **zombie-3 · Skeletal:** Same pose, now mostly bone with scraps of leathery skin and cloth, the eyes are tiny red points.
- **zombie-4 · Ancient:** Same pose, blackened bones, moss and thin roots grown through the ribcage, clumps of grave dirt, red pinprick eyes.

## 4. The decided

- **risen:** A corpse standing upright for the first time, arms hanging, head raised, climbing out of a broken grave of dirt, cold blue light glowing in its eye sockets. Hopeful but still unsettling.
- **tomb-arch / tomb-cross / tomb-gothic (fresh):** A weathered stone headstone (rounded top / Celtic cross / pointed gothic arch), blank face for the name, a single lit candle at its base.
- **tomb-arch / tomb-cross / tomb-gothic (old):** The same headstone leaning, cracked, thick moss and ivy, the candle burned down to a stub.
- **coffin:** A dark wooden coffin lying flat, wrapped in heavy iron chains with a padlock, seen from slightly above.
- **mausoleum:** A small gothic stone crypt with a pointed roof, iron door slightly ajar showing blackness inside. Front view.

## 5. Backdrop plates (parallax layers, 2560×1440)

These give the scene its depth. Each layer moves at a different speed with the mouse/scroll.

- **bg-sky (no transparency):** A stormy night sky, heavy rolling clouds, a bruised dark red glow along the horizon, faint stars in the gaps. **Leave the upper right empty with no moon** (the moon is drawn in code because its color shows data).
- **bg-castle (transparent):** A crumbling gothic castle on a jagged rock crag, tall thin spires, a few windows with warm candlelight, one high tower window glowing blood red. Silhouette-heavy, small in frame, right side.
- **bg-hills (transparent):** Rolling dead hills with leafless twisted trees and crooked old gravestones in the far distance, very dark, low contrast.
- **mg-fence (transparent):** A long wrought-iron cemetery fence with spear-tipped bars and stone pillars, a tall arched iron gate in the center, two ravens perched on the gate pillars. Front view.
- **fg-frame (transparent):** Foreground framing: a gnarled dead tree trunk on the far left with branches reaching across the top, thorny weeds and dead grass along the bottom edge, very dark, almost black.
- **tex-grime (tileable, 1024×1024):** A seamless dark paper texture with scratches, dust, stains and ink speckles, for an overlay at low opacity.

---

## How the code still encodes data

The images carry the *look*. Code keeps the *facts*:
- Which decay image shows = days quiet (lifecycle rules).
- Glow strength, flicker speed, sway: CSS / Framer Motion on top of the image.
- Moon color, fog density and lightning frequency stay drawn in code.
- Parallax, grain and vignette are layered in code over the plates.

## Disclosure (for the README and Devpost)

> Creature and backdrop art was generated with ChatGPT image generation from prompts in `docs/ART_PROMPTS.md`, then cleaned up by me. All application code, specs, hooks and steering were built with Kiro.
