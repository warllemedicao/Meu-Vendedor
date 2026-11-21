import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const code = readFileSync(new URL("../src/components/stories/StoriesStudio.tsx", import.meta.url), "utf8");

test("generated themes are staged for review rather than written automatically", () => {
  assert.match(code, /setDraftTopics\(previous => \[\.\.\.previous, \.\.\.batch\]\)/);
  assert.match(code, /saveDraftTopics/);
  assert.match(code, /Temas gerados — revisão/);
  assert.match(code, /Salvar todos os temas/);
  assert.match(code, /Descartar/);
});
test("topic catalog has independent genre, subject, search and favorites filters", () => {
  for (const field of ["subjectFilter", "genreFilter", "query", "onlySaved"]) assert.ok(code.includes(field));
});
test("editable characters and scenes preserve identity and chronology", () => {
  assert.match(code, /function updateCharacter/);
  assert.match(code, /previousName === nextName/);
  assert.match(code, /Cenas prontas para produzir/);
  assert.match(code, /Imagens dos personagens/);
  assert.match(code, /Transição e ligação com a próxima cena/);
});
test("character name editor preserves spaces until committed and persists the new name with scene references", () => {
  assert.match(code, /const \[characterNameDrafts, setCharacterNameDrafts\] = useState/);
  assert.match(code, /value=\{characterNameDrafts\[project\.id \+ ":" \+ ci\] \?\? char\.name\}/);
  assert.match(code, /onChange=\{e => setCharacterNameDrafts/);
  assert.match(code, /onBlur=\{\(\) => applyCharacterName\(ci\)\}/);
  assert.match(code, /function applyCharacterName\(index: number\)/);
  assert.match(code, /function syncDialogueSpeakerDrafts\(projectId: string/);
  assert.match(code, /raw\.split\("\\n"\)/);
  assert.match(code, /let working = project/);
  assert.match(code, /const draftKeys = Object\.keys\(characterNameDrafts\)/);
  assert.match(code, /\.update\(\{ scenes: working\.scenes, characters: working\.characters/);
  assert.match(code, /setProject\(\{ \.\.\.working, status:/);
  assert.doesNotMatch(code, /onChange=\{e => updateCharacter\(ci,\{name:e\.target\.value\}\)\}/);
});

test("new image names are saved without overwriting a previous image or exposing extra UI", () => {
  assert.match(code, /async function checkImageNameAvailable\(name: string\)/);
  assert.match(code, /await checkImageNameAvailable\(imageNames\[characterIndex\]/);
  assert.match(code, /await checkImageNameAvailable\(name\)/);
  const block = code.split("async function persistCharacterImage(")[1]?.split("async function chooseLibraryImage(")[0] || "";
  assert.match(block, /\.from\("mv_story_characters"\)\.insert\(\{/);
  assert.doesNotMatch(block, /upsert\(/);
  assert.match(block, /if \(libraryError\) throw new Error/);
  assert.match(code, /value=\{libraryNameDrafts\[entry\.id\] \?\? entry\.name\}/);
  assert.match(code, /renameLibraryCharacter\(entry, libraryNameDrafts\[entry\.id\] \?\? entry\.name\)/);
  assert.doesNotMatch(code, /window\.prompt\("Renomear personagem"/);
});

test("prompts can be edited, saved, copied and checked for YouTube Create limit", () => {
  assert.match(code, /saveEditedPrompt/);
  assert.match(code, /countStoryPromptCharacters\(current\.text\) > maximum/);
  assert.match(code, /loadPlatformPrompts/);
  assert.match(code, /Salvar edição/);
});
test("scene clips can be previewed and approved without claiming publication", () => {
  assert.match(code, /approveClip/);
  assert.match(code, /createSignedUrl/);
  assert.match(code, /Retirar aprovação/);
  assert.match(code, /montagem automática e o envio direto às plataformas ainda não estão habilitados/i);
});
test("social publication choices do not trigger social APIs", () => {
  for (const channel of ["youtube", "tiktok", "kwai"]) assert.ok(code.includes(channel));
  assert.doesNotMatch(code, /fetch\(["']https:\/\/(www\.)?(youtube|tiktok|kwai)/);
});


test("script generates twelve scenes in persisted Gemini blocks", () => {
  assert.match(code, /await generateFullScript\(data as Project, topic\.synopsis\)/);
  assert.match(code, /onClick=\{\(\) => void generateScript\(t\)\}>Roteiro<\/button>/);
  assert.match(code, /setExpandedScene\(startScene\)/);
  assert.match(code, /selected\.scenes\.reduce\(\(last, s\)/);
});

test("Roteiro reopens existing saved topic before inserting or calling Gemini", () => {
  const handler = code.slice(code.indexOf("  async function generateScript(topic: Topic"), code.indexOf("  async function generateFullScript(working:"));
  assert.match(handler, /startingScriptRef\.current = true/);
  assert.match(handler, /if \(!createNewVersion\)/);
  assert.match(handler, /\.from\("mv_story_projects"\)/);
  assert.match(handler, /\.eq\("user_id", user\.id\)\.eq\("topic_id", topic\.id\)/);
  assert.match(handler, /\.limit\(1\)\.maybeSingle\(\)/);
  assert.match(handler, /if \(lookupError\) throw new Error/);
  assert.match(handler, /await openProject\(existing as Project\)/);
  assert.match(handler, /setMessage\("Roteiro existente recuperado sem consumir tokens de IA/);
  assert.ok(handler.indexOf("if (!createNewVersion)") < handler.indexOf(".insert({"), "The saved-project lookup must precede insert");
  assert.ok(handler.indexOf("await openProject(existing as Project)") < handler.indexOf("await generateFullScript(data as Project"), "Reuse must return before inference");
  assert.match(handler, /finally \{ startingScriptRef\.current = false; setBusy\(false\)/);
});

test("creating an additional Gemini script requires a separate explicit confirmation", () => {
  assert.match(code, /onClick=\{\(\) => void generateScript\(t\)\}>Roteiro<\/button>/);
  assert.match(code, /window\.confirm\("Criar uma nova versão do roteiro\?/);
  assert.match(code, /void generateScript\(t, true\)/);
  assert.match(code, /Nova versão \(Gemini\)/);
});

test("dialogue editing retains raw whitespace and checks incomplete lines before saving", () => {
  assert.match(code, /const \[sceneDialogueDrafts, setSceneDialogueDrafts\] = useState/);
  assert.match(code, /value=\{sceneDialogueDrafts\[project\.id \+ ":" \+ s\.number\] \?\?/);
  assert.match(code, /setSceneDialogueDrafts\(old => \(\{ \.\.\.old, \[project\.id \+ ":" \+ s\.number\]: raw \}\)\)/);
  assert.match(code, /updateScene\(i, \{ dialogue: parseStoryDialogueDraft\(raw\)\.dialogue \}\)/);
  assert.match(code, /function invalidDialogueMessage\(sceneNumber: number\)/);
  assert.match(code, /if \(dialogueIssue\) return setError\(dialogueIssue\)/);
  assert.match(code, /setSceneDialogueDrafts\(\{\}\)/);
  assert.doesNotMatch(code, /value=\{s\.dialogue\.map\(d => d\.speaker \+ ": " \+ d\.text\)\.join\("\\n"\)\}/);
});

test("compact script editor displays saved scene content and collapses others", () => {
  assert.match(code, /const expanded = expandedScene === s\.number/);
  assert.match(code, /aria-expanded=\{expanded\}/);
  assert.match(code, /\{\(expanded \|\| sceneWorkbenchStep === "prompt"\) && <div id=\{"story-fields-" \+ s\.number\}/);
  assert.match(code, /\{filled \? s\.action : "Cena ainda não gerada/);
  assert.match(code, /rows=\{2\}\s*value=\{s\.action\}/);
  assert.match(code, /value=\{s\.setting\}/);
  assert.match(code, /value=\{sceneDialogueDrafts\[project\.id/);
  assert.match(code, /value=\{s\.transition\}/);
});

test("story character library can upload, reuse, rename, generate optionally and download privately", () => {
  for (const needle of ["loadCharacterLibrary", "mv_story_characters", "mv-story-images",
    "chooseLibraryImage", "renameLibraryCharacter", "uploadReference", "generateCharacterReference",
    "downloadReference", "HIST_IMAGEM_GEMINI_API_KEY"]) {
    assert.ok(code.includes(needle), "Missing " + needle);
  }
  assert.match(code, /createSignedUrl\(entry\.storage_path, 600\)/);
  assert.match(code, /\.eq\("id", project\.id\)\.eq\("user_id", user\.id\)/);
  assert.match(code, /referenc[eE]ImagePath/);
});

test("every completed scene supports separate video provider, prompt and downloads", () => {
  assert.match(code, /selectedPlatformByScene\[s\.number\]/);
  assert.match(code, /prepareScenePrompt\(s\.number,\s*false\)/);
  assert.match(code, /prepareScenePrompt\(s\.number,\s*true\)/);
  assert.match(code, /saveScenePrompt\(s\.number\)/);
  assert.match(code, /downloadTextFile\("cena-" \+ s\.number/);
  assert.match(code, /downloadReference\(char\.referenceImagePath!/);
  assert.match(code, /Gerar bloco a partir da cena \{s\.number\} · Gemini/);
  assert.match(code, /Falha ao consultar prompt anterior. Nenhum crédito de IA foi utilizado/);
});

test("save partial scene drafts without requiring all twelve scenes to be filled", () => {
  assert.match(code, /if \(approve && working\.scenes\.some\(s => !s\.action\.trim\(\) \|\| !s\.setting\.trim\(\)\)\)/);
  assert.match(code, /working\.scenes\.filter\(s => s\.action\.trim\(\) \|\| s\.setting\.trim\(\)\)/);
  assert.match(code, /Rascunho salvo/);
  assert.match(code, /Aprovar roteiro e liberar prompts/);
});

test("single scene studio keeps future scenes hidden and avoids duplicate next-stage controls", () => {
  assert.match(code, /project\.scenes\.filter\(s => s\.number === expandedScene\)\.map/);
  assert.doesNotMatch(code, /Mostrar todas as 12 cenas e pendências/);
  assert.match(code, /sceneWorkbenchStep === "personagens"/);
  assert.match(code, /sceneWorkbenchStep === "prompt"/);
  assert.match(code, /Concluir preparação · Ir para cena/);
  assert.match(code, /stage !== "roteiro" && <footer/);
  assert.doesNotMatch(code, /Ir adiante: gerar próxima cena/);
  assert.match(code, /async function advanceToNextScene\(sceneNumber: number\)/);
  assert.match(code, /if \(promptSaveError\) throw new Error/);
  assert.match(code, /await generateOneBlock\(project\)/);
});

test("advanced generation section contains no incomplete legacy Flash-Lite button", () => {
  const section = code.split('Opções avançadas de geração (manual, pode consumir cota)')[1]
    ?.split('Quatro cenas por chamada, sem retentativa após erro')[0] || "";
  assert.match(section, /A geração de cenas restantes está disponível no topo do quadro/);
  assert.doesNotMatch(section, /<button\b/);
  assert.doesNotMatch(code, /generateNextSceneLite/);
});

test("saved prompts can be reused or explicitly regenerated with Gemini", () => {
  assert.match(code, /if \(existing\?\.prompt && useGemini\)/);
  assert.match(code, /window\.confirm\("Já existe um prompt salvo nesta cena\. Gerar uma nova versão com Gemini\?/);
  assert.match(code, /Prompt salvo recuperado sem gastar créditos de IA/);
  assert.match(code, /setSceneWorkbenchStep\("prompt"\)/);
});

test("story prompt download enforces platform cap and tells the user what to do after copying", () => {
  assert.match(code, /countStoryPromptCharacters\(scenePromptText\) > PLATFORM_GUIDES\[chosenPlatform\]\.absoluteChars/);
  assert.match(code, /copyScenePrompt\(s\.number, chosenPlatform, scenePromptText\)/);
  assert.match(code, /Prompt copiado\. Agora crie o vídeo/);
  assert.match(code, /Importar MP4 desta cena/);
  assert.match(code, /prepareScenePrompt\(s\.number,\s*false\)/);
});

test("single-scene mobile view avoids duplicate 12-scene grid", () => {
  assert.match(code, /Cenas prontas para produzir/);
  assert.doesNotMatch(code, /Mostrar todas as 12 cenas e pendências/);
  assert.match(code, /Cena \{expandedScene\}\/12/);
  assert.doesNotMatch(code, /Tentar Flash-Lite/);
});

test("multiple character images are accepted and preserved one by one", () => {
  assert.match(code, /async function uploadCharacterBatch\(files: FileList \| null\)/);
  assert.match(code, /type="file" multiple accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(code, /for \(const file of list\)/);
  assert.match(code, /characters\.findIndex\(ch => !ch\.referenceImagePath\)/);
  assert.match(code, /setProject\(prev => prev\?\.id === project\.id/);
  assert.match(code, /Imagens dos personagens/);
  assert.match(code, /Gerar com Nano Banana \(opcional\)/);
});

test("character image selection prioritizes the current scene, style and thumbnail choices", () => {
  assert.match(code, /scene\.characters\.includes\(character\.name\)/);
  assert.match(code, /role="group" aria-label=\{"Escolher imagem para " \+ char\.name\}/);
  assert.match(code, /aria-pressed=\{path === entry\.storage_path\}/);
  assert.match(code, /chooseLibraryImage\(ci,entry\)/);
  assert.match(code, /editingCharacterIndex === ci/);
  assert.match(code, /addingCharacterImageIndex === ci/);
  assert.match(code, /Ver imagens antigas ou de outros tipos/);
  assert.match(code, /entry\.storage_path\.includes\("\/library\/" \+ project\.character_style \+ "\/"\)/);
  assert.match(code, /"\/library\/" \+ \(project\.character_style \|\| "nao_definido"\) \+ "\/"/);
});

test("prompt stage stays compact with visual providers and two explicit generation methods", () => {
  assert.match(code, /sceneWorkbenchStep === "prompt" \? <h3/);
  assert.match(code, /aria-label="Personagens desta cena"/);
  assert.match(code, /aria-label="Ferramenta para gerar o prompt"/);
  assert.match(code, /aria-pressed=\{chosenPlatform === item\.value\}/);
  assert.match(code, /"\/stories\/tools\/" \+ item\.value \+ "\.svg"/);
  assert.match(code, /Gerar prompt sem IA/);
  assert.match(code, /Gerar prompt com Gemini/);
  assert.match(code, /\{scenePromptText\.trim\(\) && <>/);
  assert.match(code, /sceneWorkbenchStep !== "prompt" && <nav/);
  assert.match(code, /Outras opções e imagens para baixar/);
  for (const name of ["youtube-create", "google-flow", "dreamina"]) {
    const svg = readFileSync(new URL("../public/stories/tools/" + name + ".svg", import.meta.url), "utf8");
    assert.match(svg, /^<svg /);
    assert.match(svg, /<\/svg>$/);
  }
});

test("compact project navigation stays hidden on Themes and Roteiro", () => {
  assert.match(code, /stage !== "temas" && stage !== "roteiro" && <details/);
  assert.match(code, /Etapas do projeto/);
  assert.match(code, /STORY_STAGES\.map\(item/);
  assert.doesNotMatch(code, /Estúdio de Histórias|1\. Assuntos e temas|Assunto principal/);
});

test("character style is explicitly selected before topic creation and persisted per topic and project", () => {
  assert.match(code, /setCharacterStyle\] = useState<Exclude<StoryCharacterStyle, "nao_definido"> \| null>\(null\)/);
  assert.match(code, /STORY_CHARACTER_STYLES\.map\(option/);
  assert.match(code, /if \(!characterStyle\) return setError\("Escolha o tipo de personagem/);
  assert.match(code, /characterStyle, count: requested/);
  assert.match(code, /character_style: t\.character_style, saved: true/);
  assert.match(code, /onConflict: "user_id,subject,title,character_style"/);
  assert.match(code, /character_style: topic\.character_style \|\| "nao_definido"/);
  assert.match(code, /characterStyle: working\.character_style \|\| "nao_definido"/);
  assert.match(code, /characterStyle: project\.character_style \|\| "nao_definido"/);
});

test("saved topics allow scoped individual and bulk deletion without deleting story projects", () => {
  assert.match(code, /const \[selectedTopicIds, setSelectedTopicIds\] = useState<string\[\]>\(\[\]\)/);
  assert.match(code, /function toggleTopicSelection\(topicId: string\)/);
  assert.match(code, /const visibleIds = new Set\(visibleTopics\.map\(topic => topic\.id\)\)/);
  assert.match(code, /async function deleteSelectedTopics\(\)/);
  assert.match(code, /window\.confirm\("Excluir definitivamente "/);
  assert.match(code, /\.from\("mv_story_topics"\)/);
  assert.match(code, /\.delete\(\)\.eq\("user_id", user\.id\)\.in\("id", batch\)\.select\("id"\)/);
  assert.match(code, /Selecionar todos os temas exibidos/);
  assert.match(code, /Excluir selecionados/);
  assert.match(code, /Roteiros já criados permanecerão salvos/);
});

test("saved topics stay inside a closed-by-default filter and rows show only title", () => {
  const start = code.indexOf('Filtrar e ver temas salvos');
  const end = code.indexOf('<section className={panel} hidden={stage !== "roteiro"}>', start);
  assert.ok(start >= 0 && end > start);
  const library = code.slice(start, end);
  assert.match(library, /truncate text-sm font-semibold/);
  assert.doesNotMatch(library, /\{t\.synopsis\}/);
  assert.match(code.slice(start - 170, start), /<details className=/);
  assert.match(library, /Selecionar todos os temas exibidos/);
  const draftStart = code.indexOf('Temas gerados — revisão');
  assert.ok(draftStart >= 0 && start > draftStart);
  assert.doesNotMatch(code.slice(draftStart, start), /\{t\.synopsis\}/);
});

test("legacy theme style filter limits bulk deletion to visible owner-scoped selections", () => {
  assert.match(code, /characterStyleFilter, setCharacterStyleFilter/);
  assert.match(code, /characterStyleFilter === "todos" \|\|/);
  assert.match(code, /value="nao_definido">Sem estilo \(antigos\)/);
  assert.match(code, /const selectedVisibleCount = visibleTopics\.filter/);
  assert.match(code, /const allVisibleSelected = visibleTopics\.length > 0/);
  assert.match(code, /const checked = e\.target\.checked/);
  assert.match(code, /current\.filter\(id => !visibleIds\.has\(id\)\)/);
  assert.match(code, /topics\.some\(topic => topic\.id === id && topic\.user_id === user\.id\)/);
  assert.match(code, /for \(let index = 0; index < ids\.length; index \+= 50\)/);
  assert.match(code, /await Promise\.all\(\[loadTopics\(\), loadProjects\(\)\]\)/);
});

test("compact theme draft list has a balanced JSX map expression", () => {
  const begin = code.indexOf("{draftTopics.map(t => <article");
  const end = code.indexOf("{!draftTopics.length &&", begin);
  assert.ok(begin >= 0 && end > begin, "The compact draft list must exist");
  const markup = code.slice(begin, end).trim();
  assert.match(markup, /<\/article>\)\}$/);
  assert.doesNotMatch(markup, /<\/article>\)\s*$/);
});

test("Themes has image-only style cards and hides empty results by default", () => {
  assert.match(code, /<h2 className="text-lg font-semibold">Temas<\/h2>/);
  assert.match(code, /<label className="block text-sm font-medium">Tema\n/);
  for (const style of ["frutinhas", "infantil", "pessoas-cabeca-fruta"]) {
    assert.ok(code.includes("/stories/styles/" + style + ".svg"), "Missing character thumbnail: " + style);
    const svg = readFileSync(new URL("../public/stories/styles/" + style + ".svg", import.meta.url), "utf8");
    assert.match(svg, /^<svg /);
    assert.match(svg, /<\/svg>$/);
  }
  assert.match(code, /aria-label=\{"Tipo de personagem: " \+ option\.label\}/);
  assert.match(code, /aria-pressed=\{characterStyle === option\.value\}/);
  assert.doesNotMatch(code, /option\.description/);
  assert.match(code, /hidden=\{stage !== "temas" \|\| draftTopics\.length === 0\}/);
  assert.doesNotMatch(code, /Selecione de 5 a 20 temas por geração/);
});
