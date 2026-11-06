# Teste pelo aplicativo

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
