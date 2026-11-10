/**
 * Source-scan assertions for the séance (task 13.9).
 *
 * Static checks only: no raw HTML injection, no colour literals, server-only
 * modules guarded, no secrets or server modules in client code, no audio, and
 * no AI SDK dependency.
 *
 * Requirements: 6.11, 8.12, 13.3, 16.3, 19.1, 19.7, 20.21
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

// Same hex pattern as tests/unit/no-hardcoded-hex.test.ts.
const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;
const FUNC_COLOR = /\b(?:rgba?|hsla?)\(/;

function rel(p: string): string {
  return relative(root, p).replace(/\\/g, "/");
}

function read(repoPath: string): string {
  return readFileSync(join(root, repoPath), "utf8");
}

function listFiles(dir: string, exts: string[]): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    const full = join(abs, name);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(rel(full), exts));
    } else if (exts.some((e) => name.endsWith(e))) {
      out.push(rel(full));
    }
  }
  return out;
}

const seanceFiles = listFiles("components/seance", [".ts", ".tsx"]);
const colourFiles = [
  ...seanceFiles,
  "components/detail/DetailPanel.tsx",
  "components/detail/Portrait.tsx",
];

function offenders(files: string[], re: RegExp): string[] {
  const hits: string[] = [];
  for (const f of files) {
    read(f)
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (re.test(line)) hits.push(`${f}:${i + 1}  ${line.trim()}`);
      });
  }
  return hits;
}

const SERVER_ONLY_MODULES = [
  "lib/llm.ts",
  "lib/ratelimit.ts",
  "lib/ratelimit-store.ts",
  "lib/seance-gather.ts",
  "lib/seance-service.ts",
  "app/api/seance/route.ts",
];

describe("séance source scan", () => {
  it("finds the files it is meant to scan", () => {
    expect(seanceFiles.length).toBeGreaterThan(0);
    for (const f of colourFiles) expect(existsSync(join(root, f))).toBe(true);
  });

  it("uses no dangerouslySetInnerHTML in components/seance", () => {
    expect(offenders(seanceFiles, /dangerouslySetInnerHTML/)).toEqual([]);
  });

  it("has no hex colour literals in séance components or the detail panel", () => {
    expect(offenders(colourFiles, HEX_COLOR)).toEqual([]);
  });

  it("has no rgb()/rgba()/hsl()/hsla() literals in séance components or the detail panel", () => {
    expect(offenders(colourFiles, FUNC_COLOR)).toEqual([]);
  });

  it("the colour patterns detect real literals and ignore non-colours", () => {
    expect("color: #f6f3ea").toMatch(HEX_COLOR);
    expect("url(#n)").not.toMatch(HEX_COLOR);
    expect("rgba(0,0,0,.5)").toMatch(FUNC_COLOR);
    expect("hsl(10 20% 30%)").toMatch(FUNC_COLOR);
    expect("var(--color-ink)").not.toMatch(FUNC_COLOR);
  });

  it.each(SERVER_ONLY_MODULES)('%s imports "server-only"', (file) => {
    expect(read(file)).toMatch(/^\s*import\s+["']server-only["'];?/m);
  });

  it("client components never import server modules or read LLM/GitHub secrets", () => {
    const files = [
      ...listFiles("components", [".ts", ".tsx"]),
    ].filter((f) => /^\s*["']use client["']/m.test(read(f)));
    expect(files.length).toBeGreaterThan(0);

    const serverImport = new RegExp(
      String.raw`from\s+["'](?:@/|(?:\.\./)+)?(?:lib/(?:llm|ratelimit|ratelimit-store|seance-gather|seance-service|github|cache)|app/api/seance/route)["']|from\s+["']server-only["']`,
    );
    expect(offenders(files, serverImport)).toEqual([]);
    expect(
      offenders(files, /process\.env\.(?:LLM_|GITHUB_TOKEN)|process\.env\[/),
    ).toEqual([]);
  });

  it("LLM_API_KEY is referenced only in lib/llm.ts", () => {
    const files = [
      ...listFiles("app", [".ts", ".tsx"]),
      ...listFiles("components", [".ts", ".tsx"]),
      ...listFiles("lib", [".ts", ".tsx"]),
    ].filter((f) => f !== "lib/llm.ts");
    expect(offenders(files, /LLM_API_KEY/)).toEqual([]);
    expect(read("lib/llm.ts")).toMatch(/LLM_API_KEY/);
  });

  it("ships no audio in components/seance", () => {
    expect(
      offenders(seanceFiles, /\bnew\s+Audio\b|\bAudioContext\b|<audio\b|speechSynthesis/),
    ).toEqual([]);
  });

  it("declares no AI SDK in package.json dependencies", () => {
    const pkg = JSON.parse(read("package.json")) as Record<string, Record<string, string> | undefined>;
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    const aiSdk = names.filter((n) =>
      /^@anthropic-ai\/|^openai$|^@ai-sdk\/|^ai$|^@google\/generative-ai$|^@google\/genai$|^@aws-sdk\/client-bedrock|^langchain|^@langchain\/|^cohere-ai$|^@mistralai\/|^groq-sdk$|^replicate$/.test(n),
    );
    expect(aiSdk).toEqual([]);
  });
});
