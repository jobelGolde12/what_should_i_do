"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  UploadCloud,
  Sparkles,
  BookmarkPlus,
  Check,
  X,
} from "lucide-react";
import { useTask } from "@/context/TaskContext";
import { Button } from "@/components/ui/Button";

type Props = {
  text: string;
  onTextChange: (text: string) => void;
  onAnalyze: (text: string) => void;
  loading: boolean;
};

async function extractTextFromFile(file: File): Promise<string> {
  // TXT
  if (file.type === "text/plain") {
    return await file.text();
  }

  // PDF
  if (file.type === "application/pdf") {
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
    return out;
  }

  // DOCX
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = (await import("mammoth")).default;
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  // IMAGE (OCR)
  if (file.type.startsWith("image/")) {
    const Tesseract = (await import("tesseract.js")).default;
    const ocrResult = await Tesseract.recognize(file, "eng", {
      logger: () => {},
    });
    return ocrResult.data.text;
  }

  throw new Error("Unsupported file type. Try TXT, PDF, DOCX, or an image.");
}

export default function InputArea({
  text,
  onTextChange,
  onAnalyze,
  loading,
}: Props) {
  const { saveTemplate } = useTask();
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
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

  async function handleFile(file: File) {
    setFileName(file.name);
    try {
      const extracted = await extractTextFromFile(file);
      onTextChange(extracted);
      onAnalyze(extracted);
    } catch (err) {
      setFileName(null);
      const message =
        err instanceof Error ? err.message : "Couldn't read that file.";
      window.alert(`Couldn't read that file. ${message}`);
    }
  }

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

  return (
    <div id="analysis-input" className="scroll-mt-24 border border-line bg-background">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
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
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
                Drop to upload
              </p>
            </div>
          )}
        </div>

        {fileName && (
          <p className="mt-2 flex items-center gap-2 font-mono text-xs text-muted">
            <UploadCloud className="h-3.5 w-3.5" />
            {fileName}
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
          <label
            htmlFor="file-upload"
            className="inline-flex cursor-pointer items-center gap-2 self-start rounded-[3px] border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-ink hover:text-ink"
          >
            <UploadCloud className="h-4 w-4" />
            Upload file or image
            <span className="hidden text-muted/70 sm:inline">
              · TXT, PDF, DOCX, JPG, PNG
            </span>
          </label>

          <Button
            size="lg"
            onClick={() => onAnalyze(text)}
            disabled={!canAnalyze}
            className="self-stretch sm:self-auto"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Analyzing…" : "Analyze"}
            <kbd className="ml-1 hidden rounded-[3px] bg-white/20 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              ⌘↵
            </kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
