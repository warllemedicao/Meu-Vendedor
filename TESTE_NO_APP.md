# Teste pelo aplicativo

> **Fechamento de 06/11/2026:** seletor acima de Gerar vídeo publicado; escolha explícita preservada sem fallback para outro serviço. Google Omni API integrado à fila. Conexão experimental Flow com estados, expiração e tratamento de cota; geração Flow sob demanda ainda bloqueada pela implantação do executor externo. YouTube Create móvel sem integração automática validada. Supabase republicado: `video-generation` v35 e `video-generation-worker` v19; migração Google já aplicada. Entregas, limites e próximo passo em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md). Os registros abaixo são históricos quando divergirem deste estado.

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
