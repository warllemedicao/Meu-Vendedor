import type { ConnectorDefinition, ConnectionSnapshot, PlatformId } from "../../types/connectors";

/** Catálogo informativo público. Não chama APIs e não representa conexões persistidas. */
export const connectorCatalog: readonly ConnectorDefinition[] = [
  {
    id: "shopee",
    name: "Shopee",
    description: "Conecte a Open API de afiliados para consultar ofertas e gerar links no Meu Vendedor.",
    accountRequirement: "Conta de afiliado com acesso à Open API liberado e credenciais App ID e Secret.",
    availabilityMessage: "Conector disponível para ofertas e links. A conta só aparece conectada depois de a Shopee validar as credenciais. Relatórios de conversões ainda não estão integrados.",
    capabilities: [
      { id: "products", label: "Consultar ofertas de produtos", evidence: "documented", available: true, limitation: "Até 60 ofertas da API brasileira por sincronização, ordenadas por vendas informadas. Não é o ranking global do marketplace." },
      { id: "affiliate-links", label: "Gerar links de afiliado", evidence: "documented", available: true, limitation: "Links gerados pela API com as credenciais desta conta e salvos em Meus links." },
      { id: "commissions", label: "Consultar conversões e comissões", evidence: "documented", available: false, limitation: "Contrato documentado no Explorer brasileiro; sincronização de relatórios ainda não implementada." },
    ],
    permissions: ["App ID e Secret emitidos pela Open API Shopee; operações dependem da liberação para esta conta."],
    approvals: ["Aprovação no programa de afiliados e liberação de API para a conta e região.", "Shopee Open Platform para vendedores não comprova acesso à API de afiliados."],
    documentation: [
      { label: "Portal oficial de afiliados Brasil", url: "https://affiliate.shopee.com.br/open_api" },
      { label: "Explorer oficial brasileiro e contrato de API", url: "https://open-api.affiliate.shopee.com.br/explorer/v2" },
    ],
    portalUrl: "https://affiliate.shopee.com.br/",
    affiliationUrl: "https://affiliate.shopee.com.br/",
    reviewedAt: "2026-11-04",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "TikTok e TikTok Shop: acesso ao programa e planejamento de recursos da conta autorizada.",
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
    portalUrl: "https://www.tiktok.com/",
    affiliationUrl: "https://seller-br.tiktok.com/university/essay?knowledge_id=6807244117362448&lang=en",
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
    portalUrl: "https://www.mercadolivre.com.br/l/afiliados-home",
    affiliationUrl: "https://www.mercadolivre.com.br/l/afiliados-home",
    reviewedAt: "2026-11-04",
  },
  {
    id: "amazon",
    name: "Amazon",
    description: "Organize os links do Programa de Associados Amazon.",
    accountRequirement: "Conta no Programa de Associados, sujeita aos critérios de aprovação do programa.",
    availabilityMessage: "Você já pode acessar o programa oficial. Sincronização de produtos e resultados ainda não implementada no Meu Vendedor.",
    capabilities: [
      { id: "affiliate-links", label: "Organizar seus links de associado", evidence: "documented", available: false, limitation: "Criação de links acontece no programa oficial; o cadastro no Meu Vendedor é manual, sem integração de API." },
      { id: "products", label: "Consultar produtos por API futuramente", evidence: "requires_validation", available: false, limitation: "Contrato de API, elegibilidade e limites da conta ainda precisam ser verificados." },
    ],
    permissions: ["Nenhuma permissão Amazon solicitada pelo Meu Vendedor nesta etapa."],
    approvals: ["Cadastro e aprovação no Programa de Associados para uso dos recursos da própria Amazon.", "Acesso a API exige verificação separada; cadastro no programa não representa conexão ao Meu Vendedor."],
    documentation: [{ label: "Programa de Associados Amazon — portal oficial", url: "https://associados.amazon.com.br/" }],
    portalUrl: "https://associados.amazon.com.br/",
    affiliationUrl: "https://associados.amazon.com.br/",
    reviewedAt: "2026-11-04",
  },
  {
    id: "magazine-luiza",
    name: "Magazine Luiza",
    description: "Organize seus links do Influenciador Magalu.",
    accountRequirement: "Cadastro no programa Influenciador Magalu, conforme critérios do portal oficial.",
    availabilityMessage: "Entre ou conheça o cadastro no site oficial. Nenhuma API Magalu está conectada ao Meu Vendedor.",
    capabilities: [
      { id: "affiliate-links", label: "Organizar links da sua loja Magalu", evidence: "documented", available: false, limitation: "O programa oficial oferece compartilhamento de links; a organização aqui é manual e não sincroniza a conta." },
      { id: "commissions", label: "Acompanhar comissões automaticamente no futuro", evidence: "requires_validation", available: false, limitation: "API de comissões de afiliado e permissões para nossa conta ainda não confirmadas." },
    ],
    permissions: ["Nenhuma permissão Magalu solicitada pelo Meu Vendedor nesta etapa."],
    approvals: ["Concluir o cadastro e atender às condições do programa oficial.", "Validar disponibilidade de API específica antes de desenvolver um conector."],
    documentation: [{ label: "Influenciador Magalu — portal oficial", url: "https://www.magazinevoce.com.br/" }, { label: "Parceiro Magalu", url: "https://www.parceiromagalu.com.br/" }],
    portalUrl: "https://www.magazinevoce.com.br/",
    affiliationUrl: "https://www.magazinevoce.com.br/",
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
