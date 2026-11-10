import { MAX_PRODUCT_SCENES, MAX_PRODUCT_MEDIA_BYTES, productFormats, productTimeline, validateProductMedia, type ProductVideoOptions } from "./product-video";

export interface ProductMedia { id: string; file: File; url: string; kind: "image" | "video" }
type LoadedMedia = { element: HTMLImageElement | HTMLVideoElement; width: number; height: number; kind: "image" | "video" };
export interface ProductPlayer { duration: number; draw(time: number): void; prepare(time: number): Promise<void>; pause(): void; dispose(): void }
const cancelled = () => new DOMException("Exportação cancelada.", "AbortError");

export function productRecordingType() {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) return "";
  return ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp8", "video/webm"]
    .find(type => MediaRecorder.isTypeSupported(type)) ?? "";
}

async function loadMedia(item: ProductMedia, signal?: AbortSignal): Promise<LoadedMedia> {
  validateProductMedia(item.file);
  if (signal?.aborted) throw cancelled();
  const element = document.createElement(item.kind === "image" ? "img" : "video");
  if (element instanceof HTMLVideoElement) { element.muted = true; element.playsInline = true; element.preload = "auto"; }
  try {
    await new Promise<void>((resolve, reject) => {
      const ready = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error(`Não foi possível abrir ${item.file.name}. Tente outro arquivo.`)); };
      const abort = () => { cleanup(); reject(cancelled()); };
      const timer = setTimeout(fail, 15000);
      const event = item.kind === "image" ? "load" : "loadeddata";
      function cleanup() { clearTimeout(timer); element.removeEventListener(event, ready); element.removeEventListener("error", fail); signal?.removeEventListener("abort", abort); }
      element.addEventListener(event, ready, { once: true }); element.addEventListener("error", fail, { once: true });
      signal?.addEventListener("abort", abort, { once: true }); element.src = item.url;
    });
    const width = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
    const height = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;
    if (!width || !height || width * height > 40_000_000) throw new Error("Use uma imagem ou vídeo de até 40 megapixels.");
    if (element instanceof HTMLVideoElement && (!Number.isFinite(element.duration) || element.duration <= 0 || element.duration > 120)) {
      throw new Error("Use clipes com até dois minutos. A montagem aproveita o início de cada clipe.");
    }
    return { element, width, height, kind: item.kind };
  } catch (error) {
    element.removeAttribute("src"); if (element instanceof HTMLVideoElement) element.load();
    throw error;
  }
}

function lines(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, font: number, maxLines: number) {
  ctx.font = `600 ${font}px system-ui, sans-serif`;
  const words = text.trim().split(/\s+/); const output: string[] = []; let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > width && line) { output.push(line); line = word; } else line = candidate;
  }
  if (line) output.push(line);
  output.slice(0, maxLines).forEach((value, i) => {
    if (i === maxLines - 1 && output.length > maxLines) value += "…";
    while (value.length > 1 && ctx.measureText(value).width > width) value = value.slice(0, -2) + "…";
    ctx.fillText(value, x, y + i * font * 1.3);
  });
}

export async function createProductPlayer(canvas: HTMLCanvasElement, items: ProductMedia[], options: ProductVideoOptions, signal?: AbortSignal): Promise<ProductPlayer> {
  productTimeline(items.length, options.secondsPerScene, 0);
  if (!(options.format in productFormats) || !["fade", "slide", "cut"].includes(options.transition)) throw new Error("Formato de vídeo inválido.");
  if (items.length > MAX_PRODUCT_SCENES || items.reduce((n, item) => n + item.file.size, 0) > MAX_PRODUCT_MEDIA_BYTES) throw new Error("Use até 8 cenas e 150 MB no total.");
  const loaded: LoadedMedia[] = [];
  try { for (const item of items) loaded.push(await loadMedia(item, signal)); }
  catch (error) { for (const item of loaded) { item.element.removeAttribute("src"); if (item.element instanceof HTMLVideoElement) item.element.load(); } throw error; }
  const { width, height } = productFormats[options.format]; canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu preparar a prévia.");
  const title = options.title.trim().slice(0, 80), price = options.price.trim().slice(0, 40), cta = options.callToAction.trim().slice(0, 60);
  const top = title ? height * 0.16 : height * 0.04;
  const bottom = price || cta ? height * 0.2 : height * 0.06;
  const area = { x: width * 0.05, y: top, width: width * 0.9, height: height - top - bottom };
  let disposed = false, playing = false;
  function paint(index: number, progress: number, offset: number, alpha: number) {
    const item = loaded[index]; const zoom = options.zoom && item.kind === "image" ? 0.92 + progress * 0.08 : 1;
    const scale = Math.min(area.width / item.width, area.height / item.height) * zoom;
    const w = item.width * scale, h = item.height * scale;
    ctx!.save(); ctx!.globalAlpha = alpha;
    ctx!.beginPath(); ctx!.rect(area.x, area.y, area.width, area.height); ctx!.clip();
    ctx!.drawImage(item.element, area.x + (area.width - w) / 2 + offset, area.y + (area.height - h) / 2, w, h); ctx!.restore();
  }
  function draw(time: number) {
    if (disposed) return;
    const frame = productTimeline(loaded.length, options.secondsPerScene, time);
    loaded.forEach((item, index) => {
      if (!(item.element instanceof HTMLVideoElement)) return;
      const active = index === frame.index || (index === frame.next && frame.mix > 0);
      if (playing && active && item.element.paused && !item.element.ended && item.element.currentTime < item.element.duration - 0.03) {
        // prepare() has already checked playback; draw never schedules an unhandled promise.
        void item.element.play().catch(() => {});
      } else if (!playing || !active) item.element.pause();
    });
    ctx!.fillStyle = "#f7f5f1"; ctx!.fillRect(0, 0, width, height);
    const mix = options.transition === "cut" ? 0 : frame.mix;
    paint(frame.index, frame.progress, options.transition === "slide" ? -mix * width : 0, options.transition === "fade" ? 1 - mix : 1);
    if (mix > 0) paint(frame.next, 0, options.transition === "slide" ? (1 - mix) * width : 0, options.transition === "fade" ? mix : 1);
    ctx!.textAlign = "center"; ctx!.fillStyle = "#152d29";
    if (title) lines(ctx!, title, width / 2, height * 0.065, width * 0.88, Math.min(width * 0.055, height * 0.05), 2);
    if (price) lines(ctx!, price, width / 2, height - bottom * 0.65, width * 0.88, Math.min(width * 0.06, height * 0.055), 1);
    if (cta) { ctx!.fillStyle = "#425d55"; lines(ctx!, cta, width / 2, height - height * 0.055, width * 0.88, Math.min(width * 0.033, height * 0.035), 1); }
  }
  return {
    duration: loaded.length * options.secondsPerScene,
    draw,
    async prepare(time) {
      for (let i = 0; i < loaded.length; i++) {
        const element = loaded[i].element;
        if (!(element instanceof HTMLVideoElement)) continue;
        const local = Math.max(0, time - i * options.secondsPerScene);
        const target = Math.min(local, Math.max(0, element.duration - 0.05));
        if (Math.abs(element.currentTime - target) > 0.02) {
          await new Promise<void>((resolve, reject) => {
            const finish = () => { clearTimeout(timer); element.removeEventListener("seeked", finish); resolve(); };
            const timer = setTimeout(() => { element.removeEventListener("seeked", finish); reject(new Error("Não foi possível posicionar o clipe.")); }, 10000);
            element.addEventListener("seeked", finish, { once: true }); element.currentTime = target;
          });
        }
        await element.play(); element.pause();
      }
      playing = true; draw(time);
    },
    pause() { playing = false; for (const item of loaded) if (item.element instanceof HTMLVideoElement) item.element.pause(); },
    dispose() { disposed = true; for (const item of loaded) { if (item.element instanceof HTMLVideoElement) item.element.pause(); item.element.removeAttribute("src"); if (item.element instanceof HTMLVideoElement) item.element.load(); } },
  };
}

export async function renderProductVideo(items: ProductMedia[], options: ProductVideoOptions, signal: AbortSignal, onProgress: (value: number) => void): Promise<Blob> {
  const mimeType = productRecordingType();
  if (!mimeType) throw new Error("Este navegador não suporta exportação de vídeo. Tente uma versão atual do Chrome, Edge ou Safari.");
  if (document.hidden) throw new Error("Mantenha esta aba aberta durante a exportação.");
  const canvas = document.createElement("canvas");
  const player = await createProductPlayer(canvas, items, options, signal);
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined;
  let frame = 0, timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await player.prepare(0);
    if (signal.aborted) throw cancelled();
    stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = [];
    const blob = await new Promise<Blob>((resolve, reject) => {
      let settled = false;
      const cleanup = () => { signal.removeEventListener("abort", stop); document.removeEventListener("visibilitychange", visibility); };
      const fail = (error: Error) => { if (settled) return; settled = true; cleanup(); reject(error); };
      const stop = () => fail(cancelled());
      const visibility = () => { if (document.hidden) fail(new Error("Exportação interrompida porque a aba ficou em segundo plano. Volte à página e tente novamente.")); };
      signal.addEventListener("abort", stop, { once: true }); document.addEventListener("visibilitychange", visibility);
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder!.onerror = () => fail(new Error("O navegador não conseguiu exportar o vídeo."));
      recorder!.onstop = () => { if (!settled) { settled = true; cleanup(); resolve(new Blob(chunks, { type: recorder!.mimeType.split(";")[0] })); } };
      const started = performance.now();
      recorder!.start(250);
      const tick = () => {
        if (settled) return;
        try { const elapsed = (performance.now() - started) / 1000; player.draw(Math.min(elapsed, player.duration - 0.001)); onProgress(Math.min(99, Math.round(elapsed / player.duration * 100))); }
        catch { fail(new Error("Não foi possível montar uma das cenas. Verifique os arquivos.")); return; }
        frame = requestAnimationFrame(tick);
      };
      tick();
      timer = setTimeout(() => { if (!settled && recorder!.state === "recording") { player.draw(player.duration - 0.001); recorder!.stop(); } }, player.duration * 1000);
    });
    if (!blob.size || blob.size > 100 * 1024 * 1024) throw new Error("O vídeo exportado ficou vazio ou excedeu 100 MB. Reduza a duração ou a quantidade de cenas.");
    onProgress(100); return blob;
  } finally {
    if (timer) clearTimeout(timer); cancelAnimationFrame(frame);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach(track => track.stop()); player.dispose();
  }
}
