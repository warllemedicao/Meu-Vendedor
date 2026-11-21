## Interface compacta e biblioteca — 21/11/2026

- O painel **Personagens da história** não contém mais texto explicativo. Miniaturas reduzidas a 80 × 80 px, em cartões compactos, com seleção por clique.
- Cada cartão possui **Renomear** e **Excluir**. Renomear altera o nome do registro privado na biblioteca; roteiros existentes preservam as fichas que já foram salvas.
- Excluir consulta previamente todos os roteiros do proprietário e bloqueia remoção de referências ainda vinculadas; o usuário deve desvincular/trocar a imagem no roteiro antes de excluí-la. Após excluir o registro, a ferramenta tenta remover o arquivo privado do Storage e avisa se a limpeza falhar.
- O cadastro foi simplificado para o botão **Enviar imagens**. O seletor aceita vários arquivos PNG/JPG/WebP, até 10 MB cada, e abre um campo de **nome do personagem por imagem** antes de salvar o lote.
- Não é mais necessário preencher uma descrição ou prompt ao carregar imagens. Quando a ficha não possui descrição textual, o sistema usa o nome e a referência visual salva como base, sem inventar aparência.
- Arquivos são registrados separadamente e nunca sobrescritos; sucesso parcial é mantido e informado. O usuário seleciona até quatro personagens para uma história, mas pode salvar várias imagens na biblioteca.

# Histórias — seleção de personagens antes do roteiro

Atualização: 21/11/2026.

## Objetivo

Permitir escolher personagens **salvos pelo próprio usuário** antes de criar um roteiro. Seus nomes, imagens, prompts e vozes deixam de ser substituídos por personagens inventados pelo Gemini.

## Fluxo para o usuário

1. Entre em **Histórias → Temas** e escolha o tipo visual (Frutinhas, Infantil ou Pessoas com cabeça de fruta).
2. Abra **Personagens da história** e selecione de 1 a 4 personagens da biblioteca privada. As opções mostram imagem e nome, e a seleção fica visível.
3. Caso ainda não exista personagem, abra **Cadastrar personagem com imagem e prompt próprios**, informe o nome, a descrição/prompt visual e envie uma imagem PNG/JPG/WebP (até 10 MB). Clique em **Salvar personagem**. O novo registro é selecionado automaticamente quando houver vaga.
4. Escolha um tema salvo e clique em **Roteiro**; o aplicativo salva as fichas escolhidas no projeto antes de chamar o Gemini.
5. O Gemini gera 12 cenas em blocos 1–4, 5–8 e 9–12. As fichas permanecem vinculadas a todas as cenas e aos prompts para YouTube Create, Google Flow e Dreamina.
6. Ao reabrir um roteiro existente, suas fichas e cenas salvas são reutilizadas sem nova geração.

## Regras implementadas

- Seleção entre 1 e 4 personagens; nomes sem repetição, imagens do mesmo tipo visual do tema. Temas antigos sem estilo definido aceitam personagens existentes de qualquer estilo.
- Versões de imagem gravadas com sufixo técnico hexadecimal de oito caracteres exibem e transmitem ao roteiro o nome original sem esse sufixo; a verificação de duplicatas usa o nome limpo.
- A origem é `mv_story_characters`, protegida por RLS e arquivos privados em `mv-story-images`.
- A ficha inclui `name`, `role`, `visual`, `voice`, `referenceImagePath` e `referenceImagePrompt`. Para perfis antigos sem papel ou voz, o projeto fornece valores neutros; não inventa identidade nova.
- `image_prompt` salvo na biblioteca tem prioridade para `visual`; a descrição continua como alternativa.
- O primeiro bloco Gemini recebe o mesmo elenco dos blocos seguintes. O backend normaliza e reutiliza o elenco recebido como fonte autoritativa, ignora alterações de identidade sugeridas pelo modelo e valida nomes nas cenas e falas.
- Cada bloco concluído é salvo no Supabase antes da próxima chamada. Falhas preservam o que já estava salvo.
- Cadastro com imagem manual não depende de API paga. Geração automática por Nano Banana segue a proteção de custos descrita no documento de imagens.
- Projetos antigos continuam com suas fichas originais; não há migração destrutiva e a interface não renomeia registros antigos.

## Arquivos envolvidos

- `src/components/stories/StoriesStudio.tsx`
- `supabase/functions/story-studio/index.ts`
- `tests/story-studio.test.mjs`
- `tests/story-editorial.test.mjs`

## Verificação e publicação

A implementação foi enviada à branch `main`. Para liberar a interface de seleção, é necessária a aprovação dos testes e uma publicação do frontend Cloudflare. A Edge Function `story-studio` deve ser publicada a partir do mesmo código e ter o Secret `HIST_ROTEIRO_GEMINI_API_KEY` configurado. É necessário testar uma geração autenticada com personagens selecionados; o código não comprova disponibilidade de cota Gemini.
