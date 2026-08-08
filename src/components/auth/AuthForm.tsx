"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/layout/Logo";
import SiteFooter from "@/components/layout/SiteFooter";

type AuthFormProps = {
  mode: "login" | "register";
};

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await (isLogin ? login(email, password) : register(email, password));
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      <div className="flex h-16 items-center justify-between border-t-2 border-t-accent border-b border-line px-4 sm:px-6">
        <Logo />
        <Link
          href="/"
          className="text-sm font-medium text-muted hover:text-ink"
        >
          Back to app
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <main className="w-full max-w-sm">
          <h1 className="font-display text-xl font-medium text-ink">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {isLogin
              ? "Sign in to sync your data across devices."
              : "Sync history, templates, and your actions board across devices. Your local data stays yours either way."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <label className="grid gap-1.5">
              <span className="font-mono text-xxs uppercase tracking-label-tight text-muted">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full rounded-tm border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="font-mono text-xxs uppercase tracking-label-tight text-muted">
                Password
              </span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-11 w-full rounded-tm border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-tm border border-line bg-surface px-3 py-2 text-sm text-high"
              >
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading || !email || !password}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLogin ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {isLogin ? "No account yet? " : "Already have an account? "}
            <Link
              href={isLogin ? "/auth/register" : "/auth/login"}
              className="font-medium text-accent hover:text-accent-dark"
            >
              {isLogin ? "Create one" : "Sign in"}
            </Link>
          </p>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5" />
            Passwords are hashed; sessions use secure cookies.
          </p>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
