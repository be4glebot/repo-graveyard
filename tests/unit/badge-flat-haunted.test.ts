import { describe, expect, it } from "vitest";
import { BADGE_PALETTE, buildBadge, parseBadgeStyle } from "@/lib/badge";

const LABEL = "repo graveyard";
const base = { label: LABEL, message: "3 ghosts", tone: "ghost" };

describe("badge styles", () => {
  it("defaults to haunted when the style is absent or unrecognised", () => {
    expect(parseBadgeStyle(null)).toBe("haunted");
    expect(parseBadgeStyle(undefined)).toBe("haunted");
    expect(parseBadgeStyle("")).toBe("haunted");
    expect(parseBadgeStyle("FLAT")).toBe("haunted");
    expect(parseBadgeStyle("x".repeat(33))).toBe("haunted");
    expect(parseBadgeStyle("flat")).toBe("flat");
  });

  it("renders unknown style strings as haunted", () => {
    expect(buildBadge({ ...base, style: "bogus" })).toBe(
      buildBadge({ ...base, style: "haunted" }),
    );
  });

  it("haunted uses a night base and a crimson label", () => {
    const svg = buildBadge({ ...base, style: "haunted" });
    expect(svg).toContain(`fill="${BADGE_PALETTE.hauntedBase.fill}"`);
    expect(svg).toContain(`fill="${BADGE_PALETTE.hauntedLabel.fill}"`);
  });

  it("flat yields a light two-segment layout without the night base", () => {
    const svg = buildBadge({ ...base, style: "flat" });
    expect(svg).toContain(`fill="${BADGE_PALETTE.flatLabel.fill}"`);
    expect(svg).toContain(`fill="${BADGE_PALETTE.ghost.fill}"`);
    // Shape fills only (the night colour also serves as dark text on light fills).
    const shapeFills = [...svg.matchAll(/<path [^>]*fill="(#[0-9a-f]{6})"/g)].map(
      (m) => m[1],
    );
    expect(shapeFills).not.toContain(BADGE_PALETTE.hauntedBase.fill);
    expect(svg).not.toContain(BADGE_PALETTE.hauntedLabel.fill);
    expect(svg.match(/<text /g)).toHaveLength(2);
  });

  it("keeps the label text 'repo graveyard' in both styles", () => {
    for (const style of ["haunted", "flat"]) {
      const svg = buildBadge({ ...base, style });
      expect(svg).toContain(`>${LABEL}</text>`);
      expect(svg).toContain(`<title>${LABEL}: 3 ghosts</title>`);
    }
  });
});
