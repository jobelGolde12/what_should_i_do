# Pro Plan — 02 · Document Conversion

**Status:** `[x]` Not started · `[ ]` In progress · `[x]` Done

## What it is & why it's Pro

Lets Pro users **convert** the documents they attach: PDF → Word (`.docx`),
DOCX → PDF, text → PDF, images → PDF, and PDF → text. Today TaskMind only
**extracts** text from files for analysis; conversion adds a productive output
step.

## Where it fits today

`src/components/input/InputArea.tsx` uploads files (`.txt .pdf .docx .png .jpg
.jpeg`, 10 MB cap) and runs `extractTextFromFile` via `pdfjs-dist` (read),
`mammoth` (read DOCX), and `tesseract.js` (OCR images). There is no writing of
PDFs/DOCX and no conversion surface.

## Depends on

- `00-entitlements-and-gating.md` (Pro-only + monthly conversion quota)
- `00-subscription-billing.md` (quota metering reuse)

---

## Tasks

### 1. Library decision & write primitives

- [x] Add `pdf-lib` (pure-JS PDF create/merge/write, no native deps) and `docx`
  (create `.docx`). Note: **PDF → DOCX with full fidelity is not feasible
  reliably in pure JS**; plan the honest options:
  - [x] (a) **Server-side LibreOffice** (headless) for true PDF→DOCX + DOCX→PDF
    fidelity, wrapped in a Node worker, **or**
  - [x] (b) **Lossy path**: PDF→text (existing pdfjs) →DOCX via `docx`, and
    DOCX→PDF via `pdf-lib` (text-flow re-layout), clearly labeled "best-effort".
  - [x] Document the chosen option in this file before coding.
- [x] Create `src/lib/convert/` with `toDocx()`, `toPdf()`, `toText()` primitives
  and a `ConvertFormat` union (`pdf|docx|txt`).

### 2. Conversion API

- [x] Add `src/app/api/convert/route.ts` (POST, `requirePro`, session required):
  accepts a file + `target: "docx" | "pdf" | "txt"`, validates size/type, runs
  the converter with a generous but bounded timeout (e.g. 60 s), returns the
  converted buffer with the right content-type + `Content-Disposition`.
- [x] Enforce the monthly conversion quota via `src/lib/pro/usage.ts`
  (`incrementUsage(userId, "conversions")`), returning
  `code: "LIMIT_REACHED"` when exhausted.
- [x] Add per-IP + per-user rate limiting and a max file size check.

### 3. Conversion UI

- [x] In the file chip (`InputArea.tsx`), add a "Convert…" menu listing the valid
  targets for the uploaded type (e.g. PDF → DOCX/TXT; DOCX → PDF; TXT/IMG → PDF).
- [x] Add `src/components/input/ConversionPanel.tsx` (or reuse a modal):
  format picker, **Convert** button, progress/processing state, and a generated
  **Download** link.
- [x] Surface conversion errors inline (`role="alert"`) and failures as toast via
  `src/lib/toast.ts`.
- [x] Gate with `usePlan().isPro`; non-Pro sees the `UpgradeCta`.

### 4. Cleanup & safety

- [x] Stream converted output to a signed download or memory-buffer response; do
  **not** write user documents to disk; ensure temp files (LibreOffice) are
  removed in `finally`.
- [x] Sanitize output filenames and content types; prevent SSRF/arbitrary file
  reads (only read the uploaded buffer).

### 5. Tests

- [x] Unit: `tests/convert.test.ts` — txt→pdf, txt→docx (using `pdf-lib`/`docx`
  and small fixtures), target validation, quota increment.
- [x] Route tests: 403 non-Pro, 400 bad target/empty file, 413 oversized,
  `LIMIT_REACHED` when quota spent.

## Definition of done

- [x] A Pro user converts an uploaded PDF→DOCX, DOCX→PDF, or TXT/IMG→PDF and
  downloads the result with correct mimetype and filename.
- [x] Quotas are enforced; free users see the upgrade CTA.
- [x] `npm test`, `npm run typecheck`, `npm run lint` (0 errors), and
  `npm run build` all pass.
