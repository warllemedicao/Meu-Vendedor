# Integrações — Meu Vendedor

Etapa 2: preparação visual e contratos TypeScript. Referências consultadas em **04/11/2026**.
Não existem conexões, autenticação externa, chamadas de API, tokens ou sincronização implementados.
A existência de uma API na plataforma não significa que esteja liberada para este projeto.

## Shopee

Revisão ampliada em 04/11/2026 após indicação do responsável.

- Fontes oficiais: [portal brasileiro](https://affiliate.shopee.com.br/open_api/home), [Explorer](https://open-api.affiliate.shopee.com.br/explorer) e [Explorer V2](https://open-api.affiliate.shopee.com.br/explorer/v2).
- O portal retorna uma aplicação JavaScript. Os Explorers públicos e seu código HTML/JavaScript confirmam App ID, Secret, GraphQL e assinatura SHA-256 no cabeçalho de autorização.
- Operações presentes no catálogo público do V2: `productOfferV2`, `shopeeOfferV2`, `conversionReport`, `validatedReport` e `generateShortLink`.
- Essa evidência confirma documentação brasileira de ofertas, relatórios e links; não comprova acesso liberado para nossa conta. Nenhuma requisição autenticada foi realizada.
- Login por senha da loja e autorização OAuth delegada para afiliados Shopee não foram confirmados nesse material. O fluxo documentado observado usa credenciais de API.
- Limites, campos, períodos de relatório e permissões efetivas ainda precisam ser validados antes de sincronizar. O conector executará chamadas e assinatura no servidor, com segredos cifrados e isolamento por usuário.

## TikTok

- Fontes oficiais: [Display API](https://developers.tiktok.com/docs/en/display-api-get-started), [escopos](https://developers.tiktok.com/docs/en/tiktok-api-scopes), [Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post) e [tokens](https://developers.tiktok.com/docs/en/login-kit-manage-user-access-tokens).
- Conta necessária: desenvolvedor com app registrado e conta TikTok que autorize o acesso.
- APIs identificadas: Login Kit, Display API e Content Posting API.
- Permissões: `user.info.basic` (perfil básico), `video.list` (vídeos públicos da conta autorizada); `video.publish` apenas em futura etapa de publicação.
- Confirmado na documentação: perfil e vídeos autorizados; Direct Post sujeito a condições e auditoria, com visibilidade privada para clientes não auditados.
- Não confirmado: API geral de tendências comerciais, acesso irrestrito a vídeos de terceiros ou aprovação deste aplicativo.
- Requisitos futuros: revisão do app/produtos, escopos mínimos, consentimento, callback seguro e validação das restrições do produto. Nenhuma publicação será implementada nesta etapa.

## TikTok Shop

- Fontes oficiais: [Partner Center](https://partner.tiktokshop.com/docv2/) e [Affiliate Integration](https://partner.tiktokshop.com/docv2/page/affiliate-integration).
- Conta necessária: app no Partner Center e papel elegível de vendedor, criador afiliado ou parceiro, dependendo do recurso.
- APIs identificadas: famílias Affiliate Seller, Affiliate Creator e Affiliate Partner.
- Confirmado: existem APIs de colaboração e afiliação; o acesso requer a autorização correspondente ao papel e permissões aprovadas.
- Permissões exigidas: escopos específicos por operação no Partner Center. Nenhum identificador de escopo foi presumido neste projeto.
- Não confirmado para nossa conta/mercado: operações de geração de links, campos de comissão e disponibilidade de cada família no Brasil.
- Requisitos futuros: validar região, papel, elegibilidade e liberação de APIs; registrar o contrato exato antes de implementar. A autorização TikTok Shop é separada da autorização TikTok.

## Mercado Livre

- Fontes oficiais: [autenticação e autorização](https://developers.mercadolivre.com.br/autenticacao-e-autorizacao) e [itens e buscas](https://developers.mercadolivre.com.br/itens-e-buscas).
- Conta necessária: conta Mercado Livre e aplicativo cadastrado; recursos de vendedor podem exigir o respectivo titular.
- APIs identificadas: autorização OAuth e API de itens do marketplace.
- Permissões: `read` para leitura; `offline_access` quando renovação em segundo plano for necessária; `write` é documentado, mas não faz parte da intenção de leitura.
- Confirmado: autorização e renovação, revogação invalidando tokens e operações de itens documentadas, com restrições conforme recurso e autorização.
- Não confirmado: API pública específica para links e comissões do programa de afiliados. Não tratar dados de vendas de vendedores como resultados de afiliados.
- Requisitos futuros: aplicativo, redirect URI cadastrada, consentimento e verificação das permissões do recurso. Validar o programa de afiliados separadamente antes de oferecer links ou comissões.

## Contratos e organização técnica

- `src/types/connectors.ts`: identificação, capacidades, autorização, sincronização, erros tipados, metadados e interface de futuro adaptador de servidor.
- `src/lib/connectors/catalog.ts`: catálogo público e estado local explicitamente não configurado; não é um provider e não faz requisições.
- `src/components/integrations/IntegrationCard.tsx`: requisitos e referências de cada plataforma em `/contas`.
- `evidence` distingue documentação de pendências de validação; `available` representa disponibilidade **no Meu Vendedor** e permanece `false` para todos os recursos.
- A interface `PlatformConnector` descreve leitura de estado/capacidades e revogação futura. Não tem implementação nem sucesso simulado. OAuth e sincronização reais exigirão contratos adicionais adequados a cada provider.
- Erros retornam `ConnectorResult<T>`: sucesso com dados ou falha com código, mensagem sanitizada e indicação de repetição. Limite de taxa admite espera orientada pelo provedor; autorização expirada exige renovação segura ou novo consentimento. Não repetir automaticamente falhas permanentes ou operações comerciais.
- Metadados públicos não incluem tokens. As datas de conexão/sincronização só serão preenchidas a partir de fatos persistidos pelo futuro backend.

## Segurança futura — desenho, ainda não implementado

1. **OAuth:** quando suportado pelo provedor, usar Authorization Code no backend, PKCE quando suportado/exigido, `state` aleatório de uso único, validade curta e vínculo com sessão e usuário. Validar callback e redirect URI exatos; rejeitar state ausente, divergente ou reutilizado. Cada integração seguirá seu mecanismo oficial, sem presumir OAuth para Shopee.
2. **Credenciais:** segredos da aplicação em gerenciador de segredos ou variáveis apenas do servidor; tokens por conta cifrados em banco, com chave separada e rotação. Não usar `NEXT_PUBLIC_*`, localStorage, sessionStorage ou cookies legíveis por JavaScript para credenciais. Cookies de sessão próprios deverão ser HttpOnly, Secure e SameSite apropriado.
3. **Renovação:** armazenar expiração fornecida pelo provedor, renovar exclusivamente no servidor com exclusão concorrente e atualização atômica dos tokens rotacionados. Em recusa definitiva, marcar expirada/revogada e pedir nova autorização. Nunca registrar códigos, tokens ou corpos brutos em logs.
4. **Revogação:** cancelar tarefas, invalidar o acesso local, revogar pelo mecanismo oficial quando disponível e eliminar os segredos. Distinguir revogação local de remota; falha remota não pode ser apresentada como sucesso remoto. Tratar também revogação realizada no portal do provedor.
5. **Permissões:** menor privilégio e consentimento explícito; checar escopos concedidos e propriedade da conexão no backend a cada operação. Separar permissões do usuário da aplicação e escopos externos. Não confiar em estado enviado pelo navegador. Nova capacidade exige nova autorização quando necessário.
6. **Auditoria:** registrar apenas identificadores públicos, operação e resultado sanitizado, com retenção e acesso restritos. Proteger callbacks, endpoints de configuração e revogação contra CSRF e acessos de outros usuários.

Não solicitar senhas das plataformas. Não criar campos para segredos no navegador.

## Validação e próximo trabalho

`npm test` verifica ausência de capacidades ativas/conexões falsas e domínios oficiais do catálogo. Executar também `npm run lint`, `npm run typecheck` e `npm run build`.

Não há testes reais de API: não há credenciais nem adaptadores. Antes de conectar qualquer serviço, implementar backend, persistência cifrada e autorização por usuário, confirmar acesso da conta e definir testes de contrato/sandbox. A próxima etapa depende de instrução explícita; esta entrega não inicia Etapa 3.

## Resultado da verificação desta entrega

Em 04/11/2026: `npm test` (3 testes), `npm run lint` e `npm run typecheck` passaram.
O build de produção passou com `npm run build -- --webpack`, gerando todas as rotas estáticas.
O build padrão com Turbopack foi tentado, inclusive com permissão ampliada, mas o ambiente bloqueou a abertura de uma porta local usada no processamento de CSS (`Operation not permitted`). Não foi alterado o compilador padrão do projeto.
Foi conferido também o HTML de `/contas`: as quatro plataformas e o aviso de ausência de conexão estão presentes, sem formulário de credenciais.
A revisão dos arquivos e a busca por padrões de credenciais não identificaram segredos na entrega; `.env.example` contém apenas comentários.
Não havia suíte de testes anterior na Etapa 1; os testes do catálogo foram adicionados nesta etapa.

## Catálogo básico atual e Supabase

O catálogo foi limitado a Shopee, TikTok, Mercado Livre, Amazon e Magazine Luiza. TikTok Shop permanece dentro da orientação TikTok, com requisitos próprios de API. Os portais oficiais da Amazon (`https://associados.amazon.com.br/`) e Influenciador Magalu (`https://www.magazinevoce.com.br/`) foram consultados para acesso e afiliação, sem confirmar APIs para o aplicativo.

A base Supabase atende a conta do próprio Meu Vendedor, perfis e links cadastrados manualmente. Não conecta automaticamente contas das plataformas. A migração e as políticas foram aplicadas no projeto remoto; verificação e limites estão em `SUPABASE.md`.

## Direção de integração unificada

O responsável definiu que abrir o portal da loja não atende ao objetivo final. O produto deverá conectar contas e trazer os dados disponibilizados pelas APIs para o painel. Os botões externos atuais continuam sendo acesso/afiliação, sem representar conexão.

A proposta é uma API interna unificada do Meu Vendedor, com um adaptador por plataforma e capacidades verificadas individualmente. Não foi identificado um serviço externo com cobertura comprovada das cinco plataformas, login único e todos os dados de afiliados. Redes como Awin oferecem APIs para as contas vinculadas à própria rede, não comprovação de cobertura universal ([autenticação Awin](https://help.awin.com/apidocs/api-authentication)).

Fluxos oficiais diferentes já foram identificados: TikTok Shop documenta autorização de criadores por app e escopos ([guia](https://partner.tiktokshop.com/docv2/page/678e3a362dccb8030ea6f98c)); Amazon documenta Creators API com credenciais e acesso ao catálogo ([introdução](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction)). Esses recursos não comprovam acesso a todas as métricas de cada programa. A API de marketplace Magalu não comprova acesso aos resultados de Influenciador Magalu.

Plano: conectar individualmente cada conta pelo mecanismo oficial; guardar tokens/segredos somente no servidor; validar uma primeira leitura; persistir somente os dados permitidos; mostrar horário, origem e falhas de sincronização; renovar autorização quando o mecanismo permitir. Não solicitar senha das lojas nem automatizar o login por captura de sessão. Novos endpoints, funções e tabelas de sincronização ainda não foram implementados por esta análise.
