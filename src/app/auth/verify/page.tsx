"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/layout/Logo";
import SiteFooter from "@/components/layout/SiteFooter";
import { useAuth } from "@/context/AuthContext";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();
  const token = searchParams.get("token");
  const successParam = searchParams.get("success");
  const errorParam = searchParams.get("error");

  const [loading, setLoading] = useState(Boolean(token && !successParam && !errorParam));
  const [success, setSuccess] = useState(successParam === "1");
  const [error, setError] = useState<string | null>(
    errorParam === "rate_limited"
      ? "Too many verification attempts. Please wait a minute and try again."
      : errorParam
        ? "Invalid or expired verification token."
        : null
  );

  useEffect(() => {
    if (!token || success || error) return;
    let mounted = true;

    async function verify() {
      try {
        const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token!)}`);
        const data = await res.json();
        if (!mounted) return;
        if (res.ok && data.ok) {
          setSuccess(true);
          await refresh();
        } else {
          setError(data.error || "Verification failed. Token may be expired.");
        }
      } catch {
        if (mounted) setError("Verification failed. Try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void verify();
    return () => {
      mounted = false;
    };
  }, [token, success, error, refresh]);

  return (
    <main className="w-full max-w-md rounded-tm border border-line bg-surface p-8 text-center shadow-sm">
      {loading && (
        <div className="py-8">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
          <h1 className="mt-4 font-display text-lg font-medium text-ink">
            Verifying your email...
          </h1>
        </div>
      )}

      {!loading && success && (
        <div className="py-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-medium text-ink">
            Email verified!
          </h1>
          <p className="mt-2 text-sm text-muted">
            Your account is active and verified. You can now access all TaskMind features and sync your data.
          </p>
          <div className="mt-6">
            <Button onClick={() => router.push("/")} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}

      {!loading && !success && (
        <div className="py-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-high/10 text-high">
            <XCircle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-medium text-ink">
            Verification Failed
          </h1>
          <p className="mt-2 text-sm text-muted">
            {error || "The link may have expired or already been used."}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/auth/login">
              <Button variant="outline" className="w-full">
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      <div className="flex h-16 items-center justify-between border-t-2 border-t-accent border-b border-line px-4 sm:px-6">
        <Logo />
        <Link href="/" className="text-sm font-medium text-muted hover:text-ink">
          Back to app
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
          <VerifyContent />
        </Suspense>
      </div>

      <SiteFooter />
    </div>
  );
}
