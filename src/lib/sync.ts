/**
 * Client-side sync engine for TaskMind Pro.
 *
 * Local-first: the browser remains the source of truth until a push succeeds.
 * Every record is tracked with a per-record `updatedAt` (client clock) and a
 * content hash. Deltas newer than `lastSyncedAt` are pushed (debounced by the
 * caller); pulls merge server changes with last-write-wins per record, keeping
 * the local copy on same-second ties. Tombstones propagate deletions so other
 * devices converge. Nothing here blocks local use when sync is offline — dirty
 * records stay queued in the persisted meta and are retried on reconnect.
 */
import type { AnalysisRecord, Template, BoardItem } from "@/lib/types";
import { readStorage, writeStorage } from "@/lib/storage";

export type SyncCollection = "history" | "templates" | "board" | "settings";

export type SyncChange = {
  collection: SyncCollection;
  id: string;
  updatedAt: number;
  deleted: boolean;
  record?: unknown;
};

export type SyncCollections = {
  history: AnalysisRecord[];
  templates: Template[];
  board: BoardItem[];
};

type RecordMeta = { updatedAt: number; hash: string };

export type SyncMeta = {
  lastSyncedAt: number;
  lastSyncedTheme: string | null;
  lastSyncedThemeAt: number;
  records: {
    history: Record<string, RecordMeta>;
    templates: Record<string, RecordMeta>;
    board: Record<string, RecordMeta>;
  };
  deleted: {
    history: Record<string, number>;
    templates: Record<string, number>;
    board: Record<string, number>;
  };
  lastSyncAt: number | null;
  lastSyncStatus: "ok" | "error" | null;
};

const SYNC_META_KEY = "taskmind:sync-meta";
const COLLECTIONS = ["history", "templates", "board"] as const;

type MetaCollection = (typeof COLLECTIONS)[number];

export function emptySyncMeta(): SyncMeta {
  return {
    lastSyncedAt: 0,
    lastSyncedTheme: null,
    lastSyncedThemeAt: 0,
    records: { history: {}, templates: {}, board: {} },
    deleted: { history: {}, templates: {}, board: {} },
    lastSyncAt: null,
    lastSyncStatus: null,
  };
}

export function loadSyncMeta(): SyncMeta {
  const raw = readStorage<Partial<SyncMeta> | null>(SYNC_META_KEY, null);
  if (!raw || typeof raw !== "object") return emptySyncMeta();
  const base = emptySyncMeta();
  return {
    ...base,
    ...raw,
    lastSyncedAt:
      typeof raw.lastSyncedAt === "number" ? raw.lastSyncedAt : 0,
    lastSyncedTheme:
      typeof raw.lastSyncedTheme === "string" ? raw.lastSyncedTheme : null,
    lastSyncedThemeAt:
      typeof raw.lastSyncedThemeAt === "number" ? raw.lastSyncedThemeAt : 0,
    records: {
      history: { ...(raw.records?.history ?? {}) },
      templates: { ...(raw.records?.templates ?? {}) },
      board: { ...(raw.records?.board ?? {}) },
    },
    deleted: {
      history: { ...(raw.deleted?.history ?? {}) },
      templates: { ...(raw.deleted?.templates ?? {}) },
      board: { ...(raw.deleted?.board ?? {}) },
    },
  };
}

export function saveSyncMeta(meta: SyncMeta): void {
  writeStorage(SYNC_META_KEY, meta);
}

type SyncRecord = { id: string };

/** Stable content fingerprint used to detect local edits between renders. */
function fnv1a32(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function hashRecord(value: unknown): string {
  const s = JSON.stringify(value ?? null);
  const a = fnv1a32(s, 0x811c9dc5);
  const b = fnv1a32(s, 0x01000193);
  return `${a.toString(36)}-${b.toString(36)}`;
}

/**
 * Diffs `next` against the previously-seen `prev` arrays and stamps local
 * changes into `meta` (new/changed records get a fresh `updatedAt`, removed
 * records become tombstones). Reloads that produce identical content are a
 * no-op, so a page refresh never re-pushes everything. Mutates and returns the
 * number of records that became dirty.
 */
export function trackCollections(
  meta: SyncMeta,
  prev: SyncCollections,
  next: SyncCollections
): number {
  const now = Date.now();
  let changed = 0;
  for (const col of COLLECTIONS) {
    const prevById = new Map(prev[col].map((r) => [r.id, r]));
    const recMeta = meta.records[col];
    const deleted = meta.deleted[col];

    for (const record of next[col]) {
      const existing = recMeta[record.id];
      const hash = hashRecord(record);
      if (!existing || existing.hash !== hash) {
        recMeta[record.id] = { updatedAt: now, hash };
        if (deleted[record.id] != null) delete deleted[record.id];
        changed++;
      }
    }
    for (const id of prevById.keys()) {
      if (!next[col].some((r) => r.id === id)) {
        if (deleted[id] == null) {
          deleted[id] = now;
          changed++;
        }
      }
    }
  }
  return changed;
}

/** Settings/theme delta to push when the local theme changed. */
export function makeThemeChange(
  meta: SyncMeta,
  theme: string
): SyncChange | null {
  if (theme === meta.lastSyncedTheme) return null;
  return {
    collection: "settings",
    id: "theme",
    updatedAt: Date.now(),
    deleted: false,
    record: { key: "theme", value: theme },
  };
}

/** Builds the delta to push: records/tombstones newer than `lastSyncedAt`. */
export function dirtyChanges(
  meta: SyncMeta,
  collections: SyncCollections,
  theme: string
): SyncChange[] {
  const changes: SyncChange[] = [];
  for (const col of COLLECTIONS) {
    const recMeta = meta.records[col];
    const byId = new Map(collections[col].map((r) => [r.id, r]));
    for (const id of Object.keys(recMeta)) {
      const { updatedAt } = recMeta[id];
      if (updatedAt <= meta.lastSyncedAt) continue;
      if (meta.deleted[col][id] != null) {
        changes.push({ collection: col, id, updatedAt, deleted: true });
      } else {
        const record = byId.get(id);
        if (record) {
          changes.push({ collection: col, id, updatedAt, deleted: false, record });
        }
      }
    }
  }
  const t = makeThemeChange(meta, theme);
  if (t) changes.push(t);
  return changes;
}

/** Full snapshot push (back-up now): every live record, tombstone and theme. */
export function allChanges(
  meta: SyncMeta,
  collections: SyncCollections,
  theme: string
): SyncChange[] {
  const changes: SyncChange[] = [];
  for (const col of COLLECTIONS) {
    for (const record of collections[col]) {
      const updatedAt = meta.records[col][record.id]?.updatedAt ?? Date.now();
      changes.push({ collection: col, id: record.id, updatedAt, deleted: false, record });
    }
    for (const id of Object.keys(meta.deleted[col])) {
      changes.push({
        collection: col,
        id,
        updatedAt: meta.deleted[col][id],
        deleted: true,
      });
    }
  }
  const t = makeThemeChange(meta, theme);
  if (t) changes.push(t);
  return changes;
}

function upsertOrdered<T extends SyncRecord>(
  list: T[],
  record: T,
  col: MetaCollection
): T[] {
  const idx = list.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    const out = [...list];
    out[idx] = record;
    return out;
  }
  if (col === "history") {
    const ts = (record as { timestamp?: number }).timestamp ?? 0;
    const at = list.findIndex(
      (r) => ((r as { timestamp?: number }).timestamp ?? 0) < ts
    );
    if (at < 0) return [record, ...list];
    return [...list.slice(0, at), record, ...list.slice(at)];
  }
  return [record, ...list];
}

/**
 * Merges server `changes` into the local collections with last-write-wins per
 * record (server wins strictly newer; ties keep the local copy). History
 * tombstones also remove the matching board items. Mutates `meta` so the
 * winner's clock is recorded and convergence is visible to `dirtyChanges`.
 */
export function mergeSyncChanges(
  current: SyncCollections,
  changes: SyncChange[],
  meta: SyncMeta
): { next: SyncCollections } {
  const next: SyncCollections = {
    history: [...current.history],
    templates: [...current.templates],
    board: [...current.board],
  };

  const byCol: Record<MetaCollection, Map<string, SyncChange>> = {
    history: new Map(),
    templates: new Map(),
    board: new Map(),
  };
  for (const c of changes) {
    if (c.collection === "settings") continue;
    const map = byCol[c.collection];
    const existing = map.get(c.id);
    if (!existing || c.updatedAt > existing.updatedAt) map.set(c.id, c);
  }

  // History first — a tombstone may also clear its board items.
  for (const c of byCol.history.values()) {
    const local = meta.records.history[c.id]?.updatedAt ?? 0;
    if (c.deleted) {
      if (c.updatedAt > local) {
        next.history = next.history.filter((r) => r.id !== c.id);
        next.board = next.board.filter((i) => i.sourceId !== c.id);
        delete meta.records.history[c.id];
        delete meta.deleted.history[c.id];
      }
      continue;
    }
    const record = c.record as AnalysisRecord | undefined;
    if (!record || record.id !== c.id) continue;
    if (c.updatedAt > local) {
      next.history = upsertOrdered(next.history, record, "history");
      meta.records.history[c.id] = { updatedAt: c.updatedAt, hash: hashRecord(record) };
      if (meta.deleted.history[c.id] != null) delete meta.deleted.history[c.id];
    } else if (c.updatedAt === local) {
      meta.records.history[c.id] = { updatedAt: c.updatedAt, hash: hashRecord(record) };
    }
  }

  for (const c of byCol.templates.values()) {
    const local = meta.records.templates[c.id]?.updatedAt ?? 0;
    if (c.deleted) {
      if (c.updatedAt > local) {
        next.templates = next.templates.filter((r) => r.id !== c.id);
        delete meta.records.templates[c.id];
        delete meta.deleted.templates[c.id];
      }
      continue;
    }
    const record = c.record as Template | undefined;
    if (!record || record.id !== c.id) continue;
    if (c.updatedAt > local) {
      next.templates = upsertOrdered(next.templates, record, "templates");
      meta.records.templates[c.id] = { updatedAt: c.updatedAt, hash: hashRecord(record) };
      if (meta.deleted.templates[c.id] != null) delete meta.deleted.templates[c.id];
    } else if (c.updatedAt === local) {
      meta.records.templates[c.id] = { updatedAt: c.updatedAt, hash: hashRecord(record) };
    }
  }

  for (const c of byCol.board.values()) {
    const local = meta.records.board[c.id]?.updatedAt ?? 0;
    if (c.deleted) {
      if (c.updatedAt > local) {
        next.board = next.board.filter((r) => r.id !== c.id);
        delete meta.records.board[c.id];
        delete meta.deleted.board[c.id];
      }
      continue;
    }
    const record = c.record as BoardItem | undefined;
    if (!record || record.id !== c.id) continue;
    if (c.updatedAt > local) {
      next.board = upsertOrdered(next.board, record, "board");
      meta.records.board[c.id] = { updatedAt: c.updatedAt, hash: hashRecord(record) };
      if (meta.deleted.board[c.id] != null) delete meta.deleted.board[c.id];
    } else if (c.updatedAt === local) {
      meta.records.board[c.id] = { updatedAt: c.updatedAt, hash: hashRecord(record) };
    }
  }

  return { next };
}

/** Max `updatedAt` across server changes (used to advance `lastSyncedAt`). */
export function maxChangeTime(changes: SyncChange[]): number {
  let max = 0;
  for (const c of changes) {
    if (c.updatedAt > max) max = c.updatedAt;
  }
  return max;
}

/** Pulled theme change that is newer than the last confirmed one, if any. */
export function pulledTheme(
  meta: SyncMeta,
  changes: SyncChange[]
): { theme: string; updatedAt: number } | null {
  for (const c of changes) {
    if (c.collection !== "settings" || c.id !== "theme" || c.deleted) continue;
    if (c.updatedAt > meta.lastSyncedThemeAt) {
      const theme = (c.record as { value?: unknown } | undefined)?.value;
      if (typeof theme === "string") {
        return { theme, updatedAt: c.updatedAt };
      }
    }
  }
  return null;
}
