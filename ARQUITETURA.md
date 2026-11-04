# ARQUITETURA — Meu Vendedor (Viral Commerce AI)

> Documento de referência principal para qualquer pessoa ou agente que trabalhe no projeto.
> Atualize-o sempre que uma etapa for concluída ou uma decisão técnica mudar.

**Legenda de status usada em todo o documento**

| Status | Significado |
| --- | --- |
| ✅ Implementado | Existe no código e foi testado |
| 🟡 Planejado | Decidido, ainda não escrito |
| 🔌 Depende de API externa | Exige credenciais, permissões ou aprovação de terceiros |

**Estado atual: Etapa 1 concluída — apenas a estrutura do site (frontend) com dados demonstrativos.**
Nenhuma integração, automação, IA ou persistência existe ainda.

---

## 1. Visão geral

### 1.1 Objetivo

O **Meu Vendedor** é uma plataforma web de **marketing de afiliados com apoio de inteligência artificial**. A
proposta é reunir em um só painel o trabalho que hoje costuma ser manual e espalhado: descobrir produtos com
potencial, entender o que está em alta, produzir conteúdo promocional, organizar links de afiliado, publicar e
acompanhar o resultado.

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

Todos os módulos abaixo têm **rota e página de apresentação** na Etapa 1 (✅ navegação), mas **nenhuma
funcionalidade real** (🟡 planejado).

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
| Rotas dos 11 itens de menu | ✅ Implementado | Páginas com estado "ainda não implementado" |
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

### 3.8 Integrações externas (futuro)

Cada plataforma terá um **provider** com contrato comum (listar produtos, obter detalhes, gerar link, obter
métricas), tratamento de limites de requisição, cache e registro de erros.

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
| **Outras** | Amazon, Magalu, Hotmart etc. | Avaliar caso a caso, após validar as três primeiras. |

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
| **2** | Backend FastAPI base, PostgreSQL, modelos iniciais, autenticação, `/saude` | 🟡 Planejada |
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

A ordem pode mudar conforme as credenciais e permissões forem sendo obtidas.

---

## 8. Convenções para futuros agentes

- Idioma da interface e da documentação: **português brasileiro**.
- Não implemente funcionalidades fora da etapa em andamento.
- Nunca exiba dado fictício como real; mantenha o selo "Dados demonstrativos".
- Não crie formulários ou botões que aparentem salvar/executar algo que não existe.
- Antes de concluir: `npm run lint`, `npm run typecheck` e `npm run build` devem passar.
- Não commite segredos. Não sobrescreva trabalho existente.
