# Gerador de vídeos IA — estado e implantação

O código abaixo foi implementado localmente, mas não foi publicado nem ativado. A migração nova não foi aplicada remotamente, nenhum Secret/flag foi alterado e nenhum provedor real foi chamado. Mantenha todas as flags desligadas até revisar os limites, licenças e custos e autorizar um teste.

## Implementado localmente

- Cadastro manual de produto e seleção de produtos Shopee já sincronizados na conta.
- Upload explícito de imagens PNG/JPEG/WebP para o bucket privado `mv-video-assets`, em pasta por usuário; URLs temporárias são usadas para pré-visualização.
- Três templates: personagem vestindo roupa, apresentando produto e demonstrando produto, com presets de cena compatíveis.
- Quatro apresentadores com IDs estáveis: Ana (`ana`) e Lucas (`lucas`) têm referências visuais atribuídas; Carla (`carla`) e Rafael (`rafael`) têm perfis plus size, mas aguardam imagens originais compatíveis. Os arquivos anteriores de Carla e Rafael permanecem no repositório, porém não são associados a esses perfis para evitar uma referência visual incompatível.
- No template de roupa, o usuário pode informar o tamanho declarado pelo produto (com sugestões como PP, P, M, G, GG e outros valores livres). O tamanho é opcional, fica nos dados do produto, não exige migração e não é inferido a partir do personagem.
- Tipo e característica de voz, oito tons emocionais e seis estilos de anúncio.
- Novos projetos limitados a 6, 7 ou 8 segundos e formato vertical 9:16. Projetos antigos mantêm seus valores legados.
- Roteiro local editável e limitado às informações fornecidas pelo usuário. A rota Gemini usa o Secret de backend `GEMINI_API_KEY` e exige `MV_GEMINI_SCRIPT_ENABLED=true`.
- Migração anterior para metadados de cenas, armazenamento privado, RLS, controle de estados e jobs com chave idempotente, limite diário e limite de concorrência. Na auditoria anterior, `20261105172000` constava como aplicada remotamente; a nova migration do worker ainda não foi aplicada.
- Biblioteca local para visitantes e sincronização no Supabase para usuários autenticados. Vídeos em Storage são acessados por URL temporária.
- Edge Function `video-generation` autenticada; respostas de jobs não expõem dados internos do provedor nem Secrets.
- O Estúdio envia referências privadas reduzidas do produto e de Ana/Lucas, cria uma tarefa idempotente na fila e reidrata o andamento após recarregar a página. O botão real só habilita quando fila, worker, autorização comercial, provedores e limites estão configurados.
- O comando local `npm run video:demo -- /caminho/video.mp4` requer o binário `ffmpeg` no `PATH` e usa somente `public/presenters/ana.webp` para produzir um MP4 técnico de 6 segundos, 1080x1920, sem áudio, produto ou IA. O Estúdio valida o marcador, duração e proporção; pode enviar manualmente o arquivo (até 10 MB) para `mv-video-assets/{userId}/outputs/` sob as políticas existentes e registrá-lo como `mock`/`simulation_completed`, com etiqueta **Teste técnico · sem IA**.
- O worker usa Cloudflare Workers AI (`@cf/black-forest-labs/flux-2-dev`) para compor a imagem de referência privada do produto e do personagem e depois tenta Magic Hour (`ltx-2.5`, 480p) e Replicate (`alibaba/happyhorse-1.0`, 720p) por image-to-video. Replicate recebe somente URL assinada e restrita ao bucket privado.
- A fila tem claim atômico, lease, etapas persistidas, retomada segura para polling/validação, cancelamento, histórico de tentativas, reservas atômicas de orçamento, cooldown e proteção contra repetição de submissão ambígua. Uma submissão cujo resultado não pode ser confirmado vai para estado incerto; o worker não a envia novamente.
- O worker é chamado sem manter aberta a requisição da página durante a geração, processa etapas curtas e requer um agendador externo (por exemplo, a cada minuto) para retomar polling de trabalhos remotos. O MP4 é validado quanto a duração e proporção antes de ser salvo no bucket privado.
- A UI mostra as etapas da fila, reproduz o resultado e cria URLs assinadas temporárias; a opção de download usa o MP4 privado. A implementação não foi implantada e nenhuma chamada de geração foi feita.

Os presets de cena ainda são metadados sem mídia-base. O botão “Simular geração sem créditos” não chama provedores e não cria MP4 fictício. O endpoint de roteiro não foi chamado durante os testes. O MP4 local é uma imagem estática de Ana, não um anúncio, try-on, demonstração de produto nem geração audiovisual por IA.

Na exportação estática do Cloudflare, `next/image` precisa usar os caminhos públicos sem o endpoint de otimização do Next.js. A configuração de exportação agora desativa a otimização automática para essas imagens; os arquivos continuam em `public/presenters/` e não dependem do Supabase Storage. A origem do problema era a exportação gerar URLs `/_next/image` que não existem no Worker estático.

As referências pendentes são exatamente `public/presenters/carla.webp` e `public/presenters/rafael.webp`: as imagens anteriores não demonstram com clareza os perfis plus size definidos. Elas não são exibidas para esses personagens. Não há gerador de imagens gratuito e autorizado disponível neste ambiente; fornecer ou gerar novas referências originais permanece necessário. A geração real de vídeo continua desativada.

## Último estado remoto observado (auditoria anterior; não revalidado)

**Cloudflare:** na auditoria anterior, o Worker `meu-vendedor` estava com 100% do tráfego na versão `56fa55d6-831b-475d-aa63-088ad2926b64`, publicada em 05/11/2026 às 19:52 UTC. `/videos` e os quatro arquivos `.webp` responderam HTTP 200; as imagens retornavam `image/webp` e o HTML publicado usava caminhos diretos `/presenters/*.webp`.

**Supabase:** na auditoria anterior, `20261105172000` e três migrações anteriores constavam no histórico remoto. `video-generation` estava ACTIVE na versão 12, com JWT obrigatório. O Secret `GEMINI_API_KEY` constava como configurado; `MV_GEMINI_SCRIPT_ENABLED` e `MV_VIDEO_JOBS_ENABLED` não apareciam na listagem de nomes. A chave não foi validada nem o Gemini chamado.

Nesta implementação não foi feita nova consulta remota. Nenhuma migration ou Edge Function foi publicada; nenhum Secret/flag foi alterado. O endpoint Gemini não foi chamado, e não houve geração paga nem uso de GPU.

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

Nenhum Secret foi alterado ou revelado. Não configure flags ou credenciais de produção como parte desta etapa.

## Custos e limites confirmados

Na consulta de 05/11/2026, a tabela oficial da Gemini API apresentava o Gemini Omni Flash apenas no nível pago. O preço padrão equivalia aproximadamente a **US$ 0,10 por segundo de vídeo em 720p**, calculado por tokens de saída. Valores, impostos, regiões, resolução e modalidade podem alterar o custo; por isso o aplicativo não fixa uma estimativa até consultar a configuração real do provedor.

A documentação também informa limitações regionais para edição/extensão, necessidade de usar entrega por URI em vídeos maiores que 4 MB e restrições para vídeos enviados. A seleção explícita de uma voz brasileira ou uma garantia de sincronização labial não foi confirmada como parâmetro estável; a interface guarda essas preferências como instruções até que o contrato real seja validado.

## Custos, pré-requisitos e implantação

- Magic Hour: o modelo está configurado para 6 segundos e 480p (144 créditos pela estimativa de 24 créditos/s). A geração fica bloqueada se `MV_MAGIC_HOUR_CREDIT_USD` não informar uma conversão aprovada para USD; saldo de créditos não é tratado como gratuito sem confirmação explícita.
- Replicate: o modelo escolhido aceita image-to-video e duração de 6 segundos. A estimativa documentada é US$ 0,14/s a 720p (US$ 0,84 por vídeo), sem incluir a imagem de referência Cloudflare. Um token não comprova saldo nem autoriza gasto.
- Cloudflare FLUX.2 Dev tem uma estimativa de custo baseada em steps/tiles; o orçamento reserva imagem e vídeo na mesma tarefa. A reserva diária é serializada no banco e inclui reservas ainda abertas.
- Se custo, saldo/financiamento ou licença comercial não puderem ser confirmados, a tarefa fica bloqueada para autorização. Flags ausentes/desligadas não permitem chamadas pagas.

Checklist antes de um teste real autorizado:

1. Revisar e aplicar `supabase/migrations/20261105225000_video_ai_processor.sql` no ambiente escolhido.
2. Publicar `video-generation` e `video-generation-worker`, incluindo `supabase/config.toml`. O worker valida `MV_VIDEO_WORKER_SECRET` próprio e não usa JWT de usuário.
3. Configurar agendamento periódico (recomendado: a cada minuto) para chamar `video-generation-worker` via POST com a chave pública Supabase e `MV_VIDEO_WORKER_SECRET`, sem registrar esses valores em logs.
4. Verificar no ambiente os Secrets de serviço existentes para Supabase, Cloudflare, Magic Hour e Replicate. Para Magic Hour, definir uma conversão de créditos→USD verificada; confirmar separadamente os direitos de uso comercial de cada provedor/modelo.
5. Definir limites positivos e conservadores: `MV_AI_MAX_COST_PER_JOB_USD` deve cobrir a estimativa de imagem mais a do vídeo; `MV_AI_DAILY_BUDGET_USD` limita o consumo diário.
6. Manter inicialmente `MV_VIDEO_JOBS_ENABLED`, `MV_VIDEO_PROCESSOR_ENABLED`, `MV_AI_ALLOW_PAID_GENERATION` desligados. Antes de ativar, configurar `MV_AI_ALLOWED_PROVIDERS` somente com provedores autorizados e `MV_AI_COMMERCIAL_USE_CONFIRMED=true` somente após confirmação documental.
7. `MV_MAGIC_HOUR_FREE_CREDITS_CONFIRMED=true` só pode ser usado se a conta realmente confirmar créditos gratuitos e sua elegibilidade para o uso planejado. Não é necessário para uma geração paga explicitamente autorizada.
8. Fazer primeiro testes mockados; depois, obter autorização específica para o custo estimado e executar um único teste controlado. Não fazer deploy nem ativar cobrança automaticamente.

O repositório está preparado para a publicação, não publicado. A aplicação estática do Cloudflare por si só não publica Edge Functions nem a migration. O teste técnico estático continua etiquetado como **Teste técnico · sem IA**.
