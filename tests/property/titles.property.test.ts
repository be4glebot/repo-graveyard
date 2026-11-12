import { describe, it } from "vitest";
import fc from "fast-check";
import { resolveTitle } from "@/lib/site-meta";

const BRAND = "Repo Graveyard";
const TEMPLATE = `%s · ${BRAND}`;

const username = fc.stringMatching(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/);

function countBrand(s: string): number {
  return s.split(BRAND).length - 1;
}

describe("Feature: polish-pass-2e, Property 1: Brand appears once in every resolved title", () => {
  it("**Validates: Requirements 2.1, 2.2, 2.3** resolves each page title with the brand exactly once", () => {
    fc.assert(
      fc.property(username, (user) => {
        const titles = [
          // root default: own default, no template
          resolveTitle({ default: BRAND, template: TEMPLATE }, null),
          // /estate
          resolveTitle({ absolute: `${BRAND} — Sample Estate` }, TEMPLATE),
          // /g/[username]
          resolveTitle({ absolute: `${BRAND} — ${user}` }, TEMPLATE),
          // /g/[username]/[repo] (title stays keyed to the owner)
          resolveTitle({ absolute: `${BRAND} — ${user}` }, TEMPLATE),
        ];
        return titles.every((t) => countBrand(t) === 1);
      }),
      { numRuns: 100 },
    );
  });
});
