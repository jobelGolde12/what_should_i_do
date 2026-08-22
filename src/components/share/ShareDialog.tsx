"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, FileText, X, AlertTriangle, Loader2 } from "lucide-react";
import { buildShareMarkdown, copyText } from "@/lib/share";
import type { AnalysisRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";

type ShareDialogProps = {
  record: AnalysisRecord;
  onClose: () => void;
};

const FOCUSABLE =
  'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])';

export default function ShareDialog({ record, onClose }: ShareDialogProps) {
  const [includeInput, setIncludeInput] = useState(true);
  const [sensitive, setSensitive] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [creating, setCreating] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    linkInputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const options = useMemo(
    () => ({ includeInput, sensitive }),
    [includeInput, sensitive]
  );

  // Encrypt the share token server-side so the raw input can't be recovered
  // from the URL. Regenerate whenever the record or options change.
  useEffect(() => {
    let active = true;
    // Show the loading state while the new link is generated.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreating(true);
    setLinkError(null);
    const controller = new AbortController();

    fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          input: record.input,
          output: record.output,
          timestamp: record.timestamp,
        },
        options,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          link?: string;
          error?: string;
        };
        if (!active) return;
        if (!res.ok || !body.link) {
          throw new Error(body.error || "Couldn't create share link.");
        }
        setLink(body.link);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLinkError(
          "Couldn't create the share link. Check your connection and try again."
        );
      })
      .finally(() => {
        if (active) setCreating(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [record, options]);

  async function copyLink() {
    const ok = await copyText(link);
    if (ok) {
      setLinkCopied(true);
      setCopyFailed(false);
      setTimeout(() => setLinkCopied(false), 2000);
    } else {
      setCopyFailed(true);
    }
  }

  async function copyMarkdown() {
    const ok = await copyText(buildShareMarkdown(record, link, options));
    if (ok) {
      setMdCopied(true);
      setTimeout(() => setMdCopied(false), 2000);
    } else {
      setCopyFailed(true);
    }
  }

  function toggle(active: boolean, set: (v: boolean) => void, label: string) {
    return (
      <label className="flex cursor-pointer items-start gap-3 py-2">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => set(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        />
        <span className="text-sm text-ink">{label}</span>
      </label>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/40 p-4"
      aria-hidden="true"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg overflow-hidden rounded-tm border border-line bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share analysis"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-base font-medium text-ink">
              Share this analysis
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Anyone with the link can view the result.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-tm p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <fieldset className="divide-y divide-line border-y border-line">
            <legend className="sr-only">Share options</legend>
            {toggle(
              includeInput,
              setIncludeInput,
              "Include the raw input text"
            )}
            {toggle(
              sensitive,
              setSensitive,
              "Hide raw input on the shared page (sensitive content)"
            )}
          </fieldset>

          {sensitive && (
            <p
              aria-live="polite"
              className="mt-3 flex items-start gap-2 rounded-tm border border-line bg-surface px-3 py-2 text-xs text-muted"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-high" />
              The raw input will not appear on the shared page. The link is
              encrypted, so hidden content can&apos;t be recovered from the URL
              alone.
            </p>
          )}

          <div className="mt-4">
            <label
              htmlFor="share-link-field"
              className="mb-1.5 block font-mono text-xxs uppercase tracking-label-tight text-muted"
            >
              Share link
            </label>
            <div className="flex gap-2">
              <input
                id="share-link-field"
                ref={linkInputRef}
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                aria-busy={creating}
                aria-describedby={
                  linkError ? "share-link-error" : undefined
                }
                placeholder={
                  creating ? "Creating encrypted link…" : "Link unavailable"
                }
                className="h-10 min-w-0 flex-1 rounded-tm border border-line bg-surface px-3 font-mono text-2xs text-ink outline-none focus:border-ink disabled:opacity-60"
                disabled={creating || !!linkError}
              />
              <Button
                variant="dark"
                size="sm"
                onClick={copyLink}
                disabled={creating || !link || !!linkError}
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : linkCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </Button>
            </div>
            {linkError && (
              <p
                id="share-link-error"
                className="mt-2 text-xs text-high"
                role="alert"
              >
                {linkError}
              </p>
            )}
            {copyFailed && (
              <p className="mt-2 text-xs text-high">
                Clipboard unavailable — select the link above and copy it
                manually.
              </p>
            )}
          </div>

          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={copyMarkdown}
              disabled={creating || !link}
              className="w-full"
            >
              {mdCopied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Markdown copied
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" /> Copy as markdown
                </>
              )}
            </Button>
          </div>
        </div>

        <footer className="border-t border-line px-5 py-3">
          <p className="text-xs text-muted">
            Links work without an account and can be shared anywhere.
          </p>
        </footer>
      </div>
    </div>
  );
}
