/**
 * Unit tests for the pre-written séance fixtures in data/estate.json (task 10.2).
 *
 * Requirements: 2.3, 2.4, 2.5, 2.6
 */

import { describe, expect, it } from "vitest";
import estateJson from "@/data/estate.json";
import { estateSchema } from "@/lib/estate-schema";
import { resolveEstate } from "@/lib/estate";
import { classify } from "@/lib/lifecycle";
import { deriveEvidence } from "@/lib/seance";
import { containsDateOrDayCount, seanceResultSchema, VERDICTS } from "@/lib/seance-schema";

const NOW = "2026-06-15T12:00:00.000Z";

const fixture = estateSchema.parse(estateJson);
const resolved = resolveEstate(fixture, NOW);

describe("estate séance fixtures", () => {
  it("gives every estate repo exactly one seanceResult that passes the schema", () => {
    expect(fixture.repos.length).toBeGreaterThan(0);
    for (const repo of fixture.repos) {
      expect(repo.seanceResult, repo.name).toBeDefined();
      expect(seanceResultSchema.safeParse(repo.seanceResult).success, repo.name).toBe(true);
    }
    const names = fixture.repos.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers all three verdicts and all five creature types", () => {
    const verdicts = new Set<string>();
    const states = new Set<string>();
    fixture.repos.forEach((repo, i) => {
      verdicts.add(seanceResultSchema.parse(repo.seanceResult).verdict);
      const facts = resolved.repos[i];
      states.add(classify(facts, resolved.overrides[facts.name], NOW).state);
    });
    expect([...verdicts].sort()).toEqual([...VERDICTS].sort());
    expect([...states].sort()).toEqual(["coffin", "ghost", "risen", "tombstone", "zombie"]);
  });

  it("uses derived Fact_Line text as every item's evidence", () => {
    fixture.repos.forEach((repo, i) => {
      const facts = resolved.repos[i];
      const derived = deriveEvidence({ facts, readme: null, commits: [] });
      const texts = derived.factLines.map((f) => f.text);
      const result = seanceResultSchema.parse(repo.seanceResult);
      for (const item of result.unfinishedBusiness) {
        expect(texts, `${repo.name}: ${item.evidence}`).toContain(item.evidence);
      }
    });
  });

  it("has no dated prose and no real-world identifiers", () => {
    for (const repo of fixture.repos) {
      const r = seanceResultSchema.parse(repo.seanceResult);
      const prose = [
        r.voice,
        r.causeOfDeath,
        r.verdictReason,
        ...r.unfinishedBusiness.flatMap((b) => [b.title, b.detail]),
      ];
      for (const text of prose) {
        expect(containsDateOrDayCount(text), `${repo.name}: ${text}`).toBe(false);
        expect(text).not.toMatch(/@|https?:\/\/|www\./i);
      }
    }
  });
});
