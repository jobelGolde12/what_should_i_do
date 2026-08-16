/**
 * Client-only TTS helper wrapping the Web Speech API (`speechSynthesis`).
 *
 * - No dependency, no server round-trip: the text never leaves the browser.
 * - Picks the best available voice for the target language, falling back to
 *   the browser default when none matches (e.g. Tagalog on some platforms).
 * - Chunks long text so browsers that stall on very long utterances keep
 *   playing with natural sentence pauses.
 */

export type TTSStatus = "idle" | "speaking" | "paused";

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined"
  );
}

let cachedVoices: SpeechSynthesisVoice[] | null = null;

function loadVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices;
  const voices = loadVoices();
  if (voices.length > 0) cachedVoices = voices;
  return voices;
}

// Browsers load voices asynchronously; refresh the cache when ready.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

/** Language prefixes to try for a UI language code (Tagalog → fil/tl). */
const LANGUAGE_ALIASES: Record<string, string[]> = {
  tl: ["tl", "fil", "fil-ph", "tl-ph"],
};

function langPrefixes(lang: string): string[] {
  const base = lang.toLowerCase().split("-")[0] ?? lang.toLowerCase();
  return LANGUAGE_ALIASES[base] ?? [lang.toLowerCase()];
}

/**
 * Picks the best voice for a language: prefers natural/premium/neural voices,
 * then the first voice whose BCP-47 lang matches, else null (caller falls
 * back to the default voice).
 */
export function pickVoiceForLang(
  lang: string
): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (voices.length === 0) return null;

  const prefixes = langPrefixes(lang);
  const matches = voices.filter((v) =>
    prefixes.some((p) => v.lang.toLowerCase().startsWith(p))
  );
  if (matches.length === 0) return null;

  const natural = matches.find((v) =>
    /natural|premium|enhanced|neural/i.test(v.name)
  );
  return natural ?? matches[0];
}

/** Splits an over-long string on word boundaries so no chunk exceeds maxChars. */
function splitLong(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut <= 0) cut = maxChars;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest.trim());
  return out.filter(Boolean);
}

/**
 * Splits text into sentence-grouped chunks (each ≤ maxChars) for playback.
 * Never splits words; long single sentences are hard-split on word boundaries.
 */
export function chunkForSpeech(text: string, maxChars = 280): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const combined = (current ? current + " " : "") + sentence;
    if (combined.length > maxChars) {
      if (current) chunks.push(current.trim());
      current = "";
      if (sentence.length > maxChars) {
        chunks.push(...splitLong(sentence, maxChars));
      } else {
        current = sentence;
      }
    } else {
      current = combined;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export type SpeakHandle = {
  cancel(): void;
  pause(): void;
  resume(): void;
};

/**
 * Speaks `text` in the best voice for `lang`, chunked for stability.
 * Returns a handle for cancel/pause/resume, or null when unsupported.
 */
export function speak(opts: {
  text: string;
  lang: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}): SpeakHandle | null {
  if (!isSpeechSupported()) return null;

  const synth = window.speechSynthesis;
  synth.cancel(); // clear any prior queue

  const voice = pickVoiceForLang(opts.lang);
  const chunks = chunkForSpeech(opts.text);
  let started = false;
  let finished = 0;

  for (const chunk of chunks) {
    const utterance = new SpeechSynthesisUtterance(chunk);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = opts.lang;
    }
    utterance.rate = opts.rate ?? 1;
    utterance.pitch = opts.pitch ?? 1;

    utterance.onstart = () => {
      if (!started) {
        started = true;
        opts.onStart?.();
      }
    };
    utterance.onend = () => {
      finished += 1;
      if (finished >= chunks.length) opts.onEnd?.();
    };
    utterance.onerror = (event) => {
      opts.onError?.(event.error ?? new Error("Speech synthesis failed"));
    };

    synth.speak(utterance);
  }

  return {
    cancel: () => synth.cancel(),
    pause: () => synth.pause(),
    resume: () => synth.resume(),
  };
}
