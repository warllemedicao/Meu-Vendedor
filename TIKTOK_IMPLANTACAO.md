# TikTok — integração em preparação (não aprovada nem publicada)

## Implementado nesta branch
- Login Kit Web via Supabase Edge Function `tiktok-connect`, com autenticação Supabase por usuário.
- State aleatório de uso único, SHA-256 no banco, expiração em 10 minutos.
- Callback HTTPS, troca de código, criptografia AES-256-GCM de access/refresh tokens, renovação, desconexão e status.
- Consulta de creator info para futura integração de publicação.
- Botão TikTok em Conta e conexões.

## Redirect URI a cadastrar em TikTok for Developers > Login Kit > Web
`https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/tiktok-connect/callback`

A URI acima só deverá ser cadastrada depois de implantar a função e verificar que o endpoint responde. Não utilizar a antiga URL fictícia `/api/auth/tiktok/callback` no Cloudflare.

## Dependências de publicação
1. Revisar e aplicar `supabase/migrations/20261114110000_tiktok_oauth.sql` no projeto correto.
2. Configurar os **secrets do Supabase Edge Functions**: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_TOKEN_ENCRYPTION_KEY` (base64 de 32 bytes aleatórios). Os secrets existentes no Cloudflare **não são automaticamente acessíveis** pela função Supabase.
3. Publicar `supabase/functions/tiktok-connect/index.ts` como função `tiktok-connect` com `verify_jwt=false`: callback público GET precisa funcionar; POST autentica explicitamente o JWT com `auth.getUser`.
4. Adicionar Redirect URI no portal TikTok e salvar. Confirmar scopes `user.info.basic`, `video.upload`, `video.publish` e testar no Sandbox.
5. Publicar frontend após testes: `npm ci && npm run typecheck && npm run lint && npm test && npm run build:pages && npx wrangler deploy --name meu-vendedor` com Node 24 e variáveis públicas Supabase presentes.
6. Gravar vídeo real demonstrando a integração para revisão do TikTok.

## Limitações importantes
- **Share Kit é SDK nativo de compartilhamento para Android/iOS**, não implementável como Share Kit em frontend Web puro. Não alegar integração Share Kit no vídeo de revisão.
- **Content Posting API não está concluída nesta branch**: há consulta de creator info, mas falta fluxo completo de upload e postagem, tela de consentimento e verificações da API. Não declarar upload/publicação pronta.
- O app depende da aprovação dos produtos e scopes pelo TikTok. A presença de credenciais não garante aprovação.
- Tokens não são retornados ao navegador e tabelas de tokens não têm permissões para usuários comuns.
- Testes de integração real dependem de autorização TikTok no Sandbox e secrets no Supabase. Não foram executados.
