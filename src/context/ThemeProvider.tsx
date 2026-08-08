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
import { readStorage, writeStorage, storageKeys } from "@/lib/storage";

export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  resolvedTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

function resolve(pref: ThemePreference, dark: boolean): ResolvedTheme {
  return pref === "system" ? (dark ? "dark" : "light") : pref;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    // Read the stored preference after hydration. The head script has
    // already painted the correct theme, so there is no flash.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(
      readStorage<ThemePreference>(storageKeys().theme, "system")
    );
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemPrefersDark(media.matches);
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const resolvedTheme = useMemo(
    () => resolve(theme, systemPrefersDark),
    [theme, systemPrefersDark]
  );

  useEffect(() => {
    writeStorage(storageKeys().theme, theme);
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
  return useContext(ThemeContext);
}
