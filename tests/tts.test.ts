import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  chunkForSpeech,
  getVoices,
  isSpeechSupported,
  pickVoiceForLang,
} from "@/lib/tts";

const VOICES: SpeechSynthesisVoice[] = [
  {
    lang: "en-US",
    name: "Google US English",
    localService: false,
    default: true,
    voiceURI: "en-us-1",
  },
  {
    lang: "fil-PH",
    name: "Microsoft James Online (Natural) - Filipino (Philippines)",
    localService: false,
    default: false,
    voiceURI: "fil-1",
  },
  {
    lang: "tl-PH",
    name: "Tagalog",
    localService: true,
    default: false,
    voiceURI: "tl-1",
  },
  {
    lang: "es-ES",
    name: "Google español",
    localService: false,
    default: false,
    voiceURI: "es-1",
  },
  {
    lang: "es-MX",
    name: "Spanish (Mexico)",
    localService: true,
    default: false,
    voiceURI: "es-mx-1",
  },
];

function installSpeechSynthesis(voices: SpeechSynthesisVoice[] = VOICES) {
  const synth = {
    getVoices: () => voices,
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    speak: () => {},
    onvoiceschanged: null as (() => void) | null,
  };
  (globalThis as unknown as { window: unknown }).window = {
    speechSynthesis: synth,
  };
}

function removeWindow() {
  delete (globalThis as unknown as { window?: unknown }).window;
}

describe("isSpeechSupported", () => {
  afterEach(removeWindow);

  it("is false when speechSynthesis is unavailable", () => {
    removeWindow();
    expect(isSpeechSupported()).toBe(false);
  });

  it("is true when speechSynthesis exists", () => {
    installSpeechSynthesis();
    expect(isSpeechSupported()).toBe(true);
  });
});

describe("getVoices / pickVoiceForLang", () => {
  beforeEach(() => installSpeechSynthesis());
  afterEach(removeWindow);

  it("returns the installed voices", () => {
    expect(getVoices()).toHaveLength(VOICES.length);
  });

  it("picks the English voice", () => {
    expect(pickVoiceForLang("en")?.lang).toBe("en-US");
  });

  it("prefers the natural Filipino voice over the plain Tagalog one", () => {
    const voice = pickVoiceForLang("tl");
    expect(voice?.voiceURI).toBe("fil-1");
  });

  it("matches the first voice for a language without a natural match", () => {
    expect(pickVoiceForLang("es")?.lang).toBe("es-ES");
  });

  it("returns null when no voice matches the language", () => {
    expect(pickVoiceForLang("xx")).toBeNull();
  });
});

describe("chunkForSpeech", () => {
  it("returns an empty array for empty or whitespace input", () => {
    expect(chunkForSpeech("")).toEqual([]);
    expect(chunkForSpeech("   \n  ")).toEqual([]);
  });

  it("keeps a short text in a single chunk", () => {
    expect(chunkForSpeech("Hello world.")).toEqual(["Hello world."]);
  });

  it("groups sentences without exceeding maxChars", () => {
    const text = "First sentence here. Second sentence here. Third one.";
    const chunks = chunkForSpeech(text, 30);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(30);
    }
    expect(chunks.join(" ")).toBe(text);
  });

  it("hard-splits an over-long single sentence on word boundaries", () => {
    const text =
      "This is a very long sentence without any punctuation until the very end so it needs to be split";
    const chunks = chunkForSpeech(text, 25);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(25);
      expect(chunk.startsWith(" ") || chunk.endsWith(" ")).toBe(false);
    }
    expect(chunks.join(" ")).toBe(text);
  });

  it("normalizes whitespace before chunking", () => {
    expect(chunkForSpeech("a   b\n\nc")).toEqual(["a b c"]);
  });
});
