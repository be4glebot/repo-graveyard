/**
 * Builds the canonical GitHub URL for a repository (Req 9.1, 11.6, 11.8).
 *
 * The origin is a literal constant prefix and each segment is percent-encoded,
 * so no input can change the scheme or escape the github.com origin.
 * Pure + total: never throws.
 */
const GITHUB_ORIGIN = "https://github.com/";

/** Replace lone surrogates with U+FFFD; encodeURIComponent throws on them. */
function wellFormed(s: string): string {
  return s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    "\uFFFD",
  );
}

function encodeSegment(segment: string): string {
  return encodeURIComponent(wellFormed(String(segment)));
}

export function buildGitHubUrl(owner: string, name: string): string {
  return GITHUB_ORIGIN + encodeSegment(owner) + "/" + encodeSegment(name);
}
