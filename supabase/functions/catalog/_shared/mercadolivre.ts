import { https, integerString, invalidResponse, number, object, providerJson, required, text, IntegrationError } from "./common.ts";
import type { AccountConfig, CatalogProduct, CatalogQuery, CatalogResult } from "./types.ts";

export async function mercadoLivreProducts(config: AccountConfig, query: CatalogQuery, fetcher: typeof fetch = fetch): Promise<CatalogResult> {
  const token = required(config, "accessToken"), categoryId = query.categoryId || required(config, "categoryId");
  if (!/^MLB\d{1,12}$/.test(categoryId)) throw new IntegrationError("invalid_category", "Configure uma categoria brasileira válida do Mercado Livre (MLB…).", 400);
  const get = (path: string) => providerJson(`https://api.mercadolibre.com${path}`, { headers: { Authorization: `Bearer ${token}` } }, fetcher);
  const payload = await get(`/highlights/MLB/category/${categoryId}`);
  if (!Array.isArray(payload.content) || payload.content.length > 20) invalidResponse();
  const fetchedAt = new Date().toISOString(), products: CatalogProduct[] = [];
  let unavailable = 0;
  // Concurrency limitada, preservando a posição original mesmo quando um detalhe não é autorizado.
  for (let start = 0; start < payload.content.length; start += 4) {
    const batch = payload.content.slice(start, start + 4);
    const details = await Promise.allSettled(batch.map(async value => {
      const row = object(value), id = text(row.id, 30), type = row.type;
      if (!id || !/^MLBU?\d{1,20}$/.test(id) || !["ITEM", "PRODUCT", "USER_PRODUCT"].includes(String(type))) invalidResponse();
      const path = type === "PRODUCT" ? `/products/${id}` : type === "USER_PRODUCT" ? `/user-products/${id}` : `/items/${id}`;
      const item = await get(path), title = text(item.title) || text(item.name);
      if (!title) invalidResponse();
      const picture = object(Array.isArray(item.pictures) ? item.pictures[0] : null);
      const price = number(item.price), original = number(item.original_price);
      const currency = text(item.currency_id, 3);
      return { id, platform: "mercadolivre", title,
        productUrl: https(item.permalink, ["mercadolivre.com.br", "mercadolibre.com.br"]),
        imageUrl: https(picture.secure_url ?? picture.url ?? item.secure_thumbnail, ["mlstatic.com"]),
        price, currency, discountPercent: price !== null && original !== null && original > price && original > 0 && currency ? Math.round((1 - price / original) * 10000) / 100 : null,
        sales: integerString(item.sold_quantity), rank: number(row.position, 20), shop: null, updatedAt: fetchedAt,
      } satisfies CatalogProduct;
    }));
    for (const detail of details) {
      if (detail.status === "fulfilled") products.push(detail.value);
      else {
        const error = detail.reason;
        if (error instanceof IntegrationError && error.code === "rate_limited") throw error;
        unavailable++;
      }
    }
  }
  if (payload.content.length && !products.length) throw new IntegrationError("details_unavailable", "O ranking foi recebido, mas o Mercado Livre não liberou os detalhes dos produtos para este acesso.", 422);
  return { platform: "mercadolivre", products: query.discountsOnly ? products.filter(p => p.discountPercent !== null && p.discountPercent > 0) : products,
    scope: `Mais vendidos na categoria ${categoryId} — até 20 posições oficiais.`,
    warnings: ["O ranking é por categoria. Descontos só são exibidos quando os detalhes fornecem preço atual e preço de referência; não é um feed de todas as promoções.", ...(unavailable ? [`${unavailable} detalhes não puderam ser consultados; as posições originais foram preservadas.`] : [])], fetchedAt };
}
