import type { createClient } from "@libsql/client";

/**
 * The libSQL/Turso client type. Using `ReturnType` keeps this in sync with
 * whatever `@libsql/client` exports, regardless of version.
 */
export type TursoClient = ReturnType<typeof createClient>;
