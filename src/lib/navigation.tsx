"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  NavigationState,
  NavigationStateType,
  RouteKey,
  RouteParams,
} from "@/lib/types";
import { useDataCache, cacheKeyForRoute } from "@/lib/data-cache";
import { isInstantNavEnabled } from "@/lib/features";

type NavAction =
  | {
      type: "PREFETCH";
      route: RouteKey;
      params: RouteParams | null;
    }
  | {
      type: "COMMIT";
      route: RouteKey;
      params: RouteParams | null;
      generation: number;
    }
  | { type: "SET_PHASE"; phase: NavigationStateType; generation: number }
  | { type: "READY"; generation: number; route: RouteKey; params: RouteParams | null }
  | { type: "ERROR"; generation: number; error: Error }
  | { type: "CANCEL"; generation: number }
  | { type: "SYNC_PATH"; route: RouteKey; params: RouteParams | null }
  | { type: "PASSTHROUGH_IDLE" };

const initialState: NavigationState = {
  currentRoute: null,
  currentParams: null,
  generation: 0,
  state: "idle",
  targetRoute: null,
  targetParams: null,
  skeletonVisible: false,
  error: null,
};

function reducer(state: NavigationState, action: NavAction): NavigationState {
  switch (action.type) {
    case "PREFETCH":
      if (state.state === "loading_skeleton" || state.state === "data_resolving") {
        return state;
      }
      return {
        ...state,
        state: "prefetching",
        targetRoute: action.route,
        targetParams: action.params,
      };
    case "COMMIT":
      return {
        ...state,
        generation: action.generation,
        state: "loading_skeleton",
        targetRoute: action.route,
        targetParams: action.params,
        skeletonVisible: true,
        error: null,
      };
    case "SET_PHASE":
      if (action.generation !== state.generation) return state;
      return { ...state, state: action.phase };
    case "READY":
      if (action.generation !== state.generation) return state;
      return {
        ...state,
        state: "ready",
        currentRoute: action.route,
        currentParams: action.params,
        targetRoute: action.route,
        targetParams: action.params,
        skeletonVisible: false,
        error: null,
      };
    case "ERROR":
      if (action.generation !== state.generation) return state;
      return {
        ...state,
        state: "error",
        error: action.error,
        skeletonVisible: false,
      };
    case "CANCEL":
      if (action.generation !== state.generation) return state;
      return {
        ...state,
        state: "cancelled",
        skeletonVisible: false,
        targetRoute: null,
        targetParams: null,
      };
    case "SYNC_PATH":
      return {
        ...state,
        currentRoute: action.route,
        currentParams: action.params,
        state: state.skeletonVisible ? state.state : "idle",
        skeletonVisible: false,
        error: null,
      };
    case "PASSTHROUGH_IDLE":
      return { ...initialState };
    default:
      return state;
  }
}

export function pathToRouteKey(pathname: string): {
  route: RouteKey;
  params: RouteParams | null;
} {
  if (pathname === "/") return { route: "/", params: null };
  if (pathname === "/history") return { route: "/history", params: null };
  if (pathname === "/saved") return { route: "/saved", params: null };
  if (pathname === "/actions") return { route: "/actions", params: null };
  if (pathname === "/settings") return { route: "/settings", params: null };
  if (pathname === "/dashboard") return { route: "/dashboard", params: null };
  if (pathname === "/privacy") return { route: "/privacy", params: null };
  if (pathname === "/terms") return { route: "/terms", params: null };
  if (pathname === "/auth/login") return { route: "/auth/login", params: null };
  if (pathname === "/auth/register") {
    return { route: "/auth/register", params: null };
  }

  const analysis = pathname.match(/^\/analysis\/([^/]+)$/);
  if (analysis) {
    return { route: "/analysis/[id]", params: { id: analysis[1] } };
  }
  const chat = pathname.match(/^\/analysis\/([^/]+)\/chat$/);
  if (chat) {
    return { route: "/analysis/[id]/chat", params: { id: chat[1] } };
  }
  const share = pathname.match(/^\/share\/([^/]+)$/);
  if (share) {
    return { route: "/share/[id]", params: { id: share[1] } };
  }

  return { route: pathname as RouteKey, params: null };
}

export function hrefToRoute(
  href: string
): { route: RouteKey; params: RouteParams | null; path: string } {
  const path = href.split("?")[0] ?? href;
  const { route, params } = pathToRouteKey(path);
  return { route, params, path };
}

type NavigationContextValue = {
  state: NavigationState;
  enabled: boolean;
  prefetch: (href: string) => void;
  navigate: (href: string) => void;
  cancelCurrent: () => void;
  markReady: () => void;
  isLoadingSkeleton: boolean;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const enabled = isInstantNavEnabled();
  const router = useRouter();
  const pathname = usePathname();
  const dataCache = useDataCache();
  const [state, dispatch] = useReducer(reducer, initialState);
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when App Router finishes the transition.
  useEffect(() => {
    if (!enabled) {
      dispatch({ type: "PASSTHROUGH_IDLE" });
      return;
    }
    const { route, params } = pathToRouteKey(pathname);
    const key = cacheKeyForRoute(route, params);

    const finish = async () => {
      const gen = generationRef.current;
      try {
        dispatch({ type: "SET_PHASE", phase: "data_resolving", generation: gen });
        await dataCache.getCriticalData(route, params, {
          signal: abortRef.current?.signal,
        });
        if (gen !== generationRef.current) return;
        if (!dataCache.isReady(key) && route === "/analysis/[id]") {
          // Record may be missing; still leave skeleton — page handles empty.
        }
        dispatch({ type: "READY", generation: gen, route, params });
      } catch (err) {
        if (gen !== generationRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatch({
          type: "ERROR",
          generation: gen,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    };

    if (state.skeletonVisible || state.state === "loading_skeleton") {
      void finish();
    } else {
      dispatch({ type: "SYNC_PATH", route, params });
      void dataCache.prefetch(route, params);
    }
    // Only react to pathname changes for sync; intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, enabled]);

  const prefetch = useCallback(
    (href: string) => {
      if (!enabled) {
        router.prefetch(href);
        return;
      }
      const { route, params, path } = hrefToRoute(href);
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);

      dispatch({ type: "PREFETCH", route, params });
      prefetchTimerRef.current = setTimeout(() => {
        router.prefetch(path);
        void dataCache.prefetch(route, params);
      }, 40);
    },
    [enabled, router, dataCache]
  );

  const navigate = useCallback(
    (href: string) => {
      const { route, params, path } = hrefToRoute(href);

      if (!enabled) {
        router.push(path);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      generationRef.current += 1;
      const gen = generationRef.current;

      dispatch({ type: "COMMIT", route, params, generation: gen });
      // Data is already warm (fresh, within TTL) → resolve immediately so the
      // skeleton never paints. Otherwise kick data (render-as-you-fetch).
      const key = cacheKeyForRoute(route, params);
      if (dataCache.isFresh(key)) {
        dispatch({ type: "READY", generation: gen, route, params });
      } else {
        void dataCache.getCriticalData(route, params, {
          signal: abortRef.current.signal,
        });
      }
      router.push(path);
    },
    [enabled, router, dataCache]
  );

  const cancelCurrent = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "CANCEL", generation: generationRef.current });
  }, []);

  const markReady = useCallback(() => {
    const { route, params } = pathToRouteKey(pathname);
    dispatch({
      type: "READY",
      generation: generationRef.current,
      route,
      params,
    });
  }, [pathname]);

  const value = useMemo<NavigationContextValue>(
    () => ({
      state,
      enabled,
      prefetch,
      navigate,
      cancelCurrent,
      markReady,
      isLoadingSkeleton:
        enabled &&
        state.skeletonVisible &&
        (state.state === "loading_skeleton" ||
          state.state === "data_resolving"),
    }),
    [state, enabled, prefetch, navigate, cancelCurrent, markReady]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return ctx;
}
