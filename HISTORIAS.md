> **Estado verificado em 19/11/2026 (substitui notas antigas abaixo):** módulo Histórias utiliza `gemini-3.5-flash-lite` exclusivamente para temas e `gemini-3.5-flash` para roteiros e prompts, com secrets separados. Supabase `story-studio` ACTIVE v19 (JWT obrigatório). Tetos da API: temas 2.300 tokens em 5 itens a 3.800 em 20; roteiro 7.200; prompts 8.500. Metas/tetos editoriais por prompt: YouTube Create 780/900 caracteres, Google Flow 900/1600, Dreamina 650/1200. YouTube 900 é limite oficial; demais tetos são internos. Flow Omni Flash 1.2 e Veo 3.1 Lite apresentam durações diferentes: roteiro editorial 12x10s **não significa** que todos os clipes terão 10s automaticamente. O frontend de edição foi atualizado na main, mas sua publicação no Cloudflare ainda não foi confirmada. Os relatos históricos nas seções abaixo refletem estados anteriores e **não** o deploy atual. Nenhuma inferência real com os novos prompts foi validada nesta auditoria.

## 19/11/2026 — Chave exclusiva para roteiros e prompts de Histórias

- `story-studio` passa a consultar `HIST_ROTEIRO_GEMINI_API_KEY` exclusivamente nas ações `script` e `prompts`. A ação `topics` continua com `HIST_TEMA_GEMINI_API_KEY`. Não há fallback entre essas chaves ou para `GEMINI_API_KEY`/`GOOGLE_API_KEY` no módulo Histórias.
- A chave Gemini para Produtos e Campanhas não foi alterada; cada função externa ao Histórias mantém configuração anterior.
- O responsável precisa cadastrar o Secret `HIST_ROTEIRO_GEMINI_API_KEY` manualmente no Supabase, sem expor o valor. Antes do Secret e da publicação da nova Edge Function, roteiros e prompts podem retornar `gemini_not_configured`.
- Sem modificação do Google Flow, IMAGEM1, IMAGEM2, IMAGEM3, autenticação Google ou automação de vídeo. Testes de contrato adicionados; geração Gemini real autenticada ainda depende de validação.

## 19/11/2026 — Histórias: Secret exclusivo para geração de temas

- A função `story-studio` passa a obter a credencial de `action: "topics"` exclusivamente de `HIST_TEMA_GEMINI_API_KEY`. Não há fallback para `GEMINI_API_KEY` nem `GOOGLE_API_KEY` nessa ação.
- Geração de roteiro (`script`) e prompts (`prompts`) permanecem com as credenciais legadas por enquanto; a chave dedicada futura para roteiro/prompts depende de outra etapa autorizada.
- O responsável cadastrará o novo Secret diretamente no Supabase, sem enviar nem versionar o valor da chave. O código isoladamente não ativa a nova configuração até que a Edge Function seja publicada e o Secret esteja disponível.
- Alterações restritas ao módulo Histórias, ao teste e à documentação. Robô Google Flow, IMAGEM1, IMAGEM2, IMAGEM3, demais provedores, login Google e Produto preservados.
- Validação de integração autenticada e teste real do Google dependem do novo Secret. Não houve execução de geração real neste commit.

# Histórias — módulo independente do Meu Vendedor

## Estado atual

A primeira interface foi publicada no Cloudflare em 19/11/2026 no commit `5ee21836`. Esta ampliação editorial está em `feat/historias-editorial-completo` e ainda não foi publicada. O Supabase recebeu a migração `20261119061633_stories_studio` e a função `story-studio` ACTIVE v1 com JWT obrigatório. Não há geração Gemini real autenticada validada. O serviço utiliza `GEMINI_API_KEY` ou `GOOGLE_API_KEY` já cadastradas no backend, conforme disponibilidade/cota. Não há transferência de créditos entre produtos Google.

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
- Migração Supabase aplicada e função `story-studio` publicada; falta validação autenticada das operações de Gemini e Storage.
- Confirmar o modelo Gemini disponível, cota e uma chamada real autorizada de temas e roteiro.
- Validar os prompts de 12 cenas com personagens e regras de limite da plataforma.
- Implementar edição avançada e prévia de imagens, retentativa/cancelamento de jobs no servidor, montagem final de 120s com sincronismo de áudio e publicadores autorizados para YouTube/TikTok/Kwai.
- Verificar comportamento de upload de até 100 MB nas condições reais de Storage e infraestrutura.
- Auditar referências antes de remover o antigo estúdio e sua documentação legada. `VIDEOS_IA.md` foi reduzido a um aviso de descontinuação com link para este documento; o antigo conteúdo continua acessível pelo Git.
- Nenhum robô novo de YouTube Create/Dreamina foi criado; não há API pública confirmada nem autorização para automatizar a interface dessas plataformas.

## Publicação

**Frontend básico publicado no Cloudflare; ampliação editorial em branch isolada.** Banco e Edge Function implantados; integração de vídeo e publicação social pendentes. Não executar geração de vídeo/GPU nem enviar conteúdo a redes sociais durante os testes de integração de texto.

## Ampliação editorial — 19/11/2026

## 2026-11-19 — Complemento editorial do Histórias (em validação, sem publicação)

- Implementado na branch `feat/historias-editorial-completo`: revisão separada dos temas antes de salvar, salvar individual/em lote, descarte e filtros por assunto/gênero/texto/favorito; o backend anterior já limitava cada lote Gemini a 25.
- Editor ampliado com Bíblia de Personagens editável (nome, função, aparência e voz), propagação de renomeações para cenas, edição de títulos/personagens/transições/falas e linha do tempo com 12 cenas. Aprovação verifica referências aos personagens e limite aproximado de 26 palavras por cena.
- Prompts por plataforma podem ser recuperados, editados, salvos individualmente e copiados; limite de 900 caracteres informado para YouTube Create permanece validado no frontend e no backend.
- Biblioteca de clipes agora mostra estados, visualização por URL temporária e aprovação/revogação. Painel de preparação permite selecionar YouTube/TikTok/Kwai, título e descrição, sem postar.
- Criados testes de regressão e atualizado workflow isolado de CI. Nenhum arquivo do executor Modal/Flow, IMAGEM1, IMAGEM2, IMAGEM3, Produto ou outro projeto foi alterado.
- **Estado real:** frontend Histórias básico já publicado em Cloudflare na main do commit 5ee21836, após restauração da versão do Worker; esta ampliação está SOMENTE na branch até passar CI e ser publicada. Migração e função `story-studio` **ainda não estão implantadas no Supabase**, por isso a geração Gemini não está operacional na página de produção. Montagem final de 2 minutos e publicação automática continuam pendentes de implementação/autorização.


## 2026-11-19 — Histórias editorial ampliado e Supabase ativado

- PR #12 mesclada à main em `7acd730234dcd478be13ade1cb63bbf320fec8fd`: caixa de revisão dos temas, filtros, editor de personagens/cenas, linha do tempo de 12 cenas, prompts editáveis, revisão/aprovação de clipes e preparação de publicações YouTube/TikTok/Kwai. CI isolado `44470454563` aprovado (testes, tipos, lint e build). Fluxos de postagem são apenas assistidos; geradores Flow, YouTube Create e Dreamina não foram automatizados.
- Migrado o módulo independente no Supabase projeto `jzchlrvxdaffnrgbvabv` com versão real `20261119061633_stories_studio` e nome do arquivo versionado no Git alinhado no commit `e238f760`.
- Edge Function `story-studio` ACTIVE v1, `verify_jwt=true`, serviço Gemini Text do novo módulo; não altera o robô Google Flow. Não houve teste real autenticado de geração Gemini. Existe dependência de chave/modelo e cotas disponíveis no backend.
- SQL de verificação confirmou `mv_story_topics`, `mv_story_projects`, `mv_story_prompts`, `mv_story_clips` com RLS habilitado e políticas por conta. Buckets `mv-story-clips` (100 MB) e `mv-story-images` (10 MB) privados.
- **Não concluído:** montagem real de um único MP4 de 120s, postagem direta às redes, integração de robôs geradores e teste autenticado de uso do Gemini. Não acionar inferência de vídeo/GPU nem redes automaticamente.


## 2026-11-19 — Histórias: interface completa por etapas, sem depender da correção Gemini

- Pedido: terminar primeiro a interface, sem tentar solucionar agora os erros de comunicação e sem gerar vídeos. Branch independente `feat/historias-wizard-interface`, preservando Flow, IMAGEM1/2/3, Modal e serviços de Produto.
- Nova navegação assistida com **sete etapas**: Temas → Roteiro → Ferramenta → Prompts → Cenas → Montagem → Publicação, com estágio ativo, resumo do projeto e navegação anterior/próxima.
- Criada alternativa **Roteiro manual**, permitindo salvar projeto real com doze cenas editáveis no Supabase quando a API Gemini está indisponível; os campos não são apresentados como conteúdo da IA.
- Seleção visual de agentes YouTube Create, Google Flow e Dreamina, com texto de exigências e limites internos explicitados. Os agentes desta fase organizam prompts, sem controlar sites ou renderizar vídeo.
- Introduzida **Montagem visual** com 12 espaços, cronologia 0–120 segundos, progresso de clipes aprovados e download do plano de produção JSON sem caminhos privados. Montagem/renderização MP4 e publicação automática **não** foram implementadas e aparecem como pendentes.
- Novos arquivos apenas do módulo: `src/lib/stories/workflow.ts`, alterações em `src/components/stories/StoriesStudio.tsx`, testes em `tests/story-wizard.test.mjs`, workflow de CI restrito à branch. Nenhum login, configuração de vídeo real ou gasto de créditos foi iniciado.
- A investigação de `gemini_unavailable` permanece separada. Este trabalho não altera a função `story-studio`; o backend Gemini continua exigindo posterior diagnóstico.
- Registro documental de leitura nesta sessão: `AGENTS.md`, `.github/copilot-instructions.md`, `HISTORIAS.md`, `README.md`, `HISTORICO.md`, `AJUSTES_ESTUDIO.md`, `ARQUITETURA_VIDEO_SINCRONIZADO.md`, `ASSISTENTE_DE_DIVULGACAO.md` integralmente; `ARQUITETURA.md`, `CONTINUAR_AMANHA.md` e `historico.md` parcialmente. Outros arquivos continuam não lidos integralmente nesta sessão; não declarar a leitura documental exigida em AGENTS como completa. Conferir os documentos restantes antes de outras mudanças.
- Pendente confirmar CI, revisão e deploy. Não confundir commit com publicação.

