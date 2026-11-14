// Pure WCAG 2 contrast maths for the explorable worlds. No I/O, no framework imports.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type ColorInput = string | Rgb;

/** Parses `#rgb` or `#rrggbb` (the leading # is optional). Returns null when invalid. */
export function parseHex(hex: string): Rgb | null {
  if (typeof hex !== "string") return null;
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function luminance({ r, g, b }: Rgb): number {
  const lin = (v: number): number => {
    const c = Math.min(255, Math.max(0, v)) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * WCAG 2 contrast ratio between two opaque colours (hex strings or RGB),
 * symmetric, from 1 to 21. Throws on an unparseable hex string.
 */
export function contrastRatio(a: ColorInput, b: ColorInput): number {
  const toRgb = (c: ColorInput): Rgb => {
    if (typeof c !== "string") return c;
    const parsed = parseHex(c);
    if (!parsed) throw new Error(`Invalid hex colour: ${c}`);
    return parsed;
  };
  const la = luminance(toRgb(a));
  const lb = luminance(toRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
