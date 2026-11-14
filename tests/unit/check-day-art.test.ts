import { describe, expect, it } from "vitest";
import { compareDayArt, EXPECTED } from "../../scripts/check-day-art.mjs";

type Entry = {
  width: number;
  height: number;
  hasAlpha: boolean;
  minAlpha?: number;
  centreMaxAlpha?: number;
} | null;

function cleanReport(): Record<string, Entry> {
  const report: Record<string, Entry> = {};
  for (const [name, size] of Object.entries(EXPECTED as Record<string, { width: number; height: number }>)) {
    report[name] = { width: size.width, height: size.height, hasAlpha: true };
  }
  report["place-ground"] = { width: 1536, height: 1024, hasAlpha: false };
  report["fg-frame"] = { width: 1536, height: 1024, hasAlpha: true, centreMaxAlpha: 0 };
  return report;
}

describe("compareDayArt", () => {
  it("returns no problems for a clean report", () => {
    expect(compareDayArt(cleanReport())).toEqual([]);
  });

  it("reports a wrong size, naming the file", () => {
    const report = cleanReport();
    report["mausoleum"] = { width: 100, height: 100, hasAlpha: true };
    const problems = compareDayArt(report);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("mausoleum");
    expect(problems[0]).toContain("440x600");
  });

  it("reports a missing file", () => {
    const report = cleanReport();
    report["bird-perch"] = null;
    const problems = compareDayArt(report);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("bird-perch");
    expect(problems[0]).toContain("missing");
  });

  it("reports an opaque fg-frame centre", () => {
    const report = cleanReport();
    report["fg-frame"] = { width: 1536, height: 1024, hasAlpha: true, centreMaxAlpha: 255 };
    const problems = compareDayArt(report);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("fg-frame");
    expect(problems[0]).toContain("centre");
  });

  it("reports an alpha-bearing place-ground with transparent pixels", () => {
    const report = cleanReport();
    report["place-ground"] = { width: 1536, height: 1024, hasAlpha: true, minAlpha: 0 };
    const problems = compareDayArt(report);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("place-ground");
  });
});
