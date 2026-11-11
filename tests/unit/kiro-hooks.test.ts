// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Hook = {
  name: string;
  trigger: string;
  matcher: string;
  action: { type: string; command: string };
  timeout: number;
  enabled: boolean;
};

function load(file: string): { version: string; hooks: Hook[] } {
  const raw = fs.readFileSync(path.join(process.cwd(), ".kiro/hooks", file), "utf8");
  return JSON.parse(raw);
}

const cases = [
  {
    file: "secret-guard.json",
    command: "node scripts/secret-scan.mjs",
    matches: [
      "lib/a.ts",
      "app/page.tsx",
      "README.md",
      "docs/KIRO_JOURNEY.md",
      ".env.example",
      "C:\\Users\\me\\proj\\lib\\a.ts",
      "tests/unit/a.test.ts",
    ],
    misses: [
      "node_modules/pkg/index.js",
      ".next/server/app.js",
      "C:\\proj\\node_modules\\x\\y.js",
      ".env.local",
      "sub/.env.local",
      "C:\\proj\\.env.local",
    ],
  },
  {
    file: "test-changed-files.json",
    command: "npx vitest run --changed --reporter=dot",
    matches: [
      "lib/a.ts",
      "lib/deep/er/a.ts",
      "components/seance/Ritual.tsx",
      "app/api/seance/route.ts",
      "C:\\proj\\lib\\a.ts",
    ],
    misses: [
      "tests/unit/a.test.ts",
      "components/a.ts",
      "lib/a.tsx",
      "app/page.tsx",
      "docs/a.md",
      "node_modules/lib/a.ts",
      "package.json",
    ],
  },
];

describe.each(cases)("$file", ({ file, command, matches, misses }) => {
  const config = load(file);
  const hook = config.hooks[0];

  it("has the expected shape", () => {
    expect(config.version).toBe("v1");
    expect(config.hooks).toHaveLength(1);
    expect(hook.trigger).toBe("PostFileSave");
    expect(hook.action.type).toBe("command");
    expect(hook.action.command).toBe(command);
    // `enabled` is the user's personal toggle, so it is intentionally not asserted.
    expect(typeof hook.timeout).toBe("number");
    expect(hook.timeout).toBeGreaterThan(0);
    expect(() => new RegExp(hook.matcher)).not.toThrow();
  });

  it.each(matches)("matches %s", (p) => {
    expect(new RegExp(hook.matcher).test(p)).toBe(true);
  });

  it.each(misses)("does not match %s", (p) => {
    expect(new RegExp(hook.matcher).test(p)).toBe(false);
  });
});

describe("existing hooks", () => {
  it("run-tests-after-each-task.json still parses", () => {
    expect(() => load("run-tests-after-each-task.json")).not.toThrow();
  });
});
