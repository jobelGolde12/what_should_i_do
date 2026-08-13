"use client";

import { useMemo, useState } from "react";
import { FileDown, Loader2, RefreshCw } from "lucide-react";
import type { ConvertFormat } from "@/lib/convert";
import { usePlan } from "@/lib/pro/usePlan";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { ProGate } from "@/components/ui/ProGate";

type SourceKind = "pdf" | "docx" | "txt" | "image";

function sourceKind(file: File): SourceKind | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (file.type === "text/plain" || ext === "txt") return "txt";
  if (file.type === "application/pdf" || ext === "pdf") return "pdf";
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return "docx";
  }
  if (file.type.startsWith("image/") || ext === "png" || ext === "jpg" || ext === "jpeg") {
    return "image";
  }
  return null;
}

const TARGETS: Record<Exclude<SourceKind, "image">, { value: ConvertFormat; label: string }[]> = {
  pdf: [
    { value: "docx", label: "Word (.docx)" },
    { value: "txt", label: "Text (.txt)" },
  ],
  docx: [{ value: "pdf", label: "PDF" }],
  txt: [
    { value: "pdf", label: "PDF" },
    { value: "docx", label: "Word (.docx)" },
  ],
};
const IMAGE_TARGETS: { value: ConvertFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
];

export default function ConversionPanel({ file }: { file: File }) {
  const { isPro } = usePlan();
  const kind = useMemo(() => sourceKind(file), [file]);
  const targets = kind === "image" ? IMAGE_TARGETS : kind ? TARGETS[kind] : [];
  const [target, setTarget] = useState<ConvertFormat | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!kind || targets.length === 0) return null;

  async function convert() {
    if (!target) {
      toast("Pick a target format first.", "info");
      return;
    }
    setProcessing(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("target", target);
    try {
      const res = await fetch("/api/convert", { method: "POST", body: form });
      if (!res.ok) {
        let message = "Conversion failed. Try again.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* keep default */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const downloadName =
        match?.[1] ?? file.name.replace(/\.[^.]+$/, "") + `.${target}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Converted — check your downloads.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Conversion failed.";
      setError(message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="mt-3 border border-line bg-surface px-4 py-3">
      {!isPro ? (
        <ProGate feature="Document conversion" />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xxs uppercase tracking-label text-muted">
            Convert
          </span>
          <div className="flex flex-wrap gap-1.5">
            {targets.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={target === t.value}
                onClick={() => {
                  setTarget(t.value);
                  setError(null);
                }}
                className={`rounded-tm px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  target === t.value
                    ? "bg-accent-btn text-white"
                    : "border border-line bg-background text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => void convert()}
            disabled={processing || !target}
          >
            {processing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : target === null ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {processing ? "Converting…" : "Convert & download"}
          </Button>
          {error && (
            <p role="alert" className="w-full text-xs text-high">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
