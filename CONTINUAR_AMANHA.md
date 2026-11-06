# Retomada — Meu Vendedor

Revisado em 06/11/2026. Este documento registra o estado confirmado e o que ainda depende de acesso ou autorização do responsável. Leia junto com `VIDEOS_IA.md`, `CLOUDFLARE.md` e `SUPABASE.md`. Não reconstrua componentes existentes nem presuma que testes simulados equivalem a acesso comercial em produção.

## 1. Resumo do projeto

Meu Vendedor é uma aplicação Next.js/React/TypeScript publicada como assets estáticos por um Cloudflare Worker. Supabase fornece Auth, PostgreSQL/RLS, Storage e Edge Functions. O projeto também tem catálogo de marketplaces, conector Shopee e um estúdio de vídeos com pipeline assíncrono, mas disponibilidade operacional depende das APIs e autorizações de cada serviço.

## 2. Concluído no código

- Cadastro, login, perfil, links manuais e isolamento de dados com Supabase Auth/RLS.
- Catálogo público e adaptadores para fontes de produtos; credenciais e permissões comerciais continuam pendentes conforme `CATALOGO_APIS.md`.
- Página `/videos` com produto, referências, configurações, roteiro, fila, acompanhamento, histórico, armazenamento privado, reprodução e download.
- Pipeline de vídeo com claim atômico, leases, etapas persistidas, polling retomável, cancelamento, idempotência, reservas orçamentárias, cooldown e bloqueio de submissão incerta.
- Adaptadores Cloudflare Workers AI para imagem e Magic Hour/Replicate para image-to-video.
- Testes locais de fallback, falta de créditos, custos desconhecidos, autorização, orçamento e casos de erro.

Código implementado e testes verdes não significam que as credenciais, saldos, licenças comerciais ou APIs reais estejam prontos.

## 3. O que foi publicado e confirmado

- Git estava em `main`, commit `3858c6b`, sincronizado com `origin/main` antes desta atualização documental.
- Cloudflare Worker `meu-vendedor`, versão ativa confirmada `0f4bd14d-0c3d-48cd-88a9-734e5ce19736`; `/videos` respondeu HTTP 200.
- Crons configurados remotamente: vídeo `* * * * *`; marketplace `*/30 * * * *`.
- Nomes de Secrets presentes no Worker (valores não lidos): `MV_SYNC_JOB_TOKEN`, `MV_VIDEO_WORKER_SECRET`, `MV_SUPABASE_PUBLISHABLE_KEY`.
- Último registro remoto Supabase disponível: `video-generation-worker` ACTIVE, versão 3, autenticação própria por `MV_VIDEO_WORKER_SECRET`; `video-generation` exige JWT de usuário.
- Migration `20261105225000_video_ai_processor.sql` e publicação do worker constam como concluídas nos registros anteriores.
- Validação local em 06/11/2026: 89 testes, lint, typecheck frontend/Edge e build estático de 17 rotas aprovados.

## 4. O que ainda não foi validado

- A consulta de analytics Cloudflare não encontrou registros de invocação agendada desde a publicação do cron de vídeo. Os crons estão configurados, mas a execução periódica não está comprovada.
- O Supabase não pôde ser consultado novamente nesta sessão: não há Supabase CLI, sessão/token de gerenciamento ou projeto vinculado no workspace. As flags/provedores abaixo refletem somente a última verificação remota registrada.
- Nenhuma tarefa autenticada foi criada remotamente, para evitar deixar um job que pudesse ser processado/cobrado. Os testes validam o fluxo no código, não uma conta real.
- Não foram consultados saldo de créditos, financiamento, chaves de provedor nem permissões de uso comercial.
- Nenhuma geração de vídeo real foi executada. Não houve consumo de créditos.

## 5. Pendências técnicas

1. Obter acesso de leitura autenticado ao projeto Supabase `jzchlrvxdaffnrgbvabv`; confirmar o projeto correto antes de consultar configurações.
2. Consultar apenas nomes/estado de Secrets e flags. Não imprimir, copiar para Git ou compartilhar valores.
3. Confirmar no Cloudflare a execução real dos dois crons usando analytics/logs, sem invocar manualmente o worker de vídeo.
4. Confirmar a disponibilidade pública de `/videos` e, com uma sessão de usuário autorizada, revisar a integração UI/API sem enfileirar uma tarefa capaz de gerar vídeo.
5. Se necessária uma prova de enqueue, planejar primeiro como impedir que o job seja reivindicado. Não criar tarefa de teste enquanto houver possibilidade de processamento ou cobrança.

## 6. APIs, permissões e créditos

Provedores implementados:

- **Cloudflare Workers AI**: imagem de referência (`@cf/black-forest-labs/flux-2-dev`).
- **Magic Hour**: vídeo image-to-video (`ltx-2.5`, 6 s, 480p; estimativa documentada de 144 créditos).
- **Replicate**: vídeo image-to-video (`alibaba/happyhorse-1.0`, 6 s, 720p).

Não foi confirmado que as chaves funcionem, que exista saldo/financiamento ou que o uso comercial esteja autorizado para a conta/modelo. Estimativas documentadas não são preços garantidos nem prova de saldo. A conversão `MV_MAGIC_HOUR_CREDIT_USD` precisa ser real e positiva para Magic Hour ser considerado configurado; ausente ou zero mantém esse provedor bloqueado. O valor zero discutido não foi confirmado como aplicado.

Os limites de **US$ 1 por tarefa** e **US$ 1 por dia** foram discutidos, mas não confirmados nem autorizados para configuração ou gasto. O teto por tarefa deve cobrir a estimativa combinada da imagem e do vídeo, e o teto diário deve incluir reservas abertas. Não altere faturamento, planos ou meios de pagamento.

## 7. Fallback Magic Hour → Replicate

O roteador implementa fallback para uma falha confirmada, inclusive rejeição explícita por falta de créditos, desde que o provedor alternativo seja compatível com a tarefa, tenha credencial válida, esteja na allowlist, tenha autorização comercial confirmada e caiba no orçamento. Se não existir alternativa elegível, o job é bloqueado/falha sem chamada adicional.

Timeout de submissão ou estado remoto ambíguo **não** gera nova submissão nem fallback, para evitar cobrança duplicada. Testes simulados cobrem falta de créditos e falhas confirmadas; não houve teste real com Magic Hour ou Replicate.

## 8. Configuração Supabase necessária antes de um teste autorizado

O runtime usa nomes padrão como `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. O worker exige `MV_VIDEO_WORKER_SECRET`. O pipeline também verifica:

- Flags: `MV_VIDEO_JOBS_ENABLED`, `MV_VIDEO_PROCESSOR_ENABLED`, `MV_AI_ALLOW_PAID_GENERATION`, `MV_AI_COMMERCIAL_USE_CONFIRMED`.
- Política/orçamentos: `MV_AI_ALLOWED_PROVIDERS`, `MV_AI_MAX_COST_PER_JOB_USD`, `MV_AI_DAILY_BUDGET_USD`.
- Cloudflare AI: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN`.
- Magic Hour: `MAGIC_HOUR_API_KEY`, `MV_MAGIC_HOUR_CREDIT_USD`; `MV_MAGIC_HOUR_FREE_CREDITS_CONFIRMED` somente se a conta confirmar elegibilidade de créditos gratuitos.
- Replicate: `REPLICATE_API_TOKEN`.
- Roteiro Gemini, opcional e separado da geração de vídeo: `GEMINI_API_KEY`, `MV_GEMINI_SCRIPT_ENABLED`.

Na última verificação remota registrada, as flags de fila/processador/geração paga/licença, allowlist e orçamentos estavam ausentes ou desligadas. Não foi possível confirmar se continuam assim. Não as habilite até o responsável confirmar por escrito direitos comerciais, provedores permitidos, saldo/custo e valor máximo autorizado.

## 9. Estado da execução real do cron

O endpoint do worker foi testado anteriormente: segredo inválido retornou 401; segredo válido retornou `processor_disabled` (503), sem reivindicar tarefa. A configuração remota dos crons foi confirmada novamente em 06/11/2026, mas a consulta de invocações agendadas desde a publicação retornou zero registros. Portanto o cron está **configurado, mas sem execução confirmada**. Não execute um trigger manual: ele pode processar uma tarefa existente se a configuração tiver mudado.

## 10. Próximos passos para o primeiro vídeo real

1. Revalidar via Supabase autenticado as flags, allowlist, limites, nomes de Secrets e status da fila; nunca revelar valores.
2. Confirmar documentação/termos de uso comercial de cada modelo e API, credenciais e saldo/financiamento disponível.
3. Definir conversão Magic Hour e limites positivos para a soma das etapas de imagem e vídeo. Não presumir que os US$ 1 discutidos sejam suficientes ou autorizados.
4. Confirmar que apenas provedores autorizados estão na allowlist e que o fallback atende à política aprovada.
5. Verificar por logs/analytics que o cron executa e que o processador permanece bloqueado enquanto a autorização não for concedida.
6. Obter autorização explícita do responsável para ativar geração paga, especificando provedor(es), uso comercial e custo máximo de um único teste.
7. Só depois de autorização, habilitar as flags necessárias, preparar uma tarefa real com usuário autenticado e acompanhar o custo, o provedor, fallback e resultado. Não fazer deploy ou alteração de faturamento como parte dessa configuração.

## Prompt de retomada

> Continue o Meu Vendedor a partir do estado descrito em `CONTINUAR_AMANHA.md`. Primeiro execute `git status`, confira o commit/branch e leia `VIDEOS_IA.md`, `CLOUDFLARE.md` e `SUPABASE.md`. Não reconstrua componentes existentes. Revalide Cloudflare e Supabase com acesso autorizado, sem exibir valores de Secrets. O Worker e os crons já estão publicados; a invocação do cron ainda não foi comprovada e a configuração Supabase não foi revalidada. Não crie jobs, não execute geração real, não consuma créditos, não habilite flags financeiras/comerciais e não altere faturamento sem autorização explícita do responsável. O fallback deve ocorrer após falta de créditos confirmada somente para outro provedor compatível, configurado, autorizado e dentro do orçamento; nunca repetir submissão ambígua. Atualize a documentação com fatos observados, execute testes e informe claramente o que segue pendente.
