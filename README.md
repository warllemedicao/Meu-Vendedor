# Meu Vendedor — Viral Commerce AI

Aplicativo de gerenciamento de afiliados e produção de vídeos. Frontend Next.js na Cloudflare; autenticação, banco, Storage privado e funções no Supabase.

## Estado vigente — 08/11/2026: fluxo Google + MuseTalk

A arquitetura sincronizada foi implementada e publicada como piloto: base aprovada no Supabase → voz fixa Google → MuseTalk 1.5/Kaggle T4 → FFmpeg → MP4 privado. Dois MP4s reais foram concluídos: três segundos em 152,378 s de notebook; 8,496 s de fala em 127,829 s de notebook e 135 s entre registro da tarefa e entrega. Inferência/codificação silenciosa: 7,829 s e 21,279 s; pico de 6,54 GiB. Boca/rosto ainda precisam de ajuste visual; bases permanecem sem aprovação para anúncios. Não há garantia de 15 vídeos/dia nem de 4K. Novas gerações não acionam provedores com créditos do fluxo antigo.

Estado completo, limites e continuidade: [ARQUITETURA_VIDEO_SINCRONIZADO.md](./ARQUITETURA_VIDEO_SINCRONIZADO.md). Os registros anteriores abaixo são históricos.

## Publicação e validação

Versões de publicação e validações mais recentes em [ATUALIZACOES.md](./ATUALIZACOES.md). Migrações de áudio e YouTube reconciliadas com o banco remoto. Crons e Secrets preservados.

200 testes aprovados na suíte completa; 27 testes focados passaram após o ajuste final de erro/cooldown. Lint, TypeScript frontend/Edge e build estático das 17 rotas aprovados. O teste real 1min.ai comprovou upload, submissão e retorno de falha por saldo insuficiente; o piloto Kaggle comprovou execução do diagnóstico de GPU. Não houve nova verificação visual em Chromium nem MP4 1min.ai nesta entrega.

## Executar localmente

Requisitos: Node.js 24 e npm. Copie `.env.example` para `.env.local` e configure somente a URL e a chave pública do Supabase. Credenciais de serviços ficam no backend.

```bash
npm ci
npm run dev
```

```bash
npm test
npm run lint
npm run typecheck
npm run typecheck:edge
npm run build:pages
```

`build:pages` exporta para `out/`. A publicação usa Wrangler; commit/push não substituem o deploy. A falha ambiental de captura TypeScript `--showConfig` no sandbox e a validação fora dele estão registradas em [PUBLICACAO.md](./PUBLICACAO.md).

## Documentação

- [AJUSTES_ESTUDIO.md](./AJUSTES_ESTUDIO.md): botão, voz, Google e limites da validação.
- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) e [YOUTUBE_CONEXAO.md](./YOUTUBE_CONEXAO.md): configuração e autorização do canal.
- [ELEVENLABS.md](./ELEVENLABS.md): síntese, privacidade, exportação e licença.
- [VIDEOS_IA.md](./VIDEOS_IA.md), [CREDITOS_DA_CONTA.md](./CREDITOS_DA_CONTA.md): pipeline e política ativa de créditos.
- [SUPABASE.md](./SUPABASE.md), [CLOUDFLARE.md](./CLOUDFLARE.md), [ARQUITETURA.md](./ARQUITETURA.md): infraestrutura e histórico técnico.
- [CATALOGO_APIS.md](./CATALOGO_APIS.md), [CONECTORES.md](./CONECTORES.md), [INTEGRACOES.md](./INTEGRACOES.md), [ESCOPO.md](./ESCOPO.md): afiliados e escopo.

Nunca versionar `.env.local`, chaves privadas, tokens, cookies ou credenciais das lojas. RLS e autenticação de backend continuam obrigatórias. O runtime usa créditos das contas e pode consumir saldo/cobrança conforme o fornecedor; não promete gratuidade ilimitada.
