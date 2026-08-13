"use client";

/**
 * Mounts the Pro sync engine. It pulls on login/window-focus (throttled),
 * pushes debounced deltas after local edits, retries while offline, and merges
 * server changes with last-write-wins. Local-first: sync failures never block
 * the UI — dirty records stay queued in `src/lib/sync.ts` meta.
 */
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTask } from "@/context/TaskContext";
import { useTheme } from "@/context/ThemeProvider";
import { usePlan } from "@/lib/pro/usePlan";
import type { ThemePreference } from "@/lib/types";
import {
  type SyncCollections,
  type SyncMeta,
  loadSyncMeta,
  saveSyncMeta,
  trackCollections,
  dirtyChanges,
  allChanges,
  mergeSyncChanges,
  maxChangeTime,
  pulledTheme,
} from "@/lib/sync";
import { toast } from "@/lib/toast";

const PUSH_DEBOUNCE_MS = 2000;
const FOCUS_THROTTLE_MS = 5000;
const SYNC_NOW_EVENT = "taskmind:sync-now";

const THEME_VALUES: ThemePreference[] = ["light", "dark", "system"];

function asTheme(value: string): ThemePreference | null {
  return THEME_VALUES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : null;
}

function contentDiffers(a: SyncCollections, b: SyncCollections): boolean {
  return (
    a.history.length !== b.history.length ||
    a.templates.length !== b.templates.length ||
    a.board.length !== b.board.length ||
    JSON.stringify(a.history) !== JSON.stringify(b.history) ||
    JSON.stringify(a.templates) !== JSON.stringify(b.templates) ||
    JSON.stringify(a.board) !== JSON.stringify(b.board)
  );
}

function clearTombstones(meta: SyncMeta, advancedTo: number) {
  for (const col of ["history", "templates", "board"] as const) {
    for (const id of Object.keys(meta.deleted[col])) {
      if (meta.deleted[col][id] <= advancedTo) delete meta.deleted[col][id];
    }
  }
}

export function SyncEngine() {
  const { user, sync } = useAuth();
  const { isPro } = usePlan();
  const { history, templates, board, setAll } = useTask();
  const { theme, setTheme } = useTheme();

  const stateRef = useRef<SyncCollections>({ history: [], templates: [], board: [] });
  const prevRef = useRef<SyncCollections>({ history: [], templates: [], board: [] });
  const userRef = useRef(user);
  const isProRef = useRef(isPro);
  const themeRef = useRef(theme);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocusAt = useRef(0);
  const runPushRef = useRef<(force: boolean) => Promise<void>>(async () => {});
  const runPullRef = useRef<() => Promise<void>>(async () => {});

  // Latest-value refs (must be written in effects to satisfy react-hooks/refs).
  useEffect(() => {
    userRef.current = user;
    isProRef.current = isPro;
    themeRef.current = theme;
  }, [user, isPro, theme]);

  const schedulePush = useCallback(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void runPushRef.current(false);
    }, PUSH_DEBOUNCE_MS);
  }, []);

  // Keep a fresh snapshot of the collections for async handlers.
  useEffect(() => {
    stateRef.current = { history, templates, board };
  });

  // Diff local changes -> mark dirty -> debounced push.
  useEffect(() => {
    if (!user) return;
    const meta = loadSyncMeta();
    const changed = trackCollections(meta, prevRef.current, stateRef.current);
    prevRef.current = stateRef.current;
    if (changed > 0) {
      saveSyncMeta(meta);
      schedulePush();
    }
  }, [history, templates, board, user, schedulePush]);

  // Theme changes also schedule a push.
  useEffect(() => {
    if (!user) return;
    const meta = loadSyncMeta();
    if (meta.lastSyncedTheme !== theme) schedulePush();
  }, [theme, user, schedulePush]);

  async function runPush(force: boolean) {
    if (!userRef.current || !isProRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const meta0 = loadSyncMeta();
      const theme0 = themeRef.current;
      const changes = force
        ? allChanges(meta0, stateRef.current, theme0)
        : dirtyChanges(meta0, stateRef.current, theme0);
      if (changes.length === 0) return;

      const pushedTheme = changes.find(
        (c) => c.collection === "settings" && c.id === "theme"
      );
      const res = await sync({ since: meta0.lastSyncedAt, push: changes });

      const fresh = loadSyncMeta();
      const current = stateRef.current;
      const { next } = mergeSyncChanges(current, res.changes, fresh);
      const advancedTo = Math.max(fresh.lastSyncedAt, maxChangeTime(res.changes));

      const themePull = pulledTheme(fresh, res.changes);
      if (themePull) {
        const themeValue = asTheme(themePull.theme);
        if (themeValue) {
          fresh.lastSyncedTheme = themeValue;
          fresh.lastSyncedThemeAt = themePull.updatedAt;
          setTheme(themeValue);
        }
      } else if (pushedTheme && themeRef.current === theme0) {
        fresh.lastSyncedTheme = theme0;
        fresh.lastSyncedThemeAt = Math.max(
          fresh.lastSyncedThemeAt,
          pushedTheme.updatedAt
        );
      }

      const at = Date.now();
      fresh.lastSyncedAt = advancedTo;
      clearTombstones(fresh, advancedTo);
      fresh.lastSyncAt = at;
      fresh.lastSyncStatus = "ok";
      saveSyncMeta(fresh);

      prevRef.current = next;
      if (contentDiffers(current, next)) setAll(next);
    } catch {
      const fresh = loadSyncMeta();
      const at = Date.now();
      fresh.lastSyncAt = at;
      fresh.lastSyncStatus = "error";
      saveSyncMeta(fresh);
      toast(
        "Sync failed. Your changes are saved locally and will retry automatically.",
        "error"
      );
    }
  }

  async function runPull() {
    if (!userRef.current || !isProRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const meta0 = loadSyncMeta();
      const res = await sync({ since: meta0.lastSyncedAt, push: [] });

      const fresh = loadSyncMeta();
      const current = stateRef.current;
      const { next } = mergeSyncChanges(current, res.changes, fresh);
      const advancedTo = Math.max(fresh.lastSyncedAt, maxChangeTime(res.changes));

      const themePull = pulledTheme(fresh, res.changes);
      if (themePull) {
        const themeValue = asTheme(themePull.theme);
        if (themeValue) {
          fresh.lastSyncedTheme = themeValue;
          fresh.lastSyncedThemeAt = themePull.updatedAt;
          setTheme(themeValue);
        }
      }

      const at = Date.now();
      fresh.lastSyncedAt = advancedTo;
      clearTombstones(fresh, advancedTo);
      fresh.lastSyncAt = at;
      fresh.lastSyncStatus = "ok";
      saveSyncMeta(fresh);

      prevRef.current = next;
      if (contentDiffers(current, next)) setAll(next);
    } catch {
      const fresh = loadSyncMeta();
      const at = Date.now();
      fresh.lastSyncAt = at;
      fresh.lastSyncStatus = "error";
      saveSyncMeta(fresh);
    }
  }

  useEffect(() => {
    runPushRef.current = runPush;
    runPullRef.current = runPull;
  });

  // Pull once on login / Pro activation.
  useEffect(() => {
    if (user && isPro) {
      void runPullRef.current();
    }
  }, [user, user?.id, isPro]);

  // Pull on focus (throttled), flush queued changes on reconnect.
  useEffect(() => {
    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusAt.current < FOCUS_THROTTLE_MS) return;
      lastFocusAt.current = now;
      if (userRef.current && isProRef.current) {
        void runPullRef.current();
      }
    };
    const onOnline = () => {
      if (userRef.current && isProRef.current) {
        void runPushRef.current(true);
      }
    };
    const onSyncNow = () => {
      if (userRef.current && isProRef.current) {
        void runPushRef.current(true);
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener(SYNC_NOW_EVENT, onSyncNow);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SYNC_NOW_EVENT, onSyncNow);
    };
  }, []);

  return null;
}
