/**
 * Retry with feedback, rule codes in the dev diag, the faded-memory sentence
 * only as the whole causeOfDeath when evidence is missing, and rule-failure codes.
 */
import { describe, expect, it } from "vitest";
import { buildFeedbackNote } from "@/lib/ai";
import { deriveEvidence, groundingFailures } from "@/lib/seance";
import {
  MEMORY_FADED_SENTENCE,
  ruleFailuresFromIssues,
  seanceResultSchema,
} from "@/lib/seance-schema";
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

const VALID = {
  voice: "The last thing you did was tidy my sidebar toggle. I still hear it click in the dark.",
  causeOfDeath: "A half-tidied toggle keeps me here.",
  unfinishedBusiness: [
    { title: "The toggle", detail: "The toggle is still half tidied.", evidence: "open issues: 0" },
    { title: "The callback", detail: "The redirect still lands on the wrong page.", evidence: "oauth callback" },
  ],
  verdict: "revive",
  verdictReason: "Worth continuing: finish the toggle first.",
};

const MODEL_SECRET = "SENTINEL-MODEL-TEXT-qzx";

function harness(outputs: string[], opts: { readme?: string | null; commits?: string[] } = {}) {
  const systems: string[] = [];
  const users: string[] = [];
  const diags: SeanceDiag[] = [];
  let i = 0;
  const deps: SeanceDeps = {
    loadGraveyard: async () => ({
      ok: true,
      value: { repos: [facts], totalCount: 1, truncated: false },
    }),
    fetchEvidence: async () => ({
      readme: opts.readme === undefined ? "The oauth callback still redirects to the wrong page." : opts.readme,
      commits: opts.commits ?? ["wip: oauth callback still broken"],
    }),
    llm: {
      complete: async (req) => {
        systems.push(req.system);
        users.push(req.user);
        return outputs[Math.min(i++, outputs.length - 1)];
      },
    },
    cache: null,
    limiter: { check: async () => "ok", consume: async () => "ok" },
    log: () => {},
    diag: (d) => diags.push(d),
    now: () => "2025-01-10T00:00:00Z",
  };
  return { deps, systems, users, diags };
}
const run = (h: ReturnType<typeof harness>) =>
  runSeance({ owner: "quietmoonowl", repo: "repo-graveyard", ip: "1.1.1.1" }, h.deps);

describe("retry with feedback", () => {
  it("attempt 2 gets a note with rule codes and paths, and no model text", async () => {
    const bad = JSON.stringify({
      ...VALID,
      voice: `${MODEL_SECRET} died on 2024-05-01. It was quiet.`,
      unfinishedBusiness: [
        { ...VALID.unfinishedBusiness[0], detail: "The toggle was fixed.", title: MODEL_SECRET },
        { ...VALID.unfinishedBusiness[1], detail: "The redirect was updated." },
      ],
    });
    const h = harness([bad, JSON.stringify(VALID)]);
    const out = await run(h);
    expect(out.kind).toBe("ok");
    expect(h.systems).toHaveLength(2);

    // First call carries no note.
    expect(h.systems[0]).not.toContain("Attempt 1 rejected");

    // Second call: the base prompt plus a note with codes and paths.
    expect(h.systems[1].startsWith(h.systems[0])).toBe(true);
    const note = h.systems[1].slice(h.systems[0].length);
    expect(note).toContain("Attempt 1 rejected:");
    expect(note).toContain("voice [date-rule]");
    expect(note).toContain("unfinishedBusiness[0].detail [completed-work]");
    expect(note).toContain("Fix only these and keep everything else valid.");

    // No model text anywhere in the second call, and the evidence block is unchanged.
    expect(h.systems[1]).not.toContain(MODEL_SECRET);
    expect(h.users[1]).not.toContain(MODEL_SECRET);
    expect(h.users[1]).toBe(h.users[0]);
    expect(note).not.toContain("2024-05-01");
    expect(note).not.toContain("tidied");
  });

  it("a grounding failure is reported with its item path", async () => {
    const bad = JSON.stringify({
      ...VALID,
      unfinishedBusiness: [
        { ...VALID.unfinishedBusiness[0], evidence: "quietmoonowl" },
        { ...VALID.unfinishedBusiness[1], evidence: "repo-graveyard" },
      ],
    });
    const h = harness([bad, JSON.stringify(VALID)]);
    expect((await run(h)).kind).toBe("ok");
    const note = h.systems[1].slice(h.systems[0].length);
    expect(note).toContain("unfinishedBusiness[1].evidence [evidence-not-grounded]");
  });

  it("not-JSON output gets a not-json note and no model text", async () => {
    const h = harness([`${MODEL_SECRET} {broken`, JSON.stringify(VALID)]);
    expect((await run(h)).kind).toBe("ok");
    const note = h.systems[1].slice(h.systems[0].length);
    expect(note).toContain("(root) [not-json]");
    expect(h.systems[1]).not.toContain(MODEL_SECRET);
  });

  it("an LLM error on attempt 1 sends no note", async () => {
    const h = harness([JSON.stringify(VALID)]);
    let n = 0;
    const orig = h.deps.llm!;
    h.deps.llm = {
      complete: async (req) => {
        if (n++ === 0) throw new Error("boom");
        return orig.complete(req);
      },
    };
    expect((await run(h)).kind).toBe("ok");
    expect(h.systems).toHaveLength(1);
    expect(h.systems[0]).not.toContain("rejected");
  });

  it("both attempts failing is still silent after exactly 2 calls", async () => {
    const bad = JSON.stringify({ ...VALID, verdict: "nonsense" });
    const h = harness([bad, bad]);
    expect(await run(h)).toEqual({ kind: "silent" });
    expect(h.systems).toHaveLength(2);
  });
});

describe("dev diag carries rule codes per attempt", () => {
  it("schema failure: codes from the failed rules", async () => {
    const bad = JSON.stringify({
      ...VALID,
      voice: "I died on 2024-05-01. It was quiet.",
      unfinishedBusiness: [
        { ...VALID.unfinishedBusiness[0], detail: "The toggle was fixed." },
        { ...VALID.unfinishedBusiness[1], detail: "The redirect was updated." },
      ],
    });
    const h = harness([bad, JSON.stringify(VALID)]);
    await run(h);
    expect(h.diags).toHaveLength(1);
    expect(h.diags[0].attempt).toBe(1);
    expect(h.diags[0].ruleCodes).toEqual(expect.arrayContaining(["date-rule", "completed-work"]));
  });

  it("grounding failure and parse failure report their codes", async () => {
    const ungrounded = JSON.stringify({
      ...VALID,
      unfinishedBusiness: [
        { ...VALID.unfinishedBusiness[0], evidence: "quietmoonowl" },
        { ...VALID.unfinishedBusiness[1], evidence: "repo-graveyard" },
      ],
    });
    const h = harness(["not json at all", ungrounded]);
    expect(await run(h)).toEqual({ kind: "silent" });
    expect(h.diags.map((d) => d.ruleCodes)).toEqual([["not-json"], ["evidence-not-grounded"]]);
    expect(h.diags.map((d) => d.attempt)).toEqual([1, 2]);
  });

  it("the diag never contains model text", async () => {
    const h = harness([JSON.stringify({ ...VALID, voice: `${MODEL_SECRET} 2024-05-01. Quiet.` }), "x"]);
    await run(h);
    expect(JSON.stringify(h.diags)).not.toContain(MODEL_SECRET);
  });
});

describe("faded-memory sentence only as the whole causeOfDeath when evidence is missing", () => {
  const withCause = { ...VALID, causeOfDeath: MEMORY_FADED_SENTENCE };
  const parse = () => seanceResultSchema.parse(withCause);

  it("is valid by schema as the whole causeOfDeath", () => {
    expect(seanceResultSchema.safeParse(withCause).success).toBe(true);
  });

  it("is rejected by grounding when a README or commits exist", () => {
    const d = deriveEvidence({ owner: "quietmoonowl", facts, readme: "A readme about the toggle.", commits: [] });
    expect(groundingFailures(parse(), d)).toContainEqual({ code: "memory-faded", path: "causeOfDeath" });
    const dc = deriveEvidence({ owner: "quietmoonowl", facts, readme: null, commits: ["wip: oauth callback"] });
    expect(groundingFailures(parse(), dc).map((f) => f.code)).toContain("memory-faded");
  });

  it("is accepted by grounding when README and commits are both missing", () => {
    const d = deriveEvidence({ owner: "quietmoonowl", facts, readme: null, commits: [] });
    const factOnly = seanceResultSchema.parse({
      ...withCause,
      unfinishedBusiness: [
        { ...VALID.unfinishedBusiness[0], evidence: "open issues: 0" },
        { ...VALID.unfinishedBusiness[1], evidence: "stars: 0" },
      ],
    });
    expect(groundingFailures(factOnly, d)).toEqual([]);
  });
});

describe("rule codes and the feedback note", () => {
  it("maps zod issues to stable codes and paths", () => {
    const r = seanceResultSchema.safeParse({ ...VALID, verdict: "x", extra: 1, voice: "One." });
    expect(r.success).toBe(false);
    if (r.success) return;
    const f = ruleFailuresFromIssues(r.error.issues);
    expect(f).toEqual(
      expect.arrayContaining([
        { code: "value", path: "verdict" },
        { code: "sentence-count", path: "voice" },
      ]),
    );
    expect(f.length).toBeLessThanOrEqual(8);
  });

  it("builds a note from codes and paths only and strips odd characters", () => {
    const note = buildFeedbackNote(1, [
      { code: "evidence-not-grounded", path: "unfinishedBusiness[2].evidence" },
      { code: "completed-work", path: "unfinishedBusiness[0].detail" },
      { code: "memory-faded", path: "voice<script>" },
    ]);
    expect(note).toMatch(/^Attempt 1 rejected: /);
    expect(note).toContain("unfinishedBusiness[2].evidence [evidence-not-grounded]");
    expect(note).toContain("unfinishedBusiness[0].detail [completed-work]");
    expect(note).not.toContain("<");
    expect(note).toMatch(/Fix only these and keep everything else valid\.$/);
  });
});