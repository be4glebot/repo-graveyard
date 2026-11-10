/**
 * Pure deep-link helpers for the `?repo=` query parameter.
 * Both functions are total: they never throw and read no globals.
 */

/**
 * Returns the loaded repo's name whose `name` equals `param`
 * case-insensitively, else null. The returned value is the loaded
 * repo's canonical name (not the param's casing).
 */
export function matchRepoParam(
  rows: readonly { name: string }[],
  param: string | null,
): string | null {
  if (typeof param !== "string" || param === "") return null;
  const wanted = param.toLowerCase();
  for (const row of rows) {
    if (row.name.toLowerCase() === wanted) return row.name;
  }
  return null;
}

/**
 * Returns a search string (with leading "?", or "" when empty) with `repo`
 * set to the given name, or removed when `repo` is null/empty. All other
 * parameters, including `at`, are preserved. Accepts input with or
 * without a leading "?".
 */
export function withRepoParam(search: string, repo: string | null): string {
  const params = new URLSearchParams(
    typeof search === "string" ? search : "",
  );
  if (repo === null || repo === "") {
    params.delete("repo");
  } else {
    params.set("repo", repo);
  }
  const out = params.toString();
  return out === "" ? "" : `?${out}`;
}
