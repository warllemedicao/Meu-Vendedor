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
test("prompts can be edited, saved, copied and checked for YouTube Create limit", () => {
  assert.match(code, /saveEditedPrompt/);
  assert.match(code, /Array\.from\(current\.text\)\.length > maximum/);
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


test("script starts generating the first scene automatically after persisting draft", () => {
  assert.match(code, /await generateOneScene\(data as Project, topic\.synopsis\)/);
  assert.match(code, /Criar roteiro e gerar cena 1/);
  assert.match(code, /setExpandedScene\(sceneNumber\)/);
  assert.match(code, /selected\.scenes\.reduce\(\(last, s\)/);
});

test("compact script editor displays saved scene content and collapses others", () => {
  assert.match(code, /const expanded = expandedScene === s\.number/);
  assert.match(code, /aria-expanded=\{expanded\}/);
  assert.match(code, /\{expanded && <div id=\{"story-fields-" \+ s\.number\}/);
  assert.match(code, /\{filled \? s\.action : "Cena ainda não gerada/);
  assert.match(code, /rows=\{2\}\s*value=\{s\.action\}/);
  assert.match(code, /value=\{s\.setting\}/);
  assert.match(code, /value=\{s\.dialogue\.map/);
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
  assert.match(code, /prepareScenePrompt\(s\.number, false\)/);
  assert.match(code, /prepareScenePrompt\(s\.number, true\)/);
  assert.match(code, /saveScenePrompt\(s\.number\)/);
  assert.match(code, /downloadTextFile\("cena-" \+ s\.number/);
  assert.match(code, /downloadReference\(char\.referenceImagePath!/);
  assert.match(code, /Gerar cena \{s\.number\} · Gemini Flash/);
  assert.match(code, /Falha ao consultar prompt anterior. Nenhum crédito Gemini foi utilizado/);
});

test("save partial scene drafts without requiring all twelve scenes to be filled", () => {
  assert.match(code, /if \(approve && project\.scenes\.some\(s => !s\.action\.trim\(\) \|\| !s\.setting\.trim\(\)\)\)/);
  assert.match(code, /project\.scenes\.filter\(s => s\.action\.trim\(\) \|\| s\.setting\.trim\(\)\)/);
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
  assert.match(code, /await generateOneScene\(project\)/);
});

test("story prompt download enforces platform cap and tells the user what to do after copying", () => {
  assert.match(code, /Array\.from\(scenePromptText\)\.length > PLATFORM_GUIDES\[chosenPlatform\]\.absoluteChars/);
  assert.match(code, /copyScenePrompt\(s\.number, chosenPlatform, scenePromptText\)/);
  assert.match(code, /Prompt copiado\. Agora crie o vídeo/);
  assert.match(code, /Importar MP4 desta cena/);
  assert.match(code, /prepareScenePrompt\(s\.number, false\)/);
});

test("single-scene mobile view avoids duplicate 12-scene grid", () => {
  assert.match(code, /Cenas prontas para produzir/);
  assert.doesNotMatch(code, /Mostrar todas as 12 cenas e pendências/);
  assert.match(code, /Cena \{expandedScene\}\/12/);
  assert.match(code, /Tentar Flash-Lite/);
});

test("multiple character images are accepted and preserved one by one", () => {
  assert.match(code, /async function uploadCharacterBatch\(files: FileList \| null\)/);
  assert.match(code, /type="file" multiple accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(code, /for \(const file of list\)/);
  assert.match(code, /characters\.findIndex\(ch => !ch\.referenceImagePath\)/);
  assert.match(code, /setProject\(prev => prev\?\.id === project\.id/);
  assert.match(code, /Imagens dos personagens/);
  assert.match(code, /Gerar imagem com Nano Banana/);
});
