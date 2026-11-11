/**
 * Fourth quality round: decay-aware ghost tone, ghost cause line, completed-work
 * ledger details, the faded-memory paraphrase rule, informative evidence and the
 * seance:v4 cache key. Each rule has good and bad examples.
 */
import { describe, expect, it } from "vitest";
import { GHOST_TONES, STATE_VOICE, buildSeancePrompt } from "@/lib/ai";
import { seanceCacheKey, type CacheClient } from "@/lib/cache";
import { deriveEvidence, isGroundedEvidence, validateGrounding } from "@/lib/seance";
import {
  MEMORY_FADED_SENTENCE,
  describesCompletedWork,
  misusesMemoryFaded,
  seanceResultSchema,
  type CreatureState,
} from "@/lib/seance-schema";
import { runSeance, type SeanceDeps } from "@/lib/seance-service";
import type { RepoFacts } from "@/lib/lifecycle";

const facts: RepoFacts = {
  name: "repo-graveyard",
  description: "A haunted scene of repos",
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

const README = "The oauth callback still redirects to the wrong page.";
const derived = deriveEvidence({
  owner: "quietmoonowl",
  facts,
  readme: README,
  commits: ["wip: oauth callback still broken"],
});

const base = {
  voice: "The last thing you did was tidy my sidebar toggle. I still hear it click in the dark.",
  causeOfDeath: "A half-tidied toggle keeps me here.",
  unfinishedBusiness: [
    { title: "The sidebar toggle", detail: "The toggle is still half tidied.", evidence: "open issues: 0" },
    { title: "The callback", detail: "The redirect still lands on the wrong page.", evidence: "oauth callback" },
  ],
  verdict: "revive",
  verdictReason: "Worth continuing: finish the toggle first.",
};
const ok = (over: Record<string, unknown> = {}) =>
  seanceResultSchema.safeParse({ ...base, ...over }).success;
const withDetail = (detail: string) =>
  ok({ unfinishedBusiness: [{ ...base.unfinishedBusiness[0], detail }, base.unfinishedBusiness[1]] });

describe("rule 3: ledger details describe something not yet done", () => {
  it.each([
    "The login issue was closed.",
    "The toggle was fixed.",
    "Dark mode was added.",
    "The docs were updated.",
    "The migration was completed.",
    "The merge has been resolved.",
    "The parser was quickly fixed.",
    "Auth is completed.",
  ])("rejects completed-work language: %s", (detail) => {
    expect(describesCompletedWork(detail)).toBe(true);
    expect(withDetail(detail)).toBe(false);
  });

  it.each([
    "The toggle is still half tidied.",
    "The migration was never completed.",
    "A half-completed rewrite waits in a branch.",
    "Three issues remain open.",
    "Nobody ever fixed the redirect.",
  ])("accepts unfinished work: %s", (detail) => {
    expect(describesCompletedWork(detail)).toBe(false);
    expect(withDetail(detail)).toBe(true);
  });
});

describe("rule 4: faded memory is only the exact sentence", () => {
  it.each([
    "My memory of what I was meant to become has faded.",
    "I think my memory has faded a little.",
    "Memory is a faded thing in me.",
  ])("rejects: %s", (sentence) => {
    expect(misusesMemoryFaded(sentence)).toBe(true);
    expect(ok({ voice: `I loved the dark. ${sentence}` })).toBe(false);
  });

  it("accepts the exact sentence only as the whole causeOfDeath, plus unrelated memory talk", () => {
    expect(misusesMemoryFaded(MEMORY_FADED_SENTENCE)).toBe(false);
    expect(ok({ causeOfDeath: MEMORY_FADED_SENTENCE })).toBe(true);
    expect(ok({ voice: `The lamp went dark. ${MEMORY_FADED_SENTENCE}` })).toBe(false);
    expect(ok({ voice: "I keep one memory of a click. It is sharp." })).toBe(true);
  });
});

describe("rule 5: evidence must carry information", () => {
  const good = (e: string) => isGroundedEvidence(e, derived);

  it("rejects the repo name, the owner name and owner/repo", () => {
    expect(good("repo-graveyard")).toBe(false);
    expect(good("Repo Graveyard")).toBe(false);
    expect(good("quietmoonowl")).toBe(false);
    expect(good("quietmoonowl/repo-graveyard")).toBe(false);
  });

  it("rejects a bare name even when it occurs in the README", () => {
    const d = deriveEvidence({
      owner: "quietmoonowl",
      facts,
      readme: "repo-graveyard shows every repo as a creature.",
      commits: [],
    });
    expect(isGroundedEvidence("repo-graveyard", d)).toBe(false);
    expect(isGroundedEvidence("shows every repo", d)).toBe(true);
  });

  it("rejects README or commit quotes under 12 characters", () => {
    expect(good("redirects")).toBe(false); // 9 characters
    expect(good("the wrong")).toBe(false); // 9 characters
    expect(good("still redirects")).toBe(true); // 15 characters
    expect(good("oauth callback")).toBe(true); // 14 characters
  });

  it("keeps short exact fact lines valid", () => {
    expect(good("open issues: 0")).toBe(true);
    expect(good("stars: 0")).toBe(true);
    expect(good("language: TypeScript")).toBe(true);
  });

  it("validateGrounding applies the same rules to a result", () => {
    const withEvidence = (evidence: string) =>
      seanceResultSchema.parse({
        ...base,
        unfinishedBusiness: [{ ...base.unfinishedBusiness[0], evidence }, base.unfinishedBusiness[1]],
      });
    expect(validateGrounding(withEvidence("open issues: 0"), derived).ok).toBe(true);
    expect(validateGrounding(withEvidence("repo-graveyard"), derived).ok).toBe(false);
  });
});

describe("rule 1: upbeat phrasing is prompt-only", () => {
  it.each([
    "I am still running. The dark hums around me.",
    "Everything is working well. I wait here.",
  ])("the schema does not reject it (so it costs no retry): %s", (voice) => {
    expect(ok({ voice })).toBe(true);
  });
});

describe("rule 1: ghost tone depends on decay level", () => {
  const sys = (decay?: number | null, state: CreatureState = "ghost") =>
    buildSeancePrompt("quietmoonowl", derived, state, decay).system;

  it("decay 0: restless, a spirit that just noticed it is fading", () => {
    expect(sys(0)).toContain(GHOST_TONES[0]);
    expect(sys(0)).toMatch(/just noticed it is fading/);
    expect(sys(undefined)).toBe(sys(0));
  });

  it("decay 1: thinning, details slipping away", () => {
    expect(sys(1)).toContain(GHOST_TONES[1]);
    expect(sys(1)).toMatch(/thinning/);
    expect(sys(1)).toMatch(/slipping away/);
  });

  it.each([2, 3])("decay %i: barely holding on, fragmentary, dread", (n) => {
    expect(sys(n)).toContain(GHOST_TONES[2]);
    expect(sys(n)).toMatch(/barely holding on/);
    expect(sys(n)).toMatch(/fragmentary/);
    expect(sys(n)).toMatch(/dread/);
  });

  it("clamps out-of-range and non-finite decay", () => {
    expect(sys(-4)).toBe(sys(0));
    expect(sys(9)).toBe(sys(3));
    expect(sys(Number.NaN)).toBe(sys(0));
  });

  it("never calls a ghost dead, at any decay", () => {
    for (const n of [0, 1, 2, 3]) {
      const { system, user } = buildSeancePrompt("quietmoonowl", derived, "ghost", n);
      expect(`${system}\n${user}`).not.toMatch(/\bdead\b/i);
    }
  });

  it("other states ignore the decay level", () => {
    for (const s of ["risen", "zombie", "tombstone", "coffin"] as const) {
      expect(sys(3, s)).toBe(sys(0, s));
    }
  });

  it("every state forbids upbeat phrasing and requires unease", () => {
    for (const s of Object.keys(STATE_VOICE) as CreatureState[]) {
      const system = sys(0, s);
      expect(system).toMatch(/unease or dread/);
      expect(system).toMatch(/still running/);
      expect(system).toMatch(/up and running/);
      expect(system).toMatch(/all set/);
      expect(system).toMatch(/working well/);
    }
  });
});

describe("rule 2 and prompt wording for the other rules", () => {
  const { system } = buildSeancePrompt("quietmoonowl", derived, "ghost", 0);

  it("asks the ghost cause line for one unfinished thing, never a feature list", () => {
    expect(system).toMatch(/exactly one sentence/);
    expect(system).toMatch(/single unfinished thing/);
    expect(system).toMatch(/Never list features/);
  });

  it("asks for details that are not yet done", () => {
    expect(system).toMatch(/NOT yet done/);
    expect(system).toMatch(/was closed/);
    expect(system).toMatch(/completed/);
  });

  it("forbids paraphrasing the faded-memory sentence", () => {
    expect(system).toMatch(/"memory" and "faded" never appear together/);
  });

  it("asks for quotes of at least 12 characters and no bare names", () => {
    expect(system).toMatch(/at least 12 characters/);
    expect(system).toMatch(/Never use the repo name or the owner name on its own/);
  });
});

describe("cache key v6", () => {
  const k = (decay?: number | null, state?: string) =>
    seanceCacheKey("Ada", "Repo", "2024-01-01T00:00:00Z", "x", state, decay);

  it("uses the v6 prefix and a decay suffix after the state", () => {
    expect(k(undefined, "ghost")).toBe("seance:v6:ada/repo:2024-01-01T00:00:00Z:ghost");
    expect(k(2, "ghost")).toBe("seance:v6:ada/repo:2024-01-01T00:00:00Z:ghost:d2");
    expect(k(0, "ghost")).toBe("seance:v6:ada/repo:2024-01-01T00:00:00Z:ghost:d0");
  });

  it("omits the suffix for null or missing decay and differs per level", () => {
    expect(k(null, "zombie")).toBe(k(undefined, "zombie"));
    expect(new Set([0, 1, 2, 3].map((n) => k(n, "ghost"))).size).toBe(4);
  });
});

describe("service passes the server-computed decay level", () => {
  function run(pushedAt: string, now: string, state = "ghost") {
    const gets: string[] = [];
    const systems: string[] = [];
    const cache: CacheClient = {
      get: async (key) => {
        gets.push(key);
        return null;
      },
      set: async () => undefined,
    };
    const deps: SeanceDeps = {
      loadGraveyard: async () => ({
        ok: true,
        value: { repos: [{ ...facts, pushedAt }], totalCount: 1, truncated: false },
      }),
      fetchEvidence: async () => ({ readme: README, commits: ["wip: oauth callback still broken"] }),
      llm: {
        complete: async (req) => {
          systems.push(req.system);
          return "not json";
        },
      },
      cache,
      limiter: { check: async () => "ok", consume: async () => "ok" },
      log: () => {},
      now: () => now,
    };
    return runSeance({ owner: "quietmoonowl", repo: "repo-graveyard", ip: "1.1.1.1" }, deps).then(() => ({
      gets,
      systems,
      state,
    }));
  }

  it("a ghost quiet for about 20 days is decay 1 (thinning)", async () => {
    const r = await run("2025-01-01T00:00:00Z", "2025-01-21T00:00:00Z");
    expect(r.gets[0]).toBe("seance:v6:quietmoonowl/repo-graveyard:2025-01-01T00:00:00Z:ghost:d1");
    expect(r.systems[0]).toContain(GHOST_TONES[1]);
  });

  it("a ghost quiet for about 45 days is decay 2 (barely holding on)", async () => {
    const r = await run("2025-01-01T00:00:00Z", "2025-02-15T00:00:00Z");
    expect(r.gets[0]).toMatch(/:ghost:d2$/);
    expect(r.systems[0]).toContain(GHOST_TONES[2]);
  });

  it("a zombie's key carries no decay suffix", async () => {
    const r = await run("2023-01-01T00:00:00Z", "2025-02-15T00:00:00Z");
    expect(r.gets[0]).toMatch(/:zombie$/);
    expect(r.systems[0]).not.toContain(GHOST_TONES[0]);
  });
});