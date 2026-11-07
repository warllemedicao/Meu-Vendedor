# Ativar login Google — Meu Vendedor

O cadastro com e-mail/senha não é OAuth, mesmo quando usa Gmail. O login Google identifica o usuário no Meu Vendedor. Não transfere cookies do Flow, benefícios da assinatura ou autorização de canais YouTube. As permissões adicionais das APIs precisam de consentimento próprio.

## 1. Google Auth Platform

Abra https://console.cloud.google.com/auth/overview e selecione/crie o projeto do aplicativo.

- Configure nome **Meu Vendedor**, e-mail de suporte e contato.
- Para uma conta Gmail pessoal, use público **Externo**. Em modo de teste, inclua sua conta entre os usuários de teste quando o painel exigir.
- Em **Clientes → Criar cliente**, selecione **Aplicativo da Web**.
- Origem JavaScript autorizada: `https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev`.
- URI de redirecionamento autorizado: `https://jzchlrvxdaffnrgbvabv.supabase.co/auth/v1/callback`.
- Para acesso básico, use somente `openid`, `email` e `profile`.

## 2. Supabase Auth

Abra https://supabase.com/dashboard/project/jzchlrvxdaffnrgbvabv/auth/providers e selecione **Google**. Habilite o provedor e cadastre o Client ID e o Client Secret obtidos no Google. Não são a chave Gemini e não devem ir para o frontend, Git ou chat.

Em URL Configuration, preserve o Site URL de produção e a allowlist já usada por confirmação e recuperação. Confira o retorno:

`https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/entrar`

Não desative a validação de nonce/state/PKCE para resolver problemas de configuração.

## 3. Validar

No app, abra **Conta e conexões → Meu acesso**, atualize a disponibilidade e clique em **Continuar com Google**. O acesso deve ir para a página oficial do Google e voltar ao aplicativo. Confira o vínculo Google e a preservação da biblioteca/conta existente. Fluxos que falham antes do retorno precisam de inspeção do erro real; não criar outra conta ou excluir dados como atalho.

Estado atualizado em 06/11/2026: `external.google=true`, `external.email=true`; o responsável confirmou que o login Google funcionou. Projeto Google: `meu-vendedor-1987`, número `531516167196`. O conector Supabase não altera configurações privadas de Auth. O responsável cadastrou as credenciais no provedor Google e, separadamente, nos Secrets de backend `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`; presença, formato do Client ID e vínculo ao número do projeto foram verificados no runtime sem divulgar valores.

Fonte: https://supabase.com/docs/guides/auth/social-sign-in/auth-google


## 4. Conexão oficial do YouTube

A YouTube Data API v3 foi ativada pelo responsável no projeto Google. Foram adicionados `youtube.readonly` e `youtube.upload` na tela de acesso a dados, com dois e-mails de teste informados pelo responsável. O projeto permanece Externo/Testando. Esses registros não comprovam consentimento efetivamente concedido por um usuário ao novo adaptador.

No mesmo cliente OAuth **Meu Vendedor Web**, adicionar este segundo URI de redirecionamento autorizado, preservando o callback do Supabase Auth:

`https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/youtube-connection`

O botão **Conta e conexões → Google e redes → YouTube → Conectar YouTube** abre a autorização oficial em navegação normal. O backend confere state, cookie do mesmo navegador, PKCE e a mesma conta Google do acesso ao aplicativo. Ao retornar, mostra canal/e-mail e oferece **Verificar canal** e **Desconectar YouTube**. Não usa o navegador remoto do Flow.

A conexão salva tokens cifrados e pode renová-los quando o canal é consultado. Em modo Testando, o Google pode expirar a autorização/refresh token após sete dias. Adicionar escopos no painel não substitui o consentimento efetivo. Configuração adicional e conexão do canal não publicam vídeos: envio, agendamento e métricas ainda são etapas futuras.

Implementação e validação em [YOUTUBE_CONEXAO.md](./YOUTUBE_CONEXAO.md).


## Confirmação posterior do responsável — 07/11/2026

Login Google e conexão do canal YouTube concluídos. O segundo callback foi cadastrado e o canal apareceu conectado no aplicativo. Os passos acima permanecem como procedimento de configuração para outros ambientes; não são uma pendência de repetir a configuração atual. Publicação e agendamento ainda não foram implementados. A nova chave Gemini também foi aceita pelos modelos consultados, sem teste de inferência de vídeo.
