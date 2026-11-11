// secret-scan: guards against committing API keys and tokens.
// Scans git-tracked and staged files for Anthropic keys, GitHub tokens and
// Upstash REST tokens, and fails if `.env.local` is tracked by git.
// It never reads `.env.local` and never prints a matched value: findings are
// reported only as `file:line: <pattern name>`.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const MAX_BYTES = 2 * 1024 * 1024;
const PLACEHOLDER_WORDS =
  /(your|example|placeholder|changeme|replace|dummy|fake|xxx|token_here|todo)/i;

function isUpstashHit(line) {
  const m = /UPSTASH_REDIS_REST_TOKEN\s*=\s*(.*)$/.exec(line);
  if (!m) return false;
  let value = m[1].trim();
  const quoted = /^(["'])(.*?)\1/.exec(value);
  if (quoted) {
    value = quoted[2];
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }
  if (value.length < 20) return false;
  if (/[^A-Za-z0-9+/=_.-]/.test(value)) return false;
  if (/^(<|\$|%|\{|\.\.\.)/.test(value)) return false;
  if (PLACEHOLDER_WORDS.test(value)) return false;
  return true;
}

export const PATTERNS = [
  { name: "sk-ant-", test: (line) => /sk-ant-[A-Za-z0-9_-]{16,}/.test(line) },
  { name: "ghp_", test: (line) => /\bghp_[A-Za-z0-9]{20,}/.test(line) },
  {
    name: "github_pat_",
    test: (line) => /github_pat_[A-Za-z0-9_]{20,}/.test(line),
  },
  { name: "UPSTASH_REDIS_REST_TOKEN", test: isUpstashHit },
];

export function scanText(text, file) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((content, i) => {
    for (const p of PATTERNS) {
      if (p.test(content)) {
        findings.push({ file, line: i + 1, pattern: p.name });
      }
    }
  });
  return findings;
}

export function isBinary(buffer) {
  const end = Math.min(buffer.length, 8000);
  for (let i = 0; i < end; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export function shouldSkip(file) {
  const f = file.replace(/\\/g, "/");
  const base = f.split("/").pop();
  if (base === ".env.example" || base === "package-lock.json") return true;
  return /(^|\/)(node_modules|\.next|\.git)\//.test(f);
}

export function formatFinding({ file, line, pattern }) {
  return `${file}:${line}: ${pattern}`;
}

export function scanFiles(files) {
  const findings = [];
  for (const { path: file, content } of files) {
    if (shouldSkip(file)) continue;
    if (typeof content !== "string" && isBinary(content)) continue;
    const text = typeof content === "string" ? content : content.toString("utf8");
    findings.push(...scanText(text, file));
  }
  return findings;
}

function gitList(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).split("\0");
}

export function listFiles(cwd) {
  const tracked = gitList(["ls-files", "-z"], cwd);
  const staged = gitList(["diff", "--cached", "--name-only", "-z"], cwd);
  return [...new Set([...tracked, ...staged])].filter((f) => f.length > 0);
}

export function isEnvLocalTracked(cwd) {
  const out = execFileSync("git", ["ls-files", ".env.local"], {
    cwd,
    encoding: "utf8",
  });
  return out.trim().length > 0;
}

export function main(cwd = process.cwd()) {
  const lines = [];
  let files;
  try {
    if (isEnvLocalTracked(cwd)) {
      lines.push(".env.local: tracked by git (remove it with git rm --cached)");
    }
    files = listFiles(cwd);
  } catch {
    return {
      code: 1,
      lines: ["secret-scan: could not list files (is git available?)"],
    };
  }

  const inputs = [];
  for (const file of files) {
    if (shouldSkip(file)) continue;
    try {
      const full = path.join(cwd, file);
      if (statSync(full).size > MAX_BYTES) continue;
      inputs.push({ path: file, content: readFileSync(full) });
    } catch {
      // missing or unreadable: skip silently
    }
  }
  for (const finding of scanFiles(inputs)) lines.push(formatFinding(finding));

  if (lines.length === 0) return { code: 0, lines: ["secret-scan: clean"] };
  return { code: 1, lines };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { code, lines } = main();
  for (const l of lines) console.log(l);
  process.exitCode = code;
}
