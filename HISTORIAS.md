# Histórias — módulo independente do Meu Vendedor

## Estado atual

A primeira interface foi publicada no Cloudflare em 19/11/2026 no commit `5ee21836`. Esta ampliação editorial está em `feat/historias-editorial-completo` e ainda não foi publicada. O Supabase (migração e função `story-studio`) permanece pendente; não há geração Gemini real validada. O serviço utiliza `GEMINI_API_KEY` ou `GOOGLE_API_KEY` já cadastradas no backend, conforme disponibilidade/cota. Não há transferência de créditos entre produtos Google.

## Separação absoluta do Flow

A rota `/videos` passa a usar `src/components/stories/StoriesStudio.tsx`. Nenhum arquivo sob `executors/google-flow/`, `src/components/auth/HyperbrowserProfile.tsx` ou arquivos IMAGEM1/IMAGEM2/IMAGEM3 é modificado. O antigo `VideoWorkspace.tsx` foi retirado da rota e removido do repositório após verificação de referências; os componentes de produto usados por outras áreas foram mantidos.

## Fluxo implementado (a validar)

1. Assunto em texto, gênero e quantidade até 1.000. Gemini gera lotes de 25. Os resultados são salvos progressivamente em `mv_story_topics`, isolados por usuário. Duplicatas são ignoradas.
2. Temas podem ser filtrados e marcados como favoritos; gerar roteiro seleciona um tema.
3. Gemini retorna 12 cenas de 10s e uma Bíblia de Personagens com nome, papel, identidade visual e voz.
4. Roteiro é editável na tela e pode ser salvo/retomado; aprovação congela o roteiro e habilita prompts.
5. Agentes independentes `youtube-create`, `google-flow`, `dreamina` são especificações de texto no novo backend, não automações de sites. YouTube Create tem teto de 900 caracteres informado pelo responsável e validado por código. Tetos de 4.000 para Flow/Dreamina são internos, não limites oficiais confirmados. As durações reais variam por gerador.
6. Clipes MP4 por cena e referências PNG/JPG/WebP são enviados a buckets privados, com prefixo por conta e projeto.

## Banco e segurança

Migração `20261119010000_stories_studio.sql` cria `mv_story_topics`, `mv_story_projects`, `mv_story_prompts`, `mv_story_clips`, todos com RLS por titular. Cria os buckets privados `mv-story-clips` e `mv-story-images`, com políticas por prefixo do usuário. Revisar migração antes de aplicar no banco remoto, principalmente se houver migrações pendentes anteriores.

Função Supabase `story-studio`: autenticação obrigatória de sessão, CORS restrito à origem conhecida e localhost, tratamento de erro sanitizado e leitura da chave Gemini somente no servidor. `supabase/config.toml` declara `verify_jwt=true`.

## Pendências antes de declarar entrega concluída

- Rodar `npm test`, typecheck frontend e Edge, lint e build; verificar CI.
- Aplicar migração em ambiente autorizado e publicar `story-studio` no Supabase; não contornar o gate de migrações pendentes do projeto.
- Confirmar o modelo Gemini disponível, cota e uma chamada real autorizada de temas e roteiro.
- Validar os prompts de 12 cenas com personagens e regras de limite da plataforma.
- Implementar edição avançada e prévia de imagens, retentativa/cancelamento de jobs no servidor, montagem final de 120s com sincronismo de áudio e publicadores autorizados para YouTube/TikTok/Kwai.
- Verificar comportamento de upload de até 100 MB nas condições reais de Storage e infraestrutura.
- Auditar referências antes de remover o antigo estúdio e sua documentação legada. `VIDEOS_IA.md` foi reduzido a um aviso de descontinuação com link para este documento; o antigo conteúdo continua acessível pelo Git.
- Nenhum robô novo de YouTube Create/Dreamina foi criado; não há API pública confirmada nem autorização para automatizar a interface dessas plataformas.

## Publicação

**Frontend básico publicado no Cloudflare; ampliação editorial em branch isolada.** Banco, Edge Function, integração de vídeo e publicação social pendentes. Não executar geração de vídeo/GPU nem enviar conteúdo a redes sociais durante os testes de integração de texto.

## Ampliação editorial — 19/11/2026

## 2026-11-19 — Complemento editorial do Histórias (em validação, sem publicação)

- Implementado na branch `feat/historias-editorial-completo`: revisão separada dos temas antes de salvar, salvar individual/em lote, descarte e filtros por assunto/gênero/texto/favorito; o backend anterior já limitava cada lote Gemini a 25.
- Editor ampliado com Bíblia de Personagens editável (nome, função, aparência e voz), propagação de renomeações para cenas, edição de títulos/personagens/transições/falas e linha do tempo com 12 cenas. Aprovação verifica referências aos personagens e limite aproximado de 26 palavras por cena.
- Prompts por plataforma podem ser recuperados, editados, salvos individualmente e copiados; limite de 900 caracteres informado para YouTube Create permanece validado no frontend e no backend.
- Biblioteca de clipes agora mostra estados, visualização por URL temporária e aprovação/revogação. Painel de preparação permite selecionar YouTube/TikTok/Kwai, título e descrição, sem postar.
- Criados testes de regressão e atualizado workflow isolado de CI. Nenhum arquivo do executor Modal/Flow, IMAGEM1, IMAGEM2, IMAGEM3, Produto ou outro projeto foi alterado.
- **Estado real:** frontend Histórias básico já publicado em Cloudflare na main do commit 5ee21836, após restauração da versão do Worker; esta ampliação está SOMENTE na branch até passar CI e ser publicada. Migração e função `story-studio` **ainda não estão implantadas no Supabase**, por isso a geração Gemini não está operacional na página de produção. Montagem final de 2 minutos e publicação automática continuam pendentes de implementação/autorização.

