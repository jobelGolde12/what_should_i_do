"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  UploadCloud,
  Sparkles,
  BookmarkPlus,
  Check,
  X,
  FileWarning,
  Loader2,
} from "lucide-react";
import { useTask } from "@/context/TaskContext";
import { Button } from "@/components/ui/Button";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".txt", ".pdf", ".docx", ".png", ".jpg", ".jpeg"];

type FileStatus = "idle" | "extracting" | "error";

export function extractTextFromFile(
  file: File,
  ocrLang = "eng"
): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(
      new Error("File is larger than 10 MB. Upload a smaller file.")
    );
  }

  const ext = file.name.toLowerCase().split(".").pop();

  // TXT (by extension or MIME)
  if (file.type === "text/plain" || ext === "txt") {
    return file.text();
  }

  // PDF
  if (file.type === "application/pdf" || ext === "pdf") {
    return extractPdf(file);
  }

  // DOCX
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return extractDocx(file);
  }

  // IMAGE (OCR)
  if (file.type.startsWith("image/") || ext === "png" || ext === "jpg" || ext === "jpeg") {
    return extractImage(file, ocrLang);
  }

  return Promise.reject(
    new Error(
      `Unsupported file type. Try ${ALLOWED_EXTENSIONS.join(", ")}.`
    )
  );
}

async function extractPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  type TextItem = { str: string };
  type TextMarkedContent = { type: string };

  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    out +=
      content.items
        .map((item: TextItem | TextMarkedContent) =>
          "str" in item ? item.str : ""
        )
        .join(" ") + "\n";
  }
  return out.trim();
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}

async function extractImage(file: File, lang: string): Promise<string> {
  const Tesseract = (await import("tesseract.js")).default;
  const ocrResult = await Tesseract.recognize(file, lang, {
    logger: () => {},
  });
  return ocrResult.data.text.trim();
}

type Props = {
  text: string;
  onTextChange: (text: string) => void;
  onAnalyze: (text: string) => void;
  loading: boolean;
};

export default function InputArea({
  text,
  onTextChange,
  onAnalyze,
  loading,
}: Props) {
  const { saveTemplate } = useTask();
  const [dragOver, setDragOver] = useState(false);
  const [pageDrag, setPageDrag] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileStatus, setFileStatus] = useState<FileStatus>("idle");
  const [fileError, setFileError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") onTextChange(detail);
    };
    window.addEventListener("taskmind:apply-template", handler);
    return () => window.removeEventListener("taskmind:apply-template", handler);
  }, [onTextChange]);

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setFileSize(file.size);
      setFileStatus("extracting");
      setFileError(null);
      try {
        const extracted = await extractTextFromFile(file);
        onTextChange(extracted);
        setFileStatus("idle");
        onAnalyze(extracted);
      } catch (err) {
        setFileStatus("error");
        setFileName(null);
        setFileSize(null);
        const message =
          err instanceof Error ? err.message : "Couldn't read that file.";
        setFileError(`Couldn't read that file. ${message}`);
      }
    },
    [onTextChange, onAnalyze]
  );

  // Whole-page drag & drop.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        setPageDrag(true);
      }
    };
    const onDragLeave = () => setPageDrag(false);
    const onDrop = (e: DragEvent) => {
      setPageDrag(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFile]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (text.trim()) onAnalyze(text);
    }
    if (e.key === "Escape" && text) {
      e.preventDefault();
      onTextChange("");
    }
  }

  function handleSaveTemplate() {
    if (!text.trim()) return;
    saveTemplate("", text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const canAnalyze = !loading && text.trim().length > 0;
  const extracting = fileStatus === "extracting";

  return (
    <>
      {pageDrag && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="border border-accent bg-accent-soft px-8 py-6 text-center">
            <UploadCloud className="mx-auto h-8 w-8 text-accent" />
            <p className="mt-2 font-mono text-xs uppercase tracking-label text-accent">
              Drop to upload
            </p>
            <p className="mt-1 text-xs text-muted">
              TXT · PDF · DOCX · JPG · PNG (max 10 MB)
            </p>
          </div>
        </div>
      )}

      <div
        id="analysis-input"
        className="scroll-mt-24 border border-line bg-background"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs uppercase tracking-label text-muted">
              Input
            </span>
            <span className="hidden text-xs text-muted sm:inline">
              · Paste text or drop a file
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveTemplate}
              disabled={!text.trim()}
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5 text-low" /> Saved
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-3.5 w-3.5" /> Save template
                </>
              )}
            </Button>
            {(text || fileName) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onTextChange("");
                  setFileName(null);
                  setFileSize(null);
                  setFileStatus("idle");
                  setFileError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div
          className="p-4 sm:p-5"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          <div
            className={`relative border transition-colors ${
              dragOver
                ? "border-accent bg-accent-soft"
                : "border-line focus-within:border-ink"
            }`}
          >
            <textarea
              id="analysis-textarea"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste a message, email, announcement, memo, or notice…"
              className="block h-56 w-full resize-none bg-transparent p-4 text-sm leading-relaxed text-ink outline-none placeholder:text-muted"
              aria-label="Text to analyze"
            />
            {dragOver && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent-soft/80">
                <p className="font-mono text-xs uppercase tracking-label text-accent">
                  Drop to upload
                </p>
              </div>
            )}
            {extracting && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-background/80">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <p className="font-mono text-xs uppercase tracking-label text-accent">
                  Extracting text…
                </p>
              </div>
            )}
          </div>

          {fileError && (
            <p
              role="alert"
              className="mt-2 flex items-center gap-2 text-xs text-high"
            >
              <FileWarning className="h-3.5 w-3.5 shrink-0" />
              {fileError}
            </p>
          )}

          {fileName && (
            <p className="mt-2 flex items-center gap-2 font-mono text-xs text-muted">
              <UploadCloud className="h-3.5 w-3.5" />
              {fileName}
              {fileSize !== null && (
                <span className="text-muted">
                  · {(fileSize / (1024 * 1024)).toFixed(1)} MB
                </span>
              )}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept=".txt,.pdf,.docx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex cursor-pointer items-center gap-2 self-start rounded-tm border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-ink hover:text-ink"
            >
              <UploadCloud className="h-4 w-4" />
              Upload file or image
              <span className="hidden text-muted sm:inline">
                · TXT, PDF, DOCX, JPG, PNG
              </span>
            </button>

            <Button
              size="lg"
              onClick={() => onAnalyze(text)}
              disabled={!canAnalyze}
              className="self-stretch sm:self-auto"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Analyzing…" : "Analyze"}
              <kbd className="ml-1 hidden rounded-tm bg-white/20 px-1.5 py-0.5 font-mono text-xxs sm:inline">
                ⌘↵
              </kbd>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Text is sent to an AI provider to generate results, then stored only
            in this browser.{" "}
            <a
              href="/privacy"
              className="font-medium text-accent underline-offset-2 hover:text-accent-dark hover:underline"
            >
              Privacy policy
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
