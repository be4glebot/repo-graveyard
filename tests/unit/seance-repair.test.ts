/**
 * Repair over reject: one bad item or sentence no longer sinks the response.
 */
import { describe, expect, it } from "vitest";
import { deriveEvidence, isGroundedEvidence, normalizeForMatch } from "@/lib/seance";
import { repairSeance, repairVoice } from "@/lib/seance-repair";
import { seanceResultSchema, splitSentences } from "@/lib/seance-schema";
import { runSeance, type SeanceDeps, type SeanceDiag } from "@/lib/seance-service";
import type { RepoFacts } from "@/lib/lifecycle";

const facts: RepoFacts = {
  name: "repo-graveyard",
  description: null,
  url: "https://github.com/quietmoonowl/repo-graveyard",
  pushedAt: "2025-01-01T00:00:00Z",
  createdAt: "2024-01-02T00:00:00Z",
  isArchived: false,
  isFork: false,
  homepageUrl: null,
  stargazerCount: 0,
  primaryLanguage: "TypeScript",
  openIssueCount: 0,
  releaseCount: 0,
  readmeBytes: 400,
  lastCommitMessage: "wip: oauth callback still broken",
  languageColor: null,
  forkCount: 0,
  topics: [],
};

const README = "The oauth callback isn't wired up yet - the redirect loops.";
const COMMIT = "wip: oauth callback still broken";
const derived = deriveEvidence({ owner: "quietmoonowl", facts, readme: README, commits: [COMMIT] });

const item = (over: Record<string, unknown> = {}) => ({
  title: "The callback",
  detail: "The redirect still loops.",
  evidence: "oauth callback",
  ...over,
});
const VALID = {
  voice: "The last thing you did was tidy my sidebar toggle. I still hear it click in the dark.",
  causeOfDeath: "A half-tidied toggle keeps me here.",
  unfinishedBusiness: [item(), item({ title: "Issues", detail: "Nobody answered.", evidence: "open issues: 0" }), item({ title: "Stars", detail: "Nobody came.", evidence: "stars: 0" })],
  verdict: "revive",
  verdictReason: "Worth continuing: finish the toggle first.",
};
const BAD_EVIDENCE = "this text is nowhere in the facts";

const codes = (r: { code: string }[]) => r.map((x) => x.code);

describe("repairSeance: items", () => {
  it("one ungrounded item among three is dropped; the other two survive", () => {
    const r = repairSeance(
      { ...VALID, unfinishedBusiness: [VALID.unfinishedBusiness[0], item({ evidence: BAD_EVIDENCE }), VALID.unfinishedBusiness[2]] },
      derived,
    );
    expect(r.rejected).toEqual([]);
    expect(r.repaired).toEqual([{ code: "evidence-not-grounded", path: "unfinishedBusiness[1].evidence" }]);
    const parsed = seanceResultSchema.safeParse(r.value);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.unfinishedBusiness).toHaveLength(2);
  });

  it("drops items whose detail breaks a ledger rule (completed-work, date-rule, length)", () => {
    const r = repairSeance(
      {
        ...VALID,
        unfinishedBusiness: [
          VALID.unfinishedBusiness[0],
          item({ detail: "The toggle was fixed." }),
          item({ detail: "It was left on 2024-05-01." }),
          item({ detail: "x".repeat(141) }),
        ],
      },
      derived,
    );
    expect(codes(r.repaired).sort()).toEqual(["completed-work", "date-rule", "length"]);
    expect(r.rejected).toEqual([]);
    const parsed = seanceResultSchema.safeParse(r.value);
    expect(parsed.success && parsed.data.unfinishedBusiness).toHaveLength(1);
  });

  it("a single surviving item is enough", () => {
    const r = repairSeance(
      { ...VALID, unfinishedBusiness: [item({ evidence: BAD_EVIDENCE }), VALID.unfinishedBusiness[0]] },
      derived,
    );
    expect(seanceResultSchema.safeParse(r.value).success).toBe(true);
  });

  it("all items ungrounded: nothing survives and the reasons are reported per item", () => {
    const r = repairSeance(
      {
        ...VALID,
        unfinishedBusiness: [item({ evidence: BAD_EVIDENCE }), item({ evidence: "quietmoonowl" }), item({ evidence: "repo-graveyard" })],
      },
      derived,
    );
    expect(r.rejected).toEqual([
      { code: "evidence-not-grounded", path: "unfinishedBusiness[0].evidence" },
      { code: "evidence-not-grounded", path: "unfinishedBusiness[1].evidence" },
      { code: "evidence-not-grounded", path: "unfinishedBusiness[2].evidence" },
    ]);
    expect(seanceResultSchema.safeParse(r.value).success).toBe(false);
  });

  it("keeps at most 4 items", () => {
    const six = Array.from({ length: 6 }, () => item());
    const r = repairSeance({ ...VALID, unfinishedBusiness: six }, derived);
    const parsed = seanceResultSchema.safeParse(r.value);
    expect(parsed.success && parsed.data.unfinishedBusiness).toHaveLength(4);
    expect(codes(r.repaired)).toEqual(["length", "length"]);
  });

  it("does nothing to a response that is already valid, and ignores non-objects", () => {
    const r = repairSeance(VALID, derived);
    expect(r.repaired).toEqual([]);
    expect(r.rejected).toEqual([]);
    expect(r.value).toEqual(VALID);
    expect(repairSeance("nope", derived).value).toBe("nope");
    expect(repairSeance(null, derived).value).toBeNull();
  });
});

describe("repairVoice", () => {
  const S = ["I hold the half of a sentence.", "It waits where you left it.", "The room is very still.", "Something listens."];

  it("a 4-sentence voice is trimmed to 3", () => {
    const r = repairVoice(S.join(" "));
    expect(splitSentences(r.text)).toEqual(S.slice(0, 3));
    expect(r.codes).toEqual(["voice-trimmed"]);
  });

  it("a voice over 320 characters is cut to the first sentences that fit", () => {
    const long = "w".repeat(150);
    const r = repairVoice(`${long}. ${long}. ${long}.`);
    expect(r.text).toBe(`${long}. ${long}.`);
    expect(r.text.length).toBeLessThanOrEqual(320);
    expect(r.codes).toEqual(["voice-trimmed"]);
  });

  it("removes a dated sentence and the faded-memory sentence", () => {
    const dated = repairVoice("I wait. It was 5 days ago. The dark is patient.");
    expect(dated.text).toBe("I wait. The dark is patient.");
    expect(dated.codes).toEqual(["date-rule"]);
    const faded = repairVoice("I wait. My memory of that has faded. The dark is patient.");
    expect(faded.text).toBe("I wait. The dark is patient.");
    expect(faded.codes).toEqual(["memory-faded"]);
  });

  it("leaves the voice untouched when fewer than 2 sentences would remain", () => {
    const v = "I wait. It was 5 days ago.";
    expect(repairVoice(v)).toEqual({ text: v, codes: [] });
    const r = repairSeance({ ...VALID, voice: v }, derived);
    expect(seanceResultSchema.safeParse(r.value).success).toBe(false);
  });

  it("leaves a clean voice exactly as written", () => {
    const v = "I wait   in the dark.\nIt is quiet.";
    expect(repairVoice(v)).toEqual({ text: v, codes: [] });
  });
});

describe("forgiving evidence matching", () => {
  const d = deriveEvidence({
    owner: "quietmoonowl",
    facts,
    readme: "The oauth callback isn't wired up yet - the redirect loops. Settings are \"half done\".",
    commits: [],
  });

  it("curly quotes, long dashes and backticks match the plain README source", () => {
    expect(isGroundedEvidence("`oauth callback` isn\u2019t wired up yet", d)).toBe(true);
    expect(isGroundedEvidence("wired up yet \u2014 the redirect loops", d)).toBe(true);
    expect(isGroundedEvidence("Settings are \u201Chalf done\u201D", d)).toBe(true);
    expect(isGroundedEvidence("**the redirect** _loops_", d)).toBe(true);
  });

  it("normalises both sides the same way", () => {
    expect(normalizeForMatch("\u2018A\u2019 \u2014 `B` *C* _D_ # > [E](F)")).toBe("'a' - b c d ef");
    expect(normalizeForMatch("  Mixed   CASE\n\ttext ")).toBe("mixed case text");
  });

  it("keeps the 12-character minimum and the bare-name rule", () => {
    expect(isGroundedEvidence("`redirect`", d)).toBe(false); // 8 characters after cleanup
    expect(isGroundedEvidence("`repo-graveyard`", d)).toBe(false);
    expect(isGroundedEvidence("\u201Cquietmoonowl\u201D", d)).toBe(false);
    expect(isGroundedEvidence("open issues: 0", d)).toBe(true);
  });

  it("an item with markdown or curly-quote evidence survives repair", () => {
    const r = repairSeance(
      { ...VALID, unfinishedBusiness: [item({ evidence: "`oauth callback` isn\u2019t wired up" })] },
      deriveEvidence({ owner: "quietmoonowl", facts, readme: "The oauth callback isn't wired up yet.", commits: [] }),
    );
    expect(r.repaired).toEqual([]);
    expect(seanceResultSchema.safeParse(r.value).success).toBe(true);
  });
});

describe("service: repair, hard rejects and the dev diag", () => {
  const MODEL_SECRET = "SENTINEL-MODEL-TEXT-qzx";

  function harness(outputs: string[]) {
    const systems: string[] = [];
    const diags: SeanceDiag[] = [];
    let i = 0;
    const deps: SeanceDeps = {
      loadGraveyard: async () => ({ ok: true, value: { repos: [facts], totalCount: 1, truncated: false } }),
      fetchEvidence: async () => ({ readme: README, commits: [COMMIT] }),
      llm: {
        complete: async (req) => {
          systems.push(req.system);
          return outputs[Math.min(i++, outputs.length - 1)];
        },
      },
      cache: null,
      limiter: { check: async () => "ok", consume: async () => "ok" },
      log: () => {},
      diag: (d) => diags.push(d),
      now: () => "2025-01-10T00:00:00Z",
    };
    return { deps, systems, diags };
  }
  const run = (h: ReturnType<typeof harness>) =>
    runSeance({ owner: "quietmoonowl", repo: "repo-graveyard", ip: "1.1.1.1" }, h.deps);

  it("one ungrounded item among three: accepted with two, one call, repairedCodes logged", async () => {
    const out = JSON.stringify({
      ...VALID,
      unfinishedBusiness: [VALID.unfinishedBusiness[0], item({ evidence: `${BAD_EVIDENCE} ${MODEL_SECRET}` }), VALID.unfinishedBusiness[2]],
    });
    const h = harness([out]);
    const res = await run(h);
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") {
      expect(res.result.unfinishedBusiness).toHaveLength(2);
      expect(JSON.stringify(res.result)).not.toContain(MODEL_SECRET);
    }
    expect(h.systems).toHaveLength(1);
    expect(h.diags).toHaveLength(1);
    expect(h.diags[0].category).toBe("repaired");
    expect(h.diags[0].repairedCodes).toEqual(["evidence-not-grounded"]);
    expect(h.diags[0].ruleCodes).toBeUndefined();
    expect(JSON.stringify(h.diags)).not.toContain(MODEL_SECRET);
  });

  it("all items ungrounded: the attempt is rejected, with ruleCodes and the per-item feedback", async () => {
    const bad = JSON.stringify({
      ...VALID,
      unfinishedBusiness: [item({ evidence: BAD_EVIDENCE }), item({ evidence: "quietmoonowl" })],
    });
    const h = harness([bad, JSON.stringify(VALID)]);
    expect((await run(h)).kind).toBe("ok");
    expect(h.systems).toHaveLength(2);
    expect(h.diags[0].category).toBe("grounding");
    expect(h.diags[0].ruleCodes).toEqual(["evidence-not-grounded"]);
    expect(h.diags[0].repairedCodes).toEqual([]);
    expect(h.systems[1]).toContain("unfinishedBusiness[0].evidence [evidence-not-grounded]");
    expect(h.systems[1]).toContain("unfinishedBusiness[1].evidence [evidence-not-grounded]");
  });

  it("a 4-sentence voice is trimmed to 3 and the séance is accepted", async () => {
    const voice = "I hold the half of a sentence. It waits where you left it. The room is very still. Something listens.";
    const h = harness([JSON.stringify({ ...VALID, voice })]);
    const res = await run(h);
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") expect(splitSentences(res.result.voice)).toHaveLength(3);
    expect(h.diags[0].repairedCodes).toEqual(["voice-trimmed"]);
    expect(h.systems).toHaveLength(1);
  });

  it("a dated voice sentence is removed instead of rejecting", async () => {
    const voice = "I wait in the dark. It was 5 days ago. The dark is patient.";
    const h = harness([JSON.stringify({ ...VALID, voice })]);
    const res = await run(h);
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") expect(res.result.voice).toBe("I wait in the dark. The dark is patient.");
    expect(h.diags[0].repairedCodes).toEqual(["date-rule"]);
  });

  it("a finish verdict with next-step words is still a hard reject", async () => {
    const bad = JSON.stringify({ ...VALID, verdict: "finish", verdictReason: "Add a test and fix the toggle." });
    const h = harness([bad]);
    expect(await run(h)).toEqual({ kind: "silent" });
    expect(h.systems).toHaveLength(2);
    expect(h.diags.map((d) => d.category)).toEqual(["verdict", "verdict"]);
    expect(h.diags[0].ruleCodes).toEqual(["next-step"]);
    expect(h.systems[1]).toContain("verdictReason [next-step]");
  });

  it("fewer than 2 voice sentences left after repair is rejected", async () => {
    const h = harness([JSON.stringify({ ...VALID, voice: "I wait. It was 5 days ago." })]);
    expect(await run(h)).toEqual({ kind: "silent" });
    expect(h.diags[0].ruleCodes).toEqual(expect.arrayContaining(["date-rule"]));
  });
});