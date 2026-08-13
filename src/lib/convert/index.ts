/**
 * Document conversion primitives (Pro).
 *
 * Chosen strategy (documented in `pro-plan/features/02-document-conversion.md`):
 * option (b) — the "lossy" path. No server-side LibreOffice: conversions go
 * through text. PDF → DOCX is PDF→text→DOCX and DOCX→PDF is DOCX→text→PDF,
 * clearly best-effort. Images → PDF embed the image bytes directly (lossless,
 * no OCR needed). Nothing is ever written to disk.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from "docx";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import * as mammoth from "mammoth";

export type ConvertFormat = "pdf" | "docx" | "txt";

export const CONVERT_MIMES: Record<ConvertFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export const CONVERT_EXTENSIONS: Record<ConvertFormat, string> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
};

export type ConvertResult = {
  buffer: Uint8Array;
  mime: string;
  fileName: string;
};

const PAGE = { width: 595, height: 842 }; // A4 portrait points

function detectSourceFormat(fileName: string, mimeType: string): ConvertFormat | null {
  const ext = (fileName.toLowerCase().split(".").pop() ?? "").trim();
  if (mimeType === "text/plain" || ext === "txt") return "txt";
  if (
    mimeType === "application/pdf" ||
    ext === "pdf"
  ) {
    return "pdf";
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return "docx";
  }
  if (mimeType.startsWith("image/") || ext === "png" || ext === "jpg" || ext === "jpeg") {
    return "txt"; // handled specially by imageToPdf below via mime
  }
  return null;
}

/** Extracts plain text from a PDF buffer (pdf.js legacy build). */
export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const task = pdfjs.getDocument({ data: bytes });
  const pdf = await task.promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    parts.push(line.trim());
  }
  await pdf.destroy();
  return parts.filter(Boolean).join("\n\n");
}

/** Extracts plain text from a DOCX buffer (mammoth, works in Node). */
export async function docxToText(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value.trim();
}

/** Builds a PDF from plain text with simple wrapped paragraphs (best-effort). */
export async function toPdf(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = 56;
  const lineHeight = fontSize * 1.4;
  const maxWidth = PAGE.width - margin * 2;

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const lines = paragraphs.flatMap((p) =>
    wrapText(p, font, fontSize, maxWidth)
  );

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - margin;

  for (const line of lines) {
    if (y - lineHeight < margin) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - margin;
    }
    page.drawText(line, { x: margin, y: y - lineHeight, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;
  }

  return doc.save();
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Builds a .docx buffer from plain text (paragraph per blank-line block). */
export async function toDocx(text: string): Promise<Uint8Array> {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160 },
          children: [
            new TextRun({ text: p, font: "Calibri", size: 22 }), // 11pt
          ],
        })
    );

  const doc = new DocxDocument({
    sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph({ children: [] })] }],
  });
  return Packer.toBuffer(doc);
}

/** Embeds a JPG/PNG image into a single-page PDF (lossless). */
export async function imageToPdf(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const isPng = mime === "image/png";
  const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const { width, height } = image.scaleToFit(PAGE.width, PAGE.height);
  const page = doc.addPage([PAGE.width, PAGE.height]);
  page.drawImage(image, {
    x: (PAGE.width - width) / 2,
    y: (PAGE.height - height) / 2,
    width,
    height,
  });
  return doc.save();
}

/**
 * Converts an uploaded file buffer to `target`. Returns the converted buffer +
 * metadata. Rejects on unsupported source or same-format requests.
 */
export async function convertFile(opts: {
  buffer: Uint8Array;
  fileName: string;
  mimeType: string;
  target: ConvertFormat;
}): Promise<ConvertResult> {
  const source = detectSourceFormat(opts.fileName, opts.mimeType);
  const isImage = opts.mimeType.startsWith("image/");

  if (!source && !isImage) {
    throw new Error("Unsupported source file type.");
  }
  if (source === opts.target && !isImage) {
    throw new Error("The file is already in that format.");
  }

  const baseName = opts.fileName.replace(/\.[^.]+$/, "") || "document";

  switch (opts.target) {
    case "txt": {
      if (source === "pdf") {
        const text = await pdfToText(opts.buffer);
        return { buffer: new TextEncoder().encode(text), mime: CONVERT_MIMES.txt, fileName: `${baseName}.txt` };
      }
      if (source === "docx") {
        const text = await docxToText(opts.buffer);
        return { buffer: new TextEncoder().encode(text), mime: CONVERT_MIMES.txt, fileName: `${baseName}.txt` };
      }
      throw new Error("Can only convert a PDF or DOCX to text.");
    }
    case "docx": {
      if (source === "txt") {
        const text = new TextDecoder().decode(opts.buffer);
        return { buffer: await toDocx(text), mime: CONVERT_MIMES.docx, fileName: `${baseName}.docx` };
      }
      if (source === "pdf") {
        const text = await pdfToText(opts.buffer);
        return { buffer: await toDocx(text), mime: CONVERT_MIMES.docx, fileName: `${baseName}.docx` };
      }
      throw new Error("Can only convert a PDF or TXT file to Word.");
    }
    case "pdf": {
      if (isImage) {
        return { buffer: await imageToPdf(opts.buffer, opts.mimeType), mime: CONVERT_MIMES.pdf, fileName: `${baseName}.pdf` };
      }
      if (source === "txt") {
        const text = new TextDecoder().decode(opts.buffer);
        return { buffer: await toPdf(text), mime: CONVERT_MIMES.pdf, fileName: `${baseName}.pdf` };
      }
      if (source === "docx") {
        const text = await docxToText(opts.buffer);
        return { buffer: await toPdf(text), mime: CONVERT_MIMES.pdf, fileName: `${baseName}.pdf` };
      }
      throw new Error("Can only convert a DOCX, TXT, or image to PDF.");
    }
  }
}
