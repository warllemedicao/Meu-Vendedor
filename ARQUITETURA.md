# ARQUITETURA — Meu Vendedor (Viral Commerce AI)

> Documento de referência principal para qualquer pessoa ou agente que trabalhe no projeto.
> Atualize-o sempre que uma etapa for concluída ou uma decisão técnica mudar.

**Legenda de status usada em todo o documento**

| Status | Significado |
| --- | --- |
| ✅ Implementado | Existe no código e foi testado |
| 🟡 Planejado | Decidido, ainda não escrito |
| 🔌 Depende de API externa | Exige credenciais, permissões ou aprovação de terceiros |

**Estado atual: frontend público no Cloudflare; base Supabase implementada no código, com ativação remota pendente de autorização.**
Cadastro/login, perfil e links manuais foram preparados e a migração foi testada localmente. Não há conexão real com APIs das lojas, IA ou automações. A aplicação da migração e a configuração do projeto Supabase hospedado ainda não foram confirmadas.

A situação atual da base está em [`SUPABASE.md`](./SUPABASE.md). As seções históricas abaixo registram as etapas anteriores; a seção 11 descreve a implementação atual.

---

## 1. Visão geral

### 1.1 Objetivo

O **Meu Vendedor** é um **app web central de interação e gerenciamento de programas de afiliados de múltiplas plataformas**. A intenção confirmada pelo responsável é reunir contas, produtos, links, campanhas e resultados em uma única interface.

O escopo inclui Mercado Livre, Shopee, TikTok/TikTok Shop, **Magazine Luiza** e, progressivamente, outros serviços com programas de afiliados. Cada integração será independente e terá apenas as capacidades oficialmente disponíveis para a conta e região autorizadas. “Todas as plataformas” é a direção de expansão; não significa que exista integração universal ou cobertura automática implementada.

A prioridade atual é o gerenciamento de afiliados e a base das APIs. Inteligência artificial, produção de vídeos e automações permanecem como evolução posterior. A referência ForneceUp serve à apresentação e organização; o produto continua orientado a afiliados.

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

Todos os módulos abaixo têm rota e navegação. Na Etapa 2, `/contas` recebeu um catálogo informativo com requisitos e documentação oficial; conexões e operações de negócio continuam planejadas.

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
| Autenticação e perfil de usuário | 🟡 Planejado | Cabeçalho tem apenas área reservada |
| API backend (FastAPI) | 🟡 Planejado | Não existe código de backend |
| Banco PostgreSQL e migrações | 🟡 Planejado | Nenhuma persistência hoje |
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

### 3.6 Banco de dados (futuro)

PostgreSQL com migrações versionadas. Entidades previstas: usuário, conta conectada, produto, snapshot de
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
| **8** | Roteiros promocionais com IA | 🟡🔌 Planejada |
| **9** | Geração e análise de vídeo | 🟡🔌 Planejada |
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

A arquitetura desta base é navegador/Next.js → Supabase Auth e Data API → PostgreSQL com RLS. O frontend continua publicável no Worker existente com exportação estática. FastAPI não é requisito para este CRUD; permanece uma possibilidade futura para processamento especializado. O arquivo `wrangler.jsonc` descreve o Worker e seus assets, sem credenciais.

A migração cria `mv_platforms`, `mv_profiles` e `mv_affiliate_links`, com isolamento por usuário e privilégios limitados por coluna. Foi testada em PostgreSQL local via PGlite, incluindo bloqueio de acessos indevidos. As chaves administrativas e futuras credenciais de lojas não passam pelo cliente. A sessão do próprio app é gerida pelo SDK Supabase.

A implementação não implica aplicação remota: a autorização Supabase ainda precisa ser concluída, o projeto informado precisa ser identificado e a migração/configuração precisam ser aplicadas e testadas antes de declarar a persistência ativa. Procedimento em `SUPABASE.md`.
