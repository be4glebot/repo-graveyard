import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Validates: Requirements 8.2, 19.7
// Only reads .env.example. Never touches .env.local.
const path = join(process.cwd(), ".env.example");

function parse(): Map<string, string> {
  const map = new Map<string, string>();
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    map.set(line.slice(0, i), line.slice(i + 1));
  }
  return map;
}

describe(".env.example", () => {
  it("exists", () => {
    expect(existsSync(path)).toBe(true);
  });

  it("has exactly the expected lines", () => {
    const lines = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    expect(lines).toEqual([
      "LLM_PROVIDER=anthropic",
      "LLM_MODEL=claude-haiku-5-5",
      "LLM_API_KEY=",
      "LLM_DAILY_LIMIT=150",
      "NEXT_PUBLIC_SITE_URL=https://your-deployment.example.com",
    ]);
  });

  it("leaves LLM_API_KEY empty", () => {
    expect(parse().get("LLM_API_KEY")).toBe("");
  });

  it("contains no value that looks like a secret", () => {
    const text = readFileSync(path, "utf8");
    expect(text).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
    expect(text).not.toMatch(/gh[pousr]_[A-Za-z0-9]{20,}/);
    expect(text).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    for (const [key, value] of parse()) {
      if (key === "LLM_API_KEY") continue;
      expect(value).not.toMatch(/^[A-Za-z0-9+/_-]{32,}$/);
    }
  });
});
