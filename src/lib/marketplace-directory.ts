export const marketplaceDirectory = [
  { id: "shopee", name: "Shopee", href: "/shopee", catalog: null, status: "Conector por conta e links manuais", description: "Consulte suas ofertas e gere links com a conta Shopee autorizada. A divulgação manual também está disponível.", hosts: ["shopee.com.br", "shope.ee", "s.shopee.com.br"] },
  { id: "amazon", name: "Amazon", href: "/amazon", catalog: "amazon", status: "Links manuais disponíveis · API depende da conta", description: "Use seu link oficial de Associado. Consulta automática requer credenciais e elegibilidade na Creators API.", hosts: ["amazon.com.br", "amazon.com", "amzn.to"] },
  { id: "mercadolivre", name: "Mercado Livre", href: "/mercado-livre", catalog: "mercadolivre", status: "Links manuais disponíveis · API pendente", description: "Prepare campanhas com o link copiado no portal. A API de catálogo não cria atribuição de comissão.", hosts: ["mercadolivre.com.br", "mercadolibre.com.br", "mercadolivre.com", "meli.la"] },
  { id: "aliexpress", name: "AliExpress", href: "/aliexpress", catalog: "aliexpress", status: "Links manuais disponíveis · API em análise", description: "Solicitação da Affiliate API em análise (Under Review). Use um link oficial existente enquanto aguarda aprovação.", hosts: ["aliexpress.com", "aliexpress.com.br", "ali.ski"] },
  { id: "tiktok", name: "TikTok Shop", href: "/tiktok-shop", catalog: "tiktok", status: "Links manuais disponíveis · autorização própria", description: "Consulta de produtos depende do papel, região e escopos aprovados no TikTok Shop. Conectar TikTok não autoriza a loja automaticamente.", hosts: ["tiktok.com", "tiktokshop.com"] },
  { id: "magalu", name: "Magalu", href: "/magalu", catalog: "magalu", status: "Links manuais disponíveis · catálogo não implementado", description: "Use links oficiais do Influenciador Magalu. O contrato de catálogo de afiliados ainda não foi confirmado.", hosts: ["magazineluiza.com.br", "magazinevoce.com.br", "magalu.com", "divulgador.magalu.com"] },
  { id: "shein", name: "SHEIN", href: "/shein", catalog: "shein", status: "Links manuais disponíveis · catálogo não implementado", description: "Use links oficiais autorizados pelo programa. A API de vendedor não substitui um catálogo de afiliados.", hosts: ["shein.com", "shein.com.br", "shein.top"] },
] as const;
export type ManualMarketplaceId = typeof marketplaceDirectory[number]["id"];

export function marketplaceById(id: ManualMarketplaceId) {
  return marketplaceDirectory.find(item => item.id === id)!;
}

/** Valida a origem sem reconstruir a URL: assinatura, ordem e codificação ficam intactas. */
export function officialAffiliateUrl(id: ManualMarketplaceId, value: string): boolean {
  if (!value || value.length > 2048 || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && marketplaceById(id).hosts.some(host => url.hostname === host || url.hostname.endsWith("." + host));
  } catch { return false; }
}

export function manualCampaignSpeech(title: string): string {
  return `Conheça ${title.trim()}. Confira as imagens e a descrição do anúncio para escolher a opção adequada para você. Veja os detalhes e as condições atuais no meu link. Publicidade: posso receber uma comissão pela compra.`;
}
