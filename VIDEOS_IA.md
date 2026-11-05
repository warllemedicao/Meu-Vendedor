# Gerador de vídeos IA — estado e integração futura

A interface e o fluxo de preparação estão publicados no Cloudflare. A renderização e a geração de vídeo reais continuam desativadas; não aplique migrações em produção nem habilite Secrets/flags sem verificar o estado remoto e obter autorização.

## Implementado localmente

- Cadastro manual de produto e seleção de produtos Shopee já sincronizados na conta.
- Upload explícito de imagens PNG/JPEG/WebP para o bucket privado `mv-video-assets`, em pasta por usuário; URLs temporárias são usadas para pré-visualização.
- Três templates: personagem vestindo roupa, apresentando produto e demonstrando produto, com presets de cena compatíveis.
- Quatro apresentadores com IDs estáveis: Ana (`ana`) e Lucas (`lucas`) têm referências visuais atribuídas; Carla (`carla`) e Rafael (`rafael`) têm perfis plus size, mas aguardam imagens originais compatíveis. Os arquivos anteriores de Carla e Rafael permanecem no repositório, porém não são associados a esses perfis para evitar uma referência visual incompatível.
- No template de roupa, o usuário pode informar o tamanho declarado pelo produto (com sugestões como PP, P, M, G, GG e outros valores livres). O tamanho é opcional, fica nos dados do produto, não exige migração e não é inferido a partir do personagem.
- Tipo e característica de voz, oito tons emocionais e seis estilos de anúncio.
- Novos projetos limitados a 6, 7 ou 8 segundos e formato vertical 9:16. Projetos antigos mantêm seus valores legados.
- Roteiro local editável e limitado às informações fornecidas pelo usuário. A rota Gemini usa o Secret de backend `GEMINI_API_KEY` e exige `MV_GEMINI_SCRIPT_ENABLED=true`.
- Migração para metadados de cenas, armazenamento privado, RLS, controle de estados e jobs com chave idempotente, limite diário e limite de concorrência. A consulta `supabase migration list` confirmou `20261105172000` aplicada em produção, com o mesmo identificador local e remoto.
- Biblioteca local para visitantes e sincronização no Supabase para usuários autenticados. Vídeos em Storage são acessados por URL temporária.
- Edge Function `video-generation` autenticada; respostas de jobs não expõem dados internos do provedor nem Secrets.

Os presets de cena ainda são metadados sem mídia-base. O botão de demonstração não chama provedores e não cria MP4 fictício. O endpoint de roteiro não foi chamado durante os testes.

Na exportação estática do Cloudflare, `next/image` precisa usar os caminhos públicos sem o endpoint de otimização do Next.js. A configuração de exportação agora desativa a otimização automática para essas imagens; os arquivos continuam em `public/presenters/` e não dependem do Supabase Storage. A origem do problema era a exportação gerar URLs `/_next/image` que não existem no Worker estático.

As referências pendentes são exatamente `public/presenters/carla.webp` e `public/presenters/rafael.webp`: as imagens anteriores não demonstram com clareza os perfis plus size definidos. Elas não são exibidas para esses personagens. Não há gerador de imagens gratuito e autorizado disponível neste ambiente; fornecer ou gerar novas referências originais permanece necessário. A geração real de vídeo continua desativada.

## Estado remoto e limites desta etapa

**Cloudflare:** o Worker `meu-vendedor` está com 100% do tráfego na versão `097e7f47-6233-4195-88ba-b310ede53e95`, publicada em 05/11/2026 às 17:59 UTC. `/videos` respondeu HTTP 200; o bundle remoto da página é idêntico ao bundle do build local recuperado. Não foi necessário repetir o deploy.

**Supabase:** a migração `20261105172000` e as três migrações anteriores constam no histórico remoto de produção. `video-generation` está ACTIVE na versão 12, com JWT obrigatório. O Secret `GEMINI_API_KEY` está configurado; `MV_GEMINI_SCRIPT_ENABLED` e `MV_VIDEO_JOBS_ENABLED` não aparecem na listagem de nomes. Não validei a chave nem chamei o Gemini; sem as flags explícitas, o código mantém roteiro Gemini e fila de jobs desativados. A migração e a função não foram reaplicadas nesta recuperação.

Nenhum Secret/flag foi alterado. O endpoint Gemini não foi chamado, e não houve geração paga nem uso de GPU.

A fila está bloqueada enquanto não existir um processador validado. Não há integração de renderização, composição de cenas, try-on, sincronização labial ou worker de vídeo; por isso não é possível gerar nem baixar MP4 real nesta etapa. O bucket privado de saída e a coluna de caminho do resultado estão preparados no SQL local, mas ainda não existem remotamente.

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

## Próxima etapa da integração

1. Validar um provedor e sua API de geração, incluindo custos, limites e formatos suportados.
2. Implementar e revisar o worker de vídeo, a renderização e a persistência do MP4.
3. Aplicar a migração e configurar buckets/Secrets apenas após autorização explícita.
4. Fazer testes locais e de integração sem custo antes de um teste pago autorizado.
5. Habilitar a geração real somente depois dessas validações e da autorização do responsável.

Até essa etapa, projetos concluídos pelo simulador são identificados como **Simulação concluída** e não oferecem download de MP4.
