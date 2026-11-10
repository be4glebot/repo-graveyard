/**
 * Hover card content (Req 3.1-3.8, 12.4).
 *
 * Presentational and pure: positioning, portal and open/close state live in
 * HoverCardLayer. In non-interactive (keyboard-focus tooltip) mode it renders
 * no link and no focusable elements. Description is plain text (React text
 * child), never HTML.
 */

import type { LifecycleState } from "@/lib/lifecycle";
import type { RepoRow } from "@/lib/repoRow";
import { decayWord } from "@/lib/repoDetails/decayWord";
import { buildGitHubUrl } from "@/lib/repoDetails/githubUrl";
import { quietPhrase } from "@/lib/repoDetails/quietPhrase";
import ExternalLink from "./ExternalLink";

/** Single fixed fallback for languages with no defined color. */
const FALLBACK_LANGUAGE_COLOR = "var(--color-scene-fg-faint)";

export interface HoverCardProps {
  row: RepoRow | undefined;
  owner: string;
  classification: { state: LifecycleState; decayLevel: number | null };
  renderedAt: string;
  isFixture: boolean;
  interactive: boolean;
}

export default function HoverCard({
  row,
  owner,
  classification,
  renderedAt,
  isFixture,
  interactive,
}: HoverCardProps) {
  if (!row) return null;

  const description =
    row.description !== null && row.description.trim() !== ""
      ? row.description
      : null;
  const language = row.primaryLanguage;
  const stars = Math.max(0, Math.trunc(row.stargazerCount) || 0);

  return (
    <div className="w-72 rounded-[3px] border border-iron-border bg-gradient-to-b from-plaque-bg-top to-plaque-bg-bottom p-3 text-plaque-name shadow-[inset_0_1px_0_var(--color-iron-inset),0_6px_18px_var(--color-iron-shadow)]">
      <p className="truncate font-heading text-sm font-bold tracking-wide text-iron-label">
        {row.name}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-plaque-sub">
        {decayWord(classification.state, classification.decayLevel)} ·{" "}
        {quietPhrase(
          { pushedAt: row.pushedAt, createdAt: row.createdAt },
          renderedAt,
        )}
      </p>
      <p className="mt-2 line-clamp-2 text-xs leading-snug text-plaque-name">
        {description ?? "No epitaph was written."}
      </p>
      <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-plaque-sub">
        {language && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              data-testid="language-dot"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: language.color ?? FALLBACK_LANGUAGE_COLOR }}
            />
            {language.name}
          </span>
        )}
        <span>★ {stars}</span>
      </div>
      {isFixture ? (
        <p className="mt-2 font-mono text-[11px] italic text-plaque-sub">
          Sample repository
        </p>
      ) : interactive ? (
        <p className="mt-2 text-xs text-iron-label">
          <ExternalLink href={buildGitHubUrl(owner, row.name)}>
            Open on GitHub
          </ExternalLink>
        </p>
      ) : null}
    </div>
  );
}
