# Retomar amanhã — Integração TikTok / Meu Vendedor
Data: 14/11/2026

## Objetivo
Configurar aplicativo “Meu Vendedor” no TikTok for Developers para conectar uma conta TikTok ao site via Login Kit. Depois, avaliar Content Posting API para publicação de vídeos. **Integração OAuth, postagem e aprovação do TikTok ainda não estão confirmadas.**

## Projeto
- GitHub: https://github.com/warllemedicao/Meu-Vendedor
- Branch: main
- Frontend: Next.js / Cloudflare Worker `meu-vendedor`
- Site: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/
- Política: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/politica-de-privacidade
- Termos: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/termos-de-servico

## O que foi feito
1. Foi preparada página inicial pública para apresentação do app (commit `ca384dc`) e página de termos (commit `08969ba`).
2. Verificação TikTok por **URL prefix**, não DNS de `workers.dev`. O primeiro arquivo de assinatura foi publicado, mas o TikTok solicitou outro arquivo e a verificação falhou.
3. Arquivo **atual** recebido do TikTok e incluído em `main`: `public/tiktokWvLASnuPLODt255riq8NWYbIDR9ZjM2j.txt`, conteúdo exato `tiktok-developers-site-verification=WvLASnuPLODt255riq8NWYbIDR9ZjM2j`. Commit `8c164d3e20bbd2b883d7e025ec7f7bab7d50051b`.
4. Orientado publicar pelo Codespace: `git pull --ff-only origin main` e `bash scripts/deploy-frontend-production.sh`. **Não foi confirmado nesta conversa se essa última publicação ocorreu ou se o TikTok exibiu Verified.**
5. Campo TikTok **Configure for Web/Desktop → Web/Desktop URL**: URL raiz pública acima.
6. **Login Kit → Redirect URI → Web**: foi sugerida a URL `https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/api/auth/tiktok/callback`. **É somente uma proposta, não há evidência de rota implementada; verificar arquitetura antes de salvar como definitiva.** O projeto usa export estático; uma rota Next.js `/api` não funciona no Worker estático sem backend/roteamento adicional. Considerar callback no Supabase Edge Functions ou outra rota de backend adequada.
7. TikTok exige **vídeo MP4/MOV de demonstração completa**, até 5 arquivos de 50 MB, mostrando UI real e integração end-to-end em **Sandbox** para app ainda não aprovado. Nenhum vídeo foi produzido/enviado. Não inventar demonstração.
8. **Webhooks → Callback URL** apareceu como campo obrigatório. Orientação: se Webhooks não for usado, remover/desativar esse produto; não preencher com URL fictícia. Ainda não foi confirmado se há opção Remove/Disable nem se o usuário salvou o rascunho.

## Próxima sessão — um passo por vez
1. Perguntar qual é a tela atual do TikTok e se o rascunho foi salvo. Verificar se a URL do arquivo atual abre e se o TikTok validou a propriedade, sem presumir sucesso.
2. Verificar em Products se Webhooks pode ser desativado; manter somente produtos/escopos efetivamente necessários. Solicitar captura se opção não aparecer.
3. Inspecionar o código e escolher **Redirect URI realmente implementável** para Next.js export estático + Supabase. Corrigir no portal se necessário; implementar OAuth seguro no backend, state/PKCE, callback e conexão na interface. Não colocar client secret no frontend.
4. Configurar Sandbox, testar autorização completa, gravar vídeo real de demonstração e só então preparar revisão.
5. Avaliar Content Posting API e escopos em etapa separada; não afirmar que publicação automática já funciona.

## Restrições
- Usuário pediu pausa; **somente registrar a continuidade em Markdown**, sem implementar OAuth, publicar Worker, mexer em Supabase ou enviar revisão.
- Orientar em português, **um campo/passo por vez**.
- Não registrar tokens, secrets ou credenciais no repositório.
