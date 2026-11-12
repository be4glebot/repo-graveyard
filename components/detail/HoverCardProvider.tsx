"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const DWELL_MS = 250;
export const CLOSE_GRACE_MS = 150;
/** How long the "suppress reopen on focus-return" flag lives if unconsumed. */
const FOCUS_RETURN_WINDOW_MS = 500;

export type HoverTrigger = "pointer" | "focus";

export interface HoverCardState {
  openFor: string | null;
  trigger: HoverTrigger | null;
  /** Element the card anchors to (plaque/creature); null when closed. */
  anchor: HTMLElement | null;
}

export interface HoverCardActions {
  onPointerEnter: (name: string, anchorEl: HTMLElement) => void;
  onPointerLeave: (name: string) => void;
  onFocus: (name: string, anchorEl: HTMLElement) => void;
  onBlur: (name: string) => void;
  /** Pointer entered the card itself: cancel the pending close. */
  onCardPointerEnter: () => void;
  /** Pointer left the card itself: start the close grace. */
  onCardPointerLeave: () => void;
  closeNow: () => void;
  /** True while the detail panel is open or a travel transition runs. */
  setSuppressed: (suppressed: boolean) => void;
  /** Call when the panel closes so the focus-return does not reopen a card. */
  suppressNextFocusOpen: () => void;
}

const CLOSED: HoverCardState = { openFor: null, trigger: null, anchor: null };

const StateContext = createContext<HoverCardState>(CLOSED);
const ActionsContext = createContext<HoverCardActions | null>(null);

/** Open-state subscription. Only the card layer should use this. */
export function useHoverCardState(): HoverCardState {
  return useContext(StateContext);
}

/** Stable callbacks. Safe for creatures: never changes identity. */
export function useHoverCardActions(): HoverCardActions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useHoverCardActions must be used within HoverCardProvider");
  return ctx;
}

/** Like `useHoverCardActions`, but returns null outside a provider. */
export function useOptionalHoverCardActions(): HoverCardActions | null {
  return useContext(ActionsContext);
}

export function HoverCardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HoverCardState>(CLOSED);

  const openForRef = useRef<string | null>(null);
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressedRef = useRef(false);
  const suppressFocusOpenRef = useRef(false);
  // Read once on first use (lazily, client only).
  const pointerCapableRef = useRef<boolean | null>(null);

  const clearDwell = () => {
    if (dwellTimer.current !== null) {
      clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
  };
  const clearClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const actions = useMemo<HoverCardActions>(() => {
    const isPointerCapable = () => {
      if (pointerCapableRef.current === null) {
        pointerCapableRef.current =
          typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      }
      return pointerCapableRef.current;
    };

    const open = (name: string, trigger: HoverTrigger, anchor: HTMLElement) => {
      openForRef.current = name; // single-open: replaces any other card
      setState((prev) =>
        prev.openFor === name && prev.trigger === trigger && prev.anchor === anchor
          ? prev
          : { openFor: name, trigger, anchor },
      );
    };

    const closeNow = () => {
      clearDwell();
      clearClose();
      openForRef.current = null;
      setState((prev) => (prev.openFor === null ? prev : CLOSED));
    };

    const scheduleClose = () => {
      clearClose();
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        closeNow();
      }, CLOSE_GRACE_MS);
    };

    return {
      onPointerEnter(name, anchorEl) {
        if (!isPointerCapable() || suppressedRef.current) return;
        clearClose();
        clearDwell();
        if (openForRef.current === name) return;
        dwellTimer.current = setTimeout(() => {
          dwellTimer.current = null;
          if (suppressedRef.current) return;
          open(name, "pointer", anchorEl);
        }, DWELL_MS);
      },
      onPointerLeave(name) {
        clearDwell();
        if (openForRef.current === name) scheduleClose();
      },
      onFocus(name, anchorEl) {
        if (suppressFocusOpenRef.current) {
          suppressFocusOpenRef.current = false;
          if (focusReturnTimer.current !== null) {
            clearTimeout(focusReturnTimer.current);
            focusReturnTimer.current = null;
          }
          return;
        }
        if (suppressedRef.current) return;
        clearDwell();
        clearClose();
        open(name, "focus", anchorEl);
      },
      onBlur(name) {
        clearDwell();
        if (openForRef.current === name) closeNow();
      },
      onCardPointerEnter() {
        clearClose();
      },
      onCardPointerLeave() {
        if (openForRef.current !== null) scheduleClose();
      },
      closeNow,
      setSuppressed(suppressed) {
        suppressedRef.current = suppressed;
        if (suppressed) closeNow();
      },
      suppressNextFocusOpen() {
        suppressFocusOpenRef.current = true;
        if (focusReturnTimer.current !== null) clearTimeout(focusReturnTimer.current);
        focusReturnTimer.current = setTimeout(() => {
          focusReturnTimer.current = null;
          suppressFocusOpenRef.current = false;
        }, FOCUS_RETURN_WINDOW_MS);
      },
    };
  }, []);

  useEffect(
    () => () => {
      if (dwellTimer.current !== null) clearTimeout(dwellTimer.current);
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
      if (focusReturnTimer.current !== null) clearTimeout(focusReturnTimer.current);
    },
    [],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}
