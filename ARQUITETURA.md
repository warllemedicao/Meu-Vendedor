# ARQUITETURA — Meu Vendedor (Viral Commerce AI)

> Documento de referência principal para qualquer pessoa ou agente que trabalhe no projeto.
> Atualize-o sempre que uma etapa for concluída ou uma decisão técnica mudar.

**Legenda de status usada em todo o documento**

| Status | Significado |
| --- | --- |
| ✅ Implementado | Existe no código e foi testado |
| 🟡 Planejado | Decidido, ainda não escrito |
| 🔌 Depende de API externa | Exige credenciais, permissões ou aprovação de terceiros |

**Estado atual: frontend público no Cloudflare e base Supabase ativada.**

Prioridade atual: vitrine pública apenas de Shopee, Amazon e TikTok Shop, separada dos dados pessoais. Implementada a função `catalog-public` com configuração central do aplicativo, sem sessão do visitante e sem leitura de dados privados. A função está publicada, mas testes remotos das três fontes retornaram `catalog_not_configured`; o objetivo de mostrar produtos reais ainda não foi atingido. O visitante não fornecerá chaves. Procedimento e limitações em `CATALOGO_APIS.md`.

**Correção de requisito confirmada pelo responsável:** o catálogo deve ser consultável antes de conectar a conta de qualquer loja. Descoberta de produtos e vinculação do perfil de afiliado são fluxos independentes. O visitante não deverá precisar de App ID/Secret para navegar. O Meu Vendedor deverá obter/configurar seus próprios acessos de catálogo no servidor, somente onde a licença permitir sua exibição aos usuários; a página pública da loja, por si só, não comprova esse direito/API. A vinculação do afiliado deverá usar redirecionamento e consentimento oficial quando disponível. O formulário técnico Shopee atual não atende à experiência desejada e não comprova um fluxo de consentimento para afiliados. OAuth de vendedor não deve ser usado como substituto. O catálogo atual autenticado e condicionado a credenciais por usuário ainda não implementa essa separação.

Correção de publicação concluída: backend `catalog` publicado na versão 1 (OPTIONS 204, POST sem sessão 401) e frontend publicado no Cloudflare na versão `29c743ed-e672-4e98-b059-0213bd9a0ec8`. `/dashboard` apresenta o mesmo catálogo de `/`, confirmado por HTTP 200 e conteúdo público. Credenciais comerciais e testes reais das novas fontes continuam pendentes. Detalhes em `PUBLICACAO.md`.

Atualização do catálogo inicial no código: `/` apresenta oportunidades com seleção de Amazon, Mercado Livre, TikTok Shop, Magalu, Shopee, SHEIN e AliExpress. Reutiliza os produtos Shopee sincronizados e adiciona consultas sob demanda de Amazon, Mercado Livre, TikTok Shop e AliExpress na função `catalog`, já publicadas com o frontend; configuração por usuário e validação comercial real ainda pendentes. Magalu/SHEIN seguem sem contrato de catálogo de afiliados confirmado. Pesquisa oficial e dependências em `CATALOGO_APIS.md`. A inclusão das duas novas plataformas neste catálogo não amplia automaticamente o CRUD de links ou os conectores existentes.
Cadastro/login, perfil e links manuais estão implementados. A migração foi aplicada no projeto `meu-vendedor` e login, persistência e isolamento foram verificados na API hospedada com duas contas temporárias removidas ao final. A entrega de e-mails ainda precisa ser validada. O primeiro conector Shopee foi implementado, condicionado à validação de credenciais reais da conta. As novas consultas de catálogo estão descritas acima; IA e automações comerciais não estão implementadas.

Atualização do módulo de vídeos: `/videos` agora oferece um gerador publicitário completo em modo demonstração, com cadastro/seleção de produto, quatro apresentadores virtuais originais, voz, emoção, estilo, duração, formato, roteiro editável, prévia estática e biblioteca. O mock percorre os estados de geração sem criar MP4 fictício nem consumir créditos. A integração futura foi isolada atrás de um contrato de provedor e de uma Edge Function autenticada; chamadas Google continuam bloqueadas. Contrato atual e fontes oficiais em `VIDEOS_IA.md`.

A situação atual da base está em [`SUPABASE.md`](./SUPABASE.md). A seção 11 registra a ativação; as seções de etapas anteriores preservam o histórico.

---

## 1. Visão geral

### 1.1 Objetivo

O **Meu Vendedor** é um **app web central de interação e gerenciamento de programas de afiliados de múltiplas plataformas**. A intenção confirmada pelo responsável é reunir contas, produtos, links, campanhas e resultados em uma única interface.

O escopo inclui Mercado Livre, Shopee, TikTok/TikTok Shop, **Magazine Luiza** e, progressivamente, outros serviços com programas de afiliados. Cada integração será independente e terá apenas as capacidades oficialmente disponíveis para a conta e região autorizadas. “Todas as plataformas” é a direção de expansão; não significa que exista integração universal ou cobertura automática implementada.

A prioridade atual continua sendo o gerenciamento de afiliados e a base das APIs. O gerador publicitário já funciona em modo demonstração; somente a geração audiovisual real e as automações permanecem como evolução dependente de provedores. A referência ForneceUp serve à apresentação e organização; o produto continua orientado a afiliados.

O detalhamento das páginas e o plano do primeiro ciclo de APIs estão em [`ESCOPO.md`](./ESCOPO.md). As decisões e pendências específicas de integração estão em [`INTEGRACOES.md`](./INTEGRACOES.md).

### 1.2 Público-alvo

- Afiliados iniciantes e intermediários no Brasil, que divulgam produtos de marketplaces.
- Criadores de conteúdo curto (TikTok, Reels, Shorts) que querem profissionalizar a divulgação.
- Pequenas operações que precisam de processo e não têm equipe técnica.

### 1.3 Modelo de negócio de afiliados sem estoque

O afiliado **não compra, armazena nem envia** produtos. Ele divulga produtos de terceiros usando um link
rastreável. Quando uma venda é concluída por esse link, o marketplace paga uma **comissão**. A plataforma
não vende produtos: ela ajuda o afiliado a escolher o que divulgar, produzir o conteúdo e medir o retorno.

```text
Produto (marketplace) → Conteúdo do afiliado → Link rastreável → Compra → Comissão
```

---

## 2. Funcionalidades futuras (módulos)

Todos os módulos abaixo têm rota e navegação. Na Etapa 2, `/contas` recebeu um catálogo informativo com requisitos e documentação oficial; conexões e operações nas lojas continuam planejadas. A conta do Meu Vendedor, perfil e links manuais já usam Supabase.

| # | Módulo | Rota | Descrição | Depende de API externa? |
| --- | --- | --- | --- | --- |
| 1 | Dashboard | `/dashboard` | Visão consolidada: produtos, tendências, vídeos, publicações, cliques e comissões. | Parcial (métricas reais) |
| 2 | Monitoramento de produtos | `/produtos` | Acompanhar preço, avaliações, vendas e comissão de produtos da Shopee e do Mercado Livre. | 🔌 Sim |
| 3 | Radar de tendências | `/tendencias` | Identificar produtos e formatos em alta, principalmente no TikTok. | 🔌 Sim |
| 4 | Ranking Top 10 | `/top-10` | Os dez melhores produtos do dia, com nota e justificativa geradas por IA. | Parcial (IA + dados) |
| 5 | Análise de vídeos | `/videos` | Entender estrutura, gancho e ritmo de vídeos que performam bem. | 🔌 Sim |
| 6 | Criação de vídeos com IA | `/videos` | Roteiros promocionais e vídeos originais gerados por IA. | 🔌 Sim (modelos de IA) |
| 7 | Gerenciamento de afiliados | `/afiliados` | Guardar e organizar links de afiliado por plataforma e produto. | Não (dados próprios) |
| 8 | Publicações | `/publicacoes` | Calendário, fila e histórico de publicações. | 🔌 Sim (publicação) |
| 9 | Automações | `/automacoes` | Regras configuráveis que encadeiam as demais etapas. | Depende dos módulos acima |
| 10 | Relatórios | `/relatorios` | Cliques, vendas e comissões por produto, canal e período. | 🔌 Sim |
| 11 | Contas conectadas | `/contas` | Autorizar e gerenciar conexões com as plataformas. | 🔌 Sim (OAuth/chaves) |
| 12 | Configurações | `/configuracoes` | Preferências do usuário e do sistema. | Não |

> Análise de vídeos e criação de vídeos compartilham a rota `/videos` (menu "Vídeos IA") na Etapa 1.
> Podem ser separadas quando a Etapa correspondente for planejada.

---

## 3. Arquitetura técnica

### 3.1 Princípios

1. **Modular:** cada módulo de negócio é independente e pode ser entregue em etapas.
2. **Integrações atrás de interfaces:** o código de produto nunca chama uma plataforma diretamente; chama um
   "provedor" (provider) com contrato próprio. Trocar ou desligar uma plataforma não afeta o restante.
3. **Honestidade de dados:** nada fictício pode parecer real. Dados demonstrativos são sempre rotulados.
4. **Segredos fora do Git:** credenciais ficam em variáveis de ambiente, nunca no repositório.
5. **Evolução incremental:** uma etapa por vez, com build passando antes de avançar.

### 3.2 Visão em camadas

```text
┌────────────────────────────────────────────────────────────┐
│ NAVEGADOR (Chrome, Edge, Firefox, mobile)                  │
└──────────────────────────────┬─────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼─────────────────────────────┐
│ FRONTEND  Next.js + React + TypeScript + Tailwind  ✅       │
│ Layout, rotas, componentes, tema claro/escuro              │
└──────────────────────────────┬─────────────────────────────┘
                               │ REST/JSON  🟡
┌──────────────────────────────▼─────────────────────────────┐
│ BACKEND  Python + FastAPI  🟡                              │
│ Regras de negócio, autenticação, filas de tarefas          │
├───────────────┬───────────────────────┬────────────────────┤
│ Banco         │ Processamento de IA   │ Integrações        │
│ PostgreSQL 🟡 │ Roteiro, ranking,     │ Shopee, ML, TikTok │
│               │ análise, vídeo 🟡🔌   │ (providers) 🟡🔌   │
└───────────────┴───────────────────────┴────────────────────┘
```

### 3.3 Componentes: implementado × planejado × dependente de API

| Componente | Status | Observações |
| --- | --- | --- |
| Projeto Next.js (App Router) | ✅ Implementado | Etapa 1 |
| Layout: menu lateral, cabeçalho, tema | ✅ Implementado | Tema salvo no navegador (localStorage) |
| Rotas dos 11 itens de menu | ✅ Implementado | Dashboard, catálogo de contas e páginas de módulos futuros |
| Preparação das integrações | ✅ Implementado | Catálogo público, contratos TypeScript, testes e INTEGRACOES.md |
| Dashboard com dados demonstrativos | ✅ Implementado | Dados fictícios, rotulados como tal |
| Autenticação e perfil de usuário | ✅ Implementado | Supabase Auth e perfil protegido por RLS |
| API backend (FastAPI) | 🟡 Planejado | Não existe código de backend |
| Banco PostgreSQL e migrações | ✅ Implementado | Supabase; plataformas, perfis e links manuais com RLS |
| Fila e agendador de tarefas | 🟡 Planejado | Necessário para automações e publicações |
| Provider Shopee | 🔌 Depende de API externa | Requer programa de afiliados/API oficial |
| Provider Mercado Livre | 🔌 Depende de API externa | Requer app registrado e credenciais |
| Provider TikTok / TikTok Shop | 🔌 Depende de API externa | Acesso sujeito a aprovação e escopos |
| Análise com IA (ranking, tendências) | 🔌 Depende de API externa | Modelo local ou serviço de terceiros |
| Geração de vídeo com IA | 🔌 Depende de API externa | Modelo local (exige GPU) ou serviço |
| Publicação em redes sociais | 🔌 Depende de API externa | Apenas por integrações oficiais e autorizadas |

### 3.4 Frontend

- **Next.js (App Router)**: roteamento por pastas, renderização no servidor e build otimizado.
- **Estrutura de pastas** em `src/app` (rotas), `src/components` (layout, dashboard, ui), `src/lib`
  (utilitários e dados demonstrativos) e `src/types`.
- **Navegação** definida em um único arquivo (`src/lib/navigation.ts`), usado pelo menu lateral e pelas páginas.
- **Dados demonstrativos** isolados em `src/lib/demo-data.ts`. Quando houver API real, só esse ponto muda.

### 3.5 Backend (futuro)

- API REST em FastAPI, documentada automaticamente (OpenAPI).
- Módulos espelhando os módulos de produto (`produtos`, `tendencias`, `ranking`, `videos`, `afiliados`,
  `publicacoes`, `automacoes`, `relatorios`, `contas`).
- Tarefas longas (coleta, análise, geração de vídeo) executadas em segundo plano por uma fila.

### 3.6 Banco de dados

PostgreSQL no Supabase com migração versionada e aplicada: `mv_platforms`, `mv_profiles` e `mv_affiliate_links`. Os dados privados são protegidos por RLS. Entidades previstas: usuário, conta conectada, produto, snapshot de
preço, tendência, ranking diário, roteiro, vídeo, link de afiliado, publicação, automação, execução e métrica.
Tokens de acesso de terceiros devem ser armazenados **criptografados**.

### 3.7 Processamento de IA (futuro)

Camada separada do backend, com interface única (`gerar_roteiro`, `pontuar_produto`, `analisar_video`...).
Permite usar modelos open source locais ou serviços externos sem alterar o restante do sistema.

### 3.8 Integrações externas — preparação implementada, providers futuros

`src/types/connectors.ts` define plataforma, capacidades, autorização, sincronização, erros sanitizados,
metadados sem segredos e o contrato `PlatformConnector`. `src/lib/connectors/catalog.ts` registra as quatro
plataformas e o estado não configurado. `/contas` apresenta requisitos e links oficiais; nenhum adaptador,
OAuth, chamada externa ou sincronização foi implementado.

`INTEGRACOES.md` diferencia capacidades documentadas de recursos não confirmados e detalha o desenho
futuro de OAuth, tokens cifrados no servidor, renovação, revogação e checagem de permissões.
Cada provider futuro implementará apenas operações aprovadas para a conta e região, com limites de taxa,
tratamento de erros e testes de contrato. O frontend nunca armazenará credenciais.

---

## 4. Tecnologias

| Tecnologia | Decisão | Motivo |
| --- | --- | --- |
| **Next.js** | ✅ Adotado | Padrão maduro, roteamento por pastas, build otimizado, hospedagem gratuita disponível. |
| **React** | ✅ Adotado | Base do Next.js; grande ecossistema. |
| **TypeScript** | ✅ Adotado | Segurança de tipos; reduz erros conforme o projeto cresce. |
| **Tailwind CSS** | ✅ Adotado | Estilização rápida e consistente; tema claro/escuro simples. |
| **Python + FastAPI** | 🟡 Recomendado para o backend | Ecossistema forte em IA e dados; tipagem e documentação automática. Não instalado na Etapa 1. |
| **PostgreSQL** | 🟡 Recomendado para persistência | Robusto, open source, tem planos gratuitos limitados em vários provedores. Não instalado na Etapa 1. |

**Nesta etapa foi configurado apenas o necessário para o site:** Next.js, React, TypeScript, Tailwind CSS,
ESLint. Ícones: `lucide-react` (open source). Fontes: pilha de fontes do sistema (sem dependência externa).

---

## 5. Integrações futuras

| Plataforma | Uso previsto | Observação |
| --- | --- | --- |
| **Shopee** | Produtos, preços, comissões, links de afiliado | Depende do programa de afiliados e de API oficial disponível para a conta. |
| **TikTok** | Tendências de conteúdo e publicação | Acesso por API oficial exige app aprovado e escopos específicos. |
| **TikTok Shop** | Produtos e afiliação dentro do TikTok | Disponibilidade e regras variam por país e tipo de conta. |
| **Mercado Livre** | Produtos, preços e programa de afiliados | API pública com autenticação OAuth; algumas funções exigem permissão. |
| **Magazine Luiza (Magalu)** | Gerenciamento do programa de afiliados, produtos, links e resultados quando suportados | Incluída no escopo; pesquisa técnica, permissões e conector ainda pendentes. Nenhum recurso de API presumido. |
| **Outras** | Outros programas de afiliados, conforme prioridade do responsável | Avaliar contrato e capacidades de cada programa antes de integrar. |

**Regras para todas as integrações**

- Somente **APIs oficiais e autorizadas**. Sem burlar bloqueios ou violar termos de uso.
- Dependem de **credenciais, permissões e disponibilidade** fornecidas por terceiros; podem mudar ou ser
  descontinuadas.
- Nenhuma credencial é commitada. Usar variáveis de ambiente (`.env.local` está no `.gitignore`).
- Se uma API oficial não existir para um recurso, o recurso **não será simulado**: será documentado como
  indisponível.

---

## 6. Estratégia de custo zero

**Objetivo:** priorizar hospedagem gratuita, bibliotecas open source e nenhuma mensalidade obrigatória.

| Camada | Opção gratuita a avaliar | Limitações a considerar |
| --- | --- | --- |
| Frontend | Vercel (plano Hobby), Cloudflare Pages, Netlify | Planos gratuitos têm limites de banda e builds; algumas regras proíbem uso comercial no plano gratuito (verificar os termos vigentes). |
| Backend | Render, Fly.io, Railway (créditos/planos gratuitos) | Podem "adormecer" por inatividade, ter pouca memória/CPU e mudar a oferta gratuita a qualquer momento. |
| Banco | Supabase, Neon (PostgreSQL) | Limite de armazenamento e conexões; projetos inativos podem ser pausados. |
| IA | Modelos open source locais | Exigem hardware próprio (GPU para vídeo). Serviços de terceiros costumam ser pagos. |
| Código e CI | GitHub e GitHub Actions | Cota mensal de minutos no plano gratuito. |

**Limitações honestas**

- **Não há garantia de operação ilimitada sem custo.** Planos gratuitos mudam, têm cotas e podem não servir
  para uso comercial ou em escala.
- **Geração de vídeo e IA pesada** é o ponto mais provável de gerar custo (computação).
- Toda dependência paga será **opcional**, isolada atrás de um provider e **nunca ativada sem aprovação**.
- Nenhuma hospedagem será contratada nem serviço pago ativado sem decisão explícita do responsável.

---

## 7. Etapas de desenvolvimento (roadmap)

> Cada etapa só começa após instrução explícita. Esta lista é um plano, **não** uma execução.

| Etapa | Escopo | Status |
| --- | --- | --- |
| **1** | Estrutura do site, navegação, dashboard demonstrativo, documentação | ✅ Concluída |
| **2** | Preparação das integrações: Contas Conectadas, contratos TypeScript e documentação de segurança | ✅ Concluída |
| **Base futura** | Backend FastAPI, PostgreSQL, autenticação e armazenamento seguro para conexões | 🟡 Planejada; pré-requisito para integrações reais |
| **3** | Módulo Afiliados (links próprios, sem API externa) com persistência real | 🟡 Planejada |
| **4** | Primeiro provider de produtos (Mercado Livre ou Shopee), conforme credenciais disponíveis | 🟡🔌 Planejada |
| **5** | Monitoramento de produtos: histórico de preço e coleta agendada | 🟡🔌 Planejada |
| **6** | Ranking Top 10 com IA (pontuação e justificativa) | 🟡🔌 Planejada |
| **7** | Radar de tendências (TikTok, conforme acesso à API) | 🟡🔌 Planejada |
| **8** | Roteiros promocionais | ✅ Gerador local editável; IA externa opcional pendente |
| **9** | Geração e análise de vídeo | 🟢 Demonstração concluída; geração real 🔌 pendente |
| **10** | Publicações e contas conectadas (OAuth, fila, agendamento) | 🟡🔌 Planejada |
| **11** | Relatórios de cliques, vendas e comissões | 🟡🔌 Planejada |
| **12** | Automações configuráveis | 🟡 Planejada |

A Etapa 2 foi redefinida por instrução do responsável para preparação das integrações; backend e banco continuam futuros. A Etapa 3 não foi iniciada.

A ordem pode mudar conforme as credenciais e permissões forem sendo obtidas.

---

## 8. Convenções para futuros agentes

- Idioma da interface e da documentação: **português brasileiro**.
- Não implemente funcionalidades fora da etapa em andamento.
- Nunca exiba dado fictício como real; mantenha o selo "Dados demonstrativos".
- Não crie formulários ou botões que aparentem salvar/executar algo que não existe.
- Antes de concluir: `npm run lint`, `npm run typecheck` e `npm run build` devem passar.
- Não commite segredos. Não sobrescreva trabalho existente.

## 9. Registro da Etapa 2

Implementados o catálogo das quatro plataformas em `/contas`, contratos públicos de conectores, testes de invariantes e `INTEGRACOES.md`. Preservados layout, tema, dashboard demonstrativo e demais módulos. Sem login externo, consultas de API, monitoramento, vídeos ou automações. Validação da entrega: 3 testes do catálogo, ESLint e TypeScript aprovados; build de produção aprovado com `npm run build -- --webpack`. O Turbopack encontrou bloqueio de porta local pelo ambiente. Detalhes em `INTEGRACOES.md`.

## 10. Intenção confirmada e preparação do primeiro ciclo de APIs

Em 04/11/2026, o responsável confirmou que o produto deve centralizar o gerenciamento de afiliados de Mercado Livre, TikTok/TikTok Shop, Shopee, Magazine Luiza e outras plataformas. O escopo de cada página foi consolidado em `ESCOPO.md`. Magazine Luiza está planejada; o catálogo TypeScript e `/contas` continuam com as quatro plataformas da Etapa 2.

A arquitetura já pode orientar o início do processo de APIs: primeiro a API interna, autenticação própria e banco; depois gerenciamento persistente e segurança das conexões; por fim um conector externo de leitura com acesso legítimo. Não há backend nem integração real implementados neste momento. A primeira plataforma será definida pela disponibilidade de acesso oficial e aprovação da conta, não por suposição de que qualquer API de marketplace atende afiliados.

Entidades adicionais planejadas: `Platform` (identificação e capacidades), `Campaign` (organização de links), `CredentialRecord` (credenciais cifradas, exclusivamente no servidor) e `SyncRun` (tentativa, resultado e erro sanitizado). `Connection` pertence a um usuário; `AffiliateLink` mantém plataforma e origem; métricas preservam fonte, período e horário de coleta. A interface pública de conexão não inclui credenciais. Modelos e migrações ainda serão implementados.

O sistema deverá permitir adicionar conectores sem acoplar regras de uma plataforma às demais. Permissões e capacidades concedidas serão verificadas no servidor. Cadastro manual futuro de links não poderá ser exibido como conexão automática. As rotas e os contratos de API interna serão definidos na implementação da base, sem inventar endpoints de terceiros neste documento.

### 10.1 Prioridade do catálogo básico

Por orientação do responsável, construir o básico e disponibilizar o site para análise não depende de ele já possuir contas de afiliado. O catálogo poderá incluir as plataformas planejadas com links oficiais verificados para entrar ou solicitar afiliação, distinguindo esses acessos externos da conexão real ao Meu Vendedor. A disponibilidade de APIs será tratada posteriormente, por recurso. Esta decisão não declara novas lojas ou ações como implementadas na interface atual.

### 10.2 Escopo básico e projeto Supabase informado

O responsável limitou a primeira versão a Shopee, TikTok, Mercado Livre, Amazon e Magazine Luiza. Outras plataformas ficam para expansão posterior. Esta definição é de escopo; a interface publicada ainda corresponde à versão 1 descrita em `PUBLICACAO.md`.

O responsável informou já ter criado `meu-vendedor` no Supabase. Planeja-se usar esse projeto para banco e autenticação, após autorização e identificação inequívoca do projeto. Não há conexão, migração ou mudança de backend implementada por este registro. A necessidade de um backend FastAPI separado será reavaliada quando forem definidas as operações que Supabase Auth, PostgreSQL e funções de servidor atenderão. O endereço de visualização do site não fornece acesso ao Supabase.

### 10.3 Preparação para Cloudflare Pages

Adicionado `npm run build:pages`, com exportação estática condicional em `next.config.ts` e saída `out`; Node.js 24 definido em `.node-version`. O build padrão permanece disponível. A vinculação de `warllemedicao/Meu-Vendedor` ao Pages deverá ser autorizada pelo proprietário nas contas Cloudflare/GitHub. O procedimento e os valores do painel estão em `CLOUDFLARE.md`; a preparação do repositório não comprova criação do projeto nem publicação no Cloudflare.

### 10.4 Cloudflare Workers confirmado

Após autorização OAuth do responsável, foi localizado o Worker existente `meu-vendedor` e confirmado o frontend público com respostas HTTP 200 nas páginas principais. Não foi necessário recriar ou sobrescrever o serviço. A consulta à API Workers Builds retornou 403; o vínculo automático com GitHub permanece não confirmado. O endereço e a versão consultada estão em `PUBLICACAO.md`. A preparação anterior para Pages permanece uma alternativa, não uma exigência de migração.

## 11. Base Supabase e catálogo básico

Implementados o cliente oficial Supabase, telas de conta e recuperação de senha, perfil e CRUD de links manuais. O catálogo agora tem somente Shopee, TikTok (com orientação TikTok Shop), Mercado Livre, Amazon e Magazine Luiza, com redirecionamento oficial para acesso/afiliação. Não existe login nas lojas dentro do aplicativo.

A arquitetura desta base é navegador/Next.js → Supabase Auth e Data API → PostgreSQL com RLS. Projeto autorizado: `meu-vendedor` (`jzchlrvxdaffnrgbvabv`). O frontend continua publicável no Worker existente com exportação estática. FastAPI não é requisito para este CRUD; permanece uma possibilidade futura para processamento especializado. O arquivo `wrangler.jsonc` descreve o Worker e seus assets, sem credenciais.

A migração cria `mv_platforms`, `mv_profiles` e `mv_affiliate_links`, com isolamento por usuário e privilégios limitados por coluna. Foi testada em PostgreSQL local via PGlite, incluindo bloqueio de acessos indevidos. As chaves administrativas e futuras credenciais de lojas não passam pelo cliente. A sessão do próprio app é gerida pelo SDK Supabase.

Ativação remota concluída: migração `20261104000100` aplicada e registrada; URLs de Auth e senha mínima configuradas. Login, perfis e CRUD foram testados por API com duas contas temporárias e isolamento entre usuários. As contas de teste foram removidas. Confirmação/recuperação de e-mail têm fluxo implementado, mas a entrega de mensagens não foi testada. Procedimento e limites em `SUPABASE.md`.

## 12. Experiência unificada de conexão e sincronização

O objetivo confirmado é o usuário conectar cada plataforma ao Meu Vendedor e consultar seus dados no painel, sem precisar abrir a loja para cada consulta. Os acessos externos atuais são apenas a etapa básica de cadastro/afiliação. O login do Meu Vendedor não autoriza as lojas automaticamente.

A arquitetura deverá expor uma API interna única, implementada por adaptadores próprios de cada plataforma. Cada adaptador define autorização oficial, capacidades, consultas, limites, erros e revogação. OAuth deve ser usado onde estiver oficialmente disponível; credenciais específicas são necessárias onde esse for o contrato. Uma integração só aparecerá conectada depois de validação real, e só exibirá os dados permitidos por sua API.

O Explorer oficial brasileiro Shopee foi confirmado e os resultados estão em `INTEGRACOES.md`. Ainda não foi comprovado OAuth delegado para o afiliado Shopee nem um provedor externo universal que cubra as cinco lojas com todos os dados. A análise não implementou conexão comercial nem mudou o estado das contas para conectado.

Antes da primeira conexão real: adicionar backend de integração (por exemplo, função Supabase ou Worker com runtime de servidor), armazenamento cifrado de credenciais com chave fora das tabelas públicas e checagem de usuário/capacidades em cada operação. O frontend estático nunca assinará requisições com segredos. O banco atual atende contas do Meu Vendedor e links manuais; tabelas de conexões, sincronizações e métricas serão criadas na etapa correspondente.

## 13. Definição de produto: central única de operação de afiliados

**Diretriz confirmada pelo responsável e registrada antes de novas alterações na aplicação.** Esta seção detalha a experiência desejada. Os itens abaixo são requisitos de evolução; não representam funcionalidades de sincronização já entregues.

### 13.1 Significado de “API universal” neste projeto

“Universal” significa um **padrão único de uso no Meu Vendedor**: conectar as contas das plataformas, consultar os produtos disponíveis para divulgação, analisar suas informações, gerar/compartilhar links e acompanhar os resultados em um único local. O usuário não deverá precisar abrir os painéis de cada plataforma para tarefas que a integração já consiga executar.

O escopo inicial continua sendo Shopee, TikTok/TikTok Shop, Mercado Livre, Amazon e Magazine Luiza. Cada plataforma terá autorização e conector próprios por trás da experiência comum. O Meu Vendedor apresentará um catálogo e uma operação consolidados, respeitando as capacidades liberadas para cada conta.

### 13.2 Jornada desejada

1. O usuário entra na sua conta do Meu Vendedor e escolhe a plataforma que deseja conectar.
2. Quando houver autorização delegada oficial, é encaminhado à plataforma para entrar e conceder acesso ao aplicativo; após a autorização, retorna ao Meu Vendedor. Quando o contrato exigir credenciais específicas de API, será necessário um fluxo seguro de conexão compatível com esse mecanismo. Não pressupor login delegado em plataformas onde ele não foi confirmado.
3. O backend valida a autorização, associa a conexão ao usuário e inicia a primeira sincronização. O estado “conectado” só é exibido após validação real.
4. O catálogo do Meu Vendedor mostra os produtos disponibilizados pela integração, com filtros por plataforma, categoria e outras informações efetivamente recebidas. A lista é atualizada em segundo plano dentro dos limites da fonte.
5. Ao selecionar um produto, o usuário consulta sua ficha dentro do Meu Vendedor, sem abrir a página externa apenas para obter os dados que a API já fornece.
6. Na mesma ficha, escolhe divulgar o produto. Onde a API permitir, o backend gera o link rastreável vinculado à conta afiliada correta; o usuário pode copiar ou compartilhar esse link pelo Meu Vendedor.
7. O painel consolida os resultados disponíveis de cada conta, mantendo plataforma, período, situação e horário de atualização identificados. Autorizações expiradas ou revogadas exigem recuperação ou nova autorização.

### 13.3 Catálogo atualizado e produtos mais vendidos

O requisito de produto é permitir descobrir oportunidades e produtos com bom desempenho em cada plataforma, incluindo uma área de mais vendidos quando houver fonte adequada.

Para apresentar “mais vendidos da Shopee” como ranking da plataforma, o conector deverá confirmar uma fonte oficial que ofereça esse ranking e seu período/abrangência. Uma lista de ofertas elegíveis ou a ordenação por vendas de um conjunto recebido não pode ser apresentada como o ranking global de todo o marketplace.

Quando apenas um subconjunto estiver disponível, a interface deverá identificá-lo, por exemplo como “Mais vendidos entre os produtos disponíveis nesta integração”. Se não houver dados suficientes, informar a indisponibilidade, sem inventar classificação. A sincronização não pressupõe acesso a todo o catálogo, todos os dados ou atualização em tempo real.

### 13.4 Ficha de produto dentro do Meu Vendedor

A experiência desejada reúne, conforme disponibilidade oficial: nome, imagens, descrição, preço, promoção, variações, avaliações, quantidade vendida ou indicador de desempenho, vendedor/loja, elegibilidade para divulgação, comissão estimada e link de afiliado.

Cada campo dependerá do contrato da API. Campos ausentes, desatualizados ou não permitidos serão identificados; não preencher lacunas com valores fictícios. A comissão estimada deve ser distinguida da comissão efetivamente validada/paga. Estoque, frete, prazo e preço final podem depender do comprador e do checkout; não prometer equivalência completa com a página original.

A intenção é oferecer as informações necessárias à decisão de divulgação dentro do painel, com origem e data de atualização. A compra e a confirmação final das condições continuam no ambiente da plataforma responsável.

### 13.5 Divulgação, vitrine e resultados

Gerar/copiar/compartilhar um link de afiliado é uma ação própria. Adicionar o produto a uma vitrine da plataforma, criar anúncio, publicar em rede social ou alterar uma oferta são capacidades separadas, que só serão oferecidas quando houver API, autorização e implementação específicas.

O link deve preservar a atribuição ao usuário conectado; não substituir seu identificador por credenciais ou tags de outra conta. A interface só confirma geração ou publicação após o retorno correspondente do serviço. O programa oficial continua responsável por regras, validação de vendas e pagamento das comissões.

Os termos “ofertar” e “revender”, neste escopo, referem-se à divulgação como afiliado. Não introduzem automaticamente operação de vendedor, estoque próprio, faturamento ou logística.

### 13.6 Consequências técnicas e sequência

A próxima evolução deverá priorizar uma conexão real de ponta a ponta, começando pelo contrato documentado da Shopee: autorização válida → consulta autorizada → persistência de dados permitidos → ficha de produto → geração de link, onde suportada. A documentação do Explorer é evidência do contrato, mas não comprova liberação para uma conta específica.

Serão necessárias estruturas para conexões por usuário, credenciais cifradas acessíveis apenas ao backend, produtos com identificadores externos, elegibilidade/links por conta, histórico de sincronizações e métricas com origem. Dados pessoais de cada usuário e resultados de afiliados continuarão isolados por autorização e RLS. Produtos públicos só poderão ser compartilhados entre usuários conforme licença e condições da fonte; links e resultados pessoais nunca serão misturados.

O backend fará assinatura de requisições, normalização, paginação, controle de limites, atualização periódica e tratamento de falhas. A interface mostrará estados de primeira sincronização, última atualização, autorização expirada e erro, sem apresentar dados antigos como atuais. As próximas plataformas seguirão o mesmo padrão visual e funcional, com diferenças técnicas encapsuladas nos conectores.

Nesta atualização foi alterada somente a arquitetura. Não foram implementadas novas chamadas a APIs de lojas, conexões, rankings, vitrines ou publicação automática.

## 14. Implementação do primeiro conector — Shopee

A primeira integração comercial foi implementada no código e o backend foi publicado na função Supabase `marketplace`. Foram adicionados armazenamento cifrado de credenciais com AES-256-GCM, metadados de conexão, catálogo por usuário, histórico de sincronização, bloqueio de operações e geração de link atômica com salvamento em Meus links. A migração `20261104000200` foi aplicada no projeto correto.

O frontend apresenta conexão por App ID/Secret, produtos com ficha e geração/cópia/compartilhamento de links. Não recebe senha da loja e não simula login delegado. O Worker ganha cron de 30 minutos para processar, inicialmente, até duas contas validadas por execução. O contrato consulta até 60 ofertas, não o catálogo inteiro ou o ranking global.

As regras de RLS e RPCs impedem usuários de ler credenciais, alterar o estado da conexão ou acessar produtos de outros usuários. Toda operação privada valida a sessão com Supabase Auth; o agendador usa segredo próprio. Nenhum segredo comercial é incluído no frontend.

A implementação continua condicionada a credenciais e liberação reais da Open API. Não foi comprovada uma conexão de conta Shopee real nesta execução; testes controlados não são dados de produção. TikTok, Mercado Livre, Amazon e Magazine Luiza permanecem em preparação por requisitos específicos de API/aplicativo. Limites, fontes, segurança e verificações em `CONECTORES.md`.
