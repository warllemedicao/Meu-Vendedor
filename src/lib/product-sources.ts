/** Pesquisa de contratos oficiais em 04/11/2026. Documentação não equivale a acesso concedido. */
export const productSources = [
  {
    id: "amazon", name: "Amazon", status: "Consulta implementada · requer configuração",
    summary: "Busca de produtos e ofertas pela Creators API. Exige conta elegível e credenciais. O catálogo brasileiro e os filtros precisam ser validados.",
    ranking: "Ranking de mais vendidos ainda não confirmado para esta integração.",
    documentation: "https://associados.amazon.com.br/creatorsapi/docs/en-us/api-reference/operations/search-items",
  },
  {
    id: "mercadolivre", name: "Mercado Livre", status: "Consulta implementada · requer configuração",
    summary: "API oficial de até 20 mais vendidos por categoria. Exige token e consulta dos detalhes de cada item/produto. Feed geral de descontos ainda não confirmado.",
    ranking: "Mais vendidos por categoria; não é um ranking de toda a loja.",
    documentation: "https://developers.mercadolivre.com.br/pt_br/mais-vendidos-no-mercado-livre",
  },
  {
    id: "tiktok", name: "TikTok Shop", status: "Consulta implementada · requer configuração",
    summary: "Consulta de colaboração aberta para criadores, ordenada por unidades vendidas. Exige aplicativo, token de criador, escopo e mercado elegível.",
    ranking: "Ordenação por vendas entre produtos elegíveis; disponibilidade no Brasil depende da conta. Percentual de desconto não é presumido.",
    documentation: "https://partner.tiktokshop.com/docv2/page/search-open-collaboration-products-202405",
  },
  {
    id: "magalu", name: "Magalu", status: "Fonte em validação",
    summary: "A documentação encontrada atende operações de marketplace. Ainda não foi confirmado um feed de ofertas e mais vendidos para Influenciador Magalu.",
    ranking: "Fonte de mais vendidos para afiliados ainda não confirmada.",
    documentation: "https://developers.magalu.com/docs/apis/",
  },
  {
    id: "shopee", name: "Shopee", status: "Conector disponível",
    summary: "Até 60 ofertas da Open API por conta autorizada, com vendas e descontos quando fornecidos. Conecte sua conta para consultar produtos reais.",
    ranking: "Vendas informadas entre as ofertas consultadas; não é ranking global.",
    documentation: "https://open-api.affiliate.shopee.com.br/explorer/v2",
  },
  {
    id: "shein", name: "SHEIN", status: "Fonte em validação",
    summary: "A Open Platform encontrada atende vendedores autorizados. Não foi confirmado um feed público de mais vendidos e descontos para afiliados.",
    ranking: "Fonte de mais vendidos para afiliados ainda não confirmada.",
    documentation: "https://open.sheincorp.com/pt",
  },
  {
    id: "aliexpress", name: "AliExpress", status: "Consulta implementada · requer configuração",
    summary: "Affiliate API documenta hotproduct.query com produtos em destaque, volume e desconto. Exige acesso de aplicativo e validação de moeda e entrega ao Brasil.",
    ranking: "Produtos em destaque da API; não equivale a ranking global de vendas.",
    documentation: "https://developer.alibaba.com/docs/api.htm?apiId=45794",
  },
] as const;
