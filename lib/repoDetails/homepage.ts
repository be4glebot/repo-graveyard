/**
 * Homepage link validation. Only exact `https:` URLs are accepted; anything
 * else (http, javascript:, data:, malformed, null) is rejected. Pure + total.
 */

function parseHttps(raw: string | null): URL | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function isValidHttpsHomepage(raw: string | null): boolean {
  return parseHttps(raw) !== null;
}

/** Host only (no scheme/path/query/fragment) when valid https, else null. */
export function homepageDomain(raw: string | null): string | null {
  const url = parseHttps(raw);
  if (url === null || url.host === "") return null;
  return url.host;
}
