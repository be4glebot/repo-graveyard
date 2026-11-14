import { describe, it } from "vitest";
import fc from "fast-check";
import {
  BIRD_PERCH_HEIGHT_RATIO,
  DAY_ART,
  PERCH_BIRDS,
  perchBirdBox,
  themeArt,
  themeFilter,
} from "@/lib/theme-art";

// Feature: daytime-lights-on, Property 1: Night theme is the identity
describe("Feature: daytime-lights-on, Property 1: Night theme is the identity", () => {
  it("themeArt('night', p) === p for any string", () => {
    // **Validates: Requirements 3.3**
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (p) => {
        return themeArt("night", p) === p;
      }),
    );
  });

  it("themeFilter('night', f, t) === f for any strings", () => {
    // **Validates: Requirements 3.3**
    fc.assert(
      fc.property(fc.string(), fc.string(), (f, t) => {
        return themeFilter("night", f, t) === f;
      }),
    );
  });
});

// Feature: daytime-lights-on, Property 2: Day theme maps known assets and falls back to night for the rest
describe("Feature: daytime-lights-on, Property 2: Day theme maps known assets and falls back to night for the rest", () => {
  it("themeArt('day', key) === DAY_ART[key] for every mapped key", () => {
    // **Validates: Requirements 3.1, 3.2, 3.4, 3.5**
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(DAY_ART)), (key) => {
        return themeArt("day", key) === DAY_ART[key];
      }),
    );
  });

  it("themeArt('day', p) === p for any string not in DAY_ART", () => {
    // **Validates: Requirements 3.1, 3.2, 3.4, 3.5**
    const arb = fc.oneof(
      fc.string({ unit: "binary" }),
      fc.string(),
      fc.constantFrom("..", "/art/../x.webp", "__proto__", "constructor", "toString"),
    );
    fc.assert(
      fc.property(
        arb.filter((s) => !Object.prototype.hasOwnProperty.call(DAY_ART, s)),
        (p) => themeArt("day", p) === p,
      ),
    );
  });
});

// Feature: daytime-lights-on, Property 3: Resolved art paths stay under /art/ and are deterministic
describe("Feature: daytime-lights-on, Property 3: Resolved art paths stay under /art/ and are deterministic", () => {
  it("any /art/<segment>.webp resolves to a non-empty /art/ path, deterministically, for either theme", () => {
    // **Validates: Requirements 3.7, 9.6**
    const segment = fc.stringMatching(/^[a-z0-9][a-z0-9_-]{0,30}$/);
    fc.assert(
      fc.property(segment, fc.constantFrom("night", "day" as const), (seg, theme) => {
        const input = `/art/${seg}.webp`;
        const a = themeArt(theme as "night" | "day", input);
        const b = themeArt(theme as "night" | "day", input);
        return a.length > 0 && a.startsWith("/art/") && a === b;
      }),
    );
  });

  it("every mapped DAY_ART key and value stays under /art/", () => {
    // **Validates: Requirements 3.7, 9.6**
    for (const [k, v] of Object.entries(DAY_ART)) {
      if (!k.startsWith("/art/") || !v.startsWith("/art/")) throw new Error(`${k} -> ${v}`);
    }
  });
});

// Feature: daytime-lights-on, Property 4: Perch bird placement follows the gate box
describe("Feature: daytime-lights-on, Property 4: Perch bird placement follows the gate box", () => {
  const dim = fc.integer({ min: 1, max: 4000 });

  it("left/top follow x*w and y*h per PERCH_BIRDS, mirror flags match, values are finite", () => {
    // **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
    fc.assert(
      fc.property(dim, dim, (w, h) => {
        const boxes = perchBirdBox({ w, h });
        if (boxes.length !== PERCH_BIRDS.length) return false;
        return boxes.every((box, i) => {
          const b = PERCH_BIRDS[i];
          return (
            box.side === b.side &&
            box.left === b.x * w &&
            box.top === b.y * h &&
            box.mirror === b.mirror &&
            Number.isFinite(box.left) &&
            Number.isFinite(box.top) &&
            Number.isFinite(box.size)
          );
        });
      }),
    );
  });

  it("left bird is unmirrored, right bird is mirrored", () => {
    // **Validates: Requirements 4.4, 4.5**
    fc.assert(
      fc.property(dim, dim, (w, h) => {
        const boxes = perchBirdBox({ w, h });
        const left = boxes.find((b) => b.side === "left");
        const right = boxes.find((b) => b.side === "right");
        return !!left && !!right && left.mirror === false && right.mirror === true;
      }),
    );
  });

  it("sizes scale with the gate height and are non-negative", () => {
    // **Validates: Requirements 4.2, 4.3**
    fc.assert(
      fc.property(dim, dim, (w, h) => {
        const boxes = perchBirdBox({ w, h });
        return boxes.every(
          (b) => b.size === Math.round(h * BIRD_PERCH_HEIGHT_RATIO) && b.size >= 0,
        );
      }),
    );
    fc.assert(
      fc.property(dim, dim, (w, h) => {
        const small = perchBirdBox({ w, h })[0].size;
        const big = perchBirdBox({ w: w * 2, h: h * 2 })[0].size;
        return big >= small;
      }),
    );
  });
});
