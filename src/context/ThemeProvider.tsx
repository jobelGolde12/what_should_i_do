"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ThemePreference } from "@/lib/types";
import { readStorage, writeStorage, storageKeys } from "@/lib/storage";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");

  useEffect(() => {
    // Read the stored preference after hydration so the SSR markup (no
    // data-theme attribute) matches before we mutate the document element.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(
      readStorage<ThemePreference>(storageKeys().theme, "system")
    );
  }, []);

  useEffect(() => {
    writeStorage(storageKeys().theme, theme);
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
