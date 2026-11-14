"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme-art";

type ThemeValue = { theme: Theme; setTheme: (theme: Theme) => void };

const FALLBACK: ThemeValue = { theme: "night", setTheme: () => {} };

const ThemeContext = createContext<ThemeValue | null>(null);

/** In-memory theme state only: no localStorage, cookie or URL param. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("night");
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Outside a provider: night with a no-op setter. */
export function useTheme(): ThemeValue {
  return useContext(ThemeContext) ?? FALLBACK;
}
