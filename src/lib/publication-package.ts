export type PublicationPlatform = "shopee" | "kwai" | "tiktok" | "facebook" | "whatsapp";
export const PUBLICATION_DESTINATIONS: Record<PublicationPlatform, { label: string; url: string; hint: string }> = {
  shopee: { label: "Shopee Vídeos", url: "https://shopee.com.br/", hint: "Baixe o vídeo e abra Shopee → Live e Vídeos → Vídeos. Envie o arquivo, vincule o produto e confirme a postagem no aplicativo. O navegador não publica diretamente na Shopee." },
  kwai: { label: "Kwai", url: "https://www.kwai.com/", hint: "Envie o vídeo pelo app Kwai. Links na legenda podem não ser clicáveis." },
  tiktok: { label: "TikTok", url: "https://www.tiktok.com/upload", hint: "Envie o vídeo pelo TikTok. Links na descrição podem não ser clicáveis." },
  facebook: { label: "Facebook", url: "https://www.facebook.com/", hint: "Publique em sua Página ou perfil, conforme as opções da sua conta." },
  whatsapp: { label: "WhatsApp", url: "https://web.whatsapp.com/", hint: "Para Status, use o aplicativo no celular. O compartilhamento não publica automaticamente." },
};
export function publicationCaption(title: string, link: string, hashtags: string): string {
  const cleanTitle = title.trim().slice(0, 120);
  const cleanTags = hashtags.split(/\s+/).filter(tag => /^#[\p{L}\p{N}_]{1,40}$/u.test(tag)).slice(0, 12).join(" ");
  const cleanLink = link.trim();
  if (cleanLink && !/^https?:\/\/[^\s]+$/i.test(cleanLink)) throw new Error("Informe um link de afiliado HTTP ou HTTPS válido.");
  return [cleanTitle, cleanLink ? "Confira a oferta: " + cleanLink : "", cleanTags].filter(Boolean).join("\n\n");
}
export function publicationPackageText(platform: PublicationPlatform, title: string, link: string, hashtags: string, filename: string) {
  return ["MEU VENDEDOR — PACOTE DE PUBLICAÇÃO", "Destino: " + PUBLICATION_DESTINATIONS[platform].label, "Vídeo: " + filename, "", "LEGENDA", publicationCaption(title, link, hashtags), "", "INSTRUÇÕES", PUBLICATION_DESTINATIONS[platform].hint, "Baixe o vídeo e publique manualmente. Confirme a postagem no aplicativo de destino."].join("\n");
}
