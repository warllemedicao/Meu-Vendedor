# Geração com recursos gratuitos

Política solicitada pelo responsável e implementada em 06/11/2026. Este documento prevalece sobre os procedimentos anteriores de ativação de geração paga em `VIDEOS_IA.md` e `CONTINUAR_AMANHA.md`.

## Comportamento implementado

- Runtime de vídeo opera exclusivamente em `free-only`: não lê flags antigas para autorizar pagamentos, não reserva orçamento em USD e não habilita recarga, assinatura ou faturamento.
- A fila e o processador não dependem de `MV_AI_ALLOW_PAID_GENERATION`, allowlist paga, conversão Magic Hour ou orçamentos positivos. `MV_AI_FREE_ONLY_ENABLED=false` é o interruptor de pausa; ausente, o modo gratuito fica ativo quando infraestrutura/autenticação estão configuradas.
- Não existe teto diário de vídeos ou limite de admissão por tarefas esperando créditos no Meu Vendedor. As cotas e os limites dos fornecedores continuam valendo. Isso não garante quantidade diária, prazo de conclusão ou recursos de infraestrutura infinitos.
- Cada etapa escolhe somente adaptadores compatíveis. Falta de créditos, indisponibilidade ou rate limit permitem tentar outra opção elegível, sem perguntar qual IA usar.
- Se nenhuma opção gratuita estiver disponível, a tarefa fica `queued` / `awaiting_free_credits`, preserva a imagem pronta e recebe `next_attempt_at`. Não é concluída nem marcada como falha por falta de crédito.
- A fila reavalia automaticamente via cron. O intervalo padrão de indisponibilidade é 15 minutos; cooldowns mais curtos do provedor podem antecipar a reavaliação. O intervalo técnico é limitado entre 60 segundos e uma hora, sem gerar chamadas de inferência enquanto não houver elegibilidade.
- Pedidos novos podem avançar enquanto outros aguardam. O usuário pode cancelar um pedido em espera, sem consultar novamente o provedor anterior.
- Cache privado, idempotência e etapas persistidas continuam ativos. Uma submissão aceita/incerta não é enviada novamente automaticamente: sua reserva é conservada para evitar duplicar consumo.

## Como o aplicativo impede cobrança

Uma credencial, saldo positivo ou estimativa de preço não comprovam gratuidade. Para imagem/vídeo, o adaptador só pode ser acionado quando existir registro válido, por conta/provedor/modelo, em `mv_ai_free_allowances`, com:

1. `enabled=true` e `billing_guard='free-plan-hard-stop'`: a conta/rota realmente impede cobrança no próprio fornecedor ao esgotar a franquia. Não basta definir um número no aplicativo se a API puder faturar o excedente.
2. `remaining_units` composto somente de unidades gratuitas verificadas. Não converter saldo comprado, assinatura, crédito misto ou saldo desconhecido em gratuito.
3. `valid_until` no futuro e confirmação do uso comercial aplicável. Registrar a origem/checagem em `evidence`, sem valores de chaves, tokens ou dados sensíveis.
4. Modelo e unidade correspondentes ao adaptador: Cloudflare FLUX.2 em neurons estimados, Magic Hour LTX-2.5 em créditos, Replicate HappyHorse em segundos do modelo configurado.

O worker reserva unidades em uma transação com lock no registro do provedor. A mesma tarefa/etapa não reserva duas vezes. Rejeição confirmada libera a reserva; aceitação ou envio incerto conserva o consumo. A liberação de uma franquia antiga não aumenta o saldo de uma franquia renovada.

As tabelas de cotas e reservas têm RLS habilitada/forçada e acesso exclusivo ao backend. As funções são `SECURITY INVOKER`, com execução revogada de `PUBLIC`, `anon` e `authenticated`. Não há edição dessas garantias pelo visitante.

**Estado remoto desta entrega:** os cinco registros de cotas foram criados como desabilitados, `unverified`, saldo zero. Isso significa **não comprovado**, não uma consulta que concluiu que as contas estão sem saldo. Nenhum valor gratuito, licença ou bloqueio de cobrança foi inventado. Antes da primeira geração real, verificar uma vez as condições efetivas das contas e registrar a franquia gratuita correspondente.

## Renovação automática

`next_reset_at` sozinho nunca repõe créditos. Para uma franquia recorrente documentada, configurar também `renewal_period_seconds` e `renewal_units` com os valores e o calendário do fornecedor. O aplicativo renova o contador uma vez por período, usando uma nova `grant_revision`, somente enquanto a prova de gratuidade e o hard stop estiverem válidos.

Para bônus de cadastro, promoção de uso único ou renovação desconhecida, deixar esses dois campos nulos. O pedido continua esperando até existir nova disponibilidade comprovada. Não assumir que créditos do site são créditos da API, nem que todas as contas renovam diariamente.

Ao registrar manualmente um novo saldo/franquia, também gerar uma nova `grant_revision`; isso impede que liberações de reservas antigas aumentem o saldo recém-verificado.

Essa configuração é administrativa e não exige uma escolha ou confirmação do usuário a cada vídeo. Mudanças de plano, modelo ou chave exigem revalidar a garantia de não cobrança. O controle local não altera limites, condições de uso ou faturamento do fornecedor.

## Roteiros

- OpenRouter usa exclusivamente `openrouter/free`, com `provider.max_price` igual a zero para prompt, completion, request e image. Não são enviados modelos pagos alternativos.
- Gemini e Groq só participam quando o registro da conta/modelo comprovar plano gratuito com hard stop; a chave cadastrada não habilita chamadas automaticamente.
- Sem serviço gratuito elegível ou após falhas, a sugestão local permanece disponível e é identificada como local. Essa sugestão não é um vídeo final.
- Um erro ao verificar elegibilidade não libera o serviço: continua para outra opção segura ou para a sugestão local.

## Provedores e limites atuais

O roteamento de imagem usa Cloudflare; o de vídeo possui Magic Hour e Replicate. O cadastro de novas ferramentas não as transforma em adaptadores. Runway, Hugging Face, Modal e Kaggle ainda precisam de contratos/modelos/endpoints implementados e verificação de gratuidade. Voz, lip sync e montagem multicena continuam pendentes conforme `VIDEOS_IA.md`.

A política é extensível a outros adaptadores, mas não promete usar todas as chaves ou produzir um MP4 quando nenhuma API gratuita compatível estiver disponível. O modo gratuito também não modifica custos/limites de hospedagem, armazenamento, tráfego ou dos serviços já existentes.

## Validações

116 testes aprovados, incluindo cotas/reservas em PostgreSQL local, proteção de acesso, mais de 100 pedidos, renovação periódica sem crédito fictício, fallback, espera e retomada com imagem preservada. Teste focado de cancelamento repetido após ajuste final. Lint, TypeScript frontend/Edge e build estático das 17 rotas passaram.

Migração `20261106024913_free_only_video_routing.sql` aplicada no projeto `jzchlrvxdaffnrgbvabv`. Funções `video-generation` v24 e `video-generation-worker` v7 publicadas; autenticação preservada. SQL remoto confirmou RLS forçada e ausência de acesso por `anon`/`authenticated` às cotas/reservas. Nenhuma geração de IA foi executada e nenhuma conta foi declarada gratuitamente financiada sem verificação.

## Referências

- [Cloudflare: franquia, excedente e diferenças entre Free/Paid](https://developers.cloudflare.com/workers-ai/platform/pricing/).
- [OpenRouter: limite máximo de preço por provedor](https://openrouter.ai/docs/guides/routing/provider-selection#max-price).
- [OpenRouter: rota de modelos gratuitos](https://openrouter.ai/openrouter/free).
- [Magic Hour: detalhes da conta e saldo](https://docs.magichour.ai/api-reference/account/get-account-details).
- [Magic Hour: franquia de ferramentas do site não repõe crédito de API](https://help.magichour.ai/en/articles/16063259-no-signup-product-and-tool-routes-current-daily-allowances).
- [Supabase: isolamento e concessão de privilégios com RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Publicação confirmada

Worker `meu-vendedor` atualizado para `1fb26204-b970-45c3-b285-63365d30be0b`, preservando os dois crons e os Secrets. Runtime Supabase registrou `processor_available=true`, `billing_mode=free-only` e `paid_generation_allowed=false`. Esses estados confirmam disponibilidade da fila/processador, não saldo gratuito comprovado de imagem/vídeo. O registro de comprovação é administrativo e precisa refletir as contas reais antes de liberar esses adaptadores.

Advisor de performance sem alerta de chave estrangeira sem índice. As oito tabelas internas sem políticas de cliente são intencionais; cotas e reservas novas tiveram leitura anônima/autenticada negada. O alerta preexistente de proteção Auth contra senhas vazadas continua separado desta entrega.

A interface publicada foi verificada em Chromium em 1440×1000 e 390×844: navegação entre as três etapas, produção e biblioteca sem erros de JavaScript ou overflow horizontal.
