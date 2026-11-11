// Feature: revive-in-kiro, Property 6: Names cannot break the link, and the clone command is inert
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildCloneCommand, buildReviveBrief } from "@/lib/revive-brief";
import { facts, hostileResult } from "./revive-arbitraries";

const CLONE_PREFIX = "git clone ";

// [<text>](<url>) where text has no unescaped bracket or parenthesis and the
// URL has only unreserved or percent-encoded characters.
const LINK_LINE =
  /^Repository: \[((?:\\.|[^\\[\]()])*)\]\((https:\/\/github\.com\/[A-Za-z0-9._%-]+\/[A-Za-z0-9._%-]+)\)$/u;

describe("Property 6: names cannot break the link, and the clone command is inert", () => {
  /**
   * **Validates: Requirements 3.8, 6.9**
   */
  it("keeps the repository link well-formed for any owner and repo", () => {
    fc.assert(
      fc.property(hostileResult, facts, (result, f) => {
        const brief = buildReviveBrief(result, f);
        const lines = brief.split("\n");
        const linkLines = lines.filter((l) => l.startsWith("Repository: "));
        expect(linkLines).toHaveLength(1);
        // The "(unknown)" placeholder for an empty name is a fixed, balanced
        // literal, not name content, so mask it before checking for brackets.
        const masked = linkLines[0].replace(/^(Repository: \[)\(unknown\)/u, "$1U").replace(/\/\(unknown\)\]\(/u, "/U](");
        expect(masked).toMatch(LINK_LINE);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.8, 6.9**
   */
  it("produces a clone command with no whitespace or shell metacharacters", () => {
    fc.assert(
      fc.property(facts, (f) => {
        const cmd = buildCloneCommand(f);
        expect(cmd.startsWith(CLONE_PREFIX)).toBe(true);
        const rest = cmd.slice(CLONE_PREFIX.length);
        expect(rest).toMatch(/^https:\/\/github\.com\/[A-Za-z0-9._%-]+\/[A-Za-z0-9._%-]+\.git$/u);
        expect(rest).not.toMatch(/[\s;$`'"\\&|<>(){}*?!~#]/u);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.8, 6.9**
   */
  it("equals the plain git clone URL for names made only of A-Za-z0-9._-", () => {
    const plain = fc.stringMatching(/^[A-Za-z0-9._-]{1,60}$/u).filter((s) => s !== "." && s !== "..");
    fc.assert(
      fc.property(plain, plain, (owner, repo) => {
        expect(buildCloneCommand({ owner, repo })).toBe(
          `git clone https://github.com/${owner}/${repo}.git`,
        );
      }),
      { numRuns: 100 },
    );
  });
});
