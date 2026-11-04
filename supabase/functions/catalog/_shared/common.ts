import { IntegrationError } from "../../marketplace/_shared/shopee.ts";
import type { AccountConfig, CatalogQuery } from "./types.ts";
export { IntegrationError };

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function text(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
export function number(value: unknown, max = 1e12): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 && result <= max ? result : null;
}
export function integerString(value: unknown): string | null {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  const string = String(value ?? "");
  return /^\d{1,20}$/.test(string) ? string : null;
}
export function https(value: unknown, domains?: string[]): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (domains && !domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
    return url.href;
  } catch { return null; }
}
export function required(config: AccountConfig, key: string): string {
  const value = config[key];
  if (typeof value !== "string" || !value.trim() || value.length > 8192 || /[\r\n]/.test(value)) {
    throw new IntegrationError("credentials_required", "O acesso desta plataforma precisa ser configurado no servidor para sua conta.", 409);
  }
  return value.trim();
}
export function queryInput(body: Record<string, unknown>): CatalogQuery {
  if (body.keywords !== undefined && (typeof body.keywords !== "string" || body.keywords.length > 120)) throw new IntegrationError("invalid_query", "A pesquisa deve ter até 120 caracteres.", 400);
  if (body.categoryId !== undefined && (typeof body.categoryId !== "string" || body.categoryId.length > 30 || !/^[A-Za-z0-9]*$/.test(body.categoryId))) throw new IntegrationError("invalid_query", "Informe uma categoria válida.", 400);
  if (body.discountsOnly !== undefined && typeof body.discountsOnly !== "boolean") throw new IntegrationError("invalid_query", "Filtro de desconto inválido.", 400);
  return { keywords: String(body.keywords ?? "").trim(), categoryId: String(body.categoryId ?? ""), discountsOnly: body.discountsOnly === true };
}
export function invalidResponse(): never { throw new IntegrationError("invalid_response", "A plataforma retornou dados fora do contrato esperado.", 502); }

/** Limites e sanitização comuns: nunca devolver resposta bruta, nem seguir redirecionamento com credenciais. */
export async function providerJson(url: string, init: RequestInit, fetcher: typeof fetch): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) }); }
  catch { throw new IntegrationError("provider_unavailable", "A plataforma está indisponível. Tente novamente mais tarde.", 503); }
  if (response.status === 429) throw new IntegrationError("rate_limited", "A plataforma limitou as consultas. Aguarde antes de tentar novamente.", 429);
  if (response.status >= 500) throw new IntegrationError("provider_unavailable", "A plataforma está temporariamente indisponível.", 503);
  if (!response.ok) throw new IntegrationError("provider_rejected", "A plataforma recusou a consulta. Confira a validade das credenciais e as permissões da API.", 422);
  const reader = response.body?.getReader();
  if (!reader) invalidResponse();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); invalidResponse(); }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError("provider_unavailable", "A leitura da resposta da plataforma foi interrompida.", 503);
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    // IDs e contagens Int64 são texto. Nunca substituir preços/números arbitrários do JSON.
    const raw = new TextDecoder().decode(bytes).replace(/"(id|product_id|units_sold|lastest_volume)"\s*:\s*(\d+)(?=\s*[,}])/g, '"$1":"$2"');
    const result: unknown = JSON.parse(raw);
    if (!result || typeof result !== "object" || Array.isArray(result)) invalidResponse();
    return result as Record<string, unknown>;
  } catch { invalidResponse(); }
}
