"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";
import { parseShareToken } from "@/lib/share";
import ResultsPanel from "@/components/results/ResultsPanel";
import { EmptyState } from "@/components/ui/States";
import Logo from "@/components/layout/Logo";
import { snippet } from "@/lib/format";

export default function ShareView() {
  const params = useParams<{ id: string }>();

  const record = useMemo(() => {
    if (!params.id) return null;
    const payload = parseShareToken(params.id);
    if (!payload) return null;
    return {
      id: `share-${params.id.slice(0, 12)}`,
      timestamp: payload.timestamp,
      input: payload.input,
      output: payload.output,
    };
  }, [params.id]);

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="border-t-2 border-t-accent border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-[3px] bg-accent px-4 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Analyze your own text
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {!record ? (
          <EmptyState
            title="This link isn't valid"
            hint="Share links expire if the URL is edited. Try opening the original share again."
          />
        ) : (
          <>
            <div className="mb-6 border-l-2 border-line bg-surface px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Shared analysis
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">
                {snippet(record.input, 320)}
              </p>
            </div>
            <ResultsPanel record={record} animate={false} />
          </>
        )}
      </div>
    </div>
  );
}
