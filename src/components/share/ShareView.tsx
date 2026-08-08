"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { parseShareToken } from "@/lib/share";
import ResultsPanel from "@/components/results/ResultsPanel";
import { EmptyState } from "@/components/ui/States";
import { LinkButton } from "@/components/ui/Button";
import Logo from "@/components/layout/Logo";
import SiteFooter from "@/components/layout/SiteFooter";
import { snippet } from "@/lib/format";
import { ShieldAlert } from "lucide-react";

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
      includeInput: payload.includeInput,
      sensitive: payload.sensitive,
    };
  }, [params.id]);

  const showInput =
    !!record && record.includeInput !== false && !record.sensitive;

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="border-t-2 border-t-accent border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <LinkButton href="/" size="md">
            Analyze your own text
          </LinkButton>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="sr-only">Shared TaskMind analysis</h1>
        {!record ? (
          <EmptyState
            title="This link isn't valid"
            hint="Share links expire if the URL is edited. Try opening the original share again."
          />
        ) : (
          <>
            {record.sensitive && (
              <div className="mb-6 flex items-start gap-2 rounded-tm border border-line bg-surface px-4 py-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <p className="text-xs leading-relaxed text-muted">
                  The person who shared this marked it as sensitive, so the
                  raw input has been hidden.
                </p>
              </div>
            )}
            {showInput && (
              <div className="mb-6 border-l-2 border-line bg-surface px-4 py-3">
                <p className="font-mono text-xxs uppercase tracking-label text-muted">
                  Shared analysis
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">
                  {snippet(record.input, 320)}
                </p>
              </div>
            )}
            <ResultsPanel record={record} animate={false} />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
