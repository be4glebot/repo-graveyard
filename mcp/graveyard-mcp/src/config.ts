export type BaseUrlResult =
  | { ok: true; baseUrl: string }
  | { ok: false; line: string };

const DEFAULT_BASE_URL = "http://localhost:3000";
const ERROR_LINE = "GRAVEYARD_URL must be a valid http or https URL.";

/** raw is process.env.GRAVEYARD_URL */
export function parseBaseUrl(raw: string | undefined): BaseUrlResult {
  if (raw === undefined || raw === "") {
    return { ok: true, baseUrl: DEFAULT_BASE_URL };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, line: ERROR_LINE };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, line: ERROR_LINE };
  }
  const path = url.pathname.replace(/\/+$/, "");
  return { ok: true, baseUrl: url.origin + path };
}
