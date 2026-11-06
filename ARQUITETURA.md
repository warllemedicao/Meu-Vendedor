# ARQUITETURA — Meu Vendedor (Viral Commerce AI)

> **Política vigente — créditos da conta, 06/11/2026:** por solicitação explícita do responsável, o runtime não exige comprovação prévia de gratuidade, orçamento local em USD ou ativação de cotas administrativas para tentar as APIs integradas. Usa saldo quando consultável e permite tentativa quando ele é desconhecido, com fallback e espera automática. O fornecedor pode cobrar conforme o plano da conta. Estado e instruções em [CREDITOS_DA_CONTA.md](./CREDITOS_DA_CONTA.md). Este registro substitui as políticas free-only e os bloqueios históricos abaixo.

> **Teste no app — 06/11/2026:** diagnóstico autenticado de cotas de imagem/vídeo adicionado ao estúdio, com atualização sem inferência. Sem cota elegível, o botão informa “Salvar pedido na fila”; não indica geração imediata. Nenhuma geração real foi enviada nesta revisão, nenhum teste de API foi concluído e nenhuma cota foi ativada. Guia e impedimentos atuais em [TESTE_NO_APP.md](./TESTE_NO_APP.md). Este registro prevalece sobre instruções históricas abaixo.

> **Auditoria atual — 06/11/2026:** token Cloudflare Billing Read validado; falha real do cron corrigida e execução autenticada confirmada. Auditoria privada e horária das contas implantada. Magic Hour informou plano free e 500 créditos agregados; as franquias gratuitas de imagem/vídeo e o bloqueio de cobrança ainda precisam de comprovação. Nenhum vídeo real foi gerado. Estado completo e pendências em [AUDITORIA_IA.md](./AUDITORIA_IA.md); este registro prevalece sobre estados e versões históricos abaixo.

> **Política vigente — somente gratuito, 06/11/2026:** modo `free-only` implementado e publicado no Supabase, sem teto diário de pedidos do aplicativo. Fallback automático entre opções compatíveis, reservas atômicas de cotas gratuitas, espera/retomada com etapas preservadas e renovação apenas de franquias periódicas comprovadas. Rotas pagas ou desconhecidas são bloqueadas. As cotas de imagem/vídeo ainda não têm comprovação de gratuidade registrada; pedidos podem aguardar por isso. Instruções e limites reais em [MODO_GRATUITO.md](./MODO_GRATUITO.md). Este bloco substitui as instruções históricas de ativar geração paga abaixo.

> **Atualização do estúdio — 06/11/2026:** interface em três áreas e etapas; fallback de roteiro Gemini/Groq/OpenRouter; correções de retomada, finalização e fallback de vídeo; cache privado de referências/composição e capacidade técnica acima de 15 entregas/dia. Migração `20261106022136_video_production_cache.sql` aplicada ao Supabase. Runtime confirmou credenciais dos serviços, mas flags de geração, allowlist, limites e conversão Magic Hour estão ausentes/desligados. Geração real ainda não foi executada. Pendências exatas e estado atual em [VIDEOS_IA.md](./VIDEOS_IA.md). Este bloco prevalece sobre o histórico abaixo.

> **Revisão autenticada — 06/11/2026:** Revalidação autenticada do Supabase concluída: 15 tabelas com RLS, seis migrações e cinco funções ativas. Oito índices de chaves estrangeiras adicionados e verificados. Acesso Shopee informado pelo responsável, mas sem credencial cadastrada/validada; catálogo público retorna `catalog_not_configured`. Geração real e integrações externas continuam dependentes de configuração. Estado vigente em [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md). Este bloco prevalece sobre os registros anteriores de falta de acesso ou versões históricas abaixo.

> Documento de referência principal para qualquer pessoa ou agente que trabalhe no projeto.
> Atualize-o sempre que uma etapa for concluída ou uma decisão técnica mudar.

**Legenda de status usada em todo o documento**

| Status | Significado |
| --- | --- |
| ✅ Implementado | Existe no código e foi testado localmente; não implica disponibilidade comercial em produção |
| 🟡 Planejado | Decidido, ainda não escrito |
| 🔌 Depende de API externa | Exige credenciais, permissões ou aprovação de terceiros |

**Estado verificado em 06/11/2026:** frontend público e Worker `meu-vendedor` na versão `0f4bd14d-0c3d-48cd-88a9-734e5ce19736`; crons de vídeo e marketplace configurados. `/videos` retorna HTTP 200. A API de analytics não retornou invocações agendadas desde a publicação, portanto a execução do cron não está comprovada. A última validação remota Supabase registrada informa `video-generation-worker` versão 3 e `processor_disabled` com autenticação válida; não foi possível revalidar flags ou Secrets do Supabase nesta revisão. Nenhuma geração real foi executada. Veja `CONTINUAR_AMANHA.md`.

O catálogo público `catalog-public` continua dependente de configuração comercial permitida. O último estado remoto registrado retornou `catalog_not_configured`; o Supabase não pôde ser reconsultado nesta revisão. O visitante não deve fornecer chaves. A separação entre descoberta pública e contas privadas permanece requisito de produto. Procedimento e limitações em `CATALOGO_APIS.md`.

**Correção de requisito confirmada pelo responsável:** o catálogo deve ser consultável antes de conectar a conta de qualquer loja. Descoberta de produtos e vinculação do perfil de afiliado são fluxos independentes. O Meu Vendedor deverá obter/configurar seus próprios acessos de catálogo no servidor, somente onde a licença permitir sua exibição aos usuários. OAuth de vendedor não deve ser usado como substituto de autorização de afiliado.

O catálogo em `/` apresenta seleção de Amazon, Mercado Livre, TikTok Shop, Magalu, Shopee, SHEIN e AliExpress. A função `catalog` implementa consultas para Amazon, Mercado Livre, TikTok Shop e AliExpress; configuração por usuário e validação comercial real continuam pendentes. Magalu/SHEIN seguem sem contrato de catálogo de afiliados confirmado. A inclusão no catálogo não amplia automaticamente o CRUD de links ou os conectores existentes.

Cadastro/login, perfil, links manuais e biblioteca de vídeos estão implementados. Cinco migrações versionadas existem no repositório; as últimas migrações de vídeo constam como aplicadas nos registros anteriores, sem revalidação Supabase nesta sessão. O conector Shopee requer credenciais comerciais reais. O pipeline de vídeo assíncrono está implementado, mas seu uso pago está bloqueado por autorização/configuração pendente. A entrega de e-mails ainda precisa ser validada.

`/videos` oferece configuração de produto, apresentadores, voz, emoção, estilo, duração, formato, roteiro editável, prévia e biblioteca. O pipeline inclui fila, worker, reserva orçamentária, polling, validação e armazenamento privado. Cloudflare Workers AI compõe a imagem de referência; Magic Hour e Replicate são adaptadores image-to-video. Testes simulados cobrem o fallback, mas não comprovam credenciais, saldo, direitos comerciais, qualidade ou execução real. O mock e o MP4 local são demonstrações sem IA. Contratos e bloqueios em `VIDEOS_IA.md`.

A situação atual da base está em [`SUPABASE.md`](./SUPABASE.md). Seções antigas abaixo que descrevem etapas anteriores devem ser lidas como histórico, não como estado de produção vigente.

---

## 1. Visão geral

### 1.1 Objetivo

O **Meu Vendedor** é um **app web central de interação e gerenciamento de programas de afiliados de múltiplas plataformas**. A intenção confirmada pelo responsável é reunir contas, produtos, links, campanhas e resultados em uma única interface.

O escopo inclui Mercado Livre, Shopee, TikTok/TikTok Shop, **Magazine Luiza** e, progressivamente, outros serviços com programas de afiliados. Cada integração será independente e terá apenas as capacidades oficialmente disponíveis para a conta e região autorizadas. “Todas as plataformas” é a direção de expansão; não significa que exista integração universal ou cobertura automática implementada.

A prioridade do produto continua sendo o gerenciamento de afiliados e a base das APIs. O pipeline de geração audiovisual está implementado, mas não é operacional para geração paga até revalidar configuração, licenças comerciais, créditos e limites. Automação/publicação em redes sociais permanecem pendentes. A referência ForneceUp serve à apresentação e organização; o produto continua orientado a afiliados.

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

## 2. Módulos do produto

Todos os módulos abaixo têm rota e navegação. Conta, perfil, links, conexão Shopee e biblioteca de vídeos usam Supabase. As integrações comerciais permanecem condicionadas às permissões e credenciais de cada plataforma.

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
                               │ REST/JSON  ✅
┌──────────────────────────────▼─────────────────────────────┐
│ BACKEND  Supabase Edge Functions + Worker  ✅              │
│ Auth, conectores, catálogo e contratos de vídeo            │
├───────────────┬───────────────────────┬────────────────────┤
│ Banco         │ Processamento de IA           │ Integrações      │
│ PostgreSQL ✅ │ fila + worker ✅ / IA real 🔌  │ Shopee ✅/🔌     │
│ RLS e dados   │ fallback simulado ✅          │ outros 🔌        │
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
| Backend | ✅ Implementado parcialmente | Supabase Edge Functions para marketplace, catálogos e vídeo; FastAPI não é requisito atual |
| Banco PostgreSQL e migrações | ✅ Implementado | Supabase; cinco migrações versionadas no repositório, tabelas privadas e RLS |
| Agendador de tarefas | ✅ Implementado; execução pendente de observação | Crons Cloudflare de vídeo por minuto e marketplace a cada 30 min; analytics sem registro pós-publicação nesta revisão |
| Provider Shopee | ✅ Implementado / 🔌 ativação | Código publicado; requer credencial real aprovada para sucesso comercial |
| Provider Mercado Livre | 🔌 Depende de API externa | Requer app registrado e credenciais |
| Provider TikTok / TikTok Shop | 🔌 Depende de API externa | Acesso sujeito a aprovação e escopos |
| Análise com IA (ranking, tendências) | 🔌 Depende de API externa | Modelo local ou serviço de terceiros |
| Gerador de vídeos | ✅ Pipeline implementado / 🔌 geração real | Fila, Edge Functions, Cloudflare Workers AI, Magic Hour e Replicate; credenciais, direitos, créditos, limites e execução comercial não confirmados |
| Publicação em redes sociais | 🔌 Depende de API externa | Apenas por integrações oficiais e autorizadas |

### 3.4 Frontend

- **Next.js (App Router)**: roteamento por pastas, renderização no servidor e build otimizado.
- **Estrutura de pastas** em `src/app` (rotas), `src/components` (layout, dashboard, ui), `src/lib`
  (utilitários e dados demonstrativos) e `src/types`.
- **Navegação** definida em um único arquivo (`src/lib/navigation.ts`), usado pelo menu lateral e pelas páginas.
- **Dados demonstrativos** isolados em `src/lib/demo-data.ts`. Quando houver API real, só esse ponto muda.

### 3.5 Backend

- Supabase Edge Functions implementam marketplace, catálogos e a fila/processador assíncrono de vídeo.
- O Cloudflare Worker serve os assets e tem crons separados para marketplace e processamento de vídeo.
- FastAPI permanece opcional para processamento especializado futuro.
- Jobs usam claim/lease, idempotência, retomada de polling, cancelamento e reservas de orçamento; o scheduler remoto não teve invocações observadas na consulta atual.

### 3.6 Banco de dados

PostgreSQL no Supabase com cinco migrações versionadas no repositório. As últimas migrações de workflow/processor constam como aplicadas em registros remotos anteriores; não houve revalidação do banco nesta sessão. Além de plataformas, perfis e links, existem conexões e segredos cifrados, produtos, sincronizações, links gerados, bloqueios, jobs, tentativas e reservas de orçamento. Os dados privados são protegidos por RLS; credenciais externas ficam no backend.

### 3.7 Processamento de IA

Roteiro publicitário local, demonstração e pipeline audiovisual desacoplado estão implementados. Workers AI gera a imagem de referência; Magic Hour e Replicate são provedores de vídeo. Gemini é usado separadamente para roteiro. O roteador tenta outro provedor somente após falha confirmada e se ele for compatível, autorizado, configurado e dentro do orçamento; falta de créditos confirmada permite fallback. Submissão ambígua não é repetida. Testes são simulados e não autorizam cobranças. Ranking, tendências e análise de vídeo continuam futuros.

### 3.8 Integrações externas

`src/types/connectors.ts` define plataforma, capacidades, autorização, sincronização e erros sanitizados. O conector Shopee e os adaptadores de catálogo estão implementados no backend. `/contas` apresenta requisitos e estados reais; nenhuma integração aparece conectada sem validação do provedor.

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
| **PostgreSQL** | ✅ Adotado via Supabase | Migrações, RLS, autenticação e persistência em produção. |

O projeto também usa Supabase JS, Edge Functions, PostgreSQL/RLS, Wrangler, testes Node.js e PGlite. Ícones: `lucide-react` (open source). Fontes: pilha de fontes do sistema.

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
| **Base** | Supabase Auth, PostgreSQL, RLS, Edge Functions e armazenamento seguro | ✅ Concluída; FastAPI opcional |
| **3** | Módulo Afiliados (links próprios, sem API externa) com persistência real | ✅ Concluída |
| **4** | Primeiro provider de produtos: Shopee | ✅ Código publicado; 🔌 validação comercial pendente |
| **5** | Monitoramento de produtos: histórico de preço e coleta agendada | 🟡🔌 Planejada |
| **6** | Ranking Top 10 com IA (pontuação e justificativa) | 🟡🔌 Planejada |
| **7** | Radar de tendências (TikTok, conforme acesso à API) | 🟡🔌 Planejada |
| **8** | Roteiros promocionais | ✅ Gerador local editável; IA externa opcional pendente |
| **9** | Geração e análise de vídeo | 🟢 Demonstração concluída; geração real 🔌 pendente |
| **10** | Publicações e contas conectadas (OAuth, fila, agendamento) | 🟡🔌 Planejada |
| **11** | Relatórios de cliques, vendas e comissões | 🟡🔌 Planejada |
| **12** | Automações configuráveis | 🟡 Planejada |

As etapas 3 e 4 avançaram por instruções posteriores. O roadmap registra o estado técnico atual; ativações comerciais continuam dependentes de autorização externa.

A ordem pode mudar conforme as credenciais e permissões forem sendo obtidas.

---

## 8. Convenções para futuros agentes

- Idioma da interface e da documentação: **português brasileiro**.
- Não implemente funcionalidades fora da etapa em andamento.
- Nunca exiba dado fictício como real; mantenha o selo "Dados demonstrativos".
- Não crie formulários ou botões que aparentem salvar/executar algo que não existe.
- Antes de concluir: `npm run lint`, `npm run typecheck` e `npm run build` devem passar.
- Não commite segredos. Não sobrescreva trabalho existente.

## 9. Registro histórico da Etapa 2

> Esta seção retrata o encerramento da Etapa 2 em 04/11/2026. Afirmações como “sem backend” ou “sem vídeos” descrevem aquele momento e foram superadas pelas seções atuais no início do documento.

Implementados o catálogo das quatro plataformas em `/contas`, contratos públicos de conectores, testes de invariantes e `INTEGRACOES.md`. Preservados layout, tema, dashboard demonstrativo e demais módulos. Sem login externo, consultas de API, monitoramento, vídeos ou automações. Validação da entrega: 3 testes do catálogo, ESLint e TypeScript aprovados; build de produção aprovado com `npm run build -- --webpack`. O Turbopack encontrou bloqueio de porta local pelo ambiente. Detalhes em `INTEGRACOES.md`.

## 10. Registro histórico da preparação do primeiro ciclo de APIs

> Os itens desta seção registram decisões anteriores à ativação do Supabase, dos conectores e do gerador de vídeos. O estado vigente está nas seções 1 a 7 e nos documentos especializados.

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

Implementados o cliente oficial Supabase, telas de conta e recuperação de senha, perfil, CRUD de links manuais, conexão Shopee e biblioteca de vídeos. O catálogo informativo cobre as plataformas do escopo; a vitrine pública prioriza Shopee, Amazon e TikTok Shop. O aplicativo não solicita a senha das lojas.

A arquitetura desta base é navegador/Next.js → Supabase Auth e Data API → PostgreSQL com RLS. Projeto autorizado: `meu-vendedor` (`jzchlrvxdaffnrgbvabv`). O frontend continua publicável no Worker existente com exportação estática. FastAPI não é requisito para este CRUD; permanece uma possibilidade futura para processamento especializado. O arquivo `wrangler.jsonc` descreve o Worker e seus assets, sem credenciais.

Cinco migrações versionadas criam a base de afiliados, conexões/segredos/produtos, workflow e processamento de vídeo. O isolamento por usuário e os privilégios foram testados em PostgreSQL local via PGlite. Chaves administrativas e credenciais de lojas não passam pelo cliente. A sessão do próprio app é gerida pelo SDK Supabase.

Registros remotos anteriores confirmam as migrações `20261104000100`, `20261104000200`, `20261105151156`, `20261105172000` e `20261105225000`; essa situação não foi revalidada nesta sessão. URLs de Auth e senha mínima foram configuradas anteriormente. Login, perfis e CRUD foram testados por API com duas contas temporárias e isolamento entre usuários; as contas de teste foram removidas. Confirmação/recuperação de e-mail têm fluxo implementado, mas a entrega de mensagens não foi testada. Procedimento e limites em `SUPABASE.md`.

## 12. Experiência unificada de conexão e sincronização

O objetivo confirmado é o usuário conectar cada plataforma ao Meu Vendedor e consultar seus dados no painel, sem precisar abrir a loja para cada consulta. Os acessos externos atuais são apenas a etapa básica de cadastro/afiliação. O login do Meu Vendedor não autoriza as lojas automaticamente.

A arquitetura expõe contratos internos implementados por adaptadores próprios de cada plataforma. Cada adaptador define autorização oficial, capacidades, consultas, limites, erros e revogação. OAuth deve ser usado onde estiver oficialmente disponível; credenciais específicas são necessárias onde esse for o contrato. Uma integração só aparece conectada depois de validação real e só exibe os dados permitidos por sua API.

O Explorer oficial brasileiro Shopee foi confirmado e o conector correspondente foi implementado. Ainda não foi comprovado OAuth delegado para o afiliado Shopee nem um provedor externo universal que cubra as cinco lojas com todos os dados. Sem credencial real validada, nenhuma conta é apresentada como conectada.

Antes da primeira conexão comercial real: fornecer credenciais oficiais pelo fluxo seguro, executar uma consulta autorizada e validar permissões e limites da conta. O backend, o armazenamento cifrado e a checagem de usuário já estão implementados. O frontend estático nunca assina requisições com segredos.

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
