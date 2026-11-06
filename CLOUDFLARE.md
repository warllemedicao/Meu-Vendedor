# Hospedagem do Meu Vendedor no Cloudflare

> **Teste no app — 06/11/2026:** diagnóstico autenticado de cotas de imagem/vídeo adicionado ao estúdio, com atualização sem inferência. Sem cota elegível, o botão informa “Salvar pedido na fila”; não indica geração imediata. Nenhuma geração real foi enviada nesta revisão, nenhum teste de API foi concluído e nenhuma cota foi ativada. Guia e impedimentos atuais em [TESTE_NO_APP.md](./TESTE_NO_APP.md). Este registro prevalece sobre instruções históricas abaixo.

> **Auditoria atual — 06/11/2026:** token Cloudflare Billing Read validado; falha real do cron corrigida e execução autenticada confirmada. Auditoria privada e horária das contas implantada. Magic Hour informou plano free e 500 créditos agregados; as franquias gratuitas de imagem/vídeo e o bloqueio de cobrança ainda precisam de comprovação. Nenhum vídeo real foi gerado. Estado completo e pendências em [AUDITORIA_IA.md](./AUDITORIA_IA.md); este registro prevalece sobre estados e versões históricos abaixo.

Publicado em 06/11/2026: Worker `1fb26204-b970-45c3-b285-63365d30be0b`, funções Supabase `video-generation` v24 / `video-generation-worker` v7 e migração `20261106024913`. Diagnóstico remoto: processador disponível, modo gratuito e pagamentos bloqueados. Cotas ainda não verificadas permanecem em espera. Validação: 116 testes, lint, TypeScript e build de 17 rotas aprovados.

> **Política vigente — somente gratuito, 06/11/2026:** modo `free-only` implementado e publicado no Supabase, sem teto diário de pedidos do aplicativo. Fallback automático entre opções compatíveis, reservas atômicas de cotas gratuitas, espera/retomada com etapas preservadas e renovação apenas de franquias periódicas comprovadas. Rotas pagas ou desconhecidas são bloqueadas. As cotas de imagem/vídeo ainda não têm comprovação de gratuidade registrada; pedidos podem aguardar por isso. Instruções e limites reais em [MODO_GRATUITO.md](./MODO_GRATUITO.md). Este bloco substitui as instruções históricas de ativar geração paga abaixo.

## Estúdio reorganizado e pipeline revisado — 06/11/2026

- Worker `meu-vendedor` publicado na versão `37c2d501-7ee6-4629-a1a4-8b2c844cd854`, preservando ambos os crons e os Secrets. URL: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/videos
- Supabase: `video-generation` ACTIVE v23 com JWT; `video-generation-worker` ACTIVE v6 com autenticação própria preservada. Migração `20261106022136_video_production_cache.sql` aplicada e confirmada: cache privado e tentativas de finalização, além de ajustes de capacidade da fila.
- 103 testes aprovados, lint sem alertas de código, TypeScript frontend/Edge e exportação estática das 17 rotas aprovados. Testes focados de finalização foram repetidos após ajuste do tratamento de erro transitório.
- Navegador Chromium em 1440×1000 e 390×844: etapas, abas e biblioteca navegáveis, sem erros JavaScript ou overflow horizontal. Verificação repetida na URL pública após publicação.
- SQL confirmou cache com RLS habilitada/forçada, sem leitura para `anon`/`authenticated`; nenhum alerta de FK sem índice. Advisor informa seis tabelas internas sem políticas de cliente intencionalmente, incluindo cache. Proteção Auth contra senhas vazadas continua desativada; [orientação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Credenciais presentes não significam geração operacional. O diagnóstico do runtime confirmou flags de fila/processador/geração paga/licença desligadas, allowlist vazia, orçamentos e conversão Magic Hour sem configuração. Nenhum Secret foi alterado; não foram criados jobs nem consumidos créditos de IA. A revisão não comprova um vídeo real nem 15 vídeos/dia.
- Interfaces/contratos sem adaptadores, pipeline de áudio, biblioteca de fundos pronta e demais pendências estão enumerados em `VIDEOS_IA.md`. Este registro prevalece sobre estados históricos abaixo.


## Publicação atual

- Tipo: **Cloudflare Worker com Static Assets**, não Pages.
- Worker: `meu-vendedor`.
- URL pública: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev
- Configuração: `wrangler.jsonc`, com saída estática `out`.
- Build: `npm run build:pages`.
- Build e deploy: `npm run deploy:cloudflare`, com Wrangler autorizado na conta correta.
- Node.js: `24`, declarado em `.node-version`.
- Versão ativa verificada em 06/11/2026: `0f4bd14d-0c3d-48cd-88a9-734e5ce19736`.
- `/videos` está publicado e conectado à configuração pública Supabase incorporada no build; a chave `service_role` não é enviada ao frontend. Os arquivos em `public/presenters/` são servidos como WebP. A exportação estática usa as URLs diretas dos assets, sem depender do endpoint de otimização `/_next/image`. As referências de Carla e Rafael permanecem pendentes; detalhes em `VIDEOS_IA.md`.
- Crons remotos verificados novamente em 06/11/2026: marketplace `*/30 * * * *` e processador de vídeos `* * * * *`. O handler despacha cada expressão para uma rotina distinta. O último teste registrado do endpoint do processador retornou `processor_disabled`; não foi feita chamada que reivindique tarefas durante esta revisão.
- A configuração remota está confirmada pela API, mas a consulta de analytics para invocações agendadas desde a publicação retornou zero registros. Portanto, **a execução periódica ainda não está comprovada**; não documentar o cron como operacional até observar uma invocação registrada.
- Secrets do Worker: `MV_SYNC_JOB_TOKEN` preexistente preservado; `MV_VIDEO_WORKER_SECRET` e `MV_SUPABASE_PUBLISHABLE_KEY` adicionados. `wrangler.jsonc` mantém `"keep_vars": true` e o binding `ASSETS`.

Os valores dos Secrets não foram lidos. A conta está autenticada para consultar deployments, crons e nomes de Secrets; a leitura de assinatura/plano continua indisponível (403) e nenhum plano ou faturamento foi alterado.

O plano específico da conta não pôde ser consultado pela API Cloudflare (403 por escopo insuficiente); nenhum plano ou faturamento foi alterado. A documentação oficial suporta Cron Triggers e a frequência mínima de um minuto. Dois crons resultam em aproximadamente 1.488 invocações agendadas/dia (1.440 de vídeo + 48 de marketplace), abaixo do limite documentado de 100.000 requests/dia do Workers Free, antes de considerar qualquer outro tráfego da conta. O limite de CPU no Free é 10 ms por invocação; a chamada do cron faz apenas uma requisição autenticada ao Supabase e não executa processamento de IA. Confira o plano e o uso agregado da conta no painel antes de considerar qualquer limite de conta.

O build normal do Next.js foi preservado; o comando específico gera exportação estática com Webpack. Não é necessário criar outro projeto Pages para usar esta hospedagem. O nome histórico `build:pages` identifica o build estático, que também pode ser servido pelo Worker.

## Supabase

A autenticação e o banco estão no projeto Supabase `meu-vendedor` (`jzchlrvxdaffnrgbvabv`). O frontend usa a configuração pública incorporada durante o build. Definir `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente de build antes de publicar. O checkout atual usa `.env.local`, ignorado pelo Git; a chave `publishable` não é uma credencial administrativa.

Nunca usar chave administrativa ou senha do banco no frontend. Alterar variáveis de runtime no Worker não altera um bundle estático já gerado; é necessário refazer o build. Instruções e testes em `SUPABASE.md`.

## GitHub

Repositório: `warllemedicao/Meu-Vendedor`, branch `main`. O código foi enviado ao GitHub. A consulta a Workers Builds retornou 403 com a autorização atual, por isso a atualização automática via GitHub **não foi confirmada nem declarada configurada**. As publicações verificadas foram realizadas diretamente pelo Wrangler.

Para futura vinculação no painel, usar o Worker existente, autorizar apenas o repositório do projeto, configurar build `npm run build:pages` e deploy `npx wrangler deploy`, e fornecer as duas variáveis públicas Supabase também no ambiente de build. Não é necessário commitar credenciais.

## Verificação

As páginas e os recursos públicos foram testados por HTTP. Login/CRUD/RLS foram verificados anteriormente com duas contas temporárias removidas ao final; a biblioteca de vídeos foi verificada por migração, políticas e testes locais. A entrega de e-mails permanece a validar. O build final gerou 17 rotas, e a sessão OAuth temporária usada na publicação foi encerrada depois do deploy. Histórico, versões e limites em `PUBLICACAO.md`.

Referências: [Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [limites de Workers](https://developers.cloudflare.com/workers/platform/limits/) e [preços](https://developers.cloudflare.com/workers/platform/pricing/).
