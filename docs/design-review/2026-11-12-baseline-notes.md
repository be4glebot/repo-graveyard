# Baseline notes: original app before Explorable Worlds (2026-11-12)

Tool: `docs/design-review/tools/capture.mjs` against the dev server, with the dev-only `/dev/review` harness rendering the original `PlaceView`. Scroll position 0.

Viewports: 1440x900, 1920x1080, 390x844, 360x740.

Files: 44 PNGs, named `2026-11-12-baseline-<place>-<case>-<w>x<h>.png`. Checked by `tests/unit/baseline-manifest.test.ts`.

| Place | Cases | Files |
|---|---|---|
| hub (`/estate`) | ghosts-3 | 4 |
| gate | ghosts-3 | 4 |
| sky | ghosts-3, empty, ghosts-12 | 12 |
| ground | empty, tombstones-3, tombstones-12 | 12 |
| crypt | empty, coffins-3, coffins-12 | 12 |

## What the original looks like (1440x900 views opened)

- Hub: the sample estate as one scene. Moon and dead trees over a gate, with four framed signposts (Restless Sky, Hallowed Ground, The Crypt, Beyond the Gate), summary line, turning-soon notice and toggles in the header.
- Gate (Beyond the Gate): a dim muddy path to a wrought-iron gate under a red dusk sky. Filter chips sit under the title. Creatures are scattered in a loose layout with small name plates. Pager at the bottom.
- Sky (Restless Sky): a dark cloudy backdrop with the moon, ghost filter chips and ghosts spread across the screen. Each ghost has a plate with its name and decay state. Pager at the bottom.
- Ground (Hallowed Ground): a dim graveyard backdrop with candles. Tombstones with RIP and a candle are in a loose grid, each with a plate. Pager at the bottom.
- Crypt: a stone vaulted hall with chains, candles and a red banner. Coffins with plates are spread over the floor. Pager at the bottom.

Common to all: a "Return to the gate" button top left, cobweb corners, bats, and a dev-mode "1 Issue" badge bottom left (a Next dev overlay, not app UI).

Only the 1440x900 images were opened. The other viewports were checked by the manifest test, not by eye.

## Notes

- The task text said 48 files. The matrix as specified gives 44 (hub and gate have one case each). All 44 exist.
- The gate baseline uses the `ghosts-3` case, so Beyond the Gate shows ghosts and "The gate stands empty" with zero counts on its zombie chips. The original gate does not render ghosts as zombies.
