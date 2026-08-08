import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="font-mono text-xxs uppercase tracking-label text-muted">
          {SITE_NAME} · local-first
        </p>
        <nav aria-label="Legal" className="flex items-center gap-4">
          <Link
            href="/privacy"
            className="text-xs text-muted transition-colors hover:text-ink"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-xs text-muted transition-colors hover:text-ink"
          >
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
