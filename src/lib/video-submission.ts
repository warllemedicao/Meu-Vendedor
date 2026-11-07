import type { SupabaseClient } from "@supabase/supabase-js";

export interface VideoSubmissionIssue { message: string; step?: number }
export function videoSubmissionIssue(input: {
  signedIn: boolean; validationError: string | null; hasImage: boolean; presenterReady: boolean;
  presenterName: string; duration: number;
}): VideoSubmissionIssue | null {
  if (!input.signedIn) return { message: "Entre na sua conta para gerar e guardar o vídeo." };
  if (input.validationError) return { message: input.validationError, step: input.validationError.includes("roteiro") ? 2 : 0 };
  if (!input.hasImage) return { message: "Adicione uma foto do produto na etapa Produto para gerar o vídeo.", step: 0 };
  if (!input.presenterReady) return { message: `${input.presenterName} está sem referência aprovada. Selecione Ana ou Lucas na etapa Direção visual.`, step: 1 };
  if (input.duration !== 6) return { message: "Selecione a duração de 6 segundos para esta geração.", step: 1 };
  return null;
}

export async function edgeFunctionMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === "object" && "context" in error && error.context instanceof Response) {
    const response = error.context;
    const body = await response.clone().json().catch(() => null);
    if (typeof body?.error?.message === "string") return body.error.message;
    if (response.status === 401) return "Sua sessão expirou. Entre novamente para gerar o vídeo.";
    if (response.status === 429) return "Há um limite temporário de solicitações. Aguarde e tente novamente.";
  }
  return fallback;
}

export interface AlternativeVoice { id: string; name: string; gender: string; language: string }
export function filterAlternativeVoices<T extends AlternativeVoice>(voices: readonly T[], gender: string): T[] {
  const expected = gender === "feminina" ? "female" : "male";
  return voices.filter(v => !v.gender || v.gender === expected || v.gender === "neutral");
}

export async function importVideoProductImage(client: SupabaseClient, userId: string, productId: string): Promise<string> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(userId) || !uuidPattern.test(productId)) throw new Error("Selecione um produto sincronizado da sua conta.");
  const { data, error } = await client.functions.invoke("video-generation", {
    body: { action: "import-product-image", productId }, timeout: 25000,
  });
  if (error) throw new Error(await edgeFunctionMessage(error, "Não foi possível preparar a foto sincronizada agora. Tente novamente."));
  const path = data?.path;
  if (typeof path !== "string" || !new RegExp(`^${userId}/inputs/[A-Za-z0-9_-]+\\.(?:jpg|png|webp)$`).test(path)) {
    throw new Error("A foto importada não foi encontrada na área privada desta conta.");
  }
  return path;
}
