import { VideoJobError } from "./service.ts";

const maxBytes = 10 * 1024 * 1024;
export interface SyncedImageDependencies {
  findProduct(userId: string, productId: string): Promise<{ platformId: string; imageUrl: string | null } | null>;
  existing(path: string): Promise<Uint8Array | null>;
  upload(path: string, bytes: Uint8Array, mime: string): Promise<void>;
  fetcher?: typeof fetch;
}

function approvedImageUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new VideoJobError(422, "product_image_source_invalid", "O endereço da imagem sincronizada não é válido."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443" ||
    !(host === "cf.shopee.com.br" || host === "cf.shopee.com" || host.endsWith(".img.susercontent.com"))) {
    throw new VideoJobError(422, "product_image_source_invalid", "A imagem do produto não pertence a uma fonte de imagens suportada.");
  }
  return url;
}

function imageType(bytes: Uint8Array): { mime: string; extension: string } {
  if (bytes.length >= 16) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
    if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) return { mime: "image/png", extension: "png" };
    const text = new TextDecoder("ascii");
    if (text.decode(bytes.slice(0, 4)) === "RIFF" && text.decode(bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  }
  throw new VideoJobError(422, "product_image_format_invalid", "A foto sincronizada não retornou uma imagem PNG, JPEG ou WebP válida.");
}

export async function importSyncedProductImage(userId: string, productId: string, dependencies: SyncedImageDependencies): Promise<{ path: string }> {
  const product = await dependencies.findProduct(userId, productId);
  if (!product) throw new VideoJobError(404, "product_not_found", "O produto não foi encontrado nesta conta.");
  if (!product.imageUrl) throw new VideoJobError(422, "product_image_missing", "O produto selecionado não tem uma foto disponível. Escolha outro produto ou envie uma foto.");
  if (product.platformId !== "shopee") throw new VideoJobError(422, "product_image_source_unsupported", "A importação de imagens desta plataforma ainda não está disponível.");
  let url = approvedImageUrl(product.imageUrl);
  const fetcher = dependencies.fetcher ?? fetch;
  let response: Response | null = null;
  const signal = AbortSignal.timeout(15000);
  try {
    for (let hop = 0; hop < 3; hop++) {
      response = await fetcher(url.href, { headers: { Accept: "image/jpeg,image/png,image/webp" }, redirect: "manual", signal });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("Location");
      await response.body?.cancel();
      response = null;
      if (!location) break;
      url = approvedImageUrl(new URL(location, url).href);
    }
    if (!response?.ok || !response.body) {
      await response?.body?.cancel();
      throw new VideoJobError(502, "product_image_unavailable", "Não foi possível carregar a foto do produto agora. Tente novamente; não é necessário baixar e reenviar a imagem.");
    }
    if (Number(response.headers.get("Content-Length")) > maxBytes) {
      await response.body.cancel();
      throw new VideoJobError(422, "product_image_too_large", "A imagem sincronizada excede o limite de 10 MB.");
    }
    const reader = response.body.getReader();
    const parts: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > maxBytes) throw new VideoJobError(422, "product_image_too_large", "A imagem sincronizada excede o limite de 10 MB.");
        parts.push(value);
      }
    } finally { await reader.cancel(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    const type = imageType(bytes);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
    const path = `${userId}/inputs/product-${productId}-${hash}.${type.extension}`;
    const cached = await dependencies.existing(path);
    if (!cached) {
      try { await dependencies.upload(path, bytes, type.mime); }
      catch {
        // A concurrent import may have stored the same content. Never overwrite an input.
        const concurrent = await dependencies.existing(path);
        if (!concurrent || await digest(concurrent) !== hash) throw new VideoJobError(503, "product_image_storage_unavailable", "Não foi possível salvar a foto privada do produto. Tente novamente.");
      }
    } else if (await digest(cached) !== hash) {
      throw new VideoJobError(503, "product_image_storage_invalid", "Não foi possível validar a foto privada do produto.");
    }
    return { path };
  } catch (error) {
    if (error instanceof VideoJobError) throw error;
    throw new VideoJobError(502, "product_image_unavailable", "Não foi possível preparar a foto sincronizada agora. Tente novamente.");
  }
}

async function digest(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))), b => b.toString(16).padStart(2, "0")).join("");
}
