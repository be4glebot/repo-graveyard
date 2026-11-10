/**
 * Shared external link (Req 9.4, 9.5).
 *
 * Opens in a new tab with `rel="noopener noreferrer"`, shows a trailing "↗"
 * marker, and announces "(opens in a new tab)" to assistive tech through a
 * visually hidden span. Children are rendered as React text nodes, never via
 * `dangerouslySetInnerHTML`, so HTML-significant characters display literally.
 */

import type { ReactNode } from "react";

export interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export default function ExternalLink({
  href,
  children,
  className,
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "cursor-pointer underline-offset-2 hover:underline",
        "outline-none focus-visible:ring-2 focus-visible:ring-candle-400",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
