"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
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

const ACCEPTED_EXTENSIONS = [
  "txt",
  "pdf",
  "docx",
  "png",
  "jpg",
  "jpeg",
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
    extension === "jpeg"
  ) {
    return "IMG";
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

/**
 * TXT files are read directly.
 *
 * Other supported file types continue using the existing
 * extractTextFromFile helper from InputArea.
 */
async function safeExtractText(file: File): Promise<string> {
  const extension = getFileExt(file.name);

  if (
    file.type === "text/plain" ||
    extension === "txt"
  ) {
    return file.text();
  }

  try {
    const { extractTextFromFile } = await import(
      "@/components/input/InputArea"
    );

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
    hasText &&
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
  /* Submit                                                                   */
  /* ------------------------------------------------------------------------ */

  const submit = useCallback(() => {
    if (!canSubmit) {
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
          "Unsupported file type. Please use TXT, PDF, DOCX, JPG, or PNG."
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

      try {
        const extracted =
          await safeExtractText(file);

        onTextChange(extracted);

        setFileStatus("idle");

        window.requestAnimationFrame(() => {
          resizeTextarea();
          textareaRef.current?.focus();
        });
      } catch (error) {
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
        if (fileInputRef.current) {
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
  /* Composer drag interaction                                               */
  /* ------------------------------------------------------------------------ */

  const handleDragEnter = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (loading) {
      return;
    }

    if (
      event.dataTransfer.types.includes("Files")
    ) {
      setDragOver(true);
    }
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (loading) {
      return;
    }

    if (
      event.dataTransfer.types.includes("Files")
    ) {
      event.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    }
  };

  const handleDragLeave = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const relatedTarget =
      event.relatedTarget;

    if (
      relatedTarget instanceof Node &&
      event.currentTarget.contains(
        relatedTarget
      )
    ) {
      return;
    }

    setDragOver(false);
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setDragOver(false);

    if (loading) {
      return;
    }

    const file =
      event.dataTransfer.files?.[0];

    if (file) {
      void handleFile(file);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Whole-page drag interaction                                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let dragCounter = 0;

    const handleWindowDragEnter = (
      event: globalThis.DragEvent
    ) => {
      if (
        loading ||
        !event.dataTransfer?.types.includes(
          "Files"
        )
      ) {
        return;
      }

      dragCounter += 1;
      setPageDrag(true);
    };

    const handleWindowDragOver = (
      event: globalThis.DragEvent
    ) => {
      if (
        loading ||
        !event.dataTransfer?.types.includes(
          "Files"
        )
      ) {
        return;
      }

      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect =
          "copy";
      }

      setPageDrag(true);
    };

    const handleWindowDragLeave = (
      event: globalThis.DragEvent
    ) => {
      event.preventDefault();

      dragCounter -= 1;

      if (dragCounter <= 0) {
        dragCounter = 0;
        setPageDrag(false);
      }
    };

    const handleWindowDrop = (
      event: globalThis.DragEvent
    ) => {
      event.preventDefault();

      dragCounter = 0;
      setPageDrag(false);

      if (loading) {
        return;
      }

      const file =
        event.dataTransfer?.files?.[0];

      if (file) {
        void handleFile(file);
      }
    };

    window.addEventListener(
      "dragenter",
      handleWindowDragEnter
    );

    window.addEventListener(
      "dragover",
      handleWindowDragOver
    );

    window.addEventListener(
      "dragleave",
      handleWindowDragLeave
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
        "dragover",
        handleWindowDragOver
      );

      window.removeEventListener(
        "dragleave",
        handleWindowDragLeave
      );

      window.removeEventListener(
        "drop",
        handleWindowDrop
      );
    };
  }, [handleFile, loading]);

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
              TXT · PDF · DOCX · JPG · PNG
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
          accept=".txt,.pdf,.docx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={onFileInputChange}
          disabled={loading}
        />

        {/* ================================================================ */}
        {/* Main composer                                                    */}
        {/* ================================================================ */}

        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
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
                      Extracting text…
                    </p>
                  </div>
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
                      : "Enter text to analyze"
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