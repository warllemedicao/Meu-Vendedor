# Política vigente — créditos das contas

> **Conta e estratégia Google — 06/11/2026:** acesso e lojas centralizados em `/entrar`; fluxo OAuth Google implementado, mas provedor remoto ainda desabilitado e dependente de Client ID/Secret. Links externos do Flow removidos do estúdio. Nova direção: geração via navegador no servidor e publicação integrada, ainda não implantadas. Estado vigente e ativação em [CONTA_E_ESTRATEGIA_GOOGLE.md](./CONTA_E_ESTRATEGIA_GOOGLE.md).

> **Saldos e Google Flow — 06/11/2026:** painel aberto abaixo de Gerar vídeo com consultas oficiais e unidades distintas. Auditoria: Magic Hour 456, Runway API 0, OpenRouter US$ 0 disponível; demais saldos não verificados. Assinatura Plus do Flow não foi conectada à API. Pesquisa, limites e caminho de integração em [SALDOS_E_GOOGLE_FLOW.md](./SALDOS_E_GOOGLE_FLOW.md).

> **Primeiro vídeo confirmado e ajustes — 06/11/2026:** responsável confirmou geração com Carla/produto; banco registra uma tarefa concluída. Correções de áudio, player e saldo Magic Hour em [MAGIC_HOUR_AJUSTES.md](./MAGIC_HOUR_AJUSTES.md). Este registro substitui afirmações históricas de ausência de geração real. A fala após a correção ainda precisa ser conferida em um novo resultado.

Atualização de 06/11/2026 solicitada explicitamente pelo responsável: remover o bloqueio de tentativas pagas e permitir usar os créditos das ferramentas com troca automática. Este documento substitui a antiga exigência `free-only` e as instruções históricas de liberação manual de cotas.

## Comportamento ativo

- Runtime usa `account-credits`. Não exige `mv_ai_free_allowances`, prova de saldo gratuito, hard stop, autorização comercial administrativa, orçamento em USD nem allowlist paga antes de tentar os adaptadores integrados.
- As flags antigas `MV_AI_FREE_ONLY_ENABLED`, `MV_AI_ALLOW_PAID_GENERATION` e configurações de orçamento não bloqueiam esse runtime. Credenciais e infraestrutura são necessárias para chamar as APIs.
- Quando o saldo é consultável, o app evita uma tentativa que sabidamente excederia os créditos disponíveis. Quando a API não informa saldo/custo, permite a tentativa e trata a resposta real.
- Imagem: Cloudflare FLUX.2 com referências do produto/apresentador e reutilização do cache privado.
- Vídeo: Magic Hour LTX-2.5, depois Replicate HappyHorse. Rejeição confirmada por falta de créditos, autenticação, indisponibilidade ou rate limit permite avançar para outra opção compatível. Não há nova pergunta ao usuário a cada troca.
- Roteiro: OpenRouter `openrouter/free` com preço máximo zero primeiro, depois Groq, Gemini e sugestão local. Chaves Groq/Gemini não precisam mais de concessão gratuita local para participar.
- Se todos os candidatos estiverem indisponíveis, o pedido aguarda e é reavaliado pelo cron, preservando a imagem pronta. O nome interno legado dessa etapa continua `awaiting_free_credits`; sua mensagem no modo atual é `waiting_for_resources`.
- Sem teto diário de pedidos imposto pelo app. Os limites reais de saldo, frequência, modelos e planos dos fornecedores continuam valendo.

## Faturamento e registros

O aplicativo não compra créditos, não contrata planos e não ativa recarga. As chamadas podem, porém, consumir saldo comprado ou gerar cobrança conforme o faturamento já configurado no fornecedor. Portanto, a interface não promete mais geração sem cobrança.

Saldo/custo desconhecido não é convertido em gratuito. Magic Hour registra custo USD desconhecido como `null`, conservando o valor de créditos retornado pela API; esse caso não é mais confundido com submissão incerta. Estimativas documentadas não são comprovantes de fatura ou de gratuidade.

As tabelas e utilitários da antiga política gratuita permanecem para histórico/compatibilidade, mas não bloqueiam o caminho ativo. Seus registros desabilitados não precisam ser falsamente ativados para liberar uma tentativa.

## Proteções técnicas preservadas

Autenticação, isolamento por usuário, Storage privado, validação de referências, compatibilidade de modelo, idempotência, lease da fila e cooldowns continuam ativos. Timeout ou submissão aceita/incerta não provoca outro envio automático, pois isso poderia duplicar consumo. Após confirmação de falha remota, o fluxo pode tentar outro provedor.

A remoção do bloqueio administrativo de licença não comprova direitos comerciais sobre modelo, imagem ou resultado. Nenhuma licença foi declarada confirmada por essa alteração.

## Testar no app

1. Abrir https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/videos e entrar na conta.
2. Informar produto/foto, selecionar Ana ou Lucas e manter vídeo de 6 segundos, vertical 9:16.
3. Na etapa de produção, clicar em **Verificar disponibilidade** para atualizar os serviços configurados; essa consulta não gera conteúdo.
4. Clicar em **Gerar vídeo**. A produção usa as APIs, acompanha a fila e guarda o resultado privado quando concluído. A verificação de configuração não garante saldo, aceitação ou sucesso da geração.

Runway, Hugging Face, Modal e Kaggle ainda não possuem adaptadores neste pipeline; presença de credencial não implementa integração. Imagem continua com um único adaptador. Áudio, lip sync e montagem multicena permanecem pendentes. Esta publicação não comprova um MP4 real nem quinze vídeos diários.

## Publicação

Supabase: `video-generation` v28 e `video-generation-worker` v12, com autenticação preservada. Não houve migração ou mudança de Secrets. A consulta anterior à publicação encontrou a fila vazia; nenhuma tarefa de outro usuário foi criada ou alterada para testar.

Cloudflare publicado na versão `be2a2fc6-3ac6-4db0-aa48-b46d8b4c5926`, preservando os dois crons. O runtime Supabase confirmou `processor_available=true`, `billing_mode=account-credits` e `paid_generation_allowed=true` em 06/11/2026 às 03:41:37 UTC. O heartbeat autenticado também foi atualizado nesse horário; fila vazia.

Validação final: 133 testes aprovados, lint, TypeScript Edge e build estático das 17 rotas aprovados. Os testes incluem falta de crédito com troca automática, saldo/custo desconhecidos sem bloqueio, custo Magic Hour nulo sem duplicação, espera/retomada e prioridade da rota gratuita de roteiro. Navegação pública em Chromium em desktop e celular verificada sem erros JavaScript ou overflow horizontal. A validação não iniciou inferência real.
