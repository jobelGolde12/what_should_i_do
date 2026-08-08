"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTask } from "@/context/TaskContext";
import ResultsPanel from "@/components/results/ResultsPanel";
import { EmptyState } from "@/components/ui/States";
import { snippet } from "@/lib/format";

export default function AnalysisView() {
  const params = useParams<{ id: string }>();
  const { loadRecord } = useTask();
  const record = params.id ? loadRecord(params.id) : null;

  if (!record) {
    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
        </header>
        <EmptyState
          title="Analysis not found"
          hint="This analysis may have been deleted, or it was created on another device. History lives in this browser."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> New analysis
        </Link>
        <p className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-muted sm:block">
          /analysis/{record.id.slice(0, 8)}
        </p>
      </header>

      <div className="mb-6 border-l-2 border-line bg-surface px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Original input
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">
          {snippet(record.input, 320)}
        </p>
      </div>

      <ResultsPanel record={record} animate={false} />
    </div>
  );
}
