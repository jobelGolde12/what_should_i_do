import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 py-6 text-center">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted">
        <span>&copy; {new Date().getFullYear()} {SITE_NAME}</span>
        <span className="hidden sm:inline">&middot;</span>
        <Link
          href="/privacy"
          className="transition-colors hover:text-ink"
        >
          Privacy
        </Link>
        <span className="hidden sm:inline">&middot;</span>
        <Link
          href="/terms"
          className="transition-colors hover:text-ink"
        >
          Terms
        </Link>
      </div>
    </footer>
  );
}
