import { describe, expect, it } from "vitest";
import { contrastRatio, parseHex } from "@/lib/contrast";

describe("parseHex", () => {
  it("parses 6-digit hex", () => {
    expect(parseHex("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
  });
  it("parses 3-digit hex", () => {
    expect(parseHex("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("returns null for invalid input", () => {
    expect(parseHex("#12")).toBeNull();
    expect(parseHex("nope")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white, both ways", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 5);
  });
  it("is 1 for equal colours", () => {
    expect(contrastRatio("#336699", "#369")).toBeCloseTo(1, 10);
  });
});
