"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ShieldCheck,
  Mail,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/layout/Logo";
import SiteFooter from "@/components/layout/SiteFooter";

type AuthFormProps = {
  mode: "login" | "register";
};

type StrengthRule = {
  label: string;
  test: (pwd: string) => boolean;
};

const STRENGTH_RULES: StrengthRule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getStrengthScore(password: string): number {
  if (!password) return 0;
  return STRENGTH_RULES.reduce((score, rule) => score + (rule.test(password) ? 1 : 0), 0);
}

function getStrengthLabel(score: number): { text: string; colorClass: string } {
  if (score <= 1) return { text: "Weak", colorClass: "text-high" };
  if (score <= 3) return { text: "Fair", colorClass: "text-amber-500" };
  if (score === 4) return { text: "Good", colorClass: "text-accent" };
  return { text: "Strong", colorClass: "text-emerald-500" };
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, register, resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [isUnverifiedError, setIsUnverifiedError] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  const isLogin = mode === "login";

  const strengthScore = useMemo(() => getStrengthScore(password), [password]);
  const strengthMeta = useMemo(() => getStrengthLabel(strengthScore), [strengthScore]);
  const showStrengthPanel = !isLogin && (touchedPassword || password.length > 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendStatus(null);
    setIsUnverifiedError(false);
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        router.push("/");
        router.refresh();
      } else {
        const result = await register(email, password);
        if (result.requiresVerification) {
          setVerificationSent(true);
        } else {
          router.push("/");
          router.refresh();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      if (msg.toLowerCase().includes("verify your email")) {
        setIsUnverifiedError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendStatus(null);
    setResending(true);
    try {
      await resendVerification(email);
      setResendStatus("Verification email resent! Check your inbox.");
    } catch (err) {
      setResendStatus(
        err instanceof Error ? err.message : "Failed to resend verification email."
      );
    } finally {
      setResending(false);
    }
  }

  if (verificationSent) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-ink">
        <div className="flex h-16 items-center justify-between border-t-2 border-t-accent border-b border-line px-4 sm:px-6">
          <Logo />
          <Link href="/" className="text-sm font-medium text-muted hover:text-ink">
            Back to app
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <main className="w-full max-w-md rounded-tm border border-line bg-surface p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="mt-4 font-display text-xl font-medium text-ink">
              Check your email
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              We sent a verification link to{" "}
              <strong className="font-medium text-ink">{email}</strong>. Please check
              your inbox and click the link to activate your account.
            </p>

            {resendStatus && (
              <p
                role="status"
                className="mt-4 rounded-tm border border-line bg-background px-3 py-2 text-xs font-medium text-ink"
              >
                {resendStatus}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={resending}
                onClick={handleResend}
              >
                {resending && <Loader2 className="h-4 w-4 animate-spin" />}
                Resend email
              </Button>
              <Link
                href="/auth/login"
                className="text-xs font-medium text-muted hover:text-ink"
              >
                Back to Sign In
              </Link>
            </div>
          </main>
        </div>
        <SiteFooter />
      </div>
    );
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
              <div className="flex items-center justify-between">
                <span className="font-mono text-xxs uppercase tracking-label-tight text-muted">
                  Password
                </span>
                {isLogin && (
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-muted hover:text-ink"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setTouchedPassword(true)}
                  placeholder="At least 8 characters"
                  className="h-11 w-full rounded-tm border border-line bg-surface px-3 pr-10 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-muted transition-colors hover:text-ink focus:text-ink focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {showStrengthPanel && (
                <div className="rounded-tm border border-line bg-background p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xxs uppercase tracking-label-tight text-muted">
                      Strength
                    </span>
                    <span
                      className={`text-xs font-medium ${strengthMeta.colorClass}`}
                    >
                      {strengthMeta.text}
                    </span>
                  </div>
                  <div className="mb-3 flex gap-1">
                    {STRENGTH_RULES.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                          i < strengthScore
                            ? strengthScore <= 2
                              ? "bg-high"
                              : strengthScore <= 3
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                            : "bg-line"
                        }`}
                      />
                    ))}
                  </div>
                  <ul className="grid gap-1.5">
                    {STRENGTH_RULES.map((rule) => {
                      const passed = rule.test(password);
                      return (
                        <li
                          key={rule.label}
                          className="flex items-center gap-2 text-xs text-muted"
                        >
                          {passed ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <X className="h-3 w-3 text-high" />
                          )}
                          <span
                            className={
                              passed ? "text-ink" : "text-muted"
                            }
                          >
                            {rule.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </label>

            {error && (
              <div
                role="alert"
                className="rounded-tm border border-line bg-surface px-3 py-2 text-sm text-high"
              >
                <p>{error}</p>
                {isUnverifiedError && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    {resending ? "Sending..." : "Resend verification email"}
                  </button>
                )}
              </div>
            )}

            {resendStatus && (
              <p
                role="status"
                className="rounded-tm border border-line bg-background px-3 py-2 text-xs font-medium text-ink"
              >
                {resendStatus}
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