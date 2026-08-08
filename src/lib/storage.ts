const HISTORY_KEY = "taskmind:history";
const TEMPLATES_KEY = "taskmind:templates";
const BOARD_KEY = "taskmind:board";
const THEME_KEY = "taskmind:theme";

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — degrade silently.
  }
}

export function storageKeys() {
  return {
    history: HISTORY_KEY,
    templates: TEMPLATES_KEY,
    board: BOARD_KEY,
    theme: THEME_KEY,
  };
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
