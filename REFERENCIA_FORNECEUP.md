# Referência de produto — ForneceUp

Análise das páginas públicas consultadas em 04/11/2026. Este documento não altera o escopo implementado da Etapa 2.

## Fontes consultadas

- [Página inicial](https://forneceup.online/).
- [Sobre a plataforma](https://forneceup.online/sobre-forneceup).
- [Como funciona](https://forneceup.online/como-funciona-forneceup).

A página inicial apresenta catálogo de fornecedores e produtos para revenda, materiais sobre marketplaces,
suporte e planos de acesso. Cita Mercado Livre, Shopee, Magalu e Bling. A representação do painel é rotulada
como prévia ilustrativa. Não foi possível confirmar integração automática com APIs a partir desse material.

A página Sobre descreve o catálogo como apoio à pesquisa e esclarece que acesso não equivale a estoque ou
garantia de vendas. O guia orienta verificar condições diretamente com fornecedores e conferir regras de cada
marketplace. Isso caracteriza uma proposta de revenda, diferente do foco atual do Meu Vendedor em afiliados.

Não foram acessados checkout, compra, área de assinantes ou catálogo interno. Os links públicos de navegação
encontrados remetem às três páginas acima e às seções da página inicial. Sitemap e robots não ficaram acessíveis
pela ferramenta de pesquisa; a análise não afirma cobrir todo o domínio ou o produto autenticado.

## Adaptação ao Meu Vendedor — estado atual

| Área | Direção para manter o foco em afiliados | Estado em 05/11/2026 |
| --- | --- | --- |
| Página pública | Apresentar oportunidades e dar acesso ao painel | Vitrine pública implementada; fontes comerciais ainda sem configuração |
| Catálogo | Produtos organizados por plataforma, quando houver fonte autorizada | Adaptadores implementados; sucesso comercial real pendente |
| Favoritos | Organização pessoal de oportunidades | Não implementado |
| Plataformas | Preservar requisitos e estados honestos de `/contas` | Implementado; somente Shopee possui conector de conta |
| Links | Cadastro e organização dos links do próprio afiliado | CRUD Supabase implementado |
| Vídeos | Preparar anúncios sem prometer geração inexistente | Modo demonstração implementado; geração Google bloqueada |
| Ajuda | Guias originais sobre o uso do Meu Vendedor | Sem rota dedicada |

As decisões implementadas pertencem ao Meu Vendedor e não afirmam reproduzir funcionalidades internas da referência. Visual e estrutura servem apenas de inspiração, mantendo nome, textos e identidade próprios.
Não adicionar selos de fornecedores verificados, integrações ativas, cursos, preços ou resultados sem suporte real.

## Direção confirmada pelo responsável

Em 04/11/2026, o responsável confirmou o foco em interação e gerenciamento de afiliados de múltiplas plataformas, incluindo Magazine Luiza. A referência orienta a apresentação visual; o escopo do Meu Vendedor está em `ESCOPO.md`, e sua arquitetura em `ARQUITETURA.md`. A análise da referência não implica implementação dos seus recursos.
Para reproduzir fluxos internos com precisão, serão necessárias referências da área autenticada que o responsável
possa compartilhar, como capturas ou uma demonstração, sem envio de senhas ou segredos.
