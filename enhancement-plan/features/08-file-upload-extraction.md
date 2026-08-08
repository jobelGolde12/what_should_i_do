# Feature 08 — File Upload & Extraction

> **Status: DONE** — `InputArea` now enforces a 10 MB size limit and extension/MIME validation with inline `role="alert"` errors instead of `window.alert`; shows extraction progress overlay ("Extracting text…") and file size next to the filename; adds whole-page drag-and-drop overlay. Extraction dispatch also works by file extension (not only MIME) so mislabeled files still parse.

## 1. What it is & its role

The **File Upload & Extraction** feature lets users drop or upload documents and images instead of pasting raw text. It extracts the text client-side before analysis. Supported formats: **TXT, PDF, DOCX, and images (JPG/PNG via OCR)**. Its role is to broaden input sources so users can analyze real-world documents (notices, contracts, memos) directly.

## 2. Current functionality

### Where it lives
- **UI + extraction:** `src/components/input/InputArea.tsx` → `extractTextFromFile()`.
- **Libraries:** `pdfjs-dist` (PDF), `mammoth` (DOCX), `tesseract.js` (OCR).
- **Integration:** after extraction, the text is set into the input area and analysis is triggered.

### How it works today
1. User drags/drops or selects a file.
2. Based on MIME type:
   - `text/plain` → `file.text()`.
   - `application/pdf` → loads `pdfjs-dist`, iterates pages, joins text content.
   - DOCX → `mammoth.extractRawText`.
   - `image/*` → `tesseract.js.recognize` (English).
3. Extracted text populates the textarea and analysis runs.
4. The file name is shown; a "Clear" button resets.

### Current limitations
- **PDF extraction is naive** — no table/order handling, no scanned-PDF OCR (only text-layer PDFs).
- **OCR is English-only**, no language model selection, and can be slow/heavy in the browser.
- **Large files** are read fully into memory; no size limits or chunking.
- **No drag-drop onto the whole page** — only the input area.
- Extraction errors surface via a blocking `window.alert`.
- No progress feedback during PDF/OCR extraction.
- No server-side processing fallback for files the client can't parse.

## 3. Future enhancements (production-ready File Upload & Extraction)

### 3.1 Upload limits & validation
- Enforce max file size (e.g., 10 MB) and accepted-type validation with clear inline error messages.
- Show file size and a success/error toast instead of `window.alert`.

### 3.2 Improved PDF handling
- Support **scanned PDFs** with OCR fallback (Tesseract on rendered pages).
- Preserve reading order using PDF layout info.
- Add a server-side extraction route as a fallback for unsupported/complex files.

### 3.3 Configurable OCR
- Allow language selection for OCR (English, Filipino, or auto).
- Add progress percentage for OCR and extraction.

### 3.4 Chunked processing
- Chunk large documents for analysis and merge results, respecting token limits.

### 3.5 Better UX
- Whole-page drag-and-drop overlay.
- Multiple file support (analyze sequentially or pick one).
- Preview of extracted text before analyzing.

### 3.6 Security
- **Never send raw file bytes to the client-only path unnecessarily**; validate on server if a server extraction route is added.
- Sanitize extracted text (already handled by `cleanText`).

### 3.7 Testing
- Fixture files (sample PDF, DOCX, TXT, image) with golden extraction outputs.
- Unit tests for MIME dispatch and error paths.

> **Definition of "done" for this feature:** Uploads are validated with clear errors, PDF/DOCX/OCR extraction is robust and layered (client + server fallback), supports language-selected OCR, shows progress, and is covered by fixture-based tests.
