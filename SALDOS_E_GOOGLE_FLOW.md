# Saldos das IAs e Google Flow — 06/11/2026

> **Fechamento de 06/11/2026:** seletor acima de Gerar vídeo publicado; escolha explícita preservada sem fallback para outro serviço. Google Omni API integrado à fila. Conexão experimental Flow com estados, expiração e tratamento de cota; geração Flow sob demanda ainda bloqueada pela implantação do executor externo. YouTube Create móvel sem integração automática validada. Supabase republicado: `video-generation` v35 e `video-generation-worker` v19; migração Google já aplicada. Entregas, limites e próximo passo em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md). Os registros abaixo são históricos quando divergirem deste estado.

> **Google, Flow e YouTube — 06/11/2026:** cadastro por e-mail confirmado; OAuth Google continua desabilitado e sem Client ID/Secret nos aliases verificados. Conexão experimental Flow por navegador remoto e alternativa Gemini Omni adicionadas; login remoto e geração real Google ainda não validados. Estado vigente em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md). Este registro prevalece sobre o histórico abaixo.

> **Conta e estratégia Google — 06/11/2026:** acesso e lojas centralizados em `/entrar`; fluxo OAuth Google implementado, mas provedor remoto ainda desabilitado e dependente de Client ID/Secret. Links externos do Flow removidos do estúdio. Nova direção: geração via navegador no servidor e publicação integrada, ainda não implantadas. Estado vigente e ativação em [CONTA_E_ESTRATEGIA_GOOGLE.md](./CONTA_E_ESTRATEGIA_GOOGLE.md).

## Entrega e consulta real

O painel **Saldos e disponibilidade** fica aberto logo abaixo de **Gerar vídeo**. Consulta contas/catálogos oficiais no backend autenticado, em paralelo, sem inferência. Mostra unidade, horário, erros e painel do fornecedor. Atualiza ao abrir, por botão e ao observar uma tarefa passar para concluída/falha/cancelada. Valores desconhecidos não viram zero; credencial cadastrada não comprova saldo nem adaptador de geração.

Consulta remota de 06/11/2026, 10:26 UTC, com os Secrets existentes:

| Serviço | Resultado | Critério e limitação |
| --- | --- | --- |
| Magic Hour | 456 créditos | `GET /v1/account`, campo `credits`; saldo agregado, não promessa de gratuidade |
| Runway | 0 créditos | `GET /v1/organization`, `creditBalance`, header `X-Runway-Version: 2024-11-06`; saldo do projeto API, não da assinatura do site; adaptador de vídeo continua pendente |
| OpenRouter | US$ 0 disponível | `/api/v1/credits` respondeu; compras totais 0 e uso 0,07996815. Disponível exibido como máximo entre zero e compras menos uso; isso não reconstrói franquias gratuitas nem a fatura. `/api/v1/key` retornou `is_free_tier=true`, limite da chave sem valor. Roteiro `openrouter/free` continua separado do saldo pago |
| Gemini | Catálogo responde; saldo desconhecido | A chave existente autentica o modelo de roteiro. Catálogo não informa saldo API e não dá acesso à assinatura Flow |
| Cloudflare | Consulta de assinatura responde; saldo Workers AI desconhecido | Retorno `teams_free` é Teams, não franquia de Workers AI; não deduzir saldo ou plano de IA |
| Groq | Catálogo e modelo configurado respondem; saldo desconhecido | Saldo/uso permanecem no painel; limites de taxa não equivalem a créditos |
| Replicate | Conta responde; saldo desconhecido | Endpoint de conta não fornece saldo; consulta manual de faturamento |
| Hugging Face | Identidade responde; saldo desconhecido | `isPro=false` não informa créditos de inferência; adaptador de vídeo pendente |
| Modal | Par de credenciais cadastrado; consulta de consumo pendente | Há relatórios oficiais via SDK Python `Workspace.billing.summary/report`, mas esse caminho não está integrado ao runtime Edge. Não foi inventado endpoint HTTP nem exposto Secret; adaptador de inferência também pendente |
| Kaggle | Credencial cadastrada; cota não consultada | Recursos de notebooks/GPU/TPU não são saldo de um adaptador de vídeo. Não foi encontrado contrato público aplicável para leitura dessa cota com o token existente |

Quando `/credits` do OpenRouter não for autorizado, o app tenta exibir o `limit_remaining` de `/key`, identificado como **limite da chave**, em USD. Sem ambos, informa saldo no painel. Não mostra um limite de chave como se fosse saldo total. Todas as respostas são reduzidas a campos permitidos; nenhuma chave, identificação pessoal ou resposta bruta segue para o navegador ou relatório.

Fontes: [Runway Organization API](https://docs.dev.runwayml.com/api/), [OpenRouter créditos](https://openrouter.ai/docs/api/api-reference/credits/get-credits), [OpenRouter chave](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [Groq API](https://console.groq.com/docs/api-reference), [Replicate HTTP](https://replicate.com/docs/reference/http), [HF faturamento](https://huggingface.co/docs/hub/billing), [Modal Workspace](https://modal.com/docs/sdk/py/latest/Workspace).

## Assinatura do Google Flow

O responsável informou Google AI Plus. Não houve login na conta Google nem consulta do plano/saldo pessoal. A página pública do Flow redireciona para `flow.google.com` e exige login para a área pessoal.

A ajuda oficial informa 50 créditos diários e 200 mensais adicionais para Plus; Pro tem 1.000 mensais adicionais. Os créditos diários e mensais seguem regras de renovação próprias e não acumulam. Para não Ultra, Veo 3.1 Lite gera 4, 6 ou 8 segundos em 720p por 10 créditos por resultado. Custos/opções exibidos no Flow prevalecem e uma solicitação com múltiplos resultados consome por resultado. Créditos de fornecedores diferentes não têm valor monetário equivalente.

Na pesquisa do site e da documentação oficial, **não foi encontrada API pública do Flow que permita ao Meu Vendedor gastar a franquia Plus**. A documentação de saldo aponta a interface Flow/Google One. Isso é uma conclusão da pesquisa, não uma afirmação de que Google nunca oferecerá integração. Login Google genérico ou a chave Gemini existente não constituem autorização para APIs internas do Flow. Nenhum token/cookie de navegador foi solicitado ou reutilizado.

Fonte: [Google Flow — créditos, planos e custos](https://support.google.com/flow/answer/16526234?hl=pt-BR).

## Caminhos de uso

**Com a assinatura atual:** preparar produto, personagem e roteiro no Meu Vendedor; usar **Copiar direção para Flow**, abrir o Flow, fornecer as referências e gerar na própria conta Google. Os botões estão visíveis no estúdio. O arquivo continua sendo produzido/baixado pelo Flow; não foi implementada importação automática para a biblioteca. O app não sincroniza nem estima o saldo pessoal do Flow.

**Geração automática dentro do Meu Vendedor:** criar um adaptador para a API oficial Gemini e validar projeto, habilitação/acesso ao modelo, faturamento/API e armazenamento privado. A chave Gemini já está cadastrada para roteiro, mas seu acesso a vídeo e financiamento não foram validados. A documentação atual recomenda `gemini-omni-1.2-flash` pela Interactions API, com áudio nativo, referência de imagem e geração/edição de vídeo. Veo Preview na Gemini API foi encerrado; não copiar contratos históricos. Ainda faltam implementação de submissão, retomada/polling, download e validação de duração/proporção/áudio. A elegibilidade e os custos precisam ser consultados para essa conta; o saldo Plus/Flow não é usado automaticamente.

A API tem faturamento por projeto, com Prepay/Postpay e controles próprios. Não foi feita compra de créditos, alteração de faturamento, configuração de projeto ou inferência. Benefícios eventualmente disponíveis no Google Developer Program são distintos da franquia de vídeo do Flow e exigem verificação própria.

Fontes: [Vídeo na API Gemini](https://ai.google.dev/gemini-api/docs/video), [Billing Gemini](https://ai.google.dev/gemini-api/docs/billing).

## Publicação e validação

Supabase `video-generation` v30 e `video-generation-worker` v14; Cloudflare `fac57c36-e8cd-4d88-b085-d9456090213c`, preservando autenticação, Secrets e dois crons. Sem migração. Auditoria antecipada somente para reler contas; nenhum job criado. Consultas de conta não habilitam adaptadores nem alteram o roteamento de vídeo.

137 testes aprovados; lint, TypeScript frontend/Edge e build estático de 17 rotas aprovados. Chromium com sessão e respostas locais simuladas confirmou painel abaixo do botão, atualização e distinção de saldos em 1440×900 e 390×844, sem overflow. Esses testes não representam login real de usuário ou geração de vídeo. Os números reais acima vieram da auditoria remota separada.
