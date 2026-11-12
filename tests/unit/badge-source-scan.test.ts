// Feature: graveyard-badges, Requirement 11: dependency and scope limits.
// Source-scan guards: purity of the pure core, server-only boundaries,
// no new dependencies, and read-only / override-free badge code.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Strip block and line comments so prose never trips the scans. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/** Module specifiers from import/export-from/dynamic import/require. */
function specifiers(src: string): string[] {
  const code = stripComments(src);
  const out: string[] = [];
  const re =
    /(?:\bimport\s+(?:[^"'`;]*?\sfrom\s+)?|\bexport\s+[^"'`;]*?\sfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
  for (let m = re.exec(code); m; m = re.exec(code)) out.push(m[1]);
  return out;
}

function walk(dir: string): string[] {
  const abs = join(ROOT, dir);
  const files: string[] = [];
  for (const name of readdirSync(abs)) {
    const full = join(abs, name);
    if (statSync(full).isDirectory()) files.push(...walk(relative(ROOT, full)));
    else if (/\.(ts|tsx)$/.test(name)) files.push(relative(ROOT, full).replace(/\\/g, "/"));
  }
  return files;
}

const PURE_MODULES = ["lib/badge.ts", "lib/badge-messages.ts", "lib/badge-snippets.ts"];
const ROUTE_FILES = ["app/api/badge/[owner]/route.ts", "app/api/badge/[owner]/[repo]/route.ts"];
const SERVICE = "lib/badge-service.ts";
const BADGE_SERVER_FILES = [SERVICE, ...ROUTE_FILES];
const BADGE_CODE = [...PURE_MODULES, ...BADGE_SERVER_FILES];

// Recorded at task 9.1: package.json must not gain entries for this feature.
const EXPECTED_DEPENDENCIES = [
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
const EXPECTED_DEV_DEPENDENCIES = [
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

describe("badge pure core imports", () => {
  for (const file of PURE_MODULES) {
    it(`${file} imports only relative modules (no server-only, react, next or package)`, () => {
      const specs = specifiers(read(file));
      for (const s of specs) {
        expect(s.startsWith("./") || s.startsWith("../"), `${file} imports "${s}"`).toBe(true);
        expect(s).not.toBe("server-only");
        expect(s).not.toMatch(/^react(\/|$)/);
        expect(s).not.toMatch(/^next(\/|$)/);
      }
    });
  }

  it("pure modules never import the service or any server-side module", () => {
    for (const file of PURE_MODULES) {
      for (const s of specifiers(read(file))) {
        expect(s).not.toMatch(/badge-service|graveyard-loader|ratelimit|github/);
      }
    }
  });
});

describe("badge server boundaries", () => {
  for (const file of BADGE_SERVER_FILES) {
    it(`${file} imports server-only`, () => {
      expect(specifiers(read(file))).toContain("server-only");
    });
  }

  it("route files reach the service through lib/badge-service", () => {
    for (const file of ROUTE_FILES) {
      expect(specifiers(read(file))).toContain("@/lib/badge-service");
    }
  });

  it("no client component imports the service or the badge route files", () => {
    const offenders: string[] = [];
    for (const file of [...walk("components"), ...walk("app"), ...walk("lib")]) {
      const src = read(file);
      const isClient = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(src);
      const isComponent = file.startsWith("components/");
      if (!isClient && !isComponent) continue;
      for (const s of specifiers(src)) {
        if (/badge-service|api\/badge/.test(s)) offenders.push(`${file} -> ${s}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the dialog components import only the pure badge modules", () => {
    for (const file of walk("components/badge")) {
      for (const s of specifiers(read(file))) {
        expect(s).not.toBe("server-only");
        expect(s).not.toMatch(/badge-service/);
      }
    }
  });
});

describe("package.json dependency lists", () => {
  const pkg = JSON.parse(read("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it("dependencies match the recorded list", () => {
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([...EXPECTED_DEPENDENCIES].sort());
  });

  it("devDependencies match the recorded list", () => {
    expect(Object.keys(pkg.devDependencies ?? {}).sort()).toEqual(
      [...EXPECTED_DEV_DEPENDENCIES].sort(),
    );
  });
});

describe("badge code is read-only and override-free", () => {
  it("issues no non-GET request", () => {
    for (const file of BADGE_CODE) {
      const code = stripComments(read(file));
      expect(code, `${file} method`).not.toMatch(/\bmethod\s*:\s*["'`](?!GET["'`])/i);
      expect(code, `${file} export`).not.toMatch(
        /export\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/,
      );
      expect(code, `${file} octokit write`).not.toMatch(
        /\.(?:post|put|patch|delete)\s*\(|octokit\.rest\.\w+\.(?:create|update|delete|add|remove|merge)/i,
      );
    }
  });

  it("imports no override store", () => {
    for (const file of BADGE_CODE) {
      for (const s of specifiers(read(file))) {
        expect(s, `${file} imports "${s}"`).not.toMatch(/overrides|ownerOverrides/i);
      }
    }
  });

  it("uses no localStorage or session access", () => {
    for (const file of BADGE_CODE) {
      expect(stripComments(read(file)), file).not.toMatch(/localStorage|sessionStorage/);
    }
  });

  it("route files export only GET", () => {
    for (const file of ROUTE_FILES) {
      const names = [
        ...stripComments(read(file)).matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g),
      ].map((m) => m[1]);
      expect(names).toEqual(["GET"]);
    }
  });
});
