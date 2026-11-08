# ElevenLabs — integração de narração, 06/11/2026

> **Substituído em 07/11/2026:** novas narrações usam Google Chirp 3 HD; vozes fixas e validação em [GOOGLE_TTS.md](./GOOGLE_TTS.md). Este documento preserva o histórico ElevenLabs. Credencial e áudios anteriores não foram apagados.

## Estado vigente

A chave existente `ELEVENLABS_API` é usada no backend. Não foi necessário cadastrá-la novamente. A função independente `audio-generation` está publicada na versão 2 e valida cada sessão com Supabase Auth. A integração não condiciona a disponibilidade de geração de vídeo.

No estúdio, **Outra voz (opcional)** fica ao lado de **Característica da voz**, com vozes filtradas pelo tipo feminina/masculina selecionado. O cartão separado e o segundo campo de roteiro foram removidos; a prévia e a exportação de narração usam o roteiro existente. A voz nativa é a opção padrão e permanece no pipeline de geração. A escolha ElevenLabs se aplica à prévia e à exportação opcional, não substitui automaticamente o áudio no worker. Um resultado concluído pode receber essa narração na exportação local; o vídeo original permanece na biblioteca. O navegador exporta MP4 ou WebM conforme suporte e mantém o último quadro quando a fala excede a duração do vídeo. Não há sincronização labial nem composição automática no worker.

## Teste real e compatibilidade

Uma frase neutra de avaliação em português foi sintetizada pela API com `eleven_multilingual_v2` e a voz padrão **Bella - Professional, Bright, Warm**. O MP3 retornou **59.811 bytes** e foi decodificado no Chromium com aproximadamente **3,67 segundos**. A exportação local com um vídeo de teste retornou MP4 com faixa de áudio decodificável. Isso é um teste real de síntese separado dos testes simulados de interface e não constitui anúncio comercial produzido.

A lista de vozes da conta inclui uma voz profissional de biblioteca que foi recusada pela síntese com HTTP **402 / payment_required**. A integração agora filtra vozes **premade** para contas Free, mesmo quando uma voz profissional aparece na lista e informa `free_users_allowed=true`. Foram encontradas 21 vozes padrão na consulta de validação.

O plano verificado continua **Free**. A API informou 10.000 créditos antes e imediatamente depois do teste; esse retorno imediato não comprova consumo zero nem gratuidade ilimitada. Valores posteriores podem refletir contabilização do fornecedor.

## Licença

O plano Free permite a área de prévia não comercial. Não inclui licença para anúncios; a interface informa essa condição. O backend recusa pedidos marcados como comerciais quando a conta não tem um plano reconhecido com licença comercial. Não foi contratado ou alterado plano. Após mudança de plano no fornecedor, **Atualizar vozes e saldo** reconsulta as condições da conta. Áudio gerado no Free não ganha licença retroativa com uma assinatura posterior.

## Persistência e proteção

- Migração `20261106224146_elevenlabs_audio.sql` aplicada e reconciliada com o histórico remoto.
- Tabela `mv_audio_generations` com RLS forçada, leitura somente do proprietário e gravação/claim somente no backend.
- Bucket `mv-video-assets` permanece privado, agora aceitando `audio/mpeg`. URLs assinadas duram cinco minutos e podem ser renovadas pelo dono do resultado.
- Mesmo usuário/texto/voz/modelo/finalidade reutilizam o áudio concluído. Claim atômico evita duas sínteses concorrentes; envio incerto não é repetido automaticamente. Há limite de quatro novas solicitações por minuto por conta.
- Chaves, respostas brutas e comandos arbitrários não são enviados ao navegador.
- A função técnica temporária de verificação foi desativada e retorna 410; não deixa um caminho público de geração.

## Validação

165 testes Node aprovados, lint, TypeScript frontend/Edge e build estático das 17 rotas aprovados. Testes Chromium com sessão/respostas controladas em 1440×900 e 390×844 confirmaram o cartão de voz, seleção, prévia, ausência de overflow e preservação das ferramentas de vídeo após falha 503 na atualização de disponibilidade. A síntese real foi testada separadamente com as credenciais do runtime; não foi usado login pessoal do responsável nem criada nova tarefa de vídeo.

Fontes oficiais: [síntese](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [vozes](https://elevenlabs.io/docs/api-reference/voices/search), [licença](https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform).
