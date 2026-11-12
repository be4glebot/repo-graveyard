/**
 * Pure SVG badge builder. No I/O, no React, no Next, no server-only.
 * Text, tone and style in; an SVG string out.
 */

export const SEPARATOR = " \u00B7 "; // space, U+00B7, space (escape, never a literal)
export const ELLIPSIS = "\u2026";
export const MAX_TEXT_CODE_POINTS = 64; // 63 + ellipsis
export const MAX_SVG_BYTES = 4096; // output must be strictly smaller
export const PADDING_PX = 10; // per side
export const DEFAULT_CHAR_WIDTH_PX = 7;
export const BADGE_HEIGHT_PX = 20;
export const FONT_SIZE_PX = 11;
export const CORNER_RADIUS_PX = 3;

export const FALLBACK_NOT_FOUND = "not found";
export const FALLBACK_UNAVAILABLE = "unavailable";

export type BadgeStyle = "haunted" | "flat";
export type BadgeTone =
  | "ghost"
  | "risen"
  | "zombie"
  | "tombstone"
  | "coffin"
  | "neutral"
  | "fallback";

export interface BadgeParams {
  label: string;
  message: string;
  /** Validated against the palette; unknown values become "neutral". */
  tone: string;
  /** Validated; unknown values become "haunted". */
  style: string;
}

interface Colors {
  readonly fill: string;
  readonly text: string;
}

/**
 * Closed colour set. Every hex value is copied from an `@theme` token in
 * app/globals.css (a standalone SVG loaded via <img> cannot read CSS variables).
 */
export const BADGE_PALETTE = {
  ghost: { fill: "#9fe7ff", text: "#05060a" }, // ghost-300
  risen: { fill: "#f4b860", text: "#05060a" }, // candle-400
  zombie: { fill: "#e2555f", text: "#05060a" }, // crimson-400
  tombstone: { fill: "#ecead9", text: "#05060a" }, // moon-pale
  coffin: { fill: "#4a4f5e", text: "#ecead9" }, // ink-600
  neutral: { fill: "#6b6556", text: "#ecead9" }, // ink-400
  fallback: { fill: "#8d897b", text: "#05060a" }, // scene-fg-faint
  hauntedLabel: { fill: "#9b1c31", text: "#ecead9" }, // crimson-700 / moon-pale
  hauntedBase: { fill: "#05060a", text: "#ecead9" }, // night-sky
  flatLabel: { fill: "#e2dccb", text: "#1f2330" }, // paper-border / ink-900
  flatOutline: { fill: "#4a4f5e", text: "#1f2330" }, // ink-600
} as const satisfies Record<string, Colors>;

const TONE_KEYS: readonly BadgeTone[] = [
  "ghost",
  "risen",
  "zombie",
  "tombstone",
  "coffin",
  "neutral",
  "fallback",
];

function resolveTone(tone: unknown): BadgeTone {
  if (
    typeof tone === "string" &&
    (TONE_KEYS as readonly string[]).includes(tone) &&
    Object.hasOwn(BADGE_PALETTE, tone)
  ) {
    return tone as BadgeTone;
  }
  return "neutral";
}

// ---------------------------------------------------------------------------
// Width_Table: Verdana advance widths in 1/1000 em for printable ASCII + U+00B7.
// ---------------------------------------------------------------------------

const VERDANA_UNITS: Readonly<Record<string, number>> = {
  " ": 352, "!": 342, '"': 459, "#": 818, $: 636, "%": 1076, "&": 727, "'": 269,
  "(": 454, ")": 454, "*": 636, "+": 818, ",": 364, "-": 454, ".": 364, "/": 454,
  "0": 636, "1": 636, "2": 636, "3": 636, "4": 636, "5": 636, "6": 636, "7": 636,
  "8": 636, "9": 636, ":": 454, ";": 454, "<": 818, "=": 818, ">": 818, "?": 547,
  "@": 1000,
  A: 684, B: 686, C: 698, D: 770, E: 632, F: 575, G: 775, H: 752, I: 421, J: 455,
  K: 693, L: 557, M: 843, N: 748, O: 787, P: 603, Q: 787, R: 695, S: 683, T: 616,
  U: 732, V: 684, W: 989, X: 685, Y: 616, Z: 685,
  "[": 454, "\\": 454, "]": 454, "^": 818, _: 636, "`": 636,
  a: 600, b: 623, c: 521, d: 623, e: 596, f: 352, g: 623, h: 633, i: 274, j: 344,
  k: 592, l: 274, m: 973, n: 633, o: 607, p: 623, q: 623, r: 427, s: 521, t: 394,
  u: 633, v: 592, w: 818, x: 592, y: 592, z: 525,
  "{": 636, "|": 454, "}": 636, "~": 818,
  "\u00B7": 364,
};

/** Width in px (two decimals) of each table entry at 11 px. */
const WIDTH_TABLE: ReadonlyMap<string, number> = new Map(
  Object.entries(VERDANA_UNITS).map(([ch, u]) => [
    ch,
    Math.round((u * FONT_SIZE_PX) / 10) / 100,
  ]),
);

/** Widest table entry (or the default, if larger); charged for the ellipsis. */
const MAX_CHAR_WIDTH_PX = Math.max(DEFAULT_CHAR_WIDTH_PX, ...WIDTH_TABLE.values());

function codePointWidth(ch: string): number {
  if (ch === ELLIPSIS) return MAX_CHAR_WIDTH_PX;
  return WIDTH_TABLE.get(ch) ?? DEFAULT_CHAR_WIDTH_PX;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function parseBadgeStyle(raw: string | null | undefined): BadgeStyle {
  return raw === "flat" ? "flat" : "haunted";
}

function isXmlChar(cp: number): boolean {
  return (
    cp === 0x9 ||
    cp === 0xa ||
    cp === 0xd ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

/**
 * Replace characters that are not valid in XML 1.0 (including lone surrogates)
 * with U+FFFD, and tab/LF/CR with a space. Preserves length in code points.
 */
export function sanitizeBadgeText(s: string): string {
  let out = "";
  // Iterating a string by code point yields lone surrogates as single items.
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0) as number;
    if (cp === 0x9 || cp === 0xa || cp === 0xd) out += " ";
    else if (isXmlChar(cp)) out += ch;
    else out += "\uFFFD";
  }
  return out;
}

/** Keep up to 64 code points; otherwise the first 63 plus one ellipsis. */
export function truncateBadgeText(s: string): string {
  const points = Array.from(String(s));
  if (points.length <= MAX_TEXT_CODE_POINTS) return points.join("");
  return points.slice(0, MAX_TEXT_CODE_POINTS - 1).join("") + ELLIPSIS;
}

export function escapeXml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export function textWidthPx(s: string): number {
  let sum = 0;
  for (const ch of String(s)) sum += codePointWidth(ch);
  return Math.round(sum * 100) / 100;
}

export function segmentWidthPx(s: string): number {
  return Math.ceil(textWidthPx(s) + 2 * PADDING_PX);
}

export function isValidRepoName(s: string): boolean {
  return typeof s === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(s);
}

// ---------------------------------------------------------------------------
// SVG construction
// ---------------------------------------------------------------------------

function cleanText(s: unknown): string {
  return truncateBadgeText(sanitizeBadgeText(typeof s === "string" ? s : ""));
}

function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function leftPath(w: number): string {
  const r = CORNER_RADIUS_PX;
  const h = BADGE_HEIGHT_PX;
  return `M${r} 0H${w}V${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
}

function rightPath(x: number, w: number): string {
  const r = CORNER_RADIUS_PX;
  const h = BADGE_HEIGHT_PX;
  return `M${x} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${x}Z`;
}

function wholePath(w: number): string {
  const r = CORNER_RADIUS_PX;
  const h = BADGE_HEIGHT_PX;
  return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
}

function renderBadge(p: BadgeParams): string {
  const label = cleanText(p.label);
  const message = cleanText(p.message);
  const tone = BADGE_PALETTE[resolveTone(p.tone)];
  const flat = p.style === "flat";
  const labelColors = flat ? BADGE_PALETTE.flatLabel : BADGE_PALETTE.hauntedLabel;

  const lw = segmentWidthPx(label);
  const vw = segmentWidthPx(message);
  const total = lw + vw;
  const lt = textWidthPx(label);
  const vt = textWidthPx(message);
  const lx = lw / 2;
  const vx = lw + vw / 2;
  const name = escapeXml(`${label}: ${message}`);

  const shapes = flat
    ? `<path d="${wholePath(total)}" fill="none" stroke="${BADGE_PALETTE.flatOutline.fill}"/>` +
      `<path d="${leftPath(lw)}" fill="${labelColors.fill}"/>` +
      `<path d="${rightPath(lw, total)}" fill="${tone.fill}"/>`
    : `<path d="${wholePath(total)}" fill="${BADGE_PALETTE.hauntedBase.fill}"/>` +
      `<path d="${leftPath(lw)}" fill="${labelColors.fill}"/>` +
      `<path d="${rightPath(lw, total)}" fill="${tone.fill}"/>`;

  const textAttrs = `y="14" text-anchor="middle" lengthAdjust="spacingAndGlyphs"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${BADGE_HEIGHT_PX}" role="img" aria-label="${name}">` +
    `<title>${name}</title>` +
    shapes +
    `<g font-family="Verdana,DejaVu Sans,sans-serif" font-size="${FONT_SIZE_PX}">` +
    `<text x="${num(lx)}" ${textAttrs} textLength="${num(lt)}" fill="${labelColors.text}">${escapeXml(label)}</text>` +
    `<text x="${num(vx)}" ${textAttrs} textLength="${num(vt)}" fill="${tone.text}">${escapeXml(message)}</text>` +
    `</g></svg>`
  );
}

/** Hard-coded, last-resort SVG used if building throws or is too large. */
export const MINIMAL_FALLBACK_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="20" role="img" aria-label="repo graveyard: ${FALLBACK_UNAVAILABLE}">` +
  `<title>repo graveyard: ${FALLBACK_UNAVAILABLE}</title>` +
  `<rect width="150" height="20" rx="3" fill="${BADGE_PALETTE.fallback.fill}"/>` +
  `<text x="75" y="14" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" fill="${BADGE_PALETTE.fallback.text}">repo graveyard: ${FALLBACK_UNAVAILABLE}</text>` +
  `</svg>`;

const encoder = new TextEncoder();

export function buildBadge(p: BadgeParams): string {
  try {
    const svg = renderBadge(p);
    if (encoder.encode(svg).length >= MAX_SVG_BYTES) return MINIMAL_FALLBACK_SVG;
    return svg;
  } catch {
    return MINIMAL_FALLBACK_SVG;
  }
}
