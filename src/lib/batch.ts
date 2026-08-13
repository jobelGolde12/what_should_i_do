/**
 * Batch-mode input parsing. Messages may be separated by a line of three or
 * more dashes (`---`) or by blank lines. The `---` separator takes priority so
 * paragraph breaks inside a single message don't accidentally split it.
 */
export function parseBatchMessages(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.includes("---")) {
    return trimmed
      .split(/^\s*-{3,}\s*$/m)
      .map((m) => m.trim())
      .filter(Boolean);
  }
  return trimmed
    .split(/\n{2,}/)
    .map((m) => m.trim())
    .filter(Boolean);
}
