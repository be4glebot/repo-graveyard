/**
 * Feature: repo-details-hover-panel, Property 1: GitHub URL origin is always github.com
 *
 * For any owner and repository name (including scheme-like prefixes, slashes,
 * whitespace, unicode, lone surrogates, or percent-encoded characters),
 * `buildGitHubUrl` returns a URL whose parsed origin is exactly
 * `https://github.com` and whose scheme is exactly `https`.
 *
 * **Validates: Requirements 9.1, 11.6, 11.8**
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import { buildGitHubUrl } from "@/lib/repoDetails/githubUrl";

const adversarialLiterals = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox",
  "file:///etc/passwd",
  "//evil.com",
  "https://evil.com",
  "..",
  "../..",
  "/",
  "\\",
  "@evil.com",
  "evil.com#",
  "?x=1",
  "#frag",
  "%2e%2e%2f",
  "%00",
  "%",
  " ",
  "\t\n\r",
  "\u0000",
  "\uD800", // lone high surrogate
  "\uDC00", // lone low surrogate
  "日本語",
  "😀",
  "",
];

const arbSegment = fc.oneof(
  fc.constantFrom(...adversarialLiterals),
  fc.string({ unit: "binary" }),
  fc.string(),
  fc.constantFrom("javascript:", "data:", "https://", "//", "../", "%2F", "@").chain((prefix) =>
    fc.string({ unit: "binary" }).map((s) => prefix + s),
  ),
);

describe("Feature: repo-details-hover-panel, Property 1: GitHub URL origin is always github.com", () => {
  it("parsed origin is exactly https://github.com and scheme is https for any owner/name", () => {
    fc.assert(
      fc.property(arbSegment, arbSegment, (owner, name) => {
        const raw = buildGitHubUrl(owner, name);
        const url = new URL(raw);
        return (
          url.origin === "https://github.com" &&
          url.protocol === "https:" &&
          url.username === "" &&
          url.password === "" &&
          raw.startsWith("https://github.com/")
        );
      }),
      { numRuns: 200 },
    );
  });
});
