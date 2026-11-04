# Hospedagem do Meu Vendedor no Cloudflare

## Publicação atual

- Tipo: **Cloudflare Worker com Static Assets**, não Pages.
- Worker: `meu-vendedor`.
- URL pública: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev
- Configuração: `wrangler.jsonc`, com saída estática `out`.
- Build: `npm run build:pages`.
- Build e deploy: `npm run deploy:cloudflare`, com Wrangler autorizado na conta correta.
- Node.js: `24`, declarado em `.node-version`.

O build normal do Next.js foi preservado; o comando específico gera exportação estática com Webpack. Não é necessário criar outro projeto Pages para usar esta hospedagem. O nome histórico `build:pages` identifica o build estático, que também pode ser servido pelo Worker.

## Supabase

A autenticação e o banco estão no projeto Supabase `meu-vendedor` (`jzchlrvxdaffnrgbvabv`). O frontend usa a configuração pública incorporada durante o build. Definir `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente de build antes de publicar. O checkout atual usa `.env.local`, ignorado pelo Git.

Nunca usar chave administrativa ou senha do banco no frontend. Alterar variáveis de runtime no Worker não altera um bundle estático já gerado; é necessário refazer o build. Instruções e testes em `SUPABASE.md`.

## GitHub

Repositório: `warllemedicao/Meu-Vendedor`, branch `main`. O código foi enviado ao GitHub. A consulta a Workers Builds retornou 403 com a autorização atual, por isso a atualização automática via GitHub **não foi confirmada nem declarada configurada**. As publicações verificadas foram realizadas diretamente pelo Wrangler.

Para futura vinculação no painel, usar o Worker existente, autorizar apenas o repositório do projeto, configurar build `npm run build:pages` e deploy `npx wrangler deploy`, e fornecer as duas variáveis públicas Supabase também no ambiente de build. Não é necessário commitar credenciais.

## Verificação

As páginas e os recursos públicos foram testados por HTTP, e login/CRUD/RLS foram verificados na API Supabase com duas contas temporárias removidas ao final. A entrega de e-mails permanece a validar. Histórico, versões e limites em `PUBLICACAO.md`.

Referências: [Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/) e [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/).
