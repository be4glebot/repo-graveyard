import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pkg, "../..");

let dir = "";

/** Same esbuild options as build.mjs, but written to a temp directory. */
async function buildBundle(outDir: string): Promise<void> {
  await build({
    entryPoints: [path.join(pkg, "src/index.ts")],
    outfile: path.join(outDir, "index.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
    tsconfig: path.join(pkg, "tsconfig.json"),
    alias: { zod: path.join(pkg, "node_modules/zod") },
    banner: {
      js: "import{createRequire}from'node:module';const require=createRequire(import.meta.url);",
    },
    legalComments: "none",
    logLevel: "silent",
  });
  await writeFile(path.join(outDir, "package.json"), '{"type":"module"}');
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(env: Record<string, string>, input?: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["index.js"], {
      cwd: dir,
      env: { PATH: process.env.PATH ?? "", ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (c: string) => (stdout += c));
    child.stderr.setEncoding("utf8").on("data", (c: string) => (stderr += c));
    const timer = setTimeout(() => child.kill(), 15_000);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    if (input !== undefined) child.stdin.write(input);
    // Closing stdin lets the stdio server shut down once it has replied.
    setTimeout(() => child.stdin.end(), input !== undefined ? 1500 : 0);
  });
}

describe("graveyard-mcp bundle", { timeout: 30_000 }, () => {
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "graveyard-mcp-bundle-"));
    await buildBundle(dir);
  }, 30_000);

  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("answers an MCP initialize request and writes only JSON-RPC to stdout", async () => {
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "bundle-test", version: "0.0.0" },
      },
    };
    const res = await run(
      { GRAVEYARD_URL: "http://localhost:3000" },
      JSON.stringify(request) + "\n",
    );
    const lines = res.stdout.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    const msg = JSON.parse(lines[0]);
    expect(msg.jsonrpc).toBe("2.0");
    expect(msg.id).toBe(1);
    expect(msg.result.serverInfo).toBeDefined();
    expect(msg.result.capabilities.tools).toBeDefined();
  });

  it("exits 1 with one short stderr line and empty stdout for a bad GRAVEYARD_URL", async () => {
    const res = await run({ GRAVEYARD_URL: "ftp://x" });
    expect(res.code).toBe(1);
    expect(res.stdout).toBe("");
    const lines = res.stderr.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0].length).toBeLessThanOrEqual(200);
    expect(lines[0]).toContain("GRAVEYARD_URL");
  });

  it("npm run mcp:build produces dist/index.js", () => {
    const res = spawnSync("npm run mcp:build", {
      cwd: repoRoot,
      shell: true,
      encoding: "utf8",
    });
    expect(res.status).toBe(0);
    expect(existsSync(path.join(pkg, "dist/index.js"))).toBe(true);
  });
});
