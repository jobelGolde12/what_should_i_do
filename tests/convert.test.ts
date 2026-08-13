import { describe, it, expect } from "vitest";
import {
  convertFile,
  toPdf,
  toDocx,
  pdfToText,
  docxToText,
  imageToPdf,
} from "@/lib/convert";

const TEXT = "Hello TaskMind. This is a document conversion test.\n\nSecond paragraph with a second sentence.";

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

describe("conversion primitives", () => {
  it("toPdf produces a valid PDF buffer", async () => {
    const bytes = await toPdf(TEXT);
    expect(bytes[0]).toBe(0x25); // '%'
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    expect(header.startsWith("%PDF-")).toBe(true);
  });

  it("toDocx produces a valid DOCX (zip) buffer", async () => {
    const bytes = await toDocx(TEXT);
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
  });

  it("pdfToText recovers text written by toPdf", async () => {
    const pdf = await toPdf(TEXT);
    const text = await pdfToText(pdf);
    expect(text).toContain("Hello TaskMind");
    expect(text).toContain("document conversion test");
  });

  it("docxToText recovers text written by toDocx", async () => {
    const docx = await toDocx(TEXT);
    const text = await docxToText(docx);
    expect(text).toContain("Hello TaskMind");
  });
});

describe("convertFile", () => {
  it("converts txt -> pdf", async () => {
    const result = await convertFile({
      buffer: new TextEncoder().encode(TEXT),
      fileName: "notes.txt",
      mimeType: "text/plain",
      target: "pdf",
    });
    expect(result.mime).toBe("application/pdf");
    expect(result.fileName).toBe("notes.pdf");
    expect(new TextDecoder().decode(result.buffer.slice(0, 5))).toBe("%PDF-");
  });

  it("converts txt -> docx", async () => {
    const result = await convertFile({
      buffer: new TextEncoder().encode(TEXT),
      fileName: "notes.txt",
      mimeType: "text/plain",
      target: "docx",
    });
    expect(result.mime).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(result.fileName).toBe("notes.docx");
  });

  it("converts pdf -> txt via text extraction", async () => {
    const pdf = await toPdf(TEXT);
    const result = await convertFile({
      buffer: pdf,
      fileName: "notes.pdf",
      mimeType: "application/pdf",
      target: "txt",
    });
    expect(result.mime).toBe("text/plain");
    expect(result.fileName).toBe("notes.txt");
    expect(new TextDecoder().decode(result.buffer)).toContain("Hello TaskMind");
  });

  it("converts docx -> pdf via text extraction", async () => {
    const docx = await toDocx(TEXT);
    const result = await convertFile({
      buffer: docx,
      fileName: "notes.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      target: "pdf",
    });
    expect(result.mime).toBe("application/pdf");
    expect(result.fileName).toBe("notes.pdf");
  });

  it("embeds a PNG image into a PDF", async () => {
    const png = base64ToBytes(PNG_1PX);
    const result = await convertFile({
      buffer: png,
      fileName: "photo.png",
      mimeType: "image/png",
      target: "pdf",
    });
    expect(result.mime).toBe("application/pdf");
    expect(new TextDecoder().decode(result.buffer.slice(0, 5))).toBe("%PDF-");
  });

  it("rejects converting a format to itself", async () => {
    await expect(
      convertFile({
        buffer: new TextEncoder().encode(TEXT),
        fileName: "notes.txt",
        mimeType: "text/plain",
        target: "txt",
      })
    ).rejects.toThrow("already in that format");
  });

  it("rejects unsupported source files", async () => {
    await expect(
      convertFile({
        buffer: new TextEncoder().encode("x"),
        fileName: "archive.zip",
        mimeType: "application/zip",
        target: "pdf",
      })
    ).rejects.toThrow("Unsupported source");
  });

  it("imageToPdf embeds directly", async () => {
    const pdf = await imageToPdf(base64ToBytes(PNG_1PX), "image/png");
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
