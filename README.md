# Meu Vendedor — Viral Commerce AI

Plataforma web de **marketing de afiliados sem estoque, com apoio de inteligência artificial**.
O afiliado divulga produtos de marketplaces com links rastreáveis e recebe comissão; a plataforma ajuda a
escolher produtos, produzir conteúdo e acompanhar resultados.

> **Status: Etapa 1 — estrutura inicial.** O site tem navegação, layout e um dashboard com **dados
> demonstrativos (fictícios)**. Não existem integrações, automações, IA, backend ou banco de dados ainda.

A visão completa do sistema está em [`ARQUITETURA.md`](./ARQUITETURA.md) (documento de referência).

## Tecnologias (Etapa 1)

- [Next.js](https://nextjs.org/) 16 (App Router) + [React](https://react.dev/) 19
- TypeScript
- [Tailwind CSS](https://tailwindcss.com/) 4
- [lucide-react](https://lucide.dev/) (ícones)
- ESLint

Backend (FastAPI) e banco (PostgreSQL) estão **planejados** e não fazem parte desta etapa.

## Como executar

Requisitos: Node.js 20 ou superior e npm.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Comandos de verificação

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript (tsc --noEmit)
npm run build      # build de produção
npm run start      # serve o build de produção
```

## Estrutura das pastas

```text
Meu-Vendedor/
├── ARQUITETURA.md          # arquitetura e roadmap (leia primeiro)
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
| Páginas de módulo com estado "não implementado" | IA, geração de vídeo, publicações e automações |

## Próximas fases

Resumo do roadmap (detalhes em `ARQUITETURA.md`): backend e banco → módulo Afiliados → primeiro provider de
produtos → monitoramento → Top 10 com IA → tendências → roteiros → vídeos → publicações → relatórios →
automações. **Cada etapa só começa mediante instrução explícita.**

## Segurança

Nunca commite senhas, tokens ou chaves. Credenciais futuras ficarão em variáveis de ambiente (`.env.local`).
