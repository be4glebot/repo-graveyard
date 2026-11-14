// Page probes for the design review. Pure helpers are exported for unit tests;
// the *Expression builders return source for Runtime.evaluate. Built-ins only.

export const SEAM_ROWS = 4;
export const SEAM_LIMIT = 0.1; // 10 percent of full scale
/** --color-night-sky (app/globals.css) as RGB. */
export const NIGHT_SKY_RGB = [5, 6, 10];

/**
 * Rec. 709 luminance of one pixel, 0..255.
 * @param {number} r @param {number} g @param {number} b
 */
export function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Mean luminance of `count` rows starting at `startRow` in an RGBA buffer.
 * Rows outside the image are ignored; returns 0 when no row is inside.
 * @param {ArrayLike<number>} data RGBA bytes
 * @param {number} width @param {number} height
 * @param {number} startRow @param {number} count
 */
export function meanRowLuminance(data, width, height, startRow, count) {
  let sum = 0;
  let n = 0;
  for (let y = Math.max(0, startRow); y < Math.min(height, startRow + count); y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      sum += luminance(data[i], data[i + 1], data[i + 2]);
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/**
 * Absolute difference of two 0..255 luminances as a share of full scale (0..1).
 * @param {number} a @param {number} b
 */
export function differenceShare(a, b) {
  return Math.abs(a - b) / 255;
}

/**
 * Seam difference at a join: rows [joinY-rows, joinY) versus [joinY, joinY+rows).
 * @param {ArrayLike<number>} data @param {number} width @param {number} height
 * @param {number} joinY @param {number} [rows]
 */
export function seamDifference(data, width, height, joinY, rows = SEAM_ROWS) {
  const above = meanRowLuminance(data, width, height, joinY - rows, rows);
  const below = meanRowLuminance(data, width, height, joinY, rows);
  return { above, below, share: differenceShare(above, below), pass: differenceShare(above, below) <= SEAM_LIMIT };
}

/**
 * Which outer lines (top, bottom, left, right) are entirely the solid fallback colour?
 * An empty result means no edge shows the fallback.
 * @param {ArrayLike<number>} data @param {number} width @param {number} height
 * @param {number[]} [fallback] RGB
 * @param {number} [tolerance] per-channel
 * @returns {("top"|"bottom"|"left"|"right")[]}
 */
export function fallbackEdges(data, width, height, fallback = NIGHT_SKY_RGB, tolerance = 1) {
  if (width <= 0 || height <= 0) return [];
  const isFallback = (x, y) => {
    const i = (y * width + x) * 4;
    return (
      Math.abs(data[i] - fallback[0]) <= tolerance &&
      Math.abs(data[i + 1] - fallback[1]) <= tolerance &&
      Math.abs(data[i + 2] - fallback[2]) <= tolerance
    );
  };
  const rowSolid = (y) => {
    for (let x = 0; x < width; x++) if (!isFallback(x, y)) return false;
    return true;
  };
  const colSolid = (x) => {
    for (let y = 0; y < height; y++) if (!isFallback(x, y)) return false;
    return true;
  };
  const out = [];
  if (rowSolid(0)) out.push("top");
  if (rowSolid(height - 1)) out.push("bottom");
  if (colSolid(0)) out.push("left");
  if (colSolid(width - 1)) out.push("right");
  return out;
}

/**
 * Node-side seam probe over a decoded screenshot. `joins` are y positions in pixels.
 * @param {ArrayLike<number>} data @param {number} width @param {number} height
 * @param {number[]} joins
 */
export function runSeamProbe(data, width, height, joins) {
  return {
    seams: joins.map((y) => ({ y, ...seamDifference(data, width, height, y) })),
    fallbackEdges: fallbackEdges(data, width, height),
  };
}

/**
 * Page expression: decode a PNG data URL on a canvas and return RGBA + size,
 * so the pure helpers above can run in Node. Use with CdpClient.evaluate.
 * @param {string} dataUrl
 */
export function decodeScreenshotExpression(dataUrl) {
  return `(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(dataUrl)};
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    return { width: c.width, height: c.height, data: Array.from(d) };
  })()`;
}

/**
 * Page expression: join positions (viewport y of each [data-blend-zone] bottom edge,
 * scaled by devicePixelRatio to match screenshot pixels).
 */
export const blendJoinsExpression = `(() => {
  const dpr = window.devicePixelRatio || 1;
  return Array.from(document.querySelectorAll("[data-blend-zone]"))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { zone: el.getAttribute("data-blend-zone"), y: Math.round(r.bottom * dpr), visible: r.bottom > 0 && r.top < innerHeight };
    })
    .filter((j) => j.visible);
})()`;

/**
 * Page expression: geometry probe listing tag, chrome and creature rectangles.
 * Chrome = elements under header/nav/footer or [data-chrome]; creatures = [data-creature].
 */
export const geometryProbeExpression = `(() => {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  const pick = (sel, kind) =>
    Array.from(document.querySelectorAll(sel)).map((el) => ({
      kind,
      tag: el.tagName.toLowerCase(),
      id: el.getAttribute("data-testid") || el.id || null,
      ...rect(el),
    }));
  return {
    viewport: { width: innerWidth, height: innerHeight },
    tags: pick("[data-tag]", "tag"),
    chrome: pick("header, nav, footer, [data-chrome]", "chrome"),
    creatures: pick("[data-creature]", "creature"),
  };
})()`;
