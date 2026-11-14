"use client";

/**
 * Deep-link controller for the detail panel's `?repo=` parameter (Req 8.1-8.7).
 *
 * Client-only History API manipulation: no Next router, no server re-render,
 * so `renderedAt`/rows stay frozen. The initial URL is read in a mount effect
 * (never during the first render) so hydration matches the server markup.
 */

import { useCallback, useEffect, useRef } from "react";

import { matchRepoParam, withRepoParam } from "@/lib/repoDetails/deepLink";

export interface UseRepoDeepLinkParams {
  /** Loaded rows; only `name` is used for case-insensitive matching. */
  rows: readonly { name: string }[];
  /** Whether the panel is currently open. */
  panelOpen: boolean;
  /** Open the panel for `name` (state only, no history). */
  onOpenState: (name: string) => void;
  /** Close the panel (state only, no history). */
  onCloseState: () => void;
  /**
   * Optional: called with the matched name when the panel is opened from the
   * URL (initial load, popstate), i.e. without a pointer activation. Not called
   * for in-page `open`.
   */
  onReveal?: (name: string) => void;
}

export interface RepoDeepLink {
  /** In-page open: pushes `?repo=<name>` (Req 8.1). */
  open: (name: string) => void;
  /** In-page close: history.back() or replaceState strip (Req 8.3, 8.4). */
  close: () => void;
  /**
   * Call from the shared popstate listener (Req 8.5). Returns `true` when the
   * traversal was a panel open/close (only `?repo=` changed), so the caller
   * can leave the place view untouched.
   */
  handlePopState: () => boolean;
}

export function useRepoDeepLink({
  rows,
  panelOpen,
  onOpenState,
  onCloseState,
  onReveal,
}: UseRepoDeepLinkParams): RepoDeepLink {
  /** True when the current open pushed its own history entry. */
  const pushedRef = useRef(false);
  /** True between close()'s history.back() and its popstate. */
  const pendingBackRef = useRef(false);
  const openRef = useRef(panelOpen);
  const rowsRef = useRef(rows);
  const openStateRef = useRef(onOpenState);
  const closeStateRef = useRef(onCloseState);
  const revealRef = useRef(onReveal);

  useEffect(() => {
    revealRef.current = onReveal;
    openRef.current = panelOpen;
    rowsRef.current = rows;
    openStateRef.current = onOpenState;
    closeStateRef.current = onCloseState;
  });

  // Initial load: open a matching `?repo=` without pushing history (Req 8.2);
  // no match leaves everything closed (Req 8.7).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const param = new URLSearchParams(window.location.search).get("repo");
    const match = matchRepoParam(rowsRef.current, param);
    if (match !== null) {
      pushedRef.current = false;
      revealRef.current?.(match);
      openStateRef.current(match);
    }
    // Mount only.
  }, []);

  const open = useCallback((name: string): void => {
    if (typeof window === "undefined") return;
    const url = `${window.location.pathname}${withRepoParam(
      window.location.search,
      name,
    )}`;
    const state = {
      ...((window.history.state as Record<string, unknown> | null) ?? {}),
      repo: name,
    };
    window.history.pushState(state, "", url);
    pushedRef.current = true;
    openStateRef.current(name);
  }, []);

  const close = useCallback((): void => {
    closeStateRef.current();
    if (typeof window === "undefined") return;
    openRef.current = false;
    if (pushedRef.current) {
      pushedRef.current = false;
      pendingBackRef.current = true;
      window.history.back();
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has("repo")) {
      const state = {
        ...((window.history.state as Record<string, unknown> | null) ?? {}),
      };
      delete state.repo;
      window.history.replaceState(
        state,
        "",
        `${window.location.pathname}${withRepoParam(window.location.search, null)}`,
      );
    }
  }, []);

  const handlePopState = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    const param = new URLSearchParams(window.location.search).get("repo");
    const match = matchRepoParam(rowsRef.current, param);
    const wasOpen = openRef.current;
    if (pendingBackRef.current && match === null) {
      // The traversal our own close() requested; the panel is already closed.
      pendingBackRef.current = false;
      return true;
    }
    pendingBackRef.current = false;
    if (match !== null) {
      // Forward onto an entry that carries `?repo=`: reopen it.
      pushedRef.current = true;
      openRef.current = true;
      revealRef.current?.(match);
      openStateRef.current(match);
      return !wasOpen;
    }
    if (wasOpen) {
      // Back while open closes the panel (never a no-op, Req 8.5). The panel
      // is modal, so the entry behind it is the same place view.
      pushedRef.current = false;
      openRef.current = false;
      closeStateRef.current();
      return true;
    }
    return false;
  }, []);

  return { open, close, handlePopState };
}
