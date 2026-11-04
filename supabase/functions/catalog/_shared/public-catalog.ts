import { amazonProducts } from "./amazon.ts";
import { tiktokProducts } from "./tiktok.ts";
import { IntegrationError, object, required } from "./common.ts";
import { fetchShopeeProducts } from "../../marketplace/_shared/shopee.ts";
import type { CatalogProduct, PublicCatalogResult, PublicPlatform } from "./types.ts";

export const publicPlatforms = ["shopee", "amazon", "tiktok"] as const;
interface Dependencies { configuration: () => string | undefined; fetcher?: typeof fetch; now?: () => number; }

/** Somente acessos do aplicativo, configurados expressamente para a vitrine pública.
 * Nunca consultar MV_CATALOG_ACCOUNTS, credenciais cifradas ou produtos privados de usuários aqui.
 */
export function createPublicCatalogHandler(deps: Dependencies) {
  const now = deps.now ?? Date.now;
  const entries = new Map<PublicPlatform, { result?: PublicCatalogResult; expires: number; retryAt: number; pending?: Promise<PublicCatalogResult> }>();
  let lastConfiguration: string | undefined;
  return async (request: Request): Promise<Response> => {
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Cache-Control": "no-store" };
    const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") return reply({ error: { code: "method_not_allowed", message: "Use GET para consultar a vitrine." } }, 405);
    try {
      const platform = new URL(request.url).searchParams.get("platform") as PublicPlatform;
      if (!publicPlatforms.includes(platform)) throw new IntegrationError("invalid_platform", "Escolha Shopee, Amazon ou TikTok Shop.", 400);
      const raw = deps.configuration();
      if (raw !== lastConfiguration) { entries.clear(); lastConfiguration = raw; }
      let config: Record<string, unknown>;
      try { config = object(object(raw ? JSON.parse(raw) : null)[platform]); }
      catch { throw new IntegrationError("catalog_unavailable", "O catálogo desta loja está temporariamente indisponível.", 503); }
      const fields = platform === "shopee" ? ["appId", "secret"] : platform === "amazon" ? ["clientId", "clientSecret", "partnerTag"] : ["appKey", "appSecret", "accessToken"];
      try { for (const field of fields) required(config, field); }
      catch { throw new IntegrationError("catalog_not_configured", "Os produtos desta loja ainda não estão disponíveis na vitrine. Nenhuma conexão de conta é necessária para navegar.", 503); }
      let entry = entries.get(platform);
      if (entry?.result && entry.expires > now()) return reply(entry.result);
      if (entry && !entry.pending && entry.retryAt > now()) throw new IntegrationError("rate_limited", "A atualização desta loja está em espera. Tente novamente em alguns instantes.", 429);
      if (!entry?.pending) {
        entry = { expires: 0, retryAt: 0 };
        entries.set(platform, entry);
        const current = entry;
        current.pending = (async () => {
          let result: PublicCatalogResult;
          if (platform === "shopee") {
            const rows = await fetchShopeeProducts({ appId: required(config, "appId"), secret: required(config, "secret") }, deps.fetcher);
            const fetchedAt = new Date(now()).toISOString();
            const products: CatalogProduct[] = rows.map(product => ({
              id: product.external_id, platform: "shopee", title: product.title, imageUrl: product.image_url,
              productUrl: product.product_url, price: product.price_min, currency: "BRL", discountPercent: product.discount_percent,
              sales: product.sales, rank: null, shop: product.shop_name, updatedAt: fetchedAt,
            }));
            result = { platform, products, fetchedAt, scope: "Até 60 ofertas disponíveis na fonte Shopee do Meu Vendedor, ordenadas pelas vendas informadas.", warnings: ["Esta seleção não é o ranking global da Shopee. Preço e disponibilidade são confirmados na loja."] };
          } else {
            const query = { keywords: "", categoryId: "", discountsOnly: false };
            result = { ...await (platform === "amazon" ? amazonProducts(config, query, deps.fetcher) : tiktokProducts(config, query, deps.fetcher)), platform };
          }
          // A vitrine não produz links pessoais nem atribui vendas ao usuário que está navegando.
          result.products = result.products.map(product => {
            if (product.platform === "amazon") return { ...product, productUrl: `https://www.amazon.com.br/dp/${product.id}` };
            if (!product.productUrl) return product;
            const url = new URL(product.productUrl);
            const region = url.searchParams.get("region"), local = url.searchParams.get("local");
            url.search = ""; url.hash = "";
            if (product.platform === "tiktok") {
              if (region && /^[A-Z]{2}$/.test(region)) url.searchParams.set("region", region);
              if (local && /^[a-zA-Z_-]{2,10}$/.test(local)) url.searchParams.set("local", local);
            }
            return { ...product, productUrl: url.href };
          });
          current.result = result; current.expires = now() + 10 * 60_000; current.retryAt = 0;
          return result;
        })().catch(error => { current.result = undefined; current.retryAt = now() + 30_000; throw error; }).finally(() => { current.pending = undefined; });
      }
      return reply(await entry.pending);
    } catch (error) {
      if (error instanceof IntegrationError) return reply({ error: { code: error.code, message: error.message } }, error.status);
      return reply({ error: { code: "catalog_unavailable", message: "Não foi possível atualizar os produtos desta loja." } }, 503);
    }
  };
}
