import { createHmac } from "node:crypto";
import { https, integerString, invalidResponse, number, object, providerJson, required, text, IntegrationError } from "./common.ts";
import type { AccountConfig, CatalogProduct, CatalogQuery, CatalogResult } from "./types.ts";

export const TIKTOK_PRODUCT_PATH = "/affiliate_creator/202405/open_collaborations/products/search";
export function tiktokSignature(path: string, params: Record<string, string>, body: string, secret: string): string {
  const joined = Object.keys(params).filter(k => k !== "sign" && k !== "access_token").sort().map(k => k + params[k]).join("");
  return createHmac("sha256", secret).update(secret + path + joined + body + secret, "utf8").digest("hex");
}
export async function tiktokProducts(config: AccountConfig, query: CatalogQuery, fetcher: typeof fetch = fetch): Promise<CatalogResult> {
  const appKey = required(config, "appKey"), secret = required(config, "appSecret"), token = required(config, "accessToken");
  const body = JSON.stringify(query.keywords ? { title_keywords: [query.keywords] } : {});
  const params: Record<string, string> = { app_key: appKey, timestamp: String(Math.floor(Date.now() / 1000)), page_size: "20", sort_field: "units_sold", sort_order: "DESC" };
  params.sign = tiktokSignature(TIKTOK_PRODUCT_PATH, params, body, secret);
  const payload = await providerJson(`https://open-api.tiktokglobalshop.com${TIKTOK_PRODUCT_PATH}?${new URLSearchParams(params)}`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-tts-access-token": token }, body,
  }, fetcher);
  if (payload.code !== 0) throw new IntegrationError("provider_rejected", "O TikTok Shop recusou a consulta. Verifique token de criador, escopo e mercado autorizado.", 422);
  const result = object(payload.data);
  if (!Array.isArray(result.products) || result.products.length > 20) invalidResponse();
  const fetchedAt = new Date().toISOString();
  const products: CatalogProduct[] = result.products.map(value => {
    const item = object(value), id = integerString(item.id), title = text(item.title), url = https(item.detail_link, ["tiktok.com"]);
    if (!id || !title || !url) invalidResponse();
    const price = object(item.sales_price), original = object(item.original_price);
    const minimum = number(price.minimum_amount), maximum = number(price.maximum_amount);
    const originalMinimum = number(original.minimum_amount), originalMaximum = number(original.maximum_amount);
    const comparable = minimum !== null && minimum === maximum && originalMinimum !== null && originalMinimum === originalMaximum
      && originalMinimum > minimum && originalMinimum > 0 && typeof price.currency === "string" && price.currency === original.currency;
    return { id, platform: "tiktok", title, productUrl: url,
      imageUrl: https(item.main_image_url, ["tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "ibyteimg.com"]),
      price: number(price.minimum_amount), currency: text(price.currency, 3),
      // Comparar somente preços únicos na mesma moeda; extremos de faixas podem ser variantes diferentes.
      discountPercent: comparable ? Math.round((1 - minimum / originalMinimum) * 10000) / 100 : null,
      sales: integerString(item.units_sold), rank: null, shop: text(object(item.shop).name), updatedAt: fetchedAt };
  });
  return { platform: "tiktok", products: query.discountsOnly ? products.filter(p => p.discountPercent !== null && p.discountPercent > 0) : products,
    scope: "Até 20 produtos de colaboração aberta elegíveis para o criador, ordenados por unidades vendidas informadas.",
    warnings: ["Disponibilidade depende da região de afiliação e do escopo creator.affiliate_collaboration.read; não é um ranking global.", "Desconto calculado apenas quando os preços original e promocional são únicos e comparáveis na mesma moeda; faixas de variantes não são comparadas."], fetchedAt };
}
