import Link from "next/link";
import Logo from "@/components/layout/Logo";

export default function NotFound() {
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
        <main className="w-full max-w-md text-center">
          <p className="font-mono text-xs uppercase tracking-label-wide text-accent">
            Error 404
          </p>
          <h1 className="mt-3 font-display text-2xl font-medium text-ink">
            This page doesn&apos;t exist.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            It may have been moved, or the link you followed is out of date.
            Head back to the dashboard to keep analyzing.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-tm bg-ink px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-ink/90"
          >
            Go to dashboard
          </Link>
        </main>
      </div>
    </div>
  );
}
