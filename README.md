# Meu Vendedor — Viral Commerce AI

App web de gerenciamento de afiliados com **Shopee, TikTok, Mercado Livre, Amazon e Magazine Luiza**.
O usuário acessa os portais oficiais das lojas para entrar ou conhecer a afiliação, e pode organizar seus links na sua conta do Meu Vendedor.

**Estado atual:** frontend público no Cloudflare e base Supabase ativada no projeto `meu-vendedor`. Migração e autenticação configuradas; login, perfil, CRUD e isolamento entre usuários testados na API hospedada. A entrega dos e-mails de confirmação/recuperação ainda precisa ser validada. O conector Shopee para ofertas e links está implementado e exige validação de credenciais reais. Consultas Amazon, Mercado Livre, TikTok Shop e AliExpress foram adicionadas ao catálogo inicial e publicadas com o frontend/backend; configuração por usuário e testes comerciais reais continuam pendentes. Magalu/SHEIN, IA e automações permanecem em preparação. O dashboard original mantém dados demonstrativos rotulados.

## Documentos

- [CATALOGO_APIS.md](./CATALOGO_APIS.md): pesquisa das sete fontes e pendências do catálogo inicial.
- [ARQUITETURA.md](./ARQUITETURA.md): intenção do produto, arquitetura e histórico.
- [ESCOPO.md](./ESCOPO.md): páginas e sequência de desenvolvimento.
- [SUPABASE.md](./SUPABASE.md): banco, autenticação, políticas e ativação.
- [CONECTORES.md](./CONECTORES.md): conector Shopee, segurança, limites e pendências por plataforma.
- [INTEGRACOES.md](./INTEGRACOES.md): requisitos das plataformas.
- [CLOUDFLARE.md](./CLOUDFLARE.md) e [PUBLICACAO.md](./PUBLICACAO.md): hospedagem e verificações.

## O que está implementado no código

- Vitrine inicial pública de Shopee, Amazon e TikTok Shop, sem exigir login ou conexão de lojas. A função `catalog-public` está publicada, mas as três fontes centrais ainda estão sem configuração e não retornam produtos reais. Consultas privadas de outras plataformas continuam separadas. Detalhes em `CATALOGO_APIS.md`.
- Navegação responsiva e tema claro/escuro.
- Catálogo das cinco plataformas; conexão Shopee por credenciais oficiais, sem sucesso simulado.
- Produtos sincronizados com ficha, comissão estimada e geração/compartilhamento de link pela API Shopee, quando a conta possui acesso válido.
- Cadastro, login e recuperação da senha do próprio Meu Vendedor via Supabase Auth.
- Perfil com nome de exibição.
- Gerenciamento de links manuais: criar, listar, editar, excluir e filtrar por plataforma, com campanha e observações.
- Estúdio de histórias com personagens originais de frutas, roteiros/prompts copiáveis para o Google Flow e estimativa manual de créditos; a geração de vídeo acontece no Flow, não dentro do app.
- Migração PostgreSQL e RLS para isolamento dos dados por usuário.
- Estado informativo quando Supabase não estiver configurado, sem apresentar operações falsas.

A migração já foi aplicada no projeto hospedado. Em outros ambientes, as telas de autenticação e persistência só ficam disponíveis após fornecer a configuração Supabase e aplicar a mesma migração.

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
npm run typecheck:edge    # backend Supabase e agendador Cloudflare
npm run build:pages      # exportação estática com Webpack; saída out/
npm run build            # build Next.js normal
npm run start            # serve o build normal (não a exportação estática)
npm run deploy:cloudflare # gera a exportação e publica com Wrangler autorizado
```

O build padrão com Turbopack encontrou restrições deste ambiente em verificações anteriores. O comando estático usa Webpack.

## Segurança

Nunca commitar senha, `service_role`, `sb_secret_*`, token de gerenciamento ou credenciais das lojas. RLS e permissões do banco são a barreira de acesso aos dados. O navegador recebe somente configuração pública e sua sessão de usuário do Meu Vendedor, gerida pelo SDK. Credenciais administrativas não são usadas no frontend.

## Próximas etapas

Validar a entrega de e-mails de confirmação e recuperação e configurar SMTP próprio quando necessário. O estúdio de vídeos ainda depende da geração manual no Google Flow; o saldo exibido é local e não sincroniza com a conta Google. Evoluir cada integração de loja somente conforme disponibilidade oficial e autorização específica, sem presumir suporte universal.

## Conectar a Shopee

Entre no app, abra Contas Conectadas e use Conectar Shopee. Informe App ID e Secret da Open API oficial, não a senha da loja. O backend valida antes de registrar a conexão. Produtos fica vazio até haver uma sincronização autorizada. Não envie credenciais pelo chat. Consulte `CONECTORES.md` antes de operar ou rotacionar segredos.
