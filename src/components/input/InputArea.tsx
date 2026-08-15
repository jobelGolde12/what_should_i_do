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
  Layers3,
  BrainCircuit,
} from "lucide-react";
import { useTask } from "@/context/TaskContext";
import { Button } from "@/components/ui/Button";
import { usePlan } from "@/lib/pro/usePlan";
import { parseBatchMessages } from "@/lib/batch";
import ConversionPanel from "./ConversionPanel";

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

  // Worker copied to /public/pdfjs by scripts/self-host-assets.mjs so it is
  // served from the app origin ('self'). The production CSP is
  // `worker-src 'self' blob:`, so a cross-origin CDN worker would be blocked
  // and PDF extraction would fail.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

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
    // Self-hosted worker + core (copied to /public/tesseract by
    // scripts/self-host-assets.mjs). The production CSP
    // (`worker-src 'self' blob:`, `script-src 'self' ...`) blocks
    // cross-origin workers/importScripts, so the CDN defaults would fail.
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    logger: () => {},
  });
  return ocrResult.data.text.trim();
}

type Props = {
  text: string;
  onTextChange: (text: string) => void;
  onAnalyze: (text: string) => void;
  loading: boolean;
  onSourceLabel?: (label: string | null) => void;
  onAnalyzeBatch?: (texts: string[]) => void;
  batchLoading?: boolean;
  deep?: boolean;
  onDeepChange?: (deep: boolean) => void;
};

export default function InputArea({
  text,
  onTextChange,
  onAnalyze,
  loading,
  onSourceLabel,
  onAnalyzeBatch,
  batchLoading = false,
  deep = false,
  onDeepChange,
}: Props) {
  const { saveTemplate } = useTask();
  const { isPro } = usePlan();
  const [dragOver, setDragOver] = useState(false);
  const [pageDrag, setPageDrag] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
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

  const resetAll = useCallback(() => {
    onTextChange("");
    onSourceLabel?.(null);
    setBatchMode(false);
    setFileName(null);
    setFileSize(null);
    setUploadedFile(null);
    setFileStatus("idle");
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [onTextChange, onSourceLabel]);

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setFileSize(file.size);
      setUploadedFile(file);
      setFileStatus("extracting");
      setFileError(null);
      onSourceLabel?.(file.name);
      try {
        const extracted = await extractTextFromFile(file);
        onTextChange(extracted);
        setFileStatus("idle");
        // Fill the input for review instead of auto-analyzing, so the user
        // can check extracted text (esp. OCR/PDF noise) before running.
      } catch (err) {
        setFileStatus("error");
        setFileName(null);
        setFileSize(null);
        setUploadedFile(null);
        onSourceLabel?.(null);
        const message =
          err instanceof Error ? err.message : "Couldn't read that file.";
        setFileError(`Couldn't read that file. ${message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onTextChange, onSourceLabel]
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
      if (batchMode) {
        const messages = parseBatchMessages(text);
        if (messages.length > 0) onAnalyzeBatch?.(messages);
      } else if (text.trim()) {
        onAnalyze(text);
      }
    }
    if (e.key === "Escape" && (text || fileName)) {
      e.preventDefault();
      resetAll();
    }
  }

  function handleSaveTemplate() {
    if (!text.trim()) return;
    saveTemplate("", text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const batchMessages = batchMode ? parseBatchMessages(text) : [];
  const canAnalyze = !loading && !batchLoading && text.trim().length > 0;
  const canBatch = batchMode && batchMessages.length > 0 && !loading && !batchLoading;
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
            {isPro && onAnalyzeBatch && (
              <button
                type="button"
                onClick={() => setBatchMode((b) => !b)}
                aria-pressed={batchMode}
                className={`inline-flex items-center gap-1.5 rounded-tm px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  batchMode
                    ? "bg-accent-btn text-white"
                    : "border border-line text-muted hover:border-ink hover:text-ink"
                }`}
              >
                <Layers3 className="h-3.5 w-3.5" /> Batch
              </button>
            )}
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
              <Button variant="ghost" size="sm" onClick={resetAll}>
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

          {batchMode && (
            <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
              <Layers3 className="h-3.5 w-3.5 text-accent" />
              {batchMessages.length === 0
                ? "Paste multiple messages separated by a blank line or ---"
                : `${batchMessages.length} message${batchMessages.length === 1 ? "" : "s"} detected`}
            </p>
          )}

          {isPro && onDeepChange && !batchMode && (
            <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={deep}
                onChange={(e) => onDeepChange(e.target.checked)}
                className="h-3.5 w-3.5 accent-accent"
              />
              <BrainCircuit className="h-3.5 w-3.5 text-accent" />
              Deep analysis <span className="text-muted">· extra care for long/complex messages</span>
            </label>
          )}

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

          {uploadedFile && fileStatus === "idle" && (
            <ConversionPanel file={uploadedFile} />
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
              onClick={() => {
                if (batchMode) {
                  onAnalyzeBatch?.(batchMessages);
                } else {
                  onAnalyze(text);
                }
              }}
              disabled={batchMode ? !canBatch : !canAnalyze}
              className="self-stretch sm:self-auto"
            >
              {batchLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {batchLoading
                ? "Analyzing batch…"
                : batchMode
                  ? `Analyze batch (${batchMessages.length})`
                  : loading
                    ? "Analyzing…"
                    : "Analyze"}
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
