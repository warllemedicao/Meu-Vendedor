// Contrato consultado no Explorer oficial brasileiro em 04/11/2026.
export const SHOPEE_ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";
export interface ShopeeCredentials { appId: string; secret: string; }
export interface SyncedProduct {
  external_id: string; shop_id: string; item_id: string; title: string; shop_name: string | null;
  image_url: string | null; product_url: string; price_min: number | null; price_max: number | null;
  commission_rate: number | null; commission_estimate: number | null; sales: string | null;
  rating: number | null; discount_percent: number | null; offer_ends_at: string | null;
}
export class IntegrationError extends Error {
  code: string; status: number;
  constructor(code: string, message: string, status = 502) { super(message); this.code = code; this.status = status; }
}
export function validateCredentials(value: unknown): ShopeeCredentials {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v.appId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(v.appId.trim()) || typeof v.secret !== "string" || v.secret.trim().length < 4 || v.secret.length > 512 || /[\r\n]/.test(v.secret)) {
    throw new IntegrationError("invalid_credentials_input", "Informe o App ID e o Secret emitidos pela Open API Shopee. Não use a senha da conta.", 400);
  }
  return { appId: v.appId.trim(), secret: v.secret.trim() };
}
export function safeHttps(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function shopeeUrl(value: unknown): string | null {
  const safe = safeHttps(value); if (!safe) return null;
  const host = new URL(safe).hostname.toLowerCase();
  return ["shopee.com.br", "shope.ee", "shp.ee"].some(domain => host === domain || host.endsWith(`.${domain}`)) ? safe : null;
}
function numeric(value: unknown, max = 1e12): number | null {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return null;
  const n = Number(value); return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
export function normalizeProduct(value: unknown): SyncedProduct {
  if (!value || typeof value !== "object") throw new IntegrationError("invalid_response", "A Shopee retornou um produto inválido.");
  const p = value as Record<string, unknown>;
  const item = String(p.itemId ?? ""); const shop = String(p.shopId ?? "");
  const url = shopeeUrl(p.productLink);
  if (!/^\d{1,20}$/.test(item) || !/^\d{1,20}$/.test(shop) || !url || typeof p.productName !== "string" || !p.productName.trim() || p.productName.length > 500) throw new IntegrationError("invalid_response", "A Shopee retornou dados de produto incompletos.");
  const ends = numeric(p.periodEndTime, 253402300799);
  const sales = String(p.sales ?? "");
  return {
    external_id: `${shop}:${item}`, shop_id: shop, item_id: item, title: p.productName.trim(),
    shop_name: typeof p.shopName === "string" ? p.shopName.slice(0,500) : null,
    image_url: safeHttps(p.imageUrl), product_url: url,
    price_min: numeric(p.priceMin ?? p.price), price_max: numeric(p.priceMax ?? p.price),
    commission_rate: numeric(p.commissionRate, 1), commission_estimate: numeric(p.commission),
    sales: /^\d{1,18}$/.test(sales) ? sales : null,
    rating: numeric(p.ratingStar, 5), discount_percent: numeric(p.priceDiscountRate, 100),
    offer_ends_at: ends && ends > 0 ? new Date(ends * 1000).toISOString() : null,
  };
}
export async function signedBody(credentials: ShopeeCredentials, query: string, variables: Record<string, unknown>, timestamp = Math.floor(Date.now()/1000)) {
  const body = JSON.stringify({ query, variables });
  const factor = `${credentials.appId}${timestamp}${body}${credentials.secret}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(factor));
  const signature = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join("");
  return { body, authorization: `SHA256 Credential=${credentials.appId}, Timestamp=${timestamp}, Signature=${signature}` };
}
export async function shopeeRequest(credentials: ShopeeCredentials, query: string, variables: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<Record<string, unknown>> {
  const signed = await signedBody(credentials, query, variables);
  let response: Response;
  try { response = await fetcher(SHOPEE_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: signed.authorization }, body: signed.body, signal: AbortSignal.timeout(20000), redirect: "error" }); }
  catch { throw new IntegrationError("provider_unavailable", "Não foi possível consultar a Shopee. Tente novamente mais tarde.", 503); }
  if (response.status === 429) throw new IntegrationError("rate_limited", "A Shopee limitou as consultas. Aguarde antes de tentar novamente.", 429);
  if (response.status >= 500) throw new IntegrationError("provider_unavailable", "A Shopee está temporariamente indisponível. Tente novamente mais tarde.", 503);
  if (!response.ok) throw new IntegrationError("provider_rejected", "A Shopee recusou a consulta. Verifique suas credenciais e a liberação da API.", 422);
  let payload: { data?: Record<string, unknown>; errors?: unknown[] };
  try {
    const text = await response.text();
    if (text.length > 4_000_000) throw new Error();
    // Identificadores Int64 não podem perder precisão ao passar pelo JSON do JavaScript.
    payload = JSON.parse(text.replace(/"(itemId|shopId|sales)"\s*:\s*(\d+)/g, '"$1":"$2"'));
  } catch { throw new IntegrationError("invalid_response", "A Shopee retornou uma resposta inválida."); }
  if (payload.errors?.some(error => typeof error === "object" && error !== null && (error as { extensions?: { code?: number } }).extensions?.code === 10000)) throw new IntegrationError("provider_system_error", "A Shopee está com uma falha interna nesta consulta. As demais ofertas continuam disponíveis.", 503);
  if (payload.errors?.length || !payload.data) throw new IntegrationError("provider_rejected", "A Shopee não autorizou a operação ou os dados solicitados. Confira o acesso à Open API.", 422);
  return payload.data;
}
export const PRODUCT_QUERY = `query Offers($page:Int,$limit:Int){productOfferV2(listType:2,sortType:2,page:$page,limit:$limit){nodes{itemId shopId productName shopName productLink imageUrl price priceMin priceMax commissionRate commission sales ratingStar priceDiscountRate periodEndTime}pageInfo{hasNextPage}}}`;
export async function fetchShopeeProducts(credentials: ShopeeCredentials, fetcher: typeof fetch = fetch): Promise<SyncedProduct[]> {
  const products = new Map<string,SyncedProduct>();
  for (let page = 1; page <= 3; page++) {
    const data = await shopeeRequest(credentials, PRODUCT_QUERY, {page,limit:20}, fetcher);
    const connection = data.productOfferV2 as {nodes?: unknown[]; pageInfo?: {hasNextPage?: boolean}} | undefined;
    if (!connection || !Array.isArray(connection.nodes) || connection.nodes.length > 20 || typeof connection.pageInfo?.hasNextPage !== "boolean") throw new IntegrationError("invalid_response", "A lista de ofertas recebida é inválida.");
    for (const row of connection.nodes) {const product = normalizeProduct(row); products.set(product.external_id,product);}
    if (!connection.pageInfo?.hasNextPage) break;
  }
  return [...products.values()];
}
export async function generateShopeeLink(credentials: ShopeeCredentials, productUrl: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (!shopeeUrl(productUrl)) throw new IntegrationError("invalid_product_url", "O endereço deste produto não é válido para a Shopee.",400);
  const query = `mutation AffiliateLink($input:ShortLinkInput!){generateShortLink(input:$input){shortLink}}`;
  const data = await shopeeRequest(credentials, query, {input:{originUrl:productUrl}}, fetcher);
  const link = shopeeUrl((data.generateShortLink as {shortLink?: unknown} | undefined)?.shortLink);
  if (!link) throw new IntegrationError("invalid_response", "A Shopee não retornou um link válido.");
  return link;
}

export interface ShopeeBrowseQuery { page: number; keyword: string; sort: "sales" | "price" | "commission"; }
export function validateBrowseQuery(body: Record<string, unknown>): ShopeeBrowseQuery {
  const page = body.page ?? 1;
  const keyword = body.keyword ?? "";
  const sort = body.sort ?? "sales";
  if (!Number.isSafeInteger(page) || Number(page) < 1 || Number(page) > 2147483647 || typeof keyword !== "string" || keyword.length > 120 || !["sales", "price", "commission"].includes(String(sort))) {
    throw new IntegrationError("invalid_query", "Informe uma busca de até 120 caracteres e uma página válida.", 400);
  }
  return { page: Number(page), keyword: keyword.trim(), sort: sort as ShopeeBrowseQuery["sort"] };
}
// Sem listType:2: a busca não fica restrita à seleção Top Performing.
export const BROWSE_QUERY = `query Browse($page:Int,$limit:Int,$keyword:String,$sortType:Int){productOfferV2(keyword:$keyword,sortType:$sortType,page:$page,limit:$limit){nodes{itemId shopId productName shopName productLink imageUrl price priceMin priceMax commissionRate commission sales ratingStar priceDiscountRate periodEndTime}pageInfo{hasNextPage}}}`;
export async function fetchShopeePage(credentials: ShopeeCredentials, query: ShopeeBrowseQuery, fetcher: typeof fetch = fetch) {
  const checked = validateBrowseQuery({ ...query });
  const variables = { page: checked.page, limit: 20, keyword: checked.keyword, sortType: checked.sort === "price" ? 4 : checked.sort === "commission" ? 5 : 2 };
  let data: Record<string, unknown>; let searchFallback = false;
  try { data = await shopeeRequest(credentials, BROWSE_QUERY, variables, fetcher); }
  catch (error) {
    if (!checked.keyword || !(error instanceof IntegrationError) || error.code !== "provider_system_error") throw error;
    data = await shopeeRequest(credentials, BROWSE_QUERY, { ...variables, keyword: "" }, fetcher); searchFallback = true;
  }
  const connection = data.productOfferV2 as { nodes?: unknown[]; pageInfo?: { hasNextPage?: boolean } } | undefined;
  if (!connection || !Array.isArray(connection.nodes) || connection.nodes.length > 20 || typeof connection.pageInfo?.hasNextPage !== "boolean") throw new IntegrationError("invalid_response", "A lista de ofertas recebida é inválida.");
  const products = [...new Map(connection.nodes.map(row => { const product = normalizeProduct(row); return [product.external_id, product] as const; })).values()];
  return { products, page: checked.page, hasNextPage: connection.pageInfo.hasNextPage, searchFallback };
}
