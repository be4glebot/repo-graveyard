/**
 * Day copy: every UI string that changes in the daytime "Lights on" theme.
 * Pure data and one lookup. No I/O, no clock, no React. Night strings are the
 * original wording and stay as they were; data, ids and test ids never change.
 */
import type { Theme } from "./theme-art";

export interface DayCopyEntry {
  readonly night: string;
  readonly day: string;
}

export const DAY_COPY = {
  // Place names.
  "place.sky": { night: "The Restless Sky", day: "The Open Sky" },
  "place.gate": { night: "Beyond the Gate", day: "The Garden Gate" },
  "place.ground": { night: "Hallowed Ground", day: "The Memorial Garden" },
  "place.crypt": { night: "The Crypt", day: "The Keepsake Vault" },

  // Summary line and legend nouns (singular / plural).
  "count.ghost.one": { night: "ghost", day: "drifting" },
  "count.ghost.many": { night: "ghosts", day: "drifting" },
  "count.risen.one": { night: "risen", day: "waking" },
  "count.risen.many": { night: "risen", day: "waking" },
  "count.zombie.one": { night: "zombie", day: "dozing" },
  "count.zombie.many": { night: "zombies", day: "dozing" },
  "count.tombstone.one": { night: "at rest", day: "remembered" },
  "count.tombstone.many": { night: "at rest", day: "remembered" },
  "count.coffin.one": { night: "sealed", day: "kept" },
  "count.coffin.many": { night: "sealed", day: "kept" },

  // Pager.
  "pager.nearer": { night: "‹ Nearer the gate", day: "‹ Nearer the gate" },
  "pager.nearer.title": {
    night: "Previous page: newer projects, nearer the gate",
    day: "Previous page: newer projects, nearer the gate",
  },
  "pager.deeper": { night: "Deeper into the dark ›", day: "Further down the path ›" },
  "pager.deeper.title": {
    night: "Next page: older projects, deeper into the dark",
    day: "Next page: older projects, further down the path",
  },

  // Turning-soon banner (the day banner shows the countdown after the phrase).
  "turning.phrase": { night: "turns in", day: "needs a little care" },

  // Plaque sub-lines for tombstones and coffins.
  "plaque.tombstone": { night: "at rest", day: "remembered" },
  "plaque.coffin": { night: "sealed", day: "kept" },

  // Register table "Place" column header.
  "table.place": { night: "Place", day: "Where it lives" },

  // Place call-to-action on the estate map plaques.
  "cta.sky": { night: "Rise to them →", day: "Look up →" },
  "cta.gate": { night: "Open the gate →", day: "Open the garden gate →" },
  "cta.ground": { night: "Walk the ground →", day: "Stroll the garden →" },
  "cta.crypt": { night: "Descend to the crypt →", day: "Visit the vault →" },

  // Travel transition label (the map name shown on the reduced-motion card).
  "travel.estate": { night: "The Estate", day: "The Estate" },

  // Plaque count lines. `{n}` is replaced with the count.
  "plaque.sky.empty": { night: "No ghosts linger", day: "The sky is clear" },
  "plaque.sky.one": { night: "{n} ghost still wanders", day: "{n} project drifting by" },
  "plaque.sky.many": { night: "{n} ghosts still wander", day: "{n} projects drifting by" },
  "plaque.gate.empty": { night: "The gate stands empty", day: "The garden gate is quiet" },
  "plaque.gate.one": {
    night: "{n} undead shambles here, waiting for a verdict",
    day: "{n} project dozing here, waiting for a decision",
  },
  "plaque.gate.many": {
    night: "{n} undead shamble here, waiting for a verdict",
    day: "{n} projects dozing here, waiting for a decision",
  },
  "plaque.gate.risen.one": { night: "{n} has risen", day: "{n} is waking" },
  "plaque.gate.risen.many": { night: "{n} have risen", day: "{n} are waking" },
  "plaque.ground.empty": { night: "No finished works at rest", day: "No finished works yet" },
  "plaque.ground.one": { night: "{n} finished work at rest", day: "{n} finished work remembered" },
  "plaque.ground.many": {
    night: "{n} finished works at rest",
    day: "{n} finished works remembered",
  },
  "plaque.crypt.empty": { night: "No one sealed away yet", day: "Nothing kept here yet" },
  "plaque.crypt.many": { night: "{n} sealed away", day: "{n} kept safe" },

  // Empty cemetery card.
  "empty.ground.title": {
    night: "No tombstones rest here yet",
    day: "No memorials yet.",
  },
  "empty.ground.body": {
    night: "One plot waits, unmarked. A stone will stand here when a project is done.",
    day: "A stone will be placed here when a project is finished.",
  },

  // Empty open sky and empty keepsake vault cards.
  "empty.sky.title": { night: "No ghosts haunt this sky", day: "The sky is clear" },
  "empty.sky.body": {
    night: "The hook is empty. A lantern will hang here when a project wakes.",
    day: "A little light will appear here when a project wakes.",
  },
  "empty.crypt.title": { night: "No coffins lie sealed here", day: "Nothing kept here yet" },
  "empty.crypt.body": {
    night: "The door stays shut. A chain will bind it when a project is let go.",
    day: "A keepsake will be placed here when a project is set aside.",
  },
} as const satisfies Record<string, DayCopyEntry>;

export type DayCopyKey = keyof typeof DAY_COPY;

/** Every entry as `[key, { night, day }]`, for tests that iterate the table. */
export const DAY_COPY_ENTRIES: ReadonlyArray<readonly [DayCopyKey, DayCopyEntry]> =
  (Object.keys(DAY_COPY) as DayCopyKey[]).map((k) => [k, DAY_COPY[k]] as const);

/** Look up a string for a theme. Night returns the original night string. */
export function dayCopy(theme: Theme, key: DayCopyKey): string {
  return theme === "day" ? DAY_COPY[key].day : DAY_COPY[key].night;
}

/** Place-name key for a place id. */
export function placeNameKey(place: "sky" | "gate" | "ground" | "crypt"): DayCopyKey {
  return `place.${place}`;
}

/** Call-to-action key for a place id. */
export function placeCtaKey(place: "sky" | "gate" | "ground" | "crypt"): DayCopyKey {
  return `cta.${place}`;
}

/** Look up a count template for a theme and fill in `{n}`. */
export function dayCopyN(theme: Theme, key: DayCopyKey, n: number): string {
  return dayCopy(theme, key).replace("{n}", String(n));
}

/** Summary/legend noun key for a lifecycle state and count. */
export function countKey(
  state: "ghost" | "risen" | "zombie" | "tombstone" | "coffin",
  count: number,
): DayCopyKey {
  return `count.${state}.${count === 1 ? "one" : "many"}`;
}
