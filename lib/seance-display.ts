/**
 * Display-only helpers for the séance. Pure; no I/O.
 *
 * `displayEvidence` tidies an evidence string for the ledger: edge punctuation
 * and unbalanced brackets are trimmed (models and READMEs hand us fragments
 * such as `, the redirect loops (see` or `"wired up yet.`), and the result is
 * wrapped in quotation marks. Grounding never sees this text; it is only what
 * the visitor reads.
 */

const EDGE_RE = /^[\s.,;:!?'"“”‘’`*_#\-–—…/\\|~]+|[\s.,;:!?'"“”‘’`*_#\-–—…/\\|~]+$/gu;
const OPENERS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const CLOSERS = new Set([")", "]", "}"]);

function trimEdges(s: string): string {
  return s.replace(EDGE_RE, "");
}

/** Removes every bracket that has no matching partner (wrong type counts as unmatched). */
export function removeUnbalancedBrackets(s: string): string {
  const stack: { ch: string; i: number }[] = [];
  const drop = new Set<number>();
  const chars = Array.from(s);
  chars.forEach((ch, i) => {
    if (ch in OPENERS) {
      stack.push({ ch, i });
    } else if (CLOSERS.has(ch)) {
      const top = stack[stack.length - 1];
      if (top && OPENERS[top.ch] === ch) stack.pop();
      else drop.add(i);
    }
  });
  for (const open of stack) drop.add(open.i);
  return chars.filter((_, i) => !drop.has(i)).join("");
}

/** The quote shown under a ledger item: trimmed, balanced and in “quotation marks”. */
export function displayEvidence(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const cleaned = trimEdges(removeUnbalancedBrackets(trimEdges(collapsed)));
  return `“${cleaned === "" ? collapsed : cleaned}”`;
}