import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createUser,
  findUserById,
  updateUserData,
  applySyncChanges,
  getSyncChanges,
  isSyncChange,
  type SyncChange,
} from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/session";
import { getDb, ensureSchema } from "@/lib/db";
import {
  type SyncCollections,
  type SyncChange as ClientChange,
  emptySyncMeta,
  trackCollections,
  dirtyChanges,
  allChanges,
  mergeSyncChanges,
  maxChangeTime,
  pulledTheme,
  hashRecord,
} from "@/lib/sync";
import type { AnalysisRecord, Template, BoardItem } from "@/lib/types";

async function clearTables() {
  await ensureSchema();
  const db = getDb();
  await db.execute("DELETE FROM email_verifications");
  await db.execute("DELETE FROM password_resets");
  await db.execute("DELETE FROM analyses");
  await db.execute("DELETE FROM board_items");
  await db.execute("DELETE FROM templates");
  await db.execute("DELETE FROM user_settings");
  await db.execute("DELETE FROM rate_limits");
  await db.execute("DELETE FROM users");
}

function analysis(id: string, timestamp: number, summary = "s"): AnalysisRecord {
  return {
    id,
    timestamp,
    input: `input ${id}`,
    output: {
      summary,
      actions: ["do it"],
      deadlines: [],
      urgency: "Important",
      confusingParts: [],
      nextStep: "do it",
      analysisMethod: "fallback",
    },
  };
}

function template(id: string, createdAt: number, name = "t"): Template {
  return { id, name, content: "content", createdAt };
}

function boardItem(id: string, sourceId: string, createdAt: number): BoardItem {
  return {
    id,
    sourceId,
    sourceIndex: 0,
    text: "task",
    urgency: "Important",
    status: "todo",
    createdAt,
  };
}

describe("Server-side incremental sync (applySyncChanges / getSyncChanges)", () => {
  beforeEach(async () => {
    await clearTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  it("rejects changes older than the stored version (last-write-wins)", async () => {
    const user = await createUser("lww@example.com", hashPassword("secret123"));

    const first: SyncChange = {
      collection: "history",
      id: "a1",
      updatedAt: 2000,
      deleted: false,
      record: analysis("a1", 1000),
    };
    expect(await applySyncChanges(user.id, [first])).toHaveLength(0);

    const stale: SyncChange = {
      collection: "history",
      id: "a1",
      updatedAt: 1000,
      deleted: false,
      record: analysis("a1", 1000, "older"),
    };
    const rejected = await applySyncChanges(user.id, [stale]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].collection).toBe("history");
    expect(rejected[0].updatedAt).toBe(2000);

    const loaded = await findUserById(user.id);
    expect(loaded?.data.history).toHaveLength(1);
    expect(
      (loaded?.data.history[0] as AnalysisRecord).output.summary
    ).toBe("s");
  });

  it("is idempotent: re-pushing the same change never duplicates", async () => {
    const user = await createUser("idem@example.com", hashPassword("secret123"));
    const change: SyncChange = {
      collection: "templates",
      id: "t1",
      updatedAt: 1500,
      deleted: false,
      record: template("t1", 1000),
    };
    await applySyncChanges(user.id, [change]);
    const rejected = await applySyncChanges(user.id, [change]);
    expect(rejected).toHaveLength(0);
    const loaded = await findUserById(user.id);
    expect(loaded?.data.templates).toHaveLength(1);
  });

  it("propagates tombstones and removes them from the full snapshot", async () => {
    const user = await createUser("tomb@example.com", hashPassword("secret123"));
    await applySyncChanges(user.id, [
      { collection: "history", id: "a1", updatedAt: 1000, deleted: false, record: analysis("a1", 1000) },
      { collection: "board", id: "b1", updatedAt: 1001, deleted: false, record: boardItem("b1", "a1", 1000) },
    ]);

    await applySyncChanges(user.id, [
      { collection: "history", id: "a1", updatedAt: 3000, deleted: true },
      { collection: "board", id: "b1", updatedAt: 3001, deleted: true },
    ]);

    // Full snapshot no longer contains the deleted rows.
    const loaded = await findUserById(user.id);
    expect(loaded?.data.history).toHaveLength(0);
    expect(loaded?.data.board).toHaveLength(0);

    // Incremental pull since 0 surfaces the tombstones.
    const changes = await getSyncChanges(user.id, 0);
    const historyTombstone = changes.find(
      (c) => c.collection === "history" && c.id === "a1"
    );
    expect(historyTombstone?.deleted).toBe(true);
    expect(historyTombstone?.updatedAt).toBe(3000);
    expect(historyTombstone?.record).toBeUndefined();
  });

  it("resurrects a record when a newer non-deleted change arrives", async () => {
    const user = await createUser("resurrect@example.com", hashPassword("secret123"));
    await applySyncChanges(user.id, [
      { collection: "history", id: "a1", updatedAt: 1000, deleted: false, record: analysis("a1", 1000) },
    ]);
    await applySyncChanges(user.id, [
      { collection: "history", id: "a1", updatedAt: 2000, deleted: true },
    ]);
    expect((await findUserById(user.id))?.data.history).toHaveLength(0);

    const rejected = await applySyncChanges(user.id, [
      { collection: "history", id: "a1", updatedAt: 3000, deleted: false, record: analysis("a1", 3000, "back") },
    ]);
    expect(rejected).toHaveLength(0);
    const loaded = await findUserById(user.id);
    expect(loaded?.data.history).toHaveLength(1);
    expect((loaded?.data.history[0] as AnalysisRecord).output.summary).toBe("back");
  });

  it("filters getSyncChanges by since and returns only newer records", async () => {
    const user = await createUser("since@example.com", hashPassword("secret123"));
    await applySyncChanges(user.id, [
      { collection: "history", id: "a1", updatedAt: 1000, deleted: false, record: analysis("a1", 1000) },
      { collection: "history", id: "a2", updatedAt: 2000, deleted: false, record: analysis("a2", 2000) },
      { collection: "board", id: "b1", updatedAt: 1500, deleted: false, record: boardItem("b1", "a1", 1000) },
    ]);

    const later = await getSyncChanges(user.id, 1200);
    const ids = later.map((c) => `${c.collection}:${c.id}`);
    expect(ids).toContain("history:a2");
    expect(ids).toContain("board:b1");
    expect(ids).not.toContain("history:a1");

    const everything = await getSyncChanges(user.id, 0);
    expect(everything.map((c) => c.id).sort()).toEqual(["a1", "a2", "b1"]);
  });

  it("syncs user settings with LWW and validates deltas", async () => {
    const user = await createUser("sett@example.com", hashPassword("secret123"));
    await applySyncChanges(user.id, [
      { collection: "settings", id: "theme", updatedAt: 1000, deleted: false, record: { key: "theme", value: "dark" } },
    ]);
    const changes = await getSyncChanges(user.id, 0);
    expect(changes).toHaveLength(1);
    expect(changes[0].collection).toBe("settings");
    expect(changes[0].record).toEqual({ key: "theme", value: "dark" });

    const rejected = await applySyncChanges(user.id, [
      { collection: "settings", id: "theme", updatedAt: 900, deleted: false, record: { key: "theme", value: "light" } },
    ]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].record).toEqual({ key: "theme", value: "dark" });

    expect(isSyncChange({ collection: "history", id: "x", updatedAt: 1, deleted: false, record: {} })).toBe(true);
    expect(isSyncChange({ collection: "history", id: "x", updatedAt: -1, deleted: false })).toBe(false);
    expect(isSyncChange({ collection: "nope", id: "x", updatedAt: 1, deleted: false })).toBe(false);
    expect(isSyncChange(null)).toBe(false);
    expect(isSyncChange({ collection: "history", id: "x", updatedAt: 1, deleted: false })).toBe(false);
  });

  it("preserves sourceLabel through full and incremental sync", async () => {
    const user = await createUser("label@example.com", hashPassword("secret123"));
    const withLabel: AnalysisRecord = { ...analysis("a1", 1000), sourceLabel: "notes.txt" };
    await updateUserData(user.id, { history: [withLabel], templates: [], board: [] });
    let loaded = await findUserById(user.id);
    expect((loaded?.data.history[0] as AnalysisRecord).sourceLabel).toBe("notes.txt");

    const pulled = await getSyncChanges(user.id, 0);
    expect((pulled[0].record as AnalysisRecord).sourceLabel).toBe("notes.txt");

    await applySyncChanges(user.id, [
      { collection: "history", id: "a1", updatedAt: Date.now() + 10_000, deleted: true },
    ]);
    loaded = await findUserById(user.id);
    expect(loaded?.data.history).toHaveLength(0);
  });
});

describe("Client-side sync engine", () => {
  function collections(overrides?: Partial<SyncCollections>): SyncCollections {
    return {
      history: [analysis("a1", 1000)],
      templates: [template("t1", 1000)],
      board: [boardItem("b1", "a1", 1000)],
      ...overrides,
    };
  }

  it("hashes stable content deterministically", () => {
    const r = analysis("a1", 1000);
    expect(hashRecord(r)).toBe(hashRecord(analysis("a1", 1000)));
    expect(hashRecord(r)).not.toBe(hashRecord(analysis("a1", 1000, "other")));
    expect(hashRecord(null)).toBe(hashRecord(undefined));
  });

  it("trackCollections marks adds/edits/deletes but not identical reloads", () => {
    const meta = emptySyncMeta();
    const prev = { history: [], templates: [], board: [] };
    const next = collections();

    // First pass: everything is new.
    expect(trackCollections(meta, prev, next)).toBe(3);
    expect(Object.keys(meta.records.history)).toHaveLength(1);

    // A reload with identical content is a no-op.
    expect(trackCollections(meta, next, collections())).toBe(0);

    // An edit to the history record is detected.
    const edited = { ...next, history: [analysis("a1", 1000, "edited")] };
    expect(trackCollections(meta, next, edited)).toBe(1);

    // A removal becomes a tombstone.
    const removed = { ...edited, history: [] };
    expect(trackCollections(meta, edited, removed)).toBe(1);
    expect(meta.deleted.history["a1"]).toBeGreaterThan(0);
  });

  it("dirtyChanges returns only records newer than lastSyncedAt plus theme", () => {
    const meta = emptySyncMeta();
    const next = collections();
    trackCollections(meta, { history: [], templates: [], board: [] }, next);

    const dirty = dirtyChanges(meta, next, "system");
    expect(dirty).toHaveLength(4); // 3 records + theme
    expect(dirty.filter((c) => c.collection === "settings")).toHaveLength(1);

    // Advance lastSyncedAt past every change -> nothing dirty.
    meta.lastSyncedAt = Date.now();
    meta.lastSyncedTheme = "system";
    expect(dirtyChanges(meta, next, "system")).toHaveLength(0);

    // Tombstone becomes a deleted delta.
    meta.lastSyncedAt = 0;
    meta.lastSyncedTheme = "system";
    trackCollections(meta, next, { ...next, board: [] });
    const withTombstone = dirtyChanges(meta, { ...next, board: [] }, "system");
    const tomb = withTombstone.find((c) => c.collection === "board");
    expect(tomb?.deleted).toBe(true);
  });

  it("allChanges snapshots every record, tombstone and theme", () => {
    const meta = emptySyncMeta();
    const next = collections();
    trackCollections(meta, { history: [], templates: [], board: [] }, next);
    meta.deleted.templates["t1"] = 1234;

    const full = allChanges(meta, { ...next, templates: [] }, "dark");
    expect(full).toHaveLength(4); // history + board + tombstone + theme
    const t = full.find((c) => c.collection === "templates" && c.id === "t1");
    expect(t?.deleted).toBe(true);
  });

  it("mergeSyncChanges: server newer wins, local newer wins, ties keep local", () => {
    const meta = emptySyncMeta();
    const next = collections();
    trackCollections(meta, { history: [], templates: [], board: [] }, next);
    const localUpdatedAt = meta.records.history["a1"].updatedAt;

    // Server strictly newer -> server replaces local.
    const newer: ClientChange = {
      collection: "history",
      id: "a1",
      updatedAt: localUpdatedAt + 10_000,
      deleted: false,
      record: analysis("a1", 1000, "server"),
    };
    const merged = mergeSyncChanges(next, [newer], meta);
    expect((merged.next.history[0] as AnalysisRecord).output.summary).toBe("server");
    expect(meta.records.history["a1"].updatedAt).toBe(localUpdatedAt + 10_000);

    // Local newer -> local kept.
    const stale: ClientChange = {
      collection: "history",
      id: "a1",
      updatedAt: localUpdatedAt - 1000,
      deleted: false,
      record: analysis("a1", 1000, "stale"),
    };
    const kept = mergeSyncChanges(merged.next, [stale], meta);
    expect((kept.next.history[0] as AnalysisRecord).output.summary).toBe("server");
  });

  it("mergeSyncChanges: tombstone removes history and its board items", () => {
    const meta = emptySyncMeta();
    const next = collections();
    trackCollections(meta, { history: [], templates: [], board: [] }, next);
    const tomb: ClientChange = {
      collection: "history",
      id: "a1",
      updatedAt: meta.records.history["a1"].updatedAt + 10_000,
      deleted: true,
    };
    const merged = mergeSyncChanges(next, [tomb], meta);
    expect(merged.next.history).toHaveLength(0);
    expect(merged.next.board).toHaveLength(0);
  });

  it("mergeSyncChanges: adds new server records and ignores stale tombstones", () => {
    const meta = emptySyncMeta();
    const next = { history: [], templates: [], board: [] };
    const change: ClientChange = {
      collection: "history",
      id: "a9",
      updatedAt: 5000,
      deleted: false,
      record: analysis("a9", 5000),
    };
    const merged = mergeSyncChanges(next, [change], meta);
    expect(merged.next.history).toHaveLength(1);
    expect(merged.next.history[0].id).toBe("a9");

    // A stale tombstone (older than the record we just accepted) is ignored.
    const staleTomb: ClientChange = {
      collection: "history",
      id: "a9",
      updatedAt: 1000,
      deleted: true,
    };
    const kept = mergeSyncChanges(merged.next, [staleTomb], meta);
    expect(kept.next.history).toHaveLength(1);
  });

  it("maxChangeTime and pulledTheme helpers work", () => {
    const changes: ClientChange[] = [
      { collection: "history", id: "a", updatedAt: 100, deleted: false, record: analysis("a", 100) },
      { collection: "history", id: "b", updatedAt: 300, deleted: true },
    ];
    expect(maxChangeTime(changes)).toBe(300);

    const meta = emptySyncMeta();
    const themeChanges: ClientChange[] = [
      { collection: "settings", id: "theme", updatedAt: 400, deleted: false, record: { key: "theme", value: "dark" } },
    ];
    expect(pulledTheme(meta, themeChanges)).toEqual({ theme: "dark", updatedAt: 400 });
    meta.lastSyncedThemeAt = 500;
    expect(pulledTheme(meta, themeChanges)).toBeNull();
  });
});
