import type { DemoActivity, DemoProduct, DemoStat, IntegrationState } from "@/types";

/**
 * DADOS DEMONSTRATIVOS E FICTÍCIOS.
 * Nada aqui vem de uma plataforma real. Quando houver backend, este arquivo deixa de ser usado.
 */

export const demoStats: DemoStat[] = [
  { rotulo: "Produtos monitorados", valor: "128", detalhe: "exemplo" },
  { rotulo: "Em tendência", valor: "14", detalhe: "exemplo" },
  { rotulo: "Vídeos criados", valor: "36", detalhe: "exemplo" },
  { rotulo: "Publicações", valor: "52", detalhe: "exemplo" },
  { rotulo: "Cliques", valor: "9.480", detalhe: "exemplo" },
  { rotulo: "Comissões", valor: "R$ 1.250,00", detalhe: "exemplo" },
];

export const demoTop10: DemoProduct[] = [
  { id: "p1", nome: "Produto de exemplo 1", categoria: "Casa", plataforma: "Marketplace A", pontuacao: 96 },
  { id: "p2", nome: "Produto de exemplo 2", categoria: "Beleza", plataforma: "Marketplace B", pontuacao: 93 },
  { id: "p3", nome: "Produto de exemplo 3", categoria: "Eletrônicos", plataforma: "Marketplace A", pontuacao: 89 },
  { id: "p4", nome: "Produto de exemplo 4", categoria: "Moda", plataforma: "Marketplace B", pontuacao: 86 },
  { id: "p5", nome: "Produto de exemplo 5", categoria: "Cozinha", plataforma: "Marketplace A", pontuacao: 84 },
  { id: "p6", nome: "Produto de exemplo 6", categoria: "Pets", plataforma: "Marketplace B", pontuacao: 81 },
  { id: "p7", nome: "Produto de exemplo 7", categoria: "Esporte", plataforma: "Marketplace A", pontuacao: 78 },
  { id: "p8", nome: "Produto de exemplo 8", categoria: "Casa", plataforma: "Marketplace B", pontuacao: 75 },
  { id: "p9", nome: "Produto de exemplo 9", categoria: "Beleza", plataforma: "Marketplace A", pontuacao: 72 },
  { id: "p10", nome: "Produto de exemplo 10", categoria: "Eletrônicos", plataforma: "Marketplace B", pontuacao: 70 },
];

export const demoFeatured: DemoProduct[] = demoTop10.slice(0, 4);

export const demoActivities: DemoActivity[] = [
  { id: "a1", texto: "Exemplo: ranking do dia atualizado", quando: "há 10 min" },
  { id: "a2", texto: "Exemplo: roteiro criado para o produto 3", quando: "há 1 h" },
  { id: "a3", texto: "Exemplo: publicação agendada", quando: "há 3 h" },
  { id: "a4", texto: "Exemplo: link de afiliado cadastrado", quando: "ontem" },
];

/** Todas as integrações estão desconectadas: nenhuma conexão real existe nesta etapa. */
export const integrations: IntegrationState[] = [
  { nome: "Shopee", descricao: "Produtos e comissões" },
  { nome: "Mercado Livre", descricao: "Produtos e afiliados" },
  { nome: "TikTok", descricao: "Tendências e publicação" },
  { nome: "TikTok Shop", descricao: "Produtos e afiliação" },
];
