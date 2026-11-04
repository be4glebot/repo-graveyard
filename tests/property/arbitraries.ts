/**
 * Shared fast-check generators for the repo-lifecycle-classification property
 * tests. Per the tasks.md Notes, all shared generators live here
 * (`arbIso`, `arbRepoFacts`, `arbOverride`, `arbUsername`).
 *
 * Generators deliberately mix valid inputs with boundary and near-miss inputs
 * so properties exercise the full input space, not just the happy path.
 */

import fc from "fast-check";

/** Characters that make up the valid GitHub username alphabet. */
const USERNAME_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-";

/**
 * A generator for username candidates. It produces a mix of:
 *  - genuinely valid usernames (length 1–39, [A-Za-z0-9-], no leading/trailing
 *    hyphen, single-char alphanumeric),
 *  - near-miss strings that a naive validator might accept or reject wrongly:
 *    leading hyphen, trailing hyphen, exactly 40 characters, the empty string,
 *    whitespace-containing strings, and unicode characters,
 *  - arbitrary free-form strings to cover the rest of the input space.
 *
 * The validator half of Property 1 relies on this covering both sides of every
 * boundary (length 0/1/39/40 and the hyphen edges).
 */
export const arbUsername: fc.Arbitrary<string> = fc.oneof(
  // Plausibly valid: body built from the allowed alphabet, length 1–39.
  fc
    .array(fc.constantFrom(...USERNAME_CHARS.split("")), {
      minLength: 1,
      maxLength: 39,
    })
    .map((chars) => chars.join("")),
  // Leading hyphen near-miss.
  fc
    .array(fc.constantFrom(...USERNAME_CHARS.split("")), {
      minLength: 0,
      maxLength: 38,
    })
    .map((chars) => "-" + chars.join("")),
  // Trailing hyphen near-miss.
  fc
    .array(fc.constantFrom(...USERNAME_CHARS.split("")), {
      minLength: 0,
      maxLength: 38,
    })
    .map((chars) => chars.join("") + "-"),
  // Exactly 40 characters (one over the max) from the valid alphabet.
  fc
    .array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("")), {
      minLength: 40,
      maxLength: 40,
    })
    .map((chars) => chars.join("")),
  // Empty string boundary.
  fc.constant(""),
  // Whitespace-containing strings.
  fc.constantFrom(" ", "a b", " ab", "ab ", "\tab", "a\nb", "   "),
  // Unicode characters.
  fc.constantFrom("café", "naïve", "你好", "emoji😀", "üser", "Ωmega"),
  // Free-form strings to cover everything else.
  fc.string(),
);

import { LIFECYCLE_CONFIG, type RepoFacts } from "@/lib/lifecycle";

/**
 * A generator for the nullable README byte size. It intentionally clusters
 * around the `readmeMinBytes` threshold so the ">" comparison is exercised on
 * both sides, and includes the two special unfinished-signal values (`null`
 * and `0`).
 */
const arbReadmeBytes: fc.Arbitrary<number | null> = fc.oneof(
  fc.constant(null),
  fc.constant(0),
  // At, just below, just above, and well above the threshold.
  fc.constantFrom(
    LIFECYCLE_CONFIG.readmeMinBytes - 1,
    LIFECYCLE_CONFIG.readmeMinBytes,
    LIFECYCLE_CONFIG.readmeMinBytes + 1,
    LIFECYCLE_CONFIG.readmeMinBytes * 4,
  ),
  fc.integer({ min: 1, max: 1_000_000 }),
);

/**
 * A generator for the homepage URL. Mixes `null`, the empty string,
 * whitespace-only strings (which trim to empty and therefore do NOT count as a
 * finished signal), and genuine non-empty URLs.
 */
const arbHomepageUrl: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.constant(""),
  fc.constantFrom(" ", "   ", "\t", "\n", " \t \n "),
  fc.constantFrom(
    "https://example.com",
    "example.org",
    "https://my-project.dev/docs",
  ),
  fc.string(),
);

/**
 * A generator for the open issue count, clustered around the `manyIssues`
 * threshold (the ">=" boundary) plus a broad range.
 */
const arbOpenIssueCount: fc.Arbitrary<number> = fc.oneof(
  fc.constantFrom(
    0,
    LIFECYCLE_CONFIG.manyIssues - 1,
    LIFECYCLE_CONFIG.manyIssues,
    LIFECYCLE_CONFIG.manyIssues + 1,
  ),
  fc.integer({ min: 0, max: 500 }),
);

/** A generator for the release count, covering 0 and >= 1. */
const arbReleaseCount: fc.Arbitrary<number> = fc.oneof(
  fc.constantFrom(0, 1, 2),
  fc.integer({ min: 0, max: 50 }),
);

/**
 * A generator for the last commit message. The finished/unfinished keyword
 * detection rule is "first line only, case-insensitive", so this generator is
 * built to exercise that rule from every angle:
 *  - `null` and empty messages,
 *  - plain messages with no keywords,
 *  - keywords placed on the FIRST line (should count), in varied casing,
 *  - keywords placed only on NON-first lines (must NOT count),
 *  - multi-line messages mixing both, using "\n" and "\r\n" separators.
 */
const arbCommitMessage: fc.Arbitrary<string | null> = (() => {
  const finishedWords = LIFECYCLE_CONFIG.finishedCommitKeywords;
  const unfinishedWords = LIFECYCLE_CONFIG.unfinishedCommitKeywords;
  const allKeywords = [...finishedWords, ...unfinishedWords];

  // Recase a keyword (lower, upper, or title-ish) to exercise case-insensitivity.
  const recase = (word: string): fc.Arbitrary<string> =>
    fc.constantFrom(
      word,
      word.toUpperCase(),
      word.charAt(0).toUpperCase() + word.slice(1),
    );

  return fc.oneof(
    // No message at all.
    fc.constant(null),
    // Empty / whitespace-only subject.
    fc.constantFrom("", "   ", "\n", "\r\n"),
    // Plain messages with no keyword anywhere.
    fc.constantFrom(
      "update readme",
      "refactor module",
      "merge branch main",
      "bump dependencies",
    ),
    // A keyword on the FIRST line (should be detected), varied casing and
    // surrounding text.
    fc
      .tuple(fc.constantFrom(...allKeywords), fc.constantFrom("", " more work", ": details"))
      .chain(([word, suffix]) => recase(word).map((cased) => cased + suffix)),
    // A keyword embedded mid-subject on the first line.
    fc
      .constantFrom(...allKeywords)
      .chain((word) => recase(word).map((cased) => `chore(${cased}) tidy up`)),
    // Keyword(s) ONLY on non-first lines; first line is keyword-free. This must
    // NOT register as a signal.
    fc
      .tuple(fc.constantFrom(...allKeywords), fc.constantFrom("\n", "\r\n"))
      .chain(([word, sep]) =>
        recase(word).map((cased) => `clean subject line${sep}body mentions ${cased} here`),
      ),
    // Multi-line mixing a first-line keyword with a different keyword in the
    // body.
    fc
      .tuple(
        fc.constantFrom(...finishedWords),
        fc.constantFrom(...unfinishedWords),
        fc.constantFrom("\n", "\r\n"),
      )
      .chain(([fin, unf, sep]) =>
        fc
          .tuple(recase(fin), recase(unf))
          .map(([f, u]) => `${f} the feature${sep}still ${u} in places`),
      ),
    // Arbitrary free-form strings to cover the rest of the space.
    fc.string(),
  );
})();

/**
 * A generator for the stargazer count, clustered around the `popularStars`
 * threshold (the ">=" boundary that drives the popular finished signal and the
 * many-issues suppression) plus a broad range.
 */
const arbStargazerCount: fc.Arbitrary<number> = fc.oneof(
  fc.constantFrom(
    0,
    LIFECYCLE_CONFIG.popularStars - 1,
    LIFECYCLE_CONFIG.popularStars,
    LIFECYCLE_CONFIG.popularStars + 1,
  ),
  fc.integer({ min: 0, max: 100_000 }),
);

/**
 * A generator for `RepoFacts` tuned for finished-signal property testing. It
 * focuses variation on the five fields that drive `countSignals`
 * (`releaseCount`, `homepageUrl`, `readmeBytes`, `lastCommitMessage`,
 * `openIssueCount`) while supplying stable, valid values for the remaining
 * classification-irrelevant fields.
 */
export const arbRepoFacts: fc.Arbitrary<RepoFacts> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 40 }),
  description: fc.oneof(fc.constant(null), fc.string()),
  url: fc.constant("https://github.com/owner/repo"),
  pushedAt: fc.oneof(fc.constant(null), fc.constant("2023-01-01T00:00:00.000Z")),
  createdAt: fc.constant("2020-01-01T00:00:00.000Z"),
  isArchived: fc.boolean(),
  isFork: fc.boolean(),
  homepageUrl: arbHomepageUrl,
  stargazerCount: arbStargazerCount,
  primaryLanguage: fc.oneof(fc.constant(null), fc.constantFrom("TypeScript", "Go", "Rust")),
  openIssueCount: arbOpenIssueCount,
  releaseCount: arbReleaseCount,
  readmeBytes: arbReadmeBytes,
  lastCommitMessage: arbCommitMessage,
});

import { type Override, type OverrideType } from "@/lib/lifecycle";

/** The three override intents, matching `OverrideType` from lifecycle. */
const OVERRIDE_TYPES = ["finished", "scrapped", "revived"] as const satisfies readonly OverrideType[];

/**
 * A generator for ISO 8601 datetime strings. Mixes `fast-check`'s date
 * generator (converted to an ISO string) with a few fixed boundary timestamps
 * so round-trip equality is exercised across a broad span of values.
 */
export const arbIso: fc.Arbitrary<string> = fc.oneof(
  fc.date({ min: new Date("1970-01-01T00:00:00.000Z"), max: new Date("2100-01-01T00:00:00.000Z"), noInvalidDate: true }).map((d) => d.toISOString()),
  fc.constantFrom(
    "2020-01-01T00:00:00.000Z",
    "2023-06-15T12:34:56.000Z",
    "1999-12-31T23:59:59.000Z",
    "2100-01-01T00:00:00.000Z",
  ),
);

/**
 * A generator for `Override` values: a `type` drawn from the three intents and
 * a `setAt` ISO 8601 timestamp.
 */
export const arbOverride: fc.Arbitrary<Override> = fc.record({
  type: fc.constantFrom(...OVERRIDE_TYPES),
  setAt: arbIso,
});

/**
 * A generator for repo names. Deliberately draws from a SMALL pool of names so
 * that a sequence of writes frequently reuses a name, exercising the
 * "replace the existing entry" behavior (at most one entry per name).
 */
export const arbRepoName: fc.Arbitrary<string> = fc.constantFrom(
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
);
