/**
 * The dev-only diagnostic sink is passed to runSeance outside production only,
 * and it logs one safe JSON line. All collaborators are mocked.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const runSeance = vi.hoisted(() => vi.fn());
vi.mock("@/lib/seance-service", () => ({ runSeance }));
vi.mock("@/lib/graveyard-loader", () => ({ loadGraveyard: vi.fn() }));
vi.mock("@/lib/github", () => ({ createGithubTransport: vi.fn(() => ({})) }));
vi.mock("@/lib/llm", () => ({ createLlmClient: vi.fn(() => null) }));
vi.mock("@/lib/seance-gather", () => ({ fetchEvidence: vi.fn() }));
vi.mock("@/lib/ratelimit-store", () => ({
  createUpstashRedis: vi.fn(async () => null),
  createUpstashStore: vi.fn(),
}));

import { POST } from "@/app/api/seance/route";

const post = () =>
  POST(
    new Request("http://localhost/api/seance", {
      method: "POST",
      body: JSON.stringify({ owner: "ada", repo: "crypt-keeper" }),
    }),
  );

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  runSeance.mockReset();
});

describe("route diag gating", () => {
  it("passes a diag sink outside production and logs one safe JSON line", async () => {
    vi.stubEnv("NODE_ENV", "development");
    runSeance.mockResolvedValue({ kind: "silent" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await post();
    const deps = runSeance.mock.calls[0][1];
    expect(typeof deps.diag).toBe("function");
    deps.diag({ repo: "crypt-keeper", attempt: 1, category: "timeout", elapsedMs: 8001 });
    expect(warn).toHaveBeenCalledWith(
      "[seance:diag]",
      JSON.stringify({ repo: "crypt-keeper", attempt: 1, category: "timeout", elapsedMs: 8001 }),
    );
  });

  it("passes no diag sink in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    runSeance.mockResolvedValue({ kind: "silent" });
    await post();
    expect(runSeance.mock.calls[0][1].diag).toBeUndefined();
  });
});