# Base Supabase — Meu Vendedor

## Diagnóstico do CI/CD — 13/11/2026

No run [43341403130](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43341403130), `migration list` encerrou com código 1 após o preflight e as validações passarem. A CLI `supabase@3.1.0` confirma suporte a `migration list --remote --password --output-format json`, `db push --remote --password --skip-vault --dry-run/--yes` e `functions deploy/list --remote`; não há flag incompatível identificada. Como o stdout JSON era redirecionado para um arquivo, um diagnóstico emitido nesse canal poderia ficar oculto; os logs não permitem determinar se foi esse o caso nem a causa do erro.

O commit `a208ffa` adiciona captura e redação de stdout/stderr em `scripts/run-supabase-cli.mjs` e passa `SUPABASE_DB_PASSWORD` explicitamente nas operações de banco. O valor não é registrado em arquivo nem impresso; erros exibem texto sanitizado e código de saída. O novo run ainda não foi obtido: o despacho manual recebeu HTTP 403, e o push não apareceu na lista de execuções. Não houve alteração remota ou aplicação de migration. Reexecutar pela interface GitHub com autorização adequada e investigar a mensagem agora visível; não contornar falhas de autenticação.

## Destinos sociais assistidos — implementação local (12/11/2026)

O agendamento aceita TikTok (`tiktok_video`), Kwai (`kwai`), Facebook Stories (`facebook_stories`) e Pinterest, além dos destinos existentes. A Edge Function valida a mesma lista; a criação mantém um registro por destino e as proteções atuais de sessão, isolamento do usuário, RLS e idempotência.

A migração `20261112200000_publication_social_destinations.sql` substitui a constraint de destinos existente para incluir os dois valores novos; não apaga registros. O guard `scripts/check-pending-migrations.mjs` classifica a operação `DROP CONSTRAINT` como alto risco. Antes de aplicá-la, verificar o histórico remoto, obter revisão independente e usar o workflow manual com ambiente protegido. A API Supabase não permitiu revalidar o histórico nesta tarefa; nenhuma migração ou Edge Function foi publicada.

## CI/CD do GitHub Actions — configuração inicial

O workflow `.github/workflows/ci-cd.yml` valida testes, lint, typechecks e build antes de qualquer publicação. Ele usa a CLI Supabase fixada em `3.1.0`, consulta o histórico remoto do projeto `jzchlrvxdaffnrgbvabv`, bloqueia divergências e operações SQL de alto risco e aplica apenas migrações pendentes com `db push --skip-vault`. Em seguida publica `publication-schedule` e as Edge Functions alteradas, respeitando o `verify_jwt` de `supabase/config.toml`, e confirma a presença remota do agendador.

Configure como GitHub Actions Secrets:

- `SUPABASE_ACCESS_TOKEN`: token Supabase com `projects_read`, `edge_functions_read` e `edge_functions_write`; conceda também `database_write` somente se o método de conexão escolhido exigir isso sem senha de banco.
- `SUPABASE_DB_PASSWORD`: senha de conexão do banco, necessária pelo método `migration list`/`db push` escolhido para reconciliar e aplicar migrações remotas.

O workflow nunca lista nem imprime esses valores. A URL e a chave publicável do projeto são variáveis de Actions (`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), não credenciais administrativas. Não usar `service_role`, `sb_secret_*` ou token administrativo em variáveis `NEXT_PUBLIC_*`.

Migrações pendentes com remoção de tabelas, colunas, constraints, políticas, funções/triggers, truncamento/exclusão de linhas ou desativação de RLS param o deploy automático. Para uma mudança desse tipo, exigir revisão independente e configurar revisores obrigatórios no ambiente GitHub `supabase-high-risk-migrations`; somente então executar `workflow_dispatch` com `approve_high_risk_migrations=true`. A validação posterior exige que não reste migração local pendente. `db push` não aplica seed, roles ou configuração de Vault.

**Estado de auditoria desta configuração:** o acesso à API GitHub de Variables/Secrets/ambientes foi negado (HTTP 403). Os runs [43297281147](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43297281147), [43297591878](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43297591878), [43323420497](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43323420497), [43323617456](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43323617456) e [43323745985](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43323745985) falharam antes das validações porque `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` estão vazias; deploy foi skipped. Histórico remoto Supabase não revalidado; nenhuma migração ou função publicada. Localmente, 269 testes, lint (quatro avisos preexistentes), typechecks frontend/Edge e build estático passaram.

> **Marketplaces — 11/11/2026:** navegação das sete lojas e campanhas manuais compartilhadas. Estado, validações, publicação e limites em [MARKETPLACES.md](./MARKETPLACES.md). Este registro prevalece sobre os estados históricos de navegação abaixo.

## Estado vigente — 08/11/2026: foto falante com produto

Carla e Rafael têm referências fotográficas realistas, plus size, próprias e selecionáveis. Os quatro perfis ficam em `mv_presenter_profiles`, com identidade, arquivo/hash e voz fixa Google. Quatro bases foram validadas com MP4s reais de 10–13 segundos e habilitadas para o formato **foto falante + cartão com a imagem enviada do produto**, em 720×1280.

O botão principal usa o fluxo Google TTS/MuseTalk. Histórico privado, cancelamento cooperativo, renovação de acesso e recuperação sem reenviar a GPU foram implementados. Corpo, roupa e cenário permanecem os da base; não há geração nativa 4K, sessão persistente de modelos ou garantia de 15 vídeos/dia.

Estado consolidado, validações, publicação e limites: [ENTREGA_VIDEO_COM_PRODUTO.md](./ENTREGA_VIDEO_COM_PRODUTO.md). **Este bloco prevalece sobre os registros históricos abaixo**, inclusive referências antigas a bases desabilitadas ou geração Kaggle ainda não implementada.

## Histórico — piloto inicial Google + MuseTalk de 08/11/2026

A arquitetura sincronizada foi implementada e publicada como piloto: base aprovada no Supabase → voz fixa Google → MuseTalk 1.5/Kaggle T4 → FFmpeg → MP4 privado. Dois MP4s reais foram concluídos: três segundos em 152,378 s de notebook; 8,496 s de fala em 127,829 s de notebook e 135 s entre registro da tarefa e entrega. Inferência/codificação silenciosa: 7,829 s e 21,279 s; pico de 6,54 GiB. Boca/rosto ainda precisam de ajuste visual; bases permanecem sem aprovação para anúncios. Não há garantia de 15 vídeos/dia nem de 4K. Novas gerações não acionam provedores com créditos do fluxo antigo.

Estado completo, limites e continuidade: [ARQUITETURA_VIDEO_SINCRONIZADO.md](./ARQUITETURA_VIDEO_SINCRONIZADO.md). Os registros anteriores abaixo são históricos.

> **Atualização de 07/11/2026:** 1min.ai integrado com Seedance, fila/polling/Storage e erros seguros. Teste real recusado por créditos insuficientes; não houve MP4 1min.ai. Kaggle passou no piloto privado de GPU; Wan/lip sync ainda pendentes. Política ativa usa créditos das contas. Estado e versões atuais: [ATUALIZACOES.md](./ATUALIZACOES.md) e [ONEMIN_E_KAGGLE.md](./ONEMIN_E_KAGGLE.md). Trechos divergentes abaixo são históricos.


## Estado vigente — 07/11/2026

Login Google e conexão do canal YouTube confirmados pelo responsável. Nova chave Gemini aceita pelo catálogo/modelos consultados; geração de vídeo Google ainda requer teste real. Gerar vídeo foi corrigido para validar ao clicar e mostrar pendências; ElevenLabs aparece em Outra voz junto das características da voz, com prévia/exportação opcional e áudio nativo mantido na geração. Flow remoto saiu da central; Flow/Create permanecem pendentes no seletor. Frontend Cloudflare `a1a5dd36-76b7-4954-99f6-d9d5f5b72b90`; video-generation v44. Retomada e pendências em [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md) e [AJUSTES_ESTUDIO.md](./AJUSTES_ESTUDIO.md).

## Histórico técnico — registros anteriores

Os registros abaixo preservam decisões e validações das entregas anteriores; afirmações divergentes não substituem o estado vigente acima.

> **Estado vigente — Modal e ElevenLabs, 06/11/2026:** navegador Flow sob demanda implantado no Modal e testado com abertura real, autenticação e encerramento. Falta o login Google pessoal e implementar/validar geração e importação de MP4; Flow continua indisponível para gerar. Diagnóstico ElevenLabs publicado no Supabase (funções de vídeo v38/v23); chave `ELEVENLABS_API` autenticada: plano Free, 10.000 créditos disponíveis e licença comercial não incluída. Estado e próximos passos em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md) e [ELEVENLABS.md](./ELEVENLABS.md). Registros divergentes abaixo são históricos.

> **Conta e estratégia Google — 06/11/2026:** acesso e lojas centralizados em `/entrar`; fluxo OAuth Google implementado, mas provedor remoto ainda desabilitado e dependente de Client ID/Secret. Links externos do Flow removidos do estúdio. Nova direção: geração via navegador no servidor e publicação integrada, ainda não implantadas. Estado vigente e ativação em [CONTA_E_ESTRATEGIA_GOOGLE.md](./CONTA_E_ESTRATEGIA_GOOGLE.md).

> **Política vigente — créditos da conta, 06/11/2026:** por solicitação explícita do responsável, o runtime não exige comprovação prévia de gratuidade, orçamento local em USD ou ativação de cotas administrativas para tentar as APIs integradas. Usa saldo quando consultável e permite tentativa quando ele é desconhecido, com fallback e espera automática. O fornecedor pode cobrar conforme o plano da conta. Estado e instruções em [CREDITOS_DA_CONTA.md](./CREDITOS_DA_CONTA.md). Este registro substitui as políticas free-only e os bloqueios históricos abaixo.

> **Teste no app — 06/11/2026:** diagnóstico autenticado de cotas de imagem/vídeo adicionado ao estúdio, com atualização sem inferência. Sem cota elegível, o botão informa “Salvar pedido na fila”; não indica geração imediata. Nenhuma geração real foi enviada nesta revisão, nenhum teste de API foi concluído e nenhuma cota foi ativada. Guia e impedimentos atuais em [TESTE_NO_APP.md](./TESTE_NO_APP.md). Este registro prevalece sobre instruções históricas abaixo.

> **Auditoria atual — 06/11/2026:** token Cloudflare Billing Read validado; falha real do cron corrigida e execução autenticada confirmada. Auditoria privada e horária das contas implantada. Magic Hour informou plano free e 500 créditos agregados; as franquias gratuitas de imagem/vídeo e o bloqueio de cobrança ainda precisam de comprovação. Nenhum vídeo real foi gerado. Estado completo e pendências em [AUDITORIA_IA.md](./AUDITORIA_IA.md); este registro prevalece sobre estados e versões históricos abaixo.

> **Política vigente — somente gratuito, 06/11/2026:** modo `free-only` implementado e publicado no Supabase, sem teto diário de pedidos do aplicativo. Fallback automático entre opções compatíveis, reservas atômicas de cotas gratuitas, espera/retomada com etapas preservadas e renovação apenas de franquias periódicas comprovadas. Rotas pagas ou desconhecidas são bloqueadas. As cotas de imagem/vídeo ainda não têm comprovação de gratuidade registrada; pedidos podem aguardar por isso. Instruções e limites reais em [MODO_GRATUITO.md](./MODO_GRATUITO.md). Este bloco substitui as instruções históricas de ativar geração paga abaixo.

> **Atualização do estúdio — 06/11/2026:** interface em três áreas e etapas; fallback de roteiro Gemini/Groq/OpenRouter; correções de retomada, finalização e fallback de vídeo; cache privado de referências/composição e capacidade técnica acima de 15 entregas/dia. Migração `20261106022136_video_production_cache.sql` aplicada ao Supabase. Runtime confirmou credenciais dos serviços, mas flags de geração, allowlist, limites e conversão Magic Hour estão ausentes/desligados. Geração real ainda não foi executada. Pendências exatas e estado atual em [VIDEOS_IA.md](./VIDEOS_IA.md). Este bloco prevalece sobre o histórico abaixo.

> **Revisão autenticada — 06/11/2026:** Acesso autenticado confirmado ao projeto `jzchlrvxdaffnrgbvabv`, ACTIVE_HEALTHY. Há 15 tabelas públicas com RLS habilitada e seis migrações aplicadas, incluindo `20261106020118_foreign_key_indexes.sql`: oito índices criados e verificados por SQL; advisor não aponta mais chaves estrangeiras sem índice. Cinco funções ACTIVE: marketplace v19, catalog v18, catalog-public v18, video-generation v20 e video-generation-worker v3. Saúde sem alertas. Proteção contra senhas vazadas continua desativada ([orientação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); cinco tabelas internas sem política são intencionais. Secrets/flags e configuração Auth não foram consultados nem alterados. HTTP público confirma `catalog_not_configured` nas três lojas e 401 nas funções privadas. Veja [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md). Este bloco prevalece sobre os registros anteriores de falta de acesso ou versões históricas abaixo.

## Estado desta implementação

Projeto hospedado **meu-vendedor**, referência `jzchlrvxdaffnrgbvabv`. As migrações `20261104000100`, `20261104000200`, `20261105151156`, `20261105172000` e `20261105225000` constam como aplicadas nos registros anteriores. As tabelas privadas, incluindo fila/biblioteca de vídeos, foram projetadas com RLS.

**Limite de verificação em 06/11/2026:** não foi possível consultar novamente o projeto nesta sessão (Supabase CLI, token de gerenciamento e link local estão ausentes). A última verificação remota documentada em `VIDEOS_IA.md` confirma `video-generation-worker` versão 3 e teste do segredo próprio; chamada autenticada retornou `processor_disabled`. Flags/allowlist/orçamentos estavam ausentes ou desligados naquela verificação. Trate isso como último estado conhecido, não como leitura remota atual. Não foram lidos ou alterados valores de Secrets.

Revalidação histórica em 05/11/2026: dez tabelas `mv_*` estavam presentes com RLS habilitada; `marketplace` versão 2, `catalog` versão 1, `catalog-public` versão 1 e `video-generation` versão 1 estavam `ACTIVE`. Essa lista é histórica e não inclui a publicação posterior do worker de vídeo.

A URL pública do Supabase e a chave publicável foram obtidas do projeto correto e configuradas no build via `.env.local`, ignorado pelo Git. Nenhuma chave administrativa foi inserida no frontend ou no repositório. A configuração foi validada por testes de login e persistência na API hospedada.

Site URL, retornos de cadastro/recuperação e senha mínima de 8 caracteres foram aplicados. Confirmação de e-mail permanece habilitada. As opções remotas não declaradas no arquivo local foram preservadas. Entrega de e-mail e SMTP personalizado não foram testados/configurados nesta execução.

## Funcionalidades

- `/entrar`: cadastro, entrada por e-mail/senha e solicitação de recuperação da conta do **Meu Vendedor**.
- `/redefinir-senha`: atualização da senha após o fluxo de recuperação do Supabase.
- `/afiliados`: criação, leitura, edição e exclusão de links manuais; plataforma, título, campanha e observações; filtro por plataforma. Exibe até 200 registros recentes.
- `/configuracoes`: leitura e atualização do nome de exibição do próprio usuário.
- `/contas`: cinco plataformas, acesso ao portal oficial e orientações de afiliação, sem conexão automática.

Senhas das lojas não são solicitadas. Links cadastrados manualmente não geram vendas ou comissões fictícias. O dashboard original continua explicitamente demonstrativo.

## Modelo do banco

A migração `supabase/migrations/20261104000100_affiliate_base.sql` cria:

| Tabela | Finalidade | Acesso pelo cliente |
| --- | --- | --- |
| `mv_platforms` | Catálogo de Shopee, TikTok, Mercado Livre, Amazon e Magazine Luiza | Leitura pública; escrita administrativa |
| `mv_profiles` | Nome de exibição do usuário autenticado | Somente o próprio usuário pode ler/atualizar |
| `mv_affiliate_links` | Links e campanhas do usuário | CRUD apenas do proprietário |

RLS habilitada e forçada, políticas por `auth.uid()` e concessões por coluna. O proprietário do link é definido pelo banco e não pode ser alterado pelo cliente. Perfis são criados por trigger para novos usuários e preenchidos para usuários existentes. Identificadores, autor e datas não são editáveis pelo navegador. Valores de URL e tamanhos de texto são validados no frontend e no banco.

A migração não altera tabelas de outros projetos, não apaga usuários e não usa reset. Antes de aplicá-la, conferir se as tabelas/funções `mv_*` já existem e revisar possíveis conflitos.

## Ativação no projeto hospedado

1. Concluir a autorização da CLI e listar projetos; selecionar o ID real do projeto chamado `meu-vendedor`, sem confundi-lo com outros aplicativos.
2. Inspecionar esquema e configurações existentes; aplicar a migração com registro no histórico de migrações.
3. Manter cadastro por e-mail e confirmação de e-mail habilitados. Revisar o arquivo `supabase/config.toml` e aplicar somente as mudanças de Auth necessárias, preservando configurações externas não relacionadas.
4. Configurar o Site URL para o endereço público do Worker e permitir os retornos exatos `/entrar` e `/redefinir-senha`. O arquivo também lista os retornos de desenvolvimento em localhost.
5. Configurar o envio de e-mails conforme recursos e limites da conta Supabase; entrega de mensagens precisa ser testada no projeto real. Não presumir SMTP personalizado ativo.
6. Obter a URL e a chave **publicável** do projeto e definir `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente de build. Regerar o frontend: os valores são incorporados no build.
7. Executar os testes, publicar no Worker existente e conferir cadastro, confirmação, login, recuperação, CRUD e isolamento com duas contas de teste autorizadas. Não declarar esses testes remotos como realizados antes da ativação.

Não incluir `service_role`, `sb_secret_*`, senha do banco ou token de gerenciamento em variáveis `NEXT_PUBLIC_*`, JavaScript do cliente ou Git. As variáveis públicas não são segredos; a proteção dos dados depende de RLS e autenticação válidas.

## Sessão e segurança

O cliente oficial usa PKCE e renova a sessão do próprio Meu Vendedor. A sessão do app é persistida pelo SDK no navegador para manter o login; isso não armazena senhas nem credenciais das lojas. A autorização de dados é validada no Supabase a cada consulta via JWT/RLS, não pelo estado visual da interface. O logout local remove a sessão deste navegador. Uma futura versão com SSR poderá usar cookies e cliente de servidor; não tratar controles de UI como barreira de segurança.

Credenciais Shopee podem ser armazenadas somente após validação, cifradas pelo backend e isoladas do cliente. As funções `marketplace`, `catalog`, `catalog-public` e `video-generation` estão publicadas. Não há credenciais comerciais reais registradas nesta documentação, publicação automática em redes sociais ou geração paga de vídeo habilitada.

## Testes

`npm test` usa PostgreSQL local via PGlite para executar as migrações e validar RLS, perfis, acesso anônimo, adulteração de proprietário, edição/exclusão autorizadas e bloqueio entre usuários. Também verifica conectores, catálogo, biblioteca e backend de vídeos. A última execução em 06/11/2026 aprovou 89 testes. Não depende de credenciais reais e não substitui testes comerciais no ambiente hospedado.

Executar `npm run lint`, `npm run typecheck` e `npm run build:pages`. O Worker pode servir o frontend estático porque autenticação e banco são acessados pelo cliente oficial. Nunca implantar credenciais administrativas para isso.

Referências oficiais: [Supabase Auth](https://supabase.com/docs/guides/auth), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [signUp](https://supabase.com/docs/reference/javascript/auth-signup).

## Verificação remota realizada

Em 04/11/2026 foram executadas verificações no Supabase hospedado:

- Catálogo público com exatamente cinco plataformas e leitura anônima de links bloqueada.
- Duas contas temporárias criadas pela API administrativa com e-mail já confirmado, sem envio de mensagens.
- Login por senha das duas contas e logout.
- Trigger de criação de perfil e isolamento de sua leitura/atualização.
- CRUD de links do proprietário, bloqueio de leitura/edição/exclusão pelo outro usuário e bloqueio de adulteração do proprietário.
- Rejeição de URL insegura pelo banco.
- As duas contas temporárias foram removidas ao final, sem deixar links/perfis de teste.

As chaves administrativas foram obtidas e usadas somente em memória pelo teste. Cadastro com confirmação por e-mail e recuperação dependem da entrega de mensagens, que ainda precisa ser validada no ambiente real. Esses testes de e-mail não foram simulados como concluídos.

## Conector Shopee

A migração `20261104000200` adiciona conexões, credenciais cifradas, produtos, sincronizações e links gerados. As tabelas são isoladas por RLS e a escrita é exclusiva do backend. A função `marketplace` valida sessões via Supabase Auth em toda operação de usuário; o cron usa segredo próprio. `verify_jwt=false` permite o fluxo de cron, sem eliminar a validação explícita do handler. Os segredos de cifragem e agendamento foram registrados fora do repositório. Ver `CONECTORES.md` para operação e limites.

## Biblioteca e backend de vídeos

A migração `20261105151156` cria `mv_video_projects` para guardar configurações, roteiros, estados e versões. A tabela tem RLS habilitada e forçada, quatro políticas por proprietário e chaves compostas para impedir que uma versão referencie projeto de outro usuário. A verificação remota confirmou RLS forçada e quatro políticas.

A geração usa `video-generation` para operações autenticadas e `video-generation-worker` para processamento interno autenticado por `MV_VIDEO_WORKER_SECRET` (o gateway JWT desta função fica desligado). A última publicação documentada do worker está na versão 3. A geração paga depende de flags comerciais/financeiras, provedores e orçamento; o último teste remoto retornou `processor_disabled`. Não houve chamada paga. Os detalhes do pipeline, fallback e configurações estão em [`VIDEOS_IA.md`](./VIDEOS_IA.md).

## Advisors e compatibilidade da CLI

Verificação em 05/11/2026:

- Saúde: nenhum alerta.
- Segurança: a proteção contra senhas vazadas do Supabase Auth continua desativada e deve ser habilitada no painel. [Orientação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Segurança informativa: `mv_connection_secrets` e `mv_connector_locks` não têm políticas de cliente intencionalmente; privilégios foram revogados e o acesso é exclusivo do backend.
- Performance: seis chaves estrangeiras antigas continuam sem índice cobridor. Os índices novos de produto pai/origem da biblioteca ainda aparecem como não usados porque a tabela está vazia; não devem ser removidos apenas por esse resultado inicial.

O changelog de 04/11/2026 informa que a Supabase CLI v3 passou a operar localmente por padrão e solicita confirmação para mudanças hospedadas. Os procedimentos deste repositório devem fixar a versão usada, consultar `--help` e indicar explicitamente o alvo remoto. [Breaking change da CLI v3](https://supabase.com/changelog/supabase-cli-v3).

## Validação desta revisão — 06/11/2026

89 testes aprovados, lint e typecheck Edge aprovados. Typecheck frontend aprovado e repetido pelo build estático; exportação das 17 rotas concluída. O sandbox retornou saída vazia na captura do subprocesso TypeScript (`--showConfig`); o mesmo build fora do sandbox passou, sem alteração no código Next.js. A migração local usa a versão `20261106020118`, igual ao histórico criado pelo Supabase MCP.
