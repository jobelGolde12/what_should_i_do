"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Languages,
  Pause,
  Play,
  Square,
  Volume2,
} from "lucide-react";
import { sanitizeSummary } from "@/lib/analyzeRules";
import { Button } from "@/components/ui/Button";
import {
  isSpeechSupported,
  speak,
  type SpeakHandle,
  type TTSStatus,
} from "@/lib/tts";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "tl", label: "Filipino" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
];

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
  const [speaking, setSpeaking] = useState<TTSStatus>("idle");
  const [ttsError, setTtsError] = useState<string | null>(null);
  const ttsHandle = useRef<SpeakHandle | null>(null);

  // Stop any speech when the component unmounts.
  useEffect(() => {
    return () => {
      if (isSpeechSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  function cancelSpeech() {
    ttsHandle.current?.cancel();
    ttsHandle.current = null;
    setSpeaking("idle");
    setTtsError(null);
  }

  function listen() {
    if (!translated) return;
    if (!isSpeechSupported()) {
      setTtsError("Voice reading isn't supported on this device.");
      return;
    }
    setTtsError(null);
    ttsHandle.current = speak({
      text: translated,
      lang: language,
      onStart: () => setSpeaking("speaking"),
      onEnd: () => {
        ttsHandle.current = null;
        setSpeaking("idle");
      },
      onError: () => {
        ttsHandle.current = null;
        setSpeaking("idle");
        setTtsError(
          "Voice reading stopped. Try again — your device may not have a voice for this language."
        );
      },
    });
    setSpeaking("speaking");
  }

  function pauseSpeech() {
    ttsHandle.current?.pause();
    setSpeaking("paused");
  }

  function resumeSpeech() {
    ttsHandle.current?.resume();
    setSpeaking("speaking");
  }

  async function translate(target: string) {
    setLoading(true);
    setError(null);
    try {
      const clean = sanitizeSummary(summary);
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, target }),
      });
      const data = (await res.json()) as {
        translated?: string;
        error?: string;
      };
      if (!res.ok || !data.translated) {
        throw new Error(data.error ?? "Translation failed");
      }
      setTranslated(data.translated);
    } catch {
      setError("Translation failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function togglePanel() {
    const closing = open;
    if (closing) {
      // Reset all output state when collapsing so reopening never shows
      // stale content with no language highlighted.
      setLanguage("en");
      setTranslated(null);
      setError(null);
      cancelSpeech();
    }
    setOpen(!closing);
  }

  return (
    <div className="border border-line bg-surface">
      <button
        type="button"
        onClick={togglePanel}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
        aria-controls="translation-panel"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
          <Languages className="h-4 w-4 text-muted" />
          Translate summary
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id="translation-panel" className="border-t border-line px-4 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                aria-pressed={language === l.code}
                onClick={() => {
                  if (language === l.code && !loading) return;
                  cancelSpeech();
                  setLanguage(l.code);
                  if (l.code === "en") {
                    setTranslated(null);
                    setError(null);
                  } else {
                    void translate(l.code);
                  }
                }}
                className={`rounded-tm px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  language === l.code
                    ? "bg-accent-btn text-white"
                    : "border border-line bg-background text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-10" aria-live="polite" aria-atomic="true">
            {loading && (
              <p className="font-mono text-xs text-muted">
                Translating…
              </p>
            )}
            {error && (
              <p role="alert" className="text-xs text-high">
                {error}
              </p>
            )}
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

          {!loading && !error && translated && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="sr-only" aria-live="polite">
                {speaking === "speaking"
                  ? "Reading the translation"
                  : speaking === "paused"
                    ? "Paused"
                    : ""}
              </span>
              {speaking === "idle" ? (
                <Button size="sm" variant="outline" onClick={listen}>
                  <Volume2 className="h-3.5 w-3.5" /> Listen
                </Button>
              ) : (
                <>
                  {speaking === "speaking" ? (
                    <Button size="sm" variant="outline" onClick={pauseSpeech}>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={resumeSpeech}>
                      <Play className="h-3.5 w-3.5" /> Resume
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={cancelSpeech}>
                    <Square className="h-3.5 w-3.5" /> Stop
                  </Button>
                </>
              )}
              {ttsError && (
                <p role="alert" className="w-full text-xs text-high">
                  {ttsError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
