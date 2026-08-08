"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { useTask } from "@/context/TaskContext";
import type { BoardItem, BoardStatus } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";

const COLUMNS: { key: BoardStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in-progress", label: "In Progress" },
  { key: "done", label: "Done" },
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
      className={`group cursor-grab rounded-[3px] border border-line bg-background p-3 transition-colors active:cursor-grabbing ${
        dragging ? "opacity-50" : "hover:border-ink"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted/50" />
        <button
          type="button"
          onClick={() => router.push(`/analysis/${item.sourceId}`)}
          className="flex h-10 w-10 items-center justify-center rounded-[3px] text-muted/60 transition-colors hover:bg-surface-2 hover:text-accent"
          aria-label="Open source analysis"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink">{item.text}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className={`font-mono text-[10px] uppercase tracking-wide ${urgencyTone(item.urgency)}`}>
          {item.urgency}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(item.id, -1)}
            className="flex h-10 w-10 items-center justify-center rounded-[3px] text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
            disabled={item.status === "todo"}
            aria-label="Move backward"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(item.id, 1)}
            className="flex h-10 w-10 items-center justify-center rounded-[3px] text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
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

  function handleDrop() {
    setDropOver(null);
  }

  const counts = COLUMNS.reduce<Record<BoardStatus, number>>(
    (acc, col) => {
      acc[col.key] = board.filter((i) => i.status === col.key).length;
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

      {board.length === 0 ? (
        <EmptyState
          title="No actions yet"
          hint="Actions are collected automatically from every analysis you run."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((column) => (
            <div
              key={column.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDropOver(column.key);
              }}
              onDragLeave={() => setDropOver((v) => (v === column.key ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) setItemStatus(id, column.key);
                handleDrop();
              }}
              className={`flex flex-col rounded-[3px] border bg-surface transition-colors ${
                dropOver === column.key
                  ? "border-accent"
                  : "border-line"
              }`}
            >
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
                  {column.label}
                </h2>
                <span className="font-mono text-[11px] text-muted">
                  {counts[column.key]}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                {board
                  .filter((item) => item.status === column.key)
                  .map((item) => (
                    <BoardCard
                      key={item.id}
                      item={item}
                      onDropCard={(id) => setItemStatus(id, column.key)}
                      onMove={(id, dir) => {
                        const idx = COLUMNS.findIndex(
                          (c) => c.key === item.status
                        );
                        const next = COLUMNS[idx + dir];
                        if (next) setItemStatus(id, next.key);
                      }}
                    />
                  ))}
                {counts[column.key] === 0 && (
                  <p className="flex-1 border border-dashed border-line py-8 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted/60">
                    Empty
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
