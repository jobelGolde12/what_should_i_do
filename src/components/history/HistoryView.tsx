"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Trash2,
  ArrowRight,
  Download,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { useTask } from "@/context/TaskContext";
import { formatRelative, snippet } from "@/lib/format";
import { downloadJson, readJsonFile } from "@/lib/backup";
import { UrgencyBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import SmartLink from "@/components/navigation/SmartLink";
import { useNavigation } from "@/lib/navigation";
import type { UrgencyLevel } from "@/lib/types";
import type { AnalysisRecord } from "@/lib/types";

const FILTERS: { key: "all" | UrgencyLevel; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Urgent", label: "Urgent" },
  { key: "Important", label: "Important" },
  { key: "Informational", label: "Informational" },
];

const PAGE_SIZE = 25;

function isAnalysisRecord(value: unknown): value is AnalysisRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.timestamp === "number" &&
    typeof r.input === "string" &&
    typeof r.output === "object" &&
    r.output !== null
  );
}

export default function HistoryView() {
  const { navigate, prefetch } = useNavigation();
  const { history, deleteAnalysis, clearHistory, importHistory } = useTask();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | UrgencyLevel>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [storageError, setStorageError] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => setStorageError(true);
    window.addEventListener("taskmind:storage-error", handler);
    return () =>
      window.removeEventListener("taskmind:storage-error", handler);
  }, []);

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

  const paginated = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  function handleExport() {
    downloadJson(
      `taskmind-history-${new Date().toISOString().slice(0, 10)}.json`,
      history
    );
  }

  async function handleImport(file: File) {
    setImportError(null);
    try {
      const data = await readJsonFile(file);
      const records = Array.isArray(data) ? data.filter(isAnalysisRecord) : [];
      if (records.length === 0) {
        setImportError("No valid TaskMind records found in that file.");
        return;
      }
      importHistory(records);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function resetPagination() {
    setVisible(PAGE_SIZE);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="History"
        kicker="Every analysis stays on this device. Click one to reopen it."
      />

      {storageError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-3 border border-high bg-high-bg px-4 py-3"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-high" />
          <p className="flex-1 text-sm text-ink">
            Browser storage is full. Some data may not be saved.
          </p>
          <Button variant="dark" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Download backup
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPagination();
            }}
            placeholder="Search past analyses…"
            className="h-10 w-full rounded-tm border border-line bg-background pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-ink"
            aria-label="Search history"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          {history.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          )}
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  window.confirm("Clear all history and the actions board?")
                ) {
                  clearHistory();
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </Button>
          )}
        </div>
      </div>

      {importError && (
        <p role="alert" className="mt-3 text-xs text-high">
          {importError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => {
              setFilter(f.key);
              resetPagination();
            }}
            className={`rounded-tm px-3 py-1.5 text-xs font-medium transition-colors ${
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

        {paginated.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {paginated.map((record) => (
              <li
                key={record.id}
                className="group flex items-start gap-4 py-4"
              >
                <SmartLink
                  href={`/analysis/${record.id}`}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <UrgencyBadge level={record.output.urgency} />
                    <span className="font-mono text-2xs text-muted">
                      {formatRelative(record.timestamp)}
                    </span>
                    <span className="font-mono text-2xs text-muted">
                      {record.output.actions.length} actions ·{" "}
                      {record.output.deadlines.length} deadlines
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink">
                    {snippet(record.input, 220)}
                  </p>
                </SmartLink>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onMouseEnter={() => prefetch(`/analysis/${record.id}`)}
                    onClick={() => navigate(`/analysis/${record.id}`)}
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

        {hasMore && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Show more ({filtered.length - visible} remaining)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
