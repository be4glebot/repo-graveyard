import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSeance: vi.fn(),
}));

vi.mock("@/lib/seance-service", () => ({ runSeance: mocks.runSeance }));
vi.mock("@/lib/graveyard-loader", () => ({ loadGraveyard: vi.fn() }));
vi.mock("@/lib/github", () => ({ createGithubTransport: vi.fn(() => ({})) }));
vi.mock("@/lib/llm", () => ({ createLlmClient: vi.fn(() => null) }));
vi.mock("@/lib/ratelimit", () => ({
  clientIp: vi.fn(() => "203.0.113.9"),
  createRateLimiter: vi.fn(() => ({})),
}));
vi.mock("@/lib/ratelimit-store", () => ({
  createUpstashRedis: vi.fn(async () => null),
  createUpstashStore: vi.fn(() => ({})),
}));
vi.mock("@/lib/seance-gather", () => ({ fetchEvidence: vi.fn() }));

import { POST } from "@/app/api/seance/route";

const MAX_BYTES = 4096;
const byteLength = (s: string) => new TextEncoder().encode(s).length;

function post(rawBody: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/seance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    }),
  );
}

/** Independent oracle for "valid body". */
function isValid(value: unknown): value is { owner: string; repo: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.owner === "string" &&
    v.owner.length >= 1 &&
    v.owner.length <= 39 &&
    typeof v.repo === "string" &&
    v.repo.length >= 1 &&
    v.repo.length <= 100
  );
}

const ownerArb = fc.string({ minLength: 1, maxLength: 39 });
const repoArb = fc.string({ minLength: 1, maxLength: 100 });

const extrasArb = fc.dictionary(
  fc.oneof(
    fc.constant("pushedAt"),
    fc.string({ maxLength: 12 }).filter((k) => k !== "owner" && k !== "repo"),
  ),
  fc.jsonValue({ maxDepth: 2 }),
  { maxKeys: 5 },
);

const validBodyArb = fc
  .tuple(ownerArb, repoArb, extrasArb)
  .map(([owner, repo, extras]) => ({ ...extras, owner, repo }))
  .filter((b) => byteLength(JSON.stringify(b)) <= MAX_BYTES);

const wrongTypeArb = fc.oneof(
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.string(), { maxLength: 3 }),
  fc.dictionary(fc.string({ maxLength: 4 }), fc.string({ maxLength: 4 }), {
    maxKeys: 2,
  }),
);

const badLengthOwnerArb = fc.oneof(
  fc.constant(""),
  fc.string({ minLength: 40, maxLength: 80 }),
);
const badLengthRepoArb = fc.oneof(
  fc.constant(""),
  fc.string({ minLength: 101, maxLength: 200 }),
);

const invalidBodyArb: fc.Arbitrary<string> = fc.oneof(
  // wrong type for owner or repo
  fc
    .tuple(wrongTypeArb, repoArb)
    .map(([owner, repo]) => JSON.stringify({ owner, repo })),
  fc
    .tuple(ownerArb, wrongTypeArb)
    .map(([owner, repo]) => JSON.stringify({ owner, repo })),
  // missing field
  repoArb.map((repo) => JSON.stringify({ repo })),
  ownerArb.map((owner) => JSON.stringify({ owner })),
  fc.constant("{}"),
  // out-of-range lengths
  fc
    .tuple(badLengthOwnerArb, repoArb)
    .map(([owner, repo]) => JSON.stringify({ owner, repo })),
  fc
    .tuple(ownerArb, badLengthRepoArb)
    .map(([owner, repo]) => JSON.stringify({ owner, repo })),
  // non-object JSON
  fc
    .jsonValue({ maxDepth: 2 })
    .filter((v) => !isValid(v))
    .map((v) => JSON.stringify(v)),
  // malformed JSON
  fc
    .string({ maxLength: 60 })
    .filter((s) => {
      try {
        JSON.parse(s);
        return false;
      } catch {
        return true;
      }
    }),
  // valid fields but more than 4096 bytes
  fc
    .tuple(ownerArb, repoArb, fc.integer({ min: MAX_BYTES, max: MAX_BYTES + 2000 }))
    .map(([owner, repo, pad]) =>
      JSON.stringify({ owner, repo, pushedAt: "x".repeat(pad) }),
    ),
);

describe("seance route request validation", () => {
  beforeEach(() => {
    mocks.runSeance.mockReset();
    mocks.runSeance.mockResolvedValue({ kind: "silent" });
  });

  // Feature: the-seance, Property 25: Request validation accepts exactly the valid bodies
  // **Validates: Requirements 19.2, 19.3**
  it("passes only owner and repo to runSeance for valid bodies", async () => {
    await fc.assert(
      fc.asyncProperty(validBodyArb, async (body) => {
        mocks.runSeance.mockClear();
        const res = await post(JSON.stringify(body));
        expect(res.status).toBe(200);
        expect(mocks.runSeance).toHaveBeenCalledTimes(1);
        const input = mocks.runSeance.mock.calls[0][0] as Record<
          string,
          unknown
        >;
        expect(input.owner).toBe(body.owner);
        expect(input.repo).toBe(body.repo);
        expect(input).not.toHaveProperty("pushedAt");
        // only owner/repo (plus the server-derived ip) reach the service
        expect(Object.keys(input).sort()).toEqual(["ip", "owner", "repo"]);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: the-seance, Property 25: Request validation accepts exactly the valid bodies
  // **Validates: Requirements 19.2, 19.3**
  it("returns 400 without calling runSeance for every invalid body", async () => {
    await fc.assert(
      fc.asyncProperty(invalidBodyArb, async (raw) => {
        mocks.runSeance.mockClear();
        const res = await post(raw);
        expect(res.status).toBe(400);
        expect(mocks.runSeance).not.toHaveBeenCalled();
        const text = await res.text();
        expect(text).toBe(JSON.stringify({ error: "bad request" }));
      }),
      { numRuns: 100 },
    );
  });
});
