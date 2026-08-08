import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  kicker?: string;
  children?: ReactNode;
};

export default function PageHeader({
  eyebrow = "Workspace",
  title,
  kicker,
  children,
}: Props) {
  return (
    <header className="dot-grid-fade relative mb-8 border-b border-line pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]">
            <span className="text-accent">{eyebrow}</span>
            <span className="h-px w-6 bg-line" aria-hidden="true" />
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl">
            {title}
          </h1>
          {kicker && (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              {kicker}
            </p>
          )}
        </div>
        {children}
      </div>
    </header>
  );
}
