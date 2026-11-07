# Ajustes do estúdio e ferramentas Google — 07/11/2026

> **Diagnóstico posterior confirmado pelo responsável:** o formulário exibia a imagem do produto sincronizado por URL, mas a geração exigia arquivo manual/caminho privado. Essa condição específica foi corrigida com importação automática autenticada para Storage. A alteração anterior do botão não incluía esse caminho. Ver [IMAGENS_SINCRONIZADAS.md](./IMAGENS_SINCRONIZADAS.md).

## Botão Gerar vídeo

O responsável informou que o botão estava apagado. Os logs reais mostraram respostas 200 da consulta de disponibilidade e worker ativo; o banco continuava com apenas o vídeo Magic Hour concluído anteriormente. Não havia novo pedido registrado. O formulário local do usuário não está disponível ao agente; não foi atribuída uma condição específica de preenchimento sem evidência.

A interface antes desabilitava a ação por uma combinação de estado de capacidade, ferramenta, validação, imagem, duração, apresentador e simulação. Agora o botão permite validar a solicitação ao clicar, mostra o motivo junto à ação e abre a etapa correspondente para corrigir os dados. Apenas verificação inicial de acesso e envio em andamento desabilitam a ação. O backend continua validando autenticação e todos os requisitos; não houve remoção dessas verificações.

Antes de enviar, consulta novamente as capacidades reais. Uma falha inicial ou estado antigo da interface não impede uma nova consulta. Há limites de espera de 15s na consulta e 30s no registro da fila; erros retornados pelo backend são preservados. Trava local impede cliques concorrentes e a chave idempotente é mantida se a confirmação do registro falhar. Não foi aumentado orçamento ou alterado saldo de fornecedor.

## Voz

O cartão separado da ElevenLabs e o segundo campo de texto foram retirados do estúdio. **Outra voz (opcional)** fica ao lado de **Característica da voz**, usando o roteiro existente, com filtro feminina/masculina e vozes neutras. A opção inicial é a voz original da ferramenta de vídeo; falha da ElevenLabs não bloqueia a geração nativa.

Prévia, reprodução e exportação de narração ficam junto do seletor, visíveis quando uma voz é escolhida. A seleção ElevenLabs vale para esses recursos e para a exportação local opcional de vídeo narrado; não é uma etapa automática do worker. A conta Free verificada continua sem licença comercial para anúncios, conforme indicado na interface. O áudio original do pipeline permanece disponível.

## Google

- **Login:** habilitado e confirmado pelo responsável.
- **YouTube:** responsável confirmou canal conectado. A conexão não implementa publicação/agendamento automaticamente.
- **Gemini:** o diagnóstico inicial retornou HTTP 400 / `API_KEY_INVALID`. Após o responsável substituir `GEMINI_API_KEY`, consultas ao catálogo, `gemini-3.8-flash` e `gemini-omni-1.2-flash` retornaram HTTP 200. Consultas GET não comprovam inferência real, saldo, faturamento ou qualidade de vídeo.
- **Flow:** navegador remoto retirado da central de conexões. Mantida somente a opção de ferramenta no seletor, marcada como integração pendente e indisponível para envio. Não foi implementada uma transferência de sessão/cookies do Flow por OAuth. O executor permanece no backend para possível evolução, sem inicialização pela interface removida.
- **YouTube Create:** opção pendente; API de canais/uploads não concede acesso ao editor móvel ou a seus benefícios.

## Verificação e publicação

178 testes Node aprovados; lint e TypeScript frontend/Edge aprovados; build estático das 17 rotas aprovado fora do sandbox após o erro ambiental conhecido de captura `--showConfig`.

Chromium em 1440×900 e 390×844, com sessão e respostas controladas: falha 503 na primeira consulta, botão clicável, erros de nome/foto mostrados, PNG real preparado no navegador, referências do produto/apresentador enviadas ao Storage simulado e solicitação registrada uma única vez na fila simulada. Filtro de vozes e ausência de cartão ElevenLabs/overflow conferidos. Esses testes não criaram uma nova tarefa real nem geraram MP4 pago.

Supabase `video-generation` v44 publicado preservando a autenticação e os demais arquivos remotos; somente a orientação da opção Flow foi atualizada no backend. O diagnóstico temporário de chave foi desativado e retorna 410. Frontend/Cloudflare publicado na versão `a1a5dd36-76b7-4954-99f6-d9d5f5b72b90`, preservando os dois crons e os Secrets.

## Omni e ambiente — 07/11/2026

O log real confirmou Free Tier com limite zero no Omni. Falhas remotas agora preservam um código seguro; seleção explícita não troca de provedor e provedores já submetidos/esgotados não ficam em espera infinita. Pedido afetado encerrado com imagem preservada, sem reenvio. Prompts passam a descrever ambientes concretos, iluminação e profundidade em vez de apenas IDs de preset; qualidade visual ainda precisa de avaliação em geração futura.
