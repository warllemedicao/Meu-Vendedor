export type ProductTransition = "fade" | "slide" | "cut";
export type ProductFormat = "9:16" | "1:1" | "16:9";
export const MAX_PRODUCT_SCENES = 8;
export const MAX_PRODUCT_MEDIA_BYTES = 150 * 1024 * 1024;
export const PRODUCT_VIDEO_BUCKET = "mv-video-assets";
export const productFormats = {
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 720, height: 720 },
  "16:9": { width: 1280, height: 720 },
};
export interface ProductVideoOptions {
  format: ProductFormat;
  secondsPerScene: number;
  transition: ProductTransition;
  zoom: boolean;
  title: string;
  price: string;
  callToAction: string;
}
export function validateProductMedia(file: { type: string; size: number }): "image" | "video" {
  const kind = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? "image"
    : ["video/mp4", "video/webm", "video/quicktime"].includes(file.type) ? "video" : null;
  if (!kind) throw new Error("Use fotos JPG, PNG ou WebP e vídeos MP4, WebM ou MOV.");
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > (kind === "image" ? 10 : 50) * 1024 * 1024) {
    throw new Error(kind === "image" ? "Cada foto deve ter até 10 MB." : "Cada vídeo deve ter até 50 MB.");
  }
  return kind;
}
export function productTimeline(count: number, seconds: number, elapsed: number) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PRODUCT_SCENES || ![2, 3, 4, 5].includes(seconds) || !Number.isFinite(elapsed)) {
    throw new Error("Escolha de 1 a 8 cenas e de 2 a 5 segundos por cena.");
  }
  const time = Math.max(0, Math.min(elapsed, count * seconds - 0.0001));
  const index = Math.floor(time / seconds);
  const local = time - index * seconds;
  const mix = index < count - 1 ? Math.max(0, (local - (seconds - 0.45)) / 0.45) : 0;
  return { index, local, progress: local / seconds, next: Math.min(index + 1, count - 1), mix };
}
export function productVideoFilename(title: string, id: string, extension: "mp4" | "webm") {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Identificador de vídeo inválido.");
  const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/, "") || "produto";
  return `${slug}--${id}.${extension}`;
}
export function ownedProductVideoPath(userId: string, filename: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId)
    || !/^[a-z0-9-]{1,40}--[a-f0-9-]{36}\.(mp4|webm)$/.test(filename)) throw new Error("O vídeo não pertence a esta conta.");
  return `${userId}/product-videos/${filename}`;
}
