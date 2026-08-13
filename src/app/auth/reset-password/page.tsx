"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/layout/Logo";
import SiteFooter from "@/components/layout/SiteFooter";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing from URL.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm rounded-tm border border-line bg-surface p-6 text-center shadow-sm">
        <p className="text-sm text-high">
          Missing password reset token in URL.
        </p>
        <Link href="/auth/forgot-password" className="mt-4 inline-block text-xs font-medium text-accent hover:underline">
          Request a new password reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm rounded-tm border border-line bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-lg font-medium text-ink">
          Password updated!
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your password has been reset successfully. You can now sign in with your new credentials.
        </p>
        <div className="mt-6">
          <Button onClick={() => router.push("/auth/login")} className="w-full">
            Sign In Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="w-full max-w-sm">
      <h1 className="font-display text-xl font-medium text-ink">
        Set new password
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Choose a strong password of at least 8 characters.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        <label className="grid gap-1.5">
          <span className="font-mono text-xxs uppercase tracking-label-tight text-muted">
            New Password
          </span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="h-11 w-full rounded-tm border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="font-mono text-xxs uppercase tracking-label-tight text-muted">
            Confirm New Password
          </span>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
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

        <Button type="submit" disabled={loading || !password || !confirmPassword}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Reset password
        </Button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      <div className="flex h-16 items-center justify-between border-t-2 border-t-accent border-b border-line px-4 sm:px-6">
        <Logo />
        <Link href="/auth/login" className="text-sm font-medium text-muted hover:text-ink">
          Back to sign in
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense
          fallback={
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>

      <SiteFooter />
    </div>
  );
}
