import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildKiroPrompt, buildReviveBrief, DATA_NOTICE } from "@/lib/revive-brief";
import { seanceResponseSchema, type SeanceResult } from "@/lib/seance-schema";
import { STATES, type State } from "../src/payload";
import { createHarness } from "./harness";

const NOW = Date.parse("2026-06-01T00:00:00Z");

// Words with and without backtick runs, so fence length is actually exercised.
const word = fc.constantFrom(
  "the", "login", "page", "redirect", "stays", "broken", "branch", "waits", "parser", "rewrite",
  "caf\u00e9", "\u2603", "`code`", "```", "````", "``x", "a`b", "# not", "> quote", "- item", "~~~",
);
const words = (min: number, max: number) =>
  fc.array(word, { minLength: min, maxLength: max }).map((w) => w.join(" "));
const sentence = words(2, 6).map((s) => `${s}.`);

const item = fc.record({
  title: words(1, 4),
  detail: sentence,
  evidence: fc
    .tuple(fc.constantFrom("abc1234", "src/a.ts:12", "feature/x", "issue #7", "`tick`", "````"), words(0, 2))
    .map(([a, b]) => `${a} ${b}`.trim().padEnd(8, "x")),
});

const resultArb: fc.Arbitrary<SeanceResult> = fc.record({
  voice: fc.tuple(sentence, sentence).map(([a, b]) => `${a} ${b}`),
  causeOfDeath: sentence,
  unfinishedBusiness: fc.array(item, { minLength: 1, maxLength: 4 }),
  verdict: fc.constant("revive" as const),
  verdictReason: words(2, 8),
});

const accepted = resultArb.filter((r) => seanceResponseSchema.safeParse({ kind: "ok", result: r }).success);

const owner = fc.stringMatching(/^[A-Za-z0-9]{1,12}$/);
const repoName = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._-]{0,20}$/).filter((r) => r !== "." && r !== "..");
const state = fc.constantFrom<State>(...STATES);

function longestRun(text: string): number {
  let longest = 0;
  for (const m of text.match(/`+/g) ?? []) longest = Math.max(longest, m.length);
  return longest;
}

async function brief(o: string, repo: string, st: State, result: SeanceResult): Promise<string> {
  const h = await createHarness({
    nowMs: NOW,
    respond: (req) => {
      if (req.method === "POST") return Response.json({ kind: "ok", result });
      const repos = [{ name: repo, state: st, decay: null, pushedAt: null, stars: 0, html_url: "https://x.test/r" }];
      const counts = { ghost: 0, risen: 0, zombie: 0, tombstone: 0, coffin: 0, total: 1 };
      counts[st] = 1;
      return Response.json({ owner: o, counts, truncated: false, repos });
    },
  });
  try {
    const res = (await h.client.callTool({ name: "get_revival_brief", arguments: { owner: o, repo } })) as {
      isError?: boolean;
      content: { type: string; text: string }[];
    };
    expect(res.isError).toBeFalsy();
    return res.content[0]!.text;
  } finally {
    await h.close();
  }
}

// Feature: graveyard-mcp, Property 12: Revival output is embedded byte for byte
describe("Property 12: revival output is embedded byte for byte", () => {
  it("embeds buildReviveBrief and buildKiroPrompt verbatim in sufficiently long fences", async () => {
    await fc.assert(
      fc.asyncProperty(accepted, owner, repoName, state, async (result, o, repo, st) => {
        const facts = { owner: o, repo, state: st };
        const expectedBrief = buildReviveBrief(result, facts);
        const expectedPrompt = buildKiroPrompt(result, facts);
        const text = await brief(o, repo, st, result);

        const prefix = `# Revival brief\n${DATA_NOTICE}\nRepository: ${o}/${repo}\nREVIVAL.md\n`;
        expect(text.startsWith(prefix)).toBe(true);
        const rest = text.slice(prefix.length);

        const open1 = /^(`{3,})markdown\n/.exec(rest);
        expect(open1).not.toBeNull();
        const fence1 = open1![1]!;
        expect(fence1.length).toBeGreaterThanOrEqual(3);
        expect(fence1.length).toBeGreaterThan(longestRun(expectedBrief));
        const afterOpen1 = rest.slice(open1![0].length);
        expect(afterOpen1.startsWith(`${expectedBrief}\n${fence1}\nKiro prompt\n`)).toBe(true);

        const afterBrief = afterOpen1.slice(`${expectedBrief}\n${fence1}\nKiro prompt\n`.length);
        const open2 = /^(`{3,})\n/.exec(afterBrief);
        expect(open2).not.toBeNull();
        const fence2 = open2![1]!;
        expect(fence2.length).toBeGreaterThan(longestRun(expectedPrompt));
        expect(afterBrief.slice(open2![0].length)).toBe(`${expectedPrompt}\n${fence2}`);

        // The notice appears once outside the fenced blocks.
        const outside = text
          .replace(`${fence1}markdown\n${expectedBrief}\n${fence1}`, "")
          .replace(`${fence2}\n${expectedPrompt}\n${fence2}`, "");
        expect(outside.split(DATA_NOTICE).length - 1).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
