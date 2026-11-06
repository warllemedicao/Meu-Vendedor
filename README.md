# Meu Vendedor — Viral Commerce AI

App web de gerenciamento de afiliados com **Shopee, TikTok, Mercado Livre, Amazon e Magazine Luiza**.
O usuário acessa os portais oficiais das lojas para entrar ou conhecer a afiliação, e pode organizar seus links na sua conta do Meu Vendedor.

**Estado atual em 06/11/2026:** frontend público no Cloudflare, versão `0f4bd14d-0c3d-48cd-88a9-734e5ce19736`, com `/videos` conectado à configuração pública do Supabase. O Worker mantém o cron do marketplace (`*/30 * * * *`) e chama o processador de vídeo a cada minuto. A autenticação Worker–Supabase foi validada; o processador e a geração paga continuam bloqueados por flags financeiras/comerciais ausentes. Nenhuma geração real foi executada. A entrega dos e-mails de confirmação/recuperação ainda precisa ser validada. O conector Shopee exige credenciais comerciais reais; Amazon, Mercado Livre, TikTok Shop e AliExpress têm adaptadores de catálogo sem teste comercial autenticado. Magalu/SHEIN e automações permanecem pendentes. Dados demonstrativos continuam rotulados.

## Documentos

- [CATALOGO_APIS.md](./CATALOGO_APIS.md): pesquisa das sete fontes e pendências do catálogo inicial.
- [ARQUITETURA.md](./ARQUITETURA.md): intenção do produto, arquitetura e histórico.
- [ESCOPO.md](./ESCOPO.md): páginas e sequência de desenvolvimento.
- [SUPABASE.md](./SUPABASE.md): banco, autenticação, políticas e ativação.
- [CONECTORES.md](./CONECTORES.md): conector Shopee, segurança, limites e pendências por plataforma.
- [INTEGRACOES.md](./INTEGRACOES.md): requisitos das plataformas.
- [VIDEOS_IA.md](./VIDEOS_IA.md): gerador em modo demonstração e contrato oficial preparado para o Google.
- [CLOUDFLARE.md](./CLOUDFLARE.md) e [PUBLICACAO.md](./PUBLICACAO.md): hospedagem e verificações.

## O que está implementado no código

- Vitrine inicial pública de Shopee, Amazon e TikTok Shop, sem exigir login ou conexão de lojas. A função `catalog-public` está publicada, mas as três fontes centrais ainda estão sem configuração e não retornam produtos reais. Consultas privadas de outras plataformas continuam separadas. Detalhes em `CATALOGO_APIS.md`.
- Navegação responsiva e tema claro/escuro.
- Catálogo das cinco plataformas; conexão Shopee por credenciais oficiais, sem sucesso simulado.
- Produtos sincronizados com ficha, comissão estimada e geração/compartilhamento de link pela API Shopee, quando a conta possui acesso válido.
- Cadastro, login e recuperação da senha do próprio Meu Vendedor via Supabase Auth.
- Perfil com nome de exibição.
- Gerenciamento de links manuais: criar, listar, editar, excluir e filtrar por plataforma, com campanha e observações.
- Estúdio de vídeos com fila privada, presets, roteiros, acompanhamento, reprodução e download. O pipeline Magic Hour/Replicate está implementado, mas não é considerado operacional até autorizar uso comercial, verificar saldo/créditos e definir limites; demonstrações continuam claramente identificadas como sem IA.
- Migração PostgreSQL e RLS para isolamento dos dados por usuário.
- Estado informativo quando Supabase não estiver configurado, sem apresentar operações falsas.

As três migrações versionadas já foram aplicadas no projeto hospedado. Em outros ambientes, as telas de autenticação e persistência só ficam disponíveis após fornecer a configuração Supabase e aplicar as migrações na ordem registrada.

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

O build padrão com Turbopack encontrou restrições deste ambiente em verificações anteriores. O comando estático usa Webpack. Na última entrega, 89 testes, lint, TypeScript do frontend e das Edge Functions e o build estático de 17 rotas foram aprovados.

## Segurança

Nunca commitar senha, `service_role`, `sb_secret_*`, token de gerenciamento ou credenciais das lojas. RLS e permissões do banco são a barreira de acesso aos dados. O navegador recebe somente configuração pública e sua sessão de usuário do Meu Vendedor, gerida pelo SDK. Credenciais administrativas não são usadas no frontend.

## Próximas etapas

Validar a entrega de e-mails de confirmação e recuperação e configurar SMTP próprio quando necessário. Para ativar a geração real de vídeos, confirmar a licença comercial aplicável, os créditos/saldo de cada provedor e os limites máximos por tarefa e por dia; não basta possuir uma API key. Evoluir cada integração de loja somente conforme disponibilidade oficial e autorização específica, sem presumir suporte universal.

## Conectar a Shopee

Entre no app, abra Contas Conectadas e use Conectar Shopee. Informe App ID e Secret da Open API oficial, não a senha da loja. O backend valida antes de registrar a conexão. Produtos fica vazio até haver uma sincronização autorizada. Não envie credenciais pelo chat. Consulte `CONECTORES.md` antes de operar ou rotacionar segredos.
