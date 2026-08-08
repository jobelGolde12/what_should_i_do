"use client";

import { useState } from "react";
import { ChevronDown, Languages } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "tl", label: "Filipino" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
];

const MAX_CHARS = 480;

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if ((current + sentence).length > MAX_CHARS) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += " " + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export default function TranslationBlock({
  summary,
}: {
  summary: string;
}) {
  const [language, setLanguage] = useState("en");
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function translate(target: string) {
    if (target === "en") {
      setTranslated(null);
      setError(null);
      setOpen(false);
      setLanguage("en");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const clean = summary.replace(/<[^>]*>/g, "");
      const chunks = splitIntoChunks(clean);
      const out: string[] = [];
      for (const chunk of chunks) {
        const encoded = encodeURIComponent(chunk);
        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|${target}`
        );
        const data = await res.json();
        if (!data?.responseData?.translatedText) {
          throw new Error("No translation returned");
        }
        out.push(data.responseData.translatedText);
      }
      setTranslated(out.join(" "));
    } catch {
      setError("Translation failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line bg-surface">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (open) setLanguage("en");
        }}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
          <Languages className="h-4 w-4 text-muted" />
          Translate summary
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-line px-4 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  void translate(l.code);
                }}
                className={`rounded-[3px] px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  language === l.code
                    ? "bg-accent text-white"
                    : "border border-line bg-background text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-10">
            {loading && (
              <p className="font-mono text-xs text-muted">
                Translating…
              </p>
            )}
            {error && <p className="text-xs text-high">{error}</p>}
            {!loading && !error && translated && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                {translated}
              </p>
            )}
            {!loading && !error && !translated && language === "en" && (
              <p className="text-xs text-muted">
                Pick a language above to see the summary translated.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
