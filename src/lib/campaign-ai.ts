import { getSupabase } from "@/lib/supabase/client";
import { edgeFunctionMessage } from "@/lib/video-submission";
import type { CampaignProduct } from "./product-campaign";
import type { CampaignContent } from "../../supabase/functions/campaign-content/_shared/content";
export type CampaignAnalysis = CampaignContent & { imagePath: string; provider: string; model: string };
export async function campaignInvoke(name: string, body: Record<string, unknown>) {
  const client = getSupabase(); if (!client) throw new Error("Entre na conta para preparar sua divulgação.");
  const { data, error } = await client.functions.invoke(name, { body, timeout: 80000 });
  if (error) throw new Error(await edgeFunctionMessage(error, "Não foi possível preparar esta etapa agora."));
  if (data?.error) throw new Error(data.error.message ?? "Não foi possível preparar esta etapa.");
  return data;
}
export async function analyzeProductCampaign(product: CampaignProduct, userId: string, notes: string, seconds: number, file?: File): Promise<CampaignAnalysis> {
  const client = getSupabase(); if (!client) throw new Error("Entre na conta para analisar a foto.");
  let imagePath: string | undefined;
  if (file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("Use uma foto JPEG, PNG ou WebP de até 10 MB.");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    imagePath = `${userId}/inputs/campaign-${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("mv-video-assets").upload(imagePath, file, { contentType: file.type, upsert: false });
    if (error) throw new Error("Não foi possível salvar a foto para análise.");
  }
  const data = await campaignInvoke("campaign-content", { productId: product.owned ? product.id : undefined, title: product.title, imagePath, notes, seconds });
  if (typeof data?.speech !== "string" || typeof data?.caption !== "string" || !Array.isArray(data?.hashtags) || !Array.isArray(data?.benefits)) throw new Error("A análise não retornou roteiro e publicação válidos.");
  return data as CampaignAnalysis;
}
