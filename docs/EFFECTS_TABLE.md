# Effects Table

Every visual effect in an Explorable World has a row here, a row in `WORLD_EFFECTS` (`lib/world-effects.ts`) and a `data-effect` tag in components. Kinds: `data` (tied to a creature field), `story` (environment, no data claim), `blend` (depth, seams, legibility). At most 4 ambient effects per place.

| Id | Places | Kind | Field or purpose | Ambient |
|---|---|---|---|---|
| `creature-motion` | sky, ground, crypt | data | `state, decayLevel` | no |
| `moon-glow` | sky | data | `moonTreatment` | no |
| `ghost-rim-glow` | sky | data | `daysQuiet` | no |
| `ghost-lantern` | sky | data | `decayLevel` | no |
| `tombstone-moss` | ground | data | `daysQuiet` | no |
| `fresh-earth` | ground | data | `daysQuiet` | no |
| `contact-shadow` | sky, ground, crypt | blend | grounds standing creatures; direction from Light_Source | no |
| `star-twinkle` | sky | story | stars twinkling in thin air | yes |
| `cloud-drift` | sky | blend | EnvMist sway | yes |
| `bats` | sky | story | existing Atmosphere bats | yes |
| `ground-mist` | ground | blend | EnvMist along the ground | yes |
| `path-lantern-flicker` | ground | story | path-side lanterns flicker | yes |
| `ravens` | ground | story | at most two ravens placed by name hash, perched and static | no |
| `candle-glow-reveal` | ground | story | one-shot candle glow on first view | no |
| `torch-flicker` | crypt | story | wall torches flicker | yes |
| `crypt-dust` | crypt | blend | EnvMist at the crypt token | yes |
| `chain-reveal` | crypt | story | one-shot chain reveal | no |
| `chamber-darkness` | crypt | blend | `ambientBrightness(depth)` overlay | no |
| `scroll-parallax` | sky, ground, crypt | blend | band offsets from scroll | no |
| `vignette` | sky, ground, crypt | blend | existing Atmosphere vignette, static | no |
| `grain` | sky, ground, crypt | blend | existing Atmosphere grain, static | no |
| `cobwebs` | sky, ground, crypt | story | existing Atmosphere corner cobwebs, static | no |
| `legibility-gradient` | sky, ground, crypt | blend | top and bottom legibility gradients | no |
