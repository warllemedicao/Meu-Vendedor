# Retomada — Meu Vendedor

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
