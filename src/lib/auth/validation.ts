/**
 * Strict server-side validators for client-synced records (`/api/users/me`
 * PUT). `users.updateUserData` previously trusted the raw shapes cast to the
 * TypeScript types; these guards reject malformed or out-of-range records so a
 * hostile client can never write junk into the relational store.
 *
 * Philosophy: whitelist required fields with exact types + sane bounds; unknown
 * extra fields are ignored (never persisted) so forward-compatible clients
 * keep working.
 */
import type { AnalysisResult } from "@/app/actions/analyzeText";
import type { AnalysisRecord, BoardItem, Template } from "@/lib/types";
import type { UserData } from "./users";

const URGENCY_LEVELS: readonly string[] = ["Urgent", "Important", "Informational"];
const BOARD_STATUSES: readonly string[] = ["todo", "in-progress", "done"];
const ANALYSIS_METHODS: readonly string[] = ["ai", "fallback"];

const MAX_ID_LEN = 200;
const MAX_TEXT_LEN = 20_000;
const MAX_LABEL_LEN = 300;
const MAX_SOURCE_ID_LEN = 300;

function isFiniteNumber(v: unknown, min = 0): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min;
}

function isOptionalString(v: unknown, max: number): v is string | undefined {
  return v === undefined || (typeof v === "string" && v.length <= max);
}

export function isAnalysisResult(v: unknown): v is AnalysisResult {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.actions) || o.actions.some((a) => typeof a !== "string")) return false;
  if (!Array.isArray(o.deadlines) || o.deadlines.some((d) => typeof d !== "string")) return false;
  if (typeof o.summary !== "string") return false;
  if (typeof o.nextStep !== "string") return false;
  if (!Array.isArray(o.confusingParts)) return false;
  if (!URGENCY_LEVELS.includes(o.urgency as string)) return false;
  if (!ANALYSIS_METHODS.includes(o.analysisMethod as string)) return false;
  return true;
}

export function isAnalysisRecord(v: unknown): v is AnalysisRecord {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    o.id.length <= MAX_ID_LEN &&
    isFiniteNumber(o.timestamp) &&
    typeof o.input === "string" &&
    o.input.length <= MAX_TEXT_LEN &&
    isAnalysisResult(o.output) &&
    isOptionalString(o.sourceLabel, MAX_LABEL_LEN)
  );
}

export function isTemplateRecord(v: unknown): v is Template {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    o.id.length <= MAX_ID_LEN &&
    typeof o.name === "string" &&
    o.name.length <= MAX_TEXT_LEN &&
    typeof o.content === "string" &&
    o.content.length <= MAX_TEXT_LEN &&
    isFiniteNumber(o.createdAt)
  );
}

export function isBoardItemRecord(v: unknown): v is BoardItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    o.id.length <= MAX_ID_LEN &&
    typeof o.sourceId === "string" &&
    o.sourceId.length <= MAX_SOURCE_ID_LEN &&
    isFiniteNumber(o.sourceIndex) &&
    typeof o.text === "string" &&
    o.text.length <= MAX_TEXT_LEN &&
    URGENCY_LEVELS.includes(o.urgency as string) &&
    BOARD_STATUSES.includes(o.status as string) &&
    isFiniteNumber(o.createdAt)
  );
}

export type SyncBatchResult =
  | { ok: true; next: UserData }
  | { ok: false; reason: "invalid_record"; invalid: number };

/**
 * Validates a full `/users/me` PUT body against the record schemas. Rejects the
 * whole batch with `invalid_record` when ANY provided collection contains a
 * malformed record (all-or-nothing, so the client's local state never gets
 * partially overwritten by a buggy write).
 */
export function validateSyncBatch(body: {
  history?: unknown;
  templates?: unknown;
  board?: unknown;
}): SyncBatchResult {
  const collections: { key: "history" | "templates" | "board"; check: (v: unknown) => boolean }[] = [
    { key: "history", check: isAnalysisRecord },
    { key: "templates", check: isTemplateRecord },
    { key: "board", check: isBoardItemRecord },
  ];

  const next: UserData = { history: [], templates: [], board: [] };
  let invalid = 0;
  for (const { key, check } of collections) {
    const value = body[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) return { ok: false, reason: "invalid_record", invalid: 1 };
    const bad = value.some((v) => !check(v));
    if (bad) {
      invalid += value.filter((v) => !check(v)).length;
      return { ok: false, reason: "invalid_record", invalid };
    }
    next[key] = value as never;
  }
  return { ok: true, next };
}
