# Retomada — Meu Vendedor

> **Conta e estratégia Google — 06/11/2026:** acesso e lojas centralizados em `/entrar`; fluxo OAuth Google implementado, mas provedor remoto ainda desabilitado e dependente de Client ID/Secret. Links externos do Flow removidos do estúdio. Nova direção: geração via navegador no servidor e publicação integrada, ainda não implantadas. Estado vigente e ativação em [CONTA_E_ESTRATEGIA_GOOGLE.md](./CONTA_E_ESTRATEGIA_GOOGLE.md).

> **Saldos e Google Flow — 06/11/2026:** painel aberto abaixo de Gerar vídeo com consultas oficiais e unidades distintas. Auditoria: Magic Hour 456, Runway API 0, OpenRouter US$ 0 disponível; demais saldos não verificados. Assinatura Plus do Flow não foi conectada à API. Pesquisa, limites e caminho de integração em [SALDOS_E_GOOGLE_FLOW.md](./SALDOS_E_GOOGLE_FLOW.md).

> **Primeiro vídeo confirmado e ajustes — 06/11/2026:** responsável confirmou geração com Carla/produto; banco registra uma tarefa concluída. Correções de áudio, player e saldo Magic Hour em [MAGIC_HOUR_AJUSTES.md](./MAGIC_HOUR_AJUSTES.md). Este registro substitui afirmações históricas de ausência de geração real. A fala após a correção ainda precisa ser conferida em um novo resultado.

> **Política vigente — créditos da conta, 06/11/2026:** por solicitação explícita do responsável, o runtime não exige comprovação prévia de gratuidade, orçamento local em USD ou ativação de cotas administrativas para tentar as APIs integradas. Usa saldo quando consultável e permite tentativa quando ele é desconhecido, com fallback e espera automática. O fornecedor pode cobrar conforme o plano da conta. Estado e instruções em [CREDITOS_DA_CONTA.md](./CREDITOS_DA_CONTA.md). Este registro substitui as políticas free-only e os bloqueios históricos abaixo.

> **Teste no app — 06/11/2026:** diagnóstico autenticado de cotas de imagem/vídeo adicionado ao estúdio, com atualização sem inferência. Sem cota elegível, o botão informa “Salvar pedido na fila”; não indica geração imediata. Nenhuma geração real foi enviada nesta revisão, nenhum teste de API foi concluído e nenhuma cota foi ativada. Guia e impedimentos atuais em [TESTE_NO_APP.md](./TESTE_NO_APP.md). Este registro prevalece sobre instruções históricas abaixo.

> **Auditoria atual — 06/11/2026:** token Cloudflare Billing Read validado; falha real do cron corrigida e execução autenticada confirmada. Auditoria privada e horária das contas implantada. Magic Hour informou plano free e 500 créditos agregados; as franquias gratuitas de imagem/vídeo e o bloqueio de cobrança ainda precisam de comprovação. Nenhum vídeo real foi gerado. Estado completo e pendências em [AUDITORIA_IA.md](./AUDITORIA_IA.md); este registro prevalece sobre estados e versões históricos abaixo.

> **Política vigente — somente gratuito, 06/11/2026:** modo `free-only` implementado e publicado no Supabase, sem teto diário de pedidos do aplicativo. Fallback automático entre opções compatíveis, reservas atômicas de cotas gratuitas, espera/retomada com etapas preservadas e renovação apenas de franquias periódicas comprovadas. Rotas pagas ou desconhecidas são bloqueadas. As cotas de imagem/vídeo ainda não têm comprovação de gratuidade registrada; pedidos podem aguardar por isso. Instruções e limites reais em [MODO_GRATUITO.md](./MODO_GRATUITO.md). Este bloco substitui as instruções históricas de ativar geração paga abaixo.

> **Atualização do estúdio — 06/11/2026:** interface em três áreas e etapas; fallback de roteiro Gemini/Groq/OpenRouter; correções de retomada, finalização e fallback de vídeo; cache privado de referências/composição e capacidade técnica acima de 15 entregas/dia. Migração `20261106022136_video_production_cache.sql` aplicada ao Supabase. Runtime confirmou credenciais dos serviços, mas flags de geração, allowlist, limites e conversão Magic Hour estão ausentes/desligados. Geração real ainda não foi executada. Pendências exatas e estado atual em [VIDEOS_IA.md](./VIDEOS_IA.md). Este bloco prevalece sobre o histórico abaixo.

Revisão autenticada em 06/11/2026. Este documento substitui os registros anteriores que indicavam falta de acesso ao Supabase.

## Concluído e confirmado

- Supabase conectado nesta sessão: projeto `meu-vendedor`, referência `jzchlrvxdaffnrgbvabv`, status ACTIVE_HEALTHY.
- Quinze tabelas públicas `mv_*`, todas com RLS habilitada. Cinco tabelas internas continuam sem políticas de cliente por desenho; não criar políticas públicas para remover avisos informativos.
- Cinco migrações anteriores conferidas no histórico remoto. Nova migração `20261106020118_foreign_key_indexes.sql` aplicada e conferida: oito índices de apoio a chaves estrangeiras, sem alterações nos dados ou permissões.
- Advisor de performance deixou de apontar chaves estrangeiras sem índice. Avisos informativos de índices ainda sem uso são esperados em tabelas com pouco tráfego; não removê-los por isso.
- Saúde sem alertas. Segurança ainda aponta proteção contra senhas vazadas desativada.
- Cinco funções ACTIVE: `marketplace` v19, `catalog` v18, `catalog-public` v18, `video-generation` v20 e `video-generation-worker` v3. Não foi necessário republicar funções sem alteração de código.
- HTTP público: catálogo Shopee/Amazon/TikTok retorna 503/`catalog_not_configured`; `catalog` e `video-generation` sem sessão retornam 401. GET do worker retorna 405; isso confirma restrição de método, não estado das flags.
- Fila de vídeos sem tarefas na consulta. Não foram criados jobs, alterados Secrets, lidos valores de credenciais ou consumidos créditos de IA.

## Shopee: próximo passo necessário

O responsável informou “shopee, sem limites”. Shopee é o acesso comercial informado; isso não fornece a credencial nem comprova licença de redistribuição pública. Não há conexão/produto Shopee registrado no banco consultado. A vitrine pública também não está configurada.

Para conectar a própria conta, entrar no aplicativo e abrir **Contas Conectadas → Conectar Shopee**. Informar App ID e Secret da Affiliate Open API na tela segura. Não usar senha da loja nem enviar Secrets pelo chat.

Para a vitrine pública, cadastrar **`MV_PUBLIC_CATALOG_CONFIG`** em [Edge Function Secrets](https://supabase.com/dashboard/project/jzchlrvxdaffnrgbvabv/functions/secrets), com o formato descrito em `CATALOGO_APIS.md`, somente após confirmar que o acesso do serviço permite a exibição pública. Não reaproveitar automaticamente credenciais privadas para atender visitantes. Depois consultar a função pública e conferir produtos reais.

## Pendências que impedem declarar tudo pronto

1. Credencial Shopee aprovada ainda precisa ser cadastrada e validada; fontes Amazon/TikTok também não estão configuradas.
2. Entrega de e-mails de confirmação/recuperação e SMTP próprio não foram validados.
3. Habilitar proteção contra senhas vazadas no painel Auth, conforme disponibilidade do plano. Não houve alteração de plano/faturamento.
4. Execução dos crons Cloudflare continua sem nova comprovação nesta revisão; configuração e implantação anteriores em `CLOUDFLARE.md`.
5. Flags, nomes de Secrets e saldos/licenças dos provedores de vídeo não foram reconsultados: as ferramentas conectadas não oferecem gerenciamento de Secrets ou configuração Auth. Não inferir estado atual a partir de registros antigos.
6. Geração real de vídeo, referências originais de Carla/Rafael, publicação social, automações, tendências e relatórios comerciais continuam pendentes. “Sem limites” não substitui credenciais, saldo e direitos dos provedores nem torna essas funcionalidades implementadas.

## Validação e entrega

O teste PostgreSQL agora aplica a migração de índices duas vezes, verifica cobertura de todas as chaves estrangeiras e mantém os testes de isolamento/RLS. Os comandos e o resultado final desta revisão ficam em `SUPABASE.md` e `PUBLICACAO.md`.

O frontend continua no Worker existente. A entrega desta revisão é uma migração de banco e documentação; não há mudança visual para publicar. Supabase não hospeda a exportação Next.js deste projeto.

## Retomar

Conferir `git status`, ler este arquivo e `SUPABASE.md`, validar os acessos externos que forem cadastrados e concluir cada pendência com evidência. Nunca apresentar testes simulados como sucesso comercial. Manter credenciais fora do Git e do chat.

## Validação desta revisão — 06/11/2026

89 testes aprovados, lint e typecheck Edge aprovados. Typecheck frontend aprovado e repetido pelo build estático; exportação das 17 rotas concluída. O sandbox retornou saída vazia na captura do subprocesso TypeScript (`--showConfig`); o mesmo build fora do sandbox passou, sem alteração no código Next.js. A migração local usa a versão `20261106020118`, igual ao histórico criado pelo Supabase MCP.
