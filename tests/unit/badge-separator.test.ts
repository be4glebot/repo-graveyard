import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildBadge, SEPARATOR } from "@/lib/badge";
import {
  repoMessage,
  repoTone,
  summaryMessage,
  summaryTone,
  type BadgeCounts,
} from "@/lib/badge-messages";

// Escapes only: this file must never contain the literal characters.
const MIDDLE_DOT = "\u00B7";
const A_CIRCUMFLEX = "\u00C2";

const MIXED: BadgeCounts = { ghost: 3, risen: 2, zombie: 1, tombstone: 4, coffin: 5 };
const SINGLES: BadgeCounts = { ghost: 1, risen: 1, zombie: 1, tombstone: 1, coffin: 1 };
const EMPTY: BadgeCounts = { ghost: 0, risen: 0, zombie: 0, tombstone: 0, coffin: 0 };

describe("badge separator", () => {
  it("is exactly space, U+00B7, space", () => {
    expect(SEPARATOR).toBe(" \u00B7 ");
    expect(SEPARATOR).toHaveLength(3);
    expect(SEPARATOR.codePointAt(0)).toBe(0x20);
    expect(SEPARATOR.codePointAt(1)).toBe(0xb7);
    expect(SEPARATOR.codePointAt(2)).toBe(0x20);
  });

  it("joins summary message parts with the exact separator", () => {
    expect(summaryMessage(MIXED)).toBe(
      ["3 ghosts", "2 risen", "1 zombie", "4 at rest", "5 sealed"].join(" \u00B7 "),
    );
    expect(summaryMessage(SINGLES).split(SEPARATOR)).toHaveLength(5);
  });

  it("joins repo message parts with the exact separator", () => {
    for (const state of ["ghost", "zombie"] as const) {
      const msg = repoMessage(state, 1);
      const parts = msg.split(" \u00B7 ");
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe(state);
      expect(parts[1].length).toBeGreaterThan(0);
    }
  });
});

describe("no U+00C2 in messages or SVG", () => {
  const messages: string[] = [
    summaryMessage(MIXED),
    summaryMessage(SINGLES),
    summaryMessage(EMPTY),
    ...(["ghost", "risen", "zombie", "tombstone", "coffin"] as const).flatMap((s) =>
      [0, 1, 2, 3, 4, null].map((d) => repoMessage(s, d)),
    ),
  ];

  it("messages never contain U+00C2", () => {
    for (const m of messages) expect(m.includes(A_CIRCUMFLEX)).toBe(false);
  });

  it("full SVG output never contains U+00C2, in both styles", () => {
    const cases: Array<{ message: string; tone: string }> = [
      { message: summaryMessage(MIXED), tone: summaryTone(MIXED) },
      { message: summaryMessage(SINGLES), tone: summaryTone(SINGLES) },
      { message: summaryMessage(EMPTY), tone: summaryTone(EMPTY) },
      { message: repoMessage("ghost", 1), tone: repoTone("ghost") },
      { message: repoMessage("zombie", 2), tone: repoTone("zombie") },
      { message: repoMessage("tombstone", null), tone: repoTone("tombstone") },
      { message: repoMessage("coffin", null), tone: repoTone("coffin") },
    ];
    for (const style of ["haunted", "flat"]) {
      for (const c of cases) {
        const svg = buildBadge({ label: "repo graveyard", message: c.message, tone: c.tone, style });
        expect(svg.includes(A_CIRCUMFLEX)).toBe(false);
      }
    }
  });

  it("multi-part SVG output carries the separator unmangled", () => {
    const svg = buildBadge({
      label: "repo graveyard",
      message: summaryMessage(MIXED),
      tone: summaryTone(MIXED),
      style: "haunted",
    });
    expect(svg.includes(" \u00B7 ")).toBe(true);
    expect(svg.includes(A_CIRCUMFLEX + MIDDLE_DOT)).toBe(false);
  });
});

describe("source files use the escape, not the literal characters", () => {
  for (const file of ["lib/badge.ts", "lib/badge-messages.ts", "lib/badge-snippets.ts"]) {
    it(`${file} has no literal U+00B7 or U+00C2`, () => {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src.includes(MIDDLE_DOT)).toBe(false);
      expect(src.includes(A_CIRCUMFLEX)).toBe(false);
    });
  }
});
