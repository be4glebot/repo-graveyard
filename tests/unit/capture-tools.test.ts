import { describe, expect, it } from "vitest";
import {
  differenceShare,
  fallbackEdges,
  luminance,
  meanRowLuminance,
  seamDifference,
} from "../../docs/design-review/tools/page-probes.mjs";
import { VIEWPORTS, browserCandidates, buildFilename } from "../../docs/design-review/tools/capture.mjs";

/** Build an RGBA buffer where each row's grey level comes from `rowValue(y)`. */
function rows(width: number, height: number, rowValue: (y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const [r, g, b] = rowValue(y);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data.set([r, g, b, 255], i);
    }
  }
  return data;
}

describe("capture tools: luminance helpers", () => {
  it("maps black to 0 and white to 255", () => {
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 255, 255)).toBeCloseTo(255, 6);
  });

  it("averages the requested rows only", () => {
    const data = rows(3, 4, (y) => (y < 2 ? [0, 0, 0] : [255, 255, 255]));
    expect(meanRowLuminance(data, 3, 4, 0, 2)).toBe(0);
    expect(meanRowLuminance(data, 3, 4, 2, 2)).toBeCloseTo(255, 6);
    expect(meanRowLuminance(data, 3, 4, 1, 2)).toBeCloseTo(127.5, 6);
  });

  it("returns 0 for rows outside the image", () => {
    const data = rows(2, 2, () => [200, 200, 200]);
    expect(meanRowLuminance(data, 2, 2, 5, 4)).toBe(0);
  });
});

describe("capture tools: difference share", () => {
  it("is a symmetric share of full scale", () => {
    expect(differenceShare(0, 255)).toBe(1);
    expect(differenceShare(255, 0)).toBe(1);
    expect(differenceShare(100, 100)).toBe(0);
    expect(differenceShare(10, 35.5)).toBeCloseTo(0.1, 6);
  });

  it("passes a smooth join and fails a hard one", () => {
    const smooth = rows(4, 16, () => [40, 40, 40]);
    expect(seamDifference(smooth, 4, 16, 8).pass).toBe(true);
    const hard = rows(4, 16, (y) => (y < 8 ? [0, 0, 0] : [120, 120, 120]));
    const res = seamDifference(hard, 4, 16, 8);
    expect(res.share).toBeCloseTo(120 / 255, 6);
    expect(res.pass).toBe(false);
  });
});

describe("capture tools: fallback edge check", () => {
  const fb = [5, 6, 10];

  it("reports no edge for a lit image", () => {
    const data = rows(5, 5, () => [60, 70, 90]);
    expect(fallbackEdges(data, 5, 5)).toEqual([]);
  });

  it("detects a solid fallback top row only", () => {
    const data = rows(5, 5, (y) => (y === 0 ? fb : [60, 70, 90]));
    expect(fallbackEdges(data, 5, 5)).toEqual(["top"]);
  });

  it("detects a solid fallback right column", () => {
    const data = rows(5, 5, () => [60, 70, 90]);
    for (let y = 0; y < 5; y++) data.set([...fb, 255], (y * 5 + 4) * 4);
    expect(fallbackEdges(data, 5, 5)).toEqual(["right"]);
  });

  it("flags every edge of a fully fallback image", () => {
    const data = rows(3, 3, () => fb);
    expect(fallbackEdges(data, 3, 3)).toEqual(["top", "bottom", "left", "right"]);
  });
});

describe("capture tools: filename builder", () => {
  const base = { date: "2026-01-05", place: "sky", caseName: "ghosts-3", width: 1440, height: 900 };

  it("builds step filenames with a depth suffix", () => {
    expect(buildFilename({ ...base, step: "s2", depth: 0.5 })).toBe("2026-01-05-s2-sky-ghosts-3-1440x900-d0.5.png");
    expect(buildFilename({ ...base, step: "s2" })).toBe("2026-01-05-s2-sky-ghosts-3-1440x900-d0.png");
  });

  it("builds baseline filenames without a depth suffix", () => {
    expect(buildFilename({ ...base, step: "baseline", depth: 1 })).toBe("2026-01-05-baseline-sky-ghosts-3-1440x900.png");
  });

  it("lists the four review viewports and checks CHROME_PATH first", () => {
    expect(VIEWPORTS.map((v) => `${v.width}x${v.height}`)).toEqual(["1440x900", "1920x1080", "390x844", "360x740"]);
    expect(browserCandidates({ ...process.env, CHROME_PATH: "X:\\chrome.exe" })[0]).toBe("X:\\chrome.exe");
  });
});
