import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pkg, "../..");
const read = (rel: string): string =>
  readFileSync(path.join(repoRoot, rel), "utf8");

type McpConfig = {
  mcpServers: Record<
    string,
    { command: string; args: string[]; env?: Record<string, string> }
  >;
};

describe("Kiro wiring: .kiro/settings/mcp.json", () => {
  const config = JSON.parse(read(".kiro/settings/mcp.json")) as McpConfig;

  beforeAll(() => {
    // Build so the relative path in the config resolves.
    const res = spawnSync("npm run mcp:build", {
      cwd: repoRoot,
      shell: true,
      encoding: "utf8",
    });
    expect(res.status, res.stderr).toBe(0);
  }, 60_000);

  it("registers exactly one server named graveyard", () => {
    expect(Object.keys(config.mcpServers)).toEqual(["graveyard"]);
  });

  it("runs node on the relative bundle path", () => {
    const server = config.mcpServers.graveyard;
    expect(server.command).toBe("node");
    expect(server.args).toEqual(["mcp/graveyard-mcp/dist/index.js"]);
    expect(path.isAbsolute(server.args[0])).toBe(false);
  });

  it("resolves the bundle path after mcp:build", () => {
    const target = path.join(repoRoot, config.mcpServers.graveyard.args[0]);
    expect(existsSync(target)).toBe(true);
  });

  it("sets only GRAVEYARD_URL in env, with no secret-like keys or values", () => {
    const env = config.mcpServers.graveyard.env ?? {};
    expect(Object.keys(env)).toEqual(["GRAVEYARD_URL"]);
    const secretLike = /token|secret|key|password|passwd|auth|bearer|cookie|credential/i;
    const tokenShapes = /(ghp_|gho_|github_pat_|sk-|AIza|xox[abp]-)/;
    for (const [k, v] of Object.entries(env)) {
      expect(k).not.toMatch(secretLike);
      expect(v).not.toMatch(secretLike);
      expect(v).not.toMatch(tokenShapes);
    }
    expect(JSON.stringify(config)).not.toMatch(tokenShapes);
  });
});

describe("README section", () => {
  const readme = read("README.md");

  it("has the section title", () => {
    expect(readme).toContain("Use the graveyard from Kiro");
  });

  it("states the build and start commands", () => {
    expect(readme).toContain("npm run mcp:install");
    expect(readme).toContain("npm run mcp:build");
    expect(readme).toContain("npm run dev");
  });

  it("documents GRAVEYARD_URL and its default", () => {
    expect(readme).toContain("GRAVEYARD_URL");
    expect(readme).toContain("http://localhost:3000");
  });

  it("names the four tools", () => {
    for (const tool of [
      "list_graveyard",
      "get_grave",
      "hold_seance",
      "get_revival_brief",
    ]) {
      expect(readme).toContain(tool);
    }
  });
});

describe("docs/KIRO_JOURNEY.md", () => {
  const journey = read("docs/KIRO_JOURNEY.md");
  const start = journey.indexOf("graveyard-mcp: a tool we built for Kiro");

  it("has a graveyard-mcp entry", () => {
    expect(start).toBeGreaterThanOrEqual(0);
  });

  it("covers the spec, isolation and untrusted-text handling", () => {
    const entry = journey.slice(start);
    expect(entry).toMatch(/spec/i);
    expect(entry).toMatch(/### Isolation and no secrets/);
    expect(entry).toMatch(/### Untrusted text/);
  });
});
