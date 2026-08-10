"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { ThemePreference } from "@/lib/types";
import { storageKeys } from "@/lib/storage";

export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  resolvedTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(
  pref: ThemePreference,
  systemDark: boolean
): ResolvedTheme {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(storageKeys().theme);
    if (!raw) return "system";
    // Prefer raw preference strings; also accept legacy JSON-encoded values.
    const value = raw === '"light"' || raw === '"dark"' || raw === '"system"'
      ? (JSON.parse(raw) as string)
      : raw;
    return value === "light" || value === "dark" || value === "system"
      ? value
      : "system";
  } catch {
    return "system";
  }
}

function writeStoredTheme(theme: ThemePreference) {
  try {
    window.localStorage.setItem(storageKeys().theme, theme);
  } catch {
    /* storage unavailable */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy-initialize so React state matches the browser from the very first
  // client render (no effect-induced one-frame "light" on dark systems).
  // SSR falls back to "system"/false, which matches the default HTML.
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    readStoredTheme()
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    media.addEventListener("change", handleSystemThemeChange);
    return () => {
      media.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const resolvedTheme = useMemo(
    () => resolve(theme, systemPrefersDark),
    [theme, systemPrefersDark]
  );

  useEffect(() => {
    writeStoredTheme(theme);
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [theme, resolvedTheme]);

  const value = useMemo(
    () => ({ theme, setTheme: setThemeState, resolvedTheme }),
    [theme, resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
