import { assessProductPhoto, type PhotoAssessment } from "./product-photo-filter";
import type { Worker } from "tesseract.js";

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => { cleanup(); reject(new DOMException("Análise cancelada.", "AbortError")); };
    const cleanup = () => signal.removeEventListener("abort", stop);
    if (signal.aborted) { stop(); return; }
    signal.addEventListener("abort", stop, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

export async function createPhotoAnalyzer(signal: AbortSignal) {
  const { createWorker } = await import("tesseract.js");
  if (signal.aborted) throw new DOMException("Análise cancelada.", "AbortError");
  let worker: Worker | null = null;
  const abort = () => { void worker?.terminate(); worker = null; };
  signal.addEventListener("abort", abort, { once: true });
  const pending = createWorker("por", 1, {
    workerPath: new URL("/product-ocr/worker.min.js", location.origin).href,
    corePath: new URL("/product-ocr/core", location.origin).href,
    langPath: new URL("/product-ocr/lang", location.origin).href,
    workerBlobURL: false,
    errorHandler: () => { /* recognize rejects; raw engine messages do not become product instructions. */ },
  });
  // Keep late initialization from leaking a worker after cancellation or timeout.
  void pending.then(value => { if (signal.aborted) void value.terminate(); }).catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    worker = await abortable(Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("A leitura de texto não ficou pronta. Você pode revisar as fotos manualmente.")), 30000); })]), signal);
    if (signal.aborted) { abort(); throw new DOMException("Análise cancelada.", "AbortError"); }
  } catch (error) { signal.removeEventListener("abort", abort); void pending.then(value => value.terminate()).catch(() => {}); throw error; }
  finally { if (timer) clearTimeout(timer); }
  return {
    async analyze(file: File): Promise<PhotoAssessment> {
      if (!worker || signal.aborted) throw new DOMException("Análise cancelada.", "AbortError");
      const image = await createImageBitmap(file);
      if (!image.width || !image.height || image.width * image.height > 40_000_000) { image.close(); throw new Error("A imagem excede 40 megapixels."); }
      const canvas = document.createElement("canvas"); const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d"); if (!ctx) { image.close(); throw new Error("Não foi possível preparar a foto."); }
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const { data } = await abortable(Promise.race([worker.recognize(canvas), new Promise<never>((_, reject) => { timeout = setTimeout(() => { abort(); reject(new Error("A análise demorou demais. Revise as fotos manualmente.")); }, 25000); })]), signal);
        return assessProductPhoto(data.text, data.confidence);
      } finally { if (timeout) clearTimeout(timeout); }
    },
    async dispose() { signal.removeEventListener("abort", abort); const current = worker; worker = null; await current?.terminate(); },
  };
}
