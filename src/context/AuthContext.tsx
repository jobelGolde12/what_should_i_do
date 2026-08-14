"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { PlanTier } from "@/lib/pro/plans";
import type { SyncChange } from "@/lib/sync";

export type AuthUser = {
  id: string;
  email: string;
  createdAt: number;
  emailVerified: boolean;
};

export type AuthData = { history: unknown[]; templates: unknown[]; board: unknown[] };

type AuthStatus = "loading" | "authed" | "anon";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  plan: PlanTier;
  refreshPlan: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<{ user: AuthUser; requiresVerification: boolean }>;
  resendVerification: (email?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  pushData: (data: AuthData) => Promise<void>;
  pullData: () => Promise<AuthData | null>;
  sync: (body: { since: number; push: SyncChange[] }) => Promise<{
    changes: SyncChange[];
    now: number;
  }>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export type AuthError = Error & {
  requiresVerification?: boolean;
  mailFailed?: boolean;
};

async function readError(res: Response): Promise<AuthError> {
  try {
    const body = (await res.json()) as {
      error?: string;
      requiresVerification?: boolean;
      mailFailed?: boolean;
    };
    const err = new Error(body.error ?? "Something went wrong.") as AuthError;
    if (body.requiresVerification) err.requiresVerification = true;
    if (body.mailFailed) err.mailFailed = true;
    return err;
  } catch {
    return new Error("Something went wrong.");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [plan, setPlan] = useState<PlanTier>("free");

  async function refreshPlan() {
    try {
      const res = await fetch("/api/billing/status");
      if (res.ok) {
        const body = (await res.json()) as { plan: PlanTier };
        setPlan(body.plan ?? "free");
      } else {
        setPlan("free");
      }
    } catch {
      setPlan("free");
    }
  }

  async function refresh() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const body = (await res.json()) as { user: AuthUser };
        setUser(body.user);
        setStatus("authed");
        void refreshPlan();
      } else {
        setUser(null);
        setStatus("anon");
      }
    } catch {
      setUser(null);
      setStatus("anon");
    }
  }

  useEffect(() => {
    void refresh();
    // Run once on mount; refresh only uses stable setters and fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw await readError(res);
    const body = (await res.json()) as { user: AuthUser };
    setUser(body.user);
    setStatus("authed");
    void refreshPlan();
    return body.user;
  }

  async function register(
    email: string,
    password: string
  ): Promise<{ user: AuthUser; requiresVerification: boolean }> {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw await readError(res);
    const body = (await res.json()) as {
      user: AuthUser;
      requiresVerification: boolean;
    };
    if (!body.requiresVerification) {
      setUser(body.user);
      setStatus("authed");
      void refreshPlan();
    }
    return body;
  }

  async function resendVerification(email?: string): Promise<void> {
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw await readError(res);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      plan,
      refreshPlan,
      login,
      register,
      resendVerification,
      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        setStatus("anon");
        setPlan("free");
      },
      refresh,
      pushData: async (data) => {
        const res = await fetch("/api/users/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw await readError(res);
      },
      pullData: async () => {
        const res = await fetch("/api/users/me");
        if (!res.ok) throw await readError(res);
        const body = (await res.json()) as { data: AuthData };
        return body.data;
      },
      sync: async (body) => {
        const res = await fetch("/api/users/me/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw await readError(res);
        return (await res.json()) as { changes: SyncChange[]; now: number };
      },
      deleteAccount: async () => {
        const res = await fetch("/api/users/me", { method: "DELETE" });
        if (!res.ok) throw await readError(res);
        setUser(null);
        setStatus("anon");
      },
    }),
    // Callbacks only close over stable setters + fetch; user/status/plan are
    // the only state that must re-create the context value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, status, plan]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
