"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

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
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<{ user: AuthUser; requiresVerification: boolean }>;
  resendVerification: (email?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  pushData: (data: AuthData) => Promise<void>;
  pullData: () => Promise<AuthData | null>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readError(res: Response): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: string };
    return new Error(body.error ?? "Something went wrong.");
  } catch {
    return new Error("Something went wrong.");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  async function refresh() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const body = (await res.json()) as { user: AuthUser };
        setUser(body.user);
        setStatus("authed");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
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
      login,
      register,
      resendVerification,
      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        setStatus("anon");
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
      deleteAccount: async () => {
        const res = await fetch("/api/users/me", { method: "DELETE" });
        if (!res.ok) throw await readError(res);
        setUser(null);
        setStatus("anon");
      },
    }),
    [user, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
