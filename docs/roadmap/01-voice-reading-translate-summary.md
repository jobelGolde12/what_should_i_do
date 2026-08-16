# Feature 1 — Voice Reading for the Translated Summary

> **Status:** ✅ Implemented (2026-08) · **Priority:** High · **Area:** UI /
> a11y / i18n · **Depends on:** nothing (fully client-side)
>
> Implemented in `src/lib/tts.ts` + `src/components/results/TranslationBlock.tsx`
> with tests in `tests/tts.test.ts`. Decision D1 resolved as specced: the
> control reads the translated text only.

## Goal

Let users **listen** to the translated summary instead of only reading it. A
speaker control appears inside the "Translate summary" panel and reads the
currently displayed translation aloud in the correct language.

Use case: a user translates a summary into Filipino (or any language) but
prefers to *hear* it — or wants to confirm pronunciation of an unfamiliar
term.

## Current state (verified)

- The translate block is `src/components/results/TranslationBlock.tsx` — a
  collapsible client component that:
  - Offers 7 languages: `en, tl, es, fr, de, it, pt` (`LANGUAGES`).
  - Calls `POST /api/translate` (`src/app/api/translate/route.ts`) which
    proxies **MyMemory** (`api.mymemory.translated.net`), chunks at 480 chars,
    caches server-side by `(textHash, targetLang)` for 24h, rate-limits by IP
    (30/min), and enforces a per-user daily translation quota
    (`limits.translationsPerDay`).
  - Renders the translated text in a `<p aria-live="polite">` region.
- There is **no** existing TTS anywhere in the app. No `speechSynthesis`
  usage, no audio assets, no `speech-recognition` code.

## Requirements

1. A play/pause/stop control inside the translation panel.
2. Reads the **translated** text (non-`en` languages). For `en` there is no
   translated output today (the panel shows a hint), so the control is hidden
   unless a translation exists — see Decision D1.
3. Picks the best available browser voice for the target language, falling
   back gracefully when no matching voice exists (common for `tl` on some
   platforms).
4. Works offline-ish, costs nothing, sends **no** text to any server
   (privacy-friendly: matches the product's local-first stance).
5. Keyboard accessible, screen-reader friendly, works at 320px width.
6. Playback stops cleanly when: the user closes the panel, switches
   language, unmounts the component, or presses Stop.

## Design decisions

| ID | Decision | Choice | Rationale |
|----|----------|--------|-----------|
| D1 | What does the control read? | The translated text only; hidden when no translation is rendered | Avoids ambiguity about what will be spoken; the English summary is already visible in the Summary section. **Alternative (cheap):** also read the original summary when `language === "en"` — can be added later. |
| D2 | TTS engine | Native Web Speech API (`window.speechSynthesis` + `SpeechSynthesisUtterance`) | Zero dependencies, zero cost, no server round-trip, respects OS voices. A server TTS (e.g. ElevenLabs/Google) is overkill and adds cost + PII exposure for a short summary. |
| D3 | Long text handling | Chunk into sentence groups (~200–300 chars) and queue utterances | Avoids the well-known Chrome/Safari issue where long utterances cut off or stall; also gives natural pauses. |
| D4 | Voice selection | Pick the first voice whose `lang` starts with the target BCP-47 prefix (`tl`, `es`, `fr`, …); prefer "premium"/"natural" voices when present; else default voice | Deterministic, no user settings UI needed in v1. |
| D5 | Where does the logic live | New `src/lib/tts.ts` helper + small state in `TranslationBlock` | Keeps the component thin and the logic unit-testable. |

## UI / UX spec

Placement — inside the translation panel, directly below the translated text:

```
┌─────────────────────────────────────────────┐
│ Translate summary                      ▾    │
│ (languages: EN TL ES FR DE IT PT)           │
│                                             │
│  Kinakailangan ang agarang aksyon dahil sa… │
│                                             │
│  [▶ Listen]  ·  [⏸ Pause]  ·  [⏹ Stop]      │  ← new row
└─────────────────────────────────────────────┘
```

Behavior:

- **Idle:** small ghost/outline button `Listen` (lucide `Volume2`) with label
  `aria-label="Listen to the translation"`.
- **Speaking:** button becomes `Pause` (`Pause` icon); a second `Stop`
  (`Square`) button appears. The current line is also announced via
  `aria-live`.
- **Paused:** button becomes `Resume` (`Play` icon).
- **Finished / stopped:** returns to `Listen`.
- **No voice available** for the language: the button is rendered but a
  one-line hint appears on click — *"No voice available for this language on
  your device."* (no error toast, no crash).
- **While translating/loading:** control disabled (nothing to read yet).
- **Language switch:** `speechSynthesis.cancel()` and reset state.
- **Panel collapse / unmount:** `cancel()` in a `useEffect` cleanup.
- **Responsive:** the control row uses `flex flex-wrap items-center gap-2`;
  buttons reuse the shared `Button` (size `sm`) so touch targets stay ≥ 44px.
- **Theming:** uses existing tokens only — `border-line`, `bg-surface`,
  `text-ink`, `text-muted`, `rounded-tm`, accent for the active/pressed
  state (`bg-accent-btn text-white`), matching the language-pill styling
  already in the panel.

Accessibility:

- Buttons are real `<button>`s with visible text + icons (`aria-hidden` on
  the icon).
- Playback state is announced with a polite `aria-live` region (e.g.
  "Reading the translation…" / "Stopped").
- No reliance on color alone for state — label text changes
  (Listen/Pause/Resume/Stop).
- `prefers-reduced-motion` is irrelevant here (audio, not motion).

## Implementation plan

### Step 1 — `src/lib/tts.ts` (new, client-only helper)

```ts
export type TTSSupport = { supported: boolean; error?: string };

export function isSpeechSupported(): boolean;          // typeof window !== "undefined" && "speechSynthesis" in window

export function getVoices(): SpeechSynthesisVoice[];   // wraps getVoices() with voiceschanged refresh

export function pickVoiceForLang(lang: string): SpeechSynthesisVoice | null;
// 1. normalize lang prefix (tl → "fil" alias? see below)
// 2. prefer voices whose lang starts with prefix, "natural"/"premium" first
// 3. fallback: default voice (speechSynthesis.getVoices()[0]) — caller decides

export function chunkForSpeech(text: string, maxChars?: number): string[];
// split on sentence boundaries (.!?\n), group until maxChars (~280), never split words

export function speak(opts: {
  text: string;
  lang: string;
  onStart?: () => void;
  onEnd?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onError?: (e: unknown) => void;
}): { cancel(): void };
// creates utterances from chunkForSpeech, sets voice + lang + rate 1.0 + pitch 1.0,
// queues them, wires the callbacks, returns a cancel handle
```

Notes:

- **Tagalog voice alias:** browsers expose Filipino voices as `fil` (or `tl`).
  `pickVoiceForLang` should try `["tl", "fil", "fil-PH", "tl-PH"]` prefixes
  for `tl`.
- Listen for `voiceschanged` once at module load so voices are available on
  first click (Safari/Chrome load them async).

### Step 2 — Wire into `TranslationBlock.tsx`

- Add state: `speaking: "idle" | "speaking" | "paused"`, `ttsError: string | null`.
- Add a `useEffect` cleanup that calls `speechSynthesis.cancel()` on unmount.
- In `togglePanel()` (collapse) and in the language-button click handler,
  call `cancel()` and reset speaking state.
- Render the control row only when `translated` is present (`!loading &&
  !error && translated`).
- On `Listen`: if `!isSpeechSupported()` show a muted hint; else call
  `speak({ text: translated, lang: language })` with callbacks that flip
  state; store the cancel handle in a ref.
- On `Pause`/`Resume`: `speechSynthesis.pause()` / `.resume()` and update
  state (utterance-level callbacks may not fire on some browsers — drive
  state from the click handlers too).
- On `Stop`: `speechSynthesis.cancel()`.

### Step 3 — Tests

- `tests/tts.test.ts` (vitest, jsdom):
  - `chunkForSpeech` respects max length, keeps words whole, splits on
    sentence boundaries.
  - `pickVoiceForLang` returns the best-matching voice for a fixture voice
    list (`{ lang: "fil-PH", name: "Filipino" }`, `{ lang: "es-ES" }`, …)
    and prefers natural/premium; returns `null` when nothing matches.
  - `isSpeechSupported` is false when `window.speechSynthesis` is absent.

## Edge cases

| Case | Behavior |
|------|----------|
| Browser without `speechSynthesis` (old Firefox) | Control hidden; no crash |
| No voice for language (e.g. `tl` on some Windows) | Falls back to default voice; if nothing speaks, hint text on next click |
| User collapses panel mid-speech | Speech cancelled immediately |
| User switches language mid-speech | Cancelled; new language can be read fresh |
| Very long translated summary | Chunked playback, no truncation |
| Tab backgrounded (Chrome throttling) | Speech may pause; Resume/Listen re-entrant and safe |
| Screen reader active | Buttons labelled; state announced politely |

## Verification

1. `npm run typecheck` and `npm test` pass.
2. `npm run dev`, analyze a message, open **Translate summary**, pick
   Filipino → translated text appears → click **Listen** → audio plays with a
   Filipino voice (if installed), `Pause`/`Resume`/`Stop` work.
3. Switch language mid-playback → speech stops, new language can be played.
4. Collapse the panel mid-playback → speech stops.
5. Check at 320px width — control row wraps, buttons remain tappable.
6. Manual keyboard pass: Tab to `Listen`, Enter/Space toggles; state label
   changes are read by a screen reader (aria-live).

## Files touched

| File | Change |
|------|--------|
| `src/lib/tts.ts` | **New** — TTS helper (support check, voices, chunking, `speak`) |
| `src/components/results/TranslationBlock.tsx` | Add control row + state + cleanup |
| `tests/tts.test.ts` | **New** — unit tests |
| `docs/design-system.md` | Optional: note the TTS control under the Results components |
