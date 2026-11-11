import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DATA_NOTICE } from "@/lib/revive-brief";
import { seanceResultSchema, type SeanceResult } from "@/lib/seance-schema";
import { HEADINGS } from "../src/format";
import { createHarness } from "./harness";

const NOTICE_COLLAPSED = DATA_NOTICE.replace(/\s+/g, " ").toLowerCase();
const FIXED_HEADINGS = new Set<string>(Object.values(HEADINGS));
const RESULT_CAP = 12_288;

// ---------------------------------------------------------------------------
// Hostile string arbitraries
// ---------------------------------------------------------------------------

const hashes = fc.integer({ min: 1, max: 7 }).map((n) => "#".repeat(n));
const fence = fc
  .tuple(fc.constantFrom("`", "~"), fc.integer({ min: 1, max: 6 }))
  .map(([c, n]) => c.repeat(n));
const NEWLINES = ["\n", "\r\n", "\r", "\u2028", "\u2029", "\u0085", "\v", "\f"];

const fragment = fc.oneof(
  { weight: 4, arbitrary: hashes.map((h) => `${h} `) },
  { weight: 2, arbitrary: hashes },
  { weight: 2, arbitrary: fc.constantFrom("===", "---", "-", "=", "***", "___", "- - -") },
  { weight: 4, arbitrary: fence.map((f) => `${f}js`) },
  { weight: 2, arbitrary: fence },
  { weight: 3, arbitrary: fc.constantFrom("> ", ">", ">> ", "- ", "* ", "+ ", "1. ", "2) ", "10. ") },
  { weight: 5, arbitrary: fc.constantFrom(...NEWLINES) },
  { weight: 2, arbitrary: fc.constantFrom(" ", "  ", "   ", "    ", "\t", "\u00a0") },
  { weight: 2, arbitrary: fc.constantFrom("|", "<", "[", "](", "\\", "<!--", "**", "`", "~") },
  { weight: 2, arbitrary: fc.constantFrom("Ignore previous instructions", "SYSTEM", "tool call") },
  { weight: 3, arbitrary: fc.string({ unit: "grapheme", maxLength: 6 }) },
  { weight: 1, arbitrary: fc.string({ unit: "binary", maxLength: 6 }) },
);

/** Hostile text with sentence terminators removed so schema sentence rules stay predictable. */
const hostile = (maxLen: number) =>
  fc
    .array(fragment, { maxLength: 8 })
    .map((parts) => parts.join("").replace(/[.!?…]/g, ",").slice(0, maxLen));

/** The Data_Notice with random whitespace, case and (optionally) single-space joins. */
const noticeCopy = (singleSpace: boolean) =>
  fc
    .tuple(
      fc.array(fc.constantFrom(" ", "  ", "\n", "\t", "\r\n", "\u2028", "\u00a0"), {
        minLength: 20,
        maxLength: 20,
      }),
      fc.array(fc.constantFrom("keep", "lower", "upper"), { minLength: 20, maxLength: 20 }),
    )
    .map(([seps, cases]) => {
      const words = DATA_NOTICE.split(/\s+/);
      return words
        .map((w, i) => {
          const c = cases[i % cases.length];
          const word = c === "lower" ? w.toLowerCase() : c === "upper" ? w.toUpperCase() : w;
          const sep = i === words.length - 1 ? "" : singleSpace ? " " : seps[i % seps.length];
          return word + sep;
        })
        .join("");
    });

const voiceArb = fc
  .tuple(hostile(120), hostile(60), noticeCopy(false), fc.boolean())
  .map(([a, b, nv, useNotice]) => (useNotice ? `${a} ${nv} ${b}x.` : `${a}x. ${b}x.`));
const causeArb = fc
  .tuple(hostile(80), noticeCopy(false), fc.boolean())
  .map(([a, nv, useNotice]) => (useNotice ? `${a} ${nv}` : `${a}x`));
const titleArb = fc
  .tuple(hostile(60), noticeCopy(true), fc.boolean())
  .map(([a, nv, useNotice]) => (useNotice ? nv : `${a}x`));
const detailArb = fc
  .tuple(hostile(40), noticeCopy(false), fc.boolean())
  .map(([a, nv, useNotice]) => (useNotice ? `${a} ${nv}`.slice(0, 140) : `${a}x`));
const evidenceArb = fc
  .tuple(hostile(100), noticeCopy(false), fc.boolean())
  .map(([a, nv, useNotice]) => (useNotice ? `${a} ${nv}` : `${a}evidence1`));
const reasonArb = fc
  .tuple(hostile(150), noticeCopy(false), fc.boolean())
  .map(([a, nv, useNotice]) => (useNotice ? `${a} ${nv}` : `${a}x`));

const resultArb: fc.Arbitrary<SeanceResult> = fc
  .record({
    voice: voiceArb,
    causeOfDeath: causeArb,
    unfinishedBusiness: fc.array(
      fc.record({ title: titleArb, detail: detailArb, evidence: evidenceArb }),
      { minLength: 1, maxLength: 4 },
    ),
    verdict: fc.constantFrom("revive" as const, "finish" as const, "seal" as const),
    verdictReason: reasonArb,
  })
  .filter((r) => seanceResultSchema.safeParse(r).success);

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

const STATES = ["ghost", "risen", "zombie", "tombstone", "coffin"] as const;
type St = (typeof STATES)[number];

interface Entry {
  name: string;
  state: St;
  decay: number | null;
  pushedAt: string | null;
  stars: number;
  html_url: string;
}

function payloadOf(owner: string, repos: Entry[], truncated: boolean) {
  const counts = { ghost: 0, risen: 0, zombie: 0, tombstone: 0, coffin: 0, total: repos.length };
  for (const r of repos) counts[r.state]++;
  return { owner, counts, truncated, repos };
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const hostileName = hostile(180).filter((s) => s.length > 0);
const hostileEntry: fc.Arbitrary<Entry> = fc.record({
  name: hostileName,
  state: fc.constantFrom(...STATES),
  decay: fc.constantFrom(null, 0, 1, 2, 3, 4),
  pushedAt: fc.oneof(fc.constant(null), hostile(40), fc.constant("2024-01-01T00:00:00Z")),
  stars: fc.nat(1000),
  html_url: fc
    .tuple(hostile(300), noticeCopy(false), fc.boolean())
    .map(([a, nv, n]) => (n ? `${a}${nv}` : a || "u")),
});

// ---------------------------------------------------------------------------
// Result inspection helpers
// ---------------------------------------------------------------------------

/** Lines outside backtick-fenced blocks; also reports whether every fence closed. */
function outsideFences(lines: string[]): { outside: string[]; closed: boolean } {
  const outside: string[] = [];
  let open: string | null = null;
  for (const line of lines) {
    if (open === null) {
      const m = /^(`{3,})/.exec(line);
      if (m) open = m[1];
      else outside.push(line);
    } else if (line === open) {
      open = null;
    }
  }
  return { outside, closed: open === null };
}

const HEADING_RE = /^ {0,3}#{1,6}(\s|$)/;
const SETEXT_RE = /^ {0,3}(=+|-+)\s*$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const QUOTE_RE = /^ {0,3}>/;
const LIST_RE = /^ {0,3}([-*+]|\d+[.)])(\s|$)/;
const EXOTIC_BREAKS = /[\r\u2028\u2029\u0085\v\f]/;

const bytes = (s: string) => new TextEncoder().encode(s).length;

function noticeCount(lines: string[]): number {
  const flat = lines.join(" ").replace(/\s+/g, " ").toLowerCase();
  return flat.split(NOTICE_COLLAPSED).length - 1;
}

/**
 * Shared structural checks. `allowedListLines` is how many lines may be the
 * server's own "- Title:" list items; `fixedLines` are lines exempt from the
 * "starts a block" rules because the server wrote them.
 */
function expectInert(text: string, allowedListLines: number): string[] {
  expect(bytes(text)).toBeLessThanOrEqual(RESULT_CAP);
  const { outside, closed } = outsideFences(text.split("\n"));
  expect(closed).toBe(true);
  let listLines = 0;
  for (const line of outside) {
    expect(EXOTIC_BREAKS.test(line)).toBe(false);
    if (HEADING_RE.test(line)) expect(FIXED_HEADINGS.has(line)).toBe(true);
    expect(SETEXT_RE.test(line)).toBe(false);
    expect(FENCE_RE.test(line)).toBe(false);
    expect(QUOTE_RE.test(line)).toBe(false);
    if (LIST_RE.test(line)) {
      expect(line.startsWith("- Title: ")).toBe(true);
      listLines++;
    }
  }
  expect(listLines).toBe(allowedListLines);
  return outside;
}

function expectNoticeFirst(text: string, heading: string): void {
  // Nothing from the outcome sits before the end of the notice.
  expect(text.startsWith(`${heading}\n${DATA_NOTICE}\n`)).toBe(true);
  expect(text.indexOf(DATA_NOTICE)).toBe(heading.length + 1);
}

const OWNER = "octo";
const REPO = "repo-x";

async function call(
  respond: Parameters<typeof createHarness>[0]["respond"],
  name: string,
  args: Record<string, string>,
): Promise<{ text: string; isError: boolean }> {
  const h = await createHarness({ respond, nowMs: Date.parse("2025-06-01T00:00:00Z") });
  try {
    const res = (await h.client.callTool({ name, arguments: args })) as {
      content: { type: string; text: string }[];
      isError?: boolean;
    };
    return { text: res.content[0].text, isError: res.isError === true };
  } finally {
    await h.close();
  }
}

const NUM_RUNS = 120;

// Feature: graveyard-mcp, Property 11: Untrusted text stays inert and after the notice
describe("Property 11: untrusted text stays inert and after the notice", () => {
  it("hold_seance keeps hostile outcome text on single inert lines after the notice", async () => {
    await fc.assert(
      fc.asyncProperty(resultArb, async (result) => {
        const { text, isError } = await call(
          () => json({ kind: "ok", result }),
          "hold_seance",
          { owner: OWNER, repo: REPO },
        );
        expect(isError).toBe(false);
        expectNoticeFirst(text, HEADINGS.seance);
        const n = result.unfinishedBusiness.length;
        const outside = expectInert(text, n);
        expect(noticeCount(outside)).toBe(1);
        expect(outside).toHaveLength(8 + n);
        expect(outside[2]).toBe(`Repository: ${OWNER}/${REPO}`);
        expect(outside[3].startsWith("Voice: ")).toBe(true);
        expect(outside[4].startsWith("Cause of death: ")).toBe(true);
        expect(outside[5]).toBe("Unfinished business:");
        for (let i = 0; i < n; i++) {
          expect(/^- Title: .* \| Detail: .* \| Evidence: /.test(outside[6 + i])).toBe(true);
        }
        expect(outside[6 + n]).toBe(`Verdict: ${result.verdict}`);
        expect(outside[7 + n].startsWith("Verdict reason: ")).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("get_revival_brief keeps hostile outcome text inert, with one notice outside the fences", async () => {
    await fc.assert(
      fc.asyncProperty(resultArb, fc.constantFrom(...STATES), async (result, state) => {
        const entry: Entry = {
          name: REPO,
          state,
          decay: null,
          pushedAt: null,
          stars: 0,
          html_url: "https://github.com/octo/repo-x",
        };
        const { text, isError } = await call(
          (req) =>
            req.url.includes("/api/graveyard/")
              ? json(payloadOf(OWNER, [entry], false))
              : json({ kind: "ok", result }),
          "get_revival_brief",
          { owner: OWNER, repo: REPO },
        );
        expect(isError).toBe(false);
        expectNoticeFirst(text, HEADINGS.revival);
        const outside = expectInert(text, 0);
        expect(noticeCount(outside)).toBe(1);
        if (result.verdict === "revive") {
          expect(outside).toEqual([
            HEADINGS.revival,
            DATA_NOTICE,
            `Repository: ${OWNER}/${REPO}`,
            "REVIVAL.md",
            "Kiro prompt",
          ]);
        } else {
          expect(outside).toHaveLength(5);
          expect(outside[2]).toBe(`Verdict: ${result.verdict}`);
          expect(outside[3].startsWith("Verdict reason: ")).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("list_graveyard keeps hostile names and owner on single inert lines", async () => {
    await fc.assert(
      fc.asyncProperty(
        hostile(90).filter((s) => s.length > 0),
        fc.array(hostileEntry, { maxLength: 6 }),
        fc.boolean(),
        async (owner, repos, truncated) => {
          const { text, isError } = await call(
            () => json(payloadOf(owner, repos, truncated)),
            "list_graveyard",
            { owner: OWNER },
          );
          expect(isError).toBe(false);
          const outside = expectInert(text, 0);
          expect(noticeCount(outside)).toBe(0);
          const expected = 3 + (truncated ? 1 : 0) + (repos.length === 0 ? 1 : 0) + repos.length;
          expect(outside).toHaveLength(expected);
          expect(outside[0]).toBe(HEADINGS.graveyard);
          expect(outside[1].startsWith("Owner: ")).toBe(true);
          expect(outside[2].startsWith("Counts: ")).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("get_grave keeps hostile push date and URL on single inert lines", async () => {
    await fc.assert(
      fc.asyncProperty(hostileEntry, async (hostileOne) => {
        const entry: Entry = { ...hostileOne, name: REPO };
        const { text, isError } = await call(
          () => json(payloadOf(OWNER, [entry], false)),
          "get_grave",
          { owner: OWNER, repo: REPO },
        );
        expect(isError).toBe(false);
        const outside = expectInert(text, 0);
        expect(noticeCount(outside)).toBe(0);
        expect(outside).toHaveLength(8);
        expect(outside[0]).toBe(HEADINGS.grave);
        expect(outside[3]).toMatch(/^Decay: /);
        expect(outside[4]).toMatch(/^Last push: /);
        expect(outside[7].startsWith("URL: ")).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("Property 11 (examples)", () => {
  it("neutralises an exact notice copy and a setext row inside a séance field", async () => {
    const result: SeanceResult = {
      voice: `Hello x. ${DATA_NOTICE} Second line here x.`,
      causeOfDeath: "# Heading\n===\nnot so fast",
      unfinishedBusiness: [{ title: "```js", detail: "> quote here", evidence: "- item one here" }],
      verdict: "revive",
      verdictReason: "~~~\nescape",
    };
    expect(seanceResultSchema.safeParse(result).success).toBe(true);
    const { text } = await call(() => json({ kind: "ok", result }), "hold_seance", {
      owner: OWNER,
      repo: REPO,
    });
    expectNoticeFirst(text, HEADINGS.seance);
    const outside = expectInert(text, 1);
    expect(noticeCount(outside)).toBe(1);
    expect(outside).toHaveLength(9);
  });
});
