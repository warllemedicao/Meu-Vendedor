export interface GalleryProduct { platform: string; shopId: string; itemId: string; title: string; imageUrl: string | null }
export class GalleryError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export function approvedPhoto(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  // Shopee's gallery sometimes contains image IDs rather than full URLs.
  if (/^(?:[a-z]{2}-)?[a-z0-9][a-z0-9-]{15,150}$/i.test(value)) value = `https://cf.shopee.com.br/file/${value}`;
  try {
    const url = new URL(value as string);
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") return null;
    if (!(url.hostname === "cf.shopee.com.br" || url.hostname === "cf.shopee.com" || /^[a-z0-9-]+\.img\.susercontent\.com$/.test(url.hostname))) return null;
    if (!url.pathname.startsWith("/file/")) return null;
    url.hash = ""; url.search = ""; url.pathname = url.pathname.replace(/_tn$/, "");
    return url.href;
  } catch { return null; }
}
function parseJson(text: string): unknown {
  return JSON.parse(text.replace(/"(itemid|itemId|shopid|shopId)"\s*:\s*(\d+)/g, '"$1":"$2"'));
}
function normalizeTitle(s: string) { return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

/** Parse only the requested product's structured gallery, never unrelated <img> or recommendation cards. */
export function listingPhotos(html: string, product: GalleryProduct): string[] {
  const found = new Set<string>(); let visited = 0;
  const add = (v: unknown) => {
    if (Array.isArray(v)) { v.slice(0, 20).forEach(add); return; }
    if (v && typeof v === "object") { add((v as Record<string, unknown>).url ?? (v as Record<string, unknown>).contentUrl); return; }
    const url = approvedPhoto(v); if (url && found.size < 12) found.add(url);
  };
  function walk(value: unknown, depth = 0) {
    if (depth > 14 || ++visited > 10000 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.slice(0, 100).forEach(v => walk(v, depth + 1)); return; }
    const obj = value as Record<string, unknown>;
    const exactItem = String(obj.itemid ?? obj.itemId ?? "") === product.itemId && String(obj.shopid ?? obj.shopId ?? "") === product.shopId;
    const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
    // A matching title or explicit canonical identity is required for JSON-LD Product nodes.
    const canonical = typeof obj.url === "string" ? obj.url : typeof obj["@id"] === "string" ? obj["@id"] : "";
    let exactUrl = false;
    try { const url = new URL(canonical); exactUrl = url.hostname === "shopee.com.br" && (url.pathname === `/product/${product.shopId}/${product.itemId}` || url.pathname.endsWith(`-i.${product.shopId}.${product.itemId}`)); } catch { /* Missing canonical URL. */ }
    const exactTitle = typeof obj.name === "string" && normalizeTitle(obj.name) === normalizeTitle(product.title);
    const declaredIdentity = obj.itemid !== undefined || obj.itemId !== undefined || obj.shopid !== undefined || obj.shopId !== undefined;
    if (exactItem || types.includes("Product") && (exactUrl || !canonical && !declaredIdentity && exactTitle)) {
      add(obj.images); add(obj.image); add(obj.image_urls); add(obj.imageUrls);
    }
    for (const [key, child] of Object.entries(obj)) {
      if (/recommend|related|suggest|similar|carousel|description|review|variation|model/i.test(key)) continue;
      walk(child, depth + 1);
    }
  }
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attributes = script[1]; const content = script[2].trim();
    if (/application\/ld\+json|application\/json|__NEXT_DATA__|__INITIAL_STATE__/i.test(attributes)) {
      try { walk(parseJson(content)); } catch { /* Unparseable scripts are not evaluated. */ }
    } else {
      const match = content.match(/^(?:window\.)?__(?:INITIAL_STATE|PRELOADED_STATE)__\s*=\s*([\s\S]*?);?\s*$/);
      if (match) try { walk(parseJson(match[1].replace(/;$/, ""))); } catch { /* Never eval page JavaScript. */ }
    }
  }
  return [...found];
}
async function bounded(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error("source_unavailable"); }
  if (Number(response.headers.get("content-length")) > limit) { await response.body.cancel(); throw new Error("source_too_large"); }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; total += value.length; if (total > limit) throw new Error("source_too_large"); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
}
export async function discoverPhotos(product: GalleryProduct, fetcher: typeof fetch = fetch): Promise<{ urls: string[]; source: "listing" | "cover"; warning?: string }> {
  if (product.platform !== "shopee" || !/^\d{1,20}$/.test(product.shopId) || !/^\d{1,20}$/.test(product.itemId)) throw new GalleryError(422, "unsupported_source", "A busca de fotos está disponível para anúncios Shopee do seu catálogo.");
  const cover = approvedPhoto(product.imageUrl);
  const fallback = { urls: cover ? [cover] : [], source: "cover" as const, warning: "Neste acesso ao anúncio, só conseguimos importar a foto principal. O anúncio pode ter outras fotos: abra-o na Shopee, salve as imagens desejadas e use Analisar fotos do dispositivo." };
  try {
    const response = await fetcher(`https://shopee.com.br/product/${product.shopId}/${product.itemId}`, { headers: { Accept: "text/html", "User-Agent": "MeuVendedor/1.0 product-gallery" }, redirect: "manual", signal: AbortSignal.timeout(12000) });
    const html = new TextDecoder().decode(await bounded(response, 3 * 1024 * 1024));
    const urls = listingPhotos(html, product);
    return urls.length ? { urls, source: "listing" } : fallback;
  } catch { return fallback; }
}
export async function readPhoto(url: string, fetcher: typeof fetch = fetch) {
  let current = approvedPhoto(url); if (!current) throw new Error("invalid_photo_source");
  const signal = AbortSignal.timeout(12000);
  for (let hop = 0; hop < 3; hop++) {
    const response: Response = await fetcher(current, { redirect: "manual", signal, headers: { Accept: "image/jpeg,image/png,image/webp" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location: string | null = response.headers.get("Location"); await response.body?.cancel();
      current = location ? approvedPhoto(new URL(location, current).href) : null;
      if (!current) throw new Error("invalid_photo_redirect"); continue;
    }
    const bytes = await bounded(response, 5 * 1024 * 1024); const ascii = new TextDecoder("ascii");
    const type = bytes.length >= 16 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? { mime: "image/jpeg", ext: "jpg" }
      : bytes.length >= 16 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) ? { mime: "image/png", ext: "png" }
      : bytes.length >= 16 && ascii.decode(bytes.slice(0,4)) === "RIFF" && ascii.decode(bytes.slice(8,12)) === "WEBP" ? { mime: "image/webp", ext: "webp" } : null;
    if (!type) throw new Error("invalid_photo_content");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))), v => v.toString(16).padStart(2, "0")).join("");
    return { bytes, ...type, hash };
  }
  throw new Error("too_many_redirects");
}
