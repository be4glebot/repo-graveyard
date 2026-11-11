import { sanitiseInline } from "@/lib/revive-brief";

export const OWNER_PATTERN_TEXT =
  "1-39 letters, digits or single hyphens, not starting or ending with a hyphen";
export const REPO_PATTERN_TEXT = "1-100 letters, digits, '.', '_' or '-', and not '.' or '..'";

const OWNER_RE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const REPO_RE = /^[A-Za-z0-9._-]+$/;
const ECHO_MAX = 40;

export function isValidOwner(v: unknown): v is string {
  return typeof v === "string" && v.length <= 39 && OWNER_RE.test(v);
}

export function isValidRepo(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length >= 1 &&
    v.length <= 100 &&
    v !== "." &&
    v !== ".." &&
    REPO_RE.test(v)
  );
}

export type ArgCheck = { ok: true; owner: string; repo?: string } | { ok: false; text: string };

function invalid(name: "owner" | "repo", value: unknown, pattern: string): ArgCheck {
  let text = `Invalid argument "${name}": expected ${pattern}.`;
  if (typeof value === "string") {
    const echo = Array.from(value).slice(0, ECHO_MAX).join("");
    text += ` Got: ${sanitiseInline(echo)}`;
  }
  return { ok: false, text };
}

export function checkArgs(args: unknown, needsRepo: boolean): ArgCheck {
  const rec: Record<string, unknown> =
    typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {};
  const owner = rec.owner;
  if (!isValidOwner(owner)) return invalid("owner", owner, OWNER_PATTERN_TEXT);
  if (!needsRepo) return { ok: true, owner };
  const repo = rec.repo;
  if (!isValidRepo(repo)) return invalid("repo", repo, REPO_PATTERN_TEXT);
  return { ok: true, owner, repo };
}
