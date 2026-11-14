import { describe, expect, it } from "vitest";

import {
  DAY_COPY,
  DAY_COPY_ENTRIES,
  dayCopy,
  type DayCopyKey,
} from "@/lib/day-copy";
import { plaqueCopy, type PlaceId } from "@/lib/estate-view";

const SCARY = /dead|grave|crypt|zombie|ghost|dark|haunted|sinister/i;

/** The night wording as it was before the day theme existed. */
const NIGHT: Record<DayCopyKey, string> = {
  "place.sky": "The Restless Sky",
  "place.gate": "Beyond the Gate",
  "place.ground": "Hallowed Ground",
  "place.crypt": "The Crypt",
  "count.ghost.one": "ghost",
  "count.ghost.many": "ghosts",
  "count.risen.one": "risen",
  "count.risen.many": "risen",
  "count.zombie.one": "zombie",
  "count.zombie.many": "zombies",
  "count.tombstone.one": "at rest",
  "count.tombstone.many": "at rest",
  "count.coffin.one": "sealed",
  "count.coffin.many": "sealed",
  "pager.nearer": "‹ Nearer the gate",
  "pager.nearer.title": "Previous page: newer projects, nearer the gate",
  "pager.deeper": "Deeper into the dark ›",
  "pager.deeper.title": "Next page: older projects, deeper into the dark",
  "turning.phrase": "turns in",
  "plaque.tombstone": "at rest",
  "plaque.coffin": "sealed",
  "table.place": "Place",
  "cta.sky": "Rise to them →",
  "cta.gate": "Open the gate →",
  "cta.ground": "Walk the ground →",
  "cta.crypt": "Descend to the crypt →",
  "travel.estate": "The Estate",
  "plaque.sky.empty": "No ghosts linger",
  "plaque.sky.one": "{n} ghost still wanders",
  "plaque.sky.many": "{n} ghosts still wander",
  "plaque.gate.empty": "The gate stands empty",
  "plaque.gate.one": "{n} undead shambles here, waiting for a verdict",
  "plaque.gate.many": "{n} undead shamble here, waiting for a verdict",
  "plaque.gate.risen.one": "{n} has risen",
  "plaque.gate.risen.many": "{n} have risen",
  "plaque.ground.empty": "No finished works at rest",
  "plaque.ground.one": "{n} finished work at rest",
  "plaque.ground.many": "{n} finished works at rest",
  "plaque.crypt.empty": "No one sealed away yet",
  "plaque.crypt.many": "{n} sealed away",
  "empty.ground.title": "No tombstones rest here yet",
  "empty.ground.body":
    "One plot waits, unmarked. A stone will stand here when a project is done.",
  "empty.sky.title": "No ghosts haunt this sky",
  "empty.sky.body": "The hook is empty. A lantern will hang here when a project wakes.",
  "empty.crypt.title": "No coffins lie sealed here",
  "empty.crypt.body":
    "The door stays shut. A chain will bind it when a project is let go.",
};

describe("day copy", () => {
  it("covers exactly the known keys", () => {
    expect(Object.keys(DAY_COPY).sort()).toEqual(Object.keys(NIGHT).sort());
  });

  it.each(DAY_COPY_ENTRIES.map(([k]) => k))("%s: night string is unchanged", (key) => {
    expect(DAY_COPY[key].night).toBe(NIGHT[key]);
    expect(dayCopy("night", key)).toBe(NIGHT[key]);
  });

  it.each(DAY_COPY_ENTRIES.map(([k]) => k))("%s: day string is non-empty and not scary", (key) => {
    const day = dayCopy("day", key);
    expect(day.trim().length).toBeGreaterThan(0);
    expect(day).not.toMatch(SCARY);
  });

  it("plaqueCopy day lines are never scary and night lines match the original", () => {
    const places: PlaceId[] = ["sky", "gate", "ground", "crypt"];
    for (const place of places) {
      for (const n of [0, 1, 2, 7]) {
        for (const r of [0, 1, 3]) {
          expect(plaqueCopy(place, n, r, "day")).not.toMatch(SCARY);
          expect(plaqueCopy(place, n, r)).toBe(plaqueCopy(place, n, r, "night"));
        }
      }
    }
    expect(plaqueCopy("sky", 1)).toBe("1 ghost still wanders");
    expect(plaqueCopy("sky", 3)).toBe("3 ghosts still wander");
    expect(plaqueCopy("gate", 2, 1)).toBe(
      "2 undead shamble here, waiting for a verdict · 1 has risen",
    );
    expect(plaqueCopy("gate", 0, 2)).toBe("2 have risen");
    expect(plaqueCopy("ground", 1)).toBe("1 finished work at rest");
    expect(plaqueCopy("crypt", 4)).toBe("4 sealed away");
    expect(plaqueCopy("crypt", 0)).toBe("No one sealed away yet");
  });
});
