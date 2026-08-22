"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import {
  Plus,
  Send,
  X,
  Loader2,
  UploadCloud,
  FileWarning,
  FileText,
  Image as ImageIcon,
  Check,
} from "lucide-react";

type Props = {
  text: string;
  onTextChange: (value: string) => void;
  onAnalyze: (value: string) => void;
  loading: boolean;
  onSourceLabel?: (label: string | null) => void;
};

type FileStatus = "idle" | "extracting" | "error";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/*
 * MinerU converts these to structured Markdown server-side
 * (/api/extract) before the text reaches the AI model. `.txt`
 * and anything not listed here skips conversion entirely.
 */
const MINERU_EXTENSIONS = [
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
  "html",
  "htm",
];

const ACCEPTED_EXTENSIONS = [
  "txt",
  ...MINERU_EXTENSIONS,
];

/* -------------------------------------------------------------------------- */
/* File helpers                                                               */
/* -------------------------------------------------------------------------- */

function getFileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isSupportedFile(file: File): boolean {
  const extension = getFileExt(file.name);

  return ACCEPTED_EXTENSIONS.includes(extension);
}

function isMineruCandidate(extension: string, mimeType: string): boolean {
  if (MINERU_EXTENSIONS.includes(extension)) {
    return true;
  }

  if (mimeType.startsWith("image/")) {
    return true;
  }

  if (mimeType === "text/html") {
    return true;
  }

  return false;
}

/*
 * Server-side MinerU conversion. Any failure here is handled by the
 * caller falling back to the original client-side extraction.
 *
 * The request is bounded by a client-side timeout well below the server's
 * own 90 s ceiling, so a hung connection falls back to local extraction
 * instead of spinning forever. Passes an AbortSignal so a user-initiated
 * cancel kills the upload immediately.
 */
const MINERU_CLIENT_TIMEOUT_MS = 45_000;

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

async function convertWithMineru(
  file: File,
  signal?: AbortSignal
): Promise<string> {
  const form = new FormData();

  form.append("file", file);

  const bounded = new AbortController();

  const abortFromOuter = () =>
    bounded.abort();

  signal?.addEventListener(
    "abort",
    abortFromOuter,
    { once: true }
  );

  const timer = window.setTimeout(
    () => bounded.abort(),
    MINERU_CLIENT_TIMEOUT_MS
  );

  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      body: form,
      signal: bounded.signal,
    });

    if (!res.ok) {
      const body = (await res
        .json()
        .catch(() => ({}))) as { error?: string };

      throw new Error(
        body.error ??
          `Conversion failed (${res.status}).`
      );
    }

    const data = (await res.json()) as {
      markdown?: string;
    };

    if (!data.markdown) {
      throw new Error("Conversion returned no text.");
    }

    return data.markdown;
  } finally {
    window.clearTimeout(timer);

    signal?.removeEventListener(
      "abort",
      abortFromOuter
    );
  }
}

function getFileIcon(name: string) {
  const extension = getFileExt(name);

  if (
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg"
  ) {
    return ImageIcon;
  }

  return FileText;
}

function getFileTypeLabel(name: string): string {
  const extension = getFileExt(name);

  if (extension === "pdf") {
    return "PDF";
  }

  if (extension === "docx") {
    return "DOCX";
  }

  if (extension === "txt") {
    return "TXT";
  }

  if (
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "gif" ||
    extension === "bmp" ||
    extension === "tiff" ||
    extension === "tif"
  ) {
    return "IMG";
  }

  if (extension === "pptx") {
    return "PPT";
  }

  if (extension === "html" || extension === "htm") {
    return "HTML";
  }

  return "FILE";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* -------------------------------------------------------------------------- */
/* Text extraction                                                            */
/* -------------------------------------------------------------------------- */

/*
 * Shared lazy loader for the legacy extractor. Starting this import while
 * MinerU is still converting means a failed conversion falls back without
 * paying the chunk-download cost at the worst possible moment.
 */
let legacyExtractorPromise: Promise<
  typeof import("@/components/input/InputArea")
> | null = null;

function loadLegacyExtractor(): Promise<
  typeof import("@/components/input/InputArea")
> {
  if (!legacyExtractorPromise) {
    legacyExtractorPromise = import(
      "@/components/input/InputArea"
    );
  }

  return legacyExtractorPromise;
}

/**
 * Original client-side extraction (pdfjs / mammoth / tesseract).
 * Used as the fallback when MinerU is unavailable or fails.
 */
async function extractWithLegacyPipeline(
  file: File,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException(
      "Extraction cancelled.",
      "AbortError"
    );
  }

  try {
    const { extractTextFromFile } =
      await loadLegacyExtractor();

    return await extractTextFromFile(file);
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : String(error);

    throw new Error(
      `Could not extract text from this file type. ${detail}`
    );
  }
}

/**
 * Routing per spec:
 * - `.txt` → plain text, no conversion.
 * - Supported formats → MinerU Markdown (bounded by a client timeout),
 *   falling back to the legacy client pipeline when conversion fails.
 * - Anything else → legacy pipeline (which rejects unknown types).
 *
 * Every stage checks the signal so a cancel stops remaining work instead
 * of running the fallback after the user gave up.
 */
async function safeExtractFile(
  file: File,
  signal?: AbortSignal
): Promise<string> {
  const extension = getFileExt(file.name);

  if (
    file.type === "text/plain" ||
    extension === "txt"
  ) {
    return file.text();
  }

  if (
    isMineruCandidate(extension, file.type)
  ) {
    // Warm the fallback extractor in parallel with the upload.
    void loadLegacyExtractor();

    try {
      return await convertWithMineru(
        file,
        signal
      );
    } catch (error) {
      // A user cancel must not trigger the fallback.
      if (
        signal?.aborted ||
        isAbortError(error)
      ) {
        throw new DOMException(
          "Extraction cancelled.",
          "AbortError"
        );
      }
      // Otherwise fall through to the original extraction flow.
    }
  }

  return extractWithLegacyPipeline(
    file,
    signal
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function CleanComposer({
  text,
  onTextChange,
  onAnalyze,
  loading,
  onSourceLabel,
}: Props) {
  /* ------------------------------------------------------------------------ */
  /* Refs                                                                     */
  /* ------------------------------------------------------------------------ */

  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const composerRef =
    useRef<HTMLDivElement>(null);

  /*
   * Extraction session tracking: bumping the token invalidates any
   * in-flight extraction (cancel or supersede), and the controller
   * aborts the underlying conversion request.
   */
  const extractTokenRef = useRef(0);

  const extractAbortRef =
    useRef<AbortController | null>(null);

  /* ------------------------------------------------------------------------ */
  /* State                                                                    */
  /* ------------------------------------------------------------------------ */

  const [dragOver, setDragOver] =
    useState(false);

  const [pageDrag, setPageDrag] =
    useState(false);

  const [fileStatus, setFileStatus] =
    useState<FileStatus>("idle");

  const [fileError, setFileError] =
    useState<string | null>(null);

  const [fileName, setFileName] =
    useState<string | null>(null);

  const [fileSize, setFileSize] =
    useState<number | null>(null);

  const [isFocused, setIsFocused] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  /* ------------------------------------------------------------------------ */
  /* Derived state                                                            */
  /* ------------------------------------------------------------------------ */

  const hasText = text.trim().length > 0;

  const hasFile = fileName !== null;

  const canSubmit =
    (hasText || hasFile) &&
    !loading &&
    fileStatus !== "extracting";

  /* ------------------------------------------------------------------------ */
  /* Textarea resize                                                          */
  /* ------------------------------------------------------------------------ */

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    const height = Math.min(
      Math.max(textarea.scrollHeight, 40),
      180
    );

    textarea.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  /* ------------------------------------------------------------------------ */
  /* Reset                                                                    */
  /* ------------------------------------------------------------------------ */

  const resetAll = useCallback(() => {
    onTextChange("");
    onSourceLabel?.(null);

    setFileName(null);
    setFileSize(null);
    setFileStatus("idle");
    setFileError(null);
    setDragOver(false);
    setPageDrag(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    window.requestAnimationFrame(() => {
      resizeTextarea();
      textareaRef.current?.focus();
    });
  }, [
    onTextChange,
    onSourceLabel,
    resizeTextarea,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Remove file                                                              */
  /* ------------------------------------------------------------------------ */

  const removeFile = useCallback(() => {
    onSourceLabel?.(null);

    setFileName(null);
    setFileSize(null);
    setFileStatus("idle");
    setFileError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [onSourceLabel]);

  /* ------------------------------------------------------------------------ */
  /* Cancel extraction                                                        */
  /* ------------------------------------------------------------------------ */

  const cancelExtraction = useCallback(() => {
    extractTokenRef.current += 1;

    extractAbortRef.current?.abort();
    extractAbortRef.current = null;

    onSourceLabel?.(null);

    setFileName(null);
    setFileSize(null);
    setFileStatus("idle");
    setFileError(null);

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [onSourceLabel]);

  /* ------------------------------------------------------------------------ */
  /* Submit                                                                   */
  /* ------------------------------------------------------------------------ */

  const submit = useCallback(() => {
    if (!canSubmit || !text.trim()) {
      return;
    }

    setSubmitted(true);

    onAnalyze(text);

    resetAll();

    window.setTimeout(() => {
      setSubmitted(false);
    }, 500);
  }, [canSubmit, onAnalyze, resetAll, text]);

  /* ------------------------------------------------------------------------ */
  /* Input change                                                             */
  /* ------------------------------------------------------------------------ */

  const handleInput = (
    event: ChangeEvent<HTMLTextAreaElement>
  ) => {
    onTextChange(event.target.value);

    const textarea = event.currentTarget;

    textarea.style.height = "auto";

    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      180
    )}px`;
  };

  /* ------------------------------------------------------------------------ */
  /* Keyboard interaction                                                     */
  /* ------------------------------------------------------------------------ */

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      submit();
      return;
    }

    if (event.key === "Escape") {
      if (hasText || hasFile) {
        event.preventDefault();
        resetAll();
      }
    }
  };

  /* ------------------------------------------------------------------------ */
  /* File validation                                                          */
  /* ------------------------------------------------------------------------ */

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!isSupportedFile(file)) {
        return (
          "Unsupported file type. Please use TXT, PDF, DOCX, PPTX, HTML, or an image. Excel files are not supported."
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return `File is too large. Maximum size is 10 MB. This file is ${formatFileSize(
          file.size
        )}.`;
      }

      return null;
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* File handling                                                            */
  /* ------------------------------------------------------------------------ */

  const handleFile = useCallback(
    async (file: File) => {
      const validationError =
        validateFile(file);

      if (validationError) {
        setFileName(null);
        setFileSize(null);
        setFileStatus("error");
        setFileError(validationError);

        onSourceLabel?.(null);

        return;
      }

      setFileName(file.name);
      setFileSize(file.size);
      setFileStatus("extracting");
      setFileError(null);

      onSourceLabel?.(file.name);

      const sessionToken =
        ++extractTokenRef.current;

      const controller = new AbortController();

      extractAbortRef.current = controller;

      const isCurrent = () =>
        sessionToken ===
        extractTokenRef.current;

      try {
        const extracted =
          await safeExtractFile(
            file,
            controller.signal
          );

        // Cancelled or superseded mid-flight — drop the result.
        if (
          !isCurrent() ||
          controller.signal.aborted
        ) {
          return;
        }

        if (!extracted.trim()) {
          throw new Error(
            "No readable text was found in this file."
          );
        }

        onTextChange(extracted);
        setFileStatus("idle");

        window.requestAnimationFrame(() => {
          resizeTextarea();
          textareaRef.current?.focus();
        });
      } catch (error) {
        // Cancelled or superseded — stay silent, the UI is already reset.
        if (
          !isCurrent() ||
          controller.signal.aborted ||
          isAbortError(error)
        ) {
          return;
        }

        setFileStatus("error");
        setFileName(null);
        setFileSize(null);

        onSourceLabel?.(null);

        const message =
          error instanceof Error
            ? error.message
            : "Couldn't read that file.";

        setFileError(
          `Couldn't read that file. ${message}`
        );
      } finally {
        if (
          extractAbortRef.current ===
          controller
        ) {
          extractAbortRef.current = null;
        }

        if (isCurrent() && fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [
      validateFile,
      onSourceLabel,
      onTextChange,
      resizeTextarea,
    ]
  );

  /* ------------------------------------------------------------------------ */
  /* File picker                                                              */
  /* ------------------------------------------------------------------------ */

  const openFilePicker = useCallback(() => {
    if (
      loading ||
      fileStatus === "extracting"
    ) {
      return;
    }

    fileInputRef.current?.click();
  }, [loading, fileStatus]);

  const onFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (file) {
        void handleFile(file);
      }
    },
    [handleFile]
  );

  /* ------------------------------------------------------------------------ */
  /* Paste interaction                                                        */
  /* ------------------------------------------------------------------------ */

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(
        event.clipboardData.files
      );

      if (files.length === 0) {
        return;
      }

      const file = files[0];

      if (!isSupportedFile(file)) {
        return;
      }

      event.preventDefault();

      void handleFile(file);
    },
    [handleFile]
  );

  /* ------------------------------------------------------------------------ */
  /* Drag & drop (window-level)                                               */
  /* ------------------------------------------------------------------------ */

  /*
   * Latest values for the window drag listeners. Keeping them in refs lets
   * the listeners bind exactly once, so the dragenter/dragleave counter is
   * never reset by a re-render in the middle of an active drag.
   */
  const busyRef = useRef(false);

  const handleFileRef = useRef(handleFile);

  useEffect(() => {
    busyRef.current =
      loading || fileStatus === "extracting";

    handleFileRef.current = handleFile;
  });

  useEffect(() => {
    let dragCounter = 0;

    const hasFiles = (
      event: globalThis.DragEvent
    ): boolean =>
      !!event.dataTransfer &&
      Array.from(
        event.dataTransfer.types
      ).includes("Files");

    const isOverComposer = (
      event: globalThis.DragEvent
    ): boolean =>
      !!composerRef.current &&
      event.target instanceof Node &&
      composerRef.current.contains(
        event.target
      );

    const hideOverlays = () => {
      setPageDrag(false);
      setDragOver(false);
    };

    const handleWindowDragEnter = (
      event: globalThis.DragEvent
    ) => {
      if (!hasFiles(event)) {
        return;
      }

      dragCounter += 1;

      if (busyRef.current) {
        return;
      }

      setPageDrag(true);
      setDragOver(isOverComposer(event));
    };

    const handleWindowDragLeave = (
      event: globalThis.DragEvent
    ) => {
      // Mirror dragenter one-for-one so the counter can never desync,
      // no matter which element the event targets.
      if (!hasFiles(event)) {
        return;
      }

      dragCounter = Math.max(0, dragCounter - 1);

      if (dragCounter === 0) {
        hideOverlays();
      }
    };

    const handleWindowDragOver = (
      event: globalThis.DragEvent
    ) => {
      /*
       * Always cancel the browser default so that a drop anywhere in the
       * app can never navigate away from the page (e.g. while a previous
       * analysis is still loading).
       */
      event.preventDefault();

      const droppable =
        hasFiles(event) && !busyRef.current;

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = droppable
          ? "copy"
          : "none";
      }

      if (!droppable) {
        return;
      }

      setPageDrag(true);
      setDragOver(isOverComposer(event));
    };

    const handleWindowDrop = (
      event: globalThis.DragEvent
    ) => {
      event.preventDefault();

      dragCounter = 0;
      hideOverlays();

      if (busyRef.current) {
        return;
      }

      const file =
        event.dataTransfer?.files?.[0];

      if (file) {
        void handleFileRef.current(file);
      }
    };

    window.addEventListener(
      "dragenter",
      handleWindowDragEnter
    );

    window.addEventListener(
      "dragleave",
      handleWindowDragLeave
    );

    window.addEventListener(
      "dragover",
      handleWindowDragOver
    );

    window.addEventListener(
      "drop",
      handleWindowDrop
    );

    return () => {
      window.removeEventListener(
        "dragenter",
        handleWindowDragEnter
      );

      window.removeEventListener(
        "dragleave",
        handleWindowDragLeave
      );

      window.removeEventListener(
        "dragover",
        handleWindowDragOver
      );

      window.removeEventListener(
        "drop",
        handleWindowDrop
      );
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Focus                                                                    */
  /* ------------------------------------------------------------------------ */

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  /* ------------------------------------------------------------------------ */
  /* File icon                                                                */
  /* ------------------------------------------------------------------------ */

  const FileIcon = fileName
    ? getFileIcon(fileName)
    : FileText;

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      {/* ================================================================== */}
      {/* Full page drag overlay                                             */}
      {/* ================================================================== */}

      {pageDrag && (
        <div
          className="
            pointer-events-none
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-white/90
            backdrop-blur-md
          "
        >
          <div
            className="
              flex
              w-[min(90vw,360px)]
              flex-col
              items-center
              rounded-3xl
              border
              border-neutral-200
              bg-white
              px-8
              py-8
              text-center
              shadow-[0_20px_70px_rgba(0,0,0,0.10)]
            "
          >
            <div
              className="
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-full
                border
                border-neutral-200
                bg-neutral-50
              "
            >
              <UploadCloud
                className="h-6 w-6 text-black"
                strokeWidth={1.8}
              />
            </div>

            <p
              className="
                mt-4
                text-sm
                font-semibold
                tracking-tight
                text-black
              "
            >
              Drop your file here
            </p>

            <p
              className="
                mt-1.5
                text-xs
                text-neutral-500
              "
            >
              TXT · PDF · DOCX · PPTX · HTML · IMG
            </p>

            <p
              className="
                mt-1
                text-[11px]
                text-neutral-400
              "
            >
              Maximum file size: 10 MB
            </p>
          </div>
        </div>
      )}

      <div className="w-full">
        {/* ================================================================ */}
        {/* Hidden file input                                                */}
        {/* ================================================================ */}

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,.docx,.pptx,.html,.htm,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.tif"
          aria-label="Attach a file"
          tabIndex={-1}
          className="hidden"
          onChange={onFileInputChange}
          disabled={loading}
        />

        {/* ================================================================ */}
        {/* Main composer                                                    */}
        {/* ================================================================ */}

        <div
          ref={composerRef}
          className={`
            relative
            w-full
            rounded-[30px]
            border
            bg-white
            transition-all
            duration-200
            ease-out
            ${
              dragOver
                ? "border-black shadow-[0_16px_50px_rgba(0,0,0,0.12)]"
                : isFocused
                  ? "border-neutral-400 shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
                  : "border-neutral-200 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
            }
          `}
        >
          {/* ============================================================ */}
          {/* Internal drag overlay                                         */}
          {/* ============================================================ */}

          {dragOver && (
            <div
              className="
                pointer-events-none
                absolute
                inset-0
                z-20
                flex
                items-center
                justify-center
                rounded-[30px]
                border-2
                border-dashed
                border-neutral-400
                bg-white/95
                backdrop-blur-sm
              "
            >
              <div className="flex flex-col items-center">
                <div
                  className="
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center
                    rounded-full
                    bg-black
                    text-white
                  "
                >
                  <UploadCloud
                    className="h-5 w-5"
                    strokeWidth={1.8}
                  />
                </div>

                <p
                  className="
                    mt-3
                    text-sm
                    font-semibold
                    text-black
                  "
                >
                  Drop file here
                </p>

                <p
                  className="
                    mt-1
                    text-xs
                    text-neutral-500
                  "
                >
                  We&apos;ll extract the text automatically
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* Uploaded file chip                                            */}
          {/* ============================================================ */}

          {hasFile &&
            fileStatus === "idle" &&
            fileName && (
              <div className="px-3 pt-3">
                <div
                  className="
                    inline-flex
                    max-w-full
                    items-center
                    gap-2
                    rounded-2xl
                    border
                    border-neutral-200
                    bg-neutral-50
                    px-2.5
                    py-2
                  "
                >
                  <div
                    className="
                      flex
                      h-8
                      w-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      bg-white
                      text-neutral-600
                    "
                  >
                    <FileIcon
                      className="h-4 w-4"
                      strokeWidth={1.8}
                    />
                  </div>

                  <div className="min-w-0">
                    <p
                      className="
                        max-w-[220px]
                        truncate
                        text-xs
                        font-medium
                        text-black
                      "
                    >
                      {fileName}
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[10px]
                        text-neutral-400
                      "
                    >
                      {getFileTypeLabel(fileName)}
                      {fileSize !== null
                        ? ` · ${formatFileSize(fileSize)}`
                        : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={`Remove ${fileName}`}
                    title="Remove file"
                    onClick={removeFile}
                    className="
                      ml-1
                      flex
                      h-7
                      w-7
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      text-neutral-400
                      transition-all
                      duration-150
                      hover:bg-neutral-200
                      hover:text-black
                      active:scale-90
                      focus:outline-none
                      focus:ring-2
                      focus:ring-neutral-200
                    "
                  >
                    <X
                      className="h-3.5 w-3.5"
                      strokeWidth={2}
                    />
                  </button>
                </div>
              </div>
            )}

          {/* ============================================================ */}
          {/* File extracting state                                         */}
          {/* ============================================================ */}

          {fileStatus === "extracting" &&
            fileName && (
              <div className="px-3 pt-3">
                <div
                  role="status"
                  aria-live="polite"
                  className="
                    inline-flex
                    max-w-full
                    items-center
                    gap-2.5
                    rounded-2xl
                    border
                    border-neutral-200
                    bg-neutral-50
                    px-3
                    py-2
                  "
                >
                  <div
                    className="
                      flex
                      h-8
                      w-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      bg-black
                      text-white
                    "
                  >
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.8}
                    />
                  </div>

                  <div className="min-w-0">
                    <p
                      className="
                        max-w-[240px]
                        truncate
                        text-xs
                        font-medium
                        text-black
                      "
                    >
                      Reading {fileName}
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[10px]
                        text-neutral-400
                      "
                    >
                      {fileName &&
                      isMineruCandidate(
                        getFileExt(fileName),
                        ""
                      )
                        ? "Converting to Markdown…"
                        : "Extracting text…"}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={`Cancel reading ${fileName}`}
                    title="Cancel"
                    onClick={cancelExtraction}
                    className="
                      ml-1
                      flex
                      h-7
                      w-7
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      text-neutral-400
                      transition-all
                      duration-150
                      hover:bg-neutral-200
                      hover:text-black
                      active:scale-90
                      focus:outline-none
                      focus:ring-2
                      focus:ring-neutral-200
                    "
                  >
                    <X
                      className="h-3.5 w-3.5"
                      strokeWidth={2}
                    />
                  </button>
                </div>
              </div>
            )}

          {/* ============================================================ */}
          {/* Main input row                                                */}
          {/* ============================================================ */}

          <div
            className="
              flex
              min-h-[64px]
              w-full
              items-end
              gap-2
              px-2
              py-2
            "
          >
            {/* ========================================================== */}
            {/* Upload button                                               */}
            {/* ========================================================== */}

            <button
              type="button"
              aria-label="Attach a file"
              title="Attach a file"
              onClick={openFilePicker}
              disabled={
                loading ||
                fileStatus === "extracting"
              }
              className="
                mb-0.5
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-full
                text-neutral-500
                transition-all
                duration-150
                hover:bg-neutral-100
                hover:text-black
                active:scale-90
                disabled:cursor-not-allowed
                disabled:opacity-40
                focus:outline-none
                focus:ring-2
                focus:ring-neutral-200
              "
            >
              <Plus
                className="h-[21px] w-[21px]"
                strokeWidth={1.8}
              />
            </button>

            {/* ========================================================== */}
            {/* Textarea                                                    */}
            {/* ========================================================== */}

            <textarea
              ref={textareaRef}
              id="analysis-textarea"
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={loading}
              rows={1}
              placeholder="Paste a message, email, announcement, memo, or notice…"
              aria-label="Text input"
              spellCheck
              style={{ outline: "none" }}
              className="
                max-h-[180px]
                min-h-[40px]
                flex-1
                resize-none
                overflow-y-auto
                bg-transparent
                px-1
                py-[9px]
                text-[15px]
                leading-6
                text-black
                placeholder:text-neutral-400
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            />

            {/* ========================================================== */}
            {/* Right controls                                              */}
            {/* ========================================================== */}

            <div
              className="
                mb-0.5
                flex
                shrink-0
                items-center
                gap-1
              "
            >
              {/* Clear button */}

              {(hasText || hasFile) &&
                !loading && (
                  <button
                    type="button"
                    aria-label="Clear input"
                    title="Clear input"
                    onClick={resetAll}
                    className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-full
                      text-neutral-400
                      transition-all
                      duration-150
                      hover:bg-neutral-100
                      hover:text-black
                      active:scale-90
                      focus:outline-none
                      focus:ring-2
                      focus:ring-neutral-200
                    "
                  >
                    <X
                      className="h-4 w-4"
                      strokeWidth={1.8}
                    />
                  </button>
                )}

              {/* Submit button */}

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                aria-label={
                  loading
                    ? "Analyzing"
                    : "Analyze"
                }
                title={
                  loading
                    ? "Analyzing"
                    : canSubmit
                      ? "Analyze"
                      : "Attach a file or enter text to analyze"
                }
                className={`
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  transition-all
                  duration-200
                  focus:outline-none
                  focus:ring-2
                  focus:ring-neutral-300
                  ${
                    canSubmit
                      ? "bg-black text-white shadow-sm hover:bg-neutral-800 hover:shadow-md active:scale-90"
                      : "cursor-not-allowed bg-neutral-100 text-neutral-300"
                  }
                  ${
                    submitted
                      ? "scale-95"
                      : ""
                  }
                `}
              >
                {loading ? (
                  <Loader2
                    className="h-[18px] w-[18px] animate-spin"
                    strokeWidth={2}
                  />
                ) : submitted ? (
                  <Check
                    className="h-[18px] w-[18px]"
                    strokeWidth={2}
                  />
                ) : (
                  <Send
                    className="h-[18px] w-[18px]"
                    strokeWidth={1.8}
                  />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* File error                                                       */}
        {/* ================================================================ */}

        {fileError && (
          <div
            role="alert"
            className="
              mt-2
              flex
              items-start
              gap-2
              px-3
              text-xs
              text-neutral-600
            "
          >
            <FileWarning
              className="
                mt-0.5
                h-3.5
                w-3.5
                shrink-0
                text-black
              "
              strokeWidth={1.8}
            />

            <span>{fileError}</span>

            <button
              type="button"
              aria-label="Dismiss error"
              title="Dismiss"
              onClick={() => {
                setFileError(null);
                setFileStatus("idle");
              }}
              className="
                ml-auto
                shrink-0
                text-neutral-400
                transition-colors
                hover:text-black
                focus:outline-none
              "
            >
              <X
                className="h-3.5 w-3.5"
                strokeWidth={1.8}
              />
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* Keyboard hint                                                    */}
        {/* ================================================================ */}

        {(hasText || hasFile) &&
          !loading && (
            <div
              className="
                mt-2
                flex
                items-center
                justify-center
                gap-3
                px-4
                text-center
              "
            >
              <span
                className="
                  text-[10px]
                  font-medium
                  uppercase
                  tracking-[0.12em]
                  text-neutral-400
                "
              >
                ⌘ Enter to submit
              </span>

              <span
                className="
                  h-1
                  w-1
                  rounded-full
                  bg-neutral-300
                "
              />

              <span
                className="
                  text-[10px]
                  font-medium
                  uppercase
                  tracking-[0.12em]
                  text-neutral-400
                "
              >
                Esc to clear
              </span>
            </div>
          )}

        {/* ================================================================ */}
        {/* Empty composer hint                                              */}
        {/* ================================================================ */}

        {!hasText &&
          !hasFile &&
          !loading &&
          !fileError && (
            <div
              className="
                mt-2
                flex
                items-center
                justify-center
                px-4
                text-center
              "
            >
              <span
                className="
                  text-[10px]
                  font-medium
                  tracking-wide
                  text-neutral-400
                "
              >
                Attach a file or paste your text
              </span>
            </div>
          )}
      </div>
    </>
  );
}