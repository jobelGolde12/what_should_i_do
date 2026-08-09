import { ensureSchema, getSchemaVersion, validateDbConfig } from "../src/lib/db/index";
import { logInfo } from "../src/lib/log";

async function main() {
  console.log("[db-migrate] Starting database migration check...");
  validateDbConfig();
  await ensureSchema();
  const version = await getSchemaVersion();
  console.log(`[db-migrate] Database schema is up to date at version ${version}.`);
  logInfo("db", { event: "migrate_success", version });
}

main().catch((err) => {
  console.error("[db-migrate] Migration failed:", err);
  process.exit(1);
});
