/**
 * Effects_Table sync (Req 15.6, 18.8, 18.9): registry ids == docs table rows ==
 * ids used in components via `effectProps("id")` or `data-effect="id"`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MAX_AMBIENT_PER_PLACE, WORLD_EFFECTS } from "@/lib/world-effects";

const ROOT = process.cwd();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

function sourceIds(): Set<string> {
  const ids = new Set<string>();
  const re = /effectProps\(\s*(?:[^"'`()]*\?\s*)?["'`]([a-z0-9-]+)["'`](?:\s*:\s*["'`]([a-z0-9-]+)["'`])?|data-effect=\s*["'`]([a-z0-9-]+)["'`]/g;
  for (const file of walk(join(ROOT, "components"))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(re)) {
      for (const id of [m[1], m[2], m[3]]) if (id) ids.add(id);
    }
  }
  return ids;
}

function tableIds(): Set<string> {
  const md = readFileSync(join(ROOT, "docs", "EFFECTS_TABLE.md"), "utf8");
  const ids = new Set<string>();
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*`([a-z0-9-]+)`\s*\|/.exec(line);
    if (m) ids.add(m[1]);
  }
  return ids;
}

describe("Effects_Table sync", () => {
  const registry = new Set(WORLD_EFFECTS.map((e) => e.id));

  it("registry ids equal the rows of docs/EFFECTS_TABLE.md", () => {
    const table = tableIds();
    expect([...registry].filter((id) => !table.has(id))).toEqual([]);
    expect([...table].filter((id) => !registry.has(id))).toEqual([]);
  });

  it("registry ids equal the ids used in components/", () => {
    const used = sourceIds();
    expect([...registry].filter((id) => !used.has(id))).toEqual([]);
    expect([...used].filter((id) => !registry.has(id))).toEqual([]);
  });

  it("has at most 4 ambient effects per place", () => {
    for (const place of ["sky", "ground", "crypt"] as const) {
      const n = WORLD_EFFECTS.filter((e) => e.ambient && e.places.includes(place)).length;
      expect(n).toBeLessThanOrEqual(MAX_AMBIENT_PER_PLACE);
    }
  });
});
