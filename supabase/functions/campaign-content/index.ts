import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { importSyncedProductImage } from "../video-generation/_shared/product-image.ts";
import { VideoJobError } from "../video-generation/_shared/service.ts";
import { IntegrationError } from "../marketplace/_shared/shopee.ts";
import { readLimitedObject } from "../marketplace/_shared/http.ts";
import { analyzeCampaignImage } from "./_shared/content.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const storage = db.storage.from("mv-video-assets");
const app = "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev";
const busy = new Map<string, number>();
Deno.serve(async request => {
  const origin = request.headers.get("origin");
  const headers = { "Access-Control-Allow-Origin": origin === "http://localhost:3000" ? origin : app, "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS", "Cache-Control": "no-store", Vary: "Origin" };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (origin && ![app, "http://localhost:3000"].includes(origin)) return reply({ error: { message: "Origem não permitida." } }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: { message: "Use POST." } }, 405);
  let owner: string | undefined; let locked = false;
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    const auth = token ? await db.auth.getUser(token) : null;
    const user = auth?.error ? null : auth?.data.user;
    if (!user) return reply({ error: { message: "Entre na conta para analisar a foto do produto." } }, 401);
    owner = user.id;
    if ((busy.get(owner) ?? 0) > Date.now()) return reply({ error: { message: "Aguarde a análise em andamento antes de enviar outra." } }, 429);
    busy.set(owner, Date.now() + 90000); locked = true;
    const body = await readLimitedObject(request, 12000);
    if (![15, 30].includes(Number(body.seconds)) || typeof body.notes !== "string" || body.notes.length > 1500) return reply({ error: { message: "Revise duração e detalhes do produto." } }, 400);
    let title = typeof body.title === "string" ? body.title.slice(0, 500) : "";
    let path = body.imagePath;
    const productId = body.productId;
    let product: { platform_id: string; image_url: string | null; title: string } | null = null;
    if (productId) {
      if (typeof productId !== "string" || !/^[a-f0-9-]{36}$/i.test(productId)) return reply({ error: { message: "Produto inválido." } }, 400);
      const result = await db.from("mv_products").select("platform_id,image_url,title").eq("id", productId).eq("user_id", owner).maybeSingle();
      product = result.data;
      if (result.error || !product) return reply({ error: { message: "Produto não encontrado nesta conta." } }, 404);
      title = product.title;
    }
    if (!title.trim()) return reply({ error: { message: "Selecione o produto para analisar." } }, 400);
    if (!path && product && typeof productId === "string") {
      const imported = await importSyncedProductImage(owner, productId, {
        findProduct: async () => ({ platformId: product!.platform_id, imageUrl: product!.image_url }),
        existing: async path => { const { data } = await storage.download(path); return data && data.size <= 10 * 1024 * 1024 ? new Uint8Array(await data.arrayBuffer()) : null; },
        upload: async (path, bytes, mime) => { const { error } = await storage.upload(path, bytes, { contentType: mime, upsert: false }); if (error) throw error; },
      }); path = imported.path;
    }
    if (typeof path !== "string" || !new RegExp(`^${owner}/inputs/[A-Za-z0-9._-]+\\.(jpg|jpeg|png|webp)$`).test(path)) return reply({ error: { message: "Envie a foto do produto para a área privada da sua conta." } }, 400);
    const { data: image, error } = await storage.download(path);
    if (error || !image || image.size > 10 * 1024 * 1024 || image.size < 16) return reply({ error: { message: "Não foi possível carregar a foto privada do produto." } }, 422);
    const bytes = new Uint8Array(await image.arrayBuffer());
    const mime = bytes[0] === 255 && bytes[1] === 216 ? "image/jpeg" : [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b) ? "image/png" : new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP" ? "image/webp" : null;
    if (!mime) return reply({ error: { message: "Use uma foto JPEG, PNG ou WebP válida." } }, 422);
    for (const [id, until] of busy) if (until < Date.now()) busy.delete(id);
    const content = await analyzeCampaignImage({ title, notes: body.notes, seconds: Number(body.seconds), bytes, mime }, { gemini: Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY"), openrouter: Deno.env.get("OPENROUTER_API_KEY"), groq: Deno.env.get("GROQ_API_KEY") });
    return reply({ ...content, imagePath: path });
  } catch (error) {
    if (error instanceof VideoJobError || error instanceof IntegrationError) return reply({ error: { message: error.message } }, error.status);
    return reply({ error: { message: "Não foi possível analisar a foto agora. Tente novamente ou revise o roteiro manualmente." } }, 503);
  } finally { if (locked && owner) busy.delete(owner); }
});
