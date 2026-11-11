/**
 * Static source and package scans for graveyard-mcp.
 * Validates: Requirements 2.1, 2.3, 2.6, 2.7, 2.8, 11.10, 12.5
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(PKG_DIR, "src");
const ROOT_DIR = join(PKG_DIR, "..", "..");

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTs(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Blank out comments (keeping string and template literals intact). */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const files = listTs(SRC_DIR).map((f) => ({
  rel: relative(PKG_DIR, f).replace(/\\/g, "/"),
  code: stripComments(readFileSync(f, "utf8")),
}));

function specifiers(code: string): string[] {
  const found: string[] = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
  for (const m of code.matchAll(re)) found.push(m[1]);
  return found;
}

const ALLOWED_APP_IMPORTS = new Set(["@/lib/revive-brief", "@/lib/seance-schema"]);

describe("src static scans", () => {
  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("reads only GRAVEYARD_URL from process.env", () => {
    for (const { rel, code } of files) {
      const dotted = [...code.matchAll(/process\.env\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
      for (const name of dotted) expect(name, rel).toBe("GRAVEYARD_URL");
      const bracketed = [...code.matchAll(/process\.env\s*\[\s*["'`]([^"'`]+)["'`]\s*\]/g)].map(
        (m) => m[1],
      );
      for (const name of bracketed) expect(name, rel).toBe("GRAVEYARD_URL");
      // No bare use of process.env (spread, destructure, dynamic key, passing it around).
      const total = [...code.matchAll(/process\.env\b/g)].length;
      expect(total, rel).toBe(dotted.length + bracketed.length);
    }
  });

  it("imports no fs or child_process module", () => {
    const banned = /^(node:)?(fs|fs\/promises|child_process)$/;
    for (const { rel, code } of files) {
      for (const spec of specifiers(code)) expect(spec, rel).not.toMatch(banned);
    }
  });

  it("imports only the allowed app modules", () => {
    for (const { rel, code } of files) {
      for (const spec of specifiers(code)) {
        if (spec.startsWith("@/")) {
          expect(ALLOWED_APP_IMPORTS.has(spec), `${rel}: ${spec}`).toBe(true);
        } else if (spec.startsWith(".")) {
          expect(spec, rel).toMatch(/^\.\/[A-Za-z0-9_-]+$/); // stays inside src/
        } else {
          expect(
            /^(node:[a-z_/]+|zod|@modelcontextprotocol\/sdk\/[A-Za-z0-9_./-]+)$/.test(spec),
            `${rel}: ${spec}`,
          ).toBe(true);
        }
      }
    }
  });

  it("never writes to stdout or uses console.log/info", () => {
    for (const { rel, code } of files) {
      expect(code, rel).not.toMatch(/console\s*\.\s*(log|info)\b/);
      expect(code, rel).not.toMatch(/process\s*\.\s*stdout\s*\.\s*write\b/);
    }
  });

  it("client.ts has no credentials, cookie or authorization token", () => {
    const client = files.find((f) => f.rel === "src/client.ts");
    expect(client).toBeDefined();
    expect(client!.code).not.toMatch(/credentials|cookie|authorization/i);
  });
});

describe("package manifests", () => {
  const mcp = JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf8")) as {
    type?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const root = JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

  it("is an ES module package", () => {
    expect(mcp.type).toBe("module");
  });

  it("pins every dependency to an exact version", () => {
    const all = { ...mcp.dependencies, ...mcp.devDependencies };
    for (const [name, version] of Object.entries(all)) {
      expect(version, name).toMatch(EXACT);
    }
  });

  it("declares the SDK and zod 4 as dependencies and esbuild as a devDependency", () => {
    expect(mcp.dependencies?.["@modelcontextprotocol/sdk"]).toMatch(EXACT);
    expect(mcp.dependencies?.zod).toMatch(EXACT);
    expect(mcp.dependencies!.zod.split(".")[0]).toBe("4");
    expect(mcp.devDependencies?.esbuild).toMatch(EXACT);
    expect(mcp.dependencies).not.toHaveProperty("esbuild");
  });

  it("root package.json has the three mcp:* scripts", () => {
    expect(root.scripts?.["mcp:install"]).toBeTruthy();
    expect(root.scripts?.["mcp:build"]).toBeTruthy();
    expect(root.scripts?.["mcp:typecheck"]).toBeTruthy();
  });

  it("root package.json declares neither esbuild nor the MCP SDK", () => {
    for (const map of [root.dependencies ?? {}, root.devDependencies ?? {}]) {
      expect(map).not.toHaveProperty("esbuild");
      expect(map).not.toHaveProperty("@modelcontextprotocol/sdk");
    }
  });
});
