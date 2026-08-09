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
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setThemeState(readStoredTheme());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    setSystemPrefersDark(media.matches);
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
    if (!hydrated) return;
    writeStoredTheme(theme);
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [theme, resolvedTheme, hydrated]);

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
