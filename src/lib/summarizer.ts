/**
 * On-device summarization model (Pro) backed by @xenova/transformers.
 *
 * Model loading is expensive (download + warm-up can exceed a 30s client
 * timeout on a cold process). To keep the first request usable, the model
 * load is kicked off lazily in the background and requests keep returning a
 * bounded extractive fallback until the real model is ready (BUG-06).
 */
import { pipeline, type SummarizationPipeline } from "@xenova/transformers";

export const MODEL_ID = "Xenova/distilbart-cnn-12-6";

let loadPromise: Promise<SummarizationPipeline> | null = null;
let loadStarted = false;
let modelReady = false;

/** Starts the model load in the background (once). Resolves when ready. */
export function startModelLoad(): Promise<SummarizationPipeline> {
  if (!loadStarted) {
    loadStarted = true;
    loadPromise = pipeline("summarization", MODEL_ID, { quantized: true })
      .then((p) => {
        modelReady = true;
        return p;
      })
      .catch((err) => {
        // Reset so a later request can retry.
        loadStarted = false;
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise as Promise<SummarizationPipeline>;
}

/** True once the real model has finished loading in this process. */
export function isModelReady(): boolean {
  return modelReady;
}

/** Returns the loaded pipeline, or null when it isn't ready yet. */
export function getSummarizer(): Promise<SummarizationPipeline> | null {
  return loadStarted ? (loadPromise as Promise<SummarizationPipeline>) : null;
}

/** Optional explicit pre-warm (e.g. called at server boot). Fire-and-forget. */
export function warmSummarizer(): void {
  startModelLoad().catch(() => {
    /* background warm-up failure is non-fatal */
  });
}
