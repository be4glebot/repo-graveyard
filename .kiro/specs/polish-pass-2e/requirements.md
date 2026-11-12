# Requirements Document

## Introduction

Polish pass 2e fixes six visible rough edges in Repo Graveyard: a black first load on the map, doubled page titles, a whisper overlapping place cards, off-centre sparse compact rows, the unused painted moon art, and two lint warnings. Every change ships with its own tests, and no existing test is deleted or weakened.

## Glossary

- **Map**: The estate (`/estate`) and graveyard (`/g/[username]`) scene views.
- **Backdrop_Layers**: The CSS night-sky gradient, moon glow and fog layers rendered without waiting for image downloads.
- **Painted_Art**: The webp images in `public/art` shown over the Backdrop_Layers.
- **Fog_Wisps_Image**: `public/art/fog-wisps.webp`, currently 435 KB.
- **Title_Resolver**: The Next.js metadata title resolution, including the root template `%s · Repo Graveyard` in `lib/site-meta.ts`.
- **Whisper**: The "{repo} is still waiting for you…" text built in `lib/scene-view.ts`.
- **Place_Card**: A card such as "Beyond the Gate" that labels a scene place.
- **Compact_Layout**: The scene layout used below 768 px viewport width.
- **Slot_Row**: A horizontal row of creature slots in the Compact_Layout.
- **Stage_Band**: The vertical region of the Compact_Layout that holds the Slot_Rows.
- **Moon_Component**: The `Moon` component in `components/scene` that draws the moon on the landing page, map, scenes and empty graveyard.
- **Moon_Image**: `public/art/moon.webp`, a 512x512 transparent painted moon.
- **Drawn_Moon**: The existing code-drawn moon, kept as a fallback.

## Requirements

### Requirement 1: Instant night sky on first load

**User Story:** As a visitor on a desktop, I want the map to show a night sky immediately, so that I never stare at a black screen while art downloads.

#### Acceptance Criteria

1. WHEN the Map first renders, THE Map SHALL display the Backdrop_Layers before any Painted_Art has loaded.
2. WHEN a Painted_Art image finishes loading, THE Map SHALL fade the image in over the Backdrop_Layers.
3. WHILE the user prefers reduced motion, THE Map SHALL show each loaded Painted_Art image without a fade.
4. THE Map SHALL render the largest above-the-fold background image with `priority` and a `sizes` value that matches its rendered width at desktop viewports.
5. WHERE the installed tooling can re-encode the Fog_Wisps_Image, THE re-encode step SHALL produce a file under 300 KB.
6. IF the installed tooling cannot re-encode the Fog_Wisps_Image under 300 KB, THEN THE implementer SHALL report the limitation and leave the file unchanged.

### Requirement 2: Single-brand page titles

**User Story:** As a visitor, I want clean browser tab titles, so that "Repo Graveyard" does not appear twice.

#### Acceptance Criteria

1. THE Title_Resolver SHALL resolve the `/estate` page title using an `absolute` title.
2. THE Title_Resolver SHALL resolve the `/g/[username]/[repo]` page title using an `absolute` title.
3. THE Title_Resolver SHALL resolve the root default title, the `/estate` title, the `/g/[username]` title and the `/g/[username]/[repo]` title so that each final title contains "Repo Graveyard" exactly once.

### Requirement 3: Whisper clears place cards

**User Story:** As a visitor on a tablet-width screen, I want the whisper to stay readable, so that it never covers place cards or other chrome.

#### Acceptance Criteria

1. WHILE the viewport width is between 768 px and 1440 px, THE Whisper SHALL be positioned so that its bounding rectangle does not intersect any Place_Card rectangle.
2. WHILE the viewport width is between 768 px and 1440 px, THE Whisper SHALL be positioned so that its bounding rectangle does not intersect the header rectangle or the legend rectangle.
3. THE layout test SHALL check rectangle intersection at viewport widths 768, 800, 1024, 1280 and 1440 px.

### Requirement 4: Centred sparse compact rows

**User Story:** As a mobile visitor with few repos, I want a single row of creatures centred in the stage, so that the scene does not look empty at the top.

#### Acceptance Criteria

1. WHILE the Compact_Layout is active and all creatures fit in one Slot_Row, THE Compact_Layout SHALL centre that Slot_Row on the vertical midpoint of the Stage_Band.
2. WHILE the Compact_Layout is active and creatures need more than one Slot_Row, THE Compact_Layout SHALL keep the existing row positions.
3. IF the Compact_Layout receives zero creatures, THEN THE Compact_Layout SHALL return an empty layout without throwing.

### Requirement 5: Painted moon art

**User Story:** As a visitor, I want the painted moon art to appear wherever the moon appears, so that the night scene looks finished.

#### Acceptance Criteria

1. THE Moon_Component SHALL render the Moon_Image on the landing page, the map, the scenes and the empty graveyard.
2. THE Moon_Component SHALL keep the existing soft glow, sizes, positions and reduced-motion behaviour.
3. IF the Moon_Image fails to load, THEN THE Moon_Component SHALL render the Drawn_Moon.
4. WHEN undead creatures outnumber living creatures, THE Moon_Component SHALL apply the bloodmoon-100 colour treatment to the Moon_Image and to the Drawn_Moon.

### Requirement 6: Clean lint warnings

**User Story:** As a maintainer, I want a clean lint run on the touched files, so that warnings do not hide real problems.

#### Acceptance Criteria

1. THE `components/detail/HoverCardProvider.tsx` file SHALL contain no unused `useCallback` import.
2. THE `renderSky` function in `tests/dom/SceneLayoutPreservation.test.tsx` SHALL have no `handlers` parameter, with every existing assertion unchanged.
3. WHEN eslint runs on both files, THE eslint run SHALL report zero warnings and zero errors.
