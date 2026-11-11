// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import * as scan from "../../scripts/secret-scan.mjs";

// Fake keys are built at runtime so this file never holds a complete token.
const FAKE_ANTHROPIC = "sk-" + "ant-" + "api03-" + "A".repeat(40);
const FAKE_GH = "gh" + "p_" + "B".repeat(36);
const FAKE_PAT = "github" + "_pat_" + "C".repeat(40);
const FAKE_UPSTASH = "A" + "b".repeat(48) + "==";
const UPSTASH_LINE = `UPSTASH_REDIS_REST_TOKEN=${FAKE_UPSTASH}`;

const SCRIPT = path.resolve(__dirname, "../../scripts/secret-scan.mjs");
const hasGit = spawnSync("git", ["--version"]).status === 0;

describe("secret scanner", () => {
  it.each([
    [FAKE_ANTHROPIC, "sk-ant-"],
    [FAKE_GH, "ghp_"],
    [FAKE_PAT, "github_pat_"],
    [UPSTASH_LINE, "UPSTASH_REDIS_REST_TOKEN"],
  ])("detects a fake secret (%#) on the right line", (secret, name) => {
    const line = secret === UPSTASH_LINE ? secret : `const k = "${secret}";`;
    const text = `first line\nsecond line\n${line}\n`;
    const found = scan.scanText(text, "f.ts");
    expect(found).toEqual([{ file: "f.ts", line: 3, pattern: name }]);
  });

  it("ignores placeholders, bare prefixes and short values", () => {
    const text = [
      "UPSTASH_REDIS_REST_TOKEN=",
      "UPSTASH_REDIS_REST_TOKEN=your-upstash-token-here",
      'UPSTASH_REDIS_REST_TOKEN="<token>"',
      "keys start with sk-ant-",
      "ghp_ and github_pat_ tokens",
      "sk-ant-abc",
    ].join("\n");
    expect(scan.scanText(text, "doc.md")).toEqual([]);
  });

  it("skips .env.example and vendored paths", () => {
    const findings = scan.scanFiles([
      { path: ".env.example", content: `KEY=${FAKE_ANTHROPIC}` },
      { path: "docs/x.md", content: "UPSTASH_REDIS_REST_TOKEN=your-token-here" },
    ]);
    expect(findings).toEqual([]);
    expect(scan.shouldSkip(".env.example")).toBe(true);
    expect(scan.shouldSkip("a/.env.example")).toBe(true);
    expect(scan.shouldSkip("node_modules/x/y.js")).toBe(true);
    expect(scan.shouldSkip("lib/x.ts")).toBe(false);
  });

  it("skips binary files but scans normal buffers", () => {
    const text = `k=${FAKE_ANTHROPIC}`;
    const bin = Buffer.concat([Buffer.from([0]), Buffer.from(text)]);
    const plain = Buffer.from(text);
    expect(scan.isBinary(bin)).toBe(true);
    expect(scan.isBinary(plain)).toBe(false);
    expect(scan.scanFiles([{ path: "b.bin", content: bin }])).toEqual([]);
    expect(scan.scanFiles([{ path: "b.txt", content: plain }])).toHaveLength(1);
  });

  it("never outputs the key text or the rest of the line", () => {
    const content = `const k = "${FAKE_ANTHROPIC}"; // trailing words REST_OF_LINE_MARKER`;
    const findings = scan.scanFiles([{ path: "src/a.ts", content }]);
    const out = findings.map(scan.formatFinding).join("\n");
    expect(out).toBe("src/a.ts:1: sk-ant-");
    expect(out).not.toContain(FAKE_ANTHROPIC);
    expect(out).not.toContain("REST_OF_LINE_MARKER");
    const body = FAKE_ANTHROPIC.slice("sk-ant-".length);
    for (let i = 0; i + 8 <= body.length; i++) {
      expect(out).not.toContain(body.slice(i, i + 8));
    }
    for (const f of findings) {
      expect(Object.keys(f).sort()).toEqual(["file", "line", "pattern"]);
    }
  });
});

describe("secret scanner CLI", { timeout: 20000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-"));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  const run = () =>
    spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });

  it.skipIf(!hasGit)("reports clean for a harmless repo", () => {
    git("init", "-q");
    fs.writeFileSync(path.join(dir, "ok.txt"), "nothing to see\n");
    git("add", "ok.txt");
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("secret-scan: clean");
  });

  it.skipIf(!hasGit)("fails on a staged leak without printing it", () => {
    fs.writeFileSync(path.join(dir, "leak.txt"), `x\n${FAKE_ANTHROPIC}\n`);
    git("add", "leak.txt");
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("leak.txt:2: sk-ant-");
    expect(r.stdout).not.toContain(FAKE_ANTHROPIC);
    expect(r.stdout).not.toContain("A".repeat(10));
  });

  it.skipIf(!hasGit)("fails when .env.local is tracked", () => {
    fs.writeFileSync(path.join(dir, ".env.local"), "hello");
    git("add", "-f", ".env.local");
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(".env.local");
    expect(r.stdout).toContain("tracked by git");
    expect(r.stdout).not.toContain("hello");
  });
});
