import { https, invalidResponse, number, object, providerJson, required, text, IntegrationError } from "./common.ts";
import type { AccountConfig, CatalogProduct, CatalogQuery, CatalogResult } from "./types.ts";

// Creators API 3.1 / Brasil. Não usar a antiga assinatura PA-API como substituta.
export async function amazonProducts(config: AccountConfig, query: CatalogQuery, fetcher: typeof fetch = fetch): Promise<CatalogResult> {
  const clientId = required(config, "clientId"), clientSecret = required(config, "clientSecret"), partnerTag = required(config, "partnerTag");
  const token = await providerJson("https://api.amazon.com/auth/o2/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope: "creatorsapi::default" }),
  }, fetcher);
  if (typeof token.access_token !== "string" || !token.access_token || /[\r\n]/.test(token.access_token)) invalidResponse();
  const keywords = query.keywords || text(config.keywords, 120) || "casa";
  const payload = await providerJson("https://creatorsapi.amazon/catalog/v1/searchItems", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.access_token}`, "x-marketplace": "www.amazon.com.br" },
    body: JSON.stringify({ marketplace: "www.amazon.com.br", partnerTag, keywords, itemCount: 10,
      ...(query.discountsOnly ? { minSavingPercent: 1 } : {}),
      resources: ["images.primary.medium", "itemInfo.title", "offersV2.listings.price", "offersV2.listings.merchantInfo"],
    }),
  }, fetcher);
  // Erros de recurso/permissão não viram um catálogo vazio aparentemente bem-sucedido.
  if (Array.isArray(payload.errors) && payload.errors.length) throw new IntegrationError("provider_rejected", "A Amazon recusou um ou mais recursos da consulta. Confira o acesso à Creators API.", 422);
  const result = object(payload.searchResult);
  if (!Array.isArray(result.items) || result.items.length > 10) invalidResponse();
  const fetchedAt = new Date().toISOString();
  const products: CatalogProduct[] = result.items.map(value => {
    const item = object(value), info = object(item.itemInfo), offers = object(item.offersV2);
    const listing = object(Array.isArray(offers.listings) ? offers.listings[0] : null), price = object(listing.price), money = object(price.money);
    const url = https(item.detailPageURL, ["amazon.com.br"]), title = text(object(info.title).displayValue), id = text(item.asin, 20);
    if (!url || !title || !id || !/^[A-Z0-9]{10}$/.test(id)) invalidResponse();
    return { id, platform: "amazon", title, productUrl: url,
      imageUrl: https(object(object(object(item.images).primary).medium).url, ["media-amazon.com", "ssl-images-amazon.com"]),
      price: listing.violatesMAP === true ? null : number(money.amount), currency: text(money.currency, 3),
      discountPercent: listing.violatesMAP === true ? null : number(object(price.savings).percentage, 100),
      sales: null, rank: null, shop: text(object(listing.merchantInfo).name), updatedAt: fetchedAt,
    };
  });
  return { platform: "amazon", products: query.discountsOnly ? products.filter(p => p.discountPercent !== null && p.discountPercent > 0) : products,
    scope: `Busca Amazon por “${keywords}” — até 10 ofertas, sem ranking global de vendas.`,
    warnings: ["Preços e disponibilidade são os informados no momento da consulta e podem mudar. As condições finais são confirmadas na Amazon.", "Conteúdo consultado sob demanda; sem cache persistente de preços ou imagens no Meu Vendedor."], fetchedAt };
}
