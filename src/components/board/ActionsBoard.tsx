"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Search,
  Flame,
} from "lucide-react";
import { useTask } from "@/context/TaskContext";
import type { BoardItem, BoardStatus } from "@/lib/types";
import type { UrgencyLevel } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

const COLUMNS: { key: BoardStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in-progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const URGENCY_FILTERS: { key: "all" | UrgencyLevel; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Urgent", label: "Urgent" },
  { key: "Important", label: "Important" },
  { key: "Informational", label: "Info" },
];

function urgencyTone(level: BoardItem["urgency"]): string {
  switch (level) {
    case "Urgent":
      return "text-high";
    case "Important":
      return "text-med";
    default:
      return "text-low";
  }
}

function BoardCard({
  item,
  onDropCard,
  onMove,
}: {
  item: BoardItem;
  onDropCard: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDropCard(item.id);
      }}
      className={`group cursor-grab rounded-tm border border-line bg-background p-3 transition-colors active:cursor-grabbing ${
        dragging ? "opacity-50" : "hover:border-ink"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <button
          type="button"
          onClick={() => router.push(`/analysis/${item.sourceId}`)}
          className="flex h-10 w-10 items-center justify-center rounded-tm text-muted transition-colors hover:bg-surface-2 hover:text-accent"
          aria-label="Open source analysis"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 break-words text-sm leading-relaxed text-ink">
        {item.text}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`font-mono text-xxs uppercase tracking-wide ${urgencyTone(item.urgency)}`}
        >
          {item.urgency}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(item.id, -1)}
            className="flex h-10 w-10 items-center justify-center rounded-tm text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
            disabled={item.status === "todo"}
            aria-label="Move backward"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(item.id, 1)}
            className="flex h-10 w-10 items-center justify-center rounded-tm text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
            disabled={item.status === "done"}
            aria-label="Move forward"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActionsBoard() {
  const { board, setItemStatus } = useTask();
  const [dropOver, setDropOver] = useState<BoardStatus | null>(null);
  const [query, setQuery] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | UrgencyLevel>("all");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [announce, setAnnounce] = useState("");

  function moveItem(id: string, status: BoardStatus, label: string) {
    setItemStatus(id, status);
    setAnnounce(`Moved ${label}`);
  }

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.filter((item) => {
      if (urgentOnly && item.urgency !== "Urgent") return false;
      if (urgencyFilter !== "all" && item.urgency !== urgencyFilter) return false;
      if (!q) return true;
      return item.text.toLowerCase().includes(q);
    });
  }, [board, query, urgencyFilter, urgentOnly]);

  const total = board.length;
  const done = board.filter((i) => i.status === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const counts = COLUMNS.reduce<Record<BoardStatus, number>>(
    (acc, col) => {
      acc[col.key] = items.filter((i) => i.status === col.key).length;
      return acc;
    },
    { todo: 0, "in-progress": 0, done: 0 }
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="My Actions"
        kicker="Every action from your history, in one board. Drag between columns."
      />

      <div className="flex flex-col gap-3 border border-line bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-2xs uppercase tracking-label text-muted">
            Progress
          </p>
          <p className="font-mono text-2xs text-ink">
            {done} of {total} done · {pct}%
          </p>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Board completion"
        >
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions…"
            className="h-10 w-full rounded-tm border border-line bg-background pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-ink"
            aria-label="Search actions"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={urgentOnly ? "dark" : "outline"}
            size="sm"
            aria-pressed={urgentOnly}
            onClick={() => setUrgentOnly((v) => !v)}
          >
            <Flame className="h-3.5 w-3.5" /> Urgent focus
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {URGENCY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={urgencyFilter === f.key}
            onClick={() => setUrgencyFilter(f.key)}
            className={`rounded-tm px-3 py-1.5 text-xs font-medium transition-colors ${
              urgencyFilter === f.key
                ? "bg-ink text-background"
                : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>

      {board.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No actions yet"
            hint="Actions are collected automatically from every analysis you run."
          />
        </div>
      ) : (
        <>
          {items.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Nothing matches"
                hint="Try clearing the search or filters."
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {COLUMNS.map((column) => (
                <div
                  key={column.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropOver(column.key);
                  }}
                  onDragLeave={() =>
                    setDropOver((v) => (v === column.key ? null : v))
                  }
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) moveItem(id, column.key, column.label);
                    setDropOver(null);
                  }}
                  className={`flex flex-col rounded-tm border bg-surface transition-colors ${
                    dropOver === column.key ? "border-accent" : "border-line"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <h2 className="font-mono text-2xs uppercase tracking-label text-ink">
                      {column.label}
                    </h2>
                    <span className="font-mono text-2xs text-muted">
                      {counts[column.key]}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    {items
                      .filter((item) => item.status === column.key)
                      .map((item) => (
                        <BoardCard
                          key={item.id}
                          item={item}
                          onDropCard={(id) => moveItem(id, column.key, column.label)}
                          onMove={(id, dir) => {
                            const idx = COLUMNS.findIndex(
                              (c) => c.key === item.status
                            );
                            const next = COLUMNS[idx + dir];
                            if (next) moveItem(id, next.key, next.label);
                          }}
                        />
                      ))}
                    {counts[column.key] === 0 && (
                      <p className="flex-1 border border-dashed border-line py-8 text-center font-mono text-xxs uppercase tracking-label text-muted">
                        Empty
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
