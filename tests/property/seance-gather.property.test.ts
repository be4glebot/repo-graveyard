import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { GraphqlTransport } from "@/lib/github";
import {
  README_ALIASES,
  SEANCE_EVIDENCE_QUERY,
  fetchEvidence,
} from "@/lib/seance-gather";

const EXPRESSIONS = [
  "HEAD:README.md",
  "HEAD:readme.md",
  "HEAD:README",
  "HEAD:README.rst",
] as const;

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// Feature: the-seance, Property 26: README alias selection
describe("Property 26: README alias selection", () => {
  // Per alias: absent (null) or present text (possibly empty), well under 8 KB.
  const slot = fc.option(fc.string({ maxLength: 200 }), { nil: null });

  it("uses the first present alias in order and none when all are absent", async () => {
    // **Validates: Requirements 3.4, 3.6, 20.29**
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(slot, slot, slot, slot),
        async (slots) => {
          const queries: string[] = [];
          const transport: GraphqlTransport = (async (query: string) => {
            queries.push(query);
            const repository: Record<string, unknown> = {
              defaultBranchRef: null,
            };
            README_ALIASES.forEach((alias, i) => {
              const text = slots[i];
              repository[alias] = text === null ? null : { text };
            });
            return { data: { repository } };
          }) as GraphqlTransport;

          const result = await fetchEvidence(transport, "o", "r");

          const firstPresent = slots.find((s) => s !== null);
          expect(result).not.toBeNull();
          expect(result?.readme).toBe(firstPresent ?? null);

          // One call, read-only, every alias exactly once.
          expect(queries).toHaveLength(1);
          const q = queries[0];
          expect(q).toBe(SEANCE_EVIDENCE_QUERY);
          expect(q).not.toMatch(/mutation/i);
          for (const expr of EXPRESSIONS) {
            expect(count(q, `"${expr}"`)).toBe(1);
          }
          for (const alias of README_ALIASES) {
            expect(count(q, `${alias}:`)).toBe(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
