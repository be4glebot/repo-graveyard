// @vitest-environment node
/**
 * Source-scan tests for the explorable worlds (task 17.2).
 * Reads files as text; no DOM, no network.
 * Requirements: 14.7, 14.8, 15.7, 17.6, 17.8, 17.9, 19.4, 19.5, 19.9, 5.5, 11.11
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORLD_ART } from "@/lib/world-art";
import { WORLD_CONFIG } from "@/lib/world-layout";

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

/** Remove block comments and whole-line `//` comments (keeps strings intact). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function worldFiles(): string[] {
  return readdirSync(join(ROOT, "components/world"))
    .filter((f) => /\.(tsx?|css)$/.test(f))
    .sort()
    .map((f) => `components/world/${f}`);
}

const WORLD_SOURCES = worldFiles().map((file) => ({
  file,
  raw: read(file),
  code: stripComments(read(file)),
}));

/** Run git, or return undefined when git (or the repo) is unavailable. */
function git(args: string[]): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Dependencies and art files (Req 14.7, 14.8, 17.9, 19.9)
// ---------------------------------------------------------------------------

const PINNED_DEPENDENCIES = [
  "@octokit/graphql",
  "@octokit/rest",
  "@upstash/redis",
  "framer-motion",
  "next",
  "react",
  "react-dom",
  "server-only",
  "zod",
];
const PINNED_DEV_DEPENDENCIES = [
  "@tailwindcss/turbopack",
  "@testing-library/dom",
  "@testing-library/react",
  "@testing-library/user-event",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "@vitejs/plugin-react",
  "eslint",
  "eslint-config-next",
  "fast-check",
  "jsdom",
  "tailwindcss",
  "typescript",
  "vite-tsconfig-paths",
  "vitest",
];

const names = (o: Record<string, string> | undefined): string[] =>
  Object.keys(o ?? {}).sort();

describe("no new dependencies (Req 14.7, 17.9)", () => {
  const pkg = JSON.parse(read("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it("package.json dependency names equal the pinned snapshot", () => {
    expect(names(pkg.dependencies)).toEqual([...PINNED_DEPENDENCIES].sort());
    expect(names(pkg.devDependencies)).toEqual([...PINNED_DEV_DEPENDENCIES].sort());
  });

  it("the lockfile root entry lists the same dependency names", () => {
    const lock = JSON.parse(read("package-lock.json")) as {
      packages?: Record<
        string,
        { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
      >;
    };
    const root = lock.packages?.[""];
    expect(root).toBeDefined();
    expect(names(root?.dependencies)).toEqual([...PINNED_DEPENDENCIES].sort());
    expect(names(root?.devDependencies)).toEqual([...PINNED_DEV_DEPENDENCIES].sort());
  });

  it("package.json adds no dependency name compared with HEAD (skipped without git)", () => {
    const head = git(["show", "HEAD:package.json"]);
    if (head === undefined) return;
    const base = JSON.parse(head) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const baseNames = new Set([...names(base.dependencies), ...names(base.devDependencies)]);
    const added = [...names(pkg.dependencies), ...names(pkg.devDependencies)].filter(
      (n) => !baseNames.has(n),
    );
    expect(added).toEqual([]);
  });
});

const PINNED_ART = [
  "bg-far.webp",
  "coffin.webp",
  "fg-frame.webp",
  "fog-wisps-thin.webp",
  "fog-wisps.webp",
  "ghost-0.webp",
  "ghost-1.webp",
  "ghost-2.webp",
  "ghost-3.webp",
  "mausoleum.webp",
  "mg-fence-tile.webp",
  "mg-fence.webp",
  "moon.webp",
  "place-crypt.webp",
  "place-gate.webp",
  "place-ground.webp",
  "place-sky.webp",
  "risen.webp",
  "tomb-arch-fresh.webp",
  "zombie-0.webp",
  "zombie-1.webp",
  "zombie-2.webp",
  "zombie-3.webp",
  "zombie-4.webp",
];
const ART_LIMIT = 150 * 1024;
/** Existing plates already over the limit: they may never grow (Req 19.9). */
const LEGACY_OVERSIZE_MAX: Record<string, number> = {
  "fg-frame.webp": 241120,
  "fog-wisps.webp": 235908,
  "mg-fence.webp": 357144,
  "place-crypt.webp": 279014,
  "place-gate.webp": 203092,
  "place-ground.webp": 156062,
};

describe("public/art is unchanged and small (Req 14.8, 19.9)", () => {
  const dir = join(ROOT, "public/art");
  const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());

  it("the file set equals the pinned list", () => {
    expect([...files].sort()).toEqual([...PINNED_ART].sort());
  });

  it("every file is under 150 KB or is a legacy plate that did not grow", () => {
    for (const f of files) {
      const size = statSync(join(dir, f)).size;
      const legacy = LEGACY_OVERSIZE_MAX[f];
      if (legacy === undefined) expect(size, f).toBeLessThan(ART_LIMIT);
      else expect(size, f).toBeLessThanOrEqual(legacy);
    }
  });
});

// ---------------------------------------------------------------------------
// Component sources (Req 15.7, 17.6, 19.4, 5.5, 11.11)
// ---------------------------------------------------------------------------

const TSX = WORLD_SOURCES.filter((s) => s.file.endsWith(".tsx") || s.file.endsWith(".ts"));

describe("components/world has no hardcoded colours or fonts (Req 15.7, 18.6)", () => {
  it("contains no #hex, rgb(), rgba(), hsl() or hsla() literal", () => {
    const bad: string[] = [];
    for (const s of TSX) {
      for (const m of s.code.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g)) {
        bad.push(`${s.file}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("declares no font family and imports no font loader", () => {
    const bad: string[] = [];
    for (const s of TSX) {
      for (const m of s.code.matchAll(
        // `var(--font-*)` is the next/font variable and is the only allowed family.
        /font-family|fontFamily:(?!\s*["']var\(--font-)|@font-face|font-\[['"]|next\/font\/(google|local)/g,
      )) {
        bad.push(`${s.file}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

/** The JSX tag text around `index`: from the last `<Name` back, to its closing line. */
function tagAround(code: string, index: number): string {
  const before = code.slice(0, index);
  const starts = [...before.matchAll(/<[A-Za-z]/g)];
  const start = starts.length ? starts[starts.length - 1].index! : Math.max(0, index - 300);
  const rest = code.slice(index);
  const endRel = rest.search(/\n\s*\/?>/);
  const end = index + (endRel === -1 ? 400 : endRel);
  return code.slice(start, end);
}

describe("overflow rules (Req 17.6)", () => {
  it("overflow-hidden never appears in the world components", () => {
    const bad = TSX.filter((s) => /overflow-hidden|overflow-x-hidden|overflow-y-hidden/.test(s.code));
    expect(bad.map((s) => s.file)).toEqual([]);
  });

  it("overflow-clip and overflow-x-clip appear only on WorldScroller and decor-clip wrappers", () => {
    const bad: string[] = [];
    for (const s of TSX) {
      if (s.file.endsWith("/WorldScroller.tsx")) continue;
      for (const m of s.code.matchAll(/overflow-(x-|y-)?clip/g)) {
        // CropLayer is the decor-clip wrapper itself (its default className).
        if (s.file.endsWith("/CropLayer.tsx")) continue;
        const tag = tagAround(s.code, m.index!);
        const ok =
          tag.includes("data-decor-clip") ||
          tag.startsWith("<CropLayer") ||
          // EmptyScene roots: documented viewport clip (no scrollbar), decor only.
          tag.includes("data-variant=");
        if (!ok) bad.push(`${s.file}: ${tag.slice(0, 80).replace(/\s+/g, " ")}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("CropLayer sets data-decor-clip on its wrapper", () => {
    expect(read("components/world/CropLayer.tsx")).toContain('data-decor-clip=""');
  });
});

describe("worlds render no Data_Fog (Req 15.9)", () => {
  it("no scene-fog class or test id in components/world", () => {
    const bad = TSX.filter((s) => s.code.includes("scene-fog")).map((s) => s.file);
    expect(bad).toEqual([]);
  });
});

describe("scroll path stays passive and measurement-free (Req 4, 5)", () => {
  it("wheel and touch listeners are never registered non-passively", () => {
    const bad: string[] = [];
    for (const s of TSX) {
      for (const m of s.code.matchAll(/addEventListener\(\s*["'](wheel|mousewheel|touch\w+)["'][^)]*\)/g)) {
        if (!/passive:\s*true/.test(m[0])) bad.push(`${s.file}: ${m[0]}`);
      }
      if (/\bon(Wheel|TouchStart|TouchMove|TouchEnd)\b/.test(s.code)) {
        bad.push(`${s.file}: React wheel/touch prop`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("scroll listeners and shared listener options are passive", () => {
    for (const f of ["useWorldScroll.ts", "useScrollGuard.ts", "useScrollForward.ts"]) {
      const code = stripComments(read(`components/world/${f}`));
      expect(code, f).toMatch(/passive:\s*true/);
      expect(code, f).not.toMatch(/passive:\s*false/);
    }
  });

  it("the scroll path never calls getBoundingClientRect", () => {
    const bad: string[] = [];
    for (const f of [
      "useWorldScroll.ts",
      "useScrollGuard.ts",
      "useScrollForward.ts",
      "WorldScroller.tsx",
    ]) {
      if (/getBoundingClientRect/.test(stripComments(read(`components/world/${f}`)))) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});

describe("background repeat only with the fence tile (Req 19.4)", () => {
  it("repeat values appear only next to mg-fence-tile", () => {
    const bad: string[] = [];
    for (const s of TSX) {
      for (const m of s.code.matchAll(
        /backgroundRepeat:\s*["'](?!no-repeat)[^"']*["']|(?<![\w-])bg-repeat(?:-[xy]|-round|-space)?(?![\w-])/g,
      )) {
        const i = m.index!;
        const near = s.code.slice(Math.max(0, i - 400), i + 400);
        if (!near.includes("mg-fence-tile")) bad.push(`${s.file}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("fixture classes have no dashboard patterns (Req 11.11, 18.4)", () => {
  const FIXTURES = [
    "components/world/DepthMarker.tsx",
    "components/scene/FilterChips.tsx",
    "components/scene/Pager.tsx",
    "components/scene/ReturnToGate.tsx",
  ];
  for (const file of FIXTURES) {
    it(`${file} has no pills, soft shadows, white cards, progress or tab roles`, () => {
      const code = stripComments(read(file));
      expect(code).not.toContain("rounded-full");
      expect(code).not.toMatch(/(^|[\s"'`:])shadow-/);
      expect(code).not.toContain("bg-white");
      expect(code).not.toMatch(/role=["'](progressbar|tab|tablist|tabpanel)["']/);
      expect(code).not.toContain("<progress");
    });
  }
});

// ---------------------------------------------------------------------------
// CSS: keyframes and tokens (Req 5.5, 15.9, 12.4)
// ---------------------------------------------------------------------------

const CSS = read("app/globals.css");
const WORLD_CSS_START_MARKER = "Explorable Worlds — tokens and shared CSS";
const WORLD_CSS_END_MARKER = "/* ===== end Explorable Worlds ===== */";
const WORLD_CSS_START = CSS.indexOf(WORLD_CSS_START_MARKER);
const WORLD_CSS_END = CSS.indexOf(WORLD_CSS_END_MARKER);
/** The world section only: from its banner to the end marker. */
const WORLD_CSS = WORLD_CSS_START >= 0 && WORLD_CSS_END > WORLD_CSS_START
  ? CSS.slice(WORLD_CSS_START, WORLD_CSS_END)
  : "";

/** All `@keyframes name { ... }` blocks of a CSS string (brace matched). */
function keyframeBlocks(css: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const from = i;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out.push({ name: m[1], body: css.slice(from, i - 1) });
  }
  return out;
}

/** Declared property names inside the innermost `{}` blocks of a keyframe body. */
function animatedProps(body: string): string[] {
  const props = new Set<string>();
  for (const block of body.matchAll(/\{([^{}]*)\}/g)) {
    for (const d of block[1].matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)) props.add(d[1]);
  }
  return [...props];
}

describe("world CSS keyframes animate only transform and opacity (Req 5.5)", () => {
  const css = WORLD_CSS;
  const blocks = keyframeBlocks(css);

  it("finds the world section and its keyframes", () => {
    // Fail loudly if either marker is missing or out of order.
    expect(WORLD_CSS_START, "start banner missing in app/globals.css").toBeGreaterThan(0);
    expect(WORLD_CSS_END, "end marker missing in app/globals.css").toBeGreaterThan(WORLD_CSS_START);
    expect(css.length).toBeGreaterThan(0);
    const names = blocks.map((b) => b.name);
    for (const n of ["camera-drift", "env-mist-sway", "star-twinkle", "cloud-drift"]) {
      expect(names).toContain(n);
    }
  });

  it("every keyframe in the world section uses only transform, opacity and easing", () => {
    const ALLOWED = new Set(["transform", "opacity", "animation-timing-function"]);
    const bad: string[] = [];
    for (const b of blocks) {
      for (const p of animatedProps(b.body)) if (!ALLOWED.has(p)) bad.push(`${b.name}: ${p}`);
    }
    expect(bad).toEqual([]);
  });

  it("the Hub cues animate nothing but transform, opacity and filter transitions", () => {
    const m = css.match(/\.place-cue\s*\{\s*transition:([^}]*)\}/);
    expect(m).not.toBeNull();
    const props = [...m![1].matchAll(/(?:^|,)\s*([a-z-]+)\s/g)].map((x) => x[1]);
    expect(props.sort()).toEqual(["filter", "opacity", "transform"]);
  });
});

function tokenPx(name: string): number {
  const m = CSS.match(new RegExp(`${name}:\\s*(-?[\\d.]+)px`));
  if (!m) throw new Error(`missing token ${name}`);
  return Number(m[1]);
}
function tokenNum(name: string): number {
  const m = CSS.match(new RegExp(`${name}:\\s*(-?[\\d.]+)\\s*;`));
  if (!m) throw new Error(`missing token ${name}`);
  return Number(m[1]);
}

describe("pad and mist tokens (Req 12.4, 15.9)", () => {
  it("pad tokens equal the WORLD_CONFIG clearances plus 8 px", () => {
    expect(tokenPx("--world-pad-top")).toBe(WORLD_CONFIG.desktop.TOP_CLEAR + 8);
    expect(tokenPx("--world-pad-bottom")).toBe(WORLD_CONFIG.desktop.BOTTOM_CLEAR);
    expect(tokenPx("--world-pad-top-compact")).toBe(WORLD_CONFIG.compact.TOP_CLEAR + 8);
    expect(tokenPx("--world-pad-bottom-compact")).toBe(WORLD_CONFIG.compact.BOTTOM_CLEAR);
  });

  it("mist tokens are positive and within the caps (0.25, crypt 0.2)", () => {
    for (const place of ["sky", "ground", "crypt"] as const) {
      const v = tokenNum(`--world-mist-${place}`);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(place === "crypt" ? 0.2 : 0.25);
    }
  });

  it("EnvMist reads the opacity from the token, not a number", () => {
    const code = stripComments(read("components/world/EnvMist.tsx"));
    expect(code).toContain("var(--env-mist-opacity");
    expect(code).not.toMatch(/opacity:\s*0?\.\d/);
  });
});

// ---------------------------------------------------------------------------
// Pure libs (Req 17.8) and WORLD_ART (Req 19.5)
// ---------------------------------------------------------------------------

describe("pure world libs stay pure (Req 17.8)", () => {
  const LIBS = [
    "lib/world-layout.ts",
    "lib/world-motion.ts",
    "lib/world-art.ts",
    "lib/world-light.ts",
    "lib/world-effects.ts",
    "lib/contrast.ts",
  ];
  for (const file of LIBS) {
    it(`${file} imports no react/next/server-only and uses no browser or clock globals`, () => {
      const code = stripComments(read(file));
      expect(code).not.toMatch(/from\s+["'](react|react-dom|next|server-only)(\/[^"']*)?["']/);
      expect(code).not.toMatch(/\bimport\s+["'](react|next|server-only)/);
      expect(code).not.toMatch(/\b(window|document|localStorage)\b/);
      expect(code).not.toMatch(/\bDate\b/);
      expect(code).not.toMatch(/Math\.random/);
    });
  }
});

describe("WORLD_ART variation rules (Req 19.5)", () => {
  const offsetDistance = (
    a?: { x: number; y: number },
    b?: { x: number; y: number },
  ): number => Math.max(Math.abs((a?.x ?? 0) - (b?.x ?? 0)), Math.abs((a?.y ?? 0) - (b?.y ?? 0)));

  for (const place of ["sky", "ground", "crypt"] as const) {
    it(`${place}: entries sharing a plate differ by flip or by an offset of at least 0.25`, () => {
      const specs = WORLD_ART[place];
      const bad: string[] = [];
      for (let i = 0; i < specs.length; i++) {
        for (let j = i + 1; j < specs.length; j++) {
          const a = specs[i];
          const b = specs[j];
          if (a.plate !== b.plate) continue;
          const flipDiffers = a.flip.h !== b.flip.h || a.flip.v !== b.flip.v;
          if (!flipDiffers && offsetDistance(a.offset, b.offset) < 0.25) {
            bad.push(`${a.stratumId} vs ${b.stratumId}`);
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it("ground flips only crops whose focal fy is at least 0.48", () => {
    for (const s of WORLD_ART.ground) {
      if (s.flip.h || s.flip.v) expect(s.focal.fy, s.stratumId).toBeGreaterThanOrEqual(0.48);
    }
  });

  it("art file referenced by every plate exists", () => {
    for (const place of ["sky", "ground", "crypt"] as const) {
      for (const s of WORLD_ART[place]) {
        expect(existsSync(join(ROOT, `public/art/${s.plate}.webp`)), s.plate).toBe(true);
      }
    }
  });
});
