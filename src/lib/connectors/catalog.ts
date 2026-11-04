import type { ConnectorDefinition, ConnectionSnapshot, PlatformId } from "../../types/connectors";

/** Catálogo informativo público. Não chama APIs e não representa conexões persistidas. */
export const connectorCatalog: readonly ConnectorDefinition[] = [
  {
    id: "shopee",
    name: "Shopee",
    description: "Preparação para ofertas e resultados do programa de afiliados.",
    accountRequirement: "Conta aprovada no programa de afiliados; acesso à API brasileira a validar no portal da conta.",
    availabilityMessage: "Conector não implementado. O acesso à API de afiliados no Brasil e suas permissões ainda precisam ser confirmados.",
    capabilities: [
      { id: "products", label: "Consultar ofertas de produtos", evidence: "requires_validation", available: false, limitation: "Documentado pela Shopee em Singapura; disponibilidade no Brasil não confirmada." },
      { id: "affiliate-links", label: "Gerar links de afiliado", evidence: "requires_validation", available: false, limitation: "Links curtos documentados em Singapura; validar contrato e rastreamento no Brasil." },
      { id: "commissions", label: "Consultar conversões e comissões", evidence: "requires_validation", available: false, limitation: "Relatórios documentados em Singapura; campos e acesso brasileiros não confirmados." },
    ],
    permissions: ["Permissões e método de autorização da API de afiliados brasileira a confirmar; nenhum escopo presumido."],
    approvals: ["Aprovação no programa de afiliados e liberação de API para a conta e região.", "Shopee Open Platform para vendedores não comprova acesso à API de afiliados."],
    documentation: [
      { label: "Portal oficial de afiliados Brasil", url: "https://affiliate.shopee.com.br/open_api" },
      { label: "API de afiliados — referência oficial de Singapura", url: "https://help.shopee.sg/portal/10/article/191702-API-Access" },
    ],
    reviewedAt: "2026-11-04",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Preparação para perfil e vídeos da conta que conceder autorização.",
    accountRequirement: "Conta de desenvolvedor, aplicativo registrado e conta TikTok autorizadora.",
    availabilityMessage: "Conector não implementado. Login Kit e produtos de API exigem configuração e aprovação; não há acesso geral a tendências confirmado.",
    capabilities: [
      { id: "profile", label: "Ler perfil autorizado", evidence: "documented", available: false, limitation: "Login Kit / Display API com consentimento e user.info.basic." },
      { id: "videos", label: "Listar vídeos públicos da conta autorizada", evidence: "documented", available: false, limitation: "Display API com video.list; não equivale a buscar todos os vídeos em alta." },
      { id: "publishing", label: "Publicar conteúdo futuramente", evidence: "documented", available: false, limitation: "Content Posting API, video.publish e auditoria; fora do escopo atual." },
    ],
    permissions: ["user.info.basic para perfil básico.", "video.list para vídeos públicos da conta autorizada.", "video.publish somente em futura etapa de publicação, com consentimento específico."],
    approvals: ["Revisão do aplicativo e aprovação dos produtos e escopos solicitados.", "Content Posting sem auditoria restringe a visibilidade a privado; publicar não está habilitado aqui."],
    documentation: [
      { label: "Escopos oficiais", url: "https://developers.tiktok.com/docs/en/tiktok-api-scopes" },
      { label: "Display API", url: "https://developers.tiktok.com/docs/en/display-api-get-started" },
      { label: "Content Posting e auditoria", url: "https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post" },
    ],
    reviewedAt: "2026-11-04",
  },
  {
    id: "tiktok-shop",
    name: "TikTok Shop",
    description: "Preparação para recursos de comércio e afiliação do TikTok Shop.",
    accountRequirement: "Aplicativo no Partner Center e conta elegível de vendedor, criador afiliado ou parceiro, conforme a API.",
    availabilityMessage: "Conector não implementado. APIs e escopos dependem do papel da conta, mercado e aprovação no Partner Center.",
    capabilities: [
      { id: "products", label: "Consultar produtos de colaboração", evidence: "documented", available: false, limitation: "Família Affiliate APIs documentada; acesso brasileiro e papel da conta a validar." },
      { id: "affiliate-links", label: "Gerenciar links de afiliação", evidence: "requires_validation", available: false, limitation: "Operação e permissões concretas para a conta ainda não confirmadas." },
      { id: "commissions", label: "Acompanhar resultados de afiliação", evidence: "requires_validation", available: false, limitation: "Métricas, campos e disponibilidade no mercado alvo a confirmar." },
    ],
    permissions: ["Escopos específicos da API e do papel aprovados no Partner Center; nomes não presumidos.", "Autorização de criador, vendedor ou parceiro conforme o recurso; permissões TikTok não substituem TikTok Shop."],
    approvals: ["Elegibilidade regional, cadastro do aplicativo e liberação das Affiliate APIs.", "Confirmar requisitos comerciais e autorização do titular antes de implementar o fluxo."],
    documentation: [
      { label: "Partner Center — documentação oficial", url: "https://partner.tiktokshop.com/docv2/" },
      { label: "Affiliate APIs", url: "https://partner.tiktokshop.com/docv2/page/affiliate-integration" },
    ],
    reviewedAt: "2026-11-04",
  },
  {
    id: "mercado-livre",
    name: "Mercado Livre",
    description: "Preparação para consulta autorizada de itens do marketplace.",
    accountRequirement: "Conta Mercado Livre e aplicativo registrado; conta de vendedor quando exigida pelo recurso.",
    availabilityMessage: "Conector não implementado. A API de marketplace não confirma geração de links nem comissões do programa de afiliados.",
    capabilities: [
      { id: "products", label: "Consultar itens autorizados", evidence: "documented", available: false, limitation: "API de itens documentada; acesso e restrições dependem do token e do recurso." },
      { id: "affiliate-links", label: "Gerar links de afiliado", evidence: "requires_validation", available: false, limitation: "API pública específica de afiliados não confirmada nesta pesquisa." },
      { id: "commissions", label: "Consultar comissões de afiliado", evidence: "requires_validation", available: false, limitation: "Não confundir dados do vendedor com comissões de afiliados." },
    ],
    permissions: ["read para leituras autorizadas.", "offline_access somente se houver necessidade de renovação em segundo plano.", "write existe na documentação, mas não é necessário para o escopo de leitura pretendido."],
    approvals: ["Aplicativo registrado, redirect URI e autorização do titular.", "Confirmar permissões do recurso e elegibilidade separada no programa de afiliados."],
    documentation: [
      { label: "Autenticação e autorização", url: "https://developers.mercadolivre.com.br/autenticacao-e-autorizacao" },
      { label: "Itens e buscas", url: "https://developers.mercadolivre.com.br/itens-e-buscas" },
    ],
    reviewedAt: "2026-11-04",
  },
];

/** Ausência de conexão local; nunca consultar este estado como prova de autorização externa. */
export function getUnconfiguredSnapshot(platform: PlatformId): ConnectionSnapshot {
  return {
    platform,
    authorization: { status: "not_connected", grantedPermissions: [], missingPermissions: [] },
    synchronization: { status: "not_started" },
    metadata: null,
  };
}
