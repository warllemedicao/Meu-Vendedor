# Auditoria operacional e de contas — 06/11/2026

Este é o estado atual e prevalece sobre versões e afirmações históricas nos demais documentos. O projeto continua em modo exclusivamente gratuito. A implantação técnica não comprova uma geração real nem 15 vídeos por dia.

## Correções publicadas

- O cron estava cadastrado, mas falhava antes de chamar o Supabase: o runtime Cloudflare rejeita `redirect: "error"`. As duas rotinas agora usam `manual`, rejeitam respostas de redirecionamento e não encaminham credenciais a outro destino.
- Após a correção, observou-se uma execução de vídeo com `outcome=ok`, sem exceções, na versão Cloudflare `ebd6e778-0cfc-44fd-bccc-446bbfe8359e`. O Supabase confirmou recebimento autenticado pelo heartbeat `2026-11-06T03:14:38.224Z`. A fila estava vazia; isso não é teste de produção de MP4. A rotina marketplace recebeu a mesma correção, mas sua execução periódica ainda não foi observada nesta revisão.
- Auditoria horária de contas e catálogos implementada no backend. Consultas apenas GET, com timeout, limite de resposta e sem iniciar inferência. Campos permitidos são gravados em `mv_ai_provider_audits`; nenhuma resposta bruta, token ou identificação pessoal é persistida.
- `mv_ai_audit_state` evita auditorias concorrentes e registra o recebimento das chamadas autenticadas ao worker. Ambas as tabelas têm RLS forçada, sem acesso por `anon` ou `authenticated`.
- Inventário corrigido: Modal exige ID e Secret; Cloudflare exige token e ID da conta. Uma credencial presente não equivale a serviço integrado ou gratuito.
- Groq: o modelo antigo não constava no catálogo da conta. Roteiro e auditoria agora compartilham `openai/gpt-oss-20b`, encontrado no catálogo, com parâmetros específicos desse modelo. Uma nova concessão desabilitada foi criada; nenhuma prova ou saldo do modelo antigo foi transferido.

## Resultado real das contas

Consultas de 06/11/2026, aproximadamente 03:13 UTC, feitas com as credenciais armazenadas no Supabase. Valores podem mudar; o relatório privado contém `checked_at`.

| Serviço | Observação da API | O que permanece sem comprovação |
| --- | --- | --- |
| Cloudflare | Token Billing Read válido; assinaturas retornaram `teams_free` / “Teams Free Base” | Esse plano é de Teams, não comprova Workers AI. Faltam franquia disponível, garantia de não cobrança e condições do modelo |
| Magic Hour | `tier=free`, 500 créditos, sem assinatura ativa informada | O endpoint agrega créditos; não prova origem gratuita de todo o saldo, renovação ou bloqueio de cobrança |
| OpenRouter | Chave responde, `is_free_tier=true` | Sem promessa de cota ilimitada; o roteiro mantém a rota `openrouter/free` com preço máximo zero |
| Gemini | Modelo `gemini-3.8-flash` encontrado | Catálogo não informa plano de faturamento, saldo ou hard stop |
| Groq | Chave responde; modelo antigo ausente; `openai/gpt-oss-20b` disponível e selecionado | Comprovação da modalidade gratuita da conta |
| Replicate | Endpoint de conta responde; tipo `user` | Endpoint não retorna saldo gratuito nem bloqueio de cobrança |
| Hugging Face | Identidade responde; `isPro=false` | Não comprova créditos de inferência; falta adaptador/modelo compatível |
| Runway | Credencial cadastrada | Adaptador do pipeline não implementado; saldo não consultado |
| Modal | Par de credenciais cadastrado | Falta endpoint de inferência implantado e comprovação de créditos |
| Kaggle | Token cadastrado | Não existe adaptador de inferência neste pipeline; não presumir notebooks como API de vídeo |

Nenhuma dessas observações altera automaticamente as cotas de imagem/vídeo para “gratuitas comprovadas”. Os seis registros de `mv_ai_free_allowances`, incluindo o modelo Groq antigo desabilitado, continuam sem concessão ativa. Saldo zero nesses registros significa **não verificado**, não falta de créditos constatada na conta.

## Pendências para primeira geração gratuita real

1. Comprovar o plano Workers e o saldo de Workers AI no [painel da conta](https://dash.cloudflare.com/2cd6c753710fbaba6b94e33ef662c9b3/ai/workers-ai), incluindo o bloqueio de excedente e condições do modelo de imagem. `default_usage_model=standard` isoladamente não comprova plano gratuito.
2. Comprovar quais créditos de API do Magic Hour são gratuitos e o bloqueio de cobrança, ou integrar um provedor de vídeo que forneça essas garantias. Saldo de site e saldo de API não são intercambiáveis.
3. Registrar a evidência e o saldo na concessão correspondente, seguindo [MODO_GRATUITO.md](./MODO_GRATUITO.md). Não inventar franquias nem renovação diária de bônus único.
4. Executar uma tarefa real autenticada até MP4 e verificar reutilização de imagem e fallback real. A fila vazia e testes simulados não comprovam esse resultado.

Outras lacunas do produto: segundo adaptador de imagem, adaptadores Runway/Hugging Face/Modal/Kaggle, áudio/lip sync/montagem multicena, referências Carla/Rafael, limpeza automática de Storage e deduplicação distribuída de imagens em andamento. Catálogo Shopee e entrega de e-mail continuam dependentes das configurações descritas em `CONTINUAR_AMANHA.md`; não foram declarados finalizados nesta revisão.

## Implantação e verificações

- Migração `20261106031259_provider_readiness_audit.sql` aplicada e reconciliada com o histórico remoto.
- Migração `20261106031739_groq_available_script_model.sql` aplicada. Funções publicadas: `video-generation` v26 com JWT e `video-generation-worker` v11 com autenticação própria por Secret. Worker Cloudflare: `ebd6e778-0cfc-44fd-bccc-446bbfe8359e`.
- Relatórios privados gravados para dez serviços, contando Cloudflare. Consultas não consumiram créditos de geração.
- Suite final completa: 121 testes aprovados, incluindo recusa de redirecionamento, auditoria privada e parâmetros do novo modelo Groq. Lint, TypeScript frontend/Edge e build estático das 17 rotas aprovados.
- A auditoria da versão final confirmou `configured_model_available=true` para Groq às 03:18:20 UTC. Heartbeat autenticado novamente registrado às 03:18:37 UTC. Nenhuma concessão gratuita foi ativada e nenhum job de vídeo foi criado.
- Segurança remota confirmou RLS forçada e ausência de leitura anônima/autenticada das novas tabelas. Não há alerta de FK sem índice. Tabelas internas sem políticas de cliente são intencionais; índices ainda não utilizados são informativos.
- O alerta preexistente de [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) continua pendente nas configurações Auth.

## Referências

- [Cloudflare Workers AI: franquias, excedentes e reset](https://developers.cloudflare.com/workers-ai/platform/pricing/).
- [Magic Hour: detalhes de conta e definição do saldo agregado](https://docs.magichour.ai/api-reference/account/get-account-details).
- [Groq: modelos e consulta do catálogo](https://console.groq.com/docs/models).
- [Groq: parâmetros de raciocínio específicos de GPT-OSS](https://console.groq.com/docs/reasoning).
- [Replicate: endpoint de conta](https://replicate.com/docs/reference/http#account.get).
