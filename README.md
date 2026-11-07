# Meu Vendedor — Viral Commerce AI

Aplicativo de gerenciamento de afiliados e produção de vídeos. Frontend Next.js na Cloudflare; autenticação, banco, Storage privado e funções no Supabase.

## Estado atual — 07/11/2026

- Cadastro/login por e-mail e **Continuar com Google** funcionando, confirmados pelo responsável.
- Canal **YouTube conectado**, com consulta, renovação de autorização e desconexão implementadas. Publicação/agendamento de vídeos ainda pendentes.
- Nova chave **Gemini** aceita pelo catálogo e pelos modelos configurados de roteiro e vídeo (HTTP 200). Isso não comprova geração de vídeo, saldo ou faturamento da API.
- Estúdio com fila, roteiros, referências, reprodução e download. O banco registra três vídeos concluídos via Magic Hour; qualidade da fala ainda exige avaliação do responsável.
- **1min.ai integrado** ao estúdio e ao worker. Teste real de Seedance 2.0 Fast recusado por saldo insuficiente (1.632.960 necessários / 280.000 disponíveis); sem MP4 validado desse serviço.
- **Kaggle:** piloto administrativo de GPU executado com sucesso; Wan e sincronização labial ainda não integram a fila de usuários. [Detalhes](./ONEMIN_E_KAGGLE.md).

- **Fotos de produtos sincronizados** são importadas automaticamente para a área privada ao gerar; não é necessário baixar e reenviar a foto exibida na prévia. Detalhes em [IMAGENS_SINCRONIZADAS.md](./IMAGENS_SINCRONIZADAS.md).
- **Gerar vídeo** valida ao clicar, consulta o backend e mostra pendências junto à ação. Uma consulta inicial com falha não deixa a ação bloqueada silenciosamente; envio preserva idempotência e tem limite de espera.
- **Outra voz** fica ao lado de **Característica da voz**, filtrada por tipo. ElevenLabs produz prévia/narração e exportação opcional; a geração mantém a voz nativa. O plano Free verificado não inclui licença comercial para anúncios.
- Navegador remoto **Flow removido da central**. Flow e YouTube Create aparecem no seletor como integrações pendentes; o login Google não libera automaticamente seus editores ou benefícios.
- Catálogo público Shopee/Amazon/TikTok implementado, mas a última verificação comercial continua sem fontes configuradas. Conector Shopee requer credenciais autorizadas.

Estado consolidado e próximas tarefas: [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md). Registros anteriores nos documentos técnicos estão identificados como histórico e não substituem esse estado.

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
