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
  assert.match(code, /Linha do tempo de 12 cenas/);
  assert.match(code, /Bíblia de personagens/);
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
  assert.match(code, /setExpandedScene\(Math\.max\(1, selected\.scenes\.findIndex/);
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
  assert.match(code, /Gerar próxima cena com Gemini/);
  assert.match(code, /Falha ao consultar prompt anterior. Nenhum crédito Gemini foi utilizado/);
});
