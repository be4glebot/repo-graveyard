// Feature: revive-in-kiro, Property 7: The prompt is grounded and carries no foreign model text
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildKiroPrompt,
  DATA_NOTICE,
  sanitiseInline,
  slugify,
} from "@/lib/revive-brief";

import {
  facts,
  hostileResult,
  markersFor,
  validSeanceResult,
  withMarkers,
} from "./revive-arbitraries";

const PREFIX = "P7";

describe("Property 7: The prompt is grounded and carries no foreign model text", () => {
  /**
   * **Validates: Requirements 5.7, 5.8, 5.10, 6.8**
   */
  it("is grounded in REVIVAL.md and the First step, and carries no other model text", () => {
    fc.assert(
      fc.property(fc.oneof(validSeanceResult, hostileResult), facts, (base, f) => {
        const result = withMarkers(base, PREFIX);
        const m = markersFor(result, PREFIX);
        const prompt = buildKiroPrompt(result, f);

        // Begins with the read-first instruction, including the stop-and-ask fallback.
        expect(prompt.startsWith("Read REVIVAL.md in the repository root first.")).toBe(true);
        expect(prompt.split("\n")[0]).toContain("stop and ask me");

        // Names the spec and asks for EARS requirements, design and tasks.
        expect(prompt).toContain(`revive-${slugify(f.repo)}`);
        expect(prompt).toContain("EARS");
        expect(prompt).toContain("design");
        expect(prompt).toContain("tasks");

        // Data_Notice present, sanitised First step present.
        expect(prompt).toContain(DATA_NOTICE);
        expect(prompt).toContain(`First step: ${sanitiseInline(result.verdictReason)}`);
        expect(prompt).toContain(m.reason);

        // No foreign model text.
        expect(prompt).not.toContain(m.voice);
        expect(prompt).not.toContain(m.cause);
        for (const item of m.items) {
          expect(prompt).not.toContain(item.title);
          expect(prompt).not.toContain(item.detail);
          expect(prompt).not.toContain(item.evidence);
        }
      }),
      { numRuns: 100 },
    );
  });
});
