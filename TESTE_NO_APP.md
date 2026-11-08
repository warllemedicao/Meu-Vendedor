# Teste pelo aplicativo

## Estado vigente — 08/11/2026: foto falante com produto

Carla e Rafael têm referências fotográficas realistas, plus size, próprias e selecionáveis. Os quatro perfis ficam em `mv_presenter_profiles`, com identidade, arquivo/hash e voz fixa Google. Quatro bases foram validadas com MP4s reais de 10–13 segundos e habilitadas para o formato **foto falante + cartão com a imagem enviada do produto**, em 720×1280.

O botão principal usa o fluxo Google TTS/MuseTalk. Histórico privado, cancelamento cooperativo, renovação de acesso e recuperação sem reenviar a GPU foram implementados. Corpo, roupa e cenário permanecem os da base; não há geração nativa 4K, sessão persistente de modelos ou garantia de 15 vídeos/dia.

Estado consolidado, validações, publicação e limites: [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md). **Este bloco prevalece sobre os registros históricos abaixo**, inclusive referências antigas a bases desabilitadas ou geração Kaggle ainda não implementada.

## Histórico — piloto inicial Google + MuseTalk de 08/11/2026

A arquitetura sincronizada foi implementada e publicada como piloto: base aprovada no Supabase → voz fixa Google → MuseTalk 1.5/Kaggle T4 → FFmpeg → MP4 privado. Dois MP4s reais foram concluídos: três segundos em 152,378 s de notebook; 8,496 s de fala em 127,829 s de notebook e 135 s entre registro da tarefa e entrega. Inferência/codificação silenciosa: 7,829 s e 21,279 s; pico de 6,54 GiB. Boca/rosto ainda precisam de ajuste visual; bases permanecem sem aprovação para anúncios. Não há garantia de 15 vídeos/dia nem de 4K. Novas gerações não acionam provedores com créditos do fluxo antigo.

Estado completo, limites e continuidade: [ARQUITETURA_VIDEO_SINCRONIZADO.md](./ARQUITETURA_VIDEO_SINCRONIZADO.md). Os registros anteriores abaixo são históricos.

> **Estado vigente — Modal e ElevenLabs, 06/11/2026:** navegador Flow sob demanda implantado no Modal e testado com abertura real, autenticação e encerramento. Falta o login Google pessoal e implementar/validar geração e importação de MP4; Flow continua indisponível para gerar. Diagnóstico ElevenLabs publicado no Supabase (funções de vídeo v38/v23); chave `ELEVENLABS_API` autenticada: plano Free, 10.000 créditos disponíveis e licença comercial não incluída. Estado e próximos passos em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md) e [ELEVENLABS.md](./ELEVENLABS.md). Registros divergentes abaixo são históricos.

> **Google, Flow e YouTube — 06/11/2026:** cadastro por e-mail confirmado; OAuth Google continua desabilitado e sem Client ID/Secret nos aliases verificados. Conexão experimental Flow por navegador remoto e alternativa Gemini Omni adicionadas; login remoto e geração real Google ainda não validados. Estado vigente em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md). Este registro prevalece sobre o histórico abaixo.

A política ativa agora é **créditos da conta**: o app permite tentar as APIs integradas sem comprovação prévia de gratuidade nem orçamento local em USD. Consulte [CREDITOS_DA_CONTA.md](./CREDITOS_DA_CONTA.md), que prevalece sobre a política gratuita anterior.

1. Abra [o estúdio](https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/videos) e entre na conta.
2. Informe os dados e a foto do produto.
3. Escolha Ana ou Lucas. A geração atual usa 6 segundos, formato vertical e não inclui áudio.
4. Na etapa de produção, clique em **Verificar disponibilidade**. Essa consulta informa configuração, não saldo garantido, e não consome inferência.
5. Clique em **Gerar vídeo** e acompanhe em **Em produção**. Magic Hour e Replicate são alternativas para a etapa de vídeo; o quadro inicial usa Cloudflare ou cache.
6. Se não houver crédito/disponibilidade, o app tenta outro serviço compatível e, se todos falharem, aguarda para retomar. A imagem pronta é preservada.

O fornecedor pode cobrar conforme o plano da conta. O app não compra créditos, não contrata assinatura e não ativa recarga. Submissões incertas não são repetidas automaticamente.

Supabase publicado: entrada v28 / worker v12. A autenticação e o armazenamento privado continuam obrigatórios. Não foi gerado um vídeo real nesta alteração; o teste de produção poderá ser iniciado pelo responsável no app.
