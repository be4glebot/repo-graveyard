import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CSS-text checks for the séance classes in app/globals.css.
 * Validates: Requirements 10.2, 10.4, 10.5, 10.7, 10.8, 10.14, 11.2-11.6,
 * 11.8, 13.5-13.7, 18.5, 18.8, 18.9
 */

const raw = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "");
// The séance block of classes starts at the focus ring rule.
const start = stripped.indexOf("[data-seance-region] :focus-visible");
const seance = stripped.slice(start);

interface Block {
  selector: string;
  body: string;
  children: Block[];
}

function parse(css: string): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    out.push({
      selector,
      body,
      children: body.includes("{") ? parse(body) : [],
    });
    i = j;
  }
  return out;
}

function flatten(blocks: Block[]): Block[] {
  return blocks.flatMap((b) => [b, ...flatten(b.children)]);
}

const all = flatten(parse(seance));
const rules = all.filter((b) => b.children.length === 0);

function rulesFor(sel: string): Block[] {
  return rules.filter((b) =>
    b.selector.split(",").some((s) => s.trim() === sel),
  );
}
function keyframe(name: string): Block {
  const k = all.find((b) => b.selector === `@keyframes ${name}`);
  if (!k) throw new Error(`missing keyframes ${name}`);
  return k;
}
function decls(body: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const d of body.split(";")) {
    const idx = d.indexOf(":");
    if (idx > 0) o[d.slice(0, idx).trim()] = d.slice(idx + 1).trim();
  }
  return o;
}
function toMs(v: string): number {
  const m = /^(\d*\.?\d+)(ms|s)$/.exec(v);
  if (!m) throw new Error(`bad duration ${v}`);
  return m[2] === "s" ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
}

const keyframeBlocks = all.filter((b) => b.selector.startsWith("@keyframes"));
const ALLOWED = new Set(["transform", "opacity", "filter"]);
const reducedBlocks = all.filter((b) =>
  b.selector.includes("prefers-reduced-motion"),
);

describe("séance CSS", () => {
  it("found the séance section", () => {
    expect(start).toBeGreaterThan(-1);
    expect(keyframeBlocks.length).toBeGreaterThan(0);
  });

  it("keyframes animate only transform, opacity and filter", () => {
    for (const k of keyframeBlocks) {
      for (const frame of k.children) {
        for (const prop of Object.keys(decls(frame.body))) {
          if (prop === "animation-timing-function") continue;
          expect(ALLOWED.has(prop), `${k.selector} animates ${prop}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("transitions in séance rules only target opacity, filter or transform", () => {
    for (const r of rules) {
      const t = decls(r.body)["transition"];
      if (!t || t === "none") continue;
      const props = t
        .split(",")
        .map((p) => p.trim().split(/\s+/)[0])
        .filter(Boolean);
      for (const p of props) {
        expect(ALLOWED.has(p), `${r.selector} transitions ${p}`).toBe(true);
      }
    }
  });

  it("settled rule disables transition, animation and filter, with opacity 1", () => {
    const [r] = rulesFor('[data-state="settled"] .spirit-word');
    expect(r).toBeTruthy();
    const d = decls(r.body);
    expect(d.transition).toBe("none");
    expect(d.opacity).toBe("1");
    expect(d.filter).toBe("none");
    expect(d.animation).toBe("none");
  });

  it("smoke field has no border, no radius and no tail pseudo-element", () => {
    const [r] = rulesFor(".smoke-field");
    const d = decls(r.body);
    expect(d.border).toBe("0");
    expect(d["border-radius"]).toBe("0");
    const pseudo = rules.filter(
      (b) =>
        /\.smoke-field/.test(b.selector) &&
        /::|:before|:after/.test(b.selector),
    );
    expect(pseudo).toEqual([]);
  });

  it("ragged mask uses fog-wisps with the -webkit- prefix", () => {
    const [r] = rulesFor(".smoke-field-ragged");
    const d = decls(r.body);
    expect(d["mask-image"]).toBe("url(/art/fog-wisps.webp)");
    expect(d["-webkit-mask-image"]).toBe("url(/art/fog-wisps.webp)");
  });

  it("transcript text stays selectable and clickable", () => {
    for (const sel of [".smoke-field", ".smoke-field-text", ".spirit-word"]) {
      for (const r of rulesFor(sel)) {
        const d = decls(r.body);
        expect(d["user-select"]).not.toBe("none");
        expect(d["pointer-events"]).not.toBe("none");
      }
    }
  });

  it("font sizes are 15px below 768px and 16px from 768px up", () => {
    const [base] = rulesFor(".smoke-field-text");
    expect(decls(base.body)["font-size"]).toBe("15px");
    const media = all.find((b) => b.selector === "@media (min-width: 768px)");
    expect(media).toBeTruthy();
    const inner = media!.children.find((c) =>
      c.selector.includes(".smoke-field-text"),
    );
    expect(decls(inner!.body)["font-size"]).toBe("16px");
  });

  it("ledger and cause lines use 15px base, 16px at 768px+", () => {
    expect(decls(rulesFor(".ledger-title")[0].body)["font-size"]).toBe("15px");
    expect(decls(rulesFor(".cause-engraved")[0].body)["font-size"]).toBe(
      "15px",
    );
    const media = all.find(
      (b) =>
        b.selector === "@media (min-width: 768px)" &&
        b.children.some((c) => c.selector.includes(".ledger-title")),
    );
    expect(decls(media!.children[0].body)["font-size"]).toBe("16px");
  });

  it("focus ring uses candle-400 at 2px or more", () => {
    const [r] = rulesFor(".seance-focus:focus-visible");
    const d = decls(r.body);
    const m = /^(\d+(?:\.\d+)?)px\s+solid\s+var\(--color-candle-400\)$/.exec(
      d.outline,
    );
    expect(m).toBeTruthy();
    expect(parseFloat(m![1])).toBeGreaterThanOrEqual(2);
  });

  it("ritual dim is opacity 0.45 over 300ms", () => {
    for (const sel of [".ritual-dim", "[data-ritual-dim]"]) {
      const d = decls(rulesFor(sel)[0].body);
      expect(d.opacity).toBe("0.45");
      expect(d.transition).toMatch(/^opacity 300ms\b/);
    }
  });

  it("ritual surge brightness stays within 1.2 to 1.5", () => {
    for (const name of ["ritual-surge-ghost", "ritual-surge-zombie"]) {
      const values = [...keyframe(name).body.matchAll(/brightness\(([\d.]+)\)/g)]
        .map((m) => parseFloat(m[1]))
        .filter((v) => v !== 1);
      expect(values.length).toBeGreaterThan(0);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(1.2);
        expect(v).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it("reduced-motion block stops animation and uses one 200ms opacity fade", () => {
    const fadeToken = /--motion-ritual-fade-reduced:\s*(\d+ms)/.exec(stripped);
    expect(fadeToken?.[1]).toBe("200ms");
    const rm = reducedBlocks.flatMap((b) => b.children);
    const ritual = rm.find((c) => c.selector.includes(".ritual-surge-ghost"));
    expect(ritual).toBeTruthy();
    const d = decls(ritual!.body);
    expect(d.animation).toBe("none");
    expect(d.transition).toBe("opacity var(--motion-ritual-fade-reduced) linear");
    const verdict = rm.find((c) => c.selector === ".verdict-card");
    expect(decls(verdict!.body).animation).toMatch(
      /^verdict-card-fade var\(--motion-ritual-fade-reduced\)/,
    );
    const fade = keyframe("verdict-card-fade");
    for (const f of fade.children) {
      expect(Object.keys(decls(f.body))).toEqual(["opacity"]);
    }
  });

  it("no hex or rgb literals in séance classes (tokens only)", () => {
    expect(seance).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(seance).not.toMatch(/\brgba?\(|\bhsla?\(/);
  });

  it("no flicker faster than 3 loops per second", () => {
    const animDecls = rules
      .map((r) => decls(r.body).animation)
      .filter((a): a is string => !!a && a !== "none");
    expect(animDecls.length).toBeGreaterThan(0);
    for (const a of animDecls) {
      const dur = /\s(\d*\.?\d+(?:ms|s))\b/.exec(a);
      if (!dur) continue; // token-based (var()) durations are fixed above
      expect(toMs(dur[1])).toBeGreaterThanOrEqual(334);
    }
  });
});
