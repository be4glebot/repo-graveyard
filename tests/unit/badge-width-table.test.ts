import { describe, expect, it } from "vitest";
import {
  BADGE_PALETTE,
  DEFAULT_CHAR_WIDTH_PX,
  ELLIPSIS,
  PADDING_PX,
  buildBadge,
  segmentWidthPx,
  textWidthPx,
} from "@/lib/badge";

const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, i) =>
  String.fromCharCode(0x20 + i),
);

describe("Width_Table", () => {
  it("matches known Verdana 11px advances", () => {
    expect(textWidthPx("i")).toBeCloseTo(3.01, 2);
    expect(textWidthPx("0")).toBeCloseTo(7.0, 1);
    expect(textWidthPx(" ")).toBeCloseTo(3.87, 2);
    expect(textWidthPx("W")).toBeCloseTo(10.88, 2);
    expect(textWidthPx("\u00B7")).toBeCloseTo(4.0, 1);
    expect(textWidthPx("W")).toBeGreaterThan(textWidthPx("i"));
  });

  it("charges the ellipsis the widest table entry", () => {
    const max = Math.max(...PRINTABLE_ASCII.map((c) => textWidthPx(c)));
    expect(textWidthPx(ELLIPSIS)).toBe(max);
    expect(max).toBeGreaterThanOrEqual(DEFAULT_CHAR_WIDTH_PX);
  });

  it("charges 7 px for a code point missing from the table", () => {
    expect(textWidthPx("\u4E2D")).toBe(7);
    expect(textWidthPx("\u{1F47B}")).toBe(7);
    expect(textWidthPx("\u4E2D\u4E2D")).toBe(14);
  });

  it("adds 10 px padding per side and rounds up to a whole pixel", () => {
    expect(segmentWidthPx("")).toBe(2 * PADDING_PX);
    expect(segmentWidthPx("i")).toBe(Math.ceil(3.01 + 2 * PADDING_PX));
    expect(Number.isInteger(segmentWidthPx("repo graveyard"))).toBe(true);
  });

  it("sizes the svg width as the sum of both segments", () => {
    const svg = buildBadge({
      label: "repo graveyard",
      message: "ghost",
      tone: "ghost",
      style: "haunted",
    });
    const expected = segmentWidthPx("repo graveyard") + segmentWidthPx("ghost");
    expect(svg).toContain(`width="${expected}"`);
  });

  it("renders Haunted and Flat output with different colours", () => {
    const p = { label: "repo graveyard", message: "ghost", tone: "ghost" };
    const haunted = buildBadge({ ...p, style: "haunted" });
    const flat = buildBadge({ ...p, style: "flat" });
    expect(haunted).not.toBe(flat);
    expect(haunted).toContain(BADGE_PALETTE.hauntedLabel.fill);
    expect(flat).not.toContain(BADGE_PALETTE.hauntedLabel.fill);
    expect(flat).toContain(BADGE_PALETTE.flatLabel.fill);
    expect(haunted).not.toContain(BADGE_PALETTE.flatLabel.fill);
  });
});
