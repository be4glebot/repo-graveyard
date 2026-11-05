"use client";

/**
 * "+N more" overflow affordance for a zone (client component).
 *
 * A zone renders at most `ZONE_CAP` (12) creatures individually; everything
 * past the cap rolls up into this one clustered token (Req 11.3/11.4). The
 * token is an interactive `<button>`: activating it opens a scrollable list of
 * the remaining repositories, one entry per name, and activating it again
 * collapses back to the "+N more" summary while the zone stays within its
 * bounds (Req 11.4/11.5).
 *
 * Why a client component: it owns the expand/collapse state and keyboard /
 * pointer interaction, so it cannot be a server component.
 *
 * All color comes from theme tokens (`--color-*`) and all type from the scene
 * font tokens — no hardcoded hex. The surviving-repo names are passed in by the
 * Zone (the overflow slice beyond the cap); this component never recomputes the
 * cap itself.
 *
 * Requirements: 11.4, 11.5
 */

import { useCallback, useId, useState, type CSSProperties } from "react";

export interface MoreGroupProps {
  /**
   * Number of overflow creatures summarized by this group. Rendered as the
   * "+N more" count; always the length of `names` but passed explicitly so the
   * Zone's `capZone(...).more` value is the single source of truth.
   */
  more: number;
  /** Repository names of the overflow creatures, one entry per remaining repo. */
  names: string[];
  /** Absolute placement supplied by the Zone (percentage left/top within the rect). */
  style?: CSSProperties;
}

/**
 * Clustered "+N more" token. Collapsed, it is a single focusable button; when
 * activated it reveals a scrollable list of the remaining repository names and
 * toggles back to the summary on a second activation (Req 11.4/11.5). The list
 * is positioned absolutely so it never pushes the zone's other creatures out of
 * their bounds — the summary token keeps its place and the panel floats above
 * it.
 */
export default function MoreGroup({ more, names, style }: MoreGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  const toggle = useCallback(() => {
    setExpanded((open) => !open);
  }, []);

  // Nothing to summarize → render nothing. The Zone already gates on
  // `more > 0`, but this keeps the component honest in isolation.
  if (more <= 0) {
    return null;
  }

  return (
    <div className="absolute" style={style} data-testid="scene-more-group">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-label={`${more} more buried here`}
        className={[
          "inline-flex items-center justify-center rounded-full px-3 py-1",
          "font-[family-name:var(--font-fact)] text-sm leading-none",
          "cursor-pointer border transition-[transform,filter] duration-200 ease-out",
          "motion-safe:hover:scale-105",
          "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-candle-400)]",
          "hover:drop-shadow-[0_0_10px_var(--color-candle-400)]",
        ].join(" ")}
        style={{
          // Warm "ink tag" token cluster — reads as a small gravestone marker.
          backgroundColor: "var(--color-ink-tag-bg)",
          color: "var(--color-ink-tag-fg)",
          borderColor: "var(--color-paper-border)",
        }}
      >
        +{more} more
      </button>

      {expanded ? (
        <ul
          id={listId}
          data-testid="scene-more-list"
          className={[
            "absolute left-0 top-full z-10 mt-2 max-h-48 w-48 overflow-y-auto",
            "rounded-md border p-1 shadow-lg",
            "font-[family-name:var(--font-fact)] text-xs",
          ].join(" ")}
          style={{
            backgroundColor: "var(--color-paper-100)",
            color: "var(--color-ink-900)",
            borderColor: "var(--color-paper-border)",
          }}
        >
          {names.map((name) => (
            <li
              key={name}
              className="truncate rounded px-2 py-1"
              title={name}
            >
              {name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
