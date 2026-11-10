import { describe, expect, it } from "vitest";
import { matchRepoParam, withRepoParam } from "@/lib/repoDetails/deepLink";

describe("matchRepoParam", () => {
  const rows = [{ name: "Alpha" }, { name: "beta-repo" }];

  it("matches case-insensitively and returns the canonical name", () => {
    expect(matchRepoParam(rows, "alpha")).toBe("Alpha");
    expect(matchRepoParam(rows, "BETA-REPO")).toBe("beta-repo");
  });

  it("returns null on a miss, null, or empty param", () => {
    expect(matchRepoParam(rows, "gamma")).toBeNull();
    expect(matchRepoParam(rows, null)).toBeNull();
    expect(matchRepoParam(rows, "")).toBeNull();
    expect(matchRepoParam([], "alpha")).toBeNull();
  });
});

describe("withRepoParam", () => {
  const parse = (s: string) => new URLSearchParams(s);

  it("sets repo on an empty search", () => {
    expect(withRepoParam("", "foo")).toBe("?repo=foo");
  });

  it("sets repo preserving at when at comes first", () => {
    const p = parse(withRepoParam("?at=gate", "foo"));
    expect(p.get("at")).toBe("gate");
    expect(p.get("repo")).toBe("foo");
  });

  it("replaces an existing repo preserving at when repo comes first", () => {
    const out = withRepoParam("?repo=old&at=crypt", "new");
    const p = parse(out);
    expect(p.getAll("repo")).toEqual(["new"]);
    expect(p.get("at")).toBe("crypt");
  });

  it("removes repo preserving at in either ordering", () => {
    expect(withRepoParam("?at=gate&repo=foo", null)).toBe("?at=gate");
    expect(withRepoParam("?repo=foo&at=gate", null)).toBe("?at=gate");
  });

  it("returns an empty string when removing the only param", () => {
    expect(withRepoParam("?repo=foo", null)).toBe("");
    expect(withRepoParam("", null)).toBe("");
  });

  it("accepts search without a leading ?", () => {
    expect(parse(withRepoParam("at=sky", "x")).get("at")).toBe("sky");
  });

  it("round-trips names needing encoding", () => {
    const out = withRepoParam("?at=sky", "a b&c");
    expect(parse(out).get("repo")).toBe("a b&c");
  });
});
