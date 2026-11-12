// Pure snippet builder for the badge dialogs. No I/O, no server-only,
// no React or Next imports.

import { escapeXml, type BadgeStyle } from "./badge";

export type BadgeTarget =
  | { kind: "owner"; owner: string }
  | { kind: "repo"; owner: string; repo: string };

export interface BadgeSnippets {
  /** SITE/api/badge/OWNER[/REPO][?style=flat] */
  imageUrl: string;
  /** Same path as imageUrl, relative, so previews work on any deploy. */
  previewUrl: string;
  /** SITE/g/OWNER[/REPO]; never carries ?style. */
  linkUrl: string;
  /** [![Repo Graveyard](imageUrl)](linkUrl) */
  markdown: string;
  /** <a href="linkUrl"><img src="imageUrl" alt="Repo Graveyard"></a> */
  html: string;
}

const ALT_TEXT = "Repo Graveyard";

/**
 * encodeURIComponent plus percent-encoding of `! ' ( ) *`, so one input is
 * always one path segment and a Markdown URL never contains `)`.
 */
export function encodeSegment(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"),
  );
}

export function buildBadgeSnippets(
  site: string,
  target: BadgeTarget,
  style: BadgeStyle,
): BadgeSnippets {
  const segments =
    target.kind === "owner"
      ? encodeSegment(target.owner)
      : `${encodeSegment(target.owner)}/${encodeSegment(target.repo)}`;
  const query = style === "flat" ? "?style=flat" : "";

  const previewUrl = `/api/badge/${segments}${query}`;
  const imageUrl = `${site}${previewUrl}`;
  const linkUrl = `${site}/g/${segments}`;

  const markdown = `[![${ALT_TEXT}](${imageUrl})](${linkUrl})`;
  const html = `<a href="${escapeXml(linkUrl)}"><img src="${escapeXml(imageUrl)}" alt="${ALT_TEXT}"></a>`;

  return { imageUrl, previewUrl, linkUrl, markdown, html };
}
