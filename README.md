# Meu Vendedor — Viral Commerce AI

App web de gerenciamento de afiliados com **Shopee, TikTok, Mercado Livre, Amazon e Magazine Luiza**.
O usuário acessa os portais oficiais das lojas para entrar ou conhecer a afiliação, e pode organizar seus links no Meu Vendedor quando a base Supabase estiver ativada.

**Estado atual:** frontend público no Cloudflare e base Supabase implementada no código. A migração foi testada localmente; aplicação e configuração no projeto Supabase hospedado ainda dependem de concluir a autorização do responsável. Não há APIs de lojas, IA ou automações ativas. O dashboard original mantém dados demonstrativos rotulados.

## Documentos

- [ARQUITETURA.md](./ARQUITETURA.md): intenção do produto, arquitetura e histórico.
- [ESCOPO.md](./ESCOPO.md): páginas e sequência de desenvolvimento.
- [SUPABASE.md](./SUPABASE.md): banco, autenticação, políticas e ativação.
- [INTEGRACOES.md](./INTEGRACOES.md): requisitos das plataformas.
- [CLOUDFLARE.md](./CLOUDFLARE.md) e [PUBLICACAO.md](./PUBLICACAO.md): hospedagem e verificações.

## O que está implementado no código

- Navegação responsiva e tema claro/escuro.
- Catálogo das cinco plataformas com links oficiais externos; nenhuma conexão de loja é simulada.
- Cadastro, login e recuperação da senha do próprio Meu Vendedor via Supabase Auth.
- Perfil com nome de exibição.
- Gerenciamento de links manuais: criar, listar, editar, excluir e filtrar por plataforma, com campanha e observações.
- Migração PostgreSQL e RLS para isolamento dos dados por usuário.
- Estado informativo quando Supabase não estiver configurado, sem apresentar operações falsas.

As telas de autenticação e persistência só ficam disponíveis com a configuração Supabase. Sua presença no código não comprova que a migração foi aplicada no projeto hospedado.

## Tecnologias

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase JS, PostgreSQL/RLS, ESLint e testes Node.js com PGlite. O frontend atual pode ser exportado como estático; Auth e Data API são fornecidos pelo Supabase. FastAPI permanece opcional para futuras operações especializadas.

## Executar

Requisitos: Node.js 24 (declarado em `.node-version`) e npm.

```bash
npm ci
npm run dev
```

Para ativar Auth e banco, aplicar a migração e configurar o projeto correto conforme `SUPABASE.md`. Depois, copiar `.env.example` para `.env.local` e preencher somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Sem essas variáveis, é possível explorar o catálogo e o dashboard; a interface informa que o acesso de usuários está em preparação. O build rejeita configuração parcial, URL inválida e chaves administrativas em variáveis públicas.

## Verificações e publicação

```bash
npm test                 # catálogo, validação e PostgreSQL/RLS local
npm run lint
npm run typecheck
npm run build:pages      # exportação estática com Webpack; saída out/
npm run build            # build Next.js normal
npm run start            # serve o build normal (não a exportação estática)
npm run deploy:cloudflare # gera a exportação e publica com Wrangler autorizado
```

O build padrão com Turbopack encontrou restrições deste ambiente em verificações anteriores. O comando estático usa Webpack.

## Segurança

Nunca commitar senha, `service_role`, `sb_secret_*`, token de gerenciamento ou credenciais das lojas. RLS e permissões do banco são a barreira de acesso aos dados. O navegador recebe somente configuração pública e sua sessão de usuário do Meu Vendedor, gerida pelo SDK. Credenciais administrativas não são usadas no frontend.

## Próximas etapas

Concluir autorização Supabase, identificar `meu-vendedor`, aplicar a migração, configurar confirmação de e-mail e redirects, ativar as variáveis públicas no build e validar os fluxos reais. Depois, evoluir cada integração de loja somente conforme disponibilidade oficial e autorização específica, sem presumir suporte universal.
