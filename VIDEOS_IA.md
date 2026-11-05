# Gerador de vídeos IA — estado e integração futura

Documento atualizado em 05/11/2026. A implementação atual funciona em modo de demonstração e não executa chamadas pagas.

## O que está implementado

- Cadastro manual de produto e seleção de produtos Shopee já sincronizados na conta.
- Imagem local do produto para pré-visualização, sem upload automático.
- Quatro apresentadores virtuais originais: Ana, Lucas, Carla e Rafael.
- Tipo e característica de voz, oito tons emocionais e seis estilos de anúncio.
- Durações finais de 10, 15, 20, 30, 45 e 60 segundos.
- Formatos 9:16, 1:1 e 16:9.
- Roteiro automático local, editável e limitado às informações fornecidas pelo usuário.
- Instruções de geração com preservação de personagem e produto.
- Modo econômico baseado em imagem, movimento, narração, legendas e transições.
- Prévia estática sem consumo de créditos.
- Provedor mock que simula `generating` e `processing`, sem criar MP4 fictício.
- Biblioteca local para visitantes e sincronização no Supabase para usuários autenticados.
- Camada de provedor desacoplada e Edge Function `video-generation` autenticada.

## Estado publicado

Em 05/11/2026, a migração `20261105151156` e a Edge Function `video-generation` versão 1 foram publicadas no Supabase. A tabela `mv_video_projects` tem RLS forçada e quatro políticas; a função exige JWT e respondeu 401 sem sessão. O frontend foi publicado no Cloudflare na versão `7f135c6e-69b7-4fbc-a459-82bdcf34f30e` e `/videos` respondeu HTTP 200. Nenhuma credencial Google foi configurada e nenhuma geração paga foi iniciada.

A última validação aprovou 41 testes, lint, TypeScript do frontend e das Edge Functions e o build estático com 17 rotas. Os quatro retratos estão publicados em WebP; nenhuma imagem de produto enviada pelo usuário é persistida automaticamente.

O botão de geração Google permanece desativado. A função de backend também recusa geração real até receber credencial, flag de ativação e a implementação final revisada.

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

## Credencial necessária

Para a opção Gemini API, a integração deverá usar uma **Gemini API key** obtida em um projeto Google compatível. Ela deverá ser definida somente no backend como `GOOGLE_GEMINI_API_KEY`. Uma chave do Flow ou uma sessão do navegador não será aceita.

Para uma futura opção no ambiente empresarial do Google, a credencial adequada é a identidade de uma conta de serviço/ADC de um projeto Google Cloud com o produto e as permissões corretas. Esse caminho não deve reutilizar automaticamente uma Gemini API key.

Além da credencial, o backend exige `MV_GOOGLE_VIDEO_ENABLED=true`. A flag não será configurada antes da autorização explícita para chamadas reais.

## Custos e limites confirmados

Na consulta de 05/11/2026, a tabela oficial da Gemini API apresentava o Gemini Omni Flash apenas no nível pago. O preço padrão equivalia aproximadamente a **US$ 0,10 por segundo de vídeo em 720p**, calculado por tokens de saída. Valores, impostos, regiões, resolução e modalidade podem alterar o custo; por isso o aplicativo não fixa uma estimativa até consultar a configuração real do provedor.

A documentação também informa limitações regionais para edição/extensão, necessidade de usar entrega por URI em vídeos maiores que 4 MB e restrições para vídeos enviados. A seleção explícita de uma voz brasileira ou uma garantia de sincronização labial não foi confirmada como parâmetro estável; a interface guarda essas preferências como instruções até que o contrato real seja validado.

## Próxima etapa da integração

1. Confirmar se a credencial pertence à Gemini API ou ao Google Cloud.
2. Confirmar faturamento, região e limites antes de qualquer teste pago.
3. Armazenar a credencial como segredo da Edge Function, nunca no frontend.
4. Implementar a chamada oficial no adaptador Google.
5. Iniciar com uma geração curta autorizada, acompanhar estado e custo e baixar o resultado dentro da retenção do provedor.
6. Guardar o MP4 em armazenamento controlado pelo Meu Vendedor antes de apresentar download permanente.
7. Habilitar `MV_GOOGLE_VIDEO_ENABLED` somente depois dos testes e da autorização do responsável.

Até essa etapa, projetos concluídos pelo simulador são identificados como **Simulação concluída** e não oferecem download de MP4.
