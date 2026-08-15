import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Copies the pdf.js worker and tesseract worker+core into /public so they are
// served from the app origin. The production CSP is `worker-src 'self' blob:`
// and `script-src 'self' ...`, so cross-origin CDN workers / importScripts
// would be blocked and PDF extraction / OCR would fail in production.
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const copyPdfWorker = () => {
  const src = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
  if (!existsSync(src)) return false;
  mkdirSync(join(root, "public", "pdfjs"), { recursive: true });
  cpSync(src, join(root, "public", "pdfjs", "pdf.worker.min.mjs"));
  return true;
};

const copyTesseract = () => {
  const workerSrc = join(root, "node_modules", "tesseract.js", "dist", "worker.min.js");
  const corePkg = join(root, "node_modules", "tesseract.js-core");
  if (!existsSync(workerSrc) || !existsSync(corePkg)) return false;
  const coreDst = join(root, "public", "tesseract", "core");
  mkdirSync(coreDst, { recursive: true });
  cpSync(workerSrc, join(root, "public", "tesseract", "worker.min.js"));
  for (const f of [
    "tesseract-core-relaxedsimd-lstm.wasm.js",
    "tesseract-core-relaxedsimd-lstm.wasm",
    "tesseract-core-lstm.wasm.js",
    "tesseract-core-lstm.wasm",
  ]) {
    cpSync(join(corePkg, f), join(coreDst, f));
  }
  return true;
};

try {
  const pdf = copyPdfWorker();
  const tess = copyTesseract();
  if (pdf || tess) {
    console.log("[self-host-assets] copied pdf.js worker + tesseract worker/core to public/");
  } else {
    console.warn(
      "[self-host-assets] pdfjs-dist/tesseract.js not installed yet; skipping. Run again after `npm install`."
    );
  }
} catch (err) {
  console.warn("[self-host-assets] failed:", err.message);
}
