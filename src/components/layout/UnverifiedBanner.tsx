"use client";

import { useState } from "react";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function UnverifiedBanner() {
  const { user, resendVerification } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user || user.emailVerified) {
    return null;
  }

  async function handleResend() {
    setMessage(null);
    setLoading(true);
    try {
      await resendVerification(user!.email);
      setMessage("Verification email sent!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Email verification notice"
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 text-xs text-ink"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-high" />
        <span>
          Your email address (<strong>{user.email}</strong>) is not verified. Please check your inbox to activate full account sync.
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {message && (
          <span className="font-medium text-accent flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {message}
          </span>
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          className="rounded-tm border border-line bg-background px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-2 disabled:opacity-50 inline-flex items-center gap-1"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Resend email
        </button>
      </div>
    </div>
  );
}
