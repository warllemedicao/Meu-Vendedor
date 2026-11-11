import { amazonProducts } from "./amazon.ts";
import { aliexpressProducts, aliexpressAffiliateLink } from "./aliexpress.ts";
import { mercadoLivreProducts } from "./mercadolivre.ts";
import { tiktokProducts } from "./tiktok.ts";
import { IntegrationError, object, queryInput, required } from "./common.ts";
import { catalogPlatforms } from "./types.ts";
import type { AccountConfig, CatalogPlatform, CatalogSourceStatus, ImplementedPlatform } from "./types.ts";
import { readLimitedObject } from "../../marketplace/_shared/http.ts";

const adapters = { amazon: amazonProducts, mercadolivre: mercadoLivreProducts, tiktok: tiktokProducts, aliexpress: aliexpressProducts };
const fields: Record<ImplementedPlatform, string[]> = {
  amazon: ["clientId", "clientSecret", "partnerTag"], mercadolivre: ["accessToken", "categoryId"],
  tiktok: ["appKey", "appSecret", "accessToken"], aliexpress: ["appKey", "appSecret", "trackingId"],
};
function implemented(platform: CatalogPlatform): platform is ImplementedPlatform { return Object.hasOwn(adapters, platform); }

/** Um mapa secreto por ID autenticado; nunca selecionar credenciais por userId enviado no corpo. */
export function accountConfigurations(raw: string | undefined, userId: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const accounts = object(JSON.parse(raw));
    return Object.hasOwn(accounts, userId) ? object(accounts[userId]) : {};
  } catch { throw new IntegrationError("configuration_error", "A configuração de catálogos do servidor precisa ser revisada.", 503); }
}
export function sourceStatuses(configs: Record<string, unknown>): CatalogSourceStatus[] {
  return catalogPlatforms.map(platform => {
    if (!implemented(platform)) return { platform, implemented: false, configured: false, message: "Contrato de catálogo para afiliados ainda não confirmado. A API de vendedor não foi habilitada como substituta." };
    let configured = true;
    try { for (const field of fields[platform]) required(object(configs[platform]), field); } catch { configured = false; }
    return { platform, implemented: true, configured, message: configured ? "Credenciais configuradas; a consulta real confirmará acesso e permissões." : "Consulta implementada. Falta configurar as credenciais autorizadas para sua conta no servidor." };
  });
}

export interface CatalogDependencies {
  authenticate: (token: string) => Promise<string | null>;
  accounts: () => string | undefined;
  fetcher?: typeof fetch;
  now?: () => number;
}
export function createCatalogHandler(deps: CatalogDependencies) {
  const appUrl = "https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev";
  const origins = new Set([appUrl, "http://localhost:3000"]);
  const slots = new Map<string, { until: number; busy: boolean }>();
  const now = deps.now ?? Date.now;
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("Origin");
    const headers = { "Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : appUrl,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store" };
    const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });
    if (origin && !origins.has(origin)) return reply({ error: { code: "origin_denied", message: "Origem não permitida." } }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply({ error: { code: "method_not_allowed", message: "Use POST." } }, 405);
    try {
      const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) throw new IntegrationError("unauthorized", "Entre na sua conta do Meu Vendedor.", 401);
      let userId: string | null;
      try { userId = await deps.authenticate(token); } catch { userId = null; }
      if (!userId) throw new IntegrationError("unauthorized", "Sua sessão expirou. Entre novamente.", 401);
      const body = await readLimitedObject(request), configs = accountConfigurations(deps.accounts(), userId);
      if (body.action === "status") return reply({ sources: sourceStatuses(configs) });
      if (body.action === "affiliate_link") {
        const config = object(configs.aliexpress);
        for (const field of fields.aliexpress) required(config, field);
        if (typeof body.productUrl !== "string" || body.productUrl.length > 2048) throw new IntegrationError("invalid_product_url", "URL do produto inválida.", 400);
        const key = `${userId}:aliexpress`, current = slots.get(key);
        if (current && (current.busy || current.until > now())) throw new IntegrationError("operation_busy", "Aguarde antes de gerar outro link.", 429);
        slots.set(key, { until: now() + 5000, busy: true });
        try { return reply({ url: await aliexpressAffiliateLink(config, body.productUrl, deps.fetcher) }); }
        finally { slots.set(key, { until: now() + 5000, busy: false }); }
      }
      if (body.action !== "search") throw new IntegrationError("invalid_action", "Operação inválida.", 400);
      if (!catalogPlatforms.includes(body.platform as CatalogPlatform)) throw new IntegrationError("invalid_platform", "Plataforma inválida.", 400);
      const platform = body.platform as CatalogPlatform;
      if (!implemented(platform)) throw new IntegrationError("not_implemented", "Esta loja ainda não possui um contrato de catálogo para afiliados confirmado no Meu Vendedor.", 409);
      const query = queryInput(body), config: AccountConfig = object(configs[platform]);
      for (const field of fields[platform]) required(config, field);
      const key = `${userId}:${platform}`, current = slots.get(key);
      if (current && (current.busy || current.until > now())) throw new IntegrationError("operation_busy", "Aguarde alguns segundos antes de consultar esta plataforma novamente.", 429);
      for (const [id, slot] of slots) if (!slot.busy && slot.until <= now()) slots.delete(id);
      if (slots.size >= 1000 && !slots.has(key)) throw new IntegrationError("operation_busy", "Há muitas consultas em andamento. Tente novamente mais tarde.", 429);
      slots.set(key, { until: now() + 5000, busy: true });
      try {
        // Não persistir resultados: licenças e limites de cache variam por plataforma.
        return reply(await adapters[platform](config, query, deps.fetcher));
      } finally { slots.set(key, { until: now() + 5000, busy: false }); }
    } catch (error) {
      if (error instanceof IntegrationError) return reply({ error: { code: error.code, message: error.message } }, error.status);
      return reply({ error: { code: "internal_error", message: "Não foi possível consultar o catálogo. Tente novamente." } }, 500);
    }
  };
}
