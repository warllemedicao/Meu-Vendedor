## 21/11/2026 — Histórias: interface simples de imagem por personagem e proteção de custos

- Em Histórias → Personagens e imagens, cada personagem apresenta por padrão apenas a descrição (texto livre), o botão **Gerar e salvar imagem** e a miniatura da referência já salva. Biblioteca, edição, seleção de referências e envio manual ficam recolhidos em **Outras opções**; gestão da biblioteca em painel avançado.
- A ação reutiliza `image_character` e, após o retorno válido, faz upload privado e associação automática ao personagem, registrando na biblioteca `mv_story_characters`. Cada imagem gerada recebe um sufixo único no nome, sem solicitar campos extras ou sobrescrever versões anteriores.
- Segundo a página de preços oficial consultada em 21/11/2026, `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) **não oferece faixa gratuita na API**. Por segurança, a Edge Function bloqueia toda inferência de imagem sem opt-in de backend `HIST_IMAGEM_API_PAGA_AUTORIZADA=true`, além da chave isolada `HIST_IMAGEM_GEMINI_API_KEY`. O aplicativo não habilita esse consentimento sozinho; geração permanece desativada enquanto não existir autorização explícita. O envio manual de imagens do Google AI Studio continua disponível.
- Não foram integrados provedores Google adicionais sem comprovação de cota gratuita. Nenhuma alteração nos agentes do robô Flow ou nos módulos de Produtos/Campanhas. Deploy frontend Cloudflare e inferência real devem ser verificados separadamente.

## 21/11/2026 — Estado confirmado da migração Gemini Histórias

- Supabase: Edge Function `story-studio` publicada como **v39 ACTIVE**, JWT obrigatório, com `script_block` (4 cenas/solicitação) e modelo `gemini-3.5-flash-lite`; o código não faz chamadas ao OpenRouter.
- Frontend: alterações, testes de contrato e documentação commitados na `main`; workflow `ci-cd.yml` prevê testes e publicação Cloudflare em push. **Ainda sem confirmação do deploy frontend**; a última publicação consultada do Worker `meu-vendedor` era 21/11/2026 04:34:10 UTC, anterior aos commits de migração.
- Validação concluída: implantação Supabase aceita e versão ativa. Pendente: resultado do CI, confirmação da nova publicação Cloudflare e inferência autenticada real usando `HIST_ROTEIRO_GEMINI_API_KEY`; a existência da credencial nas variáveis da Edge Function não foi confirmada.
- O Secret legado do OpenRouter não é mais usado por Histórias, mas não foi excluído das configurações secretas (sem ação de exclusão nesta integração). Referências históricas antigas permanecem no histórico.

## 21/11/2026 — Histórias: migração de OpenRouter para Gemini único

- Módulo Histórias passa a usar exclusivamente Google Gemini: `HIST_TEMA_GEMINI_API_KEY` nos temas e `HIST_ROTEIRO_GEMINI_API_KEY` nos roteiros e prompts de IA; o módulo de imagens continua com `HIST_IMAGEM_GEMINI_API_KEY`. Secret de Produtos `PROD_ROTEIRO_GEMINI_API_KEY` não foi alterado.
- Modelo editorial de roteiros: `gemini-3.5-flash-lite`, conforme teste no AI Studio, com `thinkingLevel=LOW`, saída JSON estruturada e limite experimental de 4.000 tokens por bloco. A história é produzida em três requisições (cenas 1–4, 5–8 e 9–12), com intervalo de segurança e sem retentativas automáticas.
- Cada bloco é persistido na tabela `mv_story_projects` antes do seguinte, por usuário autenticado; falhas não apagam os blocos anteriores. A ficha visual/voz é preservada e os blocos seguintes recebem as cenas anteriores como contexto. Projetos antigos com cena parcial fora dos limites de bloco podem ser concluídos manualmente.
- Removido o cliente OpenRouter do backend e as chamadas da interface Histórias; a geração local de prompts YouTube Create/Flow/Dreamina permanece independente de IA e da automação do Google Flow.
- Arquivos alterados: `supabase/functions/story-studio/index.ts`, `src/components/stories/StoriesStudio.tsx`, testes de Histórias e documentação. Alterações não modificam IMAGEM1/2/3, Modal/Chrome ou Produtos/Campanhas.
- A publicação Supabase, os testes em produção e o frontend Cloudflare precisam ser confirmados separadamente; código versionado por si só não confirma funcionamento com a cota da conta.

## 21/11/2026 — Distinguir HTTP 429: provedor vs cota OpenRouter

- Registro real: Google AI Studio (Gemma 4 31B free) rejeitou geração em 163 ms com HTTP 429; Supabase confirmou `story_studio_openrouter_error`, `model: google/gemma-4-31b-it:free`, `elapsedMs: 527`, erro `openrouter_rate_limited`. Roteamento para Gemma validado; esta ocorrência não confirma esgotamento de créditos.
- Edge Function passou a ler apenas `error.metadata.limit_source` (sem registrar corpo da resposta/chave/prompt) e diferenciar `upstream_provider_shared_pool` (limitação do provedor), `openrouter_free_tier*` (limite gratuito da conta), e 429 indeterminado. O frontend apresenta mensagens específicas e separa HTTP 402 de 429.
- Não realizar retries automáticos e não trocar para modelos pagos; tentativas malsucedidas também podem contar na cota diária gratuita. Validar via testes e workflow, publicar Supabase e Cloudflare.

## 21/11/2026 — Correção de roteamento OpenRouter gratuito e Preset

- Logs reais: `story_studio_openrouter_transport_error` em 2026-11-21 03:14:17 UTC, `openrouter_timeout` após 90.001 ms; Edge Function respondeu HTTP 503. OpenRouter registrou modelo Liquid LFM3-1.7B gratuito, geração lenta e cancelada. Outra tentativa com NVIDIA terminou `length` por limite de saída.
- Causa do roteamento imprevisto: `openrouter/free` selecionava modelos aleatórios, mesmo quando o responsável configurava Gemma no Preset.
- Correção: `SCRIPT_MODEL=google/gemma-4-31b-it:free` como modelo fixo gratuito; secret `HIST_OPENROUTER_MODEL` continua permitindo indicar outro modelo terminando em `:free`; o valor legado `openrouter/free` é normalizado para o Gemma.
- Correção adicional documentada oficialmente: identificador do Preset deve ser `@preset/<slug>`. Enviar apenas `preset: slug` faz o OpenRouter ignorá-lo. Agora a função inclui `preset: "@preset/" + presetSlug` para o roteiro completo, quando `HIST_OPENROUTER_PRESET` está configurado.
- Nenhuma chamada de IA executada para depuração; sem repetição automática. Manter cadastro apenas de modelos gratuitos e nunca incluir provedores pagos no Preset; prompts locais continuam sendo a opção padrão.

## 20/11/2026 — Histórias: roteirista profissional e motor local de 12 prompts

- Roteirista OpenRouter: instrução do roteiro completo de 12 cenas aprimorada para arco causal, ganchos reais, comédia/suspense/drama adequados ao gênero, falas sequenciais em PT-BR, geometria física de obstáculos e personagens consistentes. Uma chamada de roteiro continua sendo a meta, com revisão antes de aprovar.
- **Preset OpenRouter opcional:** regras versionadas em `docs/openrouter/roteirista-12-cenas.md`, slug `meu-vendedor-roteirista`. O secret `HIST_OPENROUTER_PRESET` ativa o preset após o responsável criá-lo no painel; a chave `HIST_ROTEIRO__OPENROUTER` permanece independente. A requisição ainda fixa o modelo gratuito `openrouter/free`; não usar fallbacks pagos nem ferramentas extras no Preset. Regras armazenadas também consomem tokens de entrada durante inferência.
- **Motor de direção interna:** `makeLocalPromptDrafts()` ampliado para orientar movimentos fisicamente coerentes e falas por turnos, com aviso sobre atravessar cordas, barreiras etc. sem indicar passagem por cima/baixo/ao redor. Nenhuma IA é chamada para compor prompts.
- **Fluxo após aprovação:** botão principal **Gerar e salvar 12 prompts sem IA** monta e valida o lote completo para a plataforma escolhida, verifica RLS por usuário e salva apenas prompts ainda inexistentes, com `ignoreDuplicates: true` para não sobrescrever versões aprovadas. Geração com OpenRouter permanece dentro de opções avançadas.
- Restrições preservadas: YouTube Create 900 caracteres, Flow teto editorial 1600, Dreamina 1200; falas literais e links privados não expostos. Os comandos de direção são orientações, não garantias de comportamento do gerador de vídeo.
- Testes de direção, áudio sequencial, roteamento gratuito e UI atualizados; execução de CI e publicação Cloudflare dependem de resultado aprovado. Não tocar robô Flow/Modal, IMAGEM1/2/3, produtos ou campanhas. Sem inferência externa de testes nesta implementação.
- **4K:** roteiro e prompt são somente texto; qualidade/resolução de MP4 dependem do gerador de vídeo e eventual pós-processamento, não do OpenRouter.

## 20/11/2026 — Histórias: diagnóstico HTTP 503 do OpenRouter e retomada do roteiro

- Teste de produção: `story-studio` retornou **HTTP 503** em 21/11/2026 às 01:33:29 UTC, após sucesso na geração dos temas com Gemini. O diagnóstico anterior não registrava se o erro de transporte era timeout ou rede; **a causa exata daquele pedido não foi comprovada**.
- `story-studio` atualizado para registrar categorias seguras `openrouter_timeout` e `openrouter_network_error` com latência, sem armazenar chave, prompt ou respostas; **Supabase v32 ACTIVE**, JWT preservado.
- Ao falhar uma primeira geração, o rascunho vazio permanece salvo. Agora o botão **Gerar roteiro completo · OpenRouter** permite retomá-lo usando **uma solicitação** de 12 cenas, sem criar outro projeto. Os projetos com cenas já preenchidas preservam o fluxo antigo sem sobrescrever cenas.
- Corrigidos os testes de contrato relacionados ao diagnóstico e à retomada. Frontend sujeito ao workflow de validação e deploy da `main`; nenhuma nova chamada externa de inferência foi realizada pela correção.

## 20/11/2026 — Histórias: migração para OpenRouter gratuito e geração em lotes

- Secret dedicado ao Supabase: **`HIST_ROTEIRO__OPENROUTER`** (dois sublinhados antes de OPENROUTER). Nenhum valor sensível versionado; sem secret cadastrado, a função responde `openrouter_not_configured`.
- OpenRouter API `/api/v1/chat/completions` exclusivamente para **roteiro** e **prompts**. Modelo padrão `openrouter/free`; a opção `HIST_OPENROUTER_MODEL` aceita apenas `openrouter/free` ou identificadores terminados em `:free`, bloqueando a seleção de modelos pagos.
- Temas permanecem no `HIST_TEMA_GEMINI_API_KEY` (Gemini Flash-Lite); referências visuais permanecem em `HIST_IMAGEM_GEMINI_API_KEY`, sem afetar robô Flow, IMAGEM1, IMAGEM2, IMAGEM3, Cloudflare ou Modal.
- Fluxo principal: **uma chamada para o roteiro completo de 12 cenas de 10 segundos**, revisão e aprovação manual, **uma chamada para os 12 prompts da plataforma selecionada**. Sem regenerar projetos existentes ao abrir o tema e sem sobrescrever prompts salvos; qualquer complementação preserva os registros já existentes.
- Validações no backend: JSON, exatamente 12 cenas/12 prompts, personagens e falas em português, suspense, limites de 26 palavras de diálogo por cena, limites por plataforma, continuidade e estilo visual; resposta truncada é recusada, sem repetição automática. Logs limitados a status/modelo/contagem de tokens/tempo.
- Teto de saída solicitado: **8.000 tokens no roteiro** e **8.500 nos 12 prompts**; os modelos gratuitos têm restrições próprias e a capacidade real precisa de teste com uma chave válida. A estimativa de 2 chamadas por história não é garantia de aprovação do provedor.
- Testes de contrato migrados em `tests/story-studio.test.mjs` e `tests/story-editorial.test.mjs`. Publicação Cloudflare e execução real condicionadas à validação do frontend; nenhuma inferência gratuita será consumida sem autorização do usuário.
- **Supabase publicado e confirmado:** Edge Function `story-studio` versão **29**, status **ACTIVE**, JWT obrigatório e 5 arquivos. Secrets não podem ser lidos pelo deploy: o uso efetivo depende de cadastrar a chave no painel. CI frontend ainda não comprovado e Cloudflare não republicado nesta etapa.

## 20/11/2026 — Histórias: nomes dos personagens e imagens editáveis sem saltos

- Correção no editor de **Personagens e imagens** (`src/components/stories/StoriesStudio.tsx`): o campo `Nome` utiliza `characterNameDrafts` enquanto o usuário digita; não altera as referências de cenas nem desfaz espaços a cada caractere. A alteração é aplicada ao sair do campo e consolidada automaticamente ao **Salvar alterações**, atualizando o nome na ficha, personagens presentes, falas estruturadas e rascunhos de falas existentes. Validação impede nomes vazios, acima de 100 caracteres ou duplicados na ficha.
- **Biblioteca de imagens:** botão **Renomear** agora revela um campo controlado com **Salvar/Cancelar** dentro do painel já recolhível `Gerenciar biblioteca e envio em lote`, em vez de janela `window.prompt`. O nome é persistido no registro da imagem `mv_story_characters` por `id` e `user_id`, com feedback de sucesso/erro. Mantida a interface enxuta fora do painel.
- Para envio individual e geração opcional de novas referências, o nome escolhido no campo **Nova imagem** é verificado no Supabase **antes** do envio/consumo de IA, prevenindo sobrescrita acidental de outra imagem com o mesmo nome; registros novos usam `insert` em vez de `upsert` por nome. A associação ao roteiro só ocorre depois do registro na biblioteca. O campo é limpo após sucesso; imagens antigas preservadas. No envio múltiplo, os nomes únicos continuam automáticos e podem ser alterados na biblioteca depois.
- Estados de nome são reiniciados ao abrir/criar projeto, e a mudança na ficha atualiza os prefixos `Nome:` das falas em edição mantendo as quebras de linha. Não foram alterados executores de robô, IMAGEM1, IMAGEM2, IMAGEM3, Gemini, OpenAI, esquema/RLS ou Edge Functions.
- Atualizados testes `tests/story-editorial.test.mjs` e `tests/story-studio.test.mjs`. Conferência estática de 304 expectativas regex sem divergências. Ainda é necessário confirmar a suíte completa de testes, typecheck, lint e build no GitHub Actions; não houve deploy Cloudflare nem nova migração Supabase.

## 20/11/2026 — Correção do typecheck TS1003 após migração OpenAI

- Log do GitHub Actions: `src/components/stories/StoriesStudio.tsx(1102,13): error TS1003: Identifier expected`.
- Causa identificada: tag `<button>` incompleta na seção de opções avançadas, resquício da remoção do botão Flash-Lite; o JSX encontrava um `<span>` antes de completar a abertura da tag.
- Removida somente a tag incompleta; a geração das cenas restantes permanece no comando existente no topo. Acrescentado teste de regressão em `tests/story-editorial.test.mjs` para impedir a reaparição do botão incompleto.
- Commits `afd13fe4` e `78abcb4`. Publicação não executada. A correção foi conferida estaticamente; `npm run typecheck` ainda deve ser repetido no GitHub Actions.

## 20/11/2026 — Histórias: OpenAI substitui Gemini apenas em roteiros e prompts

- Nova integração no `supabase/functions/story-studio/index.ts`: `HIST_ROTEIRO_OPENAI` exclusivamente para `script_scene`, `script`, `prompt_scene` e `prompts`, via endpoint oficial `/v1/chat/completions` usando modelo `gpt-5.4-mini-2026-03-17`, JSON, `store:false`, `reasoning_effort:none` e limite de saída por solicitação. Sem retentativas automáticas, nem registro de chaves, conteúdo de prompts ou falas nos logs. Contagens de entrada/saída/total da API são registradas sem conteúdo. `diagnose_script` passa a consultar somente metadados do modelo OpenAI por GET sem inferência.
- `HIST_TEMA_GEMINI_API_KEY` permanece independente para os **temas** e `HIST_IMAGEM_GEMINI_API_KEY` permanece para a **geração opcional de imagens**. A chave `HIST_ROTEIRO_GEMINI_API_KEY` não é mais lida pelo backend. Nenhuma integração de vídeo, autenticação, banco ou arquivos do robô Flow/IMAGEM1/2/3 foi alterada.
- Diretriz editorial incluída no backend: cada cena termina com gancho de curiosidade/suspense variado e causal, preservando personagens e encadeamento; a 12ª encerra o conflito. Mantém uma cena por pedido e salvamento progressivo das cenas já produzidas. Os agentes de prompt de **YouTube Create, Google Flow e Dreamina** foram alinhados às regras específicas, incluindo metas de comprimento e controle de referências.
- UI reaproveita o editor compacto já existente, mantendo somente a edição do roteiro, os personagens e a área de prompt; substitui rótulos **Gemini** por **OpenAI** nos roteiros/prompts, sem adicionar caixa de comparação. Removida ação alternativa Flash-Lite, que não seria mais válida; geração automática das cenas restantes exige confirmação nativa para explicitar consumo de créditos. Temas continuam com Gemini. Roteiros já salvos continuam disponíveis.
- Testes atualizados em `tests/story-studio.test.mjs` e `tests/story-editorial.test.mjs`; auditoria estática de 285 expressões de testes (match/doesNotMatch) sem falhas, mas suíte npm/typecheck/lint/build não foi executada localmente; CI ainda precisa ser confirmado. Nenhum teste de inferência OpenAI foi enviado, preservando o saldo do usuário.
- Se o usuário clicar em **Gerar prompt com OpenAI** sobre um prompt já salvo (por exemplo, elaborado pelo Gemini), uma confirmação nativa permite carregar o prompt existente sem custo ou optar por gerar uma nova versão; o conteúdo salvo só é substituído após revisão e salvamento manual. Teste adicional em `tests/story-editorial.test.mjs`.
- **Deploy Supabase executado e verificado:** `story-studio` **v26 ACTIVE**, JWT obrigatório, cinco arquivos publicados, confirma `HIST_ROTEIRO_OPENAI`, modelo OpenAI, temas Gemini e ausência da chave antiga no código implantado. O Secret `HIST_ROTEIRO_OPENAI` deve ser cadastrado pelo proprietário no Supabase; a conexão real e o saldo ainda não foram confirmados. **Frontend Cloudflare ainda requer publicação** após CI verde, pois a API de publicação de assets estáticos exige build pelo GitHub Actions.

## 20/11/2026 — Histórias: edição livre das falas sem perder espaços ou posição do cursor

- Corrigido o campo **Falas (Nome: texto)** em `src/components/stories/StoriesStudio.tsx`. Antes a cada tecla ele transformava o texto em `dialogue[]` com `.trim()` e o reconstruía, descartando espaços finais e linhas temporariamente incompletas. Agora o `textarea` usa o rascunho bruto de edição `sceneDialogueDrafts`, isolado por projeto e cena, mantendo o texto digitado intacto e sem mover o cursor por reserialização.
- A função `parseStoryDialogueDraft` em `src/lib/stories/workflow.ts` extrai os diálogos válidos para o roteiro e indica o número de linhas incompletas. Enquanto o usuário edita, pode inserir espaços, apagar e reescrever frases livremente. Ao **salvar roteiro**, **preparar prompt** ou **avançar**, linhas malformadas são comunicadas explicitamente e impedem perda silenciosa de falas.
- Mantido o limite de **26 palavras somadas por cena** para salvar; não foi adicionado limite de caracteres na caixa. Ao abrir outro projeto ou criar novo, os rascunhos locais são reiniciados, e o conteúdo persistido continua vindo do Supabase. Nenhuma função Gemini/Supabase, robô Google Flow ou arquivos IMAGEM1/2/3 foi modificada.
- Atualizados testes em `tests/story-editorial.test.mjs` (estado bruto e fluxo) e `tests/story-compact-prompts.test.mjs` (parser, espaços, linhas incompletas). Commits `d728521`, `f1e96b5`, `dfdcea0`, `dbe1234`, `640f9fb`, `d27ece1`.
- Os commits foram gravados na `main`. Execução completa de testes, typecheck/lint/build e publicação em produção aguardam confirmação pelo GitHub Actions.

## 20/11/2026 — Histórias: proteção contra novos roteiros duplicados e consumo acidental de Gemini

- O botão principal **Roteiro** agora pesquisa diretamente `mv_story_projects` pelo `user_id` autenticado e `topic_id` do tema, ordenando por `updated_at` e limitando a um projeto antes de qualquer `insert` ou `script_scene`. Ao encontrar um projeto, chama `openProject` para recuperar cenas, personagens, prompts, referências e clipes existentes e retorna **sem chamar Gemini**.
- Se a consulta falhar, a ação é bloqueada com erro explícito: não cria projeto nem solicita créditos de IA sem confirmar que não há roteiro salvo. Um `useRef` controla cliques rápidos repetidos na mesma sessão e é liberado no `finally`.
- A opção **Mais → Nova versão (Gemini)** é separada e pede confirmação de que pode consumir tokens; o usuário preserva o roteiro antigo e opta explicitamente por criar outro. Roteiros existentes duplicados não são apagados, e nenhum ajuste de banco/RLS foi realizado.
- Testes de regressão em `tests/story-editorial.test.mjs` verificam consulta por proprietário e tema, reutilização antes da inferência, bloqueio de falhas de busca, trava de cliques e confirmação da nova versão.
- Commits `0740483` (proteção) e `92ce1b7` (testes). Verificações estáticas locais sobre arquivos do GitHub aprovadas; suíte GitHub Actions, typecheck, lint, build e publicação ainda precisam ser confirmados.

## 20/11/2026 — Histórias: correção de prompts sem IA por plataforma

- Revisão do gerador local `makeLocalPromptDrafts` em `src/lib/stories/workflow.ts`: formatos agora diferentes para **YouTube Create**, **Google Flow** e **Dreamina**, sem alterar ações Supabase/Gemini/Google Flow.
- YouTube Create: limite exato de **900 caracteres** no projeto, com contagem conservadora de unidades UTF-16 incluindo espaços/quebras e emojis; a aplicação não presume normalização do serviço. O prompt usa **Sujeito + Microação + Ambiente + Câmera**, com fala pt-BR exata. A primeira microação é isolada por separadores explícitos de frase/tempo; caso existam outras, a UI mostra aviso, sem apagar o roteiro. Configuração de 9:16, iluminação e até 3 imagens depende do aplicativo YouTube Create. Documentação pública confirma 900 caracteres e que o modo de vídeo admite vários idiomas; a exigência inglês/hindi refere-se à geração de imagens Nano Banana.
- Google Flow: prompt de cena conciso com `@Nome` normalizado, câmera e falas. Instruções visuais globais para o Agente são geradas separadamente e ficam copiáveis no painel recolhido. A meta de ~30 palavras é editorial, não limite oficial; menções e vozes dependem de ativos cadastrados no Flow, não são automaticamente vinculadas.
- Dreamina: ordem fixa de assunto rotulado `Sujeito 1/2`, ação, ambiente, iluminação/tom, câmera, estilo, qualidade/restrições; `@Imagem N` só é mencionado quando o personagem possui referência no projeto, e precisa ser associado manualmente no editor Dreamina. Falas preservadas.
- Geração local preserva diálogos, não inventa tradução automática e não recorta texto obrigatório para burlar limite. Caso não caiba, mostra erro explícito. Contagem de caracteres padronizada no preparo, salvamento, cópia, avanço de cena, editor geral e indicador visual. A resposta Gemini acima do limite é rejeitada no preparo sem ser marcada como válida.
- Testes atualizados em `tests/story-compact-prompts.test.mjs` e `tests/story-editorial.test.mjs` (microações, limites, espaços/emoji, rotulagem Dreamina, menções e agente Flow).
- Commits `2087751`, `5fa653a`, `d6eb174`, `e0b8ed6`, `9e2d440`, `d7dbc39`, `4bc7fc9`. Verificações estáticas no GitHub realizadas; não foi possível executar a suíte npm/typecheck/lint/build nem confirmar publicação do Cloudflare nesta sessão. Publicar somente após CI aprovado.

## 20/11/2026 — Correção de validação dos testes editoriais após simplificação do Prompt

- Analisado log de `npm test` fornecido pelo usuário: **391 testes executados, 388 aprovados e 3 falhos** no arquivo `tests/story-editorial.test.mjs`. Falhas apontavam assertions antigas de `{expanded && ...}` e espaço obrigatório após a vírgula em `prepareScenePrompt(s.number, false/true)`.
- Confirmado no componente `StoriesStudio.tsx` que a nova condição válida é `(expanded || sceneWorkbenchStep === "prompt")` e que os dois métodos existentes permanecem chamados com `false` e `true` respectivamente. Ajustadas apenas essas expressões regulares nos testes, permitindo espaço opcional, sem alterar a implementação ou consumir créditos Gemini.
- Commit `8b5c456` na `main`. Verificações de correspondência entre as novas assertions e o código realizadas após o commit, mas a suíte completa, typecheck, lint e build devem ser reconfirmados no CI antes de publicar.

## 20/11/2026 — Histórias: Gerar prompt com seleção visual e tela compacta

- Simplificado o topo da etapa **Prompt e download**: exibe somente **Cena N · título**, miniaturas das imagens de personagens presentes, seletor por cartões visuais de **YouTube Create**, **Google Flow** e **Dreamina**, seguido dos dois botões **Gerar prompt sem IA** e **Gerar prompt com Gemini**.
- Criados SVGs ilustrativos originais em `public/stories/tools/` (não logotipos oficiais), associados aos valores originais dos geradores, sem alterar a plataforma salva por cena nem limites de caracteres.
- Ações de edição, salvar, copiar e baixar o prompt e importar MP4 surgem após haver texto de prompt para a ferramenta escolhida. Navegação entre cenas, resumo de progresso e cabeçalho do roteiro ficam ocultos no passo de prompt. A volta ao roteiro ou imagens e as instruções da plataforma estão no painel fechado **Outras opções e imagens para baixar**.
- Sem IA: chama `makeLocalPromptDrafts` no navegador, sem chamada Gemini. Com Gemini: chama `prompt_scene` autenticada via Supabase, sujeita a cota; se já houver prompt persistido da mesma cena/plataforma, ele é recuperado sem nova geração. Nenhum endpoint, modelo de IA, chave, robô Flow ou arquivo IMAGEM1/IMAGEM2/IMAGEM3 foi alterado.
- Commits `fb44d56`, `1ae1cc8`, `b0d65d1` (ícones), `7cb3618` (painel), `a5db0d6` (topo), `b452724` (testes de contrato). Gravação do código comprovada no GitHub, mas não foi executada suíte completa/typecheck/lint/build nem confirmada publicação Cloudflare.

## 20/11/2026 — Histórias: seleção de imagens dos personagens por miniaturas

- Etapa **Imagens dos personagens** simplificada: exibe apenas os personagens citados na cena ativa (`scene.characters`), com nome, referência escolhida e grade de miniaturas clicáveis da biblioteca. O usuário escolhe com um clique, com indicação visual da seleção. Nenhuma ficha abre automaticamente.
- O botão **Editar** abre sob demanda os campos nome, função, aparência e voz, com salvamento explícito do roteiro. O cartão **Nova imagem** abre nome, descrição e upload individual; a geração opcional Nano Banana fica em painel recolhido. Gerenciamento/renomeação e envio de várias imagens ficam em **Gerenciar biblioteca e envio em lote**, recolhido.
- Novos uploads e imagens geradas são guardados no Storage privado sob `<user_id>/library/<character_style>/<uuid>.<ext>`, permitindo listar por tipo de personagem (`frutinhas`, `infantil`, `pessoas_cabeca_fruta`) sem migração de banco. Os registros anteriores, sem categoria no caminho, continuam disponíveis em **Ver imagens antigas ou de outros tipos**, recolhido, para evitar perda de acesso e atribuição errada de estilo.
- Mantidos vínculo autenticado com projeto e RLS, função `chooseLibraryImage`, download de referência e upload seguro. Sem mudanças nas Edge Functions, Google Flow, IMAGEM1/IMAGEM2/IMAGEM3 ou chaves.
- Commits `35046ef` (interface), `38599ee` (filtragem por estilo), `f521b28` (testes de contrato). A suíte completa npm/typecheck/lint/build e a publicação Cloudflare ainda precisam de validação no workflow; a gravação dos arquivos no GitHub não comprova publicação em produção.

## 20/11/2026 — Temas: fotos enviadas pelo usuário substituem miniaturas de estilos

- Substituídas exclusivamente as três miniaturas SVG em `public/stories/styles/` por versões contendo as respectivas fotos enviadas, incorporadas como JPEG compactado (prévia visual), preservando os caminhos existentes usados pela interface.
- Correspondências: `frutinhas.svg` = maçã falante de capacete (foto 1); `infantil.svg` = criança na banheira (foto 2); `pessoas-cabeca-fruta.svg` = cientista com cabeça de morango (foto 3).
- A estrutura do seletor, valores internos `frutinhas`, `infantil` e `pessoas_cabeca_fruta`, banco Supabase e lógica de geração não foram modificados. Os três arquivos foram relidos no GitHub e contêm as imagens incorporadas.
- Commits na `main`: `ee844b5`, `fa6675f`, `85e97b9`. Não foi executado build nem confirmado deploy Cloudflare nesta atualização.

## 20/11/2026 — Histórias: tela Temas minimalista e seleção visual de personagens

- Solicitação: remover a caixa/cabeçalho "Estúdio de Histórias", transformar título "Assuntos e temas" em **Temas** sem instrução abaixo, renomear o campo **Assunto principal** para **Tema**, substituir descrições textuais dos tipos de personagem por imagens que expliquem visualmente o estilo e recolher a biblioteca de temas até o usuário abrir seu filtro.
- Tela `src/components/stories/StoriesStudio.tsx`: removido o cabeçalho grande; a navegação geral de etapas foi reduzida a menu pequeno fechado e não aparece nas telas `temas`/`roteiro`. Cabeçalho da primeira seção agora diz só `Temas`, sem parágrafo explicativo. Campo do assunto passou a ter rótulo `Tema` (nome do estado/API mantido para preservar compatibilidade).
- Estilos com **três miniaturas SVG originais**, incluídas como arquivos do site em `public/stories/styles/frutinhas.svg`, `infantil.svg`, `pessoas-cabeca-fruta.svg`. Cartões exibem apenas a ilustração; nome do estilo permanece acessível via `aria-label`/`title` e seleção `aria-pressed` e destaque visual. Estilos são os três valores anteriores: `frutinhas`, `infantil`, `pessoas_cabeca_fruta`, sem mudanças no backend ou na persistência.
- Os temas gerados ainda não salvos só aparecem se houver resultados, evitando painel de revisão vazio. A biblioteca de temas salvos fica dentro de `<details>` sem `open`, com resumo **Filtrar e ver temas salvos (N)**; usuário precisa expandir para exibir filtros, lista e operações. A seleção individual, selecionar todos os exibidos e exclusão com confirmação permanecem funcionando conforme a lógica anterior, sem deletar dados automaticamente.
- Testes de contrato em `tests/story-editorial.test.mjs` ajustados ao novo menu compacto e à biblioteca recolhida, e novas verificações garantem os arquivos SVG, rótulos e ausência de descrição textual/introdução. **12 verificações estáticas pontuais aprovadas**. CI npm, typecheck, lint e build ainda não confirmados para estes commits; frontend precisa ser republicado no Cloudflare somente após validar `main`.
- Supabase, geração Gemini, Google Flow, IMAGEM1/IMAGEM2/IMAGEM3 e dados existentes permanecem intactos.

## 19/11/2026 — Correção de TS1005 no JSX da lista compacta de temas

- Analisado diretamente o run GitHub Actions `44639955209`, job `135968161534`. Logs: **387/387 testes passaram**, mas o `Typecheck frontend` falhou em `src/components/stories/StoriesStudio.tsx:924:9` com `TS1005: '}' expected`; Typecheck Edge, lint e build foram pulados.
- Causa confirmada na `main`: durante a compactação dos temas não salvos, o bloco `{draftTopics.map(t => <article ...` terminava em `</article>)` em vez de `</article>)}`. A expressão JSX continuava aberta e o parser falhava na linha seguinte.
- Correção cirúrgica em `StoriesStudio.tsx`, alterando **somente o fechamento da expressão JSX**. Commit `1d5a809b9ac6a6f5841fbf6448630af5b23701cd`. Conferência posterior da versão no GitHub confirmou o bloco fechado.
- Teste estático de regressão adicionado em `tests/story-editorial.test.mjs`, exigindo `</article>)}` no mapa dos cartões compactos e rejeitando o fechamento defeituoso. Commit `7d0ac09767ba226b4945f2d5aa5e1b010165a987`.
- **Não foi possível executar aqui a suíte completa, compilador TypeScript, lint nem build. Necessário verificar o novo CI na main antes de publicar no Cloudflare.** Nenhum tema real foi excluído; backend Supabase, robô Flow e IMAGEM1/IMAGEM2/IMAGEM3 não foram alterados.

## 19/11/2026 — Histórias/Temas: limpeza dos temas antigos e interface compacta

- Pedido: os temas legados, criados antes da seleção do tipo de personagem, continuam na biblioteca; o usuário quer exclusão individual ou em lote e menos conteúdo repetido.
- Frontend `StoriesStudio.tsx`: adicionado estado de seleção, checkbox por tema, **Selecionar todos os temas exibidos** e botão **Excluir selecionados (N)**, desativado quando não há seleção. O seletor trabalha sobre os temas visíveis após busca/filtros, não sobre registros ocultos; operação valida novamente IDs e `user_id` antes de excluir. Exige confirmação nativa explícita, divide lotes em no máximo 50 IDs, exibe contagem e erros parciais, atualiza as listas após o processo.
- Adicionado filtro de tipo de personagem com opção **Sem estilo (antigos)**, que usa o valor `nao_definido` atribuído pela migração anterior; assim é possível selecionar só temas antigos para exclusão sem afetar temas de estilos novos.
- Cartões de temas salvos e de temas gerados ainda não salvos compactados: **exibem apenas o título** e ações diretas. Removidas sinopses e metadados repetidos da listagem; em biblioteca, opções secundárias de favorito e roteiro manual ficam em menu `Mais`. Busca e filtro de assunto continuam visíveis; demais filtros ficam recolhidos.
- Proteção de dados verificada diretamente no Supabase (somente leitura): FK `mv_story_projects_topic_id_fkey` usa `ON DELETE SET NULL`, de modo que **excluir o tema não exclui projetos, cenas e roteiros já salvos**. Política RLS de `mv_story_topics` é restrita a `auth.uid() = user_id`. **Nenhum tema real foi excluído pelo assistente**; só o usuário logado poderá confirmar pela UI.
- Atualizados testes de contrato `tests/story-editorial.test.mjs` para nova etiqueta do botão Roteiro, exclusão sob usuário autenticado, confirmação, seleção visível, filtros de legado e renderização sem sinopses. **12 verificações estáticas pontuais aprovadas**. Não houve execução local de npm test, typecheck, lint, build ou teste de integração; conferir resultado do GitHub Actions antes da publicação do frontend Cloudflare.
- Alterações restritas a frontend, testes e histórico. Supabase Edge Function, base de dados, robô Google Flow e arquivos IMAGEM1, IMAGEM2, IMAGEM3 não modificados.

## 19/11/2026 — Simplificação da aba Temas: retirada de verificações e caixa demonstrativa

- Removidos do formulário de Temas os botões **Verificar Gemini sem gerar temas** e **Verificar API de roteiros sem gerar**, além da caixa **Quer testar a interface antes de corrigirmos a conexão Gemini?** e seu formulário de roteiro demonstrativo/manual por título.
- Eliminados do frontend o manipulador `checkGeminiConnection` e os estados exclusivos `checkingGemini`/`manualTitle`, evitando controles ocultos e código sem uso.
- Permanecem disponíveis **tipo de personagem**, assunto, gênero, quantidade de temas (5/10/15/20), **Gerar temas com Gemini**, revisão e salvamento na biblioteca. A opção de roteiro manual a partir de um tema já salvo foi preservada.
- Mantidas no backend as ações autenticadas de diagnóstico por metadados, sem botões públicos nessa tela; não foi alterada nem publicada Edge Function, Supabase ou robô Google Flow.
- Testes de contrato `tests/story-studio.test.mjs` e `tests/story-wizard.test.mjs` atualizados para verificar a ausência dessas opções, preservando a cobertura dos fluxos reais. Verificações estáticas após a alteração passaram; **suite completa do GitHub Actions, typecheck, lint e build ainda não confirmados**, e o frontend Cloudflare ainda necessita publicação após CI aprovado.
- Não foram alterados os arquivos IMAGEM1/IMAGEM2/IMAGEM3.

## 19/11/2026 — Histórias: tipo visual dos personagens escolhido ANTES de gerar temas

- Novo seletor obrigatório na etapa **Assuntos e temas**, antes do campo de assunto e do botão Gemini, com três estilos: **Frutinhas** (frutas antropomórficas completas), **Infantil** (personagens originais fofinhos e adequados a histórias para crianças) e **Pessoas com cabeça de fruta** (corpos humanos estilizados, roupas e cabeças de fruta). Nenhuma opção inicia marcada; criar temas ou roteiro manual novo exige escolha explícita. Gênero (comédia, aventura, suspense etc.) continua separado.
- O estilo é enviado a `topics` e fica associado a cada item em revisão. Ao salvar, persiste em `mv_story_topics.character_style`; os assuntos iguais com estilo diferente podem coexistir graças à unicidade `(user_id, subject, title, character_style)`. Filtro de duplicatas da geração considera o estilo.
- Criar o roteiro a partir de tema salvo herda `character_style`; o campo permanece em `mv_story_projects` e é recuperado ao reabrir o projeto. As chamadas de `script_scene` mantêm o estilo tanto na primeira criação do elenco quanto na continuidade das 12 cenas. `prompt_scene` recebe o mesmo estilo em ambos os fluxos de geração, e o montador local `makeLocalPromptDrafts` o descreve quando especificado. Plano de produção também inclui `characterStyle`.
- Migração Supabase **`20261119230412_stories_character_styles.sql`** aplicada com sucesso, duas colunas obrigatórias e `CHECK` de estilos válidos. Projetos/temas antigos recebem **`nao_definido`**, sem presumir retroativamente uma estética ou alterar cenas existentes. Migração Github renomeada para corresponder à versão real registrada pelo Supabase.
- Supabase Edge Function **`story-studio` v25 ACTIVE**, JWT obrigatório; instruções de estilo incluídas na geração de temas, personagens/cenas e prompts de vídeo. **Não foram realizadas chamadas reais de geração Gemini nem de imagens nesta alteração**.
- Testes de contrato adicionados à seleção obrigatória, persistência, migração e integração nos prompts. **Validação CI completa e build Cloudflare ainda precisam ser confirmados**; frontend só aparece após publicar o `main` com workflow normal. Não foram alterados robô Google Flow, IMAGEM1/IMAGEM2/IMAGEM3, nem credenciais e módulos Produtos.

## 19/11/2026, 19h43–19h48 BRT — Validação Histórias: lint `prefer-const` após testes e TypeScript aprovados

- Conferido especificamente o workflow GitHub Actions run `44631298929`, job `135938322985`, com início de log `2026-11-19T22:43:43Z` (19h43min43s BRT), correspondente à execução apontada pelo usuário por volta de 19h44, e lint às `22:45:39Z` (19h45min39s BRT).
- **Evidência diretamente do job:** `Run all tests` = success; `Typecheck frontend` = success; `Typecheck Edge Functions` = success; `Lint` = failure; `Build static frontend` = skipped. Lint reportou **um erro** em `src/components/stories/StoriesStudio.tsx:407:9`: `'characters' is never reassigned. Use 'const' instead` (`prefer-const`). Os outros oito avisos da mesma análise não interromperam o job.
- **Verificação antes de editar:** inspecionada a função `uploadCharacterBatch` atual da branch main. Variável `characters` não era reatribuída; o código altera somente elementos `characters[emptyIndex]`. Logo `const` preserva a semântica.
- **Correção mínima:** única linha `let characters = [...project.characters];` → `const characters = [...project.characters];`, commit `a7db539201a6cca700a241ca2a7ad52a0e4e95e4`. Diff retornado pelo GitHub confirmou **exatamente um arquivo e uma linha alterados**. A versão publicada na branch main foi relida e o vínculo das imagens ao projeto permaneceu intacto.
- Workflow da main permanece configurado para executar testes, typecheck frontend, typecheck Edge, lint e build ao alterar `src/components/stories/**`. **Nova execução após o commit ainda não confirmada**; não declarar lint/build aprovados nem implantar Cloudflare antes do resultado positivo.
- Robô Flow, IMAGEM1/IMAGEM2/IMAGEM3, Supabase e demais módulos não foram modificados por essa correção.

## 19/11/2026 — Nova falha GitHub Actions: TypeScript TS2367 no cabeçalho condicional

- Execução fornecida pelo usuário: run `44614995846`, job `135881186764`. Lidos logs e etapas reais: `npm test` **passou**, mas `Typecheck frontend` **falhou com 8 erros TS2367** em `src/components/stories/StoriesStudio.tsx`, linhas originais 815, 820, 822, 825, 827, 829, 833 e 836. Typecheck Edge Functions, lint e build ficaram sem execução após o erro.
- Causa precisa: o cabeçalho já estava condicionado por `stage !== "roteiro"`, mas possuía comparações redundantes `stage === "roteiro"` e `stage !== "roteiro"` no mesmo bloco. O TypeScript corretamente restringiu o tipo e rejeitou comparações impossíveis.
- Corrigido reestruturando **somente o cabeçalho de navegação geral**: quando a etapa é roteiro, não aparece; nas demais etapas, o conteúdo usa classes fixas sem comparações impossíveis. Nenhuma lógica de geração Gemini, salvamento, autenticação ou upload de imagens foi alterada.
- Adicionado teste de regressão em `tests/story-editorial.test.mjs` que exige única condição externa de exibição e proíbe verificações internas desnecessárias contra `roteiro`.
- **Necessário confirmar a próxima execução completa do workflow**; não declarar CI aprovado com base apenas na revisão do código. Robô Google Flow e arquivos IMAGEM1/2/3 permanecem intocados.

## 19/11/2026 — Falha real na validação Histórias: assertions de rótulos antigos

- Usuário informou falha do GitHub Actions: run `44613428956`, job `135875687826` (`Validate Histórias (no deployment)`). Logs do job foram lidos integralmente. O passo `Run all tests` falhou com **duas assertions de texto obsoletas**; `Typecheck frontend`, `Typecheck Edge Functions`, `Lint` e `Build static frontend` ficaram `skipped`.
- `tests/story-editorial.test.mjs`: teste de edição de personagens ainda esperava o rótulo `Bíblia de personagens`, enquanto o frontend passou a mostrar `Imagens dos personagens`. Assertion alinhada ao rótulo atual.
- `tests/story-studio.test.mjs`: teste de geração sequencial ainda esperava `Gerar todas as pendentes em sequência`, renomeado na interface para `Gerar cenas restantes`. Assertion alinhada ao rótulo atual; verificações de `generateOneScene`, persistência por `user_id`, pausa de 16 segundos e parada manual mantidas.
- Alterações apenas nos dois arquivos de teste e documentação; não foram alterados frontend, Supabase, chaves, robô Flow nem IMAGEM1/2/3 nesta correção.
- **O job informado continua falho em seu commit original; é necessário verificar uma nova execução na branch main para comprovar testes, typecheck, lint e build aprovados.** Não interpretar atualização das assertions como execução comprovada da suíte.

## 19/11/2026 — Correção de usabilidade móvel e análise real de erro na cena 2

- Usuário mostrou captura real do quadro de produção no celular, história "O Último Graxo da Noite" com **1/12 cenas prontas**, e relatou muitos blocos repetidos, upload aceitando uma única imagem, ausência visual do gerador de imagens e erro ao tentar gerar cena 2. A captura corresponde à interface de quadro com etapas e opções escondidas, não à interface inicial dos 12 formulários.
- Consultados logs Supabase de 19/11/2026 19:30–21:00 UTC: **20:36:17 UTC** `story_studio_gemini_http_error`, `model=gemini-3.5-flash`, `purpose=script`, HTTP **503 UNAVAILABLE** emitido pelo Google em **375 ms**, classificação `provider_temporarily_unavailable`. Não há evidência de erro de autenticação do Meu Vendedor nessa requisição nem prova da causa interna do Google; a cena 1 salva permanece preservada. Registrados também `MAX_TOKENS` de prompt com teto 1200 e ~1150 thinking tokens em 20:26 UTC; são incidentes diferentes.
- Supabase `story-studio` **v24 ACTIVE** publicado com teto de saída por prompt de cena individual elevado de 1200/1750 para **2800/3200** tokens (YouTube Create/demais) para acomodar os thinking tokens; limite de **caracteres** do prompt final permanece inalterado. Não há retentativa automática ou mudança de chave.
- Frontend `StoriesStudio.tsx` na branch `main`: eliminada a **grade duplicada de 12 pendências** e minimizado o cabeçalho do roteiro; navegação geral passa a aparecer fora do quadro de produção; etapas mostram só seu conteúdo relevante (Roteiro, Personagens e Imagens, Prompt e Download).
- Ação **Gerar cenas restantes** trazida para o topo do quadro, com aviso sobre cota, uma cena por chamada, botão Parar após esta cena e ausência de retentativas. Para cena pendente, botões **Gerar Gemini Flash** e **Tentar Flash-Lite** visíveis lado a lado (sem recorrer a menu avançado). Erros/mensagens do fluxo agora aparecem junto ao cabeçalho do quadro, sem duplicá-los no rodapé.
- Novo upload **múltiplo** de até 20 imagens em uma seleção (PNG/JPG/WebP, cada arquivo <=10 MB), com arquivos salvos individualmente na biblioteca privada `mv-story-images` / `mv_story_characters`, preservação das imagens já associadas; as próximas imagens vinculam-se sequencialmente aos personagens ainda sem referência, extras ficam na biblioteca. Em falha parcial informa quantos arquivos foram salvos. Mantido upload individual.
- Controles de Nano Banana reorganizados: o primeiro personagem aparece com ficha expandida na etapa de imagens; caixa de nome, descrição e botão **Gerar imagem com Nano Banana** aparecem antes da biblioteca e de presets; demais campos de ficha, biblioteca e presets ficam recolhidos para reduzir rolagem. Se faltar segredo `HIST_IMAGEM_GEMINI_API_KEY`, botão permanece desativado com explicação e upload manual disponível. Modelo `gemini-3.1-flash-lite-image` foi confrontado com documentação pública oficial, mas a execução autenticada não foi comprovada.
- Testes de contrato da interface e margens de tokens adicionados/atualizados; **não há comprovação de suíte npm/typecheck/build executados nem teste autenticado de geração de imagens** neste contexto. O frontend **ainda precisa de novo deploy** para exibir a simplificação; não afirmar que a captura já reflita as mudanças mais recentes.
- Robô Google Flow, IMAGEM1/IMAGEM2/IMAGEM3, produtos e demais APIs continuam intocados.

## 19/11/2026 — Histórias: editor visual por cena, filtro de pendentes e prompt YouTube limitado

- Feedback com captura real: a aba Histórias exibia demasiadas seções, personagens, editores e pendências ao mesmo tempo, misturando preparação de roteiro com escolha de gerador; após copiar prompt não ficava claro se usar `Próxima etapa` (wizard geral) ou `Gerar próxima cena`. Foi visto um prompt local do YouTube Create com **1366/900 caracteres**, incompatível com o limite editorial configurado.
- Reorganizado `StoriesStudio.tsx` como **quadro de produção focado numa única cena ativa**; mini-linha do tempo mostra as prontas e a selecionada. As demais 12 cenas aparecem só ao expandir **Mostrar todas as 12 cenas e pendências**. Navegação geral de 7 etapas e projetos salvos também ficam recolhidos no estágio de roteiro, para reduzir ruído visual.
- O quadro possui três passos internos: **1 · Revisar roteiro**, **2 · Personagens e imagens** e **3 · Prompt e download**, cada um exibindo somente as ferramentas pertinentes. Fichas individuais de personagens ficam recolhidas em cartões com nome e miniatura. O editor conserva cenário, ação e falas editáveis, biblioteca privada, upload, geração opcional e download de referências.
- Em Prompt e download, escolha da plataforma continua individual por cena; prompts copiados exibem orientação explícita para gerar o vídeo na ferramenta selecionada; importação opcional do MP4 desta cena está no próprio painel. O **único botão principal de avanço** é `Concluir preparação · Ir para cena N`, que persiste roteiro e prompt antes de selecionar/gerar a cena seguinte. O rodapé geral `Próxima etapa` é **ocultado por completo** durante o trabalho do roteiro.
- Corrigida a origem do excesso de caracteres: `makeLocalPromptDrafts` monta variantes progressivamente mais concisas e só devolve uma cuja contagem Unicode respeite `PLATFORM_GUIDES[platform].absoluteChars` (YouTube 900, Flow 1600, Dreamina 1200). **Nenhuma fala, ação ou nome de personagem é cortado em segredo**. Se o material essencial não couber, apresenta erro útil para revisão ou uso do agente Gemini; não declara um prompt acima do teto como válido.
- A tela exibe contagem visível e destaca quando excede limite; bloqueia salvar/copiar/baixar prompt acima do teto, com botão `Corrigir para o limite sem IA`. Mesma proteção de copiar no editor de prompts aprovados. Rascunhos locais já existentes podem ser regenerados sem consumir Gemini.
- Reabrir projeto seleciona a última cena completa para facilitar continuidade, em vez de abrir primeiro os formulários vazios. Projetos e imagens já salvos permanecem privados; nenhuma migração adicional foi necessária.
- Criado teste de **comportamento**, `tests/story-compact-prompts.test.mjs`, exercitando os três tetos reais, preservação integral de ação/falas, ausência de caminhos privados e recusa de conteúdo essencial acima do limite; contratos de interface e rótulos atualizados em `tests/story-editorial.test.mjs` e `tests/story-studio.test.mjs`.
- Alterações somente no frontend, montador local de prompts, testes e documentação, na branch `main`. **A execução integral de testes, typecheck, lint e build no GitHub Actions ainda precisa ser confirmada**, assim como a publicação do frontend Cloudflare. Edge Function `story-studio` e robô Google Flow/IMAGEM1/IMAGEM2/IMAGEM3 intocados.

## 19/11/2026 — Incidente real: primeira cena Gemini 3.5 Flash excede 60 segundos

- Novo relato do usuário após frontend publicado: `O Google Gemini não respondeu em até 60 segundos` ao gerar a cena. Consulta de logs Supabase do período 17:30–20:00 UTC encontrou evento em **2026-11-19 19:19:35 UTC**: `story_studio_gemini_transport_error`, `reason=gemini_timeout`, `purpose=script`, `model=gemini-3.5-flash`, `elapsedMs=60002`, `timeoutMs=60000`, POST /story-studio 503. Evidência: a resposta do serviço Google não foi recebida antes da interrupção; **não há prova da causa interna do Google**.
- No mesmo dia, chamadas de **temas** ao `gemini-3.5-flash-lite` concluíram em 1636–1949 ms com HTTP 200 e `finishReason=STOP`, enquanto a consulta `GetModel` do Flash mostrou `supportsGeneration=true`. Metadados funcionando não garantem inferência rápida.
- Projeto de roteiro fica persistido antes de chamar a API, para que o usuário possa reabrir e retomar a primeira cena sem duplicar projetos nem desperdiçar conteúdo salvo. Não habilitar retentativas automáticas após timeout.
- Implementada alternativa **opt-in** `Gerar próxima cena com Flash-Lite (alternativa)`: o frontend envia `scriptModel=flash-lite` somente na requisição explicitamente acionada pelo usuário; backend seleciona `gemini-3.5-flash-lite` mas usa exclusivamente `HIST_ROTEIRO_GEMINI_API_KEY` para essa finalidade, sem reutilizar o segredo de temas e sem alterar o modelo dos prompts. O caminho padrão `gemini-3.5-flash` permanece disponível. Novo teste de contrato adicionado.
- Supabase `story-studio` **v23 ACTIVE**, JWT obrigatório. Nenhuma chamada de geração real foi executada nesta correção. A alternativa ainda precisa de validação funcional e publicação do frontend, e **não há garantia de que o Flash-Lite responderá** a roteiros usando a chave reservada aos roteiros.
- A investigação e correção não modificaram chaves de API, robô Google Flow, imagens IMAGEM1/2/3, tabelas nem outros módulos.

## 19/11/2026 — Correção dos 3 testes vermelhos da validação Histórias

- Log do usuário do GitHub Actions `Validate Histórias (no deployment)`: **371 testes, 368 aprovados e 3 falhas**, todas no arquivo `tests/story-studio.test.mjs`. A execução parou em `npm test`, antes de TypeScript, lint e build.
- Teste de segredo confundia a **menção textual** ao nome `HIST_IMAGEM_GEMINI_API_KEY` na instrução da interface com leitura de uma credencial privada. A verificação foi substituída por proibições explícitas de `Deno.env.get`, variáveis privadas no frontend e acesso direto ao Google, preservando a exigência do endpoint autenticado Supabase.
- Teste de logs esperava a antiga ordem dos atributos `purpose, model, ...diagnostic`, enquanto a implementação registra `status, reason, purpose, model, elapsedMs, ...diagnostic`. Atualizado o contrato para o formato atual sem liberar registro de mensagens sensíveis.
- Teste de modelo exigia `encodeURIComponent(TOPICS_MODEL)` direto; a implementação seleciona `model` conforme `purpose` e então usa `encodeURIComponent(model)`. Atualizado contrato para validar o roteamento de ambos os modelos.
- Commit corretivo da suíte: `ea4e562bb755da46a1911e764f4bf467c25a4846`. Oito verificações diretas contra os arquivos GitHub passaram após ajuste; **a suíte integral ainda precisa ser novamente executada no workflow**. Nenhum Supabase/Cloudflare deploy novo e nenhuma chamada Gemini ocorreram nessa correção.

## 19/11/2026 — Complemento da produção cena a cena: rascunhos parciais e verificações

- Corrigido `saveScript(false)`: agora permite **salvar projetos com apenas 1 a 11 cenas completas**, respeitando a numeração, personagens e falas das cenas preenchidas. Somente `saveScript(true)` exige as 12 cenas completas para a aprovação final. Antes, a validação de todas as cenas bloqueava a edição incremental.
- Modelos de descrição de personagens originais incluídos na UI como presets textuais iniciais; **não são imagens pré-geradas**. Dados de imagem guardam nome, descrição e prompt; upload manual e seleção de biblioteca não exigem a chave de imagem. Nomes e prompts de nova imagem são independentes por personagem.
- Evitado consumo Gemini quando a busca por prompt previamente salvo falhar; imagens de biblioteca são reutilizadas sem duplicar registros ou alterar os nomes dos personagens no roteiro. Upload atualiza o projeto e a biblioteca imediatamente, sem esperar a aprovação do roteiro.
- Corrigida migração GitHub para a versão realmente aplicada no Supabase: `20261119183537_story_character_library.sql`; arquivo de versão divergente removido. Foram confirmadas as quatro políticas de RLS e a Edge Function `story-studio` v22 ACTIVE (imagem condicionada a `HIST_IMAGEM_GEMINI_API_KEY`).
- Ajustado workflow `Validate Histórias (no deployment)` para validar também alterações na `main` relativas a Histórias. Ele executa testes, typecheck frontend/Edge, lint e build, **sem fazer deploy**. O resultado de execução do workflow e o frontend Cloudflare **ainda não foram confirmados**.
- Passaram 14 verificações estáticas pontuais dos caminhos de UI, chaves, payloads, referências, downloads e RLS. **Nenhuma geração externa, vídeo ou teste autenticado foi executado**, portanto não foi comprovada disponibilidade nem preço do Nano Banana nesta conta.

## 19/11/2026 — Histórias: produção cena a cena, biblioteca privada de personagens e prompts por plataforma

- Fluxo reorganizado para o usuário trabalhar na **cena 1 imediatamente após sua geração**, sem esperar as 12 cenas. Dentro de cada cena preenchida: revisar o roteiro, escolher referências visuais da Biblioteca de Personagens, selecionar YouTube Create, Google Flow ou Dreamina **individualmente para aquela cena**, montar prompt local sem IA ou gerar um prompt com Gemini, editar, salvar, copiar e **baixar prompt .txt e as imagens de referência privadas**. O usuário gera o vídeo manualmente na ferramenta desejada e pode seguir para a cena seguinte.
- Banco: criada tabela isolada `public.mv_story_characters` (nome, descrição, voz, prompt de imagem, caminho privado, usuário, datas; exclusividade por usuário e nome). Migração **`20261119183537_story_character_library.sql`** aplicada no Supabase, com RLS/GRANT e políticas de SELECT/INSERT/UPDATE/DELETE por proprietário. Armazenamento reutiliza o bucket privado já existente `mv-story-images`, sem tocar fotos de Produtos nem o robô Flow.
- Frontend: biblioteca com miniaturas via URLs temporárias assinadas, opção **Usar imagem**, **Renomear**, **Baixar imagem** e **Atualizar imagens**, além do upload manual PNG/JPG/WebP de até 10 MB. Vínculos de imagens e seus prompts são gravados em `mv_story_projects.characters[].referenceImagePath/referenceImagePrompt` e biblioteca; nomes do roteiro não são trocados ao escolher imagem existente. Quatro **presets iniciais de descrições** (limão, maçã, banana, beterraba) ajudam a começar, mas **não há imagens pré-geradas inseridas** no banco.
- Modelo de imagem: backend `story-studio` adiciona `image_config` (verifica apenas presença da configuração) e `image_character`, usando o modelo Nano Banana 2 Lite `gemini-3.1-flash-lite-image` com **segredo exclusivo `HIST_IMAGEM_GEMINI_API_KEY`**; NÃO usa nem faz fallback para `HIST_TEMA_GEMINI_API_KEY`, `HIST_ROTEIRO_GEMINI_API_KEY`, chaves de Produtos ou Google Flow. Uma imagem por clique, sem tentativas automáticas. Resposta Base64 é enviada ao navegador e carregada pelo usuário autenticado no Storage privado. **Ativação depende de configurar essa chave no Supabase; não foi verificada sua presença, elegibilidade gratuita ou capacidade real de gerar imagens**.
- Prompts específicos: os agentes de plataforma agora recebem indicação `referenceImageAttached` e descrição original opcional, mas **não recebem bytes da imagem nem URL privada**; texto instrui anexar manualmente a referência em cada plataforma. Os prompts continuam preservando personagem, cenário, ação e fala. O banco é consultado antes de gerar, para não consumir Gemini se a cena/plataforma já possui prompt salvo; erros de consulta abortam antes da chamada paga.
- Supabase: `story-studio` **v22 ACTIVE, JWT obrigatório**. Testes de contrato adicionados em `tests/story-editorial.test.mjs` e `tests/story-studio.test.mjs`. Verificações estáticas de componentes, rotas e RLS realizadas; **não foram executados teste de integração autenticado, `npm test`, lint, typecheck nem build integral**, e **nenhuma inferência paga** foi iniciada nesta mudança.
- **Publicação frontend Cloudflare ainda pendente**: é necessário executar o fluxo de publicação do frontend somente após validar CI. Sem essa publicação a nova biblioteca e os botões por cena não aparecem no site.
- Nenhuma modificação em arquivos IMAGEM1/IMAGEM2/IMAGEM3, executores Google Flow, Modal, Produtos, Campanhas ou seus segredos.
- Pendências declaradas: imagens iniciais prontas não foram pré-carregadas; segredo Nano Banana ainda precisa de configuração externa; possíveis diferenças de duração 10s vs modelo de vídeo requerem ajuste manual e testes reais.

## 19/11/2026 — Histórias: temas aprovados, início automático de roteiro e editor compacto

- Confirmado pelo teste do usuário que a geração e revisão de **temas no Histórias avançou e já funciona em ao menos parte das tentativas**; a disponibilidade do Google permanece intermitente, sem afirmar correção definitiva do HTTP 503.
- Identificado na captura da aba Histórias que, depois de escolher **Gerar roteiro**, a interface abria doze formulários grandes com campos vazios. A causa no fluxo do frontend: `generateScript(topic)` **apenas criava o projeto com `makeEmptyStoryScenes()` e abria o editor**, exigindo um segundo clique não evidente para chamar `script_scene`.
- Corrigido em `src/components/stories/StoriesStudio.tsx`: após criar e persistir o projeto, a ação **Criar roteiro e gerar cena 1** chama imediatamente `generateOneScene(data, topic.synopsis)`; quando a API responder com sucesso, salva personagens e conteúdo da cena 1 no Supabase e abre essa cena preenchida para revisão. Se o Gemini retornar 503 ou timeout, o projeto permanece salvo e a cena pendente pode ser retomada, sem inventar roteiro e sem tentativa automática repetida.
- Reduzido o volume visual: as 12 cenas agora são exibidas como linhas compactas **Abrir/Recolher**, com título, status e prévia da ação. Somente a cena selecionada expande os campos editáveis; cenário/ação/falas usam altura inicial reduzida e redimensionamento manual. Conteúdo existente é lido dos campos `setting`, `action`, `dialogue`, `characters`, `transition` sem apagá-lo. Ao voltar a um projeto, abre a primeira cena pendente. O resumo permanece visível para cenas já preenchidas.
- Adicionados testes de contrato em `tests/story-editorial.test.mjs` para geração automática da primeira cena, persistência visual e layout compacto. **Execução real de suíte, lint, typecheck e build ainda não confirmada**; nenhuma chamada Gemini paga foi executada nesta correção.
- Alterações da interface commitadas na branch `main`. **A publicação do frontend Cloudflare precisa ser disparada/verificada separadamente**; Supabase continua na v21 e não houve modificação de Edge Functions, chaves, tabelas, robô Flow ou arquivos IMAGEM1/IMAGEM2/IMAGEM3.

## 19/11/2026 — Geração incremental de cenas e prompts do Histórias

- A pedido do responsável, alterado o fluxo de inferência do Histórias para enviar **uma cena de 10 segundos por chamada Gemini**, até completar 12 cenas. Preservada a Bíblia de Personagens: a primeira resposta cria o elenco (quando ainda vazio); cenas seguintes recebem o mesmo elenco e as cenas previamente aprovadas no rascunho, com instrução de continuidade e progressão narrativa.
- Novo endpoint de ação `script_scene` em `supabase/functions/story-studio/index.ts`: valida título, número de cena 1–12, quantidade e integridade das cenas anteriores, elenco, falas até 26 palavras, personagens reconhecidos e resultado JSON de uma cena. Tetos de saída por requisição: **2600 tokens** para a cena inicial com personagens; **1800** para cada cena subsequente. O fluxo legado `script` permanece apenas por compatibilidade retroativa e não é chamado pelo frontend novo.
- Novo endpoint `prompt_scene`: produz apenas o prompt de **uma** cena para YouTube Create, Flow ou Dreamina, com limites **1200 tokens** (YouTube) ou **1750** (outros) por chamada, além dos tetos editoriais de caracteres. O fluxo legado `prompts` permanece no backend para compatibilidade, mas não é acionado pela nova interface.
- Frontend: iniciar roteiro cria e persiste projeto com 12 espaços vazios **antes de qualquer chamada paga**. Botões `Gerar próxima cena com Gemini` (uma chamada) e `Gerar cenas restantes em sequência` (até a cena 12, uma chamada por vez, espera de 16 segundos entre chamadas e botão para parar). Após **cada sucesso**, salva imediatamente em `mv_story_projects`, podendo retomar quando o navegador for fechado. Interrompe a sequência após qualquer erro sem retentativa automática; mantém 90/120 segundos de cooldown existente para 503/timeout.
- O botão de prompts agora gera e salva **um prompt por clique** e consulta previamente `mv_story_prompts` para evitar sobrescrever um prompt já persistido ou confundir rascunhos locais com prompts salvos. Retomada de projetos busca também gênero, `topic_id` e sinopse do tema quando disponível.
- A tela avisa que sequência pode usar até 12 chamadas da cota gratuita, e que parar/reabrir preserva cenas já salvas. Não há job em background: sequência roda com aba aberta. Não houve inferência real nem consumo deliberado da API neste trabalho.
- Supabase `story-studio` publicado **ACTIVE v21**, JWT obrigatório. Foram feitas 16 verificações estáticas de integração/caminhos de chamada e adicionados testes de contrato; execução de `npm test`, TypeScript, lint e build ainda **não confirmada**. Frontend **ainda depende de Run Work do Cloudflare** após essas edições.
- Intocados robô Google Flow, arquivos IMAGEM1/2/3 e módulos de Produtos/Campanhas.

## 19/11/2026 — Proteções contra instabilidade Gemini e diagnóstico de roteiros

- Análise combinada do log Supabase e documentação oficial: HTTP 503 `UNAVAILABLE` em temas é emitido pelo próprio Google e corresponde a indisponibilidade ou sobrecarga temporária do provedor; não há evidência de que a palavra `mecânico`, seleção de gênero ou a validação local JSON provoquem esse HTTP 503. Timeout de 60s da ação `script` no modelo `gemini-3.5-flash` foi registrado, sem prova definitiva de sua causa interna.
- A Edge Function `story-studio` foi atualizada para incluir `diagnose_script`, usando apenas GET de metadados, chave `HIST_ROTEIRO_GEMINI_API_KEY` e modelo Flash, sem consumo de inferência; `diagnose_topics` permanece isolada no Flash-Lite.
- `MAX_TOKENS` agora recebe classificação dedicada `gemini_output_truncated` antes do parser JSON. Falhas `gemini_service_unavailable` e `gemini_timeout` retornam HTTP 503 ao frontend (sem adicionar chamadas automáticas); `gemini_invalid_json` permanece separado.
- Frontend atualizado na `main`: botão de verificação sem gerar para a chave de roteiros; após 503, resguarda 90 segundos antes de nova requisição à mesma finalidade; após timeout, 120 segundos. O bloqueio é apenas no contexto do navegador atual e não garante limite distribuído entre sessões/dispositivos. Diagnósticos metadata-only seguem permitidos durante a pausa.
- Testes de contrato atualizados e dez verificações estáticas pontuais aprovadas. Publicado Supabase `story-studio` **ACTIVE v20**, `verify_jwt: true`; não houve inferência real nos testes. A implantação do frontend Cloudflare e validação da suíte completa/CI ainda exigem confirmação independente.
- Mantidos modelos Gemini 3.5, limites editoriais, chaves, os executores Flow, IMAGEM1/2/3, Produtos e Campanhas. O problema de capacidade HTTP 503 do Google não pode ser corrigido por alterações apenas no Meu Vendedor; as proteções limitam efeitos e aumentam precisão do diagnóstico.

## 19/11/2026 — Auditoria de compatibilidade e economia de prompts do Histórias

- Lidos `story-studio`, agentes YouTube Create/Flow/Dreamina, wizard `StoriesStudio`, guias `workflow.ts`, testes e configuração de API. Confrontadas instruções com a documentação oficial de YouTube Create, Google Flow e Dreamina.
- Confirmações externas: YouTube Create admite prompt de até 900 caracteres; Flow Omni Flash 1.2 tem modos até 10s e Veo 3.1 Lite de 4/6/8s, variando plano/modo; Dreamina Seedance 2.0 recomenda prompts claros de 30–100 palavras, não impondo teto universal de 1200 caracteres.
- Revisados agentes da geração de prompts, ainda sem requisições de vídeo: YouTube alvo 780/teto 900; Flow alvo 900/teto editorial 1600; Dreamina alvo 650/teto editorial 1200. Instruções agora priorizam ação única, movimento, câmera, fala, imagens de referência quando efetivamente anexadas e duração compatível com o modelo escolhido.
- Corrigidas divergências no editor: Flow e Dreamina agora validam seus tetos também na edição/salvamento; botão de copiar prompt deixa de depender de título/descrição de publicação. Guias frontend alinhados; comentários e mensagem desatualizados de 4000 caracteres corrigidos.
- `story-studio` publicado ACTIVE v19 JWT obrigatório, confirmado por releitura; os modelos Gemini 3.5, chaves exclusivas e tetos de tokens 2300–3800 (temas), 7200 (roteiro) e 8500 (prompts) permanecem. Nenhum teste de inferência, Flow, Dreamina, YouTube Create, renderização ou publicação foi executado; custo de tokens efetivo depende de `usageMetadata` e `finishReason` em teste autenticado posterior.
- Auditoria pendente: roteiro ainda é editorialmente fixo em 12x10s mesmo quando ferramenta só gera 8s; o app não solicita o modelo específico da plataforma nem resolve automaticamente a diferença de duração. A função aceita roteiro aprovado no cliente para gerar prompts, mas a análise sobre consistência final e fontes visuais exige teste real. Rascunhos locais podem ultrapassar o limite e requerem edição antes de salvar.
- Testes de contrato estáticos verificados (10 afirmações), mas `npm test`, lint, build e deploy do frontend Cloudflare **não** executados/confirmados neste ambiente. Worker Cloudflare permanece em versão anterior às edições frontend.
- Preservados robô Google Flow, arquivos IMAGEM1/2/3, OAuth, Modal, Produtos e Campanhas.

## 19/11/2026 — Redução de custos e diagnóstico de timeout no Histórias

- Logs Supabase às 16:30 UTC confirmaram `story_studio_gemini_transport_error`, `purpose: script`, modelo `gemini-3.5-flash`, timeout de 60.000 ms e retorno HTTP 502. As tentativas de temas no `gemini-3.5-flash-lite` também registraram HTTP 503 do Google. Não há demonstração de falha do parser JSON nas tentativas com erro.
- O módulo Histórias agora solicita texto mais conciso: temas com título até 65 caracteres e sinopse até 40 palavras/240 caracteres; roteiro com exatamente 12 cenas de 10 segundos, 1–4 personagens, ambiente até 180 caracteres, ação até 320, transição até 75 e até 22 palavras de diálogo por cena. As restrições editoriais são instruções ao modelo, não cortes automáticos de conteúdo aprovado.
- Tetos de saída do Google: temas `min(3800, 1800 + count*100)` (5 temas = 2300; 20 = 3800), roteiro `7200` tokens, prompts `8500` tokens. Não representam consumo fixo ou garantia de saída completa; limites efetivos devem ser validados por retorno de inferência e `finishReason`.
- Prompts do YouTube Create permanecem alvo 850/máximo 900 caracteres; Flow e Dreamina passam a alvo 1100/máximo 1600 caracteres internos. O arquivo de guias do frontend foi alinhado ao backend.
- `story-studio` registra latência dos erros e, em respostas válidas do provedor, contagens de tokens de entrada, saída, pensamento e total e motivo de finalização, sem log de prompt, assunto, roteiro ou segredo. A chamada `generateContent` agora passa a chave via header `x-goog-api-key`, não na URL.
- Backend Supabase `story-studio` publicado **ACTIVE v18**, `verify_jwt: true`; leitura pós-deploy confirmou constantes e telemetria. Nenhuma inferência Gemini real foi executada nesta intervenção.
- Frontend em `main`: removido loop de geração adicional automático; uma ação do usuário faz no máximo uma chamada ao Gemini para temas. Resposta parcial é preservada. Removido controle de cancelamento anterior, que não tinha efeito em requisição única. Erro HTTP 503 agora recebe mensagem específica. **Publicação desse frontend no Cloudflare ainda não confirmada**; o Worker observado não foi redeployado por esta alteração.
- Testes de contrato atualizados no GitHub; execução da suíte local/CI não confirmada neste ambiente. Nenhuma modificação em Flow, arquivos IMAGEM1/2/3, chaves ou configuração de Produto/Campanhas.

## 19/11/2026 — Histórias passa a usar exclusivamente Gemini 3.5

- Solicitação: remover Gemini 3.8 do módulo independente Histórias. Temas, títulos, ideias e sinopses passam a `gemini-3.5-flash-lite`; roteiro de 12 cenas e prompts passam a `gemini-3.5-flash`.
- A função `supabase/functions/story-studio/index.ts` agora usa seleção por finalidade (`topics` versus `script/prompts`), e `diagnose_topics` consulta metadados do modelo Flash-Lite. Foi removido o fallback/configuração `MV_STORIES_GEMINI_MODEL` nesse módulo para impedir seleção acidental do 3.8.
- Código enviado à `main` e teste de contrato ajustado para as duas variantes. Publicada função `story-studio` **ACTIVE v17**, com `verify_jwt: true`. Leitura posterior do código implantado confirmou ambos os modelos e ausência de `gemini-3.8-flash` no módulo.
- Nenhuma inferência Gemini foi executada nesta etapa; as cotas, a permissão e a resposta real de geração para os modelos 3.5 ainda precisam de validação autenticada. Nenhuma publicação Cloudflare necessária porque a troca ocorre apenas no backend Supabase.
- Não alterados Produtos, Campanhas, robô Flow, OAuth, Modal, IMAGEM1, IMAGEM2 ou IMAGEM3.

## 19/11/2026 — Sincronização de diagnose_topics em produção (Supabase v16)

- Confirmada divergência: `main` continha a ação autenticada `diagnose_topics` e o botão `Verificar Gemini sem gerar temas`, mas a Edge Function `story-studio` publicada na versão 15 não continha essa ação.
- Publicados em produção `index.ts` e quatro arquivos dos agentes de prompts, exatamente a partir da `main`, como Edge Function `story-studio` **ACTIVE v16**, com `verify_jwt: true` preservado.
- Leitura posterior da função implantada confirmou a presença de `body.action === "diagnose_topics"` e resposta `model_metadata_only`. Nenhuma chamada `generateContent`, geração de conteúdo ou alteração de segredos foi realizada nesta intervenção.
- Worker Cloudflare `meu-vendedor` teve implantação v176 às 16:00 UTC, porém não foi possível confirmar por leitura dos assets estáticos a presença do botão na versão servida; não declarar validação do frontend em produção.
- Logs anteriores à correção apontam HTTP Google 503 `UNAVAILABLE` e timeout de 60s na operação de temas. Ainda falta acionar uma vez o diagnóstico autenticado, somente de metadados, no site para verificar a chave e o modelo sem inferência.
- Nenhuma alteração em Flow, IMAGEM1, IMAGEM2, IMAGEM3, chaves, OAuth ou provedores de vídeo.

## 19/11/2026 — Verificação Gemini de Histórias sem geração

- O AI Studio mostrou uma resposta rápida para "OK", mas a captura exibiu no seletor `Gemini 4 Hydrogen` mesmo com `model=gemini-3.8-flash` no endereço. Portanto o teste isolado não prova que o modelo configurado no Meu Vendedor respondeu.
- Acrescentada ação autenticada `diagnose_topics` em `story-studio` que faz apenas GET de metadados do modelo usando a chave `HIST_TEMA_GEMINI_API_KEY` em header `x-goog-api-key`, com timeout de 8 segundos, sem `generateContent` nem consumo de tokens de inferência. Exibe sucesso, latência e suporte declarado ao método; erros HTTP e transporte mantêm categorias seguras sem chaves ou mensagens brutas.
- Adicionado botão `Verificar Gemini sem gerar temas` ao formulário, sem alterar quotas, OAuth, Modal, Google Flow, IMAGEM1/2/3 ou demais APIs. Os limites 5/10/15/20 temas permanecem intactos.
- A verificação metadata-only não prova que a geração funcionará; continuar investigação só após observar resposta, sem novas chamadas de geração automáticas.

## 19/11/2026 — Histórias: diferenciar timeout da Gemini de falhas de autenticação

- Usuário informou `generation_failed` após espera longa ao gerar 5 temas. Logs mostram POST da função `story-studio` concluído como HTTP 502 aproximadamente 60 segundos após o preflight, sem erro HTTP do Google registrado na tentativa. Isso é compatível com o abort de 60 segundos, mas não prova timeout sem o novo diagnóstico.
- Em `story-studio`, o abort explícito agora resulta em `gemini_timeout`; falha de transporte `TypeError` vira `gemini_network_error`. Os logs registram apenas motivo permitido, finalidade e modelo, sem chaves, payload, mensagem original nem prompts. Nenhum retry automático.
- Frontend apresenta texto específico orientando não repetir geração ao receber essas categorias. A autenticação de usuário ocorre antes da chamada Gemini e recusas retornam `unauthorized` HTTP 401, não `generation_failed`.
- Não alterados OAuth, segredos, Cloudflare, Modal, robô Flow nem arquivos IMAGEM1/IMAGEM2/IMAGEM3. Nenhuma chamada Gemini de geração executada por esta correção.

## 19/11/2026 — Gerador de temas limitado a 5–20 e reparo de publicação

- Formulário Histórias agora oferece exclusivamente 5, 10, 15 ou 20 temas; padrão 5. O lote de geração foi limitado a 20 no frontend e o backend rejeita contagens acima de 20.
- Corrigida a falta de uma chave `}` na mensagem de status do JSX (linha ~431), causa do erro de lint que impediu a publicação anterior do frontend no Cloudflare; a alteração no GitHub anterior não chegou ao site.
- Testes estáticos de contagem e validação de erros atualizados, sem chamadas de geração Gemini. Histórias usa suas chaves dedicadas, e Flow, IMAGEM1/IMAGEM2/IMAGEM3, Modal e OAuth permanecem intocados.

## 19/11/2026 — Geração de temas: erro visível e testes com baixo consumo

- Logs Supabase confirmaram respostas Google HTTP 503 `UNAVAILABLE` para `gemini-3.8-flash` na operação `topics`; nenhum tema foi entregue nessas tentativas. Não há evidência nesses registros de 429/cota esgotada.
- O componente `StoriesStudio` exibia erros apenas no final da página longa, longe do botão. Agora mostra mensagem de erro/sucesso junto ao gerador de temas.
- Quantidade padrão reduzida de 50 para 1 tema, com opção explícita de 5 temas; opções maiores permanecem disponíveis para uso deliberado. Testes não devem exceder 5 roteiros; nenhuma geração via Gemini foi executada por este ajuste.
- Google Flow, Modal, OAuth, arquivo IMAGEM1/2/3 e chaves permanecem intocados.

## 19/11/2026 — Diagnóstico restrito dos erros Gemini em Histórias

- `story-studio`: o erro HTTP Gemini agora registra status HTTP, finalidade (tema ou roteiro), modelo, status e código numérico do provedor, além de categoria técnica inferida por palavras-chave permitidas.
- As mensagens brutas do Google e os dados da requisição não vão para logs; nunca registrar chave, prompt, resposta bruta nem dados do usuário.
- Nenhuma chamada de geração Gemini foi usada para o diagnóstico, para preservar o limite combinado de até cinco roteiros (preferência por uma solicitação apenas).
- Não alterar OAuth, Cloudflare, Modal, Google Flow ou arquivos IMAGEM1/IMAGEM2/IMAGEM3. Permanecem as chaves `HIST_TEMA_GEMINI_API_KEY` e `HIST_ROTEIRO_GEMINI_API_KEY`.

## 19/11/2026 — API Gemini exclusiva de Campanhas de Produtos

- Credencial `PROD_CAMPANHA_GEMINI_API_KEY` destinada exclusivamente à análise visual e preparação de conteúdo promocional em `campaign-content`; leitura de `GEMINI_API_KEY`/`GOOGLE_API_KEY` removida somente dessa função.
- `GEMINI_API_KEY` permanece cadastrada para outros serviços legados que eventualmente dependam dela; não excluir nem redefinir até auditoria completa das funções, incluindo utilitários e implantações antigas.
- Separação vigente: `HIST_TEMA_GEMINI_API_KEY` (temas), `HIST_ROTEIRO_GEMINI_API_KEY` (roteiros/prompts Histórias), `PROD_ROTEIRO_GEMINI_API_KEY` (roteiros de produtos), `PROD_CAMPANHA_GEMINI_API_KEY` (campanhas). OAuth/login/YouTube/Flow são configurações independentes.
- O responsável declarou que cadastrou o Secret de Campanhas no Supabase; ferramenta integrada não permite enumerar os nomes/valores dos Secrets, portanto presença e validade da chave não foram verificados diretamente.
- Mudança restrita ao módulo Campanhas, teste e documentação; Google Flow, IMAGEM1/2/3, Produtos e Histórias preservados. Validação em ambiente real deve ser distinguida de configuração de código.

## 19/11/2026 — Isolamento da chave Gemini de roteiros de produtos

- A função `video-generation` usa exclusivamente `PROD_ROTEIRO_GEMINI_API_KEY` para geração direta de roteiros com Gemini e na rota de roteiros com alternativas Groq/OpenRouter. Não há uso de `GEMINI_API_KEY` nem `GOOGLE_API_KEY` neste módulo para roteiros.
- Os prompts automáticos locais para produtos permanecem calculados no aplicativo; não foi criado novo consumo da API Gemini para prompts locais. A geração de vídeo, o executor Flow, IMAGEM1/2/3, Histórias e Campanhas não foram alterados.
- Secret `PROD_ROTEIRO_GEMINI_API_KEY` deverá ser criado pelo responsável no Supabase. O código é versionado sem qualquer valor de chave. Sem Secret, a rota preserva alternativas previamente existentes; isso não comprova sucesso Gemini.
- Criado teste de contrato em `tests/video-script-router.test.mjs` para garantir a leitura do novo Secret nas duas vias. Publicação e teste autenticado devem ser confirmados separadamente.

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

## 2026-11-19 — Gemini Text: classificar falha de provedor no Histórias

- Usuário relatou `Serviço de Histórias: gemini_unavailable` ao gerar temas. Logs Supabase confirmaram `OPTIONS | 204` (preflight CORS corrigido) e `POST | 502` para `story-studio`; a função mascarava qualquer HTTP não-2xx do Google como `gemini_unavailable`.
- Documentação oficial do Google confirmou que `gemini-3.8-flash` existe; **não alterar modelo nem credenciais por suposição**. Status upstream exato da tentativa anterior não foi registrado, então causa específica (cota, permissão, modelo, pedido ou indisponibilidade) permanece desconhecida.
- Alterado exclusivamente `supabase/functions/story-studio/index.ts` para distinguir, sem vazar conteúdo: 429=`gemini_quota_exceeded`, 401=`gemini_invalid_key`, 403=`gemini_permission_denied`, 404=`gemini_model_unavailable`, 400=`gemini_request_rejected`, 5xx=`gemini_service_unavailable`. Log registra apenas HTTP status e categoria, sem prompt, chave ou resposta do provedor.
- Commit `63297337` enviado à `main`; função Supabase `story-studio` **ACTIVE v3** publicada com JWT obrigatório. Teste de regressão inserido em `tests/story-studio.test.mjs` no commit `845fac14`. GitHub CI da versão mais recente ainda não confirmado no instante desta nota.
- **Pendente:** um novo teste autenticado no navegador para obter código real devolvido pelo Google e determinar remediação específica. Não iniciar chamadas de geração automáticas para consumir cotas sem necessidade. Nenhum arquivo do robô Flow, IMAGEM1/2/3, Modal ou geradores de vídeo foi modificado.

## 2026-11-19 — Correção de “Failed to fetch” ao gerar temas

- Consulta aos logs do projeto Supabase `jzchlrvxdaffnrgbvabv` confirmou `OPTIONS | 500` para `/functions/v1/story-studio` após implantação da v1; pedidos anteriores à implantação retornavam 404. A mensagem vista no navegador era compatível com preflight CORS rejeitado.
- Causa no código: `json({}, 204, origin)` criava uma resposta 204 com corpo JSON, proibida pelo runtime Web Response.
- Corrigido somente `supabase/functions/story-studio/index.ts` para responder `OPTIONS` com `new Response(null, { status: 204, headers: ... })` e cabeçalhos CORS, sem alterar Flow, Modal ou os arquivos IMAGEM1/2/3. Commit `d3e3e116` enviado à `main`.
- Edge Function `story-studio` **ACTIVE v2**, JWT obrigatório, publicada e confirmada por leitura do próprio código implantado. Teste estático de regressão incluído em `tests/story-studio.test.mjs` no commit `9ddbadcf`.
- Teste real de preflight via HTTP externo não foi executado neste ambiente (sem resolução DNS); a existência da versão ativa não comprova que a geração com Gemini já funcionou. Solicitar repetição do teste pelo navegador; se aparecer novo erro legível, verificar modelo/chave/cota Gemini em logs, sem expor credenciais.

## 2026-11-19 — Histórias editorial ampliado e Supabase ativado

- PR #12 mesclada à main em `7acd730234dcd478be13ade1cb63bbf320fec8fd`: caixa de revisão dos temas, filtros, editor de personagens/cenas, linha do tempo de 12 cenas, prompts editáveis, revisão/aprovação de clipes e preparação de publicações YouTube/TikTok/Kwai. CI isolado `44470454563` aprovado (testes, tipos, lint e build). Fluxos de postagem são apenas assistidos; geradores Flow, YouTube Create e Dreamina não foram automatizados.
- Migrado o módulo independente no Supabase projeto `jzchlrvxdaffnrgbvabv` com versão real `20261119061633_stories_studio` e nome do arquivo versionado no Git alinhado no commit `e238f760`.
- Edge Function `story-studio` ACTIVE v1, `verify_jwt=true`, serviço Gemini Text do novo módulo; não altera o robô Google Flow. Não houve teste real autenticado de geração Gemini. Existe dependência de chave/modelo e cotas disponíveis no backend.
- SQL de verificação confirmou `mv_story_topics`, `mv_story_projects`, `mv_story_prompts`, `mv_story_clips` com RLS habilitado e políticas por conta. Buckets `mv-story-clips` (100 MB) e `mv-story-images` (10 MB) privados.
- **Não concluído:** montagem real de um único MP4 de 120s, postagem direta às redes, integração de robôs geradores e teste autenticado de uso do Gemini. Não acionar inferência de vídeo/GPU nem redes automaticamente.

## 2026-11-19 — Complemento editorial do Histórias (em validação, sem publicação)

- Implementado na branch `feat/historias-editorial-completo`: revisão separada dos temas antes de salvar, salvar individual/em lote, descarte e filtros por assunto/gênero/texto/favorito; o backend anterior já limitava cada lote Gemini a 25.
- Editor ampliado com Bíblia de Personagens editável (nome, função, aparência e voz), propagação de renomeações para cenas, edição de títulos/personagens/transições/falas e linha do tempo com 12 cenas. Aprovação verifica referências aos personagens e limite aproximado de 26 palavras por cena.
- Prompts por plataforma podem ser recuperados, editados, salvos individualmente e copiados; limite de 900 caracteres informado para YouTube Create permanece validado no frontend e no backend.
- Biblioteca de clipes agora mostra estados, visualização por URL temporária e aprovação/revogação. Painel de preparação permite selecionar YouTube/TikTok/Kwai, título e descrição, sem postar.
- Criados testes de regressão e atualizado workflow isolado de CI. Nenhum arquivo do executor Modal/Flow, IMAGEM1, IMAGEM2, IMAGEM3, Produto ou outro projeto foi alterado.
- **Estado real:** frontend Histórias básico já publicado em Cloudflare na main do commit 5ee21836, após restauração da versão do Worker; esta ampliação está SOMENTE na branch até passar CI e ser publicada. Migração e função `story-studio` **ainda não estão implantadas no Supabase**, por isso a geração Gemini não está operacional na página de produção. Montagem final de 2 minutos e publicação automática continuam pendentes de implementação/autorização.

## 2026-11-19 — Histórias: CI completo aprovado na branch isolada

- Código da nova rota e dos serviços de Histórias validado no GitHub Actions run [44465702220](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/44465702220), commit `732806ab39fae61962b3a19303163ed4d814baa1`.
- O workflow executou `npm test`, `npm run typecheck`, `npm run typecheck:edge`, `npm run lint` e `npm run build:pages` com conclusão **success**.
- A PR #11 continua como rascunho; **sem deploy**, sem migração remota, sem execução real Gemini e sem geração ou postagem de vídeos.
- As últimas alterações abaixo são somente documentais, não alteram os arquivos de código aprovados pelo CI.

### Complemento da implementação Histórias — limpeza e validação ainda pendente

- O componente exclusivo `src/components/videos/VideoWorkspace.tsx` foi removido da branch após busca de referências; os componentes de produto usados em outras partes permanecem intactos.
- A documentação `VIDEOS_IA.md` foi reduzida de aproximadamente 31,6 KB para um aviso com link a `HISTORIAS.md`, preservando links históricos e reduzindo conteúdo obsoleto.
- Workflow de validação isolada `.github/workflows/stories-validation.yml` criado na branch, mas **nenhum resultado de execução de CI foi confirmado** nesta atualização. A PR #11 segue em modo rascunho, sem merge nem deploy.

## 2026-11-19 — Início do novo Histórias (branch de desenvolvimento, não publicado)

- Responsável autorizou substituir a interface antiga Vídeos IA por Histórias, com **arquivos novos e independentes**, preservando integralmente o robô Google Flow e arquivos IMAGEM1/2/3. Documentação antiga de Vídeos IA pode ser limpa após auditoria de dependências.
- Criada branch `feat/historias-gemini-studio`; a rota `/videos` utiliza agora novo componente `StoriesStudio`, sem importar `VideoWorkspace`.
- Criados serviço Supabase `story-studio` para Gemini Text (temas em lotes de 25, roteiros de 12 cenas de 10s e prompts) e agentes independentes YouTube Create/Flow/Dreamina. Teto de 900 caracteres do YouTube Create é validado no backend, conforme limite informado pelo responsável; demais tetos são internos.
- Criada migração para quatro tabelas com RLS de usuário e buckets privados de imagens/clipes; interface oferece temas, favoritos, roteiros editáveis, retomada, aprovação, prompts e upload de MP4.
- **Não concluído:** montagem FFmpeg de 120s, publicação em redes, testes reais Gemini, testes de build, migração remota, deploy Supabase e Cloudflare, limpeza de arquivos históricos comprovadamente sem dependentes. Nenhuma geração ou publicação real realizada.
- A branch ainda precisa de validação de CI e revisão das pendências de banco anteriores. Não modificar o executor Flow nem inferir que commit = deploy.



## 17/11/2026 — Marco: o robô aprendeu a enviar imagens e ajustar configurações

- **Marco registrado por solicitação do responsável:** “momento que o robô aprendeu a enviar imagens e ajustar configuração”.
- **Validação informada pelo responsável:** duas execuções com duas imagens aprovadas e duas execuções com uma imagem aprovadas (4/4). Esses resultados são relatos de testes supervisionados, não uma nova execução automatizada nesta atualização.
- **Regra operacional aprovada:** usar a quantidade efetivamente enviada (1, 2 ou 3) para delimitar seleção, inclusão e conferência das referências; não percorrer posições de imagens inexistentes. Cada quantidade deve ser tratada de forma independente e verificada antes de gerar.
- **Autorização expressa em 17/11/2026:** o responsável liberou o robô para clicar na seta **Gerar** do Google Flow após preparar imagens, prompt e configurações. O clique pode consumir créditos da conta Google; não equivale a autorização para publicações em redes sociais.
- **Implementação já presente na branch main, verificada nesta sessão:** a ação `click-flow-generate` está conectada à Edge Function, ao frontend e ao executor; o botão `Preparar e gerar vídeo` aciona o preparo e a geração condicionada à confirmação de referências/configurações. A rotina de diagnóstico já contém estados `flow_generate_clicked`, `flow_generation_click_uncertain` e `flow_generate_button_unavailable`. Não afirmar que houve geração real nesta atualização documental.
- **Segurança de execução:** exigir confirmação das referências, formato vertical 9:16, saída x1 e identificação inequívoca de um único controle habilitado; na dúvida, interromper e reportar, sem cliques repetidos. Não enviar credenciais, cookies ou tokens aos logs.
- **Publicação:** esta entrada registra a autorização no repositório. A versão efetivamente implantada em Modal/Supabase/Cloudflare ainda precisa ser verificada antes de afirmar que o clique está disponível em produção.

## 2026-11-16 — Telemetria passiva do navegador Hyperbrowser via CDP

Adicionados listeners passivos do Playwright no executor Modal após a conexão CDP com o Hyperbrowser: `browser_disconnected`, `browser_page_closed`, `browser_page_crashed`, `browser_page_error`, `browser_request_failed`, `browser_http_error` e `browser_monitor_ready`. Eventos são encaminhados à mesma telemetria Supabase com fonte `playwright` ou `hyperbrowser`; a Edge Function `flow-telemetry` foi atualizada para **v8** e aceita métricas `httpStatus` e `isFlowRequest`. Limite de 12 eventos por tipo/tentativa, sem registrar URLs completas, cookies, tokens, textos da página ou respostas. Os listeners não interagem com a interface e preservam upload, seleção, prompt e configurações. Commit: `f891538`. **Necessário publicar o Modal e testar uma execução para confirmar recebimento de eventos**. São sinais observados via CDP, não logs internos administrativos do provedor Hyperbrowser.

## 2026-11-16 — Causa identificada da ausência de logs Modal → Supabase

Consulta aos **logs de plataforma** do Supabase revelou diversas requisições `POST /functions/v1/flow-telemetry` retornando **HTTP 403**, incluindo 15h46 UTC. Isso comprova que o Modal alcançava a Edge Function, mas a autorização do coletor recusava os eventos, deixando as tabelas vazias. O código comparava literalmente o Bearer JWT legado `service_role` enviado pelo Modal com `SUPABASE_SERVICE_ROLE_KEY` do ambiente da função, que pode ser diferente. A Edge Function `flow-telemetry` foi atualizada para a **versão 7**: mantém `verify_jwt=true` no gateway e exige a claim `role=service_role` no JWT validado, sem comparação textual entre chaves distintas. **Ainda falta um novo teste para comprovar inserções e status HTTP 200.** Nenhuma chave do Modal deve ser enviada ao chat ou ao frontend; não é necessária API adicional do Modal para a telemetria.

## 2026-11-16 — Correção de requisito: aprovação é necessária para gerar vídeo

**Correção solicitada pelo usuário:** o fluxo pretendido do Meu Vendedor deve clicar em **Aprovar** quando o Google Flow apresentar o cartão de confirmação de créditos, pois sem essa aprovação o vídeo não começa a gerar. A documentação anterior que descrevia aprovação exclusivamente manual como comportamento definitivo estava **incorreta para o requisito do projeto**. Não confundir **Aprovar** (uma geração) com **Sempre aprovar no projeto** (preferência persistente). O usuário relatou três falhas anteriores à chegada a essa etapa. A implementação atual somente observa o cartão; **o clique automático em Aprovar ainda não foi implementado/validado**. Evitar afirmar que a geração foi concluída.

**Telemetria:** consulta direta ao Supabase nesta atualização retornou **0 execuções** em `public.flow_execution_logs` e **0 eventos** em `public.flow_execution_events`. O acesso de leitura ao Supabase funciona, mas a persistência de logs do Modal ainda não foi comprovada.

## 2026-11-16 — Capturas reais: aprovação do Flow e erro após Gerar

Capturas enviadas pelo usuário identificam o cartão de aprovação **dentro da conversa do agente**, com a mensagem de custo de **10 créditos** e botões **Aprovar**, **Sempre aprovar no projeto** e **Rejeitar**. Não se trata necessariamente de um modal DOM `role=dialog`. Outra captura mostra o erro **“Algo deu errado. Tente de novo.”** após o envio. A captura de configurações mostra **Confirmar antes de gerar: Sempre**, vídeo **9:16** e botão **Salvar**. A aprovação deve continuar **manual**, sem clicar automaticamente nem selecionar “Sempre aprovar”.

Tentativa `a319c65c-636c-4d4a-949d-a09b5db5841a` (15:42:38 UTC): duas imagens foram detectadas na biblioteca, mas a seleção da primeira referência falhou; configurações abriram e não foram salvas, geração bloqueada. Detectar imagens na biblioteca **não equivale** a anexá-las ao prompt. Esses problemas são intermitentes e distintos da aprovação.

Observador de confirmação atualizado para reconhecer **cartão da conversa**, três botões e mensagem de erro/repetição, sem coletar texto livre, cookies ou credenciais e sem efetuar cliques. Supabase `flow-telemetry` v6 aceita novas métricas. Commits `ddd876d`, `c10c561`. **Ainda requer deploy Modal e validação ponta a ponta; não afirmar correção das falhas intermitentes.**

## 2026-11-16 — Observador de confirmação Google Flow (aguardando deploy Modal e teste)

Implementado no executor um observador **somente leitura** após o clique em Gerar, para detectar caixas de diálogo, checkboxes e botões de confirmação/aprovação no DOM do navegador remoto, inspecionando até 8 frames e registrando apenas indicadores booleanos e contadores. Não coleta cookies, valores de campos, texto livre, credenciais ou screenshots; não clica em aprovação. Foi acrescentado o estágio `confirmation` em `flow_diagnostics.py`, e o retorno `confirmationInspection` no caminho de geração. Corrigida também a ausência de `flush_telemetry` no retorno antecipado após o clique em Gerar. A Edge Function Supabase `flow-telemetry` v4 foi atualizada para aceitar as novas métricas. Commits: `dd856d4` e `d7ee7a4`. **Ainda falta publicar o Modal e executar um teste ponta a ponta.** As rotinas de upload, seleção de imagens, prompt e configurações foram preservadas.

## 2026-11-16 — Marco funcional confirmado pelo usuário (12h16, 12h17 e teste com três imagens)

O usuário realizou três simulações após a correção do executor, incluindo testes às **12h16** e **12h17** e uma última tentativa com **três imagens**. Segundo seu relato, as execuções passaram pelas etapas de **envio das imagens, preenchimento do prompt e configurações**, chegando ao estado de **aguardar aprovação do projeto para começar o vídeo**. Registrar este estado como **marco funcional de referência**: preservar as rotinas de upload, seleção de imagens, prompt e configurações que funcionaram nesses testes; evitar alterações desnecessárias ou regressões.

**Telemetria Supabase:** a infraestrutura de tabelas e coletor foi publicada, porém a consulta direta à tabela `public.flow_execution_logs` nesta atualização retornou **zero registros**. Assim, ainda **não está comprovado** que os logs dessas simulações estejam sendo persistidos no Supabase. Investigar essa pendência separadamente, sem alterar o fluxo funcional do robô. O usuário informou que os testes chegaram à aprovação; a geração efetiva de vídeo ainda não foi confirmada.

## 2026-11-16 — Telemetria progressiva Modal → Supabase (integração pendente)

No projeto Supabase `jzchlrvxdaffnrgbvabv` foram criadas as tabelas `public.flow_execution_logs` e `public.flow_execution_events` com RLS ativo e permissões de `anon`/`authenticated` revogadas; Edge Function `flow-telemetry` v1 publicada com JWT obrigatório e validação adicional do bearer de serviço. O executor Modal ganhou envio progressivo best-effort dos eventos sanitizados `flow_step` e atualização final, sem registrar prompt, imagens ou URLs CDP. Commit do executor: `094a00f`. A integração só será ativada após adicionar a variável secreta `MV_FLOW_TELEMETRY_SERVICE_ROLE_KEY` ao secret Modal `mv-flow-control` e republicar o workflow; não foi realizado teste ponta a ponta. O endpoint captura eventos do nosso executor, **não os logs nativos internos do Modal/Hyperbrowser**. A seleção de imagens permanece inalterada.

## 2026-11-16 — Identidade auditável do executor Modal

Implementada telemetria para distinguir mudança de código, instância e sessão: `executorRevision` (SHA-256 dos dois arquivos Python), `gitCommit` (SHA do commit estampado pela GitHub Action no arquivo `build_revision.txt` antes do deploy), `containerTag` (SHA-256 truncado do hostname do container) e `sessionTag` (SHA-256 truncado do endpoint CDP da sessão, sem divulgar URL/token). O relatório do Supabase agora apresenta os quatro identificadores; na ausência de resposta permanece `unknown`, sem atribuir instância arbitrária. A rota privada `/control` action `health` retorna também revisão, commit e container para inspeção de publicação. Não houve alteração na função `include_references`, seleção, envio de imagens, configurações ou confirmação de créditos. **Pendente:** executar workflow de publicação do Modal e publicar o código compartilhado do Supabase; comparar identificadores em novas tentativas. A mudança não comprova por si só que versões diferentes estavam ativas.

## 2026-11-16 — Correção de identificação da aprovação de créditos

Teste `27381090-5945-415e-8b2e-65330339ec37`, executor `be33675ddaf7`, 25.601 ms: prompt enviado, duas imagens selecionadas, Incluir acionado, 9:16/x1 confirmados e Gerar clicado aos 19.504 ms. Usuário observou a janela de aprovação de créditos, mas o detector só procurava diálogos semânticos e terminou como `navigation_failed`, apesar da navegação e do clique bem-sucedidos. Corrigido detector pós-Gerar para reconhecer botões Aprovar/Confirmar/Continuar associados a contexto de créditos mesmo fora de `role=dialog`. Corrigida classificação de exceções após clique confirmado para `flow_generation_response_unconfirmed` em vez de `navigation_failed`. **Seleção de imagens não alterada.** Aprovação de créditos permanece manual; não há geração de MP4 confirmada. Commits `0dc019b` e `fd68182`; publicar Modal e validar.

## 2026-11-16 — Observabilidade pós-Gerar (seleção de imagens preservada)

Após cinco testes com executor `6c9b228004ed`, foi acordado preservar integralmente a função `include_references` e concentrar o diagnóstico no resultado posterior ao clique em Gerar. Implementada classificação adicional no executor: janela de confirmação de créditos (`flow_credit_confirmation_pending`), cartão de erro do Flow (`flow_generation_rejected`) e resposta inconclusiva durante observação (`flow_generation_response_unconfirmed`). Eventos incluem tempo até observação e frames consultados, sem capturar prompt, cookies ou tokens. O diagnóstico compartilhado do Supabase foi atualizado para exibir esses estados. O robô não confirma créditos nem repete Gerar automaticamente. **Não houve alteração na seleção, upload ou configuração 9:16/x1.** Publicação e validação em produção ainda pendentes; ausência de mensagem de erro não comprova geração aceita. A captura de metadados de rede e a correlação de tempos entre frontend, Supabase e Modal ainda são trabalhos futuros.

## 2026-11-16 — Diagnóstico da rejeição de geração no Google Flow

Tentativa `b58ab0e0-5b3b-438d-a945-310a7c9ce84d` (executor `6c9b228004ed`, 61.040ms): 2 imagens detectadas, selecionadas e botão Incluir acionado (+34.554ms); verificação de anexos no editor retornou zero; 9:16/x1 confirmados (+50.668ms); Gerar clicado (+54.736ms). Captura do navegador mostrou cartão do Flow **“Algo deu errado. Tente de novo.”** e botão **“Tentar de novo”**. O clique não prova geração aceita nem MP4. A causa interna da rejeição não foi exposta pelo Flow.

Correções commitadas: `c3881ed` observa por até cinco leituras após Gerar a presença de cartão de erro e botão Retry, incluindo elementos sem `role=alert`, registrando apenas métricas seguras `errorVisible`, `retryVisible`, `errorObservedMs`, `errorFramesRead` e retornando `flow_generation_rejected` sem tentar novamente; `cf3af90` atualiza o diagnóstico compartilhado para preservar `generationStarted`, aceitar o código de rejeição e deixar de afirmar incorretamente que o clique não ocorreu. Não alterada a seleção das imagens. Sem teste integrado ou publicação confirmados.

## 2026-11-16 — Correção de latência pós-Gerar e causa da intermitência

O mesmo código produz resultados diferentes porque automatiza uma UI dinâmica via CDP remoto: carregamento/renderização, seleção de miniaturas, avisos e tempos de resposta variam entre tentativas. Além disso, a chamada `prepare-flow-draft` é síncrona, passando por frontend -> Edge Function Supabase -> Modal -> Hyperbrowser; se a resposta expirar, o frontend exibe `client_response_unavailable` e `Executor: unknown`, sem comprovar falha do robô. Tentativas bem-sucedidas: 2 imagens selecionadas, Incluir, 9:16/x1, clique Gerar em 26.231ms; outra tentativa não retornou resposta em 91.366ms. **Correção de análise anterior:** o `httpx.AsyncClient(timeout=65)` de `modal_app.py` pertence à rota separada `/control` (sandbox browser), **não** à rota Hyperbrowser `/hyperbrowser-navigate` usada no fluxo descrito; não afirmar que 65s é o timeout dessa operação. O fetch Supabase -> Modal usa 105s; a função Modal tem 120s; o cliente pode perder a resposta antes desses prazos.

**Correção aplicada:** commit `f7fd98a4` remove o mapeamento redundante de até oito frames **depois** de um clique Gerar confirmado pelo executor. Em vez de esperar uma nova varredura remota, retorna imediatamente o resultado do clique e as configurações já inspecionadas, reduzindo a janela de timeout sem alterar a seleção das imagens nem bloquear Gerar. A geração aceita e o MP4 continuam não confirmados. Falta publicar e testar. Solução estrutural futura: job assíncrono persistente, idempotência e observabilidade por traceId; não repetir Gerar quando resultado é desconhecido.

## 2026-11-16 — Auditoria das camadas de execução Google Flow

Arquivos inspecionados: `src/components/auth/HyperbrowserProfile.tsx`, `supabase/functions/hyperbrowser-profile/index.ts`, `supabase/functions/_shared/flow-executor-diagnostics.ts`, `executors/google-flow/modal_app.py`, `executors/google-flow/flow_diagnostics.py`. Fluxo principal identificado: frontend -> Supabase Edge Function -> Modal gateway -> Playwright/Hyperbrowser. **Não foi identificada uma segunda implementação concorrente da seleção de imagens** nesses arquivos; existem modos adicionais (`prepare-image`, `click-generate`) roteados pelo mesmo executor.

**Causas técnicas/riscos concretos:** (1) timeout de 105s no fetch Supabase para `prepare-draft`, 65s no `httpx.AsyncClient` do gateway Modal e 120s na função Modal; os limites são diferentes, sem persistência de status do trabalho no frontend; (2) frontend recebe `client_response_unavailable` e `Executor: unknown` quando não há resposta, sem saber se a ação remota prosseguiu; (3) `@modal.concurrent(max_inputs=20)` com sessão Hyperbrowser reutilizada e sem mutex por sessão identificado no caminho examinado, risco de operações simultâneas na mesma página; (4) verificação de referências no editor pode registrar zero mesmo quando `Incluir` foi acionado, gerando mensagem contraditória de diagnóstico. **Hipótese não comprovada:** re-renderização e latência do Flow/CDP podem produzir resultados diferentes entre tentativas. Necessário instrumentar logs por traceId nas camadas e verificar se os limites de execução efetivos do Supabase permitem operações síncronas longas.

**Recomendação:** preservar o comportamento que já funcionou, não adicionar trava de anexos, não repetir Gerar quando o resultado é desconhecido. Em etapa separada, implementar job assíncrono com status persistido e lock por sessão para reduzir a dependência da resposta HTTP, além de corrigir mensagens contraditórias. Nenhuma alteração funcional nem deploy realizados nesta auditoria.

## 2026-11-16 — Marco funcional do robô Google Flow e investigação de intermitência

**Marco observado nos testes (não equivale a MP4 concluído):** o robô conseguiu preencher o prompt, enviar e selecionar lotes de **2 e 3 imagens**, acionar **Incluir no comando**, configurar **9:16** e **x1**, e clicar em **Gerar**. Na tentativa `1e00845e-d965-4ff9-b688-679a6185a5ca` (executor `c48a9bb6b49e`, 31.777 ms), dois nomes foram detectados aos 13.180 ms, seleção de duas imagens e Incluir acionado aos 18.199 ms, 9:16/x1 confirmados aos 24.835 ms e Gerar clicado aos 26.231 ms. A verificação de chips no editor retornou zero: **anexos no prompt não comprovados; vídeo gerado não comprovado**. Houve relato visual de erro eventual do Flow ao gerar.

**Intermitência:** tentativa `24619b4a-eadc-469d-a68d-2361e7cb6623` (11:57:38 UTC) terminou após 91.366 ms com `client_response_unavailable`, `Executor: unknown` e nenhuma etapa remota recebida; o estado real do executor é desconhecido. Tentativa anterior `ca773217-81a2-4b3a-8473-986d06e6a116` também não retornou resposta após 93.477 ms. Diferenciar falha de resposta do cliente de falha de automação no navegador. O usuário relata três testes com resultados distintos, mas o terceiro relatório completo ainda não consta deste registro.

**Prioridade:** auditar rotas duplicadas de preparação/geração, versões de frontend e executor, timeouts em camadas, concorrência e reutilização da sessão; preservar seleção de 2/3 imagens que já funcionou; não introduzir bloqueios por confirmação de anexos. Não repetir clique Gerar quando o estado da tentativa for desconhecido.

## 2026-11-16 — Comparação de 1, 2 e 3 imagens; seleção e timeout

Relatórios do executor antigo `66d3f43a9f87`: com 1 imagem, primeira detecção +14,099s, espera estável +17,288s, Incluir acionado; com 2 imagens, primeira detecção +14,035s, espera estável +17,120s, seleção da primeira falhou; com 3 imagens, primeira detecção +10,422s com indicador de processamento presente, indicador ausente +12,443s, espera estável +14,377s, três seleções e Incluir acionado. Nenhum relatório comprovou anexos no editor. Os três registraram bloqueio de Gerar porque o executor antigo ainda estava publicado; a branch main já havia removido a trava por referências no commit `9b8f1536`.

Implementado agora: commit `19a3e567` melhora escolha de opções com nome exato/completo e registra quantidade de indicadores visíveis de progresso no diagnóstico. A seleção por prefixo permanece como fallback; não foi possível testar o DOM real do Flow. A trava por referências **não** foi reintroduzida. Não confundir encerramento normal do RPC (24–33s nos relatórios) com timeout de Modal: limites conhecidos incluem função 120s, sandbox 600s, idle 120s. Ainda faltam acompanhamento da geração, MP4, testes e publicação do executor atualizado pelo workflow manual `deploy-hyperbrowser-modal.yml`.

## 2026-11-16 — Estratégia aprovada: reconhecimento de imagens, geração monitorada e entrega do MP4

**Objetivo:** automatizar Google Flow com duas referências reais, sem clique prematuro em Gerar e sem encerrar o acompanhamento após o envio.

**Fase A — Reconhecer e selecionar:**
1. Após upload, aguardar o fim do processamento e três leituras estáveis.
2. Ler a biblioteca sem cliques exploratórios: mapear nome/miniatura, opções selecionáveis, posição relativa e estado da seleção; guardar identificadores temporários, revalidando-os após mudanças no DOM.
3. Identificar inequivocamente os dois arquivos; somente então testar clique prolongado na primeira imagem (proposta inicial 1,5s), confirmar modo multisseleção e selecionar a segunda conforme o gesto realmente suportado pelo Flow. Não assumir que Ctrl+clique funciona.
4. Confirmar duas seleções, acionar uma vez “Incluir no comando” e verificar **duas referências efetivas no editor**, não apenas nomes presentes na biblioteca.
5. Se não houver confirmação, interromper com erro diagnosticável, sem gerar nem consumir créditos.

**Fase B — Geração assíncrona:**
1. Validar prompt, referências, 9:16 e x1; registrar job idempotente e clicar Gerar uma única vez.
2. Persistir identificadores seguros de job/projeto/sessão e acompanhar estados `preparando`, `selecionando_imagens`, `gerando`, `concluido`, `erro`, `tempo_excedido`; não bloquear uma requisição HTTP durante a renderização.
3. Monitorar progresso/erros a cada ~5s, com espera inicial proposta de até 10min e sessão de até 15min, sujeitos aos limites reais de Modal/Hyperbrowser/Flow. Renovar sessão somente se suportado e seguro. Nunca repetir clique em estado incerto.
4. Ao concluir, obter MP4 pela opção disponibilizada pelo Flow, validar tipo/tamanho, armazenar em bucket privado Supabase e vincular ao produto, job e histórico; disponibilizar visualização e download ao usuário.
5. Se falhar ou expirar, preservar estado, motivo e possibilidade de retomada sem gerar duplicatas.

**Estado da implementação nesta conversa:** commit `b2f9af279315e25c53e2488b793a08ce01fdc852` adicionou **somente a trava de segurança**: para pedidos com imagens, `prepare-draft` exige `reference_result.verified` antes de Gerar. **Não implementados ainda:** reconhecimento visual completo, gesto adaptativo, comprovação robusta de dois anexos, fila assíncrona, acompanhamento até fim, download e armazenamento MP4. Nenhum teste end-to-end ou deploy Modal confirmado. A trava pode impedir a geração até que a verificação de referências seja corrigida.

**Execução/implantação:** o workflow `.github/workflows/deploy-hyperbrowser-modal.yml` é manual (`workflow_dispatch`); para executar, selecionar `main`, manter `rotate_cloudflare_secret=false` e confirmar logs/health check. Não interpretar commit como deploy.

## 2026-11-16 — Google Flow: geração acionada, seleção de duas imagens e diagnóstico pós-clique

Nesta conversa, foram analisadas três tentativas reais do executor Hyperbrowser/Modal:
- `80c3f6b5-543c-4dd5-8ddd-684831bbcac2`: imagens enviadas, mas seleção travada no primeiro recurso; configurações 9:16 e x1 confirmadas; clique Gerar bloqueado por referências não verificadas.
- `e478aab4-3452-4e11-b245-550b5a4317eb` (01:32 UTC): duas imagens selecionadas e “Incluir no comando” acionado, mas anexos não reconhecidos no editor; rotina Gerar não localizou seta (zero candidatos), embora mapeamento posterior encontrasse um.
- `08af265b-64e2-4b26-a945-12f9d35ac2f4` (01:38 UTC): 2 arquivos enviados, falha na seleção das referências ainda na primeira imagem, configurações 9:16/x1 confirmadas; **clique em Gerar executado** (`flow_generate_clicked`). Usuário observou somente uma imagem carregada e aviso do Flow pedindo para tentar novamente. Clique não comprova geração aceita nem MP4 produzido.

Alterações commitadas na `main`:
- `00166890`: remove exigência de `referencesVerified` para permitir tentativa de gerar após confirmar prompt/configurações; **pode consumir créditos mesmo sem anexos corretos**.
- `1392a44a`: alinha busca da seta Gerar à geometria do editor; clique único quando candidato inequívoco.
- `1e783fbd`: relatório registra clique real e expõe métricas de seleção.
- `d24202ca`: prioriza um único controle selecionável por imagem quando há elementos aninhados na biblioteca.
- `4a963db0`: inspeciona alertas imediatos após Gerar e distingue `flow_generation_rejected`, sem repetir clique e consumir créditos duas vezes.

**Estado confirmado:** os logs anteriores demonstram clique no botão, mas não vídeo concluído. As últimas duas alterações foram enviadas ao GitHub; **não houve confirmação nesta conversa de deploy Modal nem de teste real após elas**. Seleção múltipla, confirmação de anexos no composer, aceitação da geração e obtenção do MP4 permanecem pendentes. Sem alterações de frontend, Edge Function ou banco nesses commits.

## 2026-11-15 — Correção do gravador manual na aba Lojas e Redes

Ao analisar dois logs `prepare-draft` (executor `c4324aedc836`), confirmou-se que nenhum clique manual foi gravado; o relatório foi produzido antes do clique e não inclui listener de usuário. A inspeção do repositório revelou que a ação havia sido adicionada ao backend mas **os controles de gravação não haviam sido renderizados no JSX**, o allowlist da sessão ativa não aceitava as ações de gravação e o frontend não guardava seus resultados no relatório. Correções em `src/components/auth/HyperbrowserProfile.tsx` (botões Iniciar/Parar/Ler e log copiável) e `supabase/functions/hyperbrowser-profile/index.ts` (roteamento). O componente é renderizado por `AccountHub.tsx` na seção Lojas e Redes. Necessário publicar frontend, Supabase e Modal; sem comprovação de deploy ou teste de captura real. Os dois relatórios `prepare-draft` não permitem confirmar se o clique posterior em Gerar iniciou o vídeo.

## 2026-11-15 — Gravador de cliques manuais no Google Flow

Implementado no código da branch main um gravador opt-in para ensinar ao robô a posição da seta Gerar. Ações autenticadas `start-click-recording`, `read-click-recording` e `stop-click-recording` chamam o executor Modal na sessão Hyperbrowser existente. O listener roda dentro de cada frame do navegador, captura até cinco cliques em botões a até 300px horizontalmente/100px verticalmente de Configurações, com atributos técnicos restritos a uma lista segura e deslocamento relativo, sem capturar prompt, cookies, senha, URLs ou coordenadas globais. O painel apresenta Iniciar gravação / Ler cliques registrados / Parar gravação e permite copiar o relatório. Gravação em memória da página: recarregar ou navegar para outra página pode apagar os eventos. O clique manual em Gerar pode consumir créditos. **Não publicado nem validado end-to-end nesta sessão**: necessário deploy Modal, Edge Function `hyperbrowser-profile` e frontend Cloudflare. Depois de preparar o projeto: iniciar gravação, clicar Gerar manualmente na janela remota, ler cliques e copiar relatório. Se nenhum clique for capturado, investigar frame ou rótulo Configurações; não presumir sucesso.

## 2026-11-15 — Nova ação explícita: clicar uma vez na seta Gerar

Implementada na branch main a ação `click-flow-generate` no painel de acesso remoto do Meu Vendedor. Ela chama `click-generate` no executor Modal por meio da Edge Function `hyperbrowser-profile`, reutilizando o projeto aberto sem recriar o projeto nem reenviar imagens. O robô procura o botão de envio/geração próximo ao botão Configurações do editor, exige exatamente um candidato habilitado, faz `trial` e **um único clique real**, sem repetir caso haja incerteza. A ação **não confirma automaticamente o aviso de créditos**, para permitir capturar a interface e o próximo log. Os eventos `generation`, `arrowCandidates`, `submitClicked` e os motivos `flow_generate_button_unavailable`, `flow_generation_click_uncertain`, `flow_generate_clicked` foram adicionados ao diagnóstico. Não foi realizado teste integrado no navegador real nem deploy de Modal, Supabase ou Cloudflare nesta sessão. Antes de usar, publicar os três componentes (executor Modal, Edge Function Supabase e frontend Cloudflare); usar o botão **Clicar em Gerar (uma vez)** apenas no projeto já preparado. O clique pode iniciar geração/consumir créditos mesmo sem confirmação adicional, dependendo da interface. **Não clicar novamente se houver resultado incerto.** Enviar relatório e captura do próximo aviso para implementar a etapa seguinte.

## 2026-11-15 — Inspeção da seta Gerar (sem consumir créditos)

Solicitação: preparar o robô para encontrar o botão de geração e coletar um log da próxima tentativa antes de programar o clique. A inspeção `editor_state` do executor Modal foi ampliada para contar botões próximos ao campo “O que você quer criar?”, botões habilitados, botões com ícone sem texto e candidatos a seta de envio. Não clica nem gera. Os indicadores `nearbyButtons`, `nearbyEnabled`, `iconOnlyButtons`, `arrowCandidates` e `arrowEnabled` foram adicionados à lista permitida e aos rótulos do relatório em `flow-diagnostics.ts`. Próximo teste: publicar o executor Modal e a Edge Function Supabase `hyperbrowser-profile` (esta usa o módulo compartilhado), abrir o projeto já preparado no Flow e acionar **Mapear interface do Google Flow (sem gerar)**. Enviar o relatório para identificar o botão exato. **Não executar geração nem confirmação de créditos nesta etapa.** A seleção das três imagens e a confirmação 9:16/x1 foram registradas no teste anterior, mas a verificação automática dos anexos continua pendente.

## 2026-11-15 — Solicitação de geração de vídeo após marco de preparo

O usuário autorizou explicitamente iniciar a geração no Google Flow, incluindo clicar na seta e confirmar o consumo de créditos, para futuramente recuperar o MP4 no Meu Vendedor. A tentativa de implementar a nova ação nesta sessão revelou uma integração incompleta e não validada. **As alterações experimentais foram revertidas** para o código estável de preparação de rascunho nos arquivos do executor Modal, componente React e funções Supabase. **Não há botão de geração publicado nem geração iniciada pelo robô nesta alteração.** Não executar deploy esperando geração. A implementação futura exige uma ação separada `generate-video` com autorização explícita, detecção segura do botão de seta, confirmação de créditos, proteção contra duplicidade, observação de progresso e download do arquivo MP4; testes unitários e deploy coordenado (Modal + Supabase + frontend Cloudflare). O marco anterior (3 imagens selecionadas e botão de inclusão acionado, prompt preenchido, 9:16/x1 confirmados, mas verificação automática de anexos pendente) permanece válido.

## 2026-11-15 — MARCO VALIDADO: três imagens, prompt e configurações no Google Flow

**Tentativa:** `a26d9f84-6152-4ed3-8270-54dd194af367`; **executor:** `23b491aef3ec`; início UTC 2026-11-15 22:23:10.022; duração 83.894 ms; ação `prepare-draft`.

**Conquistas verificadas pelo relatório:** navegador conectado e projeto criado; texto do prompt preenchido; três imagens enviadas pelo seletor nativo; três imagens identificadas e estáveis por três leituras consecutivas sem indicador de processamento; seleção em lote de três imagens; botão de inclusão habilitado e acionado uma única vez (`referencesIncluded=true`, `selectedExpected=3`); painel de configurações aberto; formato 9:16 e quantidade x1 confirmados. Usuário também observou o envio das três imagens ao comando. **Importante:** o verificador automático ainda retornou `flow_references_unverified`, pois não reconheceu as miniaturas no editor (`attachmentMatches=0` em oito leituras); isso não deve ser registrado como comprovação automática de três anexos. Geração não iniciada, nenhum crédito consumido pelo executor.

**Próxima etapa solicitada:** permitir uma ação de geração explicitamente autorizada, clicar na seta do editor e confirmar o aviso de gasto de créditos, registrando resultado e prevenindo cliques duplicados. Antes disso, corrigir ou complementar a verificação das miniaturas do compositor; não transformar `prepare-draft` em geração automática indiscriminada. **Estado técnico atual:** `modal_app.py` só reconhece modos de preparação/inspeção e `FlowDiagnostics.report()` fixa `generationStarted=False`; não há geração implementada nem workflow pronto para essa etapa. Preservar o fluxo de seleção múltipla e as configurações que funcionaram.

## 2026-11-15 — Recuperar seleção múltipla com rótulos truncados

Tentativa 38272164-2032-4a12-ae4c-39f8dbb8097f: 3 imagens carregadas, falha `flow_reference_selection_unavailable` já na primeira imagem, enquanto configuração do agente 9:16/x1 foi confirmada. A lógica de long-press + Ctrl+clique permaneceu intacta; falha decorre do localizador de imagens que exigia nome integral exato em folha DOM. Atualizado `flow_diagnostics.py` para procurar os itens da listbox por nome completo ou prefixo único do arquivo, inclusive textos e atributos de descendentes, sem clicar em itens ambíguos; registra opções disponíveis e quantidade de correspondências. Teste estático ampliado. Commits 5d570915 e 6a6fe373. Ainda sem teste real desta alteração; não alterar configuração do agente nem iniciar geração. Workflow Modal main, rotate_cloudflare_secret desmarcada.

## 2026-11-15 — Causa raiz do botão Adicionar 3 itens não encontrado

Relatório e6bbea8c-ceb0-4051-8bb8-971de62058e6: 3 imagens enviadas, selecionadas, mas `includeEnabled=0` apesar do botão visível no navegador. Causa no código: regex Python raw string em `find_include()` estava escrita com barras duplicadas (`\\\\b`, `\\\\d`, `\\\\s` no texto fonte), procurando barras literais e não o padrão numérico do botão `Adicionar 3 itens ao comando`. Corrigida a regex para `\\b(\\d+)\\s+` no texto fonte, preservando seleção múltipla, validação de quantidade exata e clique único. Adicionado teste de regressão para detectar barra dupla. Commits d0018e00 e 9435d803. Ainda não há validação em execução Modal; configurações e confirmação das três miniaturas continuam pendentes. Executar workflow deploy-hyperbrowser-modal.yml na main, rotate_cloudflare_secret desmarcado.

## 2026-11-15 — Botão dinâmico Adicionar N itens ao comando

Tentativa e8c5ef77-cb57-413c-8ff2-837075c7d667: três imagens carregadas e seleção múltipla visualmente confirmada (3 itens selecionados); Flow exibiu `Adicionar 3 itens ao comando`. O robô não clicou porque `find_include()` procurava apenas `Incluir no comando`. Atualizado `executors/google-flow/flow_diagnostics.py` para detectar botões de inclusão com rótulo dinâmico, exigir quantidade explícita exatamente igual a `len(image_files)` em lotes múltiplos, registrar os rótulos observados e clicar uma única vez somente quando o botão correto estiver habilitado. Teste estático acrescentado a `tests/test_flow_diagnostics.py`. Commits 226b227c e 45e9e254. A inclusão e a verificação das miniaturas continuam aguardando execução real; não declarar geração concluída. Configurações do agente também permanecem pendentes. Publicar com workflow deploy-hyperbrowser-modal.yml na main, rotate_cloudflare_secret desmarcado.

## 2026-11-15 — Ajuste de seleção múltipla após tentativa 2039f11c

Relatório confirmou 3 uploads estáveis e cliques nas três imagens, mas `flow_reference_selection_unconfirmed`; o código só segurava a primeira e clicava normalmente nas outras, potencialmente substituindo seleção. Alterado `flow_diagnostics.py`: primeira imagem usa clique prolongado 950 ms, demais usam Ctrl+clique; não bloqueia inclusão só por ausência de `aria-selected`/`data-state` (Flow pode ter seleção visual), tenta um único clique Incluir e exige comprovação de quantidade de miniaturas anexadas ao editor antes de declarar verificação. Se houver menos anexos, retorna `flow_references_unverified`; não gera vídeo. Atualizado teste estático. Commits 2f97b8b e 81e4159. Ainda sem validação real do gesto Ctrl+clique no Flow; pode exigir ajuste. A configuração do agente continua pendente de confirmação no navegador. Executar `.github/workflows/deploy-hyperbrowser-modal.yml` branch main, rotate_cloudflare_secret desmarcado, aguardar syntax preflight e gateway health. Não executar workflow Cloudflare.

## 2026-11-15 — Seleção múltipla por clique prolongado no Google Flow

Usuário confirmou manualmente que o Flow permite clicar e segurar para ativar seleção múltipla. Relatório 466bbb7c-45f7-4dbd-b4f9-372228961006: três imagens enviadas e estáveis, mas a seleção individual não concluiu a inclusão em lote. Atualizado `executors/google-flow/flow_diagnostics.py`: selecionar imagens do lote na listbox, pressionar a primeira por 950 ms (Playwright click delay), clicar as seguintes, verificar estados semânticos de seleção e acionar Incluir no comando uma única vez; verificar miniaturas no editor, sem clicar em Gerar. O executor interrompe com `flow_reference_selection_unconfirmed` se a interface não expuser seleção confirmada; é possível que o Flow use estado visual sem aria/data-state, exigindo novo mapeamento. Teste de regressão estático atualizado em `tests/test_flow_diagnostics.py`. Commits ad0cb7b8, cc9deab8, 3690c345. Workflow Modal na main com rotate_cloudflare_secret desmarcada. Ainda sem teste real desta revisão; não afirmar que três anexos ou configurações foram confirmados.

## 2026-11-15 — Configurações do agente Flow após upload

Capturas do navegador mostram duas imagens na biblioteca, uma referência visível no editor e o painel Configurações do agente com opções: confirmar antes de gerar Sempre; padrão de imagem 9:16, x1, Nano Banana 2.1; padrão de vídeo 9:16. O relatório a96402bf-09b4-421b-bdf1-63a72701276e ainda registra flow_reference_selection_unavailable e não confirma duas referências. Alterada `inspect_settings` para tentar abrir painel, configurar Sempre, imagem 9:16 e x1, vídeo 9:16 e clicar Salvar sem acionar Gerar; preserva modelo selecionado. `modal_app.py` agora chama configuração mesmo se seleção de referências não for verificada, mas mantém falha de referência como motivo principal e não gera vídeo. Commits e32f8300 e 6877d4d0. A interface pode exigir seletores adicionais, e a confirmação de salvamento ainda depende de teste real. Workflow Modal deve executar preflight Python antes de publicar; `rotate_cloudflare_secret` desmarcada. Não há deploy/teste real confirmado nesta revisão.

## 2026-11-15 — Modal timeout causado por regressão de sintaxe no executor

Após alteração da inclusão sequencial de imagens, workflow Modal voltou a falhar no health check com 4 TimeoutError. Inspeção de `executors/google-flow/flow_diagnostics.py` na main revelou regex `Incluir no comando` sem fechamento e bloco duplicado após `return result`, que impediam importação do módulo Python. Corrigido o arquivo e conferido que o blob final é 86203b47c6a4da09556769b8af82daa54aad65bc, sem duplicação e com regex completa; commit 9bfa0c0e. Adicionado passo obrigatório `Validate Python syntax before deploying Modal` no workflow `.github/workflows/deploy-hyperbrowser-modal.yml`, executando `python -m py_compile` nos três arquivos relevantes ANTES da publicação; commit 972f8f43. Ainda não executado workflow real ou teste navegador desta revisão. Reexecutar novo workflow na main com rotate_cloudflare_secret desmarcada. Se health check responder 200, retomar validação de inclusão de imagens; não presumir sucesso do Flow sem novo relatório.

## 2026-11-15 — Inclusão sequencial das imagens no comando do Google Flow

Após o relatório ce0e3c71-2678-48e8-bcee-26d545b35fed (executor 68e1711db4d2), upload de duas imagens, processamento e três leituras estáveis confirmados; a seleção falhava por exigir opção/checkbox com nome acessível. O print mostra uma prévia ativa e o botão 'Incluir no comando' habilitado. Implementada em `executors/google-flow/flow_diagnostics.py` inclusão sequencial por nome exato de arquivo na listbox, usando ancestral option/button da imagem, botão Incluir único habilitado e verificação de cada referência no contêiner do editor (sem exigir form). Se a biblioteca fechar, tenta reabri-la pelo controle de anexo. Em caso de confirmação insuficiente, interrompe sem acionar Gerar, evitando alegar sucesso. Revisão da regex de Incluir e testes estáticos em `tests/test_flow_diagnostics.py`. Ainda não executados testes Python ou navegador reais nesta revisão; validar no Modal antes de considerar resolvido. Para publicar: workflow `.github/workflows/deploy-hyperbrowser-modal.yml` na main com `rotate_cloudflare_secret` desmarcado. Não executar workflow de frontend. Commits de implementação 0bd6bade, ajustes 02ee1c2c e 7bd07aee, testes d914c735.

## 2026-11-15 — Modal gateway: corrigida verificação de inicialização no workflow

O run de deploy Modal falhou no passo de reachability: GET sem autenticação em /hyperbrowser-navigate com timeout de 25 s devolveu curl 28 / status 000. Isso não demonstra falha do deploy nem sucesso do gateway. Alterado `.github/workflows/deploy-hyperbrowser-modal.yml` (commit bd853a8a): verificação agora envia POST autenticado para `/control` com `{action:health}`, espera até 45 s por tentativa, repete até quatro vezes com intervalo de 8 s e exige HTTP 200; erros de autenticação/rota 401/403/404 falham imediatamente. Confirmado no código Modal que `/control` responde 200 a health autenticado. Reexecutar workflow Modal na main com rotate_cloudflare_secret desmarcada. Não há validação de run real nesta revisão; o erro pode persistir se o gateway estiver indisponível. Sem alteração no frontend ou no código da seleção nesta revisão.

## 2026-11-15 — Correção da seleção na biblioteca Google Flow (revisão pendente de teste real)

Relatório da tentativa 35ea47df-54f3-4165-83da-d82aec0aa6f1 no executor eace261ac165: upload e estabilidade das duas imagens confirmados; seleção falhou porque os nomes aparecem dentro de botões da biblioteca, enquanto a busca anterior exigia opções/checkboxes acessíveis com nome correspondente. Alterado executors/google-flow/flow_diagnostics.py para buscar botão com nome de arquivo somente dentro da listbox, exigir confirmação semântica de seleção após o clique e verificar referências no editor mesmo sem elemento form, limitando a inspeção ao contêiner próximo ao textbox. Adicionado teste de regressão estático. Commits de código 6583b58b e teste 4dc00a00. Não afirmar inclusão ou geração: o botão de imagem pode abrir apenas a prévia e, nesse caso, o executor ainda interromperá com flow_reference_selection_unconfirmed, sem clicar em Gerar nem consumir créditos. Necessário executar workflow Modal com rotate_cloudflare_secret=false, respeitar aprovação do ambiente e enviar novo relatório para validar a interface real. Não executar workflow frontend para alteração apenas Python. Nenhum deploy ou teste real desta revisão confirmado.

## 2026-11-15 — Incluir referências e mostrar estado atual/próxima ação (preparado)

- Responsável apontou que cronologia sozinha não permite desenvolver o próximo passo. Relatório real `80157f40-4cf2-4393-8471-1a167693eadb`, executor `ce9a1e15ac9f`, confirmou duas imagens com três leituras estáveis, um Incluir no comando visível/habilitado e dois botões de configurações; terminou com `flow_settings_ambiguous`. Isso confirma a revisão anterior ativa e supersede a pendência antiga de publicar ce9a1e15ac9f. A seleção genérica de um elemento não confirma que ambas as imagens foram selecionadas.
- Implementado passo `include_references`: usa somente opções/checkboxes semanticamente identificados na Lista de recursos e associados aos nomes gerados para o lote; evita selecionar arbitrariamente quando há zero ou múltiplos alvos. Seleções existentes são preservadas, todas são relidas antes de permitir Incluir. O botão Incluir precisa ser único/visível/habilitado, passa por trial e recebe no máximo um clique real; clique incerto não é repetido. Verificação posterior exige nomes esperados em anexos do formulário do prompt, fora da biblioteca/dialogs. Sem essa evidência, retorna pendência explícita, sem afirmar referências verificadas.
- Nomes de upload passaram a incluir um identificador aleatório por tentativa, sem nome original, para impedir confirmação por arquivos antigos com nomes repetidos. Elementos desconhecidos recebem diagnóstico semântico de contagens/estrutura da biblioteca, sem textos livres/credenciais. Se o Flow real usar outra estrutura ou não disponibilizar nomes nos anexos, a implementação bloqueia com motivo e precisa ser ajustada após novo relatório; testes simulados não comprovam compatibilidade real.
- Novo relatório inclui ESTADO ATUAL E PRÓXIMO PASSO: botões Incluir/Enviar/Gerar disponíveis/habilitados, configurações, campos/formulários identificados, confirmação das referências e uma próxima ação fixa (selecionar, incluir, verificar, inspecionar configurações ou gerar). Próxima ação não é tratada como ação executada. Rótulos de controles são normalizados para nomes fixos, evitando o texto pessoal do DOM que aparecia antes. UI/Edge preservam flags reais de inclusão/verificação.
- Timeout de espera do executor para prepare-draft ampliado de 55 para 105 s, sem retry automático e com limites internos de 9 s para referências e 7 s para configurações. Limites hospedados Supabase consultados na documentação oficial antes da alteração; gateway Modal mantém 120 s. Nenhum limite de gasto/credencial foi alterado.
- Pergunta de esclarecimento enviada ao responsável: enviar comando significa Incluir na biblioteca, seta de geração, ou ambos? Enquanto não houver resposta, mantém a ação atual Preparar (sem gerar): não foi implementado/disparado clique na seta de geração. Esta alteração implementa a inclusão de referências e o mapa de pendências; não afirma automação completa de vídeo.
- Validação local: 16 testes Python, 8 testes JS/TS, sintaxe Python, typechecks frontend/Edge, lint afetado e build de produção de 27 páginas aprovados. Revisão de executor esperada: **eace261ac165**. Commit/push e publicação em preparação conforme autorização vigente, sem geração real, migrations, Secrets ou alteração do checkout original/lockfile.

## 2026-11-15 — Correção de configurações publicada no Supabase/frontend; novo Modal pendente

- Commit de código **66bd19b56fbbe4d584b17f38e310960037a8481f** enviado sem force a origin/main. CI [43751835454](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43751835454) concluído com sucesso. Validação local: 11 testes Python, 7 testes JS/TS, sintaxe Python, typechecks frontend/Edge, lint afetado e build estático das 27 páginas aprovados.
- Supabase **hyperbrowser-profile ACTIVE v51**, `verify_jwt=true`; arquivos remotos comparados e idênticos à revisão desta correção. Antes da implantação, a função estava em v50 com conteúdo idêntico à v49 anteriormente publicada; a origem dessa versão intermediária não foi atribuída por suposição. Nenhuma migration ou Secret alterado.
- Cloudflare Worker **meu-vendedor** versão **d964b926-292d-4524-964b-051e3faaba01**, deployment **85c72526-530a-436b-81bd-c7da2ef1d076**, 100% do tráfego. Build com configuração pública ativa e dry-run aprovados; publicação pelo Wrangler local 4.157.0 com strict, configuração existente, bindings/Secrets/crons preservados. `/entrar` HTTP200; bundle `/_next/static/chunks/app/entrar/page-bed14fca5545770d.js` contém `flow_settings_blocked` e seu SHA-256 corresponde ao build local.
- **Modal desta correção ainda não publicado:** novo disparo de `deploy-hyperbrowser-modal.yml` negado pela integração GitHub com HTTP403 `Resource not accessible by integration`. Credenciais Modal não estão disponíveis localmente. A revisão anterior `ff587ad3a70f` foi comprovada pelo relatório do responsável e pelo run 43750633302; isso não publica a correção nova.
- **Ação necessária do responsável com permissão:** [workflow Modal](https://github.com/warllemedicao/Meu-Vendedor/actions/workflows/deploy-hyperbrowser-modal.yml) → Run workflow → main → `rotate_cloudflare_secret=false`, respeitando aprovação production. O próximo relatório deve mostrar **Executor: ce9a1e15ac9f**, hash dos dois arquivos Python desta correção. Até atualizar Modal, o robô ainda pode apresentar a falha antiga; não declarar corrigida remotamente só porque frontend e Edge Function foram publicados.
- Após atualizar, repetir teste supervisionado e verificar: observação de referências aparece antes das configurações; se o painel estiver ausente/ambíguo/bloqueado ou não puder ser lido, haverá código específico e upload/preenchimento preservados, em vez de erro global. Isso não seleciona referências nem inicia geração. Não houve teste autenticado real desta correção nem consumo de créditos de vídeo nesta sessão.
- Documentação atualizada; arquivo temporário de configuração pública e symlink de dependências removidos. Checkout original e alteração preexistente de package-lock.json preservados. O commit documental posterior não altera o código dos serviços.

## 2026-11-15 — Falha de configurações após upload: correção não fatal em preparação

- Responsável enviou relatório da tentativa `a4a6cc65-7cb2-4348-a9eb-8f964b943e38`, iniciada em `2026-11-15T19:11:38.360Z`, executor `ff587ad3a70f`. Duas imagens detectadas, três leituras estáveis, zero falhas de frames; espera concluída aos 17755 ms. Inspeção de configurações falhou aos 21862 ms com `navigation_failed`. Isso confirma upload detectado pela heurística e falha posterior; não comprova referências selecionadas, aviso de direitos aceito ou geração.
- Revisão `ff587ad3a70f` corresponde exatamente ao hash dos dois arquivos Python de `eea55df`. Workflow Modal [43750633302](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43750633302) confirmou deploy bem-sucedido dessa revisão, superando a pendência documental anterior de Modal não atualizado.
- Causa provável, ainda não comprovada remotamente: erro de ação no botão de configurações após aproximadamente 4,1 s, próximo ao timeout de clique de 4 s do código anterior. A exceção dessa etapa opcional propagava e descartava o resultado parcial. Não atribuir com certeza a overlay, selector ou timeout apenas pelo tempo observado.
- Correção isolada ao teste do Flow: helper `inspect_settings` com nomes exatos conhecidos, exigência de um único botão visível/habilitado, checagem de acionabilidade sem clique antes da ação, limites de 1,2 s por ação e 7 s totais. Botão ausente/ambíguo/bloqueado e falha de leitura recebem códigos distintos; nenhuma ação é forçada, nenhum erro bruto é copiado. A falha não aborta o preparo anterior nem impede o mapeamento posterior. Metadados Incluir no comando são observados antes de tentar abrir configurações. Seleção de referências e geração continuam não implementadas.
- Diagnóstico compartilhado TS permite os códigos `flow_settings_not_found`, `flow_settings_ambiguous`, `flow_settings_blocked` e `flow_settings_read_failed`, com mensagens que preservam a distinção entre upload, inspeção e geração. Isso exige atualizar Modal, o helper da Edge Function e o bundle do frontend.
- Validação local já confirmada: 11 testes Python e 7 testes JS/TS aprovados, sintaxe Python, typechecks frontend/Edge e lint dos arquivos afetados aprovados. Build de produção aprovado, com 27 páginas; nenhum resultado remoto desta correção é declarado aqui. Commit/push/publicação seguem a autorização vigente, mantendo JWT, Secrets, banco e checkout original preservados.

## 2026-11-15 — Publicação parcial confirmada: GitHub, Supabase e Cloudflare; Modal pendente

- **Autorização vigente:** o responsável autorizou commit/push e publicação das alterações concluídas/validadas no Supabase e Cloudflare, dentro do escopo solicitado. O escopo atual permanece exclusivamente no acesso remoto/teste do Google Flow e seus diagnósticos. Não autoriza iniciar geração de vídeo automaticamente.
- **GitHub:** commit `96e6faea50721092c5367a83af958e129485712e` (`fix(flow): add copyable attempt diagnostics`) criado na worktree isolada e enviado por push sem force a `origin/main`. O CI [43749120648](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43749120648) confirmou sucesso do job completo de testes/lint/typechecks/build; o job de deploy foi `skipped` por exigir `workflow_dispatch`. A main remota antes do push era `c6f4561`; nenhuma alteração remota concorrente foi sobrescrita.
- **Supabase confirmado:** `hyperbrowser-profile` implantada como **ACTIVE v49**, `verify_jwt=true`, com os três arquivos `hyperbrowser-profile/index.ts`, `_shared/flow-diagnostics.ts` e `_shared/flow-executor-diagnostics.ts`. Conteúdo remoto comparado e idêntico aos arquivos do commit. Teste sem usuário autenticado, usando somente credenciais públicas, retornou HTTP401 `unauthorized` com `traceId`, confirmando carregamento do novo código e recusa de acesso. Isso não valida uma sessão pessoal do Flow. Nenhuma migration, banco ou Secret foi alterado.
- **Cloudflare confirmado:** Worker existente `meu-vendedor` publicado pelo Wrangler local **4.157.0** após build de produção com chave publicável ativa obtida pelo conector (valor não registrado), dry-run e conferência do runtime/config contra o baseline `ae76a06` sem divergências. Versão **`04688ae7-3e7c-4dd6-bbad-3361e84c4f59`**, deployment **`27b455be-e4f4-401a-9a55-bd3499df79a5`**, 100% do tráfego, anotação `Flow attempt diagnostics 96e6fae`. Versão anterior registrada: `de2d1e6e-afd8-44b8-8f19-b03f08033a25`. Build gerou 27 páginas. Compatibility date, bindings, nomes de Secrets, observabilidade e crons preservados; `keep_vars=true`, sem rotação de segredo. Nenhuma alteração em `gilfinanceiro`.
- **Verificação pública:** primeira tentativa Python/urllib recebeu HTTP403; repetição com curl confirmou `/entrar` HTTP200 e HTML. O bundle `/_next/static/chunks/app/entrar/page-efe921a96a02f6fa.js` foi baixado por curl, contém o texto do botão e tem SHA-256 idêntico ao build local. Não foi executado teste visual autenticado nem geração real. A resposta 403 inicial não foi atribuída ao aplicativo sem evidência.
- **Modal NÃO publicado nesta etapa:** os disparos de `deploy-hyperbrowser-modal.yml` e `frontend-production.yml` pela integração GitHub foram recusados com HTTP403 `Resource not accessible by integration`. O token autentica e permite push/leitura, mas não permite esse disparo de Actions. Não há credenciais Modal no ambiente local; não foram buscados nem transferidos Secrets. O frontend pôde ser publicado pelo caminho direto Wrangler previsto no projeto; isso não publica o executor Modal. A última execução Modal consultada, [43743659820](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43743659820), pertence ao commit anterior `c6f4561`.
- **Consequência prática:** botão de copiar e tratamento de erros já publicados, porém os eventos detalhados por etapa e a correção dos seletores Concordo/upload dependem do novo Modal. Enquanto o executor antigo responder sem a telemetria nova, o relatório indicará `executor_report_unavailable`. Não declarar a instrumentação ponta a ponta pronta nem consumo de créditos/geração comprovados.
- **Próximo passo externo necessário:** usuário com permissão em Actions deve abrir [Deploy Hyperbrowser navigation gateway (Modal)](https://github.com/warllemedicao/Meu-Vendedor/actions/workflows/deploy-hyperbrowser-modal.yml), usar **Run workflow**, branch **main**, mantendo `rotate_cloudflare_secret=false`. Respeitar a aprovação do environment `production` se solicitada. Após sucesso, executar preparo supervisionado e copiar o relatório para diagnosticar seleção de referências. Não habilitar nem reenviar geração automaticamente.
- **Preservação:** checkout original em `/workspaces/Meu-Vendedor` e alteração preexistente em `package-lock.json` mantidos. Arquivo temporário ignorado com configuração pública e symlink de dependências usados apenas para build serão removidos ao encerrar. Atualização documental posterior altera apenas Markdown e não exige republicar o mesmo código dos serviços.

## 2026-11-15 — Autorização de commit, push e publicação da correção do Flow

O responsável autorizou expressamente fazer commit, git push e enviar alterações concluídas/validadas aos serviços pertinentes Supabase e Cloudflare após cada alteração. Essa autorização permanece no escopo do trabalho solicitado; não dispensa testes, gates técnicos ou distinção entre código versionado, deploy e resultado real. O executor Modal é dependência necessária dos diagnósticos atuais. Nenhuma geração de vídeo é iniciada por esta publicação.

Publicação desta correção em preparação a partir de `fix/flow-attempt-diagnostics` (base `c6f4561`, main remota confirmada por `git ls-remote`). Os testes/build descritos abaixo já foram realizados. Plano: commit dos 12 arquivos da tarefa, push sem force para a main remota, publicação do Modal pelo workflow existente sem rotação Cloudflare, publicação isolada de `hyperbrowser-profile` com JWT preservado e frontend pelo workflow `frontend-production.yml`. O workflow geral de banco não será disparado porque esta alteração não exige migrations nem publicação de outros módulos. Registrar SHAs e execuções reais depois, sem presumir sucesso. Checkout original e alteração em `package-lock.json` permanecem preservados.

## 2026-11-15 — Relatório copiável das tentativas do Google Flow (implementação local)

- Responsável autorizou, nesta tarefa, dispensar a leitura de todos os Markdown e consultar apenas os documentos relacionados ao Flow e os registros recentes. Leitura integral: `GOOGLE_FLOW_E_YOUTUBE.md`, `executors/google-flow/README.md` e `CLOUDFLARE.md`; leitura parcial das seções recentes de Flow em `CONTINUAR_AMANHA.md` e `historico.md`. Os demais documentos não foram relidos nesta tarefa.
- Diagnóstico: `prepare-flow-draft` termina após o preparo; seleção das referências e clique em Gerar continuam não implementados. O texto fornecido pelo responsável veio de `inspect-flow-editor`, que mapeia controles e não demonstra resultado do upload anterior. Erros específicos eram descartados pela Edge Function e pelo frontend em respostas HTTP 502.
- Trabalho isolado na branch `fix/flow-attempt-diagnostics`, worktree `/tmp/meu-vendedor-flow-logs`, baseada em `origin/main` `c6f4561`. Checkout original `main` preservado em `ffb285e`, 129 commits atrás da referência remota local, com a alteração preexistente em `package-lock.json` preservada. Nenhum fetch, merge, commit, push ou deploy realizado nesta tarefa.
- Implementação: telemetria estruturada no Modal com identificador de tentativa, revisão SHA-256 abreviada dos dois arquivos Python do executor, etapa, status, tempo e contagens. A espera de até 45 s exige três leituras estáveis e informa imagens esperadas/detectadas, processamento, leituras, frames e falhas. Leitura individual usa limite adicional com `asyncio.wait_for`; detecção por nomes ainda é heurística e não comprova anexação ao comando. Sondagem somente de leitura conta controles Incluir no comando e estados genéricos de seleção, sem clicar neles.
- Edge Function repassa o relatório em sucesso e falha, preserva motivos permitidos e diferencia timeout, executor antigo sem relatório e erro desconhecido. O frontend lê o corpo de `FunctionsHttpError.context`, mantém cinco relatórios em memória mesmo após mapear a interface, oferece Copiar relatórios do Flow e texto selecionável como alternativa. Recarregar a página apaga esse histórico local. Relatórios excluem prompt, arquivos, textos livres do DOM, dados de conta, URLs e credenciais.
- Corrigido escape duplicado nos seletores regex de Concordo e Fazer upload. Testes demonstram correspondência com os rótulos visíveis; ainda não é prova de que esse defeito causou a tentativa real do responsável. Confirmação explícita de direitos continua obrigatória. `readyToGenerate` permanece falso enquanto referências não forem verificadas.
- Validação: seis testes novos JavaScript/TypeScript e cinco testes Python aprovados; sintaxe Python, typecheck frontend/Edge e lint aprovados (quatro avisos Kaggle preexistentes no lint completo). Suíte global: 65/66 arquivos passaram no sandbox; o arquivo `run-supabase-cli.test.mjs` falhou pela captura vazia de stderr no subprocesso e passou 3/3 fora do sandbox. Não declarar a execução global do sandbox totalmente verde. Build estático com chave fictícia passou fora do sandbox e gerou 27 páginas; a primeira tentativa no sandbox falhou em TypeScript `--showConfig`. Não valida autenticação nem produção.
- Consulta remota somente leitura confirmou `hyperbrowser-profile` ACTIVE v48 ainda com código anterior. Consulta agregada de logs não isolou a causa da tentativa real; não concluir ausência de falha com base nessa consulta. Nenhuma configuração, Secret, sessão, banco ou serviço remoto foi alterado; nenhuma geração/GPU foi iniciada.
- Próximos passos: revisar alterações, integrar a branch e publicar Modal, Edge Function `hyperbrowser-profile` com os dois helpers `_shared`, e frontend pelos fluxos autorizados existentes. Preservar JWT e os controles de publicação. Testar o preparo supervisionado, copiar o relatório e usar a evidência para implementar depois seleção de referências e geração. Em timeout, estado remoto desconhecido: não reenviar automaticamente.

## 2026-11-15 — Espera por carregamento estável das imagens no Google Flow

- Usuário identificou visualmente que o robô avançava antes de as duas imagens terminarem de carregar na biblioteca.
- Ajustado `executors/google-flow/modal_app.py` (commit `7119a8bd`): após upload e consentimento, o executor relê os frames, procura os nomes esperados dos arquivos, verifica indicadores de processamento e exige três leituras estáveis consecutivas; limite de 45 segundos, com erro seguro `flow_images_not_ready`.
- Limite: a confirmação por nomes visíveis e indicadores de progresso é uma heurística, ainda não testada no Flow remoto; não comprova inclusão como referências no comando. Seleção das imagens, clique em `Incluir no comando`, geração e recuperação do MP4 continuam pendentes.
- Pendente: validar sintaxe/testes, publicar o executor Modal, executar teste supervisionado e mapear com evidência os controles de seleção/inclusão antes de implementar o próximo clique.

## 2026-11-15 — Correção do build Cloudflare (TS2339)

- O workflow `build:pages` falhou em `src/components/auth/HyperbrowserProfile.tsx` porque `settingsInspection.referencesVerified` era utilizado no JSX, mas não declarado no tipo `Result`.
- Corrigida a tipagem de `settingsInspection` para incluir os campos opcionais `referencesVerified`, `readyToGenerate` e `generationStarted` (commit `ac99e7d8`).
- **Pendente:** executar novamente o workflow de frontend e confirmar que TypeScript e build completo passaram; não houve validação do deploy nesta alteração.

## 2026-11-15 — Pré-verificação das configurações no botão único do Flow

- Solicitação: após upload e confirmação de direitos, robô deve ir ao comando, verificar configurações e clicar na seta de geração quando tudo estiver correto.
- Implementado parcialmente com segurança: a ação existente `prepare-flow-draft` agora tenta abrir e inspecionar configurações no próprio fluxo, sem botão adicional; frontend exibe estado de 9:16, x1 e referências. Commits `ba7e929b` (Modal), `68a0885d` (frontend).
- **Ainda não implementado:** associação verificável das imagens carregadas ao prompt, alteração/salvamento dos parâmetros divergentes e clique na seta Gerar. O código mantém geração bloqueada porque biblioteca com imagens não garante referências selecionadas, e os seletores do painel ainda não foram validados no editor real. Não declarar fluxo concluído.
- **Pendente:** publicar Modal e frontend, inspecionar estados reais no projeto, mapear seleção de referências e opções de configuração, então implementar ajuste e disparo explícito com prevenção de geração duplicada e controle de créditos.

## 2026-11-15 — Reversão de botão redundante de configurações

- Usuário reportou confusão com botão `Verificar configurações do Flow (sem gerar)`, que falhou por estar na página inicial do Flow e não no editor de projeto.
- Removido o botão de inspeção de configurações da interface de teste, preservando `Preparar projeto e preencher texto (sem gerar)`, o seletor de imagens e a confirmação explícita de direitos. Commit `572772d6`.
- O botão principal pode aparecer desabilitado enquanto imagens estiverem selecionadas sem o checkbox de direitos marcado, ou sem sessão ativa/prompt.
- Inspeção automática das configurações dentro do fluxo principal, seleção das referências e geração **ainda não implementadas**. Não anunciar automação completa antes de validação.
- Pendente publicar frontend Cloudflare para refletir remoção do botão.

## 2026-11-15 — Inspeção segura das configurações do Google Flow

- Usuário mostrou painel `Configurações do agente` ao lado da seta de envio e solicitou verificar os parâmetros antes da geração. Na captura, proporção vertical `9:16` e quantidade `x1`; nome exato do modelo e demais estados precisam ser lidos no Flow ao vivo.
- Adicionada ação de **inspeção sem gerar**: Modal `inspect-settings` abre o painel quando identifica botão de configurações e retorna rótulos/estados de seleção de 9:16, x1 e modelo. A leitura não clica em Salvar ou Gerar. Commit `0ed01d06`.
- Supabase Edge Function `hyperbrowser-profile` ação `inspect-flow-settings`, versão **v45 ACTIVE**, commit `1dbb8210`.
- Frontend `Conta e conexões`: botão `Verificar configurações do Flow (sem gerar)` e apresentação dos valores identificados; commit `ea08cfe4`.
- **Pendente:** publicar Modal e frontend, executar inspeção real e mapear os seletores para aplicar alterações e salvar. Ainda não há ajuste automático de parâmetros nem acionamento da seta Gerar. Não integrar com `Gerar vídeo` até confirmação de referências, configurações e autorização explícita para consumo de créditos.

## 2026-11-15 — Consentimento de direitos automatizado após autorização explícita

- Usuário confirmou que as duas imagens apareceram na Biblioteca do Flow e solicitou que o robô clique em `Concordo` quando surgir o aviso `Direitos de uso desta imagem`, para avançar ao teste seguinte.
- Frontend já possui checkbox explícito de confirmação de direitos, obrigatório ao selecionar imagens (commit anterior). O consentimento vale para o lote selecionado, não é presumido.
- Executor Modal agora exige `imageRightsConfirmed=true` e detecta o aviso, clicando no botão `Concordo` quando visível, inclusive se o Flow mostrar avisos sucessivos para múltiplas imagens. Commits `c7875e0b` e `1e882570`.
- Edge Function `hyperbrowser-profile` valida consentimento no servidor e o encaminha ao executor. Supabase **v43 ACTIVE**, commit `e0af7877`.
- **Pendente:** publicar Modal atualizado e confirmar o comportamento em teste real. Próxima etapa funcional é selecionar as imagens já carregadas como referências no prompt; essa seleção ainda não está implementada/validada. A ferramenta Gerar vídeo permanece desconectada, e nenhuma geração é iniciada.

## 2026-11-15 — Upload de duas imagens confirmado visualmente no Google Flow

- Usuário confirmou: **“concluindo as imagens foram carregadas, apareceu apenas aquele popup”**. A captura mostra duas imagens (personagem vermelho e personagem verde) disponíveis na biblioteca do Flow, com nomes de arquivo de produto.
- O aviso `Direitos de uso desta imagem` apareceu durante o envio. A confirmação de direitos é uma declaração do usuário, não deve ser presumida automaticamente.
- **Marco validado:** o fluxo de envio do Meu Vendedor ao Google Flow conseguiu carregar dois arquivos de imagem sem iniciar geração de vídeo.
- **Limite da validação:** imagens presentes na biblioteca não equivalem a imagens selecionadas/anexadas como referências ao prompt. A próxima etapa é confirmar a seleção das imagens no editor e, se houver confirmação de direitos, tratar o aviso de forma explícita e autorizada.
- Manter a ferramenta de teste isolada de `Gerar vídeo` até a etapa de seleção de referências ser validada.

## 2026-11-15 — Identificação visual do botão de upload no Flow

- Usuário enviou duas capturas do editor: na Biblioteca do Google Flow, o controle **`Fazer upload...`** fica no canto inferior esquerdo da janela, abaixo dos filtros de recursos. O texto e duas imagens foram selecionados no Meu Vendedor, mas o upload não foi confirmado; erro anterior `A conexão não respondeu`.
- Executor ajustado em `executors/google-flow/modal_app.py` para procurar o rótulo completo `Fazer upload...` (inclusive reticências), testar candidatos visíveis dentro dos frames, clicar no controle e capturar o seletor de arquivo do navegador. O código continua sem clicar em `Gerar`. Commit `c766dd4b`.
- **Pendente:** publicar Modal e confirmar no teste real se o controle dispara file chooser e se as duas imagens aparecem anexadas. Não afirmar sucesso antes da validação.

## 2026-11-15 — Reincidência do erro de upload no Flow e diagnóstico por logs

- Usuário repetiu teste com 2 imagens e screenshot mostrou novamente a Biblioteca do Flow com opção `Fazer upload...`, sem prévia de arquivos, e mensagem do Meu Vendedor `A conexão não respondeu. Consulte os registros do Supabase.`
- Consulta de logs do Supabase confirmou `POST | 502` na função `hyperbrowser-profile` às `2026-11-15T15:51:53` e `hyperbrowser_executor_http_error { status: 502, reason: \"executor_error\" }`. O `POST | 200` posterior é outra chamada e não comprova sucesso do upload.
- Correção no executor Modal: agora captura o `filechooser` nativo via Playwright `page.expect_file_chooser` ao clicar em `Fazer upload`, usa `chooser.set_files` para múltiplas imagens e tenta `input[type=file]` somente como fallback. Se não localizar o controle, falha com motivo específico, sem iniciar geração. Commit `87901fb9`.
- Ampliados erros seguros do executor para `flow_upload_action_not_found` e `flow_file_chooser_unavailable`, sem expor tokens/URLs privadas. Commit `9e4ecab8`.
- **Pendente:** publicar Modal atualizado, repetir teste e confirmar visualmente anexos; não afirmar sucesso antecipadamente. Interface permanece com botão único e múltiplas imagens opcionais.

## 2026-11-15 — Flow abriu Biblioteca em vez de anexar imagens

- Evidência do usuário: tela do Flow mostra a aba Biblioteca e a ação `Fazer upload...`; duas imagens estavam selecionadas no Meu Vendedor. A aplicação retornou `A conexão não respondeu` e nenhum anexo foi confirmado.
- Causa provável no executor: clicar em adicionar/revelar biblioteca não basta; é preciso selecionar explicitamente `Fazer upload...` antes de localizar o `input[type=file]` e enviar os bytes.
- Ajuste em `executors/google-flow/modal_app.py` commit `06a62516`: localizar `Fazer upload` na biblioteca, abrir menu de anexos se necessário, exigir um input de arquivo único e enviar as imagens com Playwright `set_input_files`. Se a ação não for encontrada, falhar com `flow_upload_action_not_found` em vez de declarar sucesso. Nenhum clique em Gerar.
- **Não validado em produção:** publicar novamente o executor Modal e testar; confirmar visualmente os anexos. Se o Flow abrir diálogo nativo de arquivos sem expor input, será necessário implementar tratamento do file chooser.

## 2026-11-15 — Remoção do botão redundante e suporte a múltiplas imagens no mesmo envio

- Usuário reportou que o teste de anexo exibiu `Não foi possível confirmar o anexo da imagem` e diagnóstico `página Flow não; frames 0/0`. Esse diagnóstico não comprova ausência de página: era um retorno sem inspeção e/ou estado anterior; não afirmar upload bem-sucedido.
- Usuário corrigiu requisito: **não criar botão de execução separado**; incluir somente seletor de imagens múltiplas na caixa do prompt e usar o mesmo botão `Preparar projeto e preencher texto (sem gerar)` para enviar texto e imagens.
- Frontend: seletor `multiple` opcional PNG/JPG/WebP, até 3 imagens e 2,5 MB somados; único botão; limpeza do diagnóstico antigo antes da tentativa. Commits `e106550c`, `cf259702`.
- Supabase: `prepare-flow-draft` aceita lista de imagens com validação de formato e limite de payload, encaminha ao Modal e retorna contagem; Edge Function `hyperbrowser-profile` v38 ACTIVE. Commit `09cb902d`.
- Modal: modo `prepare-draft` recebe múltiplos arquivos e tenta anexá-los via Playwright no mesmo preparo do prompt, sem clicar em Gerar. Commit `25311180`.
- Documentação sincronizada: `CONTINUAR_AMANHA.md` `b39601ad`, `CLOUDFLARE.md` `aa2e0300`, `README.md` `8d033293`.
- **Pendente:** publicar Modal e frontend, testar no Flow e verificar visualmente se a prévia de todas as imagens aparece. Não interligar ao módulo `Gerar vídeo` até validação.

## 2026-11-15 — Sincronização da documentação após teste de prompt e preparação do anexo

- **Último retorno do usuário:** preparação unificada do projeto e preenchimento de texto no Flow funcionaram: `Projeto pronto e texto preenchido no Flow. Nenhuma geração iniciada.` Diagnóstico: página Flow sim; frames 5/5; controles visíveis 33; falhas de leitura 0; rótulos relevantes 4.
- **Pedido seguinte:** não conectar à ferramenta `Gerar vídeo` ainda; disponibilizar um seletor de imagem na mesma área do prompt para testar o anexo manual, sem geração.
- **Implementação correspondente:** campo PNG/JPEG/WebP de até 2,5 MB e botão `Preparar texto e anexar imagem (sem gerar)`; ação `prepare-flow-image` na Edge Function Supabase `hyperbrowser-profile` v36 ACTIVE; executor Modal `prepare-image` que tenta enviar bytes ao input de arquivo do Flow sem clicar em gerar. Frontend commit `be40c8d3`; executor `278f42a1`, `d169d574`, `fdac3a42`; backend `d4da7bcb`, `3ca875b0`.
- **Limite:** o upload de imagem ainda não foi confirmado pelo usuário; `imageAttached` indica entrega ao input, não prova prévia processada. Modal e frontend ainda dependem de publicação confirmada. Não afirmar que geração ou integração com catálogo estão prontas.
- **Pedido atual:** atualizar documentação Markdown relacionada às alterações. Atualizados `README.md` (`f9126779`), `CLOUDFLARE.md` (`3221face`) e `CONTINUAR_AMANHA.md` (`dea375e7`). `GALERIA_DE_PRODUTO.md` permanece sem alteração porque a galeria do catálogo não foi modificada neste teste.
- **Próximo teste:** usuário publica Modal e frontend, seleciona uma imagem de teste, verifica prévia no editor do Flow e informa sucesso ou erro; somente então avançar para a integração com o catálogo.

## 2026-11-15 — Teste isolado de anexo de imagem no Google Flow

- Usuário pediu **não integrar à ferramenta Gerar vídeo ainda**. Adicionada opção de escolher imagem local ao lado do campo de prompt em `Conta e conexões → Google Flow`, com botão `Preparar texto e anexar imagem (sem gerar)`.
- Frontend: aceita PNG/JPG/WebP de até 2,5 MB e transmite arquivo somente após clique explícito. Commit `be40c8d3`.
- Supabase: ação autenticada `prepare-flow-image`, valida formato e tamanho codificado, repassa ao executor; Edge Function `hyperbrowser-profile` **v36 ACTIVE**. Commits `d4da7bcb`, `3ca875b0`.
- Modal: modo `prepare-image` cria projeto se necessário, preenche prompt, valida bytes de imagem e tenta `set_input_files` em campo de arquivo existente ou revelado pelo botão de adicionar. **Não clica em Gerar.** Commits `278f42a1`, `d169d574`, `fdac3a42`.
- **Limite do teste:** retorno `imageAttached` confirma entrega ao input de arquivo, não necessariamente processamento/prévia pelo Flow; usuário precisa conferir visualmente no editor. Se não existir input acessível, retorna `image_input_not_found` sem iniciar geração.
- **Pendente:** publicar Modal e frontend, realizar teste real de upload e confirmar prévia. Nenhuma integração com Gerar vídeo feita.

## 2026-11-15 — Validação real da preparação unificada do Google Flow

- Usuário confirmou: **`Projeto pronto e texto preenchido no Flow. Nenhuma geração iniciada.`**
- Diagnóstico: **página Flow sim; frames 5/5; controles visíveis 33; falhas de leitura 0; rótulos relevantes 4**.
- **Marco:** ação unificada `prepare-flow-draft` validada em produção; criação/reutilização de projeto e preenchimento do prompt funcionaram sem iniciar vídeo.
- **Próxima etapa:** anexo de imagem do produto do Meu Vendedor. Código existente armazena `mv_products.image_url` e há fluxo de assets privados em `mv-video-assets`; é necessário vincular o produto autorizado à sessão e descobrir o controle de upload do editor, sem expor URL privada ou enviar credenciais ao Flow. Não há evidência de upload funcionando ainda.

## 2026-11-15 — Unificação de criar projeto e preencher prompt (pedido do usuário)

- **Validação real do usuário:** depois de clicar manualmente em `Criar projeto de teste (sem gerar)`, a ação `Preencher texto no Flow (sem gerar)` conseguiu preencher o prompt. O erro anterior ocorreu quando não havia projeto aberto; as instruções de teste estavam incompletas.
- **Correção:** Modal modo `prepare-draft` reutiliza projeto aberto, ou procura `Novo projeto` e o abre antes de preencher o campo `O que você quer criar?`. Não aciona geração. Commit `4268526c`.
- Supabase ação autenticada `prepare-flow-draft`, Edge Function `hyperbrowser-profile` **v34 ACTIVE**. Commit `2b2d929e`.
- Frontend: removido botão separado de criação de projeto; ação única `Preparar projeto e preencher texto (sem gerar)`. Commit `ae0a6c78`.
- **Pendente:** publicar Modal e frontend e validar a ação unificada em sessão aberta na página inicial e com projeto existente.
- **Imagem:** não implementada ainda. O editor só expôs campo de prompt, sem input de arquivo no mapeamento. Próxima tarefa é identificar o botão de anexo, mapear a origem autenticada da imagem do produto e transferir o arquivo com segurança para a sessão Hyperbrowser sem iniciar geração.

## 2026-11-15 — Falha HTTP 502 no preenchimento de prompt Google Flow

- Usuário recebeu `A conexão não respondeu. Consulte os registros do Supabase.` ao usar `Preencher texto no Flow (sem gerar)`.
- Logs reais Supabase às 15:08 UTC registraram duas chamadas HTTP **502** à Edge Function `hyperbrowser-profile`, acompanhadas de `hyperbrowser_executor_http_error { status: 502 }`. A causa interna específica do Modal **não estava disponível** nesses logs.
- Hipótese técnica fundamentada: o campo `O que você quer criar?` foi mapeado como `editable · textbox` e pode expor rótulo em atributo de placeholder, enquanto a implementação anterior usava somente `get_by_role(..., name=...)`.
- Executor corrigido para procurar o campo editável por atributos de metadados e exigir correspondência única antes de preencher; razões de falha seguras retornadas sem credenciais. Commit `e685cb8c`.
- Supabase encaminha código de erro seguro; Edge Function `hyperbrowser-profile` **v31 ACTIVE**. Commit `e45507f3`.
- Frontend traduz erros específicos para instruções úteis. Commit `d55e25a8`.
- **Pendente:** publicar Modal, depois frontend, e retestar. Não foi confirmada geração nem preenchimento bem-sucedido. Upload de imagem permanece não implementado.

## 2026-11-15 — Preenchimento supervisionado de prompt sem gerar

- Modal: novo modo autenticado `stage-prompt` aceita prompt de 1 a 4000 caracteres, exige URL de projeto `https://flow.google.com/project/...`, procura campo de texto `O que você quer criar?` (ou equivalente inglês) de forma inequívoca e usa `fill()`. **Não clica em Gerar e não envia vídeo.** Commits `0b705aff`, `8d7f9b51`.
- Supabase: nova ação autenticada `stage-flow-prompt`, com validação de tamanho e repasse ao executor. Edge Function `hyperbrowser-profile` **v29 ACTIVE**. Commit `1802fe8e`.
- Frontend: campo para colar prompt e botão `Preencher texto no Flow (sem gerar)` na área Conta e conexões. Commit `ea2a1bc2`.
- **Imagem ainda não automatizada:** o mapeamento do editor não revelou input de arquivo; não presumir que upload funciona. Necessário inspecionar o fluxo de anexo do Flow e escolher uma imagem autorizada do catálogo com transferência segura, sem expor credenciais ou gerar conteúdo.
- **Publicação pendente:** Modal workflow (sem rotação de segredo) e depois frontend workflow (confirm_frontend_only=true). Teste ponta a ponta do preenchimento ainda não realizado.

## 2026-11-15 — Mapeamento real do editor do Google Flow confirmado

- Usuário abriu um projeto e executou `Mapear interface do Google Flow (sem gerar)`.
- Resultado da captura: **página Flow sim; frames 5/5; controles visíveis 32; falhas de leitura 0; rótulos relevantes 4**.
- **Campos do editor (3):** `input · Texto editável`, `input · Pesquisar`, `editable · textbox · O que você quer criar?`.
- **Controles clicáveis (4):** `Mais opções para o projeto`, `Criar coleção`, `add Criar ferramenta` e uma opção de ajuda sobre custos de geração.
- O campo `O que você quer criar?` é candidato a prompt; ainda **não foi testado o preenchimento**. Seleção de modo vídeo, upload de imagem e geração seguem pendentes.
- Próxima ação técnica: testar preenchimento de prompt em modo supervisionado, sem enviar geração, e identificar entradas de imagem e configuração antes de conectar ao botão Google Flow de Gerar vídeo.

## 2026-11-15 — Unificação da inspeção do Google Flow

- Pedido do usuário: `Identificar controles` e `Mapear campos do editor` são operações semelhantes e devem ter **um único botão**.
- Frontend: removido botão duplicado `Identificar controles (sem gerar)`; mantido `Mapear interface do Google Flow (sem gerar)`, que chama `inspect-flow-editor` e mostra tanto os controles clicáveis quanto os campos de formulário retornados. Duplicatas de rótulo+papel são filtradas na interface. Commit `84ec0b59`.
- Resultado informado antes do ajuste: 12 controles, incluindo links e comandos repetidos da lista de projetos. Isso não demonstra mapeamento dos campos de geração; é necessário manter projeto aberto ao inspecionar.
- **Pendente:** publicar frontend via `frontend-production.yml` com `confirm_frontend_only=true`; sem necessidade de novo deploy Modal/Supabase. Testar mapeamento com projeto aberto e registrar os campos encontrados.

## 2026-11-15 — Mapeamento somente leitura dos campos do editor Google Flow

- Executor Modal: modo `inspect-editor` que enumera inputs, textareas, selects, campos editáveis e papéis de formulário em até oito frames, retornando apenas tipo, papel, rótulo curto e formatos aceitos; **não lê valores de prompts, credenciais ou arquivos**. Commit `f3f6d57e`.
- Supabase: ação autenticada `inspect-flow-editor` no `hyperbrowser-profile`, **v27 ACTIVE** publicada. Commit `0d04c491`.
- Frontend: botão `Mapear campos do editor (sem gerar)` em Conta e conexões, com lista de campos e diagnóstico de frames. Commit `b5a7f7c0`.
- **Pendente:** publicar Modal e frontend via GitHub Actions na ordem; manter `rotate_cloudflare_secret` desmarcado e `confirm_frontend_only` marcado. Testar a inspeção em projeto aberto. Não foi implementado envio de imagens ou geração de vídeos.

## 2026-11-15 — Teste real: robô abriu projeto no Google Flow com sucesso

- Usuário executou `Criar projeto de teste (sem gerar)` em **Conta e conexões → Google Flow** e forneceu captura do resultado.
- Interface confirmou: **`Novo projeto aberto. Controles do editor identificados abaixo; nenhum vídeo foi gerado.`**
- Diagnóstico apresentado: **página Flow sim; frames 5/5; controles visíveis 32; falhas de leitura 0; rótulos relevantes 4**.
- A janela remota exibiu a URL `flow.google.com/project/...` e o editor de um projeto vazio. Opções visíveis incluem `Gerar arte conceitual`, `Editar uma imagem` e `Mostrar os atalhos do teclado`.
- **Marco validado:** clique automatizado em `+ Novo projeto` e abertura do editor com a sessão autenticada. Ainda não foram validados o campo de prompt, upload de imagens, seleção de vídeo/modelo, geração ou download de MP4.
- **Próximo passo:** inspecionar elementos de formulário do editor (campos editáveis, seletores, botões e inputs de arquivo), com filtros de privacidade, antes de integrar a ação ao botão Google Flow em Gerar vídeo.

## 2026-11-15 — Implementação da criação supervisionada de projeto no Google Flow

- Executor Modal `executors/google-flow/modal_app.py`: novo modo `create-project` no endpoint autenticado `/hyperbrowser-navigate`. Só executa em página `flow.google.com`, procura botão acessível com nome `Novo projeto` ou `New project`, exige correspondência única, clica uma vez e examina controles sem gerar vídeo. Commit `804ac9a1`.
- Supabase `hyperbrowser-profile`: nova ação autenticada `create-flow-project`, usando sessão Hyperbrowser existente; encaminha modo ao Modal e retorna `projectClicked` e diagnósticos. Commit `a587acdc`; **Edge Function v25 ACTIVE publicada**.
- Frontend `HyperbrowserProfile.tsx`: botão `Criar projeto de teste (sem gerar)` em **Conta e conexões → Google Flow**, com retorno de inspeção. Commit `5a34d9ed`.
- **Pendente publicação:** executar workflow Modal `deploy-hyperbrowser-modal.yml` na main, mantendo `rotate_cloudflare_secret` desmarcado; depois executar workflow frontend `frontend-production.yml` com `confirm_frontend_only=true`. Testar em sessão autenticada. Não foi realizado teste ponta a ponta de clique nesta etapa.
- O botão Google Flow da área Gerar vídeo ainda não foi conectado ao fluxo de criação de projeto; integração só após validação do editor. Nenhum envio de imagem ou geração foi implementado nesta etapa.

## 2026-11-15 — SUCESSO: inspeção do Google Flow reconheceu Novo projeto

- **Teste real confirmado pelo usuário após publicar o executor Modal corrigido:** `página Flow sim; frames 2/2; controles visíveis 17; falhas de leitura 0; rótulos relevantes 9`.
- **Controles identificados:** Google Flow, Flow Music, tv Flow TV, links para Instagram e X, Abrir projeto, Editar título do projeto, Excluir projeto e **`add Novo projeto`**.
- **Resultado:** o executor Hyperbrowser/Modal conectou ao Google Flow autenticado, examinou ambos os frames sem erros e reconheceu o botão de criação de projeto. O teste foi somente de leitura, sem iniciar geração de vídeo nem consumir créditos de geração.
- **Próxima etapa:** implementar ação supervisionada de clique em **Novo projeto**, identificar os controles do editor e validar a criação de projeto. Não confundir reconhecimento de botão com criação de vídeo concluída; envio de imagens, prompt, geração e download de MP4 permanecem pendentes.

## 2026-11-15 — Causa identificada para inspeção com 0/2 frames

- **Resultado real informado pelo usuário:** `página Flow sim; frames 0/2; controles visíveis 0; falhas de leitura 2; rótulos relevantes 0`.
- **Causa encontrada no código:** a chamada Python Playwright `Locator.evaluate_all(scan, timeout=8000)` utiliza o argumento `timeout`, que não é aceito pela assinatura de `evaluate_all`. A exceção era capturada silenciosamente em cada frame, causando `scanErrors=2` e `inspectedFrames=0`.
- **Correção:** removido o argumento inválido, mantendo `evaluate_all(scan)`. Commit `f802ba26`.
- **Publicação pendente:** executar somente o workflow `deploy-hyperbrowser-modal.yml` (sem marcar `rotate_cloudflare_secret`). Não há alteração de frontend ou Supabase nesta correção. Repetir a inspeção e verificar se `inspectedFrames` fica acima de zero e `scanErrors` diminui.
- **Validação:** causa confirmada por inspeção do código, mas resultado em execução ainda depende do deploy e do teste real. Nenhuma geração de vídeo foi iniciada.

## 2026-11-15 — Causa da interface desatualizada: atualização de segredo sobrescreveu versão ativa do Worker

- Usuário repetiu teste e recebeu texto antigo `Controles visíveis identificados sem iniciar geração.`, sem o diagnóstico numérico presente no código da `main`.
- Inspeção da API Cloudflare, Worker `meu-vendedor`: publicação de frontend em **2026-11-15T13:56:12Z** (versão `0612768c-15c4-40b6-a7d1-03637a5fe368`), seguida por atualizações de segredo em **14:00:28Z** e **14:06:13Z**. A versão ativa de 100% do tráfego é `7f9fca86-01ba-4605-aefa-9e159af23ab9`, disparada por `secret`, e não a versão do último deploy do frontend.
- Causa operacional identificada: workflow `deploy-hyperbrowser-modal.yml` executava `wrangler secret put MV_FLOW_EXECUTOR_SECRET` em toda publicação Modal, criando nova versão do Worker e interferindo na versão de assets ativa.
- Correção no workflow (commit `05c67674`): sincronização do segredo Cloudflare somente se a nova opção `rotate_cloudflare_secret` for marcada explicitamente; padrão **false**. Manter desmarcada em publicações normais do Modal.
- **Pendente:** publicar frontend pelo workflow `frontend-production.yml` após a última sincronização de segredo e verificar no navegador a linha `Diagnóstico: página Flow...`. Não foi executado novo deploy Cloudflare nesta etapa. Evitar repetir deploy Modal após o frontend salvo se necessário.

## 2026-11-15 — Teste real da inspeção: lista vazia apesar do botão Novo projeto visível

- Usuário mostrou Flow autenticado com botão **“+ Novo projeto”** visível no navegador remoto, mas a interface do Meu Vendedor exibiu apenas “Controles visíveis identificados sem iniciar geração”, sem lista. Logo, a operação HTTP concluiu, porém **não reconheceu controles relevantes**.
- Diagnóstico ampliado no executor Modal: `visibleCount`, `frameCount`, `inspectedFrames`, `scanErrors` e `flowPage`, sem expor texto livre, tokens ou informações da conta. Commit `9eaba6d8`.
- Supabase `hyperbrowser-profile` encaminha esses indicadores, versão **22 ACTIVE**. Commit `5ee2a2d2`.
- Frontend apresenta mensagem explícita para lista vazia e os contadores diagnósticos. Commit `96294656`.
- **Pendente:** publicar Modal e frontend Cloudflare atualizados; repetir a inspeção e usar contagens para determinar se o problema está na seleção da página, frames, DOM ou filtro de rótulos. Não declarar reconhecimento do botão até prova real.

## 2026-11-15 — Inspeção Flow: somente um controle encontrado; diagnóstico e correção

- **Teste real informado pelo usuário:** a função de inspeção identificou apenas o controle de conta Google; não encontrou “+ Novo projeto”, embora o botão estivesse visível na captura anterior.
- **Diagnóstico:** a primeira implementação navegava novamente para a página inicial durante a inspeção e selecionava somente a primeira aba do navegador; varria apenas botões com texto, sem examinar frames. Isso podia capturar a interface antes de sua renderização e ignorar controles relevantes.
- **Correção commitada:** inspeção agora escolhe uma aba Flow já aberta, não a recarrega, aguarda brevemente a interface e examina até oito frames, incluindo botões, links e elementos com tabindex. Filtra rótulos relevantes e impede retorno de texto de conta/e-mail; retorna contagens agregadas para diagnóstico. Commits `46f7e723` e `6ac33ce2`.
- **Pendente:** publicar novamente o executor Modal via workflow `deploy-hyperbrowser-modal.yml` e repetir o botão “Identificar controles (sem gerar)”. Supabase e frontend não exigem nova publicação para essa correção. Não houve geração nem consumo de créditos de vídeo neste teste.

## 2026-11-15 — Primeira etapa do robô Flow: inspeção de interface sem consumir créditos

- Implementada no executor Modal a opção `mode=inspect` na rota autenticada `/hyperbrowser-navigate`: conecta via CDP à sessão existente, abre Flow e coleta até 30 rótulos de botões visíveis; **não clica, não envia imagens e não inicia geração**. Commit `d8e45ea9`.
- Edge Function `hyperbrowser-profile`: nova ação autenticada `inspect-controls`, valida sessão ativa e devolve os controles; publicada no Supabase versão **19 ACTIVE**. Commit `a91215c5`.
- Interface da Loja: botão **Identificar controles (sem gerar)** e apresentação dos rótulos retornados. Commit `47d00645`.
- **Pendências de publicação:** executor Modal precisa de execução do workflow `deploy-hyperbrowser-modal.yml`; frontend Next.js precisa de novo build e deploy no Cloudflare. O deploy do Supabase está concluído. Nenhum teste real do DOM do Flow foi executado nesta etapa, pois exige uma sessão autenticada do usuário e o Modal atualizado.
- **Próxima fase:** após confirmar os controles reais, implementar navegação supervisionada, anexar imagens autorizadas, inserir prompt e solicitar confirmação antes de iniciar geração com créditos; depois recuperar o vídeo.

## 2026-11-15 — Validação positiva da persistência do login Google Flow

- **Teste confirmado pelo usuário:** após usar **Salvar acesso e fechar** no Meu Vendedor, abriu novamente o Google Flow pelo navegador remoto e a página carregou **sem solicitar a senha**.
- Resultado: autenticação preservada entre duas sessões no teste manual, além da abertura remota já validada anteriormente. Não houve necessidade de reinserir credenciais.
- **Próxima etapa:** implementar e testar, de forma supervisionada, a interação com o botão “+” do Flow, o envio de imagens autorizadas do catálogo, a inserção do roteiro e o acompanhamento do vídeo gerado. Reutilizar o executor Modal/Hyperbrowser e o perfil persistente existentes.
- **Ainda não validados:** criação automatizada, exportação/download de MP4, fila, integração ponta a ponta com produtos e publicação em redes sociais.
- Não armazenar senhas, cookies, tokens ou URLs de sessão assinadas no histórico.

## 2026-11-15 — Marco: Google Flow aberto com sessão autenticada no navegador remoto

- **Confirmação do usuário:** após publicar o workflow Modal com os ajustes de sessão, o botão de abertura do Google Flow no Meu Vendedor abriu corretamente a página `https://flow.google.com/` em um navegador remoto Hyperbrowser, **já autenticado** na conta Google do usuário.
- A interface do Flow foi exibida e solicitou clicar no botão **“+”** para iniciar a criação. O usuário confirmou visualmente a abertura; este é o primeiro teste positivo de acesso ao Flow no navegador remoto após a série de erros `session not found`.
- Mudanças anteriores relacionadas: `timeoutMinutes:20`, verificação de status `active` na Edge Function, `keepAlive=true` no CDP do Modal e remoção do fechamento do navegador remoto. Supabase `hyperbrowser-profile` v17; executor Modal publicado pelo workflow, conforme confirmação do usuário.
- **Escopo comprovado:** abertura do Flow e sessão Google autenticada nesta execução. **Ainda não comprovados:** persistência da autenticação após encerrar/reabrir a sessão, interação automatizada com o botão “+”, envio de imagens, geração de vídeo, download e registro de MP4.
- **Próxima etapa recomendada:** validar o botão **Salvar acesso e fechar** e reabrir a sessão; depois ampliar o executor Modal existente com um fluxo supervisionado de criação de vídeo e recuperação do resultado, sem criar um robô independente desnecessário. Evitar registrar URLs assinadas, cookies, senhas ou tokens.

## 2026-11-15 — Correção de timeout e persistência da sessão Hyperbrowser

- Documentação Hyperbrowser confirma configuração `timeoutMinutes` e parâmetro CDP `keepAlive=true` para manter o navegador ativo após desconexão do cliente.
- A Edge Function criava sessão sem timeout explícito e reutilizava até 12 minutos. Agora cria com `timeoutMinutes:20` e verifica `status === 'active'` antes de reutilizar ou aceitar uma sessão recém-criada. Commit `fef3d634`.
- Executor Modal passa `keepAlive=true` no endpoint CDP sem registrar tokens; não fecha o navegador remoto. Commit `9ff179a0`.
- Supabase `hyperbrowser-profile` versão 17 ACTIVE. **Modal precisa de novo deploy** pelo workflow `deploy-hyperbrowser-modal.yml`. A conexão e o live view ainda não foram validados após a mudança; não declarar resolução completa.

## 2026-11-15 — Fallback de visualização quando Modal falha (HTTP 502)

- Nova tentativa de login registrou `POST /hyperbrowser-profile 502`, `hyperbrowser_executor_http_error {status:502}` e `hyperbrowser_existing_session_navigation_failed` em 13:27:49 UTC.
- O frontend já aceita `liveViewUrl` com `navigationReady:false` e orienta abrir `https://flow.google.com` manualmente no navegador remoto.
- Edge Function passou a devolver o live view validado de uma sessão ainda ativa mesmo quando a navegação automática via Modal falha, preservando a sessão. Assim a falha CDP não bloqueia a abertura manual. O link remoto continua temporário e sujeito à disponibilidade do provedor; não foi confirmada abertura bem-sucedida.
- Commit `3f0f5d6e`, Supabase `hyperbrowser-profile` versão 15 ACTIVE, JWT obrigatório. Não precisa de workflow Modal para esta correção.
- **Pendente:** testar se o live view remoto está realmente disponível. Se `session not found` persistir, investigar status/expiração do Hyperbrowser e logs do Modal; não registrar tokens de live view.

## 2026-11-15 — Preservação da sessão durante falha Modal HTTP 502

- Logs Supabase confirmaram `hyperbrowser_executor_http_error {status:502}` seguido de `hyperbrowser_stale_session_restarting`, indicando falha de navegação Modal antes da reinicialização da sessão.
- Corrigido `hyperbrowser-profile` para não encerrar uma sessão Hyperbrowser válida apenas porque o executor Modal falhou. Retorna HTTP 502 `flow_navigation_unavailable` e `sessionPreserved:true`, sem entregar link temporário não validado.
- Publicado Supabase `hyperbrowser-profile` versão 13 ACTIVE; commit `9b03ca50`.
- Modal `hyperbrowser-navigate` ganhou logs seguros com classe da exceção e hostname CDP, sem tokens/URLs sensíveis; commit `c386a9b5`. **Pendente publicar Modal via GitHub Actions** e consultar logs Modal após novo teste.
- A causa específica do HTTP 502 Modal ainda não está comprovada. Não declarar navegação Google Flow concluída.

## 2026-11-15 — Correção da desconexão CDP no executor Modal

- Investigação do erro Hyperbrowser live view `session not found` identificou que `executors/google-flow/modal_app.py` chamava `await browser.close()` após abrir o Flow via `chromium.connect_over_cdp`.
- Em conexão CDP com navegador de terceiro, fechar o objeto Browser pode encerrar o navegador remoto e invalidar o visualizador. Removido `browser.close()`; o contexto `async_playwright()` encerra o cliente Playwright sem comandar fechamento do Chromium do Hyperbrowser.
- Alteração commitada `fab5b943`. **Pendente deploy Modal** via workflow manual `deploy-hyperbrowser-modal.yml` na branch main e novo teste de sessão. Não houve publicação Modal nesta edição.
- Links de visualização com tokens são sensíveis e não devem ser compartilhados em logs/histórico.

## 2026-11-15 — Sessão Hyperbrowser expirada e link inválido

- Usuário recebeu `{"code":"not_found","message":"session not found","retryable":false}` no visualizador hxproxy. O link de live view continha token temporário; não registrar URL completa ou token em documentação.
- Identificado que `hyperbrowser-profile` reutilizava link de sessão recente sem exigir navegação bem-sucedida. Corrigido para tentar navegar antes de reutilizar; se falhar, encerrar sessão antiga e criar nova. Se a nova sessão não conseguir navegar, encerrar, limpar ID persistido e retornar `flow_navigation_unavailable` HTTP 502, em vez de expor link inválido.
- Código commitado `fd593c8`, Edge Function `hyperbrowser-profile` publicada na versão 11 ACTIVE, `verify_jwt=true`.
- **Pendente**: testar abertura no aplicativo; se houver falha, consultar logs `hyperbrowser_executor_http_error`, `hyperbrowser_executor_request_failed` ou `hyperbrowser_new_session_navigation_failed`.

## 2026-11-15 — Correção da confirmação Supabase CLI no CI

- Execução do workflow falhou em `supabase secrets set` com `Confirmation required: Set 2 secrets` e `This run can't ask because stdout is not a terminal. Nothing was changed.`.
- Corrigido comando do GitHub Actions para `supabase secrets set --yes --project-ref ...`, permitindo execução não interativa. Mantida verificação posterior da presença das duas variáveis no Supabase.
- **Pendente:** reexecutar workflow na branch main e validar navegação remota no Meu Vendedor. Nenhum valor de secret foi registrado no histórico.

## 2026-11-15 — Diagnóstico da tela em branco do Hyperbrowser

- Teste real do usuário: navegador remoto abriu em branco após workflow Modal verde.
- Logs Supabase em 2026-11-15 13:06:16 UTC mostram `hyperbrowser_executor_not_configured {hasUrl:false,hasSecret:false,hasEndpoint:true}` na função `hyperbrowser-profile` v9. Navegação não foi enviada ao Modal.
- Workflow `.github/workflows/deploy-hyperbrowser-modal.yml` atualizado para verificar presença de `MV_HYPERBROWSER_EXECUTOR_URL` e `MV_HYPERBROWSER_EXECUTOR_SECRET` no Supabase após `supabase secrets set`, falhando se ausentes. Não imprime valores.
- **Pendente:** executar novamente workflow, verificar logs da nova tentativa e confirmar abertura do Flow. O sucesso do workflow anterior não demonstrou que a Edge Function recebeu as variáveis.

## 2026-11-15 — Sincronização segura via GitHub Actions

- O usuário confirmou sucesso (verde) do workflow Modal anterior.
- Ampliado `.github/workflows/deploy-hyperbrowser-modal.yml` para, após deploy Modal, configurar no Supabase `MV_HYPERBROWSER_EXECUTOR_SECRET` e `MV_HYPERBROWSER_EXECUTOR_URL` e atualizar apenas `MV_FLOW_EXECUTOR_SECRET` no Cloudflare via Wrangler. Usa secrets do GitHub Actions sem imprimir valores.
- Verificações HTTP com autenticação após sincronização: `/control` health deve retornar 200; `/hyperbrowser-navigate` com endpoint inválido deve retornar 400. Não executa navegação Google nem manipula login nesse teste.
- **Pendente**: executar novamente o workflow manualmente para aplicar sincronização (commit posterior à execução verde), confirmar resultado e testar navegação real autenticada no app. Sem API de dispatch disponível nesta sessão.

## 2026-11-15 — Workflow de publicação Modal para Hyperbrowser

- Criado `.github/workflows/deploy-hyperbrowser-modal.yml`, acionado exclusivamente por `workflow_dispatch`, ambiente `production`, com verificação de `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` e `MV_FLOW_EXECUTOR_SECRET` no GitHub Actions.
- Reutiliza `scripts/deploy-flow-executor.py` e o app Modal existente para publicar a rota `/hyperbrowser-navigate` sem inserir credenciais no repositório.
- **Pendente**: executar workflow manualmente e conferir sucesso, configurar `MV_HYPERBROWSER_EXECUTOR_URL` e `MV_HYPERBROWSER_EXECUTOR_SECRET` no Supabase, validar navegação real. Sem conexão para implantar Modal nem para gerenciar secrets Supabase nesta sessão; não afirmar publicação concluída.

## 2026-11-15 — Reaproveitamento do executor Modal existente para Hyperbrowser

- Identificado executor Modal já existente em `executors/google-flow/modal_app.py`, com imagem que inclui Playwright e rota privada `/control`.
- Implementada nova rota `POST /hyperbrowser-navigate` no mesmo gateway, autenticada pelo secret Modal existente `MV_FLOW_EXECUTOR_SECRET`, com conexão Playwright CDP ao `wsEndpoint` do Hyperbrowser e navegação para `https://flow.google.com/`.
- A função Supabase `hyperbrowser-profile` v9 já chama executor HTTPS configurado em `MV_HYPERBROWSER_EXECUTOR_URL` e `MV_HYPERBROWSER_EXECUTOR_SECRET`. Para usar Modal, definir URL como `https://warllemedicao--meu-vendedor-flow-gateway.us-east.modal.run/hyperbrowser-navigate` **após** redeploy do Modal; secret Supabase deve corresponder ao `MV_FLOW_EXECUTOR_SECRET` existente no Modal. Não expor secrets.
- **Ainda pendente**: deploy Modal, secrets no Supabase, teste real da navegação, envio de prompts/imagens e geração de MP4. Commit não implica publicação Modal.

## 2026-11-15 — Ponte Supabase → executor Node.js Hyperbrowser

- Criado `scripts/hyperbrowser-executor-server.mjs`, serviço HTTP Node.js com autenticação Bearer e Playwright CDP para navegar a sessão remota até Google Flow. Endpoint `POST /navigate`, saúde `GET /health`. Nunca registrar o endpoint WebSocket nem credenciais.
- `supabase/functions/hyperbrowser-profile/index.ts` passou a chamar opcionalmente o executor HTTPS, usando secrets `MV_HYPERBROWSER_EXECUTOR_URL` e `MV_HYPERBROWSER_EXECUTOR_SECRET`. Publicado no Supabase como versão 9.
- **Pendente para funcionar:** hospedar o serviço Node.js em provedor com WebSocket de saída; configurar secret de no mínimo 32 caracteres idêntico nos dois lados e URL HTTPS completa do `/navigate` no Supabase; instalar `playwright-core`; validar comunicação real. Enquanto não configurado, navegação automática retorna `false` sem impedir abertura manual. Não declarar integração pronta.
- A automação de upload de imagem, preenchimento de prompt e geração de vídeo ainda não foi desenvolvida nem validada.

## 2026-11-15 — Executor Node.js para Hyperbrowser (implementação inicial)

- Diagnóstico real em Supabase: `hyperbrowser_flow_navigation_diagnostic`, etapa `connect_cdp`, código `ERR_NOT_IMPLEMENTED`. Playwright CDP não conecta nesse runtime.
- Criado `scripts/hyperbrowser-flow-navigate.mjs`: executor Node.js com `playwright-core`, conexão ao `HYPERBROWSER_WS_ENDPOINT` fornecido por ambiente, navegação até `https://flow.google.com/`, resultado mínimo sem registrar credenciais ou endpoint.
- **Pendente**: provisionar serviço Node.js persistente/temporário, instalar dependência nesse ambiente, proteger chamadas com autenticação, conectar Edge Function ao serviço, validar a sessão real e integrar UI. Não há automação de prompt, upload nem download implementada. Nenhuma navegação real foi confirmada.
- **Segurança**: não armazenar `wsEndpoint` em repositório, navegador ou logs; manter autenticação e perfil Hyperbrowser existentes.

## 2026-11-14 — Opções para testar automação do Google Flow (retomar depois)

- Objetivo: enviar imagem e prompt do produto do Meu Vendedor ao Google Flow, acompanhar geração e trazer MP4 ao histórico, sem alterar a produção antes de validar.
- Projetos investigados: [Flow Automation](https://github.com/Yeamin-Sheikh/Flow-Automation) (extensão Chrome Manifest V3, painel lateral, content scripts, upload e download declarados; parte da lógica compilada) e [Auto-Flow / Flow Batch](https://github.com/NeetroxX/Auto-Flow) (código TypeScript legível, `FlowPageAdapter`, seletores DOM, anexo por `File`/`DataTransfer`, preenchimento de prompt, monitoramento de mídia e downloads). O próprio Auto-Flow informa que seletores, configurações e captura de resultados ainda exigem teste na interface real do Flow. Nenhuma geração real foi comprovada.
- **Opção 1 — Extensão própria na Chrome Web Store:** desenvolver extensão do Meu Vendedor, submetê-la à análise da loja e, se aprovada e autorizada pela política do computador, instalá-la para interagir com a sessão Google já aberta. A aprovação na loja não garante que o administrador do computador permita instalar. Não pedir senha Google nem contornar restrições administrativas.
- **Opção 2 — Extensão existente da Chrome Web Store:** pesquisar ferramenta confiável, verificar permissões, reputação, disponibilidade e compatibilidade atual com Google Flow antes de instalar; testar primeiro identificação do prompt, imagem e botão, sem consumir créditos. Não foi identificada nem validada uma extensão específica na loja nesta etapa.
- **Opção 3 — Automação na nuvem:** retomar o executor Modal já configurado em `wrangler.jsonc` (`MV_FLOW_EXECUTOR_URL`) e validar abertura, autenticação normal e interação com Flow; alternativa Cloudflare Browser Rendering. Teste isolado anterior no Cloudflare renderizou página HTML simulada, mas tentativa de abrir Flow recebeu HTTP 429, sem comprovação de login ou geração.
- **Restrição operacional atual:** computador usado pelo responsável não permite carregar extensão manualmente; apenas extensões disponíveis na biblioteca/loja, possivelmente ainda sujeitas a aprovação do administrador. Chrome Android não executa extensões desktop convencionais. O site Meu Vendedor, sozinho, não pode controlar abas do Flow por causa do isolamento do navegador.
- **Próxima decisão:** verificar se a política do computador permite instalar qualquer extensão da Chrome Web Store ou somente itens aprovados pela organização; investigar opções da loja. Se não permitir, priorizar executor remoto com autenticação válida. Não mexer na produção, não gastar créditos e não declarar automação funcional antes de teste real.
- **Status:** registro de alternativas somente; nenhuma extensão criada/instalada, nenhum vídeo gerado, nenhum deploy solicitado.

## 2026-11-14 — Corrigida confirmação não interativa de Edge Functions

- A execução protegida #130 aplicou as migrações de publicação e falhou na etapa `functions deploy publication-schedule`: o Supabase CLI 3.1.0 exigiu confirmação `--yes` por não haver terminal interativo no GitHub Actions.
- Adicionado `--yes` ao comando `functions deploy` do workflow, mantendo autenticação, validação, ambiente protegido e verificação pós-deploy.
- As tabelas `public.mv_publications` e `public.mv_publication_attempts` foram confirmadas no Supabase remoto. Cloudflare e Edge Function ainda exigem uma execução de implantação bem-sucedida.

## 2026-11-14 — Correção do dry-run de implantação #127

- A implantação protegida #127 foi aprovada e passou na validação, mas falhou no dry-run do Supabase CLI porque quatro migrações locais de publicação antecedem a última migração remota. O Supabase CLI exigiu `--include-all`.
- Atualizado `.github/workflows/ci-cd.yml` para usar `--include-all` tanto no dry-run quanto na aplicação, preservando a análise de migrações pendentes, o bloqueio de alto risco e a aprovação do ambiente `supabase-high-risk-migrations`.
- Nenhuma migração foi aplicada na execução #127; a próxima implantação precisa de novo disparo manual e aprovação protegida.

## 2026-11-14 — Revisão de segurança das migrações de publicação (sem aplicação remota)

- Endurecido `search_path` das duas funções `SECURITY DEFINER` do módulo de publicações para `pg_catalog, public, pg_temp`, mantendo `revoke` de acesso público e execução restrita ao `service_role`.
- Criados testes de regressão `tests/publication-migration-security.test.mjs` para verificar RLS, permissões, escopo das funções, processamento manual, cron e preservação dos destinos permitidos.
- As migrações pendentes de publicação permanecem **não aplicadas** em produção. As duas migrações de destinos continuam sendo detectadas como alto risco por `DROP CONSTRAINT` e exigem aprovação pelo fluxo protegido. O usuário solicitou revisão antes de autorizar a implantação.

## 2026-11-14 — Reconciliação do histórico de migrações remotas

- Recuperados diretamente de `supabase_migrations.schema_migrations` os SQLs aplicados no projeto Supabase `jzchlrvxdaffnrgbvabv` para Facebook OAuth (`20261113230009`), TikTok OAuth (`20261114101136`) e TikTok Sandbox (`20261114120045`).
- Adicionados os três arquivos de migração com os números exatos do histórico remoto. Removidas as versões locais duplicadas `20261113230000` e `20261114110000`, que não estavam aplicadas remotamente.
- Nenhum SQL de alteração foi executado no banco de produção durante essa reconciliação. A validação CI e a publicação permanecem etapas distintas.
- **Atenção:** migrações de publicação `20261112190000` e `20261112200000` continuam pendentes no Supabase e contêm `DROP CONSTRAINT`; a proteção de alto risco do pipeline não deve ser contornada. A tabela `public.mv_publications` ainda não existe no banco remoto, de modo que a migração anterior de agendamento deve ser aplicada na ordem prevista após revisão.
- A integração de geração automática do Google Flow ainda não está validada; não confundir login remoto com geração de MP4.

## 14/11/2026 — Tipagem das integrações Facebook/TikTok e Google Flow

Corrigidas as declarações TypeScript das respostas JSON em `facebook-connect`, `facebook-reels`, `tiktok-connect` e `tiktok-connect-sandbox`, mantendo os fluxos de OAuth, upload, credenciais e endpoints. Commits: `ada36d3`, `c9aca07`, `b7afac1`, `a7cefce`. O botão Google Flow já está ligado ao hub de Contas (`bd91cbb`, `549ae7a`), e o teste foi ajustado (`d97efa6`). Alterações enviadas diretamente à `main` do GitHub. Validação CI e publicação de produção ainda pendentes de confirmação; não declarar implantação no Supabase/Cloudflare sem verificar. O workflow exige disparo manual para publicar e possui controle de migrações de alto risco.

## 14/11/2026 — Google Flow visível em Contas

Implementado na branch principal: `AccountHub.tsx` importa e renderiza `GoogleFlowConnection` em **Contas → Lojas e redes**, com identidade visual (ícone de claquete), nome Google Flow, botão **Conectar / reabrir Flow**, verificação de conta/créditos, desconexão e opção de salvar sessão após confirmação. Commits de código: `bd91cbb` e `549ae7a`.

O componente e as rotas de backend já existiam; a alteração desta etapa é a exposição do mecanismo na interface e seu ícone. Ainda não há evidência de build, teste de login real ou deploy Cloudflare desta revisão. Nenhuma geração automática ou importação de MP4 foi adicionada. Não foram feitas alterações no Supabase ou em Secrets.

## 14/11/2026 — Declaração do responsável sobre autenticação no Google Flow

O responsável pelo Meu Vendedor declarou ser maior de idade e informou que fará pessoalmente o login no Google Flow usando conta Google de titular maior de idade e elegível. A declaração não substitui a validação pelo provedor e não constitui autorização para contornar verificações de idade, autenticação ou termos do serviço.

Objetivo: disponibilizar no Meu Vendedor um botão de conexão com autenticação autorizada. O componente `src/components/auth/GoogleFlowConnection.tsx` existe, mas sua inclusão na interface, publicação e testes reais permanecem pendentes. Nenhum acesso Google, geração de MP4 ou deploy é considerado comprovado por este registro.

Registro documental solicitado pelo responsável, sem mudança de código funcional, credenciais ou infraestrutura.

## 14/11/2026 — Registro consolidado da conversa: gerador de vídeos e integração externa

- **Direção atual:** o fluxo de campanhas de produto prioriza preparação de anúncios curtos para geradores externos de IA, em lugar de apresentar a montagem tradicional de fotos/clipes como fluxo principal. Componentes legados ainda existentes no repositório não devem ser descritos como funcionalidades atuais sem conferir as rotas e dependências.
- **Código inspecionado:** `src/components/videos/ProductCampaign.tsx` recebe produto, duração, roteiro, referência de apresentador (incluindo Ana) ou narração; `src/lib/campaign-generator-prompts.ts` adapta instruções para Google Flow, Dreamina e YouTube Create, preservando identidade e fala. Limites observados no adaptador: até 10 segundos por anúncio, 900 caracteres para YouTube Create e 4.000 para Dreamina. O link de YouTube Create aponta para orientação oficial do aplicativo móvel, não para editor web automatizado.
- **Commits relevantes de 14/11:** `343dcc7` (substituição do fluxo obsoleto de montagem), `444cd94` e `736c021` (prompt único e campanhas de 6–10 s), `34ae0d7` e `3f43796` (identidade canônica do personagem), `13cfc97` e `3087f8f` (limite Dreamina e testes). Estes registros não equivalem a comprovação de deploy.
- **Teste solicitado pelo responsável:** reutilizar imagens reais de produtos já existentes no Supabase e a imagem de referência da personagem Ana, preparar prompt de aproximadamente 8 segundos, enviar ao gerador externo por um mecanismo autorizado e verificar se retorna MP4 utilizável no histórico do Meu Vendedor.
- **Estado real da validação:** recuperação dessas imagens, envio ao Google Flow, geração real e recuperação do MP4 **não foram executados nem comprovados nesta conversa**. Testes prévios com arquivo sintético não comprovam integração com Google Flow.
- **Hipótese técnica discutida:** uma sessão de navegador remoto autenticada poderia, em princípio, reutilizar autorização válida da conta do usuário; porém login Google não concede automaticamente uma API de automação do Flow. Não armazenar senhas, copiar cookies, transferir tokens de sessão ou contornar verificações de idade/restrições do provedor. Não declarar viabilidade sem verificar método de acesso oficialmente permitido.
- **Publicação:** `src/lib/publication-package.ts` prepara conteúdo e instruções; Shopee Vídeos e outros destinos podem depender de postagem manual. Não afirmar publicação automática sem teste.
- **Pendências:** confirmar o fluxo realmente montado nas rotas, a situação dos componentes legados, as integrações autorizadas disponíveis, persistência dos vídeos gerados, testes de ponta a ponta e status de deploy Cloudflare/Supabase. Nenhuma alteração de código, Secrets ou produção foi autorizada por este registro.
- **Regra de documentação solicitada:** antes de fornecer ao responsável qualquer comando de commit/push manual no Codespace, atualizar `historico.md` com decisões, mudanças, testes, erros e pendências relevantes desta conversa; quando não houver acesso de escrita, fornecer o conteúdo a acrescentar e declarar explicitamente que o arquivo remoto ainda não foi atualizado.

## 13/11/2026 — Facebook Login for Business OAuth (implementação em andamento)

- Meta App ID 4694062620828917; Meta Configuration ID 1130763936339224 (identificador público da configuração, não é token); Página alvo Shopee baratinha, ID 1420652961139104.
- Implementado fluxo OAuth próprio: Edge Function `facebook-connect` POST `start/status/disconnect` autenticados por JWT Supabase e GET `/callback` com state aleatório de uso único, validade de 10 min e troca server-side do authorization code. O callback exige a Página configurada na lista de Páginas autorizadas e armazena token da Página cifrado AES-GCM com chave secreta. Não enviar tokens ao frontend.
- Migration `20261113230000_facebook_oauth_connections.sql` aplicada ao projeto Supabase; tabelas `facebook_oauth_states` e `facebook_page_connections` com RLS habilitado, sem grants para anon/authenticated. Verificação SQL confirmou RLS=true nas duas tabelas.
- `facebook-connect` ACTIVE v2 implantada no Supabase com `verify_jwt=false` **porque o callback OAuth da Meta não envia JWT**; cada ação POST autentica JWT dentro da função, e GET callback exige state único registrado no banco. Sem secrets completos, função responde `oauth_not_configured` (503).
- Frontend `PublicationCenter.tsx` atualizado na branch para mostrar Conectar/Desconectar Facebook e status. **Ainda não houve build, testes de navegador nem confirmação de deploy preview do frontend**.
- `facebook-reels/index.ts` atualizado **somente no GitHub** para preferir token cifrado associado ao usuário e manter fallback legado com UID allowlist. **Não implantar a nova versão de facebook-reels antes de testes e secrets; produção atual segue versão anterior.**
- URL EXATA para cadastrar em Meta → Facebook Login → Configurações → URIs de redirecionamento OAuth válidos:
  `https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/facebook-connect/callback`
- Secrets ainda exigidos no Supabase (não registrar valores em GitHub/chat): `META_APP_SECRET`, `META_LOGIN_CONFIG_ID=1130763936339224`, `META_OAUTH_RETURN_URL=https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/facebook-connect/callback`, `META_OAUTH_SITE_URL` (origem HTTPS do site onde deve voltar, preferencialmente preview para primeiro teste), `META_TOKEN_ENCRYPTION_KEY` (32 bytes criptograficamente aleatórios codificados em Base64). `META_APP_ID`, `META_PAGE_ID` e `META_GRAPH_API_VERSION` já usados na integração anterior, verificar existência sem expor valores.
- ATENÇÃO: houve exposição anterior de credenciais em captura de tela. Revogar/rotacionar credenciais afetadas e atualizar secrets; não copiar dados da captura nem colocá-los no código.
- Próximos passos: configurar secrets pelo painel Supabase, cadastrar URL OAuth na Meta, testar botão preview, callback, conexão, desconexão, expiração, isolamento entre contas e fluxo de publicação, executar suíte e só então implantar `facebook-reels` revisada e aprovar merge. Não afirmar que publicação está funcional sem teste real.

## 13/11/2026 — Central de Publicação assistida (branch de teste)

Branch `feat/publication-center-preview`, baseada na correção de Google Flow `fix/google-flow-external-video-button` (PR #6 ainda independente). Abaixo do gerador de vídeo de produto foi adicionada Central de Publicação com destinos Kwai, TikTok, Facebook e WhatsApp, nome do produto, URL de afiliado opcional, hashtags editáveis, copiar legenda, baixar vídeo e pacote TXT, escolher MP4/WebM externo e compartilhar arquivo via Web Share API quando o dispositivo suportar. A publicação final é manual; nenhum acesso às contas ou API de postagem foi criado. Links nas legendas não têm garantia de serem clicáveis. WhatsApp Status e Stories dependem de seleção no aplicativo de destino.

**Exportação MP4:** o renderizador existente usa MediaRecorder e já produz MP4 somente se suportado pelo navegador. Em navegadores que produzam WebM, o arquivo é identificado corretamente; não há conversão/transcodificação para MP4 nem renomeação enganosa. O pacote TXT é complementar ao arquivo de vídeo, não um ZIP. Sem banco, migrações, Edge Functions, novos serviços ou produção nesta branch. Testes e build devem ser confirmados na execução de prévia antes de merge.

## 13/11/2026 — Google Flow externo no gerador de vídeo

Decisão atual do responsável: manter a geração de vídeos interna como alternativa, mas oferecer **Abrir Google Flow** na aba **Vídeos → Vídeo de produto**, próximo a **Gerar vídeo do produto**. O usuário prepara e copia o prompt no Meu Vendedor, abre o site oficial do Flow em nova aba, gera e baixa o vídeo lá e retorna para adicioná-lo como clipe. **Não é uma integração automática nem uma conexão remota de conta.**

A conexão experimental de navegador remoto Google Flow foi retirada da interface **Google e redes** para não induzir o usuário a tentar o fluxo antigo. Os arquivos de backend foram preservados, sem executar a integração remota. Não houve alteração de banco, migrações, Edge Functions ou credenciais. O gerador local e o login Google permanecem intactos.

# Histórico da conversa — atualizado em 13/11/2026

## 13/11/2026 — Ordem Técnica 04: recuperação do login Google

### Escopo e diagnóstico

O responsável autorizou corrigir somente o login Google e preservar o acesso às ferramentas Google existentes, sem reorganizar interface, modificar Shopee/marketplaces/gerador de vídeos, alterar credenciais, aplicar migrations ou publicar. Antes da alteração, foram lidos integralmente os 52 Markdown versionados (52 integrais, 0 parciais, 0 não lidos), incluindo os documentos prioritários; `CONTINUAR_AMANHA.md` e este histórico foram relidos antes dos registros.

Em `google-auth.ts`, falha HTTP/rede na leitura de `/auth/v1/settings` já era classificada como `unavailable`, distinta de `disabled` (`external.google === false`). A regressão estava em `AuthForm.tsx`: tanto o botão de login como o de vinculação Google só permitiam OAuth no estado `enabled`, bloqueando tentativa após falha transitória, ainda que isso não provasse que o provedor estava desabilitado. Foi adicionada a regra `canAttemptGoogleSignIn`: permite tentativa em `enabled` e `unavailable`, mas não durante `loading` nem após confirmação `disabled`. A mensagem de indisponibilidade informa corretamente que o estado não pôde ser verificado e preserva a opção de tentar. Login por e-mail/senha, opção de seleção de conta, callback, PKCE e sessão não foram modificados.

### Acesso às rotas e ferramentas

- `AuthProvider` continua assinando `onAuthStateChange` e recuperando sessão com `getSession`; `src/lib/supabase/client.ts` continua com PKCE, persistência, renovação e detecção do retorno OAuth.
- `/contas` usa `AccountRedirect` para `/entrar#lojas`; `AccountHub` apresenta abas Acesso, Google e redes e Lojas. Google Flow e YouTube continuam incluídos na seção Google e exigem autenticação para suas ações.
- `VideoStudio` renderiza `GoogleNarration` para usuário autenticado. Os componentes e APIs de Flow, YouTube e áudio/narração não foram alterados. Isso confirma presença e caminhos no código, não conexão ou autorização remota atual.

### Arquivos e validação

Alterados somente `src/components/auth/AuthForm.tsx`, `src/lib/google-auth.ts` e `tests/google-auth.test.mjs`. Os testes de regressão verificam estados permitidos para tentativa, preservação do botão, PKCE/recuperação de sessão, redirect `/contas` e presença dos componentes Google na central.

- Testes focados de Google Auth, YouTube, Flow e central: **25/25 aprovados**.
- Suíte completa: **297/297 aprovados**, executada com `node --experimental-strip-types --test --test-concurrency=1 tests/*.test.mjs`.
- `npm run typecheck` e `npm run typecheck:edge`: aprovados.
- `npm run lint`: zero erros; quatro avisos preexistentes em controladores Kaggle.
- Build estático: 26 rotas em cópia temporária; o bundle contém a URL raiz `https://jzchlrvxdaffnrgbvabv.supabase.co`. A API do GitHub retornou **403** ao consultar a variável `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; a chave real não estava disponível. Foi usado um valor efêmero somente para verificar compilação/embedding, nunca como credencial nem evidência de funcionamento em produção. O binding Tailwind Linux ausente foi instalado em overlay temporário; nenhum manifesto ou lockfile foi alterado.
- `git diff --check`: aprovado.

### Configuração remota, publicação e pendências

A URL raiz do Supabase está fixada nos jobs de build de `.github/workflows/ci-cd.yml`. Não foi possível verificar a variável pública da chave por API GitHub (403), consultar a configuração atual de Auth/redirect allowlist no Supabase, fazer login real ou confirmar a configuração OAuth. Registros históricos registram estados diferentes do provedor em datas anteriores; não foram tratados como evidência atual. Portanto, a correção remove o bloqueio de interface causado por `unavailable`, mas não comprova login funcional em produção. O estado atual das ferramentas Google remotas continua não verificado.

Commit `aaa0c07` (`fix: allow Google OAuth after availability failures`) foi enviado a `origin/recovery/prepare-frontend-2026-11-13`. `package-lock.json` staged preexistente foi preservado e excluído. `main` não foi alterada. Nenhuma migration, escrita de banco, mudança de Secret/credencial, deploy de Edge Function ou deploy Cloudflare foi executado. A publicação continua pendente de validação remota e autorização expressa; manter o gate de migrations intacto.

## 13/11/2026 — correção do workflow protegido (Ordem Técnica 02)

### Escopo e preservação

O responsável autorizou corrigir o workflow manual de recuperação, executar preflight apenas local/read-only quando possível, testar os scripts e fazer commit/push somente em `recovery/prepare-frontend-2026-11-13`. Deploy, migrações, alterações de banco/credenciais e integração na `main` foram expressamente proibidos.

Antes das alterações desta ordem, a branch `recovery/prepare-frontend-2026-11-13` e `origin/recovery/prepare-frontend-2026-11-13` estavam em `7334998938e271870bfe214fb6d879a48068dd1d`; `origin/main` estava em `ae76a06ddd1d0467309f099999a83c33864c464f`. O registro anterior que apontava `41c7786` como ponta remota da branch estava desatualizado. O checkout local da branch `main` não foi alterado nesta ordem. `package-lock.json` já estava staged antes do trabalho e permaneceu staged, fora dos commits planejados.

### Correções realizadas

- `.github/workflows/frontend-recovery.yml`: o passo `Verify only compatible backend contracts` recebe explicitamente o `SUPABASE_ACCESS_TOKEN`, a URL raiz do projeto e a chave publicável.
- O environment `frontend-recovery` é consultado com `github.token` e permissão `contents: read`, mínima para um token com acesso de leitura ao repositório. A verificação exige revisores, `prevent_self_review` habilitado e `can_admins_bypass == false`; falha fechada se a API não permitir confirmar qualquer requisito. A consulta anterior do environment retornou 404 e a leitura das APIs de Variables/Secrets retornou 403. Isso não confirma se o environment existe/protegido nem a origem configurada da chave. A documentação oficial do endpoint GET environment indica acesso para leitores do repositório: https://docs.github.com/en/rest/deployments/environments#get-a-deployment-environment.
- A versão exata Supabase CLI `3.1.0` oferece `db query --remote --read-only --output-format json --file`; o workflow manteve esse método estritamente read-only. O SQL verifica metadados e não seleciona IDs de usuários ou valores de Secrets.
- O checker passa a recusar versão ausente/inválida de `marketplace` ou `youtube-connection`; versão numérica não é prova de SHA de origem. O rollback de Edge Functions exige input de SHA de origem verificado independentemente e alcançável em `main`. Nenhum SHA foi inventado.
- A chave pública é lida do GitHub Secret, com fallback para Actions Variable, sem ser impressa. O acesso remoto 403 impediu confirmar qual fonte está configurada.
- Criado `tests/frontend-recovery-workflow.test.mjs`; acrescentado caso para rejeitar versão de função desconhecida em `tests/check-recovery-compatibility.test.mjs`. O workflow continua sem aplicar migrations, sem função `publication-schedule` no allowlist e sem alterar/desativar o gate principal.

### Estado remoto observado e limitações

Não havia `SUPABASE_ACCESS_TOKEN`, senha do banco ou sessão Supabase CLI no ambiente local. A consulta sem autenticação à configuração Auth retornou HTTP 401. Assim, o contrato SQL não foi executado remotamente; não foram confirmados Google Auth, tabelas/RPCs, status/versões atuais das funções, presença de Secrets (inclusive `MV_CREDENTIAL_ENCRYPTION_KEY`), registros Shopee/YouTube ou compatibilidade da branch `main` com o backend atual. A fonte da chave publicável no GitHub e os revisores do environment também não foram confirmados. Os quatro migrations pendentes são evidência anterior do workflow principal, não uma nova leitura remota desta ordem. Nenhuma credencial foi exibida/alterada.

### Validação e estado de publicação

- Suíte completa: **295/295 testes aprovados**, executada com `node --experimental-strip-types --test --test-concurrency=1`; `npm test` não funciona com o Node 22.15.0 local porque o script passa `--test-isolation=none`.
- `npm run lint`: sem erros, com quatro avisos preexistentes nos controladores Kaggle.
- Os testes focalizados de workflow/checker e validação YAML foram executados; `git diff --check` foi verificado antes do commit. A CLI `3.1.0` confirmou as flags documentadas do comando SQL read-only.
- Testes locais não demonstram estado/compatibilidade remota. Não houve despacho do workflow, SQL remoto, migração, escrita, publicação de Edge Function ou Cloudflare, nem alteração de `main`.

**Commit e push:** `a4347fa815731997f22ae35f2664042213d29886` (`fix: correct protected recovery preflight`) foi enviado a `origin/recovery/prepare-frontend-2026-11-13`, contendo somente workflow, checker e testes. Os registros `historico.md` e `CONTINUAR_AMANHA.md` foram publicados em commits documentais separados. `origin/main` segue em `ae76a06`. A alteração staged preexistente de `package-lock.json` foi preservada e excluída. Não houve despacho do workflow. Aguardam-se acesso remoto de leitura e proteção verificável antes de qualquer futura publicação; a ordem não autoriza deploy.

## 13/11/2026 — preparação do workflow protegido de recuperação

### Objetivo e escopo

O responsável autorizou preparar um fluxo manual para restaurar frontend, Shopee e YouTube sem aplicar nenhuma das quatro migrations pendentes, sem alterar dados ou Secrets e sem desabilitar o gate do workflow principal. Não foi autorizado executar o workflow nem publicar. O workflow de produção existente permaneceu intacto.

### Verificações e limitações remotas

O checkout `main` e `origin/main` estavam alinhados no commit `ae76a06ddd1d0467309f099999a83c33864c464f`. Não foi possível confirmar por acesso remoto nesta sessão a existência atual de tabelas/RPCs, status/versões de Edge Functions, Secrets, conexões Shopee/YouTube ou o ambiente de aprovação. Registros anteriores indicam limitações de acesso administrativo, mas não foram tratados como observação atual. Não foram impressos nem modificados valores de credenciais. O build local usa chave fictícia e não valida autenticação de produção.

Código e migrations locais confirmam que `marketplace` usa conexões/segredos, produtos, sincronizações, links e RPCs Shopee; `youtube-connection` usa conexões/estados OAuth e RPCs de início/finalização/desconexão. Foi acrescentado um contrato SQL exclusivamente de leitura para verificar presença dos objetos necessários via `to_regclass`/`to_regprocedure`. A resposta agregada é somente booleana, sem IDs ou conteúdo de registros. Essa verificação está preparada para o Actions, mas não foi executada contra o Supabase real.

### Preparação

- Criado `.github/workflows/frontend-recovery.yml`, manual e restrito a `main`, com testes, lint, typechecks frontend/Edge, build estático, preflight remoto e upload do build validado.
- O pipeline preserva o gate principal, usa concorrência `meu-vendedor-production`, não aplica migrations e allowlista somente `marketplace` e `youtube-connection`, sem publicar `publication-schedule`.
- Antes de permitir o job de publicação, exige environment `frontend-recovery` com revisores obrigatórios, bloqueio de autoaprovação e bypass administrativo desativado. A existência/configuração real desse environment não pôde ser confirmada; a falta de proteção bloqueia a execução.
- O deploy Cloudflare usa o Worker existente e o runtime deve ser idêntico a um SHA-base fornecido e alcançável em `main`. O workflow captura deployment anterior e produz registro/artefato para rollback; a fonte de rollback das Edge Functions também deve ser um SHA verificado. Não há rollback automático nem identificação remota de versão nesta preparação.
- Criados `scripts/check-recovery-compatibility.mjs` e `scripts/recovery-schema-contract.sql`. O checker exige histórico compatível, ausência de migrations inesperadas, schema SQL Shopee/YouTube, Edge Functions ativas, nomes de Secrets obrigatórios e Google Auth habilitado; executa novamente o preflight antes e depois do deploy. Não lê valores de Secrets ou dados pessoais.
- Criado `tests/check-recovery-compatibility.test.mjs` com cenários de contrato ausente/falso, migration não permitida, função/Secret ausente e Google Auth desabilitado.
- Não houve alteração no gerador de vídeos, em `package-lock.json`, no workflow principal ou nos dados/credenciais existentes. O lockfile já estava staged antes do trabalho e foi preservado fora do escopo.
- Após conferir logs recentes, o workflow de recuperação foi ajustado para receber `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como GitHub Secret, em vez de Actions Variable, para evitar que o runner imprima o valor nos logs. A existência/configuração desse Secret não foi verificada. O pipeline principal ainda utiliza a variável preexistente e não foi alterado.

### Validação local e estado de produção

- 289 testes aprovados em Node 24; `npm run lint` sem erros e quatro avisos preexistentes nos controladores Kaggle.
- `npm run typecheck` e `npm run typecheck:edge` aprovados.
- Workflow YAML, checker JavaScript, `git diff --check` e leitura estática da consulta SQL somente leitura aprovados.
- Build estático isolado aprovado com 26 rotas e URL Supabase raiz; a chave de build era fictícia. O binding Linux opcional de Tailwind foi instalado apenas em diretório temporário após falha ambiental inicial.
- A suíte e o build locais não provam conexão, OAuth, estado de credenciais, compatibilidade do backend remoto ou versão publicada. Não houve query remota, migration, deploy, commit ou push até esta anotação.

O run recente [43437031422](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43437031422), no commit-base `ae76a06`, confirmou quatro migrations pendentes (`20261112180000`, `20261112180100`, `20261112190000`, `20261112200000`) e bloqueou no gate por alto risco nas duas últimas. O deploy não alcançou dry-run, aplicação ou publicação. Um push à `main` inicia o workflow principal automaticamente; por isso a preparação foi enviada a um branch dedicado, sem atualizar `main` nem iniciar pipeline de produção. Também foi constatado que o workflow principal imprime o valor da publishable key por ela estar configurada como variável; o valor não será repetido aqui. O workflow de recuperação passou a exigir o mesmo nome como Secret, mas essa configuração não foi verificada.

Commits `730d8776f60db79d8e7347542512e2a260173790` e `41c7786d1107463c66df8ce2ded3197253e19a5a` foram enviados ao branch `recovery/prepare-frontend-2026-11-13`, confirmado no remoto em `41c7786d1107463c66df8ce2ded3197253e19a5a`. `origin/main` permaneceu em `ae76a06`. O workflow manual só poderá ser executado depois de revisão e integração autorizada em `main`. `package-lock.json` staged preexistente foi preservado e não está incluído. Nenhuma migration, consulta de dados pessoais, alteração de Secret ou deploy foi executado. A recuperação permanece bloqueada até acesso/configuração remotos e nova autorização expressa.

## 13/11/2026 — URL Supabase do Actions e primeira versão de Automações

### Causa e correção do build

O log do Actions `43430717533` mostrou `NEXT_PUBLIC_SUPABASE_URL` terminando em `/rest/v1/`. O cliente Supabase e os endpoints de Auth/Functions precisam da raiz do projeto; a URL de REST impede compor corretamente esses endpoints e explica a falha transversal observada em login e integrações. A API pública na raiz retornou `external.google: true`, mas isso não valida OAuth real, Client ID/Secret, redirect allowlist nem uma sessão de usuário.

Em `.github/workflows/ci-cd.yml`, os jobs de validação e deploy agora usam a raiz conhecida `https://jzchlrvxdaffnrgbvabv.supabase.co` em vez de `vars.NEXT_PUBLIC_SUPABASE_URL`. A publishable key continua sendo exigida da variável GitHub. A API GitHub retornou 403 ao consultar variables/secrets; portanto não foi possível confirmar se o valor remoto atual ainda está malformado e não houve alteração de configurações ou credenciais externas. Esta mudança corrige a URL dos builds executados por esse workflow sem modificar o Secret/Variable remoto.

### Automações disponibilizadas com limites explícitos

`src/app/automacoes/page.tsx` e `src/components/automations/AutomationWorkspace.tsx` substituem a página placeholder por uma primeira interface funcional sobre a sincronização Shopee existente. A página consulta o endpoint de status sem expor segredo, distingue falha/estado desconhecido da ausência confirmada de credencial, mostra última sincronização/erro e habilita a sincronização manual somente quando uma credencial está confirmada. A atualização manual reutiliza a ação existente de sincronização por usuário.

O Worker está configurado no código para acionar o cron marketplace a cada 30 minutos; a Edge Function seleciona no máximo duas conexões com sincronização antiga por invocação. A execução agendada da versão atual em produção não está confirmada, portanto a interface deixa isso explícito. Publicações continuam assistidas, aguardando ação manual; o backend depende das quatro migrations pendentes e de publicação aprovada. Não há postagem social automática nem motor genérico de regras “quando X, faça Y”. O gerador de vídeos IA não foi modificado e esta página não inicia serviços pagos.

### Validação e estado de produção

- 279 testes passaram, zero falhas/cancelamentos, usando `node --experimental-strip-types --test --test-concurrency=1 tests/*.test.mjs`. O script `npm test` do checkout contém `--test-isolation=none`, opção incompatível com o Node 22.15.0 instalado; o manifesto não foi alterado.
- `npm run typecheck`, `npm run typecheck:edge`, ESLint focalizado e `git diff --check` passaram. `npm run lint` também passou sem erros, com quatro avisos preexistentes nos controladores Kaggle.
- `npm run build:pages` passou em cópia temporária com configuração pública fictícia e 26 rotas, incluindo `/automacoes`. O binding Linux opcional `@tailwindcss/oxide-linux-x64-gnu@4.3.4` ausente foi colocado apenas numa sobreposição temporária; o diretório de build foi removido depois. Nenhuma dependência/lockfile do projeto foi alterada e o `.next` existente foi preservado.
- Nenhum teste visual, login OAuth real, sincronização autenticada real ou verificação de cron em produção foi feito. A build local não prova publicação.
- O código e os dois registros de continuidade foram commitados como `85e562c30c4deef891b0f42af65047d5a8f6c8f9` (`fix: restore Supabase URL and automation access`) e enviados a `origin/main`. A base era `main` em `9ebb661`. A alteração preexistente staged de `package-lock.json` foi preservada e excluída do commit.

O run [43436587851](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43436587851) passou validação, testes, lint, typechecks, build e preflight de credenciais. `Inspect remote migration history` confirmou quatro migrations pendentes (`20261112180000`, `20261112180100`, `20261112190000`, `20261112200000`) e bloqueou por alto risco em `20261112190000_publication_tiktok_destination.sql` e `20261112200000_publication_social_destinations.sql`. A saída exigiu revisão independente, revisores obrigatórios no ambiente `supabase-high-risk-migrations` e workflow manual aprovado. O passo de revisão do plano, aplicação, verificação do histórico, deploy das Edge Functions e deploy/verificação do Worker foram todos pulados. Não houve migration, escrita de produção, alteração de Variable/Secret nem deploy. Não aprovar workflow de alto risco, contornar o gate, aplicar migrations manualmente ou fazer deploy alternativo sem autorização específica e ambiente protegido.

O timeout de inatividade do Codespace é 30 minutos; não foi alterado e não há garantia de execução contínua se o ambiente suspender.

## 13/11/2026 — auditoria de login, Shopee, Pinterest e central de conexões

### Ajuste final dos controles Shopee

Na revisão dos controles, foi separado o fluxo **Verificar conexão** da atualização opcional das credenciais. O estado desconhecido mantém o formulário bloqueado; um segredo confirmado encaminha para verificação mesmo se a lista de conexões estiver temporariamente vazia, evitando sugerir recadastro por divergência transitória entre consultas. A substituição de credenciais só fica disponível explicitamente como opcional quando o backend confirma que o segredo está armazenado. Teste focado cobre conexão existente/ausente e credencial confirmada/ausente/desconhecida.

Validação final após esse ajuste: **279 testes aprovados**, `npm run typecheck`, `npm run typecheck:edge` e build estático isolado com 26 rotas aprovados; `npm run lint` sem erros e quatro avisos preexistentes nos controladores Kaggle; `git diff HEAD --check` aprovado. O build usou apenas configuração pública fictícia em cópia temporária, removida ao final. Nenhuma credencial foi consultada ou alterada. O código foi commitado e enviado conforme registrado abaixo; não houve deploy.

### Objetivo e preservação

O responsável pediu investigar regressões percebidas no login/cadastro, exibição das credenciais Shopee, informações Pinterest e cobertura da central, preservando todos os dados existentes. Solicitou ainda testes, atualização documental e publicação somente após as verificações e aprovações exigidas. Durante a auditoria não houve consulta/escrita de produção, alteração de Secret, migração ou deployment. Commit e push foram feitos depois da validação local, sem alterar configuração remota.

Antes das alterações, os 52 Markdown versionados foram lidos integralmente no contexto (52 integrais, 0 parciais, 0 não lidos). O registro completo de caminhos e a leitura prioritária estão anotados na continuidade desta sessão. `main`/`origin/main` estavam em `b233ef2`; nenhuma worktree paralela estava ativa. Esse hash descreve a base anterior à correção; o commit e push posteriores estão registrados abaixo. A alteração preexistente de `package-lock.json` está staged e foi preservada, não faz parte desta entrega.

### Resultado da auditoria

- **Login:** `AuthForm`, `AuthProvider`, `AccountButton`, `AccountHub`, cliente Supabase e rotas mantêm código de e-mail/senha, cadastro, recuperação, OAuth Google com PKCE e sessão. A revisão Git não identificou commit que removesse esses fluxos. Foi identificada uma causa concreta para uma janela sem botão: `AccountButton` retornava somente “Carregando conta…” enquanto o provedor verificava a sessão. A alteração local mantém **Entrar** visível durante essa verificação. Isso corrige o comportamento no código atual, mas não prova sozinho a causa do sintoma no Worker publicado.
- **Google:** a configuração OAuth remota, client/redirect allowlists e habilitação atual do provedor não foram consultadas. `GOOGLE_OAUTH_SETUP.md` registra confirmação de login, enquanto `CONTA_E_ESTRATEGIA_GOOGLE.md` e `INTEGRACOES.md` contêm estados de provedor desabilitado/pendente; são registros históricos contraditórios. Nenhuma versão deve ser escolhida como estado atual sem consulta autorizada.
- **Shopee:** as credenciais permanecem cifradas no backend por usuário conforme o código e a sync com payload nulo preserva o segredo existente. Não havia acesso ao banco/API Supabase para confirmar se a credencial específica continua armazenada, sua associação ou status. O histórico também contém contagens diferentes de conexões em datas distintas. A UI anterior não distinguia a existência do segredo cifrado do status de conexão, podendo apresentar “não conectada” quando a consulta falhava; isso não comprova que as credenciais foram apagadas.
- **Pinterest:** o código disponível prepara Pins e oferece conclusão manual; não foi encontrado fluxo OAuth/API de publicação na central. O histórico registra rejeição anterior da solicitação do aplicativo, mas credenciais, tokens, autorização e estado atual de aprovação não foram consultados. A interface local separa preparação manual de aprovação/conexão não confirmada.
- **Central:** a tela reunia alguns conectores e controles, mas não apresentava o inventário e as pendências de todas as plataformas previstas. A central local agora lista e descreve serviços/conectores existentes: Google Login/Flow, Gemini, YouTube, Shopee Affiliate/Video, Amazon, Mercado Livre, AliExpress, SHEIN, Magalu, TikTok/TikTok Shop, Pinterest, Instagram, Facebook, Kwai, ElevenLabs e outros provedores de vídeo/voz. Não foram criadas APIs fictícias: controles de conexão só permanecem onde há fluxo no código; outros cartões informam dependências ou ação manual.

### Arquivos alterados nesta auditoria local

- `src/components/auth/AccountButton.tsx`: mantém “Entrar” visível durante a leitura da sessão.
- `src/components/auth/AccountHub.tsx`, `src/components/integrations/IntegrationCard.tsx`, `src/components/marketplace/ConnectionControls.tsx`, `src/lib/account-integrations.ts`: amplia o inventário da central, exibe etapas concluídas/pendentes e estados desconhecidos sem converter erro de consulta em ausência de credenciais; controles Shopee separam verificação de atualização opcional.
- `src/lib/marketplace-status.ts`, `src/lib/marketplace.ts`, `src/types/marketplace.ts`, `supabase/functions/marketplace/index.ts`, `supabase/functions/marketplace/_shared/status.ts`: ação autenticada e somente de leitura para estado Shopee; a consulta filtra pelo usuário da sessão e verifica existência do registro secreto sem retornar ciphertext/secret.
- `tests/account-status.test.mjs`: cobre falha/estado desconhecido, resposta sem segredo, inventário da central e decisão de ação sem sugerir recadastro quando o estado não foi confirmado.
- `tests/marketplace-database.test.mjs`: assegura que sync sem novos dados de credenciais preserve o segredo cifrado existente.
- `next.config.ts`, `tests/next-config.test.mjs`: impede build estático quando as variáveis públicas Supabase necessárias estão ausentes e testa esse bloqueio.
- `historico.md` e `CONTINUAR_AMANHA.md`: este registro e a continuidade. `package-lock.json` não foi modificado por esta tarefa.

### Validação

- Suíte final: **279 testes passaram, 0 falharam/cancelaram** (`node --experimental-strip-types --test --test-concurrency=1 tests/*.test.mjs`).
- `npm run typecheck` e `npm run typecheck:edge`: aprovados.
- `npm run lint`: zero erros; quatro avisos preexistentes nos controladores Kaggle.
- `npm run build:pages`: aprovado em cópia temporária isolada, com configuração pública fictícia e **26 rotas** estáticas. O primeiro ensaio isolado revelou binding opcional Linux do Tailwind ausente do `node_modules`; a dependência exata foi instalada apenas em sobreposição temporária e removida após o build. O `.next` preexistente do checkout não foi sobrescrito.
- `git diff --check`: aprovado.
- Não houve validação em navegador visual desktop/celular, login Google real, consulta de usuário/credenciais no banco ou teste autenticado de produção. Os testes e build local não comprovam que o Worker publicou o código nem que as credenciais específicas existam.

### Commit, Actions e estado de produção

Commit `67d1dfefbc060ef57e09d4ba75cd6fb17b76fe29` (`fix: preserve existing integration credentials`) criado na `main` e enviado a `origin/main`; `git ls-remote` confirmou o mesmo hash. Contém 16 arquivos de código, testes e documentação. A alteração preexistente de `package-lock.json` foi deliberadamente excluída e permanece staged no checkout.

O push iniciou [GitHub Actions 43430269723](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43430269723). O job de testes, lint, typecheck e build passou integralmente. O job de deploy passou pelo preflight de configuração/credenciais e pela instalação da CLI; `Inspect remote migration history` encontrou quatro migrations pendentes (`20261112180000`, `20261112180100`, `20261112190000`, `20261112200000`) e classificou como alto risco as duas últimas, que alteram constraints. O guard encerrou com exit code 1 e instruiu revisão independente, configuração de revisores obrigatórios no ambiente `supabase-high-risk-migrations` e execução manual com a entrada de aprovação. **Não houve dry-run, aplicação de migration, publicação de Edge Function ou deploy Cloudflare**; essas etapas foram puladas.

A atualização documental desse resultado foi enviada no commit `893c423`. Seu run [GitHub Actions 43430717533](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43430717533) repetiu o mesmo resultado: testes/lint/typecheck/build passaram e o guard bloqueou antes de qualquer dry-run, migration ou deploy pelas mesmas quatro pendências e duas migrations de alto risco. Nenhuma publicação ocorreu nesse run.

### Configuração remota e pendências

As variáveis públicas Supabase não estão no ambiente local e não existe `.env.local`; os valores não foram exibidos nem fabricados como configuração de produção. O run [GitHub Actions 43349901129](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43349901129) passou testes, lint, typecheck e build, mas parou antes de qualquer migração/deploy porque o gate encontrou migrations de alto risco pendentes. Não foi feita aplicação manual nem aprovação para contornar o gate. A versão Cloudflare observada na auditoria foi `239a29ad-f5dc-4085-9b17-49fb5702576b`, sem associação confirmada ao commit esperado; as rotas públicas `/`, `/entrar` e `/contas` responderam HTTP 200, sem teste de sessão no navegador.

Próximos passos: (1) obter acesso administrativo/autorizado ao Supabase existente e consultar, sem revelar segredo, a configuração OAuth e a existência/associação/status da conexão Shopee; não solicitar recadastro antes; (2) conferir credenciais e aprovação Pinterest no portal autorizado; (3) revisar independentemente as migrations e configurar a aprovação protegida sem remover gates; (4) só então executar o workflow manual aprovado, verificar migrations e publicar Edge Functions/Worker; (5) confirmar hash/versão ativa e testar desktop/celular com conta autorizada. Até essas verificações, o estado real de credenciais Shopee, OAuth atual, aprovação Pinterest e publicação desta correção permanece **não verificado**. O commit foi enviado, mas a correção não está publicada em produção.

## 13/11/2026 — diagnóstico e correção do GitHub Actions

### Estado confirmado antes da correção

Branch `main` estava em `c52c757`, alinhada a `origin/main`; havia somente `alteracoes-pendentes.patch` não rastreado, preservado com SHA-256 `5e483d41749a208cb78dd3585afb83037c109e4ef7670e3da05ba81e62c49bb1`. A worktree `feat/public-catalog-five-marketplaces` foi preservada e o Worker/projeto `gilfinanceiro` não foi alterado.

No Actions [43341403130](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43341403130), testes, lint, typecheck, build e `Require deployment credentials and single Cloudflare publisher` passaram. O job de deploy falhou em `Inspect remote migration history`, com exit code 1. O log exibiu apenas `Target: project ...`, sem a mensagem de erro do comando. Os registros anteriores de CI que atribuíam falhas às variáveis públicas ficaram desatualizados para esse run: o preflight e as validações concluíram com sucesso.

### Compatibilidade da CLI e causa diagnosticável

Foi instalada/consultada a versão exata `supabase@3.1.0` e inspecionada a implementação pública dessa tag. `migration list --remote --password --output-format json`, `db push --remote --password --skip-vault --dry-run/--yes` e `functions deploy/list --remote` com `--use-api` são argumentos válidos. Não foi identificada incompatibilidade de comando/flag que explique o exit code 1.

O workflow redirecionava stdout de `migration list --output-format json` diretamente para o arquivo de dados do guard. Como mensagens estruturadas de erro também podem estar nesse canal, o log não preservava o diagnóstico. A causa remota real (por exemplo, conexão, autenticação ou permissão) não pode ser inferida sem a saída completa; o código atualizado expõe o texto sanitizado na próxima execução. O valor de `SUPABASE_DB_PASSWORD` agora é passado explicitamente para `migration list` e `db push`.

### Correção, segurança e validação

Criado `scripts/run-supabase-cli.mjs`: executa a CLI sem shell, captura stdout/stderr, redige `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, valores em URLs PostgreSQL e padrões de bearer/password/token, e devolve o código de saída original. As chamadas de `migration list`, `db push`, `functions deploy` e `functions list` no workflow usam o wrapper. Criado `tests/run-supabase-cli.test.mjs`, incluindo falha simulada com stdout/stderr, preservação do código de saída e verificação de redação. `scripts/check-pending-migrations.mjs` não foi enfraquecido nem alterado.

O gate de risco permanece: `approve_high_risk_migrations` default `false`; migrations de alto risco falham fechadas e exigem execução manual no ambiente protegido. Nenhuma aprovação automática foi adicionada. Não foram lidos, redefinidos ou registrados valores de Secrets; nenhuma migration ou publicação remota foi executada por comandos locais.

Validação focalizada: 8 testes passaram (cinco existentes do guard e três cenários novos de redação/captura); ESLint nos dois arquivos JS novos, `node --check`, parse YAML e `git diff --check` passaram. A CLI `3.1.0` foi executada através do wrapper; consultas de `--help` confirmaram os argumentos listados.

### Commit, push e estado da execução

Commit `a208ffa` (`fix: surface sanitized Supabase CLI errors`) criado na `main` e enviado a `origin/main`; contém somente `.github/workflows/ci-cd.yml`, `scripts/run-supabase-cli.mjs` e `tests/run-supabase-cli.test.mjs`. No primeiro acompanhamento após o push, ainda não aparecia run novo na listagem do Actions. O despacho manual solicitado com `approve_high_risk_migrations=false` foi recusado pela API GitHub com HTTP 403: `Resource not accessible by integration`. Naquele momento, a mensagem detalhada do Supabase CLI ainda não estava disponível; o resultado posterior está registrado abaixo.

**Pendente após o primeiro acompanhamento:** executar `Validate and deploy production` por uma identidade autorizada, sem habilitar aprovação de alto risco; a situação foi atualizada pelo novo run abaixo. Se uma migration for classificada como alto risco, interromper antes de aplicar; requer revisão independente e ambiente protegido. Após eventual sucesso, conferir migration history, Edge Functions, deployments/rota Worker e registrar o run. Variáveis/Secrets não devem ser compartilhados no chat.

### Resultado da nova execução — run 43343806058

O push de `a208ffa` iniciou [Actions 43343806058](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43343806058). O job de testes, lint, typecheck e build concluiu com sucesso. No job de deploy, credenciais/preflight e instalação da CLI também passaram, mas `Inspect remote migration history` falhou com `DbConnectError`; a mensagem sanitizada informa `FATAL: password authentication failed for user "postgres"` (`SQLSTATE 28P01`).

**Conclusão comprovada:** a conexão PostgreSQL rejeitou a senha apresentada pela configuração do workflow. O log não revela se o Secret `SUPABASE_DB_PASSWORD` está desatualizado, incorreto ou apresenta outra divergência; o valor mascarado não foi acessado. Nenhuma senha foi redefinida/alterada. A falha ocorreu antes do dry-run e da aplicação; migrações, Edge Functions e Cloudflare foram pulados, portanto nenhum deploy foi confirmado.

**Próximo passo:** responsável autorizado deve conferir, em ambiente protegido, se `SUPABASE_DB_PASSWORD` corresponde à senha atual do banco Supabase e atualizar a configuração somente se necessário e autorizado. Não compartilhar o valor. Depois, reexecutar o workflow mantendo a aprovação de migrations de alto risco desmarcada; se o guard identificar risco alto, interromper para revisão independente. O despacho manual anterior retornou HTTP 403 (`Resource not accessible by integration`).

### Correção env-only e resultado do Actions — 13/11/2026

O responsável informou que, com Supabase CLI 3.1.0, `--password "$SUPABASE_DB_PASSWORD"` falha na autenticação PostgreSQL (`SQLSTATE 28P01`), enquanto a variável `SUPABASE_DB_PASSWORD` configurada no ambiente, sem o argumento, autentica e lista o histórico. O log do run anterior também trazia a orientação da própria CLI para configurar corretamente essa variável. A opção `--password` existe na CLI; a correção foi usar o método de ambiente que funciona neste workflow, não alterar credenciais.

Antes da alteração, foram lidos integralmente os 52 Markdown versionados; `main` estava em `88e39ec`, alinhada a `origin/main`. O arquivo não rastreado `alteracoes-pendentes.patch` (SHA-256 `5e483d41749a208cb78dd3585afb83037c109e4ef7670e3da05ba81e62c49bb1`) e a worktree paralela foram preservados.

O commit `54da8811aedf8d7701756bc4b2f234939a7f0d6e` (`fix: use Supabase DB password from environment`) removeu `--password` das duas chamadas `migration list` e das chamadas `db push` de dry-run/aplicação em `.github/workflows/ci-cd.yml`. O Secret `SUPABASE_DB_PASSWORD` continua mapeado como variável de ambiente nas etapas, sem ser lido ou alterado. `tests/run-supabase-cli.test.mjs` foi ajustado para confirmar que a senha chega ao subprocesso pelo ambiente, não por argumentos, e permanece redigida. Não houve alteração em `scripts/check-pending-migrations.mjs`, na regra de risco ou na aprovação manual protegida.

A versão exata `supabase@3.1.0` foi executada localmente para consultar `migration list`, `db push`, `functions deploy` e `functions list --help`. Foram confirmadas as opções usadas; nenhuma consulta remota foi feita localmente. Validação: 8 testes focados aprovados; ESLint dos scripts/testes, sintaxe Node, parse YAML e `git diff --check` aprovados.

O push iniciou [Actions 43349901129](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43349901129), no commit `54da8811aedf8d7701756bc4b2f234939a7f0d6e`. Testes, lint, typecheck, build e preflight passaram. A autenticação env-only funcionou e foram listadas quatro migrações pendentes: `20261112180000`, `20261112180100`, `20261112190000` e `20261112200000`. O guard classificou duas como alto risco porque removem constraints: `20261112190000_publication_tiktok_destination.sql` e `20261112200000_publication_social_destinations.sql`. A execução parou no gate, antes do dry-run e de qualquer aplicação. As etapas de aplicação, deploy de Edge Functions e Cloudflare foram puladas.

**Resultado e limite:** a falha de autenticação foi resolvida pelo uso da variável de ambiente; a publicação de produção não foi concluída. Nenhuma migration foi aplicada, manual ou automaticamente; nenhum deploy foi confirmado; nenhuma senha/Secret foi redefinido ou alterado; nenhuma aprovação foi dada. Qualquer continuação exige revisão independente das duas migrations e, se expressamente autorizada, execução pelo ambiente manual protegido. `gilfinanceiro` não foi alterado.

## 12/11/2026 — compartilhamento social assistido e destinos de agendamento

### Estado e preservação

O pedido ampliou a publicação assistida para TikTok, Kwai, Facebook Stories e Pinterest, com Web Share API, fallback de download/cópia, múltiplos destinos, confirmação manual e validação local antes de commit/push/deploy. Antes da alteração, foram lidos os 52/52 Markdown versionados (integral, sem arquivos parciais/não lidos); os documentos de continuidade, publicação, Supabase e Cloudflare foram relidos antes da atualização documental. No início, `main` estava em `603edacb4c00f369b4a0943792abb916b67a057e`, alinhada a `origin/main`, com apenas `alteracoes-pendentes.patch` não rastreado; esse patch e a worktree separada foram preservados.

`HISTORICO.md` ainda indica 49 Markdown e um status de publicação antigo. Isso é divergência histórica já identificada e não foi usado para inferir o estado atual.

### Implementação local

- Adicionados destinos de agendamento `kwai` e `facebook_stories` à interface e à validação da Edge Function; mantém um registro independente por destino.
- Criada a migration aditiva `20261112200000_publication_social_destinations.sql` para ampliar a constraint existente.
- UI de composição e painel agora orientam escolha de rede, exibem sites oficiais comuns e permitem copiar título, descrição, hashtags e link. Web Share só tenta enviar o arquivo quando `navigator.canShare` aceita os dados; download/cópia ficam disponíveis como alternativa.
- Erro ao obter mídia privada é informado. Cancelar o seletor não registra handoff. Um handoff aparece como “Compartilhamento iniciado”, sem alterar o status para publicado. Só confirmação expressa marca “Publicada · confirmada manualmente”.
- Painel mostra lembrete local quando há itens vencidos e explicita que nenhum e-mail/push foi enviado. Nenhuma API de postagem foi adicionada; nenhum post real foi criado.
- O guard classifica a troca da constraint como alto risco. Aplicação exige revisão independente, ambiente protegido e execução manual aprovada; não foi feita tentativa remota sem credenciais/permissão.

### Validação e publicação

`npm test`: 269 aprovados, zero falhas/cancelamentos. Testes focalizados de scheduling/DB/share: 14 aprovados. `npm run typecheck`, `npm run typecheck:edge`, `npm run lint` (0 erros, 4 avisos preexistentes), `npm run build:pages` e `git diff --check` passaram. A falha PGlite anterior não se reproduziu na suíte completa.

Antes do push, o Actions [43297591878](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43297591878) falhou em `Require public Supabase build variables`. O push dos commits de código `e714aafd2e77d5e9ef9524ba3637303558ff52b2` e documentação `bbb58452594592209b26fda616d028f616f2c9c9` foi confirmado em `origin/main`. O run pós-push [43323420497](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43323420497) falhou no preflight: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` estavam vazias; testes, lint, typechecks/build e deploy foram skipped. As atualizações documentais foram enviadas nos commits `74b6338ee0f59bf51df0d9844ecda9fb0db06554` e `9877860efb367123929fefd3abbaa8ada63209ee`; os runs [43323617456](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43323617456) e [43323745985](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43323745985) repetiram a mesma falha e pularam validações e deploy. Variables/Secrets GitHub retornam HTTP 403. Wrangler lista a identidade da conta, mas não permite listar o Worker (`403`); Supabase remoto não foi revalidado (histórico anterior: HTTP 401). Workers Builds também não foi confirmado. Nenhuma migration, Edge Function, Worker ou rede social foi publicada; versões remotas não foram declaradas.

**Pendente:** configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, Secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; verificar/desligar Workers Builds e configurar `CLOUDFLARE_WORKERS_BUILDS_DISABLED=true`; configurar aprovadores do ambiente de alto risco. Só então reconciliar/aplicar migration, publicar Edge Function/Worker e validar rotas/versões.

Commit da implementação: `e714aafd2e77d5e9ef9524ba3637303558ff52b2` (`feat: add assisted social sharing`). A documentação foi commitada em `bbb58452594592209b26fda616d028f616f2c9c9` (`docs: record assisted sharing and blockers`), `74b6338ee0f59bf51df0d9844ecda9fb0db06554` (`docs: record post-push Actions blocker`) e `9877860efb367123929fefd3abbaa8ada63209ee` (`docs: record repeated Actions preflight failure`); todos foram enviados a `origin/main`. Nenhum deploy de produção foi realizado.

## 12/11/2026 — configuração inicial de CI/CD GitHub Actions

### Instrução e auditoria

O responsável pediu publicação automática a cada push em `main`, com validações obrigatórias, migrações Supabase antes das Edge Functions e do frontend no Worker `meu-vendedor`, verificação remota, prevenção de concorrência e aprovação para alterações de alto risco. Antes de editar, foram lidos integralmente os **52/52 Markdown versionados** (0 parcial, 0 não lido), incluindo esta documentação e `CONTINUAR_AMANHA.md`. `AGENTS.md`, `.github/copilot-instructions.md`, documentação de publicação/infraestrutura, arquivos de configuração e histórico Git foram consultados. Foi confirmado que não havia `.github/workflows/`; `.node-version` fixa Node 24, `package-lock.json` está versionado, o build usa `npm run build:pages`, o Worker configurado chama-se `meu-vendedor` e `supabase/config.toml` tem ID local diferente do ID remoto solicitado. O workflow passa explicitamente `jzchlrvxdaffnrgbvabv`.

`git status` inicialmente mostrou `main` sincronizada com `origin/main` em `57aafc58024b4b1ba7f6ae64fd60435ff9f74a19`, preservando o arquivo não rastreado `alteracoes-pendentes.patch` e a worktree independente `feat/public-catalog-five-marketplaces`. Não foi alterada a outra worktree. A consulta de Secrets/variáveis/ambientes e proteção de branch na API GitHub foi recusada com HTTP 403. A tentativa autorizada de cadastrar as duas variáveis públicas via `gh variable set` também não concluiu; nenhuma variável foi modificada. O registro anterior da Cloudflare informa HTTP 403 ao consultar Workers Builds, portanto não foi possível excluir um publicador concorrente.

### Configuração preparada

- Criado `.github/workflows/ci-cd.yml`: push em `main` e disparo manual, concorrência serializada sem cancelar publicação em andamento, permissões GitHub mínimas (`contents: read`), Node da `.node-version`, `npm ci`, testes, lint, typechecks frontend/Edge e build estático antes do deploy.
- Deploy ordenado: conferir migrações remotas → aplicar somente pendentes com a CLI Supabase fixada, sem atualizar Vault/seed/roles → publicar `publication-schedule` e funções alteradas → publicar no Worker existente → verificar listagem remota de funções, deployments Wrangler e rota pública.
- Criado `scripts/check-pending-migrations.mjs` com teste focado em `tests/check-pending-migrations.test.mjs`: reconcilia versões locais/remotas, falha fechado em divergências, sinaliza operações de alto risco e exige revisão manual; verificação posterior exige zero pendências.
- Secrets requeridos: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Variáveis Actions públicas Supabase requeridas: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Também são gates `CLOUDFLARE_WORKERS_BUILDS_DISABLED=true` após verificação manual e, na via de alto risco, ambiente protegido com revisores obrigatórios e `SUPABASE_HIGH_RISK_APPROVAL_CONFIGURED=true`.
- Atualizados `SUPABASE.md`, `CLOUDFLARE.md`, `PUBLICACAO.md` e `CONTINUAR_AMANHA.md` para descrever o pipeline, permissões, gates e limites.

### Validação e estado de publicação

A documentação oficial Supabase foi consultada para os comandos `migration list`, `db push --skip-vault`, deploy/listagem de funções e requisitos de autenticação. A documentação oficial Cloudflare confirma uso de API token e Account ID, com permissão **Edit Cloudflare Workers** restrita à conta. CLI Supabase `3.1.0` confirmou opções `--remote`, `--dry-run`, `--skip-vault`, `--yes` e saída estruturada; nenhum acesso remoto foi executado. Nenhuma credencial foi configurada, nenhum Secret foi revelado, nenhum deploy/migration remoto foi iniciado e nenhum commit/push desta tarefa foi feito neste registro.

Validações concluídas localmente: YAML do workflow e comandos Bash embutidos parseados; cinco testes focados do guard passaram; `git diff --check` passou; opções CLI verificadas; `npm run typecheck`, `npm run typecheck:edge` e `npm run build:pages` passaram. A suíte global registrou 267 testes, mas foi interrompida no teste preexistente de claim de áudio PGlite: “Promise resolution is still pending but the event loop has already resolved”; 44 passaram e 223 foram cancelados. O teste PGlite isolado reproduziu o bloqueio. `npm run lint` recebeu SIGTERM em duas tentativas e não concluiu. Não classificar a suíte completa ou o lint como aprovados.

Commit `65d50b437b4d54cd932feab51dccca034e8c8278` (`ci: add guarded Supabase and Cloudflare pipeline`) foi enviado a `origin/main`; o hash remoto foi confirmado. A execução real [GitHub Actions 43297281147](https://github.com/warllemedicao/Meu-Vendedor/actions/runs/43297281147) terminou **failure**: `Require public Supabase build variables` falhou porque faltam `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Instalação, testes, lint, typechecks/build em Actions foram skipped; o job Supabase/Cloudflare também foi skipped. Nenhuma migração, função ou versão Worker foi publicada.

**Estado até esta anotação:** configuração enviada, mas CI/CD **não concluído**. Além das duas variáveis públicas, não foi possível confirmar os Secrets de deploy, o ambiente com revisores obrigatórios ou o estado Workers Builds; o esquema e histórico remoto do Supabase não foram consultados. Não declarar CI/CD funcionando até todos os pré-requisitos estarem configurados e uma execução real completa concluir com evidência remota. Não houve tentativa de contornar acesso negado.

## 12/11/2026 — reforço da leitura obrigatória de todos os Markdown

### Objetivo e instruções recebidas

O responsável solicitou tornar explícita e obrigatória, em cada nova conversa/tarefa, a leitura contextual integral de todos os Markdown versionados antes de alterações de código. Não pular documentos por nome; priorizar `CONTINUAR_AMANHA.md` e os históricos; manter registro por caminho e informar limitações; verificar novamente documentos relacionados e código antes de cada modificação; e informar contradições antes de prosseguir. Scripts permanecem auxiliares e não substituem a leitura. A configuração não deve afirmar que abrir/reabrir a página dispara a leitura automaticamente.

### Leitura feita antes da edição

`git ls-files` encontrou 52 Markdown versionados, incluindo subpastas. O conteúdo integral dos 52 arquivos foi lido em contexto, com leituras em lotes e releituras dos registros prioritários. O conjunto consultado foi: `.github/copilot-instructions.md`, `AGENTS.md`, `AJUSTES_ESTUDIO.md`, `ARQUITETURA.md`, `ARQUITETURA_VIDEO_SINCRONIZADO.md`, `ASSISTENTE_DE_DIVULGACAO.md`, `ATUALIZACOES.md`, `AUDITORIA_GERADOR_VIDEO.md`, `AUDITORIA_IA.md`, `CATALOGO_APIS.md`, `CLOUDFLARE.md`, `CONECTORES.md`, `CONTA_E_ESTRATEGIA_GOOGLE.md`, `CONTINUAR_AMANHA.md`, `CREDITOS_DA_CONTA.md`, `DIVULGACAO_INTEGRADA.md`, `ELEVENLABS.md`, `ENTREGA_VIDEO_COM_PRODUTO.md`, `ESCOPO.md`, `GALERIA_DE_PRODUTO.md`, `GOOGLE_FLOW_E_YOUTUBE.md`, `GOOGLE_OAUTH_SETUP.md`, `GOOGLE_TTS.md`, `HISTORICO.md`, `IMAGENS_SINCRONIZADAS.md`, `INTEGRACOES.md`, `MAGIC_HOUR_AJUSTES.md`, `MARKETPLACES.md`, `MODO_GRATUITO.md`, `MOVIMENTO_E_PRODUTO.md`, `ONEMIN_E_KAGGLE.md`, `PESQUISA_MOVIMENTO_E_PRODUTO.md`, `PESQUISA_VIDEO_ALTERNATIVAS.md`, `PUBLICACAO.md`, `QUALIDADE_VISUAL_E_PROMPTS.md`, `README.md`, `REFERENCIAS_APRESENTADORES.md`, `REFERENCIA_FORNECEUP.md`, `SALDOS_E_GOOGLE_FLOW.md`, `SHOPEE_VIDEO_PUBLICACAO.md`, `SOLUCAO_VIDEO_KAGGLE.md`, `SUPABASE.md`, `TESTES_KAGGLE_E_CAPACIDADE.md`, `TESTE_ANA_MIDI.md`, `TESTE_HUNYUAN_DESTILADO.md`, `TESTE_NO_APP.md`, `VIDEOS_IA.md`, `VIDEO_DE_PRODUTO.md`, `YOUTUBE_CONEXAO.md`, `executors/google-flow/README.md`, `executors/kaggle/README.md` e `historico.md`. Registro: **52 integral, 0 parcial, 0 não lido**.

### Contradição identificada e escopo

`HISTORICO.md` mantém uma contagem histórica de 49 documentos e descreve a publicação da entrega de Produtos/ChatGPT como “em andamento”; o inventário Git atual tem 52 Markdown e os registros/commits mais recentes mostram a configuração anterior já enviada. Essa inconsistência foi informada antes da edição. Por escopo, `HISTORICO.md` não foi modificado; não se usou esse estado antigo para inferir o estado atual do código ou do remoto.

### Alterações e validação

Atualizados somente `AGENTS.md` e `.github/copilot-instructions.md` para exigir a leitura real no contexto do agente, inclusive subpastas e documentos considerados irrelevantes; registrar estado por arquivo; não iniciar alterações de código antes da leitura inicial; reler documentos pertinentes e verificar código/Git antes de cada mudança; e declarar limites/contradições sem alegar conclusão falsa. Reforçado que script de terminal e abertura da página não constituem leitura automática. `historico.md` e `CONTINUAR_AMANHA.md` recebem este registro; não foram alterados código, funcionalidades ou scripts.

Validação: `scripts/read-project-docs.sh` listou 52 Markdown versionados e concluiu 52/52 leituras sem exibir conteúdo; `bash -n scripts/read-project-docs.sh`, validação JSON de `.devcontainer/devcontainer.json` e `git diff --check` passaram. O teste do script apenas verificou o auxiliar, não substituiu a leitura contextual acima. O `postStartCommand` e os demais arquivos de inicialização foram preservados. Nenhum deploy, operação paga ou acesso a serviço remoto foi necessário.

Commit de configuração: `a37958f` (`docs: require contextual reading of all Markdown`), com push confirmado para `origin/main`. Este registro de confirmação será publicado em commit documental separado.

## 12/11/2026 — instruções permanentes e leitura documental no Codespace

Configurados `AGENTS.md` e `.github/copilot-instructions.md` para orientar o Copilot a identificar e ler os Markdown versionados antes de cada tarefa, priorizando a continuidade, o histórico e os documentos centrais. As instruções exigem declarar os documentos efetivamente lidos quando houver limites de contexto, verificar Git/código antes de inferir implementação ou publicação, resumir o estado antes de alterações, preservar trabalho local/worktrees, não alterar `gilfinanceiro`, não registrar credenciais e atualizar os dois registros de continuidade após tarefas de desenvolvimento autorizadas.

Criado `scripts/read-project-docs.sh`, que enumera os Markdown rastreados pelo Git e lê os arquivos acessíveis sem exibir conteúdo. O relatório lista os nomes e o resultado da leitura; portanto, não imprime segredos que eventualmente estejam no conteúdo. O script e `postStartCommand` foram configurados em `.devcontainer/devcontainer.json`. O comando é somente leitura: não modifica arquivos, cria commits, faz deploy ou aciona operações pagas.

O estado inicial tinha 50 arquivos Markdown versionados; com os dois novos arquivos de instruções, o total passa a 52. Nesta sessão foram lidos integralmente `README.md`, `ARQUITETURA.md`, `SUPABASE.md`, `CLOUDFLARE.md`, `PUBLICACAO.md`, `INTEGRACOES.md` e `CONTINUAR_AMANHA.md`; o trecho inicial recente de `historico.md` foi consultado, mas o histórico completo e os demais Markdown não foram incorporados ao contexto desta sessão por limite de contexto. O script passou em `bash -n`, o `devcontainer.json` foi analisado como JSON válido e, com os novos arquivos incluídos no índice Git, a execução leu 52/52 documentos sem exibir seus conteúdos. O estado Git antes/depois da varredura foi igual e o hash de `alteracoes-pendentes.patch` permaneceu igual. Nenhum deploy, operação paga ou alteração remota foi executado. O script de terminal não equivale à leitura pelo Copilot; a leitura contextual completa continua sendo responsabilidade do agente em cada nova sessão.

## 12/11/2026 — auditoria, adaptação isolada e limpeza documental

### 1. Objetivo da atividade

Reconciliar as alterações locais antigas relacionadas a Produtos e catálogo público com a versão mais recente de `origin/main`, preservando a implementação atual de `ProductsWorkspace`, o fluxo manual do ChatGPT e as alterações locais até haver autorização. Depois, a pedido do responsável, restaurar somente seis arquivos antigos no checkout local da branch `main`, mantendo backup e worktree de adaptação. Por fim, consolidar no histórico o trabalho, resultados e pendências. Não implementar funcionalidades além da adaptação já autorizada; não publicar durante estas tarefas.

### 2. Instruções recebidas do responsável

As mensagens abaixo são reproduzidas integralmente quando o conteúdo original estava disponível. A primeira referência a um anexo não contém o texto anexado no histórico recuperável.

#### Mensagem inicial sobre sete alterações e publicação

> Analise as 7 alterações locais que ainda aparecem no GitHub Codespaces.
>
> Execute primeiro `git fetch origin` e depois verifique `git status -sb` e `git diff`.
>
> Identifique quais alterações pertencem à implementação solicitada: unificação dos marketplaces na aba Produtos e integração manual com ChatGPT.
>
> Verifique também a exclusão de `TEXTO_CHAMADO_SHOPEE.txt`. Não confirme essa exclusão sem verificar sua finalidade.
>
> Antes de qualquer commit:
>
> 1. Leia os arquivos Markdown relevantes.
> 2. Revise as diferenças dos 7 arquivos.
> 3. Execute os testes necessários.
> 4. Verifique se existem credenciais ou dados sensíveis.
> 5. Confirme se essas alterações já foram implementadas em outro commit.
> Se as alterações forem válidas, apresente um resumo e solicite minha autorização para realizar commit e push.
>
> Verifique se a Edge Function `catalog` precisa ser atualizada no Supabase e se o Worker `meu-vendedor` está publicado com o código mais recente no Cloudflare.
>
> Não descarte alterações, não faça reset e não publique nada antes de concluir a análise.
>
> Informe exatamente o que está pendente.

#### Mensagem original de anexo

`#attachment:Pasted text #1`

Mensagem original não disponível para recuperação integral.

#### Missão de reconciliação recebida

> MISSÃO: RECONCILIAR ALTERAÇÕES LOCAIS DO MEU VENDEDOR SEM PERDER FUNCIONALIDADES
>
> Analise as seis alterações locais pendentes e os seis commits existentes em origin/main.
>
> Não faça commit, push ou deploy antes de concluir o diagnóstico.
>
> 1. Preserve as alterações locais em um backup seguro, sem sobrescrever arquivos.
> 2. Identifique a versão mais recente de cada componente.
> 3. Mantenha ProductsWorkspace como interface principal da página Produtos.
> 4. Verifique quais funcionalidades de Mercado Livre e AliExpress podem ser aproveitadas da implementação local.
> 5. Não substitua componentes recentes por versões antigas.
> 6. Confirme se a integração manual com ChatGPT continua funcionando.
> 7. Verifique se o catálogo público pode ser ampliado sem utilizar credenciais privadas de usuários.
> 8. Confirme quais mudanças precisam ser aplicadas à função catalog-public do Supabase.
> 9. Execute testes de integração, TypeScript, lint e build.
> 10. Apresente um relatório das alterações que devem ser mantidas, descartadas ou adaptadas.
> Não altere o Worker gilfinanceiro.
>
> Ao terminar o diagnóstico, solicite autorização antes de modificar a branch main ou publicar qualquer componente.

#### Autorização para adaptação isolada

> isolated

Autorizou preparar a adaptação em branch/worktree isolado, sem modificar `main`, sem commit/push e sem deploy.

#### Pedido de auditoria dos seis arquivos

> ## MISSÃO — AUDITORIA DOS ARQUIVOS PENDENTES NO CONTROLE DO CÓDIGO-FONTE
> Antes de limpar, confirmar ou descartar qualquer alteração, preciso que você analise os seis arquivos modificados que continuam aparecendo no Controle do Código-Fonte do VS Code.
>
> **Arquivos pendentes:**
>
> 1. `src/app/produtos/page.tsx`
> 2. `src/components/marketplace/PublicProductCatalog.tsx`
> 3. `src/lib/navigation.ts`
> 4. `supabase/functions/catalog/_shared/public-catalog.ts`
> 5. `supabase/functions/catalog/_shared/types.ts`
> 6. `tests/public-catalog.test.mjs`
>
> ### ETAPA 1 — VERIFICAR SE A LÓGICA JÁ EXISTE
> Para cada arquivo:
>
> - Explique o que foi modificado e qual funcionalidade essa alteração pretendia implementar.
> - Verifique se a mesma funcionalidade já existe na versão mais recente de `origin/main`.
> - Identifique o commit que implementou essa funcionalidade, quando existir.
> - Verifique se a lógica também está contemplada na adaptação que você está preparando na worktree isolada.
> - Diferencie código já implementado, código parcialmente implementado e código ainda necessário.
>
> ### ETAPA 2 — ANALISAR OS RISCOS
> Para cada arquivo, responda:
>
> 1. O que acontece se descartarmos a alteração local?
> 2. Alguma funcionalidade deixará de funcionar?
> 3. Existe risco de perder integração com Shopee, Amazon, Mercado Livre, AliExpress, TikTok Shop ou ChatGPT?
> 4. O que acontece se confirmarmos a alteração antiga em um novo commit?
> 5. Existe risco de conflito, regressão, erro de compilação ou incompatibilidade com a arquitetura atual?
> 6. Essa alteração é necessária para o funcionamento da nova adaptação?
>
> ### ETAPA 3 — APRESENTAR UMA TABELA COMPARATIVA
> Monte uma tabela contendo:
>
> - Nome do arquivo.
> - Funcionalidade da alteração local.
> - Situação na `origin/main`.
> - Situação na worktree isolada.
> - Risco de descartar.
> - Risco de incluir.
> - Recomendação: manter, adaptar ou descartar.
>
> ### ETAPA 4 — CONCLUSÃO
> Responda objetivamente:
>
> - Os seis arquivos antigos podem ser restaurados para o estado do Git sem perda de funcionalidades?
> - A lógica deles já está implementada na versão mais recente ou na nova adaptação?
> - Existe alguma alteração que ainda precisamos aproveitar antes de limpar?
> - Qual é o procedimento mais seguro para deixar o Controle de Código-Fonte limpo?
> - Os backups existentes são suficientes para recuperar as alterações caso seja necessário?
>
> **REGRAS IMPORTANTES:**
>
> - Continue preservando a adaptação na worktree isolada.
> - Não exclua, restaure ou modifique os seis arquivos pendentes.
> - Não execute commit, push, merge ou deploy.
> - Não modifique a branch `main`.
> - Não altere o Worker `gilfinanceiro`.
> - Não apresente suposições como funcionalidades já implementadas: verifique no código e nos testes.
> - Se a implementação atual ainda não estiver concluída, informe claramente o que falta.
>
> **Neste momento, quero apenas o diagnóstico. Não execute nenhuma limpeza sem minha autorização.**

#### Autorização de limpeza controlada

> Autorizo a limpeza controlada dos seis arquivos antigos da branch main local, conforme o diagnóstico apresentado.
>
> Antes de executar:
>
> 1. Confirme novamente a integridade do backup externo e da worktree `feat/public-catalog-five-marketplaces`.
> 2. Verifique se não surgiram novas alterações nos seis arquivos desde a auditoria.
> 3. Confirme que todas as funcionalidades necessárias desses arquivos foram preservadas na worktree.
> Se todas as verificações passarem:
>
> 1. Restaure exclusivamente os seis arquivos antigos no checkout da main local.
> 2. Preserve os backups e todos os demais arquivos.
> 3. Não modifique a worktree isolada.
> 4. Não faça commit, push, merge ou deploy.
> 5. Não atualize a main local para origin/main nesta etapa.
> 6. Não altere o Worker gilfinanceiro.
> Ao concluir, apresente o resultado de `git status --short` da main e da worktree, confirmando quais arquivos continuam pendentes.
>
> Se houver qualquer divergência, interrompa a operação e solicite autorização.
>
> Aguarde minha próxima autorização antes de atualizar a main ou publicar o projeto.

#### Pedido desta atualização documental

> # MEU VENDEDOR — ATUALIZAR HISTÓRICO E CONSOLIDAR RELATÓRIOS
> **Repositório:** `warllemedicao/Meu-Vendedor`
> **Branch principal:** `main`
> **Arquivo de destino:** `historico.md`
>
> ## MISSÃO
> Registrar no arquivo `historico.md` o histórico completo e verificável dos trabalhos realizados nesta sessão, incluindo as instruções recebidas, relatórios produzidos, alterações no código, testes, decisões e pendências.
>
> **Não iniciar novas funcionalidades nesta etapa.**
>
> ### ETAPA 1 — VERIFICAR O ESTADO DO GITHUB
>
> 1. Consultar `git status`, branch atual, commits recentes e worktrees existentes.
> 2. Verificar se o trabalho anterior foi concluído, commitado, enviado ao GitHub e publicado.
> 3. Identificar alterações locais pendentes e possíveis conflitos.
> 4. Não descartar alterações sem verificar sua origem.
> 5. Preservar backups existentes.
>
> ### ETAPA 2 — RECUPERAR OS RELATÓRIOS E AS INSTRUÇÕES
> Consultar:
>
> - Histórico disponível da conversa com o agente.
> - Instruções e prompts recebidos.
> - Relatórios técnicos produzidos.
> - Commits e alterações realizadas.
> - Resultados de testes, lint, TypeScript e build.
> - Registros de publicação no Supabase e Cloudflare, quando existirem.
> Registrar as instruções e mensagens **integralmente quando o conteúdo original estiver disponível**.
>
> Quando uma mensagem não puder ser recuperada, registrar somente o que for comprovável, indicando claramente:
>
> `Mensagem original não disponível para recuperação integral.`
>
> Não inventar conversas, relatórios, resultados ou comandos.
>
> ### ETAPA 3 — ATUALIZAR `historico.md`
> Criar uma seção datada de **12/11/2026**, preservando todo o conteúdo anterior.
>
> Organizar o registro com:
>
> 1. Objetivo da atividade.
> 2. Instruções recebidas do responsável.
> 3. Relatórios do Copilot.
> 4. Arquivos criados, modificados ou excluídos.
> 5. Alterações implementadas.
> 6. Testes executados e resultados.
> 7. Commits e branches envolvidos.
> 8. Publicações realizadas ou pendentes.
> 9. Problemas encontrados e soluções.
> 10. Pendências e próximos passos.
> Registrar também:
>
> **AliExpress**
>
> - O responsável iniciou o cadastro de aplicativo na categoria API de afiliados.
> - O portal apresentou a mensagem: "As informações do seu perfil não foram aprovadas".
> - A consulta de progresso mostra a etapa atual `Under Review`.
> - A criação do aplicativo ainda não foi concluída.
> - App Key, App Secret e Tracking ID não foram confirmados.
> - Não declarar a integração comercial como funcional.
> **Segurança**
>
> - Nunca registrar senhas, tokens, App Secrets ou credenciais privadas.
> - Não expor dados sensíveis em relatórios ou commits.
>
> ### ETAPA 4 — VERIFICAR CONSISTÊNCIA
> Conferir se o histórico corresponde ao estado real do repositório.
>
> Distinguir explicitamente:
>
> - Implementado.
> - Testado.
> - Publicado.
> - Pendente.
> - Não verificado.
> Não declarar como publicado algo que exista somente em uma branch ou worktree local.
>
> ### ETAPA 5 — SALVAR NO GITHUB
> Se não houver conflitos ou alterações de terceiros que impeçam a operação:
>
> 1. Atualizar somente `historico.md`.
> 2. Revisar o diff.
> 3. Criar commit específico para a documentação.
> 4. Enviar ao GitHub na branch apropriada, respeitando a situação atual das branches.
> 5. Não realizar deploy no Supabase ou Cloudflare, pois esta tarefa é exclusivamente documental.
> Caso a branch principal não possa ser atualizada com segurança, informar o bloqueio e não forçar push, merge ou descarte.
>
> ### RELATÓRIO FINAL
> Informar:
>
> - Branch utilizada.
> - Commit criado e seu hash.
> - Confirmação do push.
> - Localização da nova seção no `historico.md`.
> - Quais mensagens e relatórios foram recuperados integralmente.
> - Quais informações não puderam ser recuperadas.
> - Situação atual do trabalho anterior.
> - Pendências para a próxima etapa.
> **Não encerrar apenas com alterações locais. O objetivo é deixar o histórico atualizado e salvo no GitHub, quando for seguro fazê-lo.**

### 3. Relatórios produzidos pelo Copilot

**Diagnóstico inicial de marketplace:** identificou `97102cf` como commit que já reunia a página Produtos em `ProductsWorkspace` e o fluxo manual ChatGPT. A exclusão de `TEXTO_CHAMADO_SHOPEE.txt` não foi confirmada; o arquivo foi restaurado na atividade anterior. O relatório concluiu que a expansão pública local não estava conectada à interface mais recente e não recomendou publicar sem adaptação.

**Relatório de reconciliação:** identificou seis commits à frente em `origin/main`, preservou o patch local, comparou os adaptadores/autenticação e concluiu que o endpoint adequado para vitrine pública era `catalog-public`, separado do catálogo privado `catalog`. Indicou que a vitrine pública não deveria usar credenciais de usuários e que credenciais/aprovações comerciais reais ainda faltavam.

**Relatório da adaptação isolada:** a worktree `feat/public-catalog-five-marketplaces` foi criada em `97102cf`. A página inicial e `/dashboard` mantiveram as três fontes existentes; somente Produtos passou a oferecer as fontes públicas Shopee, Amazon, TikTok Shop, Mercado Livre e AliExpress. A adaptação alterou UI, `catalog-public`, tipos, testes e documentação; manteve `ProductsWorkspace`, os catálogos privados autenticados e a integração manual ChatGPT. O endpoint não foi implantado e não houve uso de credenciais comerciais reais.

**Auditoria arquivo a arquivo:** recomendou descartar o diff antigo da rota e navegação, e aproveitar/adaptar os trechos de catálogo público, tipos e testes somente na implementação isolada. Registrou riscos de reintroduzir `CommerceHub` como página principal e de expandir inadvertidamente a vitrine inicial.

**Relatório da limpeza autorizada:** backup externo e `alteracoes-pendentes.patch` tinham SHA-256 idêntico (`5e483d41749a208cb78dd3585afb83037c109e4ef7670e3da05ba81e62c49bb1`). O diff dos seis arquivos coincidia com o backup e passou em `git apply --reverse --check`. Só os seis caminhos foram restaurados; o patch local permaneceu. A worktree isolada ficou inalterada.

As respostas anteriores completas não estão todas disponíveis neste contexto após o resumo de conversa. Os fatos acima são os itens recuperáveis e corroborados pelo estado Git, pelo checkpoint da sessão e pelos resultados registrados.

### 4. Arquivos, commits e branches

- **Branch principal:** antes da atualização documental, checkout local `main` estava no commit `989d346`, seis commits atrás de `origin/main`, sem alterações rastreadas e com o arquivo não rastreado `alteracoes-pendentes.patch`.
- **Atualização segura da base:** `git fetch origin` confirmou `origin/main` em `97102cf`; `main` era ancestral direto, sem commits locais exclusivos. `git merge --ff-only origin/main` avançou a branch sem conflito até `97102cf`. Esse fast-forward trouxe os seis commits publicados; não foi feito merge de divergência nem descarte.
- **Commits remotos relevantes:** `fd00cf2` (adaptadores e catálogo privado), `4b84b47` (diretório compartilhado/campanhas manuais), `ebfb35f` (registro de marketplaces) e `97102cf` (ProductsWorkspace e integração manual ChatGPT), além de `43cf4a7` e `988b80b` para Pinterest/política de privacidade.
- **Worktree isolada:** branch `feat/public-catalog-five-marketplaces`, base `97102cf`, alterações não commitadas. Também existe `feat/public-catalog-mercado-aliexpress`, apontada para `97102cf`, sem worktree ativo. Nenhum commit foi criado nessas branches nesta sessão.
- **Arquivos da adaptação isolada:** `CATALOGO_APIS.md`, `ESCOPO.md`, `src/components/marketplace/ProductsWorkspace.tsx`, `src/components/marketplace/PublicProductCatalog.tsx`, `supabase/functions/catalog/_shared/public-catalog.ts`, `supabase/functions/catalog/_shared/types.ts` e `tests/public-catalog.test.mjs`.
- **Arquivos antigos restaurados no checkout local:** `src/app/produtos/page.tsx`, `src/components/marketplace/PublicProductCatalog.tsx`, `src/lib/navigation.ts`, `supabase/functions/catalog/_shared/public-catalog.ts`, `supabase/functions/catalog/_shared/types.ts` e `tests/public-catalog.test.mjs`.
- **Backup preservado:** `alteracoes-pendentes.patch` e o backup externo `Meu-Vendedor-local-changes-2026-11-12.patch`, iguais no SHA-256 já registrado. Nenhum arquivo de backup foi sobrescrito ou removido.
- **Integração manual ChatGPT:** código em `ManualChatGPTPrompt`, `manual-chatgpt.ts`, `useManualPromptDraft` e usos em ProductCampaign/estúdios permanece em `origin/main` desde `97102cf`; inclui briefing sanitizado, cópia/abertura manual e rascunho local. Não envia dados automaticamente ao ChatGPT.
- **Worker `gilfinanceiro`:** não modificado.

### 5. Alterações implementadas na worktree

**Implementado localmente, ainda não publicado:** a interface Produtos fornece Mercado Livre e AliExpress pela lista `platforms` do `PublicProductCatalog`, sem substituir ProductsWorkspace. A interface pública inicial mantém Shopee/Amazon/TikTok Shop. `catalog-public` usa providers existentes e configuração central `MV_PUBLIC_CATALOG_CONFIG`; não seleciona conta, sessão ou segredo de usuário. A configuração requer um acesso de serviço autorizado para Mercado Livre e aplicação aprovada para AliExpress. Links pessoais de afiliado não são fabricados; parâmetros de rastreamento são removidos da saída pública.

**Testes acrescentados:** configuração ausente não inventa catálogo; casos positivos simulados para Mercado Livre e AliExpress verificam credenciais de serviço, ausência de encaminhamento do token visitante e remoção de rastreio. Esses mocks validam contrato local, não autorização comercial nem disponibilidade real dos provedores.

### 6. Testes e problemas encontrados

Na validação da worktree isolada:

- Primeira execução direcionada de testes de catálogo: 13 aprovados e 5 falharam; TypeScript Edge encontrou iteração sobre o mapa de campos sem indexação pela plataforma.
- Correção aplicada: validação passou a iterar `fields[platform]`.
- Reexecução direcionada: 18/18 testes passaram; TypeScript Edge passou.
- `npm test`: 255/255 testes passaram.
- `npm run typecheck`: passou.
- `npm run typecheck:edge`: passou.
- `npm run lint`: zero erros; quatro avisos preexistentes em `executors/kaggle/ana_midi_controller.ts`, `ana_six_controller.ts` e `research_controller.ts`.
- `npm run build:pages`: passou; build estático gerou 26 rotas.
- `git diff --check`: passou.

Os resultados acima foram produzidos para a worktree isolada em `origin/main` com a adaptação não publicada. Não são evidência de acesso comercial real, nem de teste de implantação.

### 7. Publicações e situação externa

- **Código da adaptação:** não commitado, não enviado ao GitHub e não implantado.
- **Supabase:** o handler local correto para ampliar a vitrine é `catalog-public` (`supabase/functions/catalog-public/index.ts` importa o handler compartilhado). Não foi feito deploy. No último diagnóstico registrado, o endpoint hospedado não aceitava Mercado Livre/AliExpress (`invalid_platform`); as fontes públicas existentes retornavam `catalog_not_configured` sem configuração central. Esse estado remoto não foi revalidado nesta atualização documental.
- **Cloudflare Worker `meu-vendedor`:** nenhum deploy nesta sessão. O estado/versão atual não foi verificado novamente; um identificador citado em documentação anterior é registro histórico, não confirmação atual.
- **Worker `gilfinanceiro`:** sem alteração e sem publicação.
- Os deployments históricos de outras funcionalidades descritos em seções anteriores permanecem como registros da época, não como afirmação de versão atual.

### 8. Segurança

Não registrar nem versionar senhas, tokens, App Secrets, chaves de API ou credenciais privadas. A configuração da vitrine ampliada só pode receber acessos centrais autorizados para esse uso; não copiar tokens privados de usuários. Os testes usam valores fictícios. Nenhuma credencial real foi lida ou adicionada durante esta tarefa.

### 9. AliExpress — informação comunicada pelo responsável

Em 12/11/2026, o responsável informou que:

- iniciou o cadastro de aplicativo na categoria API de afiliados;
- o portal apresentou: **“As informações do seu perfil não foram aprovadas”**;
- a consulta de progresso mostra a etapa atual `Under Review`;
- a criação do aplicativo ainda não foi concluída;
- App Key, App Secret e Tracking ID não foram confirmados.

Consequentemente, **a integração comercial AliExpress não está confirmada como funcional**. A existência de adaptador e testes simulados não equivale a aprovação, credenciais, chamada comercial real ou publicação. Esse estado do portal foi informado pelo responsável e não foi verificado independentemente nesta tarefa.

### 10. Pendências e próximos passos

1. A adaptação de catálogo público permanece somente na worktree isolada; requer revisão/autorização antes de integrar.
2. Aguardar resolução da análise do perfil e conclusão do cadastro de aplicação AliExpress; confirmar credenciais pelo canal seguro, nunca no chat ou Git.
3. Confirmar acesso de serviço Mercado Livre autorizado para vitrine pública; nunca reutilizar token privado de usuário.
4. Confirmar autorização/licença das fontes e configurar somente segredos centrais permitidos.
5. Após autorização separada, publicar `catalog-public` e o frontend/Worker apropriado, executar smoke tests reais e verificar as versões hospedadas. Não publicar `catalog` privado como substituto da função pública.
6. Nenhuma operação de publicação ou deploy foi autorizada por este registro documental.

### 11. Estado Git desta atualização documental

O `git fetch origin` mostrou `main` local ancestral direto de `origin/main` (`989d346` → `97102cf`) e sem commits locais exclusivos. Foi feito fast-forward somente, sem conflito. Após o fast-forward, permaneceu o backup não rastreado `alteracoes-pendentes.patch`; a worktree de adaptação não foi alterada. Esta seção documenta que o arquivo é o único conteúdo planejado para o commit documental; hash do commit e resultado do push devem ser informados no relatório final da execução.

## 11/11/2026 — Mercado Livre: divulgação manual e Secret de API futura

Adicionada página `/mercado-livre` para inserir o link oficial gerado no portal Mercado Livre, título, ID e foto autorizada do produto, aproveitando o editor `ProductCampaign` já existente para roteiro, vídeo, narração e publicação. A publicação Pinterest é preparada para revisão; não há postagem automática nem geração artificial de links. Não confundir o ID do produto com link de afiliado. Sem acesso à API, não há catálogo automático nem confirmação de comissão.

O Secret futuro `MERCADO_LIVRE_API` é lido somente na função autenticada `catalog`, em JSON `{"userId":"UUID_REAL","accessToken":"TOKEN_OFICIAL","categoryId":"MLB..." }`. A configuração pré-existente em `MV_CATALOG_ACCOUNTS` tem precedência. Nenhum Secret real foi criado nem credenciais inseridas; a função ainda precisa de publicação, testes e permissão oficial da API. Alterações na branch de PR #4, não na produção.

## 11/11/2026 — pré-configuração AliExpress (proposta em branch, sem publicação)

Solicitação: deixar a integração pronta enquanto o cadastro AliExpress Afiliados permanece em análise. O adaptador de consulta `aliexpress.affiliate.hotproduct.query` já existia; não houve acesso comercial real nem teste com credenciais.

Alterações nesta branch: rota autenticada de consulta `/aliexpress` via componente RemoteCatalog, link em Configurações e alias de Secret Supabase **`ALIEXPRESS_API`** para a função privada `catalog`. O valor esperado é um JSON contendo `userId` (UUID real do Supabase Auth), `appKey`, `appSecret` e `trackingId`; somente a conta autenticada cujo UUID corresponda pode consultar. O mapa privado existente `MV_CATALOG_ACCOUNTS` tem precedência para a mesma conta. Valores ausentes ou inválidos não ativam a API; não versionar credenciais. Não confundir com `MV_PUBLIC_CATALOG_CONFIG` e não expor produtos/credenciais de afiliado em vitrine pública.

**Atualização nesta branch:** adicionada operação autenticada `affiliate_link` que solicita link à API oficial, valida URL HTTPS do AliExpress e não inventa tracking. Na interface, cada produto pode gerar/copiar link e abrir o criador de Pin do Pinterest para revisão manual. Sem credenciais não há chamada real nem garantia de formato de resposta; testes de contrato pendentes.\n\n**Limitações:** cadastro ainda pendente; não há App Key/Secret/Tracking ID aprovados. Consulta não é geração de link de comissão; geração oficial de links, conexão por consentimento, publicação e integração com vídeo ainda precisam ser implementadas e validadas. Nenhuma geração de vídeo/GPU deve ser retomada sem autorização. Branch não implantada no Supabase ou Cloudflare. Testes de build/integração ainda não executados nesta sessão. As mudanças anteriores de política de privacidade e meta de verificação Pinterest constam dos PRs #2 e #3, respectivamente, e não foram registradas anteriormente neste histórico.

## 11/11/2026 — requisitos oficiais de desenvolvedor no Brasil; perfil enviado para análise

**Este registro prevalece sobre as hipóteses anteriores de cadastro brasileiro de desenvolvedor com CPF.** O responsável forneceu o documento oficial **Developer account registration**, atualizado em10/09/2026. Ele separa criação do login de envio/aprovação do perfil e declara expressamente: **Individual Seller — Closed for BR**. A possibilidade de ter loja comum com CPF não significa elegibilidade ao perfil de desenvolvedor Individual Seller no Brasil. A orientação anterior de tentar esse caminho sem confirmar os requisitos foi incorreta.

Requisitos documentados:

- **BR / Registered Business Seller:** empresa registrada com documentos empresariais válidos no Brasil e pelo menos **um pedido nos últimos30 dias**; aplicativos limitados às próprias lojas.
- **Third-party Partner Platform (ISV):** empresa registrada com documentos válidos; produto funcionando com integrações de comércio eletrônico identificáveis pela conta de avaliação; URL comercial ativa em HTTPS, TLS1.2 ou superior e classificação de segurança A; conta de teste para avaliação das funcionalidades. Não declarar classificação A ou atendimento integral aos requisitos sem verificações próprias. Exigência adicional de objeto social de desenvolvimento de software e capital superior a100 mil RMB aparece no trecho específico CB-CN, não como regra brasileira.
- O tipo de perfil determina as categorias de aplicativos que podem ser criadas, conforme App management. Ainda é necessário confirmar disponibilidade/aprovação de **Shopee Video Management** para o perfil brasileiro em questão.
- Prazo indicado no guia: análise de Shopee Seller em3 dias úteis e ISV em10 dias úteis, sem garantia de aprovação. As exceções de7/14 dias são da Indonésia. Se recusado, consultar e-mail ou **App List → Go to Profile**, usar **Edit** para corrigir e reenviar. Não inventar prazo final a partir desses intervalos.

O responsável relatou ter escolhido uma modalidade chamada “associado”, preenchido nome e CPF em campos empresariais e anexado documento do CPF. A sequência mostrou relatórios de segurança e informações de serviço, incluindo conta de teste. Depois informou status “em análise”. O conjunto de telas é compatível com análise do **perfil ISV**, mas o título/status completo da tela não foi verificado diretamente; não afirmar que o aplicativo de vídeo já foi criado ou aprovado. Aceitação do formulário não comprova que CPF substitui registro empresarial.

O cadastro padrão documentado exige empresa no Brasil; nenhum caminho de liberação automática com CPF foi encontrado. Alternativas a avaliar: empresa ativa que de fato assuma a responsabilidade pelo Meu Vendedor, com representação/autorização real, ou exceção/modalidade alternativa expressamente confirmada pela Shopee no chamado existente. Documentos de CNPJ e certidões podem ser públicos, mas sua disponibilidade não autoriza usar a identidade de uma empresa de terceiro. A aceitação do comprovante cadastral como único documento empresarial não foi confirmada.

**Segurança:** o responsável forneceu a Política de Proteção de Dados da Open Platform. Ela abrange Conteúdo Shopee, além de PII não mascarada, e prevê programa escrito de segurança, responsável, acessos individuais, registros, gestão de incidentes e retenção/exclusão. As cláusulas6.4/6.6 preveem avaliação de segurança incluindo pentest/revisão de código; avaliação interna depende das condições e aprovação escrita descritas. Logo, o anexo de pentest opcional para solicitar PII na tela não representa dispensa geral das obrigações de segurança. Não afirmar conformidade integral do Meu Vendedor sem auditoria/evidências. Hospedagem e isolamento existentes não certificam cumprimento de todos os termos.

Pesquisa adicional encontrou fornecedores anunciando gestão de vídeos para afiliados e automação por aplicativo Android, mas nenhum tutorial comprovou cadastro brasileiro de desenvolvedor CPF em Shopee Video Management. Não confundir transferência nativa de arquivo com agendamento automático, automação de telas com API oficial, nem anúncio comercial com elegibilidade/homologação confirmada.

**Estado atual:** conta de avaliação do Meu Vendedor criada e validada, acesso de afiliados via auth_type=user documentado, perfil relatado em análise e chamado2120492660289695840 aguardando resposta técnica. Não há Partner ID/Key próprios do novo app, autorização OAuth real de vídeo, postagem ou agendamento implementados. Preservar conta de avaliação, sem versionar senha. Aguardar análise/resposta e corrigir o perfil conforme requisitos; não abrir duplicatas nem criar loja apenas como garantia de desbloqueio. O responsável pediu registrar essas informações e fazer commit/push dos arquivos da sessão.

## 11/11/2026 — conta exclusiva para avaliação da Shopee

O responsável pediu criar um usuário de teste para informar no cadastro de serviço da Open Platform. Criada conta comum exclusiva de avaliação no Supabase Auth, com identificador de e-mail de teste reservado (sem caixa postal), e-mail confirmado administrativamente e senha aleatória. Login real por senha e logout foram validados. Sob a sessão do próprio usuário, somente seu perfil ficou visível; consultas a conexões, produtos e links retornaram zero registros. Nenhuma conexão Shopee, credencial do proprietário, dado pessoal ou permissão administrativa foi atribuída. Nenhum e-mail, mídia ou postagem foi enviado. Não cadastrar a senha em arquivos versionados; dados de acesso entregues ao responsável separadamente. A conta deve permanecer disponível para a avaliação, sem ser removida como usuário temporário de teste técnico. Endpoint de preparação encerrado na versão2 após a criação. A exigência de perfil empresarial/aceitação de CPF e o acesso ao app Shopee Video Management continuam sem confirmação; criar usuário de avaliação não libera a API.

## 11/11/2026 — documentação oficial confirma autorização de afiliado; preparar cadastro do app

**Este registro posterior corrige as conclusões parciais anteriores sobre autorização exclusivamente de vendedor.** O responsável entrou na Open Platform, fez cadastro/login e copiou documentos oficiais da sessão autenticada para a conversa. O assistente não acessou essa sessão: a consulta pública retornava HTTP403 e não havia sessão de controle de navegador conectada.

### Objetivo e instrução mais recente

O responsável quer enviar do Meu Vendedor à área **Live e Vídeos → Vídeos** a mídia aprovada, legenda, hashtags e produtos vinculados. Não está pedindo transmissão ao vivo nem somente inclusão na vitrine. Pedido mais recente: “atualize o historico .md depois disso vamos passo a passo criar o app q a shopee mencionou para liberar acesso ao meu vendedor”. Prosseguir uma tela por vez, começando pela verificação do perfil e da categoria disponível; cadastro e liberação ainda não estão concluídos. Nenhuma nova implementação, postagem ou GPU foi iniciada nesta etapa documental.

### Confirmações dos documentos fornecidos pelo responsável

- **Crie seu App**, atualizado em 21/07/2026: cada categoria possui endpoints próprios, sem inclusão manual de permissões extras; não é possível alterar a categoria após criação. Para outro conjunto de APIs, criar outro app. O aplicativo começa em Developing, usa credenciais Sandbox, deve ser testado e depois aprovado em Go Live para usar credenciais Live. Seller In-House System e ERP System são exemplos comuns, não a escolha confirmada para nosso fluxo de vídeo.
- **Shopee Video API Integration Guide**, atualizado em 19/12/2025: somente aplicativos **Shopee Video Management** acessam Video OpenAPI. Confirma expressamente o papel Affiliate com **auth_type=user**. Papel Seller usa auth_type=seller. APIs de vídeo são User-type: usam user_id e access_token, assinatura baseada em user_id e gestão de tokens por usuário. Portanto, é incorreto concluir que a autorização de vídeo documentada só atende vendedores.
- Fluxo de vídeo documentado: v2.media.init_video_upload → upload_video_part → complete_video_upload → get_video_upload_result, obtendo video_upload_id. Depois get_cover_list → edit_video_info para preparar rascunho → post_video para publicar. Push de resultado final de upload é uma notificação, não o mecanismo de postagem. Termos de Shopee Video precisam ser aceitos conforme o guia.
- **Livestream API Integration Guide**, atualizado em 09/01/2026: detalha a autorização reutilizada pelo guia de vídeo: link /auth com partner_id, auth_type=user, redirect_uri, response_type=code e state; código de uso único com validade de dez minutos; troca por tokens e renovação. Implementação deverá proteger state e armazenar tokens apenas no servidor. Os exemplos/identificadores da documentação não são credenciais do Meu Vendedor.
- O guia de Livestream lista TW, ID, TH, PH, MY, SG e VN como países suportados, sem BR. A presença do domínio brasileiro /auth não prova habilitação de lives no Brasil e essa lista não deve ser automaticamente aplicada ao módulo de vídeos. Afiliados em lives usam Curtidos/Recentes/Conjuntos, enquanto vendedores têm também Minha Loja; isso não certifica as regras de produtos do endpoint de vídeos.
- Referência **v2.video.edit_video_info**: POST /api/v2/video/edit_video_info; aceita até cinco vídeos por pedido, caption de até150 caracteres, capa obrigatória obtida em get_cover_list e até seis produtos por vídeo em item_info (item_id e custom_item_name opcional). Rascunho pode ser editado; vídeo já publicado não. Agendamento exige intervalo de15 minutos a30 dias. Campo obrigatório **aigc_label**, adicionado em03/09/2026, sinaliza conteúdo gerado/assistido por IA, incluindo imagem, voz, personagem ou roteiro. O exemplo coloca aigc_label na raiz do payload; conferir contrato completo antes de implementar, pois a tabela copiada não esclarece toda a hierarquia.
- A referência não diz que item_id precisa pertencer à própria loja, mas também não garante qualquer produto de terceiro. A combinação de autorização Affiliate e itens vinculados comprova o caminho técnico, não a aprovação da conta brasileira nem aceitação de todos os itens. Erro “The user is not authorized and needs to be in toggle” indica condição adicional de habilitação ainda sem procedimento esclarecido.
- Não há confirmação de postagem de fotos avulsas/carrossel nem de upload de capa externa: o contrato de capa enviado usa quadros do vídeo. Fotos podem continuar como entrada da montagem interna.
- Documento AMS get_open_campaign_added_product é de campanhas/comissões e exige app **Affiliate Marketing Solution Management**. Não é API de postagem de vídeo nem substitui Shopee Video Management.

### Cadastro, chamado e situação empresarial

- Console acessado pelo responsável: App Management → App List. Foram oferecidos **Shopee Seller** (somente próprias lojas; pede Shopee Username, identificação pessoal ou registro empresarial e documento) e **Third-party Partner Platform** (ISV empresarial; pede registro/documento empresarial e credenciais de teste do app).
- O responsável abriu Third-party e viu cadastro de razão social, registro empresarial, documento e contatos; não concluiu. Informou não possuir CNPJ ativo confirmado. Não preencher esse perfil com CPF como se fosse registro de empresa, nem usar empresa de terceiro sem representação/autorização real.
- Foi informado um CNPJ de empresa antiga. Consulta à BrasilAPI em11/11/2026 retornou HELP CELULARES PEDRA AZUL, situação **BAIXADA desde01/08/2022**, por encerramento/liquidação voluntária. Não foi emitido comprovante oficial da Receita. Não apresentar esse registro como empresa ativa; não é necessário repetir o número completo neste histórico.
- A sugestão de criar loja com CPF para obter acesso permaneceu uma hipótese e não foi validada. A frase “aplicativo somente para suas próprias lojas” limita a autorização de lojas; não basta para deduzir sozinha todas as regras de produtos nos vídeos de afiliados. Não orientar abertura de loja como garantia de desbloqueio.
- Chamado aberto pelo responsável: **2120492660289695840**; formulário **2120492659743625236**. Categoria L1 Onboarding & Account Config; L2 acabou registrada como Profile Update, embora Account Registration & Profile Audit fosse mais adequada. A descrição está correta: pessoa física brasileira, acesso de afiliado, produtos de terceiros, vídeo/capa/legenda, documentação e cadastro necessário. Confirmações por e-mail foram automáticas, não aprovação nem resposta técnica. Último status mostrado pelo responsável: **In Progress**, atualização11/11/2026 às20:23 no horário exibido pelo portal. Sem campo de complemento identificado; não duplicar o chamado por isso.
- Texto do chamado preservado em TEXTO_CHAMADO_SHOPEE.txt. Nenhum chamado/e-mail foi enviado pelo assistente. Não armazenar tokens de preenchimento do formulário, chaves, documentos pessoais ou credenciais nos registros.

### Próximo passo, sem presumir aprovação

Conduzir cadastro do app **Shopee Video Management** passo a passo. Primeiro conferir **Developer account registration**, requisitos de Shopee Seller para Brasil/pessoa física e campos reais do perfil. Se o perfil ainda impedir criar app, esclarecer pelo chamado existente. Se App List liberar criação, conferir se Shopee Video Management aparece para aquele perfil e quais requisitos/países informa antes de enviar. Não selecionar ERP/Seller In-House por conveniência. Faltam perfil aprovado, categoria disponível para BR, app criado/aprovado, credenciais próprias, autorização real auth_type=user e validação dos produtos vinculáveis. Somente após isso implementar/testar a integração; o compartilhamento nativo publicado ainda não é postagem por API.

## 11/11/2026 — destino Shopee Live e Vídeos e verificação da API

O responsável esclareceu que quer divulgar em Live e Vídeos e pediu verificar postagem pela API e acertar o botão final. Consulta real autenticada nas duas conexões ativas confirmou somente as mutations generateShortLink e generateBatchShortLink, sem upload/postagem de vídeo. Pesquisa encontrou publicação por API para vendedores com autorização específica; isso não confirma disponibilidade para o criador afiliado e produtos de terceiros. Documentação oficial de endpoints de vídeo respondeu HTTP403 na consulta pública.

Ajustado o destino visível Shopee → Live e Vídeos → Vídeos, botão Compartilhar para Shopee Vídeo, cópia do nome do produto e instruções para vincular o item e concluir a postagem. Web Share envia arquivo e texto ao seletor do dispositivo; não força a Shopee como receptor e não confirma publicação. Se o receptor não estiver disponível, há download e cópia para concluir no app. Nenhum conteúdo foi postado.

250 testes, TypeScript, lint, build e navegador controlado desktop/mobile aprovados. Diagnóstico temporário encerrado v2/HTTP410. Cloudflare publicado na versão b067dd69-f43a-4142-83cb-4add262b6a0d. Relatório e limitações em [SHOPEE_VIDEO_PUBLICACAO.md](./SHOPEE_VIDEO_PUBLICACAO.md).

## 10/11/2026 — aproveitar fotos do anúncio e filtrar especificações

O responsável pediu aproveitar as várias fotos do anúncio, excluindo imagens de descrição/especificação. A análise confirmou que o catálogo guarda apenas a capa. Um anúncio Shopee consultado publicamente retornou HTML da aplicação, sem galeria estruturada disponível.

Implementada busca da galeria do item quando a origem a expuser, com aviso explícito quando somente a capa estiver disponível. Adicionada alternativa para analisar fotos salvas do anúncio. A leitura OCR roda localmente, com arquivos hospedados no próprio site, sugerindo retirar tabelas, descrições longas e leituras incertas. Há revisão manual, descarte de duplicatas, limite de cenas e cancelamento. Não foram retomados testes de personagens/GPU nem feitas chamadas de inferência paga.

Função `product-gallery` v2 publicada com autenticação e escopo por conta/produto; chamada anônima real retornou 401. 235 testes passaram. Chromium confirmou OCR real em três imagens de controle, correção manual, duplicatas e cancelamento; importação de galeria foi testada com respostas controladas, não como coleta real completa da Shopee. Evidências, limites e fluxo em [GALERIA_DE_PRODUTO.md](./GALERIA_DE_PRODUTO.md).

Frontend publicado na versão Cloudflare `d1f3092b-9dbd-489b-b8d7-1a677c35b509`. A leitura OCR foi repetida na URL pública com os mesmos resultados, sem pedido a CDN externo de OCR ou API de geração e sem erro JavaScript. O aviso de somente capa e a revisão manual foram preservados.

## 10/11/2026 — priorizar vídeos de produto para uso do aplicativo

O responsável perguntou sobre transições, vários ângulos do objeto e mãos manuseando-o, deixando os personagens de lado. Depois pediu análise das ferramentas no Supabase e disponibilização de um fluxo utilizável enquanto o movimento de personagens fica para evolução futura.

Foram consultadas funções e fontes remotos no Supabase, além do bucket e das políticas de acesso. Implementado **Vídeo de produto** como modo inicial do estúdio: fotos e clipes reais, ordenação, três transições, aproximação, três formatos, textos opcionais, prévia, exportação sem áudio, cancelamento, download e salvamento privado. Personagens permanecem em aba experimental, sem geração automática ou novos ensaios. Não houve consumo de inferência/GPU nem alterações de Secrets, funções ou esquema Supabase.

Chromium gerou MP4 real de 4,0052 s em 720×1280; verificados também clipe como entrada, formato quadrado, cancelamento, download e layout de celular. 228 testes passaram; TypeScript frontend/Edge, lint sem erros e build estático aprovados. Biblioteca validada com respostas controladas, e RLS conferida no banco em transações revertidas. O token de gerenciamento do terminal retornou 401: não foi possível criar contas técnicas para validar upload HTTP real; nenhum usuário técnico foi criado. Isso não foi apresentado como ensaio E2E remoto do Storage.

Ângulos e mãos vêm dos materiais reais enviados, não são inventados por IA nesta entrega. Detalhes e limites em [VIDEO_DE_PRODUTO.md](./VIDEO_DE_PRODUTO.md).

Publicado no Worker existente na versão `b284e71c-b8af-42bd-af98-49fabad658b2`, preservando bindings e crons. Teste repetido na URL pública gerou/baixou MP4 real de 4,007233 s em 720×1280 e confirmou também clipe, formato quadrado, cancelamento e layout em 390 px, sem erro JavaScript. Nenhuma GPU ou inferência paga foi usada.

## Encerramento solicitado — 09/11/2026, preservação para próxima sessão

O responsável informou aproximadamente 5% de crédito restante e pediu adiantar
o processo ou encerrá-lo com relatório/histórico para continuar depois. A
porcentagem é informação do responsável, sem medição independente. **Processo
encerrado; não retomar GPU sem nova instrução. Nenhum notebook r4 foi enviado.**

Resultado real: Hunyuan r3 gerou uma continuação de 49 quadros, 480×832/24 fps,
2,04 s, em 579,999 s de geração e 582,311 s incluindo codificação. A montagem
falhou porque o vídeo inicial era 480×848. É erro de normalização do adaptador,
não falha de inferência. A primeira tentativa T4 r1 não iniciou; r2 foi
interrompido no carregamento para corrigir conversão float/Pillow. O pedido
P100 recebeu duas T4 no runtime; não atribuir esses resultados à P100.

Arquivos preservados e decodificados integralmente:

- `artifacts/ana-six-20261109/continuation-2-raw-49frames.mp4`: todos os 49 quadros
  novos, inclusive o último necessário à referência seguinte.
- `artifacts/ana-six-20261109/resume-four-seconds.mp4`: montagem de **4,00 s e
  96 quadros**, 480×848, com os 48 quadros iniciais e os quadros 1..48 da
  continuação, normalizados localmente. **Ainda sem revisão visual de qualidade.**
- Ambos enviados com sucesso ao Storage privado `mv-video-assets`, sob
  `operator/ana-six-20261109/resume/`, com os mesmos nomes. Não dependem apenas
  do terminal. Hashes e tamanhos no relatório final.
- Prévia de 6,00 s/144 quadros em
  `artifacts/ana-six-20261109/ana-vestido-midi-camera-lenta-6s-exatos.mp4`.
  É câmera lenta interpolada do trecho antigo de 2 s; não é a geração nova
  completa e não satisfaz, por si, aprovação de qualidade comercial.
- Diagnósticos r2/r3 e referências anteriores preservados localmente.

Correções preparadas, **sem nova execução de GPU**: conversão float 0..1 para
uint8 somente nas referências/montagem; exportação da montagem via Pillow;
normalização das dimensões; suporte a seed de 96 quadros para gerar apenas
a continuação restante. Sintaxe, conversão e normalização local verificadas.

**Retomada exata:** revisar visualmente os 4 s preservados; configurar novo
controlador/job com o caminho privado e hash dessa montagem de 4 s, novo ID e
novas capacidades; gerar **somente `continuation_3`, seed 44, 49 quadros**.
Descartar o primeiro quadro repetido, normalizar para 480×848 e acrescentar
os 48 restantes: total de 144 quadros/6 s. Não rerodar o antigo controlador
com o seed de 2 s, pois repetiria o trabalho já salvo. Conferir duração,
rosto, mãos, roupa e junções antes de aprovar a entrega. Não há áudio novo.

Encerramento remoto solicitado para r3: DeleteKernel respondeu sem erro;
a consulta posterior retornou 403. Isso não é confirmação explícita
CANCEL_ACKNOWLEDGED. O filho havia terminado com diagnóstico arquivado e
o controlador estava terminal. `ana-six-test` substituído por **HTTP410,
versão 10**, verificado por requisição real; recusa submissões e callbacks.
Última consulta: 20.535,7411393 s usados, 0 reservados de 108.000 s; a diferença
da cota não foi atribuída exclusivamente a um job. Hunyuan antigo r2 agora
COMPLETE; Wan antigo r2 ainda CANCEL_REQUESTED. Não declarar todas as sessões
da conta encerradas com base apenas em reserva zero.

Relatório consolidado: [2026-11-09-ana-six-stopped.json](./executors/kaggle/results/2026-11-09-ana-six-stopped.json).
Nenhuma compra de créditos, alteração do estúdio, commit ou push nesta rodada.

## Nova instrução — vídeo final de 6 segundos

O responsável pediu: “continue o processo novamente me entregue um video final de 6s como pedido com qualidade”. Nova autorização para retomar GPU com Ana e o mesmo vestido midi. Preparada geração de duas continuações Hunyuan de 2 s após o trecho já preservado, cada uma condicionada ao último quadro anterior. Total previsto: 144 quadros, 24 fps, 480×848, sem áudio. Isso evita repetir a inferência única de 145 quadros que já falhou por VRAM; não é loop. Resultado sujeito a revisão de movimento, rosto, roupa e junções antes da entrega.

Notebook `mv-ana-six-20261109-r1`, ID `144014985`, submissão confirmada. Controlador privado temporário `ana-six-test`, supervisor de 3.900 s e prazo de sessão de 4.200 s; não alterar o estúdio nem comprar créditos. Não duplicar submissão pendente. Continuidade técnica em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md).

> **Estado final consolidado — 09/11/2026 16:22 UTC:** a sessão que conduziu os testes encerrou o controlador `ana-midi-test` na versão 19; HTTP410 verificado. Hunyuan r2 entregou o MP4; Wan r2 não chegou à inferência após dez minutos na fila. Foram solicitados os cancelamentos dos quatro notebooks temporários, inclusive Hunyuan r2 após sua entrega. A última consulta devolveu **CANCEL_REQUESTED para todos os quatro**, sem confirmação de término remoto. Isso supera o retrato parcial da recuperação abaixo, que ainda mostrava Hunyuan r2 RUNNING e controlador somente em leitura. A origem das mudanças foi a própria sessão de teste, não uma retomada de GPU. Relatórios finais em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md). Não reenviar ou reativar automaticamente.


> **Retorno posterior nesta recuperação:** o controlador passou a responder
> `generation_disabled: true`; Wan r1/r2 e Hunyuan r1 aparecem como
> `CANCEL_REQUESTED`. Hunyuan r2 aparece remotamente como `RUNNING`, apesar
> do MP4 concluído e preservado anteriormente. Não confundir entrega de arquivo
> com encerramento da sessão. Nenhuma submissão ou solicitação de cancelamento
> foi enviada nesta recuperação; a origem dessa mudança do controlador não foi
> determinada. Cancelamento solicitado não comprova encerramento confirmado.
> Não retomar GPU automaticamente. A comparação Wan continua sem MP4.
> Verificação local: 225 testes aprovados, sintaxe dos scripts Python conferida
> e `git diff --check` aprovado.

## Recuperação após fechamento do terminal — 09/11/2026

O responsável informou que o terminal fechou sozinho e pediu ler os Markdown,
verificar os commits pendentes, recuperar o último estado e continuar.
Recuperados os registros de Hunyuan e os arquivos temporários da comparação.
A última submissão Wan é r2, ID `143998541`, confirmada no Kaggle; às 16:15 UTC
ainda não havia callback, log ou MP4. O estado `submitting` do controlador não
significa inferência ativa. A resposta remota `{}` é compatível com o padrão
`QUEUED = 0` no SDK oficial preservado localmente. Nenhuma nova GPU foi submetida
nesta recuperação. Detalhes e pendências em [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md).

HEAD `40e307e`; nenhum commit local à frente de `origin/main` na referência local.
Há documentação alterada e scripts/relatórios não rastreados, preservados para
revisão. Nenhum push, mudança do estúdio ou compra de créditos nesta recuperação.

## Comparação encerrada — Ana e vestido midi, Hunyuan e Wan

O responsável confirmou vestido midi feminino e autorizou Hunyuan primeiro e
Wan depois, pedindo antes identificar o motor de
`operator/ana-vidi-20261108/inputs/final-ana-vidi.mp4`.

**Origem confirmada: FASHN VTON → SCAIL-2 → áudio acrescentado.** Recuperados
os notebooks `mv-motion-fashn-1d1ca4cd` e `mv-motion-scail-52e3dabb`, configurações
e relatórios. IDs e hashes correspondem exatamente ao PNG e MP4 preservados.
O 403 inicial vinha de um slug incorreto, diferente do título usado pelo Kaggle.
FASHN: 343,334 s; SCAIL: 1.271,815 s para 2 s de movimento. O stream de vídeo do
final é idêntico ao do intermediário silencioso.

A comparação usou a mesma base histórica com o vestido aplicado. Ela difere do
arquivo oficial de Ana e já mostra a peça mais vermelha que a foto do anúncio.
Não foi nova aplicação da roupa à foto cadastrada.

Hunyuan r1 ficou 15 minutos sem iniciar, recebeu cancelamento e teve callback
revogado. Hunyuan r2 concluiu MP4 de 2 s, 480×848/24 fps, sem áudio. Supervisor:
1.031,645 s; geração/codificação: 596,561 s. Decodificação integral, tamanho e
hash conferidos. Quadros 0, 1 e 1,9 s mostram movimento discreto e composição
preservada, com suavização/variações de rosto e mãos. Sem aprovação comercial.
Arquivo privado: `operator/ana-midi-20261109/hunyuan-r2.mp4`.

Wan r1 sofreu timeout; notebook salvo, mas não iniciou. Wan r2 teve submissão
confirmada, mas ficou dez minutos na fila, sem callback ou log. **Nenhuma
inferência Wan nesta rodada.** Cancelamentos solicitados, sem terceira tentativa.
Isso não reprova a qualidade do modelo.

Na conferência final, Hunyuan r2 ainda aparecia RUNNING apesar da entrega; foi
solicitado seu encerramento. Os quatro notebooks passaram a CANCEL_REQUESTED,
sem confirmação CANCEL_ACKNOWLEDGED. API de exclusão retornou 503, rota legada
404. Controlador `ana-midi-test` encerrado na v19, HTTP410 verificado. Callbacks
e submissões bloqueados; início tardio não passa da consulta anterior ao preparo
do modelo.

Resultados e limites: [TESTE_ANA_MIDI.md](./TESTE_ANA_MIDI.md), com relatórios
`executors/kaggle/results/2026-11-09-ana-midi-*.json`. Sem compra de créditos,
nova narração, publicação de frontend ou alteração do gerador do estúdio.
Não retomar GPU sem nova instrução.

## Nova instrução — testes de Ana com vestido

O responsável pediu: “faça os testes usando as ferramentas acima q vc falou q da certo”. Isso autoriza novos testes, substituindo a suspensão anterior para este pedido; não significa que Wan ou Seedance já tenham qualidade comprovada. A resposta anterior distinguiu o sucesso de fala do MuseTalk da falha de Wan Animate e da recusa de créditos do Seedance.

Conferidos perfil remoto de Ana e hash do arquivo local, com correspondência. O catálogo contém dois vestidos diferentes: envelope e regata com variantes. Foi solicitada a escolha da peça/variante antes de qualquer geração para não repetir a mistura de anúncios. Sintaxe Python do executor e dos grafos validada; isso não é inferência. O adaptador atual do Seedance não consulta saldo; os valores antigos não foram apresentados como saldo atual. Wan S2V ainda não está integrado.

Nenhuma GPU ou geração de fornecedor iniciada nesta preparação. Estado e referências em `executors/kaggle/results/2026-11-09-ana-dress-preflight.json`. Próximo passo depende da identificação do vestido pelo responsável; usar Ana em todas as etapas deste pedido.

## Última conversa — 09/11/2026: decisão sobre o gerador adiada para amanhã

Mensagens do responsável, em ordem:

1. “chat estou começando a aceitar o fato de remover o gerador de video do projeto, ao inves de gerar o video dentro do app deixamos apenas o botao e uma caixa com o filtro par aeu escolher em qual site, estou conseguindo fazer os videos no google flw e no gemini. esta cada vez mais claro q criar esse tipo de ferramenta so vai funcionar se eu pagar”
2. “nao altere nada ainda, vamos debater sobre o assunto e ver qual a melhor saida”
3. “salve nossa conversa no histociro aamaha eu decido”

O responsável informou que está conseguindo produzir vídeos no Google Flow e no Gemini e considera substituir a geração interna por um seletor de sites e um botão para abrir a ferramenta escolhida. Expressou preocupação com a necessidade de pagar para alcançar o resultado pretendido; isso não constitui autorização para contratar serviços ou comprar créditos.

O assistente inicialmente anunciou que adaptaria o estúdio e leu a skill Sites e o código do componente `VideoStudio.tsx`. O responsável interrompeu antes de qualquer edição nessa tentativa. **Nenhuma alteração de código, interface ou publicação foi feita para substituir o gerador por links externos.** Os scripts e registros experimentais da rodada anterior continuam preservados; esta afirmação não apaga as mudanças anteriores.

No debate, foram apresentadas três alternativas, sem decisão de implementação:

- Seletor de sites e botão para abrir Flow ou Gemini, com preparação feita no serviço externo.
- Meu Vendedor organiza produto, variante, referências e instruções para copiar/baixar e levar ao serviço externo; eventual retorno do vídeo à biblioteca precisaria ser conferido ou adaptado.
- Geração integrada por uma API paga compatível, condicionada a orçamento, integração e validação real de qualidade.

O assistente indicou preferência pela preparação no Meu Vendedor com geração externa, podendo começar somente pelo seletor. Essa foi uma sugestão, **não uma escolha aprovada pelo responsável**. Também esclareceu que pagar por GPU, isoladamente, não comprova fidelidade de roupa/personagem.

**Decisão pendente para amanhã:** manter a geração interna suspensa, substituí-la por acesso a sites externos ou adotar preparação de materiais com geração externa. O responsável ainda decidirá entre somente abrir o site e também preparar imagens/textos no aplicativo. Não excluir os motores, remover recursos, alterar botões, publicar mudanças, contratar serviços ou reiniciar GPU com base nessa discussão. A instrução vigente é apenas registrar e aguardar a decisão.

## Interrupção anterior — 09/11/2026: registrar os testes, sem novas gerações

Mensagem literal do responsável: “CHAT encerrei pq percebi q vc esta misturando as fotos do anuncio pegando a camisa de um anuncio e montando na personagem depois vestindo vestido nela, atualize o historico com o q vc testou por ultimoe os resultados”.

**Testes suspensos novamente. Não iniciar, reenviar ou retomar geração/GPU sem nova instrução.** A autorização da seção seguinte é histórica e foi interrompida por esta mensagem.

### Erro de condução e referências utilizadas

O responsável interrompeu a rodada por perceber mistura de anúncios. O assistente preparou referências dos dois vestidos encontrados e depois mudou para a camisa do Flamengo, sem fechar a identificação da peça desejada. Essa alternância foi um erro de condução e não deve ser repetida. Referências de anúncios diferentes não podem compor uma mesma validação de produto.

Separação entre o que foi preparado e o que efetivamente rodou:

- **Carla:** imagem cadastrada `carla-v2.webp`, com a blusa verde original; SHA-256 `acf2757d16f9f3c724dc731250a83390eeab2901c2884455ecbf94ed0dbb40f9`. Foi a única imagem de pessoa enviada aos notebooks desta rodada. Nenhuma camisa ou vestido foi aplicado nela por inferência nesta rodada.
- **Vestido envelope laranja:** foto original do anúncio, SHA-256 `3c7e647b7bb2de3cd115075e13aef87cb843cbd34185b68d1ae12b7f970326cc`. Foi feito um recorte local por cor, reprovado por conter cabelo/pele e perder partes da roupa. Não alimentou uma geração de roupa/vídeo.
- **Vestido regata:** foto do anúncio com duas variantes/estampas, SHA-256 `6d09f5d9d15a63edb6bd1a76ed98de3f9463d15773edcc4457f117521f420621`. Foi apenas inspecionada; nenhuma variante foi confirmada como a peça do último vídeo.
- **Camisa do Flamengo:** foto original já documentada, SHA-256 `73ccd4990382d1e0efb4ca768ec79afa8f948e502e5aff0687f32d6a286465e7`. Foi preparado um recorte por contorno, mantendo pixels da peça, e enviado ao bucket privado de pesquisa. SHA-256 do PNG preparado: `9a7d5a590429c156aaee8ed491c920b523091a3d108aa9f0e0e87515b2a6a1f3`. Isso foi preparação de entrada, não imagem da Carla vestida; o SwiftTry não foi executado.

### Últimos ensaios e resultados confirmados

As identificações r1–r7 são tentativas de preparação/submissão do experimento StableAnimator; **não representam sete motores de vídeo testados nem sete inferências concluídas**.

| Tentativa | O que ocorreu | Resultado |
| --- | --- | --- |
| r1 | Falha ao criar ambiente Python com `ensurepip`; 49,847 s reportados no notebook | Sem inferência, sem MP4. O ZIP não foi salvo porque o bucket de vídeos não aceitava ZIP. |
| r2 | Criação do armazenamento de pesquisa recusada pelo limite solicitado | Falha antes de submeter Kaggle; sem inferência. Depois foi criado bucket privado separado, sem ampliar os tipos do bucket do app. |
| r3 | Submissão sem confirmação preservada; consulta de sessão sem permissão | Marcada cancelada e capacidade de callback revogada. Não há evidência de inferência/MP4. |
| r4 | Kaggle respondeu HTTP 409; o título do notebook havia sido reutilizado | Submissão rejeitada; sem evidência de inferência. Título único foi aceito na tentativa seguinte. |
| r5 | Não havia distribuição compatível de `torchvision==0.20.1` no índice consultado; 94,248 s | Sem inferência, sem MP4. ZIP de logs de 809 bytes preservado. |
| r6 | Python 3.11.11 e dependências instalados, pesos baixados; falha no adaptador de poses, que passou CHW ao Pillow em vez de HWC; 417,523 s | Erro do adaptador, antes de carregar/executar o gerador de vídeo. Sem MP4. ZIP de 246.208 bytes preservado. A conversão foi corrigida no código. |
| r7 | Repetição com conversão de pose corrigida; interrompida a pedido do responsável durante download de pesos | Sem inferência do gerador, sem MP4. Arquivo de diagnóstico registra 323,644 s e apenas mensagens de download de `pose_net.pth` e `face_encoder.pth`. ZIP de 1.837 bytes preservado. |

O `failed` com erro vazio dentro do ZIP r7 foi produzido pelo tratamento de cancelamento, não por uma falha de inferência do modelo. O registro final no servidor foi corrigido para `cancelled`, com essa explicação. O formato de poses corrigido não chegou a ser validado por uma nova geração.

**Resultado visual desta rodada: nenhum vídeo novo, nenhuma roupa aplicada à Carla e nenhuma solução aprovada.** StableAnimator ainda não teve sua qualidade de geração avaliada aqui. SwiftTry teve adaptador preparado, mas não foi executado. Bernini, HOMIE e as demais opções ficaram na pesquisa documental/código; a matriz de 29 opções não é uma lista de 29 testes de GPU.

### Encerramento e evidências

- Cancelamento cooperativo enviado ao ensaio r7; processo filho interrompido e ZIP de encerramento recuperado. Não foi submetido outro notebook após esta instrução.
- Endpoint temporário `video-research` encerrado com HTTP 410; não permite novas tarefas nem acesso administrativo. Nenhum Secret antigo foi excluído.
- Cota consultada no encerramento: `18.211,380893 s` usados de `108.000 s`, `0 s` reservados. Diferença desde a primeira consulta da rodada: aproximadamente **16 min 26,782 s**. Esses números são da cota Kaggle, não do tempo total da conversa. A consulta independente de sessão continua sem permissão; não apresentar zero reserva como prova universal de todas as sessões da conta.
- Relatório consolidado: [2026-11-09-research-stopped.json](./executors/kaggle/results/2026-11-09-research-stopped.json). Matriz, descartes e limitações: [PESQUISA_VIDEO_ALTERNATIVAS.md](./PESQUISA_VIDEO_ALTERNATIVAS.md).
- Fontes, scripts experimentais e evidências foram salvos no workspace; nenhum novo motor foi habilitado no estúdio e não houve publicação de frontend nesta rodada. Sem commit/push desta atualização.

Não retomar a partir da camisa preparada ou do vestido recortado como se fossem a peça confirmada. Numa eventual nova instrução, fixar primeiro **um anúncio, uma variante, uma foto de produto e a Carla correta**, mantendo essa seleção em todas as etapas.

## Continuação — 09/11/2026: pesquisa e novos testes autorizados

O responsável pediu revisão dos Markdown e uma estratégia diferente de **ferramentas de geração**, preservando pessoa/produto em movimento. Rejeitou a sugestão de foto parada/montagem como substituto: para roupas, mostrar caimento no corpo é o atrativo; para utensílios, uma demonstração só com mãos pode servir. O assistente corrigiu o entendimento e propôs investigar animação primeiro e provador temporal depois, além de modelos com referências separadas de pessoa/produto.

Instrução anterior literal: “teste sua recomendação equanto vc continua buscando mais soluçoes. preciso de muitas opçoes ate encontrarmos o caminho. mas sempre registrando e eleiminando as q nao deram certo”. Autorizava novos ensaios, posteriormente interrompidos conforme a seção mais recente acima; não aprovava amostras antigas nem autorizava compra de créditos.

Criado [PESQUISA_VIDEO_ALTERNATIVAS.md](./PESQUISA_VIDEO_ALTERNATIVAS.md) com matriz de 29 opções e distinção entre falha de ambiente, reprovação visual, indisponibilidade de pesos e restrição comercial. Preparado controlador privado temporário, sem alteração do estúdio/seletores, e iniciados ensaios StableAnimator. As falhas de preparação e suas correções ficam nesse registro e nos JSON de evidência. Não declarar o modelo aprovado por ter instalado/carregado.

O catálogo atual contém dois vestidos diferentes. Foram inspecionadas as fotos originais e enviada pergunta para identificar a peça do último vídeo. Um recorte automático exploratório do vestido envelope foi reprovado antes de usar GPU por conter ruído de pele/cabelo. Não repetir a substituição de produto por amostra pública.

Este arquivo registra as mensagens do usuário disponíveis nesta conversa e resume as ações e respostas relevantes do assistente. As mensagens intermediárias do assistente estão resumidas; não se trata de uma exportação literal completa de todos os eventos da plataforma. Nenhum token, senha ou URL assinada foi incluído.

## Objetivo

Vestir a personagem predefinida Carla com a **camisa exata da foto do anúncio**, preservar sua identidade, biotipo, cores, gola, punhos e emblema da peça e só depois avaliar movimento guiado por vídeo. Interação com outros produtos também é desejada. O responsável procura execução sem créditos de provedores de vídeo, sujeita à cota de GPU do Kaggle.

## Mensagens do usuário, em ordem

1. “Leia todos os aruiqovs .md do projeto verifique o estado atuado o gerador de videos o historico fala as ultimas convesa o q foi testado e pesquiesado, me fale como voce endentedeu q o gerador de video deve funcionar e o pq nao esta dando certo. verifique se esse codespace ja te da acesso direto ao cloudflare e ao supabase, se nao der me instrua detalhadamente para te da acesso”
2. “Chat agora q vc leu e entendeu a ferramenta q precisamos e semelhanteao musetalk porem tem q ser para movimentos, outra ferramenta q precisamos q tenha exatidao e fazer com o personagem use o produto da foto do anuncio, uma camisa, calça, barbeador qualquer produto q for anunciado temos q colocar o personagem interagindo com ele. Preciso q vc faça uma busca progunda e evançada em toda a rede mundial em blos, rede social e site informaçoes q possa ter alguma ferramenta q consigamos isso sm precisar de credito, de graça. no historico vc ja viu q foi analisado algumas e testado outras busque uma referencia positiva. veja se pegarmos um video ou link de um video base ajudaria”
3. “Gostei das suas sujestoes, autorizo vc implementar todas essas ferramentas. nesse comando agora nao precisa vc ficar me pergntando ou pedindo se pode fazer a alteraçao. te autorizo todo acesso a melhoria no gerador de video. vc pode ler arquuivos do supabase e cloudflare”
4. “libero todo acesso ao kaggle tbm nao precisa ficar me pedindo autorização”
5. “chat me de um resumo do q esta acontecendo como esta o processo da criaçao do video ? do inicio ate agora ja tem qto tempo ?”
6. “pode interromper o processo. so pea imagem da camisa q esta na carla esta tudo errado”
7. “chat nao sei a forma q vc abordou mas deu tudo errado desde o inicio. a começar do processo q vestiu o produto ( camisa do flamengo ) na carla a camisa q vc vestiu nela nao era da imageme q esta no anuncio”
8. “qual foi o motibo q nao deixou vestir a camisa camisa do anuncio na personagem pre definida ( carla )”
9. “antes de repetir o processo todo novamente verifique tudo se esta alinhado, se o gerador de video esta usando as ferramentas no secrets do supabase pra ajudar ou se nao precisa. cada passo precisa ser gefito com detale pra nao ter erro”
10. “chat nao reinicie o teste novamente,. apenas faça as correçoes registre tudo q foi modificado e salve nossa conversa no historico.md”

## Respostas e ações do assistente

- Revisou a documentação e investigou ferramentas. Integrados adaptadores experimentais FASHN, Wan Animate, SCAIL-2 e VACE, armazenamento privado, fila, histórico, cancelamento e recuperação.
- **Erro principal:** o piloto FASHN usou uma camiseta pública de exemplo do projeto, e não a camisa do Flamengo do anúncio. O assistente apresentou a execução técnica como resultado visual válido e avançou para movimento. Essa avaliação foi incorreta e foi revogada. Não houve teste da camisa correta nessa rodada.
- FASHN entregou uma imagem em 321,465 s; VACE entregou vídeo técnico de 2 s em 427,829 s sem substituição convincente pela Carla. Wan falhou durante amostragem. SCAIL entregou vídeo de 2 s em 1.090,989 s, antes do cancelamento; não foi aprovado visualmente e usou a referência de roupa errada.
- Às 19h38 UTC, o assistente informou aproximadamente 1h11 de implementação e ensaios desde 18h27. Eram ensaios diferentes e correções, não uma única geração de vídeo.
- Após o pedido de interrupção, solicitou cancelamento e não iniciou outra GPU. A conta técnica e seus arquivos privados temporários foram removidos; os artefatos foram preservados na área interna de auditoria. O endpoint técnico foi encerrado com HTTP 410 na revisão posterior.
- Admitiu expressamente: não houve impedimento comprovado para vestir a camisa do anúncio; o arquivo fornecido ao modelo estava errado. Não existe resultado aprovado do objetivo solicitado.

## Auditoria e correções posteriores, sem gerar imagem ou vídeo

Relatório detalhado: [AUDITORIA_GERADOR_VIDEO.md](./AUDITORIA_GERADOR_VIDEO.md).

- Identificado no catálogo o anúncio “Camisa II Flamengo & Shopee 2026”, com dois registros da mesma oferta, pertencentes a contas distintas. A consulta e importação do aplicativo continuam filtradas pela conta autenticada.
- Baixada a imagem original apenas para inspeção: JPEG 532×532, SHA-256 `73ccd4990382d1e0efb4ca768ec79afa8f948e502e5aff0687f32d6a286465e7`. Camisa preta no cabide, gola/punhos vermelhos e emblema vermelho; não presumir patrocinadores inexistentes na foto.
- Conferida Carla: referência `carla-v2.webp`, SHA-256 `acf2757d16f9f3c724dc731250a83390eeab2901c2884455ecbf94ed0dbb40f9`, compatível com o cadastro.
- Conferidos nomes dos Secrets e chamadas do código publicado, sem revelar valores ou consumir inferência de fornecedores.
- Correções exigem conferência de produto, personagem cadastrado e referência enviada; registram hashes das imagens e recusam mudanças posteriores. Imagem vestida precisa pertencer à mesma conta, produto e personagem.
- Executor verifica novamente os hashes antes de carregar os modelos. O novo fluxo não usa camiseta de exemplo nem inicia geração automaticamente.
- Wan fica desabilitado até uma validação futura expressamente solicitada. FASHN e SCAIL permanecem experimentais; entrega de arquivo não equivale à aprovação de qualidade.
- Inventário do Kaggle corrigido para refletir sua integração de vídeo. Nenhuma nova chave é necessária para os modelos públicos usados no executor.
- Esta rodada executa somente correções, consultas de auditoria e verificações de software. **Não autoriza repetir teste FASHN, Wan, SCAIL, VACE nem alocar GPU.**

## Regra vigente

Não reiniciar os ensaios. Preservar a rejeição do resultado anterior. Qualquer próxima geração dependerá de nova instrução do responsável e deverá começar pela foto exata do anúncio e pela conferência da Carla; não pular a validação da roupa para chegar ao vídeo.

## Registro final das correções

Correções publicadas no Cloudflare `e383d328-4bfe-4cca-bf06-fe4a7042863e` e Supabase `motion-generation` v12. Inventário ajustado em `video-generation` v56 e worker v40; diagnóstico encerrado `motion-qa` v12/410. Foram aprovadas 225 verificações locais de software, TypeScript frontend/Edge, lint e build. A consulta final confirmou zero tarefas ativas e remoção da conta técnica. Nenhum ensaio de imagem/vídeo/voz ou GPU foi reiniciado. Fidelidade da camisa correta continua não testada e não aprovada.


## 10/11/2026 — organização e divulgação integradas

Após recuperar a última conversa, o responsável pediu “faça isso agora”. Implementada área única Ofertas e produtos com cinco visualizações e compatibilidade com as rotas anteriores. Ficha do anúncio agora oferece preparação de mídia; link gerado pela API é preservado no editor. Criada instrução de análise visual e prompts bilíngues para uso externo no Gemini/Flow, importação de mídia e encaminhamento do resultado da montagem interna à preparação da publicação.

Publicações permite retomar o último rascunho local da conta, com mídia, legenda, hashtags e link, baixar e usar compartilhamento nativo quando suportado. Não há envio direto para Shopee Vídeo na integração disponível. Não foi automatizada a análise/geração externa e não houve inferência/GPU, teste real de API de link ou postagem. Dashboard, Radar e Top 10 usam somente os dados disponíveis do catálogo e explicam seus limites.

235 testes existentes e 3 novos aprovados, TypeScript/build/lint sem erros. Teste de navegador com catálogo simulado aprovado em desktop e celular; IndexedDB validado com mídia e separação das chaves por conta. Publicado no Cloudflare `8f951b5b-ff29-4e6a-ac25-bb2069477dc3`; página inicial e Publicações verificadas por HTTP. Detalhes em [DIVULGACAO_INTEGRADA.md](./DIVULGACAO_INTEGRADA.md).


## 10/11/2026 — correção de ofertas indisponíveis e lista limitada

O responsável relatou Início/Ofertas mostrando “lojas sem produtos disponíveis”, pediu atualização automática ao mudar de aba e perguntou por que a lista de Produtos era pequena. A investigação confirmou vitrine pública indisponível enquanto a conexão privada funcionava, e dois cortes internos: sincronização de três páginas de20 e `.limit(60)` na tela.

Implementada navegação autenticada por páginas da API, sem depender da seleção salva de60, com consulta automática em cada visualização, carregamento ao rolar, botão de continuidade e busca/ordenação enviadas à Shopee. Produtos consultados são salvos apenas na conta/conexão da sessão para preservar ficha, geração de link e mídia. Não se expõem credenciais privadas na vitrine pública.

A verificação real no backend confirmou a quarta página,20 itens e `hasNextPage:true`. Pesquisa por “vestido” retornou System Error10000; foi criado fallback identificado como filtro local nas páginas da listagem geral, sem culpar credenciais ou afirmar busca global. Introspecção do endpoint oficial confirmou os parâmetros usados. Diagnóstico temporário protegido encerrado com HTTP410. Não houve geração de link ou postagem real nos testes.

241 testes passaram; tipos frontend/Edge, lint sem erros, build e navegador com sessão/API simuladas aprovados. Evidências, limites e detalhes em [DIVULGACAO_INTEGRADA.md](./DIVULGACAO_INTEGRADA.md). Backend marketplace v31.

Frontend desta correção publicado no Cloudflare `e553299a-b481-4246-aca1-d6a64f1c94b4`.


## 10/11/2026 — pop-up, roteiro por imagem e narrador

O responsável pediu: remover aviso que não era erro; simplificar a criação em pop-up por partes; usar IA para analisar a imagem e criar fala/prompts sobre benefícios; após aprovação, preparar vídeo, link, legenda e hashtags e disponibilizar compartilhar. Perguntou se postar enviaria à loja/vitrine Shopee.

Implementado assistente modal de quatro etapas, endpoint de visão autenticado e vinculado à conta, integração do Google TTS existente com composição local de vídeo narrado e aprovação explícita antes de preparar compartilhamento/rascunho. Hashtags específicas são preenchidas pela análise ou derivadas do título. Geração com personagens no Flow continua externa; não houve GPU. Fonte oficial Shopee confirma que produto deve ser vinculado ao vídeo e adicionado separadamente à Vitrine do Afiliado; não foi confirmada API disponível para executar essas operações automaticamente na conta. O compartilhamento não é tratado como postagem confirmada. Pergunta de esclarecimento sobre loja de vendedor versus vitrine ficou sem resposta até o registro.

Groq `qwen/qwen3.8-27b` analisou foto real de power bank do catálogo. O rascunho requer revisão de termos como “retrátil” e “sobrecarregado”; não se declarou qualidade publicitária aprovada automaticamente. Gemini retornou saldo pré-pago esgotado, sem compra de créditos. Teste de navegador com visão/TTS simulados executou montagem/composição reais, confirmou um stream de áudio no MP4, fluxo de aprovação, compartilhamento completo e rascunho em Publicações. Nenhuma narração real foi sintetizada nesta validação e nada foi postado.

246 testes, tipos, lint e build aprovados. Cloudflare `132378e4-5e85-442f-8667-d6aa4a0f939e`; Supabase `campaign-content` v2; diagnóstico HTTP410 e bloqueio anônimo HTTP401. Relatório: [ASSISTENTE_DE_DIVULGACAO.md](./ASSISTENTE_DE_DIVULGACAO.md).


## 10/11/2026 — gerar link no primeiro passo e verificar mais fotos

O responsável aprovou o formato do assistente e pediu gerar link logo abaixo do campo Seu link de divulgação, sem precisar sair do pop-up. Perguntou se consultar o endereço do próprio produto permitiria importar mais imagens. Botão inserido, integrado a generate_link, preenchimento e salvamento em Meus links preservados.

A consulta da galeria já usava o endereço canônico do anúncio. Dois anúncios foram abertos publicamente no navegador; o acompanhamento completo de um deles terminou em verificação de tráfego/Página indisponível, solicitando login e sem fotos. Não se tentou contornar a restrição e não foi afirmada coleta completa. Área de fotos ganhou acesso direto ao anúncio e mensagem precisa para o caso de só recuperar a capa. A seleção de imagens do dispositivo segue disponível.

Sete testes de galeria, tipos frontend/Edge, lint, build e navegador pertinentes aprovados. Cloudflare c3582268-a693-4897-9ca6-317ddf96568c; product-gallery v3. Evidências e limites em GALERIA_DE_PRODUTO.md. Teste de botão usou API simulada; nenhuma geração de link real, mídia, GPU ou postagem nesta validação.


## 10/11/2026 — verificação da API para Baixar todas as imagens

O responsável perguntou se sua API daria acesso ao comando de baixar todas as imagens presente no Compartilhar do aplicativo Shopee. Introspecção autenticada confirmou imagem única em ProductOfferV2, sem comando equivalente de galeria, e revelou os feeds listItemFeeds/getItemFeedData. Quatro feeds estavam acessíveis; 20 produtos amostrados tinham image_link e image_link_3 distintos. Dois JPEGs do mesmo anúncio de short jeans foram baixados e visualmente conferidos, com composições e hashes diferentes.

Resultado: existe fonte oficial de imagens adicionais pela API, ainda não integrada ao Meu Vendedor. Não se confirmou que contenha todas as fotos do app ou todos os produtos. A afirmação anterior sobre as limitações da API de ofertas não podia ser generalizada para todos os recursos da API; a documentação foi corrigida. Nenhum código de app foi modificado nesta investigação. Diagnóstico encerrado em HTTP410; relatório e evidência em GALERIA_DE_PRODUTO.md e tests/results/2026-11-10-affiliate-feed-images-live.json.

## 12/11/2026 — Unificação de Produtos e ChatGPT manual

Nova entrega e resultados registrados em [HISTORICO.md](./HISTORICO.md). Histórico anterior preservado.

## 12/11/2026 — Publicação imediata e agendamento multiplataforma

### Objetivo e instruções recebidas

O responsável autorizou implementar publicação imediata e agendamento persistente no Meu Vendedor. A solicitação abrange preparar produto e marketplace de origem, link de afiliado, mídia, título, descrição e hashtags; escolher destino, data, horário e fuso; acompanhar rascunhos, agendamentos, ação manual, processamento, conclusão, falhas e cancelamentos; editar, reagendar e cancelar antes da execução; impedir duplicidade; isolar dados por usuário; validar datas e publicar somente por APIs oficiais cuja autorização esteja realmente implementada. Para os demais destinos, o sistema deve solicitar ação manual e nunca afirmar publicação automática. Também foi solicitado atualizar este histórico e `CONTINUAR_AMANHA.md`, validar o projeto e publicar somente os componentes necessários. Facebook Stories, TikTok e Kwai ficam apenas como planejamento futuro. O Worker `gilfinanceiro` não deve ser alterado.

### Auditoria e relatório técnico

- O fluxo existente em `PublicationComposer` usa Web Share, download e cópia. Uma resposta bem-sucedida do seletor de compartilhamento não confirma uma postagem.
- O rascunho anterior guardava um único item no IndexedDB do navegador; não era persistente no servidor e um novo salvamento substituía o anterior.
- Shopee Vídeo e Pinterest continuam dependendo de ação no aplicativo/site. A integração YouTube pode solicitar o escopo `youtube.upload`, mas o próprio aplicativo informa que publicação pelo Meu Vendedor ainda está em preparação; não foi encontrado fluxo de upload. TikTok não está habilitado para publicação no app e depende de aprovação. Não há integração de publicação Facebook/Kwai comprovada.
- Decisão de segurança: nenhum destino foi habilitado para postagem automática nesta entrega. Shopee Vídeo é selecionável somente para produto da Shopee; Pinterest e outro aplicativo usam modo assistido. No vencimento, a publicação deve passar a “Aguardando ação manual”.
- Não foram consultados ou alterados Secrets, credenciais privadas, contas comerciais ou configurações remotas nesta implementação local. O estado efetivo das versões remotas precisa ser confirmado separadamente.

### Arquivos criados ou modificados

- Criados `supabase/migrations/20261112180000_publication_scheduling.sql` e `supabase/migrations/20261112180100_publication_scheduler_cron.sql`.
- Criada a Edge Function autenticada `supabase/functions/publication-schedule/` e sua configuração em `supabase/config.toml`.
- Criados `src/lib/publication-scheduling.ts`, `src/lib/publication-time.ts` e `src/components/videos/PublicationScheduleBoard.tsx`.
- Modificados `src/components/videos/PublicationComposer.tsx`, `src/components/videos/PublicationWorkspace.tsx` e `src/lib/product-campaign.ts`.
- Criados `tests/publication-scheduling.test.mjs` e `tests/publication-scheduling-database.test.mjs`; atualizado `tests/helpers/video-db.mjs` para excluir apenas a migração `pg_cron` real dos testes PGlite e testá-la com stubs controlados.
- Atualizados `PUBLICACAO.md` e `CONTINUAR_AMANHA.md`. Conteúdo histórico anterior foi preservado.

### Alterações implementadas

- O botão “Publicar agora ou programar” apresenta as opções de compartilhar agora ou programar. O compartilhamento continua usando o fluxo existente e apresenta mensagens que não confundem entrega ao seletor com publicação concluída.
- O agendamento cria uma publicação por destino, com chave de idempotência; persiste conteúdo e horário UTC, guarda o fuso IANA selecionado e mantém as mídias em `mv-video-assets`, bucket privado existente, com caminho validado para o proprietário.
- Foram adicionadas tabelas de publicações e tentativas, RLS de leitura por proprietário e mutações somente pelo backend autenticado. A Edge Function verifica a sessão antes de operar e associa cada consulta ao usuário autenticado.
- A migração instala uma rotina `pg_cron` por minuto. A função SQL bloqueia e transiciona itens vencidos uma única vez para “Aguardando ação manual” e registra a tentativa. Ela não chama nenhuma rede social.
- O painel apresenta estados, conteúdo, mídia assinada temporária, tentativas e ações de compartilhamento/manual; permite edição, substituição de mídia, reagendamento e cancelamento. Confirmação de publicação exige declaração explícita do usuário e fica identificada como confirmação manual.
- A conversão de fuso rejeita datas passadas, datas inválidas e horários locais inexistentes na mudança de horário. Não foram implementadas integrações de Facebook Stories, TikTok ou Kwai.

### Testes e verificações

- Testes focados de conversão, autenticação, isolamento, criação, edição, cancelamento e ações manuais: **7 testes passaram**.
- Testes PostgreSQL PGlite cobrem RLS, transição única de vencidas, idempotência e configuração de cron. PGlite não contém a extensão real `pg_cron`; a migração do cron foi validada com stubs controlados. O agendamento real remoto ainda depende de aplicação/consulta no Supabase.
- Suíte completa `npm test`: **261 testes passaram, 0 falharam**.
- `npm run typecheck` e `npm run typecheck:edge`: aprovados.
- `npm run lint`: zero erros; quatro avisos preexistentes em controladores Kaggle (`ana_midi_controller.ts`, `ana_six_controller.ts`, `research_controller.ts`).
- `npm run build:pages`: build estático Cloudflare concluído com 26 rotas.
- O primeiro teste completo encontrou a migração `pg_cron` incompatível com o PGlite usado por testes preexistentes. A migração de extensão foi separada; o helper agora omite somente esse arquivo real e o teste dedicado substitui a extensão por stubs. A suíte completa foi executada novamente e passou.

### Branch, publicação e pendências

- Branch local analisada: `main`, inicialmente no commit `90477a0`, sincronizada com `origin/main`. O arquivo não rastreado `alteracoes-pendentes.patch` foi preservado. A worktree `feat/public-catalog-five-marketplaces` e o Worker `gilfinanceiro` não foram alterados.
- Commit `c943e200a0c9ef18878f99b9bb185fb3f5dbf4b5` criado na `main` e push confirmado; `origin/main` e a API do GitHub apontam para o mesmo hash. O commit inclui apenas os 17 arquivos listados acima. `alteracoes-pendentes.patch` foi preservado com SHA-256 `5e483d41749a208cb78dd3585afb83037c109e4ef7670e3da05ba81e62c49bb1`.
- A worktree `feat/public-catalog-five-marketplaces` não foi modificada por esta atividade; permanece com as alterações locais preexistentes e agora está dois commits atrás da `origin/main`. O Worker `gilfinanceiro` não foi alterado.
- Estado desta implementação: código e documentação commitados e enviados, mas ainda não publicados nos serviços. GitHub CLI está autenticado. A CLI Supabase rejeitou o token local por formato inválido (`sbp_...` esperado) e não há senha de conexão do banco. Wrangler reconhece uma identidade, mas a consulta de deployments e a API Cloudflare retornaram “No access to the specified resource” para `meu-vendedor`. Não foi feita migração, deploy de Edge Function ou publicação Cloudflare; a versão remota atual não foi verificada.
- Não declarar como publicado até confirmar a versão ativa, o cron no banco e a transição de um agendamento real de teste. Não alterar Secrets existentes.
- Próximo trabalho de redes sociais está somente planejado no bloco **PRÓXIMA ETAPA — COMPARTILHAMENTO EM REDES SOCIAIS** deste arquivo de continuidade.

## 12/11/2026 — TikTok como destino assistido e correção do agendamento

### Instrução e diagnóstico

O responsável pediu retomar o agendamento existente, preservar o modo assistido e adicionar TikTok como destino independente, além de validar Pinterest + TikTok para 20/11/2026 às 18:00 em `America/Sao_Paulo` (21:00 UTC). Também pediu verificar migrações, função, cron e Worker existentes, executar os testes, atualizar a documentação e publicar somente após validação. Nenhuma publicação real em rede foi autorizada.

Antes das alterações foram consultados integralmente os 52 arquivos Markdown versionados, incluindo `historico.md`, `CONTINUAR_AMANHA.md`, `PUBLICACAO.md`, instruções do agente e documentos de infraestrutura. Branch `main` estava em `a4f5b02c747ffa584445e8c8e1b65e8d62dc97e8`, alinhada a `origin/main`; o arquivo não rastreado `alteracoes-pendentes.patch` e a worktree independente `feat/public-catalog-five-marketplaces` foram preservados.

A auditoria confirmou que faltava um destino TikTok no frontend, tipo da Edge Function e constraint SQL. Também identificou uma falha que bloqueava toda criação pelo composer: ele envia `destinations` (lista), mas a Edge Function exigia `destination` singular antes de tratar a lista.

### Correções e arquivos relacionados

- Adicionado `tiktok_video` como opção própria de publicação assistida em `src/lib/publication-scheduling.ts`; mantido `other_app`.
- Atualizada a tipagem de seleção do composer e adicionada orientação explícita no painel para conferir a postagem no TikTok. Nenhum envio automático ou nova API social foi implementado.
- Atualizado `supabase/functions/publication-schedule/_shared/handler.ts` para validar a lista de destinos, permitir criação sem campo singular e validar o destino singular na edição. Mantida a validação de origem da Shopee.
- Criada a migração aditiva `supabase/migrations/20261112190000_publication_tiktok_destination.sql`; não altera nem recria tabelas.
- Testes exercitam o payload real da interface sem `destination` singular, o horário UTC solicitado, dois destinos, dois registros com a mesma chave/conteúdo e transições de estado independentes. PGlite aceita a nova constraint; não houve postagem real.
- Documentação atualizada em `PUBLICACAO.md` e `CONTINUAR_AMANHA.md`. As futuras integrações de Stories do Facebook, publicação no perfil do TikTok e Kwai foram mantidas; foi acrescentada a melhoria futura de compartilhamento via Android/iPhone.

### Validação local e limitações remotas

- Testes focados de agendamento/banco: **8 passaram**. Suíte completa: **262 passaram, 0 falharam**.
- `npm run typecheck` e `npm run typecheck:edge`: aprovados.
- `npm run lint`: zero erros; quatro avisos preexistentes em controladores Kaggle.
- `npm run build:pages`: build estático para o Worker concluído; 26 rotas geradas.
- O teste do cenário solicitado fixa o relógio de referência para evitar que o caso passe a ser inválido quando a data de novembro de 2026 ficar no passado. A correspondência local `18:00` → `21:00 UTC` foi confirmada; a inserção equivalente no Supabase remoto ainda não foi possível.
- Supabase remoto `jzchlrvxdaffnrgbvabv`: a API Management respondeu **HTTP 401** ao token disponível. Não há CLI Supabase instalada nem conector Supabase autorizado nesta sessão. Nenhuma migração foi aplicada ou verificada remotamente; nenhuma versão da Edge Function, cron real ou fluxo de usuário autenticado remoto foi validada.
- Cloudflare: Wrangler reconhece a conta `2cd6c753710fbaba6b94e33ef662c9b3`, mas a listagem de deployments do Worker existente `meu-vendedor` falhou com “No access to the specified resource” (**HTTP 403**). Nenhum deploy foi executado; o Worker `gilfinanceiro` não foi consultado nem alterado.
- Ainda não foi possível validar no navegador autenticado salvar/reabrir, editar, reagendar e cancelar dados remotos. Os testes simulados e PGlite não substituem o smoke test remoto.
- O commit `6fc16adac36463a671b163e7192855a9182fa493` foi criado na `main` somente com os arquivos desta correção e enviado a `origin/main`; `git ls-remote` confirmou o mesmo hash. A atualização documental de confirmação permanece neste commit de documentação.
- Não houve deploy, aplicação de migrações, publicação real ou alteração de Secrets. Commit e push não substituem a validação remota; a correção não deve ser declarada concluída em produção.


## 13/11/2026 — Facebook Reels: pausa após falha de autorização

- O responsável cadastrou no Supabase os nomes de Secrets `META_PAGE_ACCESS_TOKEN`, `META_APP_ID`, `META_PAGE_ID`, `META_GRAPH_API_VERSION` e `META_ALLOWED_USER_ID`. Os valores não foram lidos, copiados nem versionados.
- Implementação em `feat/facebook-reels-publishing`: `supabase/functions/facebook-reels/index.ts` (Graph API Meta: start/upload/finish, MP4 até 20 MB, autenticação Supabase e allowlist por UID) e botão de publicação em `src/components/videos/PublicationCenter.tsx`, com confirmação explícita.
- Edge Function `facebook-reels` implantada no projeto `jzchlrvxdaffnrgbvabv` como ACTIVE v4. Pull request de integração: https://github.com/warllemedicao/Meu-Vendedor/pull/8 (rascunho, não mesclado).
- Ambiente separado Cloudflare `meu-vendedor-preview` foi implantado. O responsável tentou enviar o vídeo de teste `Yellow_string_lights_blinking_f29cb7bd.mp4` e recebeu a mensagem exata **“Esta conta não está autorizada a publicar na Página.”**. Isso indica bloqueio na comparação entre o usuário autenticado e `META_ALLOWED_USER_ID`; não demonstra sucesso de upload/publicação na Meta.
- Diagnóstico pendente: comparar com segurança o UID da sessão autenticada no preview com o UID configurado no Secret, sem imprimir tokens ou dados sensíveis. Há três contas em Authentication > Users; foi orientado configurar apenas o UID da conta que faz login no Meu Vendedor. Confirmar se o preview está logado nessa conta e se o Secret contém somente o UUID correto, sem espaços extras. Não contornar a allowlist nem autorizar todas as contas automaticamente.
- Vídeo fornecido para teste: MP4 ~1,26 MB, ~7,93 s, H.264/AAC, 1280×720 (horizontal 16:9). Reels prefere 9:16; eventual rejeição por formato precisa ser tratada separadamente.
- **Nenhuma publicação real confirmada.** Não afirmar que o vídeo chegou à Página; não reenviar sem nova autorização. Ainda faltam teste autenticado ponta a ponta, confirmação de processamento/publicação pela Meta, testes completos de frontend e implantação validada em produção.
- **Instrução vigente do responsável:** parar o desenvolvimento/testes por agora e **alterar somente arquivos Markdown**, com commit e push no GitHub. Não editar código, não mexer em Secrets, não publicar novos Workers/Edge Functions e não gastar créditos de geração.
- Na retomada: (1) verificar UID correto e sessão no preview; (2) revisar configuração da função e erro 403 sem revelar credenciais; (3) executar testes e validar limites; (4) testar um MP4 autorizado, verificar estado final na Página; (5) somente após aprovação, revisar/mesclar PR #8 e publicar frontend principal.

## 13/11/2026 — Correção diagnóstica do bloqueio Facebook Reels

- Confirmado no código que HTTP 403 `forbidden` ocorre quando `auth.getUser()` retorna UID diferente de `META_ALLOWED_USER_ID`; a Meta não recebe o vídeo nessa situação. Supabase confirma três contas Auth, sem determinar qual é a conta autorizada.
- Atualizada `src/components/videos/PublicationCenter.tsx` para apresentar, somente ao usuário autenticado que receber esse erro, o próprio UID Supabase e opção de copiá-lo, com instrução para configurar o Secret somente após confirmar que é a conta proprietária. A restrição do backend não foi removida.
- Commit de código `ff603e18da3f38a6cace45f247db258cc55090b3` enviado à branch `feat/facebook-reels-publishing`. Workflow de preview configurado para disparar nessa branch; validar resultado da implantação e testes antes de declarar disponibilidade.
- **Bloqueio ainda pendente:** conector Supabase não permite editar Secrets, e não há comprovação de qual das três contas é a autorizada. É necessária confirmação da conta e atualização segura de `META_ALLOWED_USER_ID` no painel Supabase. Não publicar teste nem integrar à main até essa validação.



## 2026-11-14 — Hyperbrowser: perfil por usuário e controles iniciais

- Supabase: migração `hyperbrowser_profiles_server_only` aplicada; tabela `public.hyperbrowser_profiles` com RLS e sem permissões diretas para `anon` ou `authenticated`. Armazena apenas associação entre usuário e ID do perfil.
- Edge Function `hyperbrowser-profile` v2 publicada com JWT obrigatório, consulta do usuário via Auth, ações `status` e `create-profile`, CORS para o cliente Supabase e leitura da chave `HYPERBROWSER_API_KEY` exclusivamente no servidor.
- Frontend: componente `HyperbrowserProfile.tsx` integrado em `AccountHub.tsx`, seção Lojas e redes, com verificação e criação de perfil usando a sessão Supabase do usuário.
- Commits GitHub: `ab29be5` e `519fb70`. A publicação do frontend no Cloudflare, a execução autenticada, a criação real do perfil e a compatibilidade do SDK Hyperbrowser ainda NÃO foram comprovadas.
- Pendências obrigatórias: testar autenticação da API Key, criar perfil real, sessão com `persistChanges: true`, espelhamento interativo, login Google e 2FA normais, Playwright para upload/prompt, geração autorizada, download MP4, importação Supabase e deploy Cloudflare. Não declarar geração Flow pronta.


## 15/11/2026 — Google Flow: preparar login remoto com perfil persistente

- Supabase: tabela `hyperbrowser_profiles` recebeu `session_id`, `session_started_at`, `login_saved`; Edge Function `hyperbrowser-profile` v3 ACTIVE com ações `status`, `create-profile`, `start-login` e `save-login`, JWT obrigatório e chave protegida no servidor.
- `start-login` cria perfil quando ausente e inicia sessão Hyperbrowser com `persistChanges: true`, retornando URL de Live View somente ao usuário autenticado. `save-login` encerra sessão pelo SDK para persistir estado. `status` não abre navegador. A indicação `login_saved` registra encerramento/salvamento do perfil, não comprova autenticação Google.
- Interface: `HyperbrowserProfile.tsx` exibe somente marca Google Flow e oferece Abrir Google Flow para login, Salvar acesso e fechar, Verificar conexão, janela Live View e opção de tela cheia. A navegação até labs.google/fx/tools/flow deve ser feita pelo usuário na janela remota.
- Atenção: sem teste ponta a ponta com JWT do usuário, sem prova de API Key funcional, sem prova de sessão persistida, sem deploy Cloudflare (conector Cloudflare indisponível). Não declarar ferramenta publicada ou login pronto em produção. A sessão remota pode gerar consumo de créditos do provedor.
