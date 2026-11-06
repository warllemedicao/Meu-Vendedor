# Revisão após o primeiro vídeo — 06/11/2026

O responsável confirmou que o primeiro vídeo foi gerado e mostrou Carla com o produto, mas sem áudio e com marca d’água. O banco contém uma tarefa `completed`, com tentativa Magic Hour LTX-2.5 bem-sucedida. Isso substitui os registros históricos de ausência de geração real. O resultado ainda não comprova áudio, sincronização ou quinze vídeos diários.

## Correções

- O adaptador enviava `audio: false` e o worker usava o roteiro somente como contexto visual. Agora solicita áudio nativo e fala em português, diferenciando `character-speech` de narração externa e incluindo voz/emoção. O nome de Carla/Rafael também deixa de ser convertido para Lucas no prompt. Não foi iniciada outra inferência para testar: qualidade da fala e sincronização precisam ser conferidas no próximo resultado. Replicate ainda pode entregar vídeo silencioso.
- Player da fila e biblioteca limitado a 270px de largura e ao menor valor entre 60% da altura da janela e 480px, com reprodução inline no celular. Prévia estática limitada a 240px. O MP4 original e seu download são preservados. O arquivo observado no Storage tem 558.073 bytes (cerca de 545 KiB); o problema relatado é a exibição ampliada.
- Serviços de produção consulta `GET /v1/account` no backend autenticado ao abrir/atualizar disponibilidade. Exibe somente créditos e horário da consulta, sem chave nem resposta bruta. Falha retorna saldo não verificado; zero permanece zero. Saldo observado na auditoria da API: **456 créditos**, consultado em 06/11/2026 às 09:20:37 UTC; não é valor fixado no código.

## Consumo e marca d’água

A tabela oficial informa LTX-2.5 a **24 créditos/s em 480p**, **48 em 720p** e **72 em 1080p**, com áudio incluído. A configuração atual de 6s/480p estima **144 créditos**; 5s estimariam 120 (-16,7%) e 4s, 96 (-33,3%), encurtando o anúncio. A duração atual permanece 6s. Não há opção inferior a 480p para esse modelo nem parâmetro documentado de FPS para baratear a mesma saída. Reduzir o player, comprimir ou redimensionar o MP4 depois não reduz créditos já cobrados.

O responsável observou aproximadamente 150 créditos. Não foi confirmado o valor final específico cobrado pelo projeto remoto; 144 é estimativa, não fatura. A documentação distingue estimativa na criação e acerto conforme frames renderizados. Rejeições/erros confirmados e envios incertos continuam com as proteções existentes contra duplicação.

O fornecedor informa que resultados gratuitos podem ter marca d’água e que planos pagos/pacotes de créditos permitem exportação sem marca conforme as condições aplicáveis. Nenhum plano foi comprado, crédito adquirido ou marca removida. Cache da imagem e retomada do mesmo job evitam repetir etapas, mas um novo vídeo continua consumindo créditos.

Fontes oficiais consultadas nesta revisão:

- https://docs.magichour.ai/api-reference/models
- https://docs.magichour.ai/api-reference/video-projects/image-to-video
- https://docs.magichour.ai/tools/video/image-to-video
- https://magichour.ai/pricing
- https://magichour.ai/faq

## Validação

135 testes aprovados, incluindo áudio habilitado com modelo/resolução fixos, consulta de saldo, saldo zero, respostas inválidas e ausência de dados privados na resposta. Lint e TypeScript frontend/Edge aprovados; build estático de 17 rotas concluído. O build exigiu execução fora do sandbox pelo problema já conhecido de captura do `--showConfig`.

Publicação Supabase: `video-generation` v29 e `video-generation-worker` v13, autenticação preservada, sem mudança de Secrets ou migração. Cloudflare: versão `9b0a1735-f54d-4352-bc9b-31f854670851`, mantendo os dois crons. Chromium confirmou as regras CSS do player com elemento de teste 480×854: resultado de 270×480 em janelas 1440×900 e 390×844, sem overflow horizontal. Isso verifica apresentação, não áudio de uma geração real nem acesso autenticado à biblioteca.
