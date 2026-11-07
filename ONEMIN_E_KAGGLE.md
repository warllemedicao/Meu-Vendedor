# 1min.ai e Kaggle — 07/11/2026

## Entrega

1min.ai adicionado ao estúdio como **1min.ai · Seedance**, usando `ONEMIN_API_KEY` somente nas Edge Functions. A presença da chave foi confirmada no runtime, e um GET autenticado de resultado inexistente retornou HTTP 200 / `aiRecord:null`, conforme o contrato oficial. Nenhum valor de secret foi retornado ao cliente, ao Git ou aos documentos.

O modelo inicial é `bytedance/seedance-2.0-fast`, 6 segundos, 720p e 9:16, com áudio nativo. O contrato é referência-para-vídeo: upload multipart pela Asset API e `TEXT_TO_VIDEO` com `imageUrls` contendo a chave privada retornada pelo upload. Não se passa uma URL assinada do Supabase como se fosse uma chave de asset do fornecedor.

## Pipeline

1. A fila valida a sessão, o produto e as referências do usuário.
2. Cloudflare FLUX.2 compõe o quadro inicial, ou o cache privado é reutilizado.
3. Automático tenta **1min.ai → Magic Hour → Google/Gemini → Replicate**, respeitando compatibilidade, cooldown e tentativas já submetidas. A escolha explícita fica vinculada ao serviço escolhido.
4. 1min.ai recebe a imagem pela Asset API e o pedido com `async:true`. O `aiRecord.uuid` é persistido como identificador remoto.
5. O worker consulta `/api/results/:uuid`, distingue PROCESSING, SUCCESS e FAILURE e preserva somente códigos seguros.
6. Em sucesso, resolve uma URL temporária nova, baixa sem encaminhar a chave de API, valida o MP4 de 6s/9:16 e grava em `mv-video-assets/<usuário>/outputs/`. A biblioteca utiliza o Storage privado do próprio projeto.

A API não documenta idempotência para esse POST. Timeout/erro de servidor após submissão ou resposta sem identificador válido ficam incertos, sem reenvio automático nem fallback que possa duplicar consumo. Rejeição de créditos permite fallback em Automático. A resposta assíncrona `INSUFFICIENT_CREDITS` recebe código próprio e cooldown de 15 minutos para o provedor; seleção explícita encerra a tarefa com motivo claro.

O modelo escolhido recebe o roteiro no prompt. Áudio nativo não garante reprodução exata da fala ou lip sync. ElevenLabs permanece integrada para prévia/narração/exportação opcional, sem incorporar automaticamente essa voz ao worker nesta entrega.

## Resultado real do teste 1min.ai

- Teste único na fila: `30c582b5-e739-4711-9f23-b4d94e23faf8`, com referências já existentes e escolha explícita 1min.ai.
- Referência pronta reutilizada; upload e submissão assíncrona aceitos; identificador remoto persistido.
- O fornecedor encerrou com `INSUFFICIENT_CREDITS`: **1.632.960 créditos necessários, 280.000 disponíveis** para a configuração testada.
- Não houve MP4, compra ou recarga. Não se declara custo zero nem teste visual bem-sucedido. O saldo informado vale para essa consulta, não para todos os modelos.
- A mensagem completa do fornecedor contém identificação da equipe e não é persistida no erro do usuário. O registro administrativo `onemin-pilot` contém somente modelo, configuração, números e estado.

Os 15.000 créditos diários anunciados exigem login no 1min.ai. A integração não automatiza esse login nem promete saldo suficiente para gerar um vídeo por dia. Próximo passo: verificar os custos de modelos compatíveis com referência e fala e validar um MP4 com saldo suficiente, sem compras automáticas.

## Kaggle: piloto administrativo executado

Criada a função `kaggle-pilot`, que exige `MV_VIDEO_WORKER_SECRET` em cada chamada. Usa `KAGGLE_API_TOKEN` exclusivamente no servidor. Os contratos foram conferidos no SDK oficial Kaggle CLI 2.2.5 / kagglesdk 0.1.38.

Operações permitidas:

- `check`: introspecção do token e consulta real de cota GPU; não assume 30h por padrão.
- `start`: cria um script privado de código fixo, com GPU T4 solicitada, internet desligada e limite de 300 segundos. Um insert com chave única em `mv_ai_provider_audits` impede relançamento por retry/concorrência. O notebook não recebe tokens do Kaggle, Supabase ou outros fornecedores.
- `status`: consulta o notebook fixo e retorna somente estado, nomes de arquivos e relatório estruturado quando extraível. Não retorna URLs assinadas nem logs brutos.

Verificação real: token válido, **108.000 segundos de GPU (30h)**, zero usado/reservado no momento da consulta, renovação informada em 14/11/2026. Notebook terminou **COMPLETE**, sem falha, e produziu `gpu-report.json`. O código verifica CUDA e encerra com erro se não houver GPU.

A primeira submissão recebeu resposta sem o `ref` exato esperado e foi tratada como incerta. Não houve reenvio: a consulta do notebook fixo confirmou RUNNING e depois COMPLETE. O cliente foi ajustado para reconhecer também `kernelId`, mantendo a proteção contra duplicação.

**Wan, avatar e sincronização labial não foram executados.** Kaggle continua fora do fallback dos usuários até validar um modelo, licença, VRAM, tempo de inicialização, entrada de imagem/áudio, recuperação do MP4 e retomada. Ter GPU e token válidos não comprova essa geração. O piloto não instala modelos nem liga faturamento.

## Banco, publicação e validação

Migração `20261107050118_onemin_video_provider.sql` amplia as constraints de projetos, tarefas, tentativas, reservas e cooldown e as listas de provedores nas RPCs. Preserva definições atuais, grants, propriedade e RLS. O banco remoto confirmou as cinco constraints e negação de EXECUTE a `anon`/`authenticated` nas RPCs internas.

Versões finais em [ATUALIZACOES.md](./ATUALIZACOES.md). A função temporária `integration-verification`, protegida por segredo descartável durante as verificações, foi substituída por HTTP 410. Não é uma API operacional do produto.

Testes cobrem upload, contrato assíncrono, polling, resultado inexistente, saldo insuficiente síncrono/assíncrono, submissão incerta, bloqueio de destinos externos, download sem chave, MP4 privado, constraints/RPCs, seleção explícita e piloto Kaggle sem código arbitrário. Suite completa: 200 testes; após ajuste final de erro/cooldown, 27 testes focados adicionais aprovados. Lint e TypeScript frontend/Edge aprovados. O build estático foi repetido fora do sandbox após o erro ambiental de captura de `--showConfig`.

O advisor mantém o alerta preexistente de [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Tabelas internas com RLS sem políticas de cliente são intencionais; esta entrega não liberou seu acesso.

## Fontes oficiais

- [Seedance e referências de imagem/áudio](https://docs.1min.ai/docs/api/ai-for-video/text-to-video/seedance-text-to-video).
- [Asset API](https://docs.1min.ai/docs/api/asset-api).
- [Submissão assíncrona](https://docs.1min.ai/docs/api/ai-feature-api).
- [Get Result: estados e URL temporária](https://docs.1min.ai/docs/api/get-result).
- [Créditos diários e login](https://1minai.tawk.help/article/daily-free-credits-15000-credits-per-day-approximately-450000-credits-per-month).
- [Kaggle CLI e contratos de kernels](https://github.com/Kaggle/kaggle-cli/blob/main/src/kaggle/api/kaggle_api_extended.py).
- [Kaggle Notebooks](https://www.kaggle.com/docs/notebooks).
