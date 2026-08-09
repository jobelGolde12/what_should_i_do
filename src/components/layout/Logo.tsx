import Link from "next/link";
import Image from "next/image";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 group" aria-label="TaskMind home">
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden">
        <Image
          src="/logo.png"
          alt="TaskMind logo"
          width={32}
          height={32}
          className="h-8 w-8 object-contain"
          priority
        />
      </span>
      {!compact && (
        <span className="font-display text-lg font-medium tracking-tight text-ink">
          TaskMind
        </span>
      )}
    </Link>
  );
}
