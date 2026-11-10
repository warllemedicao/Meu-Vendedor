import { discoverPhotos, GalleryError, readPhoto, type GalleryProduct } from "./gallery.ts";

export interface GalleryDependencies {
  authenticate(token: string): Promise<string | null>;
  findProduct(userId: string, productId: string): Promise<GalleryProduct | null>;
  store(path: string, bytes: Uint8Array, mime: string): Promise<void>;
  fetcher?: typeof fetch;
}
const allowedOrigins = new Set(["https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev", "http://localhost:3000", "http://localhost:4173"]);
export function createGalleryHandler(deps: GalleryDependencies) {
  const pending = new Map<string, Promise<unknown>>(); const recent = new Map<string, number>();
  return async (req: Request) => {
    const origin = req.headers.get("origin");
    const headers = { "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store", Vary: "Origin" };
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
    if (origin && !allowedOrigins.has(origin)) return json({ error: "origin_not_allowed", message: "Origem não autorizada." }, 403);
    if (req.method === "OPTIONS") return new Response(null, { headers });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    try {
      const token = req.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
      const user = await deps.authenticate(token); if (!user) return json({ error: "unauthorized", message: "Entre na sua conta para buscar fotos do anúncio." }, 401);
      const text = await req.text(); if (text.length > 1024) return json({ error: "request_too_large" }, 413);
      let body; try { body = JSON.parse(text); } catch { return json({ error: "invalid_request" }, 400); }
      const id = body?.productId;
      if (typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return json({ error: "invalid_product", message: "Selecione um produto do seu catálogo." }, 400);
      const product = await deps.findProduct(user, id); if (!product) return json({ error: "product_not_found", message: "O produto não foi encontrado nesta conta." }, 404);
      const key = `${user}:${id}`;
      if (pending.has(key)) return json(await pending.get(key));
      const now = Date.now(); for (const [owner, time] of recent) if (now - time > 60000) recent.delete(owner);
      if (now - (recent.get(user) ?? 0) < 20000) return json({ error: "rate_limited", message: "Aguarde alguns segundos antes de buscar novas fotos." }, 429);
      recent.set(user, now);
      const task = (async () => {
        const gallery = await discoverPhotos(product, deps.fetcher); const photos: { path: string }[] = []; const hashes = new Set<string>();
        let bytesTotal = 0, failed = 0; const deadline = Date.now() + 35000;
        for (const url of gallery.urls.slice(0, 12)) {
          if (Date.now() > deadline) { failed += gallery.urls.length - photos.length; break; }
          try {
            const image = await readPhoto(url, deps.fetcher); if (hashes.has(image.hash)) continue;
            bytesTotal += image.bytes.length; if (bytesTotal > 40 * 1024 * 1024) { failed++; break; }
            const path = `${user}/inputs/gallery-${id}-${image.hash}.${image.ext}`;
            await deps.store(path, image.bytes, image.mime); hashes.add(image.hash); photos.push({ path });
          } catch { failed++; }
        }
        if (!photos.length) throw new GalleryError(422, "gallery_unavailable", "Não foi possível carregar fotos deste anúncio. Selecione as fotos salvas no seu dispositivo para analisar.");
        return { photos, source: gallery.source, productTitle: product.title, warning: gallery.warning, failed };
      })();
      pending.set(key, task);
      try { return json(await task); } finally { pending.delete(key); }
    } catch (error) {
      if (error instanceof GalleryError) return json({ error: error.code, message: error.message }, error.status);
      return json({ error: "gallery_unavailable", message: "Não foi possível buscar as fotos agora. Tente novamente ou selecione fotos do seu dispositivo." }, 503);
    }
  };
}
