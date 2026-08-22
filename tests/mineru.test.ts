import { describe, expect, it } from "vitest";
import {
  isMineruCandidate,
  extractMarkdown,
  MineruUnsupportedError,
  FLASH_MAX_BYTES,
} from "@/lib/mineru";

describe("isMineruCandidate", () => {
  it("accepts supported document extensions", () => {
    for (const ext of [
      "pdf",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "bmp",
      "tiff",
      "tif",
      "docx",
      "pptx",
      "xlsx",
      "html",
      "htm",
    ]) {
      expect(isMineruCandidate(`report.${ext}`, "")).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(isMineruCandidate("Report.PDF", "")).toBe(true);
  });

  it("excludes txt files even with a plain-text MIME", () => {
    expect(isMineruCandidate("notes.txt", "text/plain")).toBe(false);
  });

  it("excludes unknown extensions without a helpful MIME", () => {
    expect(isMineruCandidate("data.xyz", "")).toBe(false);
    expect(isMineruCandidate("archive.7z", "application/octet-stream")).toBe(
      false
    );
  });

  it("accepts any image MIME type", () => {
    expect(isMineruCandidate("scan.webp", "image/webp")).toBe(true);
  });

  it("accepts HTML by content type regardless of extension", () => {
    expect(isMineruCandidate("page.download", "text/html")).toBe(true);
  });
});

describe("extractMarkdown routing", () => {
  it("rejects non-candidate files before touching the SDK", async () => {
    await expect(
      extractMarkdown({
        buffer: new Uint8Array([1, 2, 3]),
        fileName: "notes.txt",
        mimeType: "text/plain",
      })
    ).rejects.toBeInstanceOf(MineruUnsupportedError);

    await expect(
      extractMarkdown({
        buffer: new Uint8Array([1, 2, 3]),
        fileName: "blob.bin",
        mimeType: "",
      })
    ).rejects.toBeInstanceOf(MineruUnsupportedError);
  });
});

describe("flash limits", () => {
  it("caps flash mode at 10 MB", () => {
    expect(FLASH_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});
