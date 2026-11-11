"use client";
import { getSupabase } from "@/lib/supabase/client";
import type { CatalogPlatform, CatalogQuery, CatalogResult, CatalogSourceStatus } from "@/types/product-catalog";

async function invoke(body: Record<string, unknown>): Promise<unknown> {
  const client = getSupabase();
  if (!client) throw new Error("A conexão com o catálogo não está configurada.");
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("Entre na sua conta para consultar produtos.");
  const { data, error } = await client.functions.invoke("catalog", { body });
  if (error) {
    let message = "Não foi possível acessar o serviço de catálogos. Confira se a função catalog foi publicada e tente novamente.";
    if (error.context instanceof Response) {
      try {
        const result = await error.context.json();
        if (typeof result?.error?.message === "string") message = result.error.message;
      } catch { /* Não apresentar texto de proxy ou resposta bruta. */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(typeof data.error.message === "string" ? data.error.message : "Não foi possível consultar produtos.");
  return data;
}
export async function catalogStatus(): Promise<CatalogSourceStatus[]> {
  const data = await invoke({ action: "status" }) as { sources?: CatalogSourceStatus[] };
  if (!Array.isArray(data?.sources)) throw new Error("O serviço retornou um estado de catálogos inválido.");
  return data.sources;
}
export async function catalogSearch(platform: CatalogPlatform, query: CatalogQuery): Promise<CatalogResult> {
  const data = await invoke({ action: "search", platform, ...query }) as CatalogResult;
  if (!Array.isArray(data?.products) || data.platform !== platform) throw new Error("O serviço retornou um catálogo inválido.");
  return data;
}

export async function generateAliExpressLink(productUrl: string): Promise<string> {
  const data = await invoke({ action: "affiliate_link", platform: "aliexpress", productUrl }) as { url?: string };
  if (!data?.url || !/^https:\/\//.test(data.url)) throw new Error("A API não retornou um link válido.");
  return data.url;
}
