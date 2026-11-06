# Spec 2C prompt (paste into a new Kiro spec chat)

Create a new spec called "2C polish pass" for the estate map and the four places. Read .kiro/steering/design.md (especially "Place backgrounds and fog") and the boards docs/design-canvas/PolishGate.dc.html and PolishPlaces.dc.html. public/art now has place-sky, place-gate, place-ground, place-crypt, fog-wisps and fog-wisps-thin (.webp).

Requirements to cover:
1. Layout: at 1440×900, 1280×720 and 390×844 every place and control is visible or reachable by scrolling. No content is clipped by overflow hidden. The header never wraps over content at any width ≥ 360.
2. Pointer parallax is back: pointer position → requestAnimationFrame → CSS variables --px/--py on the scene root (no React state). Far layers move least. Off under reduced motion. Add a test that pointermove sets the variables.
3. Lights-off lantern cursor as described in design.md, including keyboard focus following and reduced motion.
4. Per-place backgrounds with the brightness values in design.md; in the Sky place the data moon covers the painted moon.
5. Organic placement: a pure function scatterLayout(names, rows, seed) returning x, y, scale, brightness, mirrored; deterministic; no two plaques overlap at 1440 width (property test). Plaques render in a layer above creatures. Fresh zombies wander slightly.
6. Two drifting fog layers (fog-wisps behind creatures, fog-wisps-thin in front of their feet), opacity still from zombie count, paused under reduced motion. Keep the existing fog invariants and their tests.
7. Polish: buttons and chips match the boards (bevelled iron plaques, Cinzel caps, crimson active chip). All overlays keep pointer-events: none.

Do not delete existing components or tests without asking. Tests are required tasks, not optional.
