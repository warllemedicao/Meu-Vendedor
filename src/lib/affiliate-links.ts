export const platformIds = ["shopee", "tiktok", "mercado-livre", "amazon", "magazine-luiza"] as const;
export type AffiliatePlatformId = typeof platformIds[number];
export interface AffiliateLink {
  id: string;
  user_id: string;
  platform_id: AffiliatePlatformId;
  title: string;
  url: string;
  campaign: string;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface AffiliateLinkInput { platform_id: string; title: string; url: string; campaign: string; notes: string; }
export function validateAffiliateLink(input: AffiliateLinkInput): string | null {
  if (!platformIds.includes(input.platform_id as AffiliatePlatformId)) return "Selecione uma das plataformas disponíveis.";
  if (!input.title.trim() || input.title.trim().length > 160) return "Informe um título de até 160 caracteres.";
  if (input.url.length > 2048 || /\s/.test(input.url)) return "Informe um link HTTPS válido de até 2048 caracteres.";
  try {
    const url = new URL(input.url);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || input.url.includes("@")) return "Use um link HTTPS sem credenciais.";
  } catch { return "Informe um endereço HTTPS válido."; }
  if (input.campaign.length > 100) return "O nome da campanha deve ter até 100 caracteres.";
  if (input.notes.length > 1000) return "As observações devem ter até 1000 caracteres.";
  return null;
}
