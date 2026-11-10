import { describe, expect, it } from "vitest";
import {
  containsDateOrDayCount,
  seanceRequestSchema,
  seanceResultSchema,
} from "@/lib/seance-schema";

const item = () => ({
  title: "The unfinished router",
  detail: "Routes were half wired and never tested.",
  evidence: "src/router.ts has a TODO",
});

const valid = () => ({
  voice: "I was left in the dark. I may never wake.",
  causeOfDeath: "The author drifted to other work.",
  unfinishedBusiness: [item(), item()],
  verdict: "revive" as const,
  verdictReason: "The core idea still holds up.",
});

const ok = (v: unknown) => seanceResultSchema.safeParse(v).success;
const withField = (k: string, v: unknown) => ({ ...valid(), [k]: v });
const withItem = (k: string, v: unknown) => ({
  ...valid(),
  unfinishedBusiness: [{ ...item(), [k]: v }, item()],
});
/** A sentence of exactly `len` characters ending in a period. */
const sentence = (len: number) => "x".repeat(len - 1) + ".";

describe("seanceResultSchema", () => {
  it("accepts a valid result", () => {
    expect(ok(valid())).toBe(true);
  });

  describe("invalid fields are rejected", () => {
    it("voice with one sentence", () => {
      expect(ok(withField("voice", "Only one sentence."))).toBe(false);
    });
    it("voice with five sentences", () => {
      expect(ok(withField("voice", "A b. C d. E f. G h. I j."))).toBe(false);
    });
    it("causeOfDeath with two sentences", () => {
      expect(ok(withField("causeOfDeath", "It died. Quietly."))).toBe(false);
    });
    it("empty or blank causeOfDeath", () => {
      expect(ok(withField("causeOfDeath", ""))).toBe(false);
      expect(ok(withField("causeOfDeath", "   "))).toBe(false);
    });
    it("verdict outside the enum", () => {
      expect(ok(withField("verdict", "bury"))).toBe(false);
    });
    it("verdictReason empty", () => {
      expect(ok(withField("verdictReason", ""))).toBe(false);
    });
    it("verdictReason with a date", () => {
      expect(ok(withField("verdictReason", "It stalled on 2024-05-01."))).toBe(false);
    });
    it("too few or too many business items", () => {
      expect(ok(withField("unfinishedBusiness", [item()]))).toBe(false);
      expect(ok(withField("unfinishedBusiness", Array(6).fill(item())))).toBe(false);
      expect(ok(withField("unfinishedBusiness", Array(5).fill(item())))).toBe(true);
    });
    it("item title empty", () => {
      expect(ok(withItem("title", ""))).toBe(false);
    });
    it("item detail with a day count", () => {
      expect(ok(withItem("detail", "Untouched for 12 days."))).toBe(false);
    });
    it("item evidence too short", () => {
      expect(ok(withItem("evidence", "short"))).toBe(false);
    });
    it("wrong type for a field", () => {
      expect(ok(withField("voice", 42))).toBe(false);
    });
  });

  it("rejects an unknown top-level key", () => {
    expect(ok({ ...valid(), extra: "x" })).toBe(false);
  });

  it("rejects an unknown key inside a business item", () => {
    expect(ok(withItem("extra", "x"))).toBe(false);
  });

  it("rejects each missing top-level key", () => {
    for (const key of Object.keys(valid())) {
      const v: Record<string, unknown> = { ...valid() };
      delete v[key];
      expect(ok(v), key).toBe(false);
    }
  });

  it("rejects each missing item key", () => {
    for (const key of Object.keys(item())) {
      const bad: Record<string, unknown> = { ...item() };
      delete bad[key];
      expect(ok({ ...valid(), unfinishedBusiness: [bad, item()] }), key).toBe(false);
    }
  });

  describe("length limits", () => {
    it("voice: 600 accepted, 601 rejected", () => {
      const mk = (n: number) => `I wait. ${sentence(n - 8)}`;
      expect(mk(600)).toHaveLength(600);
      expect(ok(withField("voice", mk(600)))).toBe(true);
      expect(ok(withField("voice", mk(601)))).toBe(false);
    });
    it("causeOfDeath: 200 accepted, 201 rejected", () => {
      expect(ok(withField("causeOfDeath", sentence(200)))).toBe(true);
      expect(ok(withField("causeOfDeath", sentence(201)))).toBe(false);
    });
    it("verdictReason: 300 accepted, 301 rejected", () => {
      expect(ok(withField("verdictReason", "x".repeat(300)))).toBe(true);
      expect(ok(withField("verdictReason", "x".repeat(301)))).toBe(false);
    });
    it("item title: 80 accepted, 81 rejected", () => {
      expect(ok(withItem("title", "x".repeat(80)))).toBe(true);
      expect(ok(withItem("title", "x".repeat(81)))).toBe(false);
    });
    it("item detail: 300 accepted, 301 rejected", () => {
      expect(ok(withItem("detail", "x".repeat(300)))).toBe(true);
      expect(ok(withItem("detail", "x".repeat(301)))).toBe(false);
    });
    it("item evidence: 8 and 200 accepted, 7 and 201 rejected", () => {
      expect(ok(withItem("evidence", "x".repeat(8)))).toBe(true);
      expect(ok(withItem("evidence", "x".repeat(200)))).toBe(true);
      expect(ok(withItem("evidence", "x".repeat(7)))).toBe(false);
      expect(ok(withItem("evidence", "x".repeat(201)))).toBe(false);
    });
  });

  describe("dates and day counts", () => {
    const vr = (s: string) => ok(withField("verdictReason", s));

    it("accepts 'I may never wake.'", () => {
      expect(ok(withField("voice", "I wait here. I may never wake."))).toBe(true);
      expect(containsDateOrDayCount("I may never wake.")).toBe(false);
    });
    it("rejects 'I died on May 3.'", () => {
      expect(vr("I died on May 3.")).toBe(false);
    });
    it.each(["2024-05-01", "5/1/2024", "3 May", "March 2024", "12 days"])(
      "rejects %s",
      (s) => {
        expect(vr(`It stopped around ${s} I think.`)).toBe(false);
        expect(containsDateOrDayCount(s)).toBe(true);
      },
    );
    it("accepts 'march' and 'august' in ordinary sentences", () => {
      expect(vr("The tests march on without a maintainer.")).toBe(true);
      expect(vr("An august silence settled over the code.")).toBe(true);
      expect(vr("We march toward an august end.")).toBe(true);
    });
  });
});

describe("seanceRequestSchema", () => {
  it("accepts owner and repo", () => {
    expect(seanceRequestSchema.safeParse({ owner: "a", repo: "b" }).success).toBe(true);
  });

  it("strips unknown keys such as pushedAt", () => {
    const r = seanceRequestSchema.safeParse({
      owner: "a",
      repo: "b",
      pushedAt: "2020-01-01T00:00:00Z",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ owner: "a", repo: "b" });
  });

  it("enforces length limits", () => {
    const p = (owner: string, repo: string) =>
      seanceRequestSchema.safeParse({ owner, repo }).success;
    expect(p("o".repeat(39), "r")).toBe(true);
    expect(p("o".repeat(40), "r")).toBe(false);
    expect(p("o", "r".repeat(100))).toBe(true);
    expect(p("o", "r".repeat(101))).toBe(false);
    expect(p("", "r")).toBe(false);
    expect(p("o", "")).toBe(false);
  });
});
