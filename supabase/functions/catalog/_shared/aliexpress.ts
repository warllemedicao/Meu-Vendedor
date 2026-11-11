import { createHash } from "node:crypto";
import { https, integerString, invalidResponse, number, object, providerJson, required, text, IntegrationError } from "./common.ts";
import type { AccountConfig, CatalogProduct, CatalogQuery, CatalogResult } from "./types.ts";

/** TOP: parâmetros ordenados, segredo antes/depois, MD5 UTF-8 hexadecimal maiúsculo. */
export function aliSignature(params: Record<string, string>, secret: string): string {
  const joined = Object.keys(params).filter(k => k !== "sign").sort().map(k => k + params[k]).join("");
  return createHash("md5").update(secret + joined + secret, "utf8").digest("hex").toUpperCase();
}
export async function aliexpressProducts(config: AccountConfig, query: CatalogQuery, fetcher: typeof fetch = fetch): Promise<CatalogResult> {
  const appKey = required(config, "appKey"), secret = required(config, "appSecret"), trackingId = required(config, "trackingId");
  const params: Record<string, string> = {
    method: "aliexpress.affiliate.hotproduct.query", app_key: appKey, sign_method: "md5", format: "json", v: "2.0",
    timestamp: new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 19).replace("T", " "),
    page_no: "1", page_size: "20", target_currency: "BRL", target_language: "PT", ship_to_country: "BR", tracking_id: trackingId,
    sort: query.discountsOnly ? "DISCOUNT_DESC" : "LAST_VOLUME_DESC",
    ...(query.keywords ? { keywords: query.keywords } : {}),
  };
  params.sign = aliSignature(params, secret);
  const payload = await providerJson("https://eco.taobao.com/router/rest", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams(params).toString(),
  }, fetcher);
  if (payload.error_response) throw new IntegrationError("provider_rejected", "O AliExpress recusou a consulta. Confira as permissões da Affiliate API.", 422);
  const response = object(object(payload.aliexpress_affiliate_hotproduct_query_response).resp_result);
  if (String(response.resp_code) !== "200") throw new IntegrationError("provider_rejected", "O AliExpress não autorizou a consulta de produtos.", 422);
  const result = object(response.result), items = object(result.products).product;
  // O contrato de lista vazia pode omitir o container de produtos.
  const values = items === undefined && number(result.current_record_count) === 0 ? [] : items;
  if (!Array.isArray(values) || values.length > 20) invalidResponse();
  const fetchedAt = new Date().toISOString();
  const products: CatalogProduct[] = values.map(value => {
    const item = object(value), id = integerString(item.product_id), title = text(item.product_title), url = https(item.product_detail_url, ["aliexpress.com"]);
    if (!id || !title || !url) invalidResponse();
    return { id, platform: "aliexpress", title, productUrl: url, imageUrl: https(item.product_main_image_url, ["alicdn.com", "aliexpress-media.com"]),
      price: number(item.target_sale_price), currency: text(item.target_sale_price_currency, 3),
      discountPercent: number(typeof item.discount === "string" ? item.discount.replace(/%$/, "") : item.discount, 100),
      sales: integerString(item.lastest_volume), rank: null, shop: text(item.shop_name), updatedAt: fetchedAt };
  });
  return { platform: "aliexpress", products: query.discountsOnly ? products.filter(p => p.discountPercent !== null && p.discountPercent > 0) : products,
    scope: "Até 20 produtos em destaque da Affiliate API para entrega ao Brasil, ordenados por volume ou desconto informado.",
    warnings: ["Esta seleção não é o ranking global do AliExpress. Impostos, frete, cupons e preço final devem ser conferidos na loja."], fetchedAt };
}

/** Gera um link de afiliado somente pela API oficial; nunca fabrica parâmetros de rastreio. */
export async function aliexpressAffiliateLink(config: AccountConfig, productUrl: string, fetcher: typeof fetch = fetch): Promise<string> {
  const url = https(productUrl, ["aliexpress.com"]);
  if (!url) throw new IntegrationError("invalid_product_url", "Informe uma URL HTTPS válida de produto AliExpress.", 400);
  const appKey = required(config, "appKey"), secret = required(config, "appSecret"), trackingId = required(config, "trackingId");
  const params: Record<string, string> = {
    method: "aliexpress.affiliate.link.generate", app_key: appKey, sign_method: "md5", format: "json", v: "2.0",
    timestamp: new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 19).replace("T", " "),
    source_values: url, promotion_link_type: "0", tracking_id: trackingId,
  };
  params.sign = aliSignature(params, secret);
  const payload = await providerJson("https://eco.taobao.com/router/rest", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams(params).toString(),
  }, fetcher);
  if (payload.error_response) throw new IntegrationError("provider_rejected", "O AliExpress recusou a geração do link de afiliado.", 422);
  const response = object(object(payload.aliexpress_affiliate_link_generate_response).resp_result);
  if (String(response.resp_code) !== "200") throw new IntegrationError("provider_rejected", "A API não autorizou o link de afiliado.", 422);
  const links = object(object(response.result).promotion_links).promotion_link;
  if (!Array.isArray(links) || links.length !== 1) invalidResponse();
  const generated = https(object(links[0]).promotion_link, ["aliexpress.com", "s.click.aliexpress.com"]);
  if (!generated) invalidResponse();
  return generated;
}
