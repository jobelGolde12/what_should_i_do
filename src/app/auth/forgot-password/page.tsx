"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/layout/Logo";
import SiteFooter from "@/components/layout/SiteFooter";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to request password reset.");
      }
      setSubmitted(true);
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
        <Link href="/auth/login" className="text-sm font-medium text-muted hover:text-ink">
          Back to sign in
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <main className="w-full max-w-sm">
          {!submitted ? (
            <>
              <h1 className="font-display text-xl font-medium text-ink">
                Forgot password?
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Enter your account email and we&apos;ll send you a link to reset your password.
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

                {error && (
                  <p
                    role="alert"
                    className="rounded-tm border border-line bg-surface px-3 py-2 text-sm text-high"
                  >
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading || !email}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
              </form>
            </>
          ) : (
            <div className="rounded-tm border border-line bg-surface p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Mail className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-lg font-medium text-ink">
                Check your inbox
              </h2>
              <p className="mt-2 text-sm text-muted">
                If an account with <strong className="font-medium text-ink">{email}</strong> exists, we sent a password reset link.
              </p>
              <div className="mt-6">
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
