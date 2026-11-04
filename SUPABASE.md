# Base Supabase — Meu Vendedor

## Estado desta implementação

Projeto hospedado **meu-vendedor**, referência `jzchlrvxdaffnrgbvabv`, autorizado e configurado. Migração `20261104000100` aplicada e registrada no histórico remoto. As três tabelas estão com RLS habilitada e forçada.

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

Nenhum token externo de Shopee, TikTok, Mercado Livre, Amazon ou Magalu é armazenado nesta etapa. Não foram criadas funções de API comercial, monitoramento, publicação ou automação.

## Testes

`npm test` usa PostgreSQL local via PGlite para executar a migração e validar RLS, perfis, acesso anônimo, adulteração de proprietário, edição/exclusão autorizadas e bloqueio entre usuários. Também verifica links inseguros, catálogo e mensagens de erro. Não depende de credenciais reais e não substitui testes no Supabase hospedado.

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
