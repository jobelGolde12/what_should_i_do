"use client";

/**
 * Central Data Cache Service — in-memory cache over localStorage with
 * deduplication, stale-while-revalidate, and mutation-driven invalidation.
 * Does not attach to window; consumed via React context / module singleton.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  AnalysisRecord,
  BoardItem,
  RouteKey,
  RouteParams,
  Template,
} from "@/lib/types";
import { readStorage, storageKeys } from "@/lib/storage";
import { isInstantNavEnabled } from "@/lib/features";

export type CacheKey = string;

type CacheEntry<T = unknown> = {
  data: T;
  updatedAt: number;
  dirty: boolean;
  error: Error | null;
};

type Listener = () => void;

const DEFAULT_TTL_MS = 30_000;

function buildKey(route: RouteKey | string, params?: RouteParams | null): CacheKey {
  const id = params?.id;
  if (id) return `${route}:${id}`;
  return route;
}

export function cacheKeyForRoute(
  route: RouteKey | string,
  params?: RouteParams | null
): CacheKey {
  return buildKey(route, params);
}

type Snapshot = {
  history: AnalysisRecord[];
  templates: Template[];
  board: BoardItem[];
};

function readSnapshot(): Snapshot {
  return {
    history: readStorage<AnalysisRecord[]>(storageKeys().history, []),
    templates: readStorage<Template[]>(storageKeys().templates, []),
    board: readStorage<BoardItem[]>(storageKeys().board, []),
  };
}

function criticalDataFor(
  key: CacheKey,
  snapshot: Snapshot
): unknown {
  if (key === "/" || key === "/dashboard") {
    return { ready: true };
  }
  if (key === "/history") return snapshot.history;
  if (key === "/saved") return snapshot.templates;
  if (key === "/actions") return snapshot.board;
  if (key === "/settings") {
    return {
      historyCount: snapshot.history.length,
      templatesCount: snapshot.templates.length,
      boardCount: snapshot.board.length,
    };
  }
  if (key.startsWith("/analysis/[id]:") || key.startsWith("/analysis/")) {
    const id = key.includes(":") ? key.split(":").pop()! : "";
    return snapshot.history.find((r) => r.id === id) ?? null;
  }
  if (key.startsWith("/share/[id]:") || key.startsWith("/share/")) {
    return { ready: true };
  }
  return snapshot;
}

class DataCacheStore {
  private entries = new Map<CacheKey, CacheEntry>();
  private inflight = new Map<CacheKey, Promise<unknown>>();
  private listeners = new Set<Listener>();
  private version = 0;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

  private emit() {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  get<T>(key: CacheKey): CacheEntry<T> | undefined {
    return this.entries.get(key) as CacheEntry<T> | undefined;
  }

  isReady(key: CacheKey): boolean {
    const entry = this.entries.get(key);
    return Boolean(entry && !entry.error && entry.data !== undefined);
  }

  /** True when the entry is ready AND still within its TTL and not dirty —
   *  used to skip the route skeleton for already-fresh data. */
  isFresh(key: CacheKey): boolean {
    const entry = this.entries.get(key);
    return Boolean(
      entry &&
        !entry.dirty &&
        !entry.error &&
        entry.data !== undefined &&
        Date.now() - entry.updatedAt < DEFAULT_TTL_MS
    );
  }

  private put<T>(key: CacheKey, data: T, dirty = false) {
    this.entries.set(key, {
      data,
      updatedAt: Date.now(),
      dirty,
      error: null,
    });
    this.emit();
  }

  private markError(key: CacheKey, error: Error) {
    const prev = this.entries.get(key);
    this.entries.set(key, {
      data: prev?.data,
      updatedAt: Date.now(),
      dirty: true,
      error,
    });
    this.emit();
  }

  async getCriticalData<T = unknown>(
    route: RouteKey | string,
    params?: RouteParams | null,
    opts?: { ttlMs?: number; signal?: AbortSignal }
  ): Promise<T> {
    const key = buildKey(route, params);
    const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;
    const existing = this.entries.get(key);

    if (
      existing &&
      !existing.dirty &&
      !existing.error &&
      Date.now() - existing.updatedAt < ttl
    ) {
      return existing.data as T;
    }

    // Stale-while-revalidate: return last-known immediately, refresh in background.
    if (existing && existing.data !== undefined && !existing.error) {
      void this.revalidate(key, opts?.signal);
      return existing.data as T;
    }

    return this.load<T>(key, opts?.signal);
  }

  prefetch(
    route: RouteKey | string,
    params?: RouteParams | null
  ): Promise<unknown> {
    const key = buildKey(route, params);
    const existing = this.entries.get(key);
    if (existing && !existing.dirty && !existing.error) {
      return Promise.resolve(existing.data);
    }
    return this.load(key);
  }

  private load<T>(key: CacheKey, signal?: AbortSignal): Promise<T> {
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = new Promise<T>((resolve, reject) => {
      try {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        // localStorage reads are sync; microtask keeps API promise-shaped
        // and allows AbortSignal to win races under rapid navigation.
        queueMicrotask(() => {
          if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          try {
            const snapshot = readSnapshot();
            const data = criticalDataFor(key, snapshot) as T;
            this.put(key, data);
            resolve(data);
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.markError(key, error);
            reject(error);
          }
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.markError(key, error);
        reject(error);
      }
    }).finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  private async revalidate(key: CacheKey, signal?: AbortSignal) {
    if (this.inflight.has(key)) return;
    try {
      await this.load(key, signal);
    } catch {
      /* keep stale data on background failure */
    }
  }

  /** Surgical update or full replace for a key after a mutation. */
  mutate<T>(key: CacheKey, data: T) {
    this.put(key, data, false);
  }

  /** Mark related keys dirty so the next entry revalidates. */
  invalidate(keys: CacheKey[] | "all") {
    if (keys === "all") {
      for (const [key, entry] of this.entries) {
        this.entries.set(key, { ...entry, dirty: true });
      }
    } else {
      for (const key of keys) {
        const entry = this.entries.get(key);
        if (entry) this.entries.set(key, { ...entry, dirty: true });
      }
    }
    this.emit();
  }

  /** After TaskContext writes, refresh list/detail keys from the new snapshot. */
  syncFromStorage() {
    const snapshot = readSnapshot();
    const related: CacheKey[] = [
      "/history",
      "/saved",
      "/actions",
      "/settings",
      "/",
      "/dashboard",
    ];
    for (const key of related) {
      this.put(key, criticalDataFor(key, snapshot));
    }
    // Refresh any warm analysis detail entries.
    for (const [key] of this.entries) {
      if (key.includes("/analysis")) {
        this.put(key, criticalDataFor(key, snapshot));
      }
    }
  }

  clear() {
    this.entries.clear();
    this.inflight.clear();
    this.emit();
  }

  hydrate() {
    const snapshot = readSnapshot();
    this.put("/", { ready: true });
    this.put("/history", snapshot.history);
    this.put("/saved", snapshot.templates);
    this.put("/actions", snapshot.board);
    this.put("/settings", {
      historyCount: snapshot.history.length,
      templatesCount: snapshot.templates.length,
      boardCount: snapshot.board.length,
    });
  }
}

const store = new DataCacheStore();

type DataCacheContextValue = {
  getCriticalData: typeof store.getCriticalData;
  prefetch: typeof store.prefetch;
  mutate: typeof store.mutate;
  invalidate: typeof store.invalidate;
  syncFromStorage: typeof store.syncFromStorage;
  clear: typeof store.clear;
  isReady: typeof store.isReady;
  isFresh: typeof store.isFresh;
  cacheKeyForRoute: typeof cacheKeyForRoute;
  enabled: boolean;
};

const DataCacheContext = createContext<DataCacheContextValue | null>(null);

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const enabled = isInstantNavEnabled();
  const hydrated = useRef(false);

  useEffect(() => {
    if (!enabled || hydrated.current) return;
    store.hydrate();
    hydrated.current = true;
  }, [enabled]);

  const value = useMemo<DataCacheContextValue>(
    () => ({
      getCriticalData: store.getCriticalData.bind(store),
      prefetch: store.prefetch.bind(store),
      mutate: store.mutate.bind(store),
      invalidate: store.invalidate.bind(store),
      syncFromStorage: store.syncFromStorage.bind(store),
      clear: store.clear.bind(store),
      isReady: store.isReady.bind(store),
      isFresh: store.isFresh.bind(store),
      cacheKeyForRoute,
      enabled,
    }),
    [enabled]
  );

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const ctx = useContext(DataCacheContext);
  if (!ctx) {
    throw new Error("useDataCache must be used within a DataCacheProvider");
  }
  return ctx;
}

/** Subscribe to cache version for components that need re-render on updates. */
export function useDataCacheVersion() {
  return useSyncExternalStore(
    store.subscribe,
    store.getVersion,
    () => 0
  );
}

export function getDataCacheStore() {
  return store;
}
