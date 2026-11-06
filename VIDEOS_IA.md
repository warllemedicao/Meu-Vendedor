# Gerador de vídeos IA — estado e implantação

> **Auditoria atual — 06/11/2026:** token Cloudflare Billing Read validado; falha real do cron corrigida e execução autenticada confirmada. Auditoria privada e horária das contas implantada. Magic Hour informou plano free e 500 créditos agregados; as franquias gratuitas de imagem/vídeo e o bloqueio de cobrança ainda precisam de comprovação. Nenhum vídeo real foi gerado. Estado completo e pendências em [AUDITORIA_IA.md](./AUDITORIA_IA.md); este registro prevalece sobre estados e versões históricos abaixo.

> **Política vigente — somente gratuito, 06/11/2026:** modo `free-only` implementado e publicado no Supabase, sem teto diário de pedidos do aplicativo. Fallback automático entre opções compatíveis, reservas atômicas de cotas gratuitas, espera/retomada com etapas preservadas e renovação apenas de franquias periódicas comprovadas. Rotas pagas ou desconhecidas são bloqueadas. As cotas de imagem/vídeo ainda não têm comprovação de gratuidade registrada; pedidos podem aguardar por isso. Instruções e limites reais em [MODO_GRATUITO.md](./MODO_GRATUITO.md). Este bloco substitui as instruções históricas de ativar geração paga abaixo.

## Revisão do estúdio e pipeline — 06/11/2026

Publicado: Worker `37c2d501-7ee6-4629-a1a4-8b2c844cd854`; `video-generation` v23; `video-generation-worker` v6. Validação: 103 testes, lint, TypeScript frontend/Edge, build estático e navegação Chromium em desktop/celular aprovados. Migração `20261106022136` aplicada; cache privado sem permissões de cliente. Nenhuma geração real executada.

Este bloco substitui o estado anterior de vídeo descrito abaixo. A geração comercial completa ainda não foi comprovada.

### Alterações concluídas

- Estúdio dividido em **Criar vídeo / Em produção / Biblioteca**, com três etapas de criação, prévia vertical, ação principal única e ferramentas de teste recolhidas. Imagem local é salva automaticamente ao iniciar a geração.
- Roteiro com fallback **Gemini → Groq (`llama-3.3-70b-versatile`) → OpenRouter (`openrouter/free`) → sugestão local identificada**. Ativação por `MV_AI_SCRIPT_ENABLED=true` ou pela flag legada `MV_GEMINI_SCRIPT_ENABLED=true`. Falhas de crédito/serviço não exigem escolher outra IA.
- Vídeo mantém fallback automático Magic Hour → Replicate após rejeição confirmada, falta de crédito e falha remota confirmada. Falha ao consultar saldo agora também permite avançar. A seleção respeita capacidades e configuração; submissão incerta não é repetida.
- Adaptador Cloudflare passou a respeitar `MV_AI_COMMERCIAL_USE_CONFIRMED`; antes ele sempre declarava uso comercial não confirmado, bloqueando a imagem mesmo com a flag correta.
- Cache privado de composição em `mv_video_image_cache`, com RLS forçada e sem acesso de `anon`/`authenticated`. Chave SHA-256 inclui bytes das referências, prompt, modelo, dimensões e steps. A composição guarda produto, personagem e cenário por até 30 dias, por proprietário. Mudanças relevantes invalidam o cache. Não se reutiliza vídeo final como se fosse uma geração nova.
- Referências JPEG reduzidas têm nomes pelo conteúdo e podem ser reutilizadas após recarregar a página; não são reenviadas com UUID novo em cada produção.
- Retomada de tarefas aguardando configuração preserva a imagem. Download/Storage têm até dez tentativas de finalização sem gerar outro vídeo. MP4 inválido pode migrar de provedor, preservando a composição. Polling remoto não fica em execução indefinidamente.
- Follow-up imediato também em validação/conclusão, reduzindo esperas desnecessárias pelo cron.
- Fila permite até **100 entregas/tarefas ativas por janela de 24h e cinco tarefas simultâneas por conta**; falhas/cancelamentos não consomem essa cota. Teste PostgreSQL confirmou mais de 15 conclusões no mesmo dia. Isso não garante saldo, throughput ou duração de geração das APIs.
- UI restringe a geração real aos 6 segundos suportados; projetos antigos continuam armazenados. Corrigido loop de erros ao assinar resultados e ocultação de tarefas da conta anterior durante troca de usuário.

### Credenciais observadas e funções reais

Diagnóstico de inicialização lê somente **nomes e presença**; não revela valores e não chama as APIs dos provedores. Foram encontrados nove serviços de IA/execução, além do Cloudflare (Runway identificado no diagnóstico ampliado):

| Serviço | Papel no código atual | Estado verificado |
| --- | --- | --- |
| Gemini | Roteiro principal | Credencial presente; saldo não consultado |
| Groq | Fallback de roteiro | Credencial presente; contrato testado com respostas controladas |
| OpenRouter | Fallback de roteiro por `openrouter/free` | Credencial presente; contrato testado com respostas controladas |
| Cloudflare Workers AI | Composição da imagem inicial | Credencial presente; confirmação comercial agora é respeitada |
| Magic Hour | Vídeo image-to-video | Credencial presente; conversão de crédito não configurada |
| Replicate | Fallback de vídeo image-to-video | Credencial presente; saldo não consultado |
| Runway | Vídeo possível, sem adaptador neste pipeline | `RUNWAYML_API_SECRET` presente; integração pendente |
| Hugging Face | Sem modelo/endpoint definido neste pipeline | `HUGGINGFACE_TOKEN` presente; integração pendente |
| Modal | Execução de modelo próprio, sem endpoint definido | Duas variáveis presentes; aplicação/modelo não configurados no pipeline |
| Kaggle | Ambiente de notebooks, sem adaptador de inferência deste app | Credencial presente; não tratado como endpoint de vídeo intercambiável |

Não é necessário chamar todos os serviços em cada vídeo: isso aumentaria custo e tempo. As etapas independentes usam concorrência quando aplicável; vídeo depende da imagem inicial. Não afirmar que as nove IAs estão prontas ou fazem automaticamente todas as funções.

### Bloqueios remotos confirmados

O runtime publicado registrou `processor_available=false` e **todas** as seguintes condições ausentes/desligadas: `MV_VIDEO_JOBS_ENABLED`, `MV_VIDEO_PROCESSOR_ENABLED`, `MV_AI_ALLOW_PAID_GENERATION`, `MV_AI_COMMERCIAL_USE_CONFIRMED`, `MV_AI_ALLOWED_PROVIDERS`, `MV_AI_MAX_COST_PER_JOB_USD`, `MV_AI_DAILY_BUDGET_USD` e conversão `MV_MAGIC_HOUR_CREDIT_USD`.

Não foram alterados valores de Secrets. As ferramentas Supabase conectadas não oferecem gerenciamento de Secrets; autenticação do conector não cria sessão de gerenciamento da CLI. Configuração deve ser aplicada no [gerenciador de Secrets do projeto](https://supabase.com/dashboard/project/jzchlrvxdaffnrgbvabv/functions/secrets), usando os valores reais de financiamento/licença. “Sem limites” expressa a preferência do responsável, mas não configura uma conversão de créditos nem comprova licença comercial.

### Pendências para concluir o vídeo comercial

1. Aplicar configuração operacional no gerenciador de Secrets, com provedores/custos/licenças efetivos. A imagem Cloudflare continua sendo a única opção integrada nessa etapa; falta um segundo adaptador de imagem para fallback completo.
2. Definir e integrar modelos/endpoints para Hugging Face, Modal, Kaggle e Runway; chave isolada não especifica um contrato de inferência. Não improvisar chamadas a modelos incompatíveis.
3. Implementar voz em português, áudio/lip sync, montagem de cenas e música quando desejados. Os campos de voz/movimento atuais são briefing; não há pipeline de áudio/montagem que garanta essas preferências no MP4.
4. Validar um vídeo real completo e depois medir uma jornada de 15 vídeos/dia. Nenhum teste pago, consulta de saldo ou nova geração foi feito nesta revisão; não declarar a meta operacional atingida.
5. Validar execução real do cron e tempo de cada etapa com provedores habilitados. Revalidar recursos/limites de Storage e das APIs sob a carga esperada.
6. Ampliar biblioteca de fundos e cenas-base originais. Atualmente há presets e cache de composições geradas; cache vazio não é biblioteca de fundos pronta.
7. Definir limpeza/retencão dos arquivos privados: 30 dias é a validade do índice de cache, não exclusão automática do Storage. Duas tarefas simultâneas sem cache pronto ainda podem gerar composições iguais; deduplicação distribuída em andamento fica pendente.
8. Fornecer referências originais compatíveis de Carla/Rafael; UI impede geração com referências pendentes.

Fontes dos novos contratos: [Groq](https://console.groq.com/docs/text-chat), [OpenRouter gratuito](https://openrouter.ai/openrouter/free), [Storage privado](https://supabase.com/docs/guides/storage/buckets/fundamentals). Testes controlados não substituem credenciais, saldo ou teste real.


> **Revisão autenticada — 06/11/2026:** Supabase revalidado: `video-generation` ACTIVE v20 e `video-generation-worker` ACTIVE v3, migrações de vídeo confirmadas e fila vazia na consulta. Nenhum job ou geração criado. Flags/Secrets/saldos/licenças não foram consultados. GET sem sessão de `video-generation` retorna 401; GET do worker retorna 405 e não comprova habilitação do processador. O acesso comercial informado agora foi Shopee; não foram fornecidas credenciais/licenças dos provedores de vídeo. Estado atual em [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md). Este bloco prevalece sobre os registros anteriores de falta de acesso ou versões históricas abaixo.

## Estado confirmado em 06/11/2026

O Worker `meu-vendedor` está publicado na versão `0f4bd14d-0c3d-48cd-88a9-734e5ce19736`. A API Cloudflare confirmou os crons de vídeo `* * * * *` e marketplace `*/30 * * * *`, e os nomes `MV_SYNC_JOB_TOKEN`, `MV_VIDEO_WORKER_SECRET` e `MV_SUPABASE_PUBLISHABLE_KEY` estão presentes no Worker (valores não foram lidos). `/videos` responde HTTP 200. A consulta de analytics de invocações agendadas retornou zero registros desde a publicação; a execução efetiva do cron, portanto, não está comprovada.

O último teste remoto Supabase registrado, anterior a esta revisão, retornou 401 para segredo inválido e `processor_disabled` (503) para segredo válido, sem criar ou reivindicar tarefas. Na última leitura registrada, as flags de fila, processador, geração paga, licença comercial, allowlist e orçamentos estavam ausentes/desligadas. **Não foi possível revalidar agora o estado remoto Supabase**: este workspace não tem Supabase CLI, sessão de gerenciamento ou projeto vinculado. Trate o estado de flags e provedores como último estado conhecido, não como leitura atual. A documentação não inclui valores de Secrets.

Nenhum crédito/saldo foi consultado, nenhuma tarefa foi criada e nenhuma geração real foi executada. O bucket permanece documentado como privado. Os valores discutidos de US$ 1 por tarefa, US$ 1 diário e conversão Magic Hour em zero não foram confirmados como aplicados nem autorizados. Não habilite geração paga até confirmar licença comercial, custos/financiamento e limites com o responsável.

## Implementado localmente

- Cadastro manual de produto e seleção de produtos Shopee já sincronizados na conta.
- Upload explícito de imagens PNG/JPEG/WebP para o bucket privado `mv-video-assets`, em pasta por usuário; URLs temporárias são usadas para pré-visualização.
- Três templates: personagem vestindo roupa, apresentando produto e demonstrando produto, com presets de cena compatíveis.
- Quatro apresentadores com IDs estáveis: Ana (`ana`) e Lucas (`lucas`) têm referências visuais atribuídas; Carla (`carla`) e Rafael (`rafael`) têm perfis plus size, mas aguardam imagens originais compatíveis. Os arquivos anteriores de Carla e Rafael permanecem no repositório, porém não são associados a esses perfis para evitar uma referência visual incompatível.
- No template de roupa, o usuário pode informar o tamanho declarado pelo produto (com sugestões como PP, P, M, G, GG e outros valores livres). O tamanho é opcional, fica nos dados do produto, não exige migração e não é inferido a partir do personagem.
- Tipo e característica de voz, oito tons emocionais e seis estilos de anúncio.
- Novos projetos limitados a 6, 7 ou 8 segundos e formato vertical 9:16. Projetos antigos mantêm seus valores legados.
- Roteiro local editável e limitado às informações fornecidas pelo usuário. A rota Gemini usa o Secret de backend `GEMINI_API_KEY` e exige `MV_GEMINI_SCRIPT_ENABLED=true`.
- Migrações para metadados de cenas, armazenamento privado, RLS, controle de estados e jobs com chave idempotente, limite diário e limite de concorrência. `20261105225000_video_ai_processor.sql` consta como aplicada remotamente.
- Biblioteca local para visitantes e sincronização no Supabase para usuários autenticados. Vídeos em Storage são acessados por URL temporária.
- Edge Function `video-generation` autenticada; respostas de jobs não expõem dados internos do provedor nem Secrets.
- O Estúdio envia referências privadas reduzidas do produto e de Ana/Lucas, cria uma tarefa idempotente na fila e reidrata o andamento após recarregar a página. O botão real só habilita quando fila, worker, autorização comercial, provedores e limites estão configurados.
- O comando local `npm run video:demo -- /caminho/video.mp4` requer o binário `ffmpeg` no `PATH` e usa somente `public/presenters/ana.webp` para produzir um MP4 técnico de 6 segundos, 1080x1920, sem áudio, produto ou IA. O Estúdio valida o marcador, duração e proporção; pode enviar manualmente o arquivo (até 10 MB) para `mv-video-assets/{userId}/outputs/` sob as políticas existentes e registrá-lo como `mock`/`simulation_completed`, com etiqueta **Teste técnico · sem IA**.
- O worker usa Cloudflare Workers AI (`@cf/black-forest-labs/flux-2-dev`) para compor a imagem de referência privada do produto e do personagem e depois tenta Magic Hour (`ltx-2.5`, 480p) e Replicate (`alibaba/happyhorse-1.0`, 720p) por image-to-video. Replicate recebe somente URL assinada e restrita ao bucket privado.
- **Fallback:** uma rejeição confirmada por falta de créditos pode avançar para o próximo provedor compatível, autorizado e configurado, sujeito a orçamento e licença. Se não houver candidato elegível, o job é bloqueado/falha sem chamada adicional. Timeout ou submissão ambígua não provoca retry nem fallback, para evitar cobrança duplicada. Essa lógica e os casos de falta de créditos foram validados em testes simulados; o fallback não foi testado com contas reais.
- A fila tem claim atômico, lease, etapas persistidas, retomada segura para polling/validação, cancelamento, histórico de tentativas, reservas atômicas de orçamento, cooldown e proteção contra repetição de submissão ambígua. Uma submissão cujo resultado não pode ser confirmado vai para estado incerto; o worker não a envia novamente.
- O worker é chamado sem manter aberta a requisição da página durante a geração, processa etapas curtas e usa o cron Cloudflare por minuto para retomar polling de trabalhos remotos. O cron do marketplace permanece separado a cada 30 minutos. O MP4 é validado quanto a duração e proporção antes de ser salvo no bucket privado.
- A UI mostra as etapas da fila, o provedor selecionado, reproduz o resultado e cria URLs assinadas temporárias; a opção de download usa o MP4 privado. A infraestrutura está publicada, mas a geração continua bloqueada e nenhuma chamada de provedor foi feita.

Os presets de cena ainda são metadados sem mídia-base. O botão “Simular geração sem créditos” não chama provedores e não cria MP4 fictício. O endpoint de roteiro não foi chamado durante os testes. O MP4 local é uma imagem estática de Ana, não um anúncio, try-on, demonstração de produto nem geração audiovisual por IA.

Na exportação estática do Cloudflare, `next/image` precisa usar os caminhos públicos sem o endpoint de otimização do Next.js. A configuração de exportação agora desativa a otimização automática para essas imagens; os arquivos continuam em `public/presenters/` e não dependem do Supabase Storage. A origem do problema era a exportação gerar URLs `/_next/image` que não existem no Worker estático.

As referências pendentes são exatamente `public/presenters/carla.webp` e `public/presenters/rafael.webp`: as imagens anteriores não demonstram com clareza os perfis plus size definidos. Elas não são exibidas para esses personagens. Não há gerador de imagens gratuito e autorizado disponível neste ambiente; fornecer ou gerar novas referências originais permanece necessário. A geração real de vídeo continua desativada.

## Verificações remotas

- `/videos` respondeu HTTP 200 e os bundles publicados contêm a URL e a chave pública Supabase do projeto, além do rótulo de provedor. Nenhuma chave `service_role` foi fornecida ao build.
- A API do Cloudflare confirmou os dois crons remotos. A implantação preservou `MV_SYNC_JOB_TOKEN`; os únicos nomes adicionados ao Worker foram `MV_VIDEO_WORKER_SECRET` e `MV_SUPABASE_PUBLISHABLE_KEY`.
- A consulta de analytics feita em 06/11/2026 não encontrou registros de invocação agendada desde a publicação. A configuração está confirmada remotamente, mas a execução periódica continua sem comprovação.
- `video-generation-worker` está ACTIVE na versão 3 com JWT do gateway desativado; a autenticação manual foi testada nos dois casos acima. `video-generation` permanece com JWT obrigatório.
- Testes locais confirmam claim/leases, retomada, storage privado, fallback e bloqueio por orçamento. A fila não foi acionada remotamente durante esses testes.
- Validação local em 06/11/2026: 89 testes aprovados; lint, typecheck frontend, typecheck Edge e build estático das 17 rotas passaram. Esses resultados não comprovam execução agendada ou chamada real a provedor.
- A consulta de assinatura da conta Cloudflare retornou 403 por falta de permissão de leitura; nenhum plano foi alterado. A frequência de um minuto é suportada por Cron Triggers; consulte `CLOUDFLARE.md` para limites documentados e a ressalva sobre o plano específico da conta.

Carla e Rafael continuam sem referências aprovadas. O fluxo atual usa Ana ou Lucas, uma imagem composta como quadro inicial e não oferece try-on fiel, áudio ou sincronização labial. A qualidade/continuidade visual e a proporção final precisam ser confirmadas em um teste real autorizado.

## Serviço oficial identificado

A documentação atual do Google orienta usar **Gemini Omni Flash**, modelo `gemini-omni-1.1-flash`, para geração e edição de vídeo na Gemini API. A API utiliza a **Interactions API** e aceita texto, imagens, áudio e vídeo. Ela documenta geração com imagem de referência, formato vertical 9:16, entrega por URI para arquivos maiores e edição em múltiplas interações.

O Google informa que o Veo 3.1 Preview na Gemini API foi encerrado em 22/10/2026. Modelos Veo continuam documentados no Gemini Enterprise Agent Platform para recursos e fluxos empresariais específicos. O Google Flow é uma experiência de criação separada; não foi encontrada uma API pública independente do Flow e ele não é tratado como backend deste projeto.

Fontes oficiais:

- [Visão geral da geração de vídeo na Gemini API](https://ai.google.dev/gemini-api/docs/video)
- [Gemini Omni Flash](https://ai.google.dev/gemini-api/docs/omni)
- [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Preços da Gemini API](https://ai.google.dev/gemini-api/docs/pricing)
- [Vídeo no Gemini Enterprise Agent Platform](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/overview)
- [Autenticação do Google Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/authentication)

## Credencial e ativação

Para geração de roteiros, o código local espera `GEMINI_API_KEY` somente no backend. A chamada exige também `MV_GEMINI_SCRIPT_ENABLED=true`; a flag não foi habilitada e nenhum teste real foi feito. A geração de vídeo é uma integração separada e permanece bloqueada; não basta configurar uma chave Gemini ou habilitar o flag de roteiro.

Para uma futura opção no ambiente empresarial do Google, a credencial adequada é a identidade de uma conta de serviço/ADC de um projeto Google Cloud com o produto e as permissões corretas. Esse caminho não deve reutilizar automaticamente uma Gemini API key.

Somente `MV_VIDEO_WORKER_SECRET` (segredo compartilhado novo) e `MV_SUPABASE_PUBLISHABLE_KEY` (chave pública de build/runtime) foram adicionados aos ambientes correspondentes. Os Secrets de API existentes não foram alterados nem revelados. Não configure flags financeiras ou de licença sem autorização específica.

## Custos e limites confirmados

Na consulta de 05/11/2026, a tabela oficial da Gemini API apresentava o Gemini Omni Flash apenas no nível pago. O preço padrão equivalia aproximadamente a **US$ 0,10 por segundo de vídeo em 720p**, calculado por tokens de saída. Valores, impostos, regiões, resolução e modalidade podem alterar o custo; por isso o aplicativo não fixa uma estimativa até consultar a configuração real do provedor.

A documentação também informa limitações regionais para edição/extensão, necessidade de usar entrega por URI em vídeos maiores que 4 MB e restrições para vídeos enviados. A seleção explícita de uma voz brasileira ou uma garantia de sincronização labial não foi confirmada como parâmetro estável; a interface guarda essas preferências como instruções até que o contrato real seja validado.

## Custos, pré-requisitos e implantação

- Magic Hour: o modelo está configurado para 6 segundos e 480p (144 créditos pela estimativa de 24 créditos/s). A geração fica bloqueada se `MV_MAGIC_HOUR_CREDIT_USD` não informar uma conversão aprovada para USD; saldo de créditos não é tratado como gratuito sem confirmação explícita.
- Replicate: o modelo escolhido aceita image-to-video e duração de 6 segundos. A estimativa documentada é US$ 0,14/s a 720p (US$ 0,84 por vídeo), sem incluir a imagem de referência Cloudflare. Um token não comprova saldo nem autoriza gasto.
- Cloudflare FLUX.2 Dev tem uma estimativa de custo baseada em steps/tiles; o orçamento reserva imagem e vídeo na mesma tarefa. A reserva diária é serializada no banco e inclui reservas ainda abertas.
- Se custo, saldo/financiamento ou licença comercial não puderem ser confirmados, a tarefa fica bloqueada para autorização. Flags ausentes/desligadas não permitem chamadas pagas.

Para configurar a geração real no Supabase, os nomes de variáveis usados pelo código incluem `MV_VIDEO_WORKER_SECRET`, `MV_VIDEO_JOBS_ENABLED`, `MV_VIDEO_PROCESSOR_ENABLED`, `MV_AI_ALLOW_PAID_GENERATION`, `MV_AI_COMMERCIAL_USE_CONFIRMED`, `MV_AI_ALLOWED_PROVIDERS`, `MV_AI_MAX_COST_PER_JOB_USD`, `MV_AI_DAILY_BUDGET_USD`, `MV_MAGIC_HOUR_CREDIT_USD`, `MAGIC_HOUR_API_KEY`, `REPLICATE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_AI_API_TOKEN`. A função de roteiro usa separadamente `GEMINI_API_KEY` e `MV_GEMINI_SCRIPT_ENABLED`. O Supabase fornece ainda `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no runtime. Os nomes não indicam que os valores estejam configurados ou válidos.

Checklist antes de um teste real autorizado:

1. **Concluído:** migration `20261105225000_video_ai_processor.sql` aplicada remotamente.
2. **Concluído:** Edge Functions publicadas; `video-generation-worker` valida `MV_VIDEO_WORKER_SECRET` próprio e não usa JWT de usuário.
3. **Concluído:** o cron do Worker chama `video-generation-worker` a cada minuto com `apikey` pública e segredo compartilhado; os valores não são registrados em logs.
4. Verificar financiamento e Secrets de serviço para Supabase, Cloudflare, Magic Hour e Replicate. Para Magic Hour, definir uma conversão de créditos→USD verificada; confirmar separadamente os direitos de uso comercial de cada provedor/modelo.
5. Definir limites positivos e conservadores: `MV_AI_MAX_COST_PER_JOB_USD` deve cobrir a estimativa de imagem mais a do vídeo; `MV_AI_DAILY_BUDGET_USD` limita o consumo diário.
6. Manter inicialmente `MV_VIDEO_JOBS_ENABLED`, `MV_VIDEO_PROCESSOR_ENABLED`, `MV_AI_ALLOW_PAID_GENERATION` desligados. Antes de ativar, configurar `MV_AI_ALLOWED_PROVIDERS` somente com provedores autorizados e `MV_AI_COMMERCIAL_USE_CONFIRMED=true` somente após confirmação documental.
7. `MV_MAGIC_HOUR_FREE_CREDITS_CONFIRMED=true` só pode ser usado se a conta realmente confirmar créditos gratuitos e sua elegibilidade para o uso planejado. Não é necessário para uma geração paga explicitamente autorizada.
8. Testes simulados foram executados. Antes de ativar o processador, obter autorização específica para licença comercial e custo máximo; depois confirmar saldo/financiamento e executar um único teste controlado. Não ativar cobrança automaticamente.

O frontend e o Worker agendador estão publicados; isso não implica que a fila/provedores estejam habilitados. A aplicação estática do Cloudflare por si só não publica Edge Functions nem migrations. O teste técnico estático continua etiquetado como **Teste técnico · sem IA**.
