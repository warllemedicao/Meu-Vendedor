# TikTok — Login Kit e envio para caixa de entrada (validação pendente)

## Estado verificado em 14/11/2026
- Branch `feat/tiktok-login-kit-oauth`; PR #9 ainda não mesclada à `main`.
- Build local informado pelo usuário: 27 páginas; TypeScript, lint e 299 testes aprovados.
- Supabase `jzchlrvxdaffnrgbvabv`: tabelas `public.tiktok_oauth_states` e `public.tiktok_connections` existentes.
- Edge Function `tiktok-connect` ACTIVE, versão 4, `verify_jwt=false` para permitir callback GET. As ações POST verificam a sessão com `auth.getUser`.
- **Não confirmado**: valores/configuração dos secrets TikTok, cadastro do Redirect URI, aprovação de escopos, OAuth real e transferência de MP4. Nenhuma aprovação do TikTok deve ser presumida.

## Implementação
- Login Kit Web, state aleatório de uso único (SHA-256 no banco, 10 minutos), callback, troca de código e armazenamento criptografado AES-256-GCM dos tokens.
- Renovação, desconexão, consulta de status e interface de conexão.
- `upload_init` solicita URL de upload para inbox do TikTok, e `TikTokDraftUpload` envia MP4 em blocos pela URL retornada. O usuário precisa concluir a publicação no aplicativo TikTok. **Este fluxo ainda não foi validado ponta a ponta**.
- Consulta `creator_info` presente no backend; **publicação direta automática não implementada**.

## Callback do Login Kit Web
`https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/tiktok-connect/callback`

Cadastrar exatamente esta URI no portal TikTok for Developers e confirmar a aprovação do produto e dos escopos solicitados pelo código: `user.info.basic` e `video.upload`. O escopo `video.publish` é exigido apenas pela ação `creator_info`, mas **não é solicitado no fluxo OAuth atual**.

## Configuração pendente de verificação
1. Confirmar no **Supabase Edge Functions Secrets** a existência de `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` e `TIKTOK_TOKEN_ENCRYPTION_KEY` (base64 de 32 bytes aleatórios). Não registrar valores no Git ou em conversas.
2. Confirmar o Redirect URI e os produtos/scopes no TikTok for Developers. Credenciais do Cloudflare não são automaticamente disponíveis no Supabase.
3. Testar autorização OAuth real e a reconexão/renovação. Verificar a mensagem de erro sem expor tokens.
4. Testar upload MP4 com conta autorizada, resposta de status e finalização manual no aplicativo. Verificar limites e CORS reais da URL de upload.
5. Só então mesclar PR #9 e publicar pelo script oficial `scripts/deploy-frontend-production.sh`, que exige `main`; conferir status de produção após o deploy.
6. Se exigido pela revisão TikTok, produzir demonstração real, sem afirmar publicação automática.

## Limitações
- Share Kit é SDK nativo Android/iOS, não implementado no frontend Web.
- A existência do código não comprova aprovação do TikTok ou funcionamento de login/upload.
- Tokens não são devolvidos ao navegador; tabelas de tokens não concedem acesso a `anon` ou `authenticated`.
- Não publicar uma branch de testes sobre o Worker principal sem validação.
