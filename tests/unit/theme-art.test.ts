import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DAY_ART, themeArt } from "@/lib/theme-art";

const PUBLIC_DIR = path.resolve(__dirname, "../../public");

describe("DAY_ART", () => {
  it("has exactly the six night asset keys", () => {
    expect(Object.keys(DAY_ART).sort()).toEqual(
      [
        "/art/place-ground.webp",
        "/art/mg-fence.webp",
        "/art/mg-fence-tile.webp",
        "/art/mausoleum.webp",
        "/art/tomb-arch-fresh.webp",
        "/art/fg-frame.webp",
      ].sort(),
    );
  });

  it.each(Object.entries(DAY_ART))("%s -> %s exists under public/", (_k, v) => {
    expect(fs.existsSync(path.join(PUBLIC_DIR, v))).toBe(true);
  });
});

describe("themeArt fallback", () => {
  it("maps known assets in day", () => {
    for (const [k, v] of Object.entries(DAY_ART)) {
      expect(themeArt("day", k)).toBe(v);
    }
  });

  it("falls back to night for unknown worlds and paths", () => {
    expect(themeArt("day", "/art/place-world-x.webp")).toBe("/art/place-world-x.webp");
    expect(themeArt("day", "/art/../secret.webp")).toBe("/art/../secret.webp");
    expect(themeArt("day", "")).toBe("");
    expect(themeArt("day", "toString")).toBe("toString");
  });

  it("returns the night path unchanged in night", () => {
    expect(themeArt("night", "/art/place-ground.webp")).toBe("/art/place-ground.webp");
  });
});
