"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, ArrowRight } from "lucide-react";
import { useTask } from "@/context/TaskContext";
import { formatRelative, snippet } from "@/lib/format";
import { UrgencyBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import type { UrgencyLevel } from "@/lib/types";

const FILTERS: { key: "all" | UrgencyLevel; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Urgent", label: "Urgent" },
  { key: "Important", label: "Important" },
  { key: "Informational", label: "Informational" },
];

export default function HistoryView() {
  const router = useRouter();
  const { history, deleteAnalysis, clearHistory } = useTask();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | UrgencyLevel>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((r) => {
      if (filter !== "all" && r.output.urgency !== filter) return false;
      if (!q) return true;
      return (
        r.input.toLowerCase().includes(q) ||
        r.output.nextStep.toLowerCase().includes(q)
      );
    });
  }, [history, query, filter]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="History"
        kicker="Every analysis stays on this device. Click one to reopen it."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search past analyses…"
            className="h-10 w-full rounded-[3px] border border-line bg-background pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-ink"
            aria-label="Search history"
          />
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm("Clear all history and the actions board?")) {
                clearHistory();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all
          </Button>
        )}
      </div>

      <div className="mt-3 flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-[3px] px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-ink text-background"
                : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {filtered.length === 0 && (
          <EmptyState
            title={
              history.length === 0
                ? "No analyses yet"
                : "Nothing matches your search"
            }
            hint={
              history.length === 0
                ? "Analyze something on the New Analysis page and it will show up here."
                : "Try a different search or filter."
            }
          />
        )}

        {filtered.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {filtered.map((record) => (
              <li
                key={record.id}
                className="group flex items-start gap-4 py-4"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/analysis/${record.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <UrgencyBadge level={record.output.urgency} />
                    <span className="font-mono text-[11px] text-muted">
                      {formatRelative(record.timestamp)}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {record.output.actions.length} actions ·{" "}
                      {record.output.deadlines.length} deadlines
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink">
                    {snippet(record.input, 220)}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/analysis/${record.id}`)}
                    aria-label="Open analysis"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAnalysis(record.id)}
                    aria-label="Delete analysis"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
