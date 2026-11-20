import test from "node:test";
import assert from "node:assert/strict";
import { makeLocalPromptDrafts, makeStoryFlowAgentInstructions, countStoryPromptCharacters, parseStoryDialogueDraft, PLATFORM_GUIDES } from "../src/lib/stories/workflow.ts";

const scene = {
  number: 2, durationSeconds: 10, title: "Máquina estranha",
  setting: "Oficina industrial escura, com luzes piscando e motor elétrico antigo.",
  action: "O limão observa um ruído metálico, enquanto a maçã segura o painel. Ambos se assustam quando o equipamento vibra e a luz apaga.",
  characters: ["Limonada", "Morcegão"],
  dialogue: [{ speaker: "Limonada", text: "Não mexe nesse painel, a máquina ainda está ligada!" },
    { speaker: "Morcegão", text: "Pode deixar, vou verificar antes." }],
  transition: "A luz volta na próxima cena",
};
const characters = [
  { name: "Limonada", role: "eletricista industrial especialista", visual: "Limão antropomórfico verde vivo, capacete branco, óculos redondos pretos, roupa verde, botas de segurança e luvas cinzas, animação 3D de personagem original.", voice: "Tom suave e claro, sotaque brasileiro e fala um pouco rápida.", referenceImagePath: "private-image-1" },
  { name: "Morcegão", role: "mecânico industrial experiente", visual: "Personagem original escuro, macacão azul escuro, capacete cinza e botas pretas, cabelo espetado e rosto expressivo, animação 3D consistente.", voice: "Tom grave e áspero, voz brasileira e fala desconfiada.", referenceImagePath: "private-image-2" },
];

test("dialogue parser preserves speakers and full sentence while allowing temporary input gaps", () => {
  const finished = parseStoryDialogueDraft('Maçã: Vamos começar o turno minha amiga, tu vai deixar eu trabalhar hoje né?\nLimão: Pode deixar.');
  assert.deepEqual(finished.invalidLines, []);
  assert.equal(finished.dialogue[0].speaker, "Maçã");
  assert.equal(finished.dialogue[0].text, "Vamos começar o turno minha amiga, tu vai deixar eu trabalhar hoje né?");
  assert.equal(finished.dialogue[1].text, "Pode deixar.");
  assert.deepEqual(parseStoryDialogueDraft("Maçã: \nLimão: ok\nOutra linha").invalidLines, [1, 3]);
  assert.deepEqual(parseStoryDialogueDraft("   \nLimão:  ok  \n").dialogue,
    [{ speaker: "Limão", text: "ok" }]);
});

test("local prompts stay inside their provider cap and preserve every spoken line", () => {
  for (const provider of ["youtube-create", "google-flow", "dreamina"]) {
    const [prompt] = makeLocalPromptDrafts(provider, characters, [scene]);
    assert.ok(countStoryPromptCharacters(prompt.text) <= PLATFORM_GUIDES[provider].absoluteChars);
    for (const line of scene.dialogue)
      assert.ok(prompt.text.includes(line.speaker + ': "' + line.text + '"'));
    assert.ok(prompt.text.includes("Limonada") && prompt.text.includes("Morcegão"));
    assert.ok(!prompt.text.includes("private-image"));
  }
});

test("YouTube Create emits only the first microaction and warns about subsequent actions", () => {
  const [prompt] = makeLocalPromptDrafts("youtube-create", characters, [scene]);
  assert.match(prompt.text, /Single action: O limão observa um ruído metálico/);
  assert.doesNotMatch(prompt.text, /Ambos se assustam quando/);
  assert.match(prompt.notice || "", /primeira microação/);
  assert.ok(countStoryPromptCharacters(prompt.text) <= 900);
  assert.match(prompt.text, /Camera: steady medium shot/);
});

test("YouTube counts whitespace and emoji conservatively", () => {
  assert.equal(countStoryPromptCharacters("A  B\n🍋"), 7);
  const longScene = { ...scene, action: "🍋".repeat(450) };
  assert.throws(() => makeLocalPromptDrafts("youtube-create", characters, [longScene]), /excede 900 caracteres/);
});

test("Dreamina uses stable subject labels and references only when available", () => {
  const [prompt] = makeLocalPromptDrafts("dreamina", characters, [scene], "frutinhas");
  for (const heading of ["Sujeito preciso:", "Ação:", "Ambiente:", "Iluminação e cor:", "Câmera:", "Estilo visual:", "Qualidade/restrições:"])
    assert.ok(prompt.text.includes(heading), "Missing " + heading);
  assert.match(prompt.text, /Sujeito 1/);
  assert.match(prompt.text, /@Imagem 1/);
  assert.match(prompt.notice || "", /não carregam arquivos automaticamente/);
});

test("local prompt refuses a scene whose essential content alone exceeds provider cap", () => {
  const impossible = { ...scene, action: "A".repeat(1500) };
  assert.throws(() => makeLocalPromptDrafts("youtube-create", characters, [impossible]),
    /excede 900 caracteres/);
});

test("platform-specific target does not silently substitute Flow or Dreamina limits for YouTube", () => {
  const [result] = makeLocalPromptDrafts("youtube-create", characters, [scene]);
  assert.ok(Array.from(result.text).length <= 900);
  assert.equal(result.platform, "youtube-create");
  assert.equal(result.scene, 2);
});

test("Flow puts persistent character identity in separate agent instructions", () => {
  const [prompt] = makeLocalPromptDrafts("google-flow", characters, [scene], "frutinhas");
  assert.match(prompt.text, /@Limonada/);
  assert.match(prompt.text, /@Morcegao/);
  assert.ok(countStoryPromptCharacters(prompt.text) <= PLATFORM_GUIDES["google-flow"].absoluteChars);
  assert.match(prompt.notice || "", /não vinculam imagens automaticamente/);
  const fruit = makeStoryFlowAgentInstructions(characters,"frutinhas");
  const people = makeStoryFlowAgentInstructions(characters,"pessoas_cabeca_fruta");
  assert.match(fruit, /Estilo visual:/);
  assert.notEqual(fruit, people);
});
