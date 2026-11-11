# Publicação na Shopee · Live e Vídeos — 11/11/2026

> **Correção posterior com documentação oficial fornecida pelo responsável:** Shopee Video API Integration Guide confirma Affiliate com `auth_type=user`, chamadas por `user_id` e categoria obrigatória **Shopee Video Management**. Existe autorização documentada para afiliados; as conclusões parciais abaixo sobre material somente de vendedor são históricas. Ainda não se comprovou elegibilidade do cadastro pessoa física no Brasil nem aceitação dos produtos de terceiros desta conta. App não foi criado/autorizado. A referência de edit_video_info confirma caption de até150 caracteres, até seis itens, capa obtida dos quadros, rascunho seguido de post_video e campo obrigatório aigc_label. Categoria do app determina os endpoints, sem adição manual posterior. Evidências textuais, chamado e próximos passos estão no registro mais recente de [historico.md](./historico.md).

## Destino confirmado

O responsável esclareceu que a divulgação deve ir à área **Live e Vídeos**, aba **Vídeos**, dentro da Shopee. O material preparado no Meu Vendedor corresponde ao vídeo, legenda, hashtags e produto dessa postagem. Não é pedido de adicionar à Vitrine do Afiliado nem de iniciar transmissão ao vivo.

## Verificação real da API conectada

Em 11/11/2026, introspecção autenticada e somente leitura nas duas conexões Shopee ativas retornou:

- Queries: `shopOfferV2`, `shopeeOfferV2`, `productOfferV2`, `conversionReport`, `validatedReport`, `partnerOrderReport`, `listItemFeeds`, `getItemFeedData`.
- Mutations: **somente** `generateShortLink` e `generateBatchShortLink`.

Nenhuma operação de upload, rascunho ou postagem de vídeo foi exposta nesse contrato de afiliados. Evidência sanitizada: `tests/results/2026-11-11-shopee-video-capabilities-live.json`. Credenciais foram decifradas apenas no backend existente e não saíram na resposta. O diagnóstico temporário usou segredo descartável e prazo de validade, foi substituído pela versão 2 encerrada e respondeu HTTP410 na conferência final.

## Outra integração de vídeo existe

A documentação primária de integradores que implementam a funcionalidade confirma publicação por API para lojas de vendedores, com autorização específica. A [Plugg.To](https://plugg.to/shopee-video-pluggto/) descreve autorização, upload, rascunho, legenda, vínculo de produtos e postagem. A [Repliz](https://docs.repliz.com/tutorial/platform/shopee) exige conta de vendedor e autorização da loja.

Isso corrige qualquer conclusão ampla de que “a Shopee não tem API de vídeo”. Não comprova que uma conta de afiliado possa publicar produtos de terceiros por essa mesma integração. A documentação oficial apontada para `v2.video.post_video`, `v2.video.edit_video_info` e `v2.video.get_video_list`, módulo129, respondeu HTTP403 nesta consulta pública. Nenhum contrato foi implementado a partir de suposições ou de SDK não oficial.

Para envio automático, falta confirmar com a Shopee a disponibilidade para **criador afiliado no Brasil**, obter aplicação/permissões de vídeo e autorização correspondente da conta, validar o vínculo de produtos de terceiros e só então integrar upload, rascunho e postagem. As credenciais atuais de Affiliate Open API não fornecem esse fluxo. Nenhum serviço de terceiros foi contratado.

## Ajuste da interface

- Destino visível: **Shopee → Live e Vídeos → Vídeos**.
- Botão principal para produto Shopee: **Compartilhar para Shopee Vídeo**.
- Usa o compartilhamento nativo com arquivo, título e texto completo. Verifica suporte ao pacote completo, preservando vídeo, legenda, hashtags e link.
- O sistema operacional apresenta os destinos; o site não pode escolher a Shopee nem identificar qual aplicativo foi selecionado. Não foi inventado um deep link para abrir o editor com um arquivo local.
- Instruções visíveis: selecionar Shopee se aparecer; caso contrário, baixar vídeo, copiar publicação e abrir Live e Vídeos → Vídeos → + no aplicativo.
- Nome do produto disponível para copiar e anúncio original pode ser aberto para conferência. Vínculo do produto é feito no editor da Shopee; não é substituído pelo link da legenda.
- Cancelamento não informa entrega; sucesso do compartilhamento não marca conteúdo como postado. O destino não foi validado em celular físico.

Fontes: [Shopee — Conheça a Shopee Video](https://help.shopee.com.br/portal/10/article/164977-Descubra-o-Shopee-Videos%3A-O-que-%C3%A9-e-como-funciona?previousPage=secondary+category), [Web Share — W3C](https://www.w3.org/TR/web-share/), [MDN — Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API).

Nenhum vídeo foi publicado, nenhuma mídia foi enviada à Shopee e nenhuma GPU foi iniciada nesta rodada.

## Verificações e publicação

- 250 testes aprovados, incluindo pacote completo de compartilhamento, suporte ausente, cancelamento, falhas e endereço seguro do produto.
- TypeScript frontend e lint dos arquivos alterados aprovados; build estático de 17 rotas aprovado fora do sandbox após a falha ambiental conhecida de captura do TypeScript. Nenhuma Edge Function permanente foi alterada.
- Chromium com conta, rascunho e compartilhamento simulados: destino visível, nome e URL do produto, arquivo/título/texto preservados, cópia de publicação e nome, cancelamento e alternativa sem suporte aprovados. Larguras 1440 e 390 sem overflow; sem erro JavaScript. A mídia foi um Blob técnico, não um MP4 reproduzível. Não é validação do receptor Shopee ou do preenchimento automático no aplicativo.
- Evidência: `tests/results/2026-11-11-shopee-video-browser.json`.
- Wrangler dry run aprovado. Publicado no Worker existente `meu-vendedor`, versão `b067dd69-f43a-4142-83cb-4add262b6a0d`, preservando bindings e os dois crons.
- URL: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/publicacoes
