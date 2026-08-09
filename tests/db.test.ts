import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserData,
  deleteUser,
  upsertAnalysis,
  upsertTemplate,
  upsertBoardItem,
  setBoardItemStatus,
  deleteAnalysis,
  deleteTemplate,
  deleteBoardItem,
  upsertSetting,
  getSettings,
} from "@/lib/auth/users";
import { getDb, ensureSchema, getSchemaVersion } from "@/lib/db";
import { hashPassword } from "@/lib/auth/session";

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

describe("Turso Database Repository & Schema", () => {
  beforeEach(async () => {
    await clearTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  it("initializes schema and returns version >= 1", async () => {
    const version = await getSchemaVersion();
    expect(version).toBeGreaterThanOrEqual(1);
  });

  it("creates, finds, and deletes user accounts", async () => {
    const user = await createUser("dbtest@example.com", hashPassword("secret123"));
    expect(user.id).toBeDefined();
    expect(user.email).toBe("dbtest@example.com");

    const foundByEmail = await findUserByEmail("dbtest@example.com");
    expect(foundByEmail?.id).toBe(user.id);

    const foundById = await findUserById(user.id);
    expect(foundById?.email).toBe("dbtest@example.com");

    const deleted = await deleteUser(user.id);
    expect(deleted).toBe(true);

    const check = await findUserById(user.id);
    expect(check).toBeNull();
  });

  it("performs full user data replacement via updateUserData", async () => {
    const user = await createUser("sync@example.com", hashPassword("secret123"));

    const nextData = {
      history: [
        {
          id: "hist_1",
          timestamp: 1000,
          input: "do stuff",
          output: {
            summary: "done",
            actions: ["act 1"],
            deadlines: [],
            urgency: "Important",
            confusingParts: [],
            nextStep: "Do act 1",
            analysisMethod: "fallback",
          },
        },
      ],
      templates: [
        { id: "tmpl_1", name: "Daily Standup", content: "notes", createdAt: 1000 },
      ],
      board: [
        {
          id: "board_1",
          sourceId: "hist_1",
          sourceIndex: 0,
          text: "act 1",
          urgency: "Important" as const,
          status: "todo" as const,
          createdAt: 1000,
        },
      ],
    };

    const updated = await updateUserData(user.id, nextData);
    expect(updated?.data.history).toHaveLength(1);
    expect(updated?.data.templates).toHaveLength(1);
    expect(updated?.data.board).toHaveLength(1);
  });

  it("supports incremental record upserts and deletes", async () => {
    const user = await createUser("inc@example.com", hashPassword("secret123"));

    await upsertAnalysis(user.id, {
      id: "an_1",
      timestamp: 2000,
      input: "test input",
      output: {
        summary: "test sum",
        actions: [],
        deadlines: [],
        urgency: "Urgent",
        confusingParts: [],
        nextStep: "Test",
        analysisMethod: "ai",
      },
    });

    await upsertTemplate(user.id, {
      id: "tmpl_2",
      name: "Template 2",
      content: "content 2",
      createdAt: 2000,
    });

    await upsertBoardItem(user.id, {
      id: "b_1",
      sourceId: "an_1",
      sourceIndex: 0,
      text: "Task 1",
      urgency: "Urgent",
      status: "todo",
      createdAt: 2000,
    });

    let loaded = await findUserById(user.id);
    expect(loaded?.data.history).toHaveLength(1);
    expect(loaded?.data.templates).toHaveLength(1);
    expect(loaded?.data.board).toHaveLength(1);

    await setBoardItemStatus(user.id, "b_1", "done");
    loaded = await findUserById(user.id);
    expect((loaded?.data.board[0] as { status: string }).status).toBe("done");

    await deleteAnalysis(user.id, "an_1");
    await deleteTemplate(user.id, "tmpl_2");
    await deleteBoardItem(user.id, "b_1");

    loaded = await findUserById(user.id);
    expect(loaded?.data.history).toHaveLength(0);
    expect(loaded?.data.templates).toHaveLength(0);
    expect(loaded?.data.board).toHaveLength(0);
  });

  it("stores and retrieves per-user settings", async () => {
    const user = await createUser("settings@example.com", hashPassword("secret123"));

    await upsertSetting(user.id, "theme", "dark");
    await upsertSetting(user.id, "autoSync", true);

    const settings = await getSettings(user.id);
    expect(settings.theme).toBe("dark");
    expect(settings.autoSync).toBe(true);
  });
});
