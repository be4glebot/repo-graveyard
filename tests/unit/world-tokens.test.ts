import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORLD_CONFIG } from "@/lib/world-layout";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function px(name: string): number {
  const m = new RegExp(`${name}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`).exec(css);
  if (!m) throw new Error(`token ${name} missing`);
  return Number(m[1]);
}
function num(name: string): number {
  const m = new RegExp(`${name}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\s*;`).exec(css);
  if (!m) throw new Error(`token ${name} missing`);
  return Number(m[1]);
}

describe("world tokens", () => {
  it("pad tokens equal WORLD_CONFIG (top = TOP_CLEAR + 8, bottom = BOTTOM_CLEAR)", () => {
    expect(px("--world-pad-top")).toBe(WORLD_CONFIG.desktop.TOP_CLEAR + 8);
    expect(px("--world-pad-bottom")).toBe(WORLD_CONFIG.desktop.BOTTOM_CLEAR);
    expect(px("--world-pad-top-compact")).toBe(WORLD_CONFIG.compact.TOP_CLEAR + 8);
    expect(px("--world-pad-bottom-compact")).toBe(WORLD_CONFIG.compact.BOTTOM_CLEAR);
  });

  it("mist tokens match the design and stay within the caps", () => {
    expect(num("--world-mist-sky")).toBe(0.18);
    expect(num("--world-mist-ground")).toBe(0.2);
    expect(num("--world-mist-crypt")).toBe(0.15);
    expect(num("--world-mist-sky")).toBeLessThanOrEqual(0.25);
    expect(num("--world-mist-ground")).toBeLessThanOrEqual(0.25);
    expect(num("--world-mist-crypt")).toBeLessThanOrEqual(0.2);
  });

  it("declares the ambient floor, light tokens and shared classes", () => {
    expect(num("--world-ambient-floor")).toBeGreaterThanOrEqual(0.8);
    for (const p of ["sky", "ground", "crypt"]) {
      for (const k of ["sx", "sy", "rim"]) expect(css).toContain(`--light-${p}-${k}:`);
    }
    for (const c of [
      ".fixture-rail", ".fixture-ledge", ".fixture-sign", ".fixture-marker",
      ".camera-drift", ".env-mist", ".env-mist-near", ".place-cue-sky",
      ".place-cue-gate", ".place-cue-crypt", ".world-band-bg",
    ]) {
      expect(css).toContain(c);
    }
    expect(css).toContain("--world-reveal-ms");
    expect(css).toContain("--world-creature-scroll-margin");
  });

  it("no hex colours in world component code yet", () => {
    const dir = join(process.cwd(), "components", "world");
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => /\.(tsx?|css)$/.test(f) && statSync(join(dir, f)).isFile());
    } catch {
      files = [];
    }
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-zA-Z-])/);
    }
  });
});
