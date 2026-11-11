/** Result_Cap: bounds a tool result to RESULT_CAP UTF-8 bytes at line boundaries. */

export const RESULT_CAP = 12_288;
export const TRUNCATION_MARKER = "[result truncated]";

const encoder = new TextEncoder();

export function byteLength(s: string): number {
  return encoder.encode(s).length;
}

export function capResult(head: string[], body: string[]): string {
  const all = [...head, ...body];
  const full = all.join("\n");
  if (byteLength(full) <= RESULT_CAP) return full;

  const budget = RESULT_CAP - byteLength("\n" + TRUNCATION_MARKER);
  const kept: string[] = [];
  let used = 0;

  // Whole lines only, in order; stop at the first line that does not fit.
  // A head line that does not fit stops everything, so body lines are never kept after it.
  for (const line of all) {
    const cost = byteLength(line) + (kept.length > 0 ? 1 : 0);
    if (used + cost > budget) break;
    kept.push(line);
    used += cost;
  }

  if (kept.length === 0) {
    // Even the first line does not fit: longest code-point prefix that does.
    let prefix = "";
    let prefixBytes = 0;
    for (const ch of all[0] ?? "") {
      const n = byteLength(ch);
      if (prefixBytes + n > budget) break;
      prefix += ch;
      prefixBytes += n;
    }
    kept.push(prefix);
  }

  return kept.join("\n") + "\n" + TRUNCATION_MARKER;
}
