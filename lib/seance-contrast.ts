// Pure colour maths for the séance transcript contrast checks (WCAG 2).
// Text-shadow is never part of any calculation here (13.4).

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Rgba extends Rgb {
  a: number;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/** Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`. */
export function parseColor(css: string): Rgba {
  const s = css.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  const fn = /^rgba?\(\s*([^)]*)\)$/.exec(s);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter((p) => p.length > 0);
    if (parts.length === 3 || parts.length === 4) {
      const channel = (p: string): number =>
        p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p);
      const [r, g, b] = parts.slice(0, 3).map(channel);
      let a = 1;
      if (parts.length === 4) {
        const p = parts[3];
        a = p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p);
      }
      if ([r, g, b, a].every((n) => Number.isFinite(n))) {
        return {
          r: clamp(r, 0, 255),
          g: clamp(g, 0, 255),
          b: clamp(b, 0, 255),
          a: clamp(a, 0, 1),
        };
      }
    }
  }

  throw new Error(`Unsupported colour: ${css}`);
}

/** Composites `fg` at `alpha` over an opaque `bg`. */
export function compositeOver(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  const a = clamp(alpha, 0, 1);
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

/** WCAG 2 relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(rgb: Rgb): number {
  const lin = (v: number): number => {
    const c = clamp(v, 0, 255) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** WCAG 2 contrast ratio, symmetric, from 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
