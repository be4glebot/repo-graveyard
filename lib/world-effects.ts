/**
 * Effects_Table registry for the explorable worlds (Req 15.6, 18.8, 18.9, 18.10).
 *
 * Pure: no I/O, no clock. Every visual effect in a world has one row here, one
 * row in `docs/EFFECTS_TABLE.md`, and is tagged `data-effect="<id>"` in components.
 */

import { LIFECYCLE_CONFIG } from "./lifecycle";

export type WorldPlace = "sky" | "ground" | "crypt";
export type EffectKind = "data" | "story" | "blend";

export interface WorldEffect {
  id: string;
  /** Places the effect renders in. */
  places: readonly WorldPlace[];
  kind: EffectKind;
  /** Creature field for `data` effects. */
  field?: string;
  /** True when it runs continuously (counts toward the per-place cap of 4). */
  ambient: boolean;
  description: string;
}

const ALL: readonly WorldPlace[] = ["sky", "ground", "crypt"];

/** Maximum simultaneous ambient effects per place (Req 14.11, 18.8). */
export const MAX_AMBIENT_PER_PLACE = 4;

export const WORLD_EFFECTS: readonly WorldEffect[] = [
  { id: "creature-motion", places: ALL, kind: "data", field: "state, decayLevel", ambient: false, description: "Existing creature loops (excluded from the ambient cap by Req 18.8)" },
  { id: "moon-glow", places: ["sky"], kind: "data", field: "moonTreatment", ambient: false, description: "Moon glow reflects overall graveyard health" },
  { id: "ghost-rim-glow", places: ["sky"], kind: "data", field: "daysQuiet", ambient: false, description: "Ghost rim light strength follows recency" },
  { id: "ghost-lantern", places: ["sky"], kind: "data", field: "decayLevel", ambient: false, description: "Ghost lantern tag brightness follows decay level" },
  { id: "tombstone-moss", places: ["ground"], kind: "data", field: "daysQuiet", ambient: false, description: "Existing tombstone moss treatment, unchanged" },
  { id: "fresh-earth", places: ["ground"], kind: "data", field: "daysQuiet", ambient: false, description: "Disturbed earth at the base of a grave quiet for less than the active threshold in LIFECYCLE_CONFIG" },
  { id: "contact-shadow", places: ["sky", "ground", "crypt"], kind: "blend", ambient: false, description: "Grounds standing creatures; direction comes from the place's Light_Source" },
  { id: "star-twinkle", places: ["sky"], kind: "story", ambient: true, description: "Stars twinkling in thin air" },
  { id: "cloud-drift", places: ["sky"], kind: "blend", ambient: true, description: "EnvMist sway" },
  { id: "bats", places: ["sky"], kind: "story", ambient: true, description: "Existing Atmosphere bats" },
  { id: "ground-mist", places: ["ground"], kind: "blend", ambient: true, description: "EnvMist along the ground" },
  { id: "path-lantern-flicker", places: ["ground"], kind: "story", ambient: true, description: "Path-side lanterns flicker" },
  { id: "ravens", places: ["ground"], kind: "story", ambient: false, description: "At most two ravens placed by name hash, perched and static" },
  { id: "candle-glow-reveal", places: ["ground"], kind: "story", ambient: false, description: "One-shot candle glow on first view, 800 ms or less" },
  { id: "torch-flicker", places: ["crypt"], kind: "story", ambient: true, description: "Wall torches flicker" },
  { id: "crypt-dust", places: ["crypt"], kind: "blend", ambient: true, description: "EnvMist at the crypt token" },
  { id: "chain-reveal", places: ["crypt"], kind: "story", ambient: false, description: "One-shot chain reveal, 600 ms or less" },
  { id: "chamber-darkness", places: ["crypt"], kind: "blend", ambient: false, description: "ambientBrightness(depth) overlay, scroll-linked" },
  { id: "scroll-parallax", places: ALL, kind: "blend", ambient: false, description: "Band offsets from scroll" },
  { id: "vignette", places: ALL, kind: "blend", ambient: false, description: "Existing Atmosphere vignette, static" },
  { id: "grain", places: ALL, kind: "blend", ambient: false, description: "Existing Atmosphere grain, static" },
  { id: "cobwebs", places: ALL, kind: "story", ambient: false, description: "Existing Atmosphere corner cobwebs, static" },
  { id: "legibility-gradient", places: ALL, kind: "blend", ambient: false, description: "Top and bottom legibility gradients" },
];

/** Props that tag an element as a registered effect. Throws on an unknown id. */
export function effectProps(id: string): { "data-effect": string } {
  if (!WORLD_EFFECTS.some((e) => e.id === id)) {
    throw new Error(`Unknown world effect: ${id}`);
  }
  return { "data-effect": id };
}

/**
 * Whether fresh earth shows at a grave: quiet for fewer days than the active
 * ghost threshold in LIFECYCLE_CONFIG. Total: bad input yields false.
 */
export function freshEarth(daysQuiet: number): boolean {
  if (typeof daysQuiet !== "number" || Number.isNaN(daysQuiet)) return false;
  return daysQuiet < LIFECYCLE_CONFIG.ghostMaxDaysQuiet;
}

/** Lantern level for a ghost: its decay level clamped to 0..3 (0 brightest). */
export function ghostLanternLevel(decayLevel: number | null | undefined): number {
  const max = LIFECYCLE_CONFIG.ghostDecayBounds.length;
  if (typeof decayLevel !== "number" || Number.isNaN(decayLevel)) return 0;
  return Math.min(max, Math.max(0, Math.floor(decayLevel)));
}
