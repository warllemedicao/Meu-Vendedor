# Histórias — módulo independente do Meu Vendedor

## Estado nesta branch

Implementação inicial em `feat/historias-gemini-studio`; não equivale a publicação no Supabase/Cloudflare nem a geração real validada. O serviço utiliza `GEMINI_API_KEY` ou `GOOGLE_API_KEY` já cadastradas no backend, conforme disponibilidade/cota. Não há transferência de créditos entre produtos Google.

## Separação absoluta do Flow

A rota `/videos` passa a usar `src/components/stories/StoriesStudio.tsx`. Nenhum arquivo sob `executors/google-flow/`, `src/components/auth/HyperbrowserProfile.tsx` ou arquivos IMAGEM1/IMAGEM2/IMAGEM3 é modificado. O antigo `VideoWorkspace.tsx` permanece no repositório por poder ter dependências e dados históricos, mas deixa de ser carregado pela rota. A exclusão segura exige prova de ausência de imports/uso fora desta rota.

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
- Auditar referências antes de remover o antigo estúdio e sua documentação legada. `VIDEOS_IA.md` foi mantido como histórico até essa conferência.
- Nenhum robô novo de YouTube Create/Dreamina foi criado; não há API pública confirmada nem autorização para automatizar a interface dessas plataformas.

## Publicação

**Não publicada**: até confirmação de CI, migrações, Edge Function e frontend. Não executar geração de vídeo/GPU nem enviar conteúdo a redes sociais durante os testes de integração de texto.
