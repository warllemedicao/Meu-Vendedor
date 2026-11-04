# Catálogo inicial: ofertas e mais vendidos

## Vitrine pública de três lojas — prioridade atual

Por orientação do responsável, `/` e `/dashboard` passam a usar apenas Shopee, Amazon e TikTok Shop. A vitrine deixou de usar `RemoteCatalog`/`ProductCatalog` pessoais e não exige login no Meu Vendedor nem conexão com lojas. Os conectores privados das demais páginas continuam separados.

Foi criada a função `catalog-public`, publicada na versão 1 com `verify_jwt=false` porque serve somente uma seleção pública de produtos. Ela não lê banco, sessão, credenciais ou resultados de usuários. Usa exclusivamente o segredo de servidor **`MV_PUBLIC_CATALOG_CONFIG`**, com acessos do próprio aplicativo autorizados para essa exibição. Não reutiliza `MV_CATALOG_ACCOUNTS` nem credenciais Shopee pessoais. A autenticação das funções privadas permanece preservada.

Estrutura da configuração central no gerenciador de segredos Supabase (preencher somente as lojas com acesso concedido; nunca no frontend, Git ou chat):

```json
{
  "shopee": {"appId": "APP_ID_DO_SERVICO", "secret": "SECRET_DO_SERVICO"},
  "amazon": {"clientId": "CLIENT_ID_DO_SERVICO", "clientSecret": "SECRET_DO_SERVICO", "partnerTag": "TAG_DA_CONTA", "keywords": "casa"},
  "tiktok": {"appKey": "APP_KEY_DO_SERVICO", "appSecret": "SECRET_DO_SERVICO", "accessToken": "TOKEN_AUTORIZADO_DO_CRIADOR"}
}
```

Uma consulta GET pública recebe apenas `platform=shopee|amazon|tiktok`. Nenhum token de visitante é encaminhado às lojas. A coleta de cada fonte é compartilhada por visitantes e mantida em memória por até 10 minutos, com coalescência de chamadas concorrentes e espera de 30 segundos após falha, por instância. Esse mecanismo não é um rate limiter distribuído; é necessário dimensionar cotas conforme o tráfego. Não há persistência de imagens/produtos no banco. A interface atualiza a leitura a cada 10 minutos e oferece busca/filtros locais.

A vitrine não gera links pessoais. Remove a tag Amazon do endereço público e parâmetros de rastreamento dos outros endereços, preservando apenas região/idioma do TikTok quando presentes. Atribuição de afiliado e consentimento ficam para a próxima etapa. A configuração deve usar uma fonte cuja licença permita a exibição pretendida; um token de criador não concede acesso global ao TikTok.

**Bloqueio real confirmado no ambiente remoto:** GET sem login para as três plataformas retornou HTTP 503 com `catalog_not_configured`. Nenhuma das três fontes centrais está configurada. O banco consultado não contém produtos/conexões sincronizados para aproveitar. A implementação pública e seus testes não significam que o pedido de exibir produtos reais esteja concluído. Não inserir dados de demonstração ou declarar sucesso comercial enquanto faltar a fonte.

Os registros abaixo documentam a pesquisa e a implementação privada anterior; não representam mais a interface da página inicial.

## Requisito de experiência corrigido

O responsável esclareceu que deseja navegar no catálogo sem conectar uma loja e vincular o perfil de afiliado por botão de consentimento oficial, sem digitar chaves técnicas. A implementação publicada abaixo não atende integralmente a isso: ela usa sessão do Meu Vendedor e configurações comerciais por usuário. A próxima mudança deverá separar o catálogo do aplicativo (acesso/licença do serviço para exibição aos usuários) dos dados privados e da atribuição pessoal do afiliado. Não compartilhar credenciais/resultados privados de um usuário para preencher um catálogo público. Não retirar a autenticação do endpoint atual como atalho: ele também seleciona acessos pessoais.

TikTok Shop documenta redirecionamento de criador para `shop.tiktok.com/alliance/creator/auth`, com `state` e retorno ao aplicativo. O contrato Shopee Affiliate verificado usa App ID/Secret e assinatura; não foi confirmado consentimento delegado equivalente para afiliados. A autorização de vendedores Shopee é uma integração distinta. Amazon Creators API documenta `client_credentials`, que é autenticação do serviço e não um consentimento do afiliado final. A disponibilidade da página pública das lojas não dispensa os requisitos da API ou as condições de uso do catálogo.

Pesquisa realizada em 04/11/2026 por solicitação do responsável. Escopo desta etapa: descobrir fontes de produtos para a página inicial. Publicação em redes sociais e geração de links de novas plataformas ficam para outra etapa.

## Entrega no código

A rota `/` mostra o catálogo de oportunidades, em vez de redirecionar ao dashboard demonstrativo. Há seleção de sete plataformas e estados explícitos de disponibilidade. `/dashboard` mostra o mesmo catálogo. O frontend foi publicado no Cloudflare na versão `29c743ed-e672-4e98-b059-0213bd9a0ec8`, com HTML público verificado; publicação não significa acesso comercial validado.

A página inicial reutiliza o catálogo Shopee autenticado existente: somente produtos da conta do usuário, provenientes da última sincronização. Inclui busca, ordenação por vendas na seleção, desconto, preço e comissão, filtro de descontos e data/origem nos cartões. A ficha na página inicial não oferece publicação ou geração de links. Os fluxos existentes de `/produtos` foram preservados.

**Quatro adaptadores de consulta foram implementados:** Amazon, Mercado Livre, TikTok Shop e AliExpress, na nova função Supabase `catalog`. A página inicial consulta o estado da configuração e carrega as fontes configuradas para o usuário autenticado. Mostra título, imagem, preço/moeda, desconto quando comparável, vendas/posição quando disponíveis e horário da consulta. Falhas são independentes por fonte.

**Acesso real ainda não validado nas quatro APIs:** os contratos foram verificados em fontes oficiais e testados com respostas controladas. Não foram fornecidas credenciais comerciais nesta execução. Magalu e SHEIN continuam sem adaptador de afiliados, com estado explícito de indisponibilidade. Nenhum catálogo foi preenchido com exemplos de respostas, dados inventados ou raspagem de lojas.

## Fontes oficiais verificadas

| Plataforma | Contrato encontrado | O que falta para mostrar produtos reais |
| --- | --- | --- |
| Amazon | Implementado `POST https://creatorsapi.amazon/catalog/v1/searchItems`; OAuth `client_credentials` em `https://api.amazon.com/auth/o2/token`, escopo `creatorsapi::default`; até 10 resultados por consulta com `minSavingPercent` opcional | Conta elegível, Client ID/Secret da versão 3.1, PartnerTag do Brasil e teste real. Consulta por palavra-chave não equivale à lista global de mais vendidos ou Black Friday. Preço MAP não é exibido quando sinalizado. |
| Mercado Livre | Implementado `GET /highlights/MLB/category/{category_id}`, até 20 posições; detalhes em `/items/{id}`, `/products/{id}` e `/user-products/{id}`, com concorrência máxima 4 | App/token autorizado e categoria MLB. Detalhes podem exigir permissões adicionais; falhas parciais têm aviso e não renumeram posições. Preço, imagem e link ausentes permanecem ausentes. Sem feed geral de descontos. |
| TikTok Shop | Implementado `POST /affiliate_creator/202405/open_collaborations/products/search`, até 20 produtos, `sort_field=units_sold`, `sort_order=DESC`; HMAC-SHA256 e token de criador | App Key/Secret, token de criador e `creator.affiliate_collaboration.read` aprovados para a região da conta. Consulta de colaboração não é ranking global. Desconto só é calculado com preços únicos na mesma moeda, nunca extremos de variantes. |
| Magalu | Open API de marketplace, produtos e operações promocionais | Não foi confirmada uma fonte de mais vendidos/descontos para Influenciador Magalu. A API de gestão de catálogo do vendedor não comprova leitura do catálogo geral. |
| Shopee | Affiliate Open API BR `productOfferV2`, conector existente | Conectar credenciais reais pela tela segura e validar sincronização. Até 60 ofertas da seleção, com vendas e desconto informados; não é ranking global nem catálogo inteiro. |
| SHEIN | Open Platform, publicação de produtos e operações de vendedores autorizados | Não foi confirmada uma API pública de ranking/descontos para afiliados. Avaliar acesso de parceiro/feed licenciado antes de implementar; não confundir API de vendedor com catálogo global. |
| AliExpress | Implementado `aliexpress.affiliate.hotproduct.query` pelo endpoint HTTPS TOP, assinatura MD5 documentada, até 20 resultados com moeda BRL, idioma PT e destino BR; ordena por `LAST_VOLUME_DESC` ou `DISCOUNT_DESC` | AppKey/Secret e tracking ID aprovados; testar o acesso real. A indicação “não requer autorização” do método dispensa sessão delegada, não a AppKey/assinatura. Produtos em destaque não equivalem ao ranking global. |

Referências:

- Amazon: https://associados.amazon.com.br/creatorsapi/docs/en-us/api-reference/operations/search-items
- Amazon, informações e links: https://associados.amazon.com.br/creatorsapi/docs/en-us/get-started/using-curl
- Amazon, licença/cache: https://associados.amazon.com.br/help/operating/policies
- Mercado Livre, ranking: https://developers.mercadolivre.com.br/pt_br/mais-vendidos-no-mercado-livre
- Mercado Livre, User Products: https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/user-products
- Mercado Livre, tendências: https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/consulte-as-tendencias-de-busca-com-o-recurso-trends
- TikTok Shop: https://partner.tiktokshop.com/docv2/page/affiliate-integration
- TikTok Shop, consulta de criador: https://partner.tiktokshop.com/docv2/page/search-open-collaboration-products-202405
- TikTok Shop, assinatura: https://partner.tiktokshop.com/docv2/page/64f199709495ef0281851fd0
- Magalu: https://developers.magalu.com/docs/apis/
- Magalu Empresas: https://institucional.magaluempresas.com.br/api-integracao (há catálogo B2B para e-commerce; não comprova contrato para Influenciador Magalu nem feed de mais vendidos)
- Shopee: https://open-api.affiliate.shopee.com.br/explorer/v2 (contrato previamente verificado em CONECTORES.md; nesta pesquisa o navegador de consulta não conseguiu reabrir o Explorer)
- SHEIN: https://open.sheincorp.com/pt/documents/system/dad0d1c7-be76-4b03-a735-4e23f012bdd9
- AliExpress: https://developer.alibaba.com/docs/api.htm?apiId=45794
- TOP, assinatura: https://developer.alibaba.com/docs/doc.htm?articleId=118394&docType=1&treeId=813

## Configuração segura e ativação

A função `catalog` é separada da função `marketplace` da Shopee. Reutiliza Supabase Auth para verificar cada JWT, mas não grava resultados ou credenciais no banco. Não usa chave administrativa para consultar o catálogo. A configuração `verify_jwt=true` mantém também a verificação da plataforma.

Publicar a pasta `supabase/functions/catalog`, incluindo seus módulos `_shared` e os módulos de erro/leitura HTTP importados de `marketplace/_shared`. A instalação Supabase fornece `SUPABASE_URL` e `SUPABASE_ANON_KEY`. No gerenciador de segredos da função, definir **`MV_CATALOG_ACCOUNTS`** como JSON com as configurações por ID real do usuário Supabase. Estrutura ilustrativa, sem credenciais válidas:

```json
{
  "UUID_DO_USUARIO_NO_SUPABASE": {
    "amazon": {
      "clientId": "PREENCHER_NO_SERVIDOR",
      "clientSecret": "PREENCHER_NO_SERVIDOR",
      "partnerTag": "TAG_BR_DA_CONTA",
      "keywords": "casa"
    },
    "mercadolivre": {
      "accessToken": "PREENCHER_NO_SERVIDOR",
      "categoryId": "MLB432825"
    },
    "tiktok": {
      "appKey": "PREENCHER_NO_SERVIDOR",
      "appSecret": "PREENCHER_NO_SERVIDOR",
      "accessToken": "TOKEN_DO_CRIADOR_NO_SERVIDOR"
    },
    "aliexpress": {
      "appKey": "PREENCHER_NO_SERVIDOR",
      "appSecret": "PREENCHER_NO_SERVIDOR",
      "trackingId": "TRACKING_ID_DA_CONTA"
    }
  }
}
```

O exemplo não deve ser usado como configuração de produção. Omitir as plataformas sem acesso; incluir outros usuários somente com as credenciais/autorização correspondentes. O backend seleciona pelo ID retornado por `auth.getUser`, nunca por `userId` do corpo. O frontend recebe apenas status e produtos, sem tokens. Não usar esse JSON em `.env.local` do Next.js, variáveis `NEXT_PUBLIC_*`, URLs, Git ou chat.

Nesta primeira implementação, os segredos são configurados pelo operador; não há fluxo de conexão/renovação OAuth desses quatro programas na interface. Tokens expirados exigem renovação pelo mecanismo oficial e atualização segura no servidor. A evolução para credenciais por usuário em armazenamento cifrado permanece uma etapa própria; não confundir esta consulta com uma conexão comercial completa.

O navegador chama `catalog` com `{action:"status"}` ou `{action:"search",platform,keywords,categoryId,discountsOnly}`. Sem configuração da conta, retorna `credentials_required`, sem consulta externa. Magalu/SHEIN retornam `not_implemented`. Não há um endpoint arbitrário fornecido pelo usuário: os destinos e domínios aceitos são fixos nos adaptadores. Corpos e respostas têm limite de tamanho, timeout e erros sanitizados; redirects com credenciais são recusados.

Existe bloqueio por usuário/plataforma e intervalo de 5 segundos **por instância**. Não é um rate limiter distribuído; dimensionamento exige controle global de cotas antes de ampliar a operação. Uma consulta faz uma página por fonte (Amazon 10, AliExpress/TikTok 20; Mercado Livre até 20 detalhes em lotes de quatro).

Os catálogos novos são consultados ao abrir a página e ao pesquisar; não participam do cron Shopee. A aplicação não persiste os dados nem baixa imagens para seu Storage. Resultados ficam somente em memória na interface e são removidos após 30 minutos (verificação a cada minuto), exigindo nova consulta. Imagens são exibidas pelas URLs autorizadas recebidas da API. Não usar esse mecanismo para redistribuir imagens a outras redes; licenças e condições de cada fonte continuam aplicáveis.

## Verificação da implementação

Testes de contrato controlados cobrem OAuth Amazon e locale BR, assinatura TOP, assinatura TikTok sobre corpo exato, IDs Int64, descontos comparáveis, tipos de ranking Mercado Livre, falha parcial, respostas inválidas/limitadas, CORS, autenticação, isolamento por usuário, ausência de credenciais nas respostas e bloqueio de concorrência. Executar `npm test`, `npm run typecheck`, `npm run typecheck:edge`, `npm run lint` e `npm run build:pages`. Testes com mocks não comprovam acesso comercial real.

## Continuação necessária

1. Identificar quais acessos de API já estão aprovados. Credenciais nunca pelo chat ou Git.
2. Validar primeiro uma chamada autorizada por plataforma e definir a fonte/abrangência de ranking e descontos.
3. Confirmar os contratos de afiliados de Magalu/SHEIN ou um feed licenciado adequado, antes de escrever os dois adaptadores restantes.
4. A função `catalog` já foi publicada na versão 1 e verificada por preflight/negação de chamada sem sessão; o frontend também foi publicado e verificado por HTTP. Configurar segredos por conta e verificar resultados reais. Não presumir que commit/push publica automaticamente no Cloudflare ou no Supabase.
5. Dimensionar coleta e atualização. O cron atual de duas contas Shopee por execução não é uma coleta global das sete lojas.

Até esses passos serem concluídos, a solicitação de exibir produtos reais das sete lojas permanece parcialmente pendente.
