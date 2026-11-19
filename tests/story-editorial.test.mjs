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
