# Meu Vendedor — Viral Commerce AI

Plataforma web de **marketing de afiliados sem estoque, com apoio de inteligência artificial**.
O afiliado divulga produtos de marketplaces com links rastreáveis e recebe comissão; a plataforma ajuda a
escolher produtos, produzir conteúdo e acompanhar resultados.

> **Status: Etapa 2 — preparação das integrações.** O site tem navegação, layout e um dashboard com **dados
> demonstrativos (fictícios)**. Contas Conectadas apresenta requisitos e documentação oficial das quatro plataformas. Não existem conexões reais, automações, IA, backend ou banco de dados ainda.

A visão completa do sistema está em [`ARQUITETURA.md`](./ARQUITETURA.md) (documento de referência).

O catálogo e o desenho de segurança estão em [`INTEGRACOES.md`](./INTEGRACOES.md).

## Tecnologias

- [Next.js](https://nextjs.org/) 16 (App Router) + [React](https://react.dev/) 19
- TypeScript
- [Tailwind CSS](https://tailwindcss.com/) 4
- [lucide-react](https://lucide.dev/) (ícones)
- ESLint

Backend (FastAPI) e banco (PostgreSQL) estão **planejados** e não fazem parte desta etapa.

## Como executar

Requisitos: Node.js 22.18 ou superior e npm (testes usam suporte nativo a TypeScript).

```bash
npm install
npm run dev        # http://localhost:3000
```

## Comandos de verificação

```bash
npm test           # contratos e invariantes do catálogo
npm run lint       # ESLint
npm run typecheck  # TypeScript (tsc --noEmit)
npm run build      # build de produção
npm run start      # serve o build de produção
```

Neste ambiente, o Turbopack encontrou um bloqueio de porta local durante o processamento de CSS. A alternativa validada foi `npm run build -- --webpack`; o compilador padrão foi preservado.

## Estrutura das pastas

```text
Meu-Vendedor/
├── ARQUITETURA.md          # arquitetura e roadmap (leia primeiro)
├── INTEGRACOES.md          # plataformas, permissões e segurança futura
├── README.md
├── package.json
├── .env.example            # sem valores reais; .env* está no .gitignore
├── public/
└── src/
    ├── app/                # rotas (App Router)
    │   ├── layout.tsx      # layout raiz + tema
    │   ├── page.tsx        # redireciona para /dashboard
    │   ├── dashboard/  produtos/  tendencias/  top-10/  videos/
    │   ├── publicacoes/  afiliados/  relatorios/  automacoes/
    │   ├── contas/  configuracoes/
    │   └── loading.tsx  error.tsx  not-found.tsx
    ├── components/
    │   ├── layout/         # AppShell, Sidebar, Header, ThemeToggle
    │   ├── dashboard/      # cartões e listas do dashboard
    │   └── ui/             # Badge, Card, PageHeader, FeaturePage
    ├── lib/
    │   ├── navigation.ts   # fonte única do menu e das páginas de módulo
    │   └── demo-data.ts    # DADOS FICTÍCIOS do dashboard
    ├── types/
    └── styles/globals.css  # tokens de cor e tema claro/escuro
```

## O que existe e o que não existe

| Existe | Não existe (ainda) |
| --- | --- |
| Menu lateral e navegação entre as 11 áreas | Login e perfil de usuário |
| Dashboard com dados demonstrativos rotulados | Dados reais de qualquer plataforma |
| Tema claro/escuro (salvo no navegador) | Backend, banco de dados e persistência |
| Layout responsivo (desktop, tablet e celular) | Integrações (Shopee, Mercado Livre, TikTok) |
| Contas Conectadas com requisitos; demais módulos com estado "não implementado" | IA, geração de vídeo, publicações e automações |

## Entrega da Etapa 2

Página `/contas` com Shopee, TikTok, TikTok Shop e Mercado Livre; catálogo com recursos pretendidos, pendências de aprovação e fontes oficiais. Contratos TypeScript para futuros conectores em `src/types/connectors.ts`. Nenhum botão de conexão ou formulário de credenciais é oferecido sem fluxo real. O dashboard demonstrativo foi preservado.

## Próximas fases

Resumo do roadmap (detalhes em `ARQUITETURA.md`): backend e banco → módulo Afiliados → primeiro provider de
produtos → monitoramento → Top 10 com IA → tendências → roteiros → vídeos → publicações → relatórios →
automações. **Cada etapa só começa mediante instrução explícita.**

## Segurança

Nunca commite senhas, tokens ou chaves. Credenciais futuras ficarão em variáveis de ambiente (`.env.local`).
