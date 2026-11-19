import test from "node:test";
import assert from "node:assert/strict";
import { makeLocalPromptDrafts, PLATFORM_GUIDES } from "../src/lib/stories/workflow.ts";

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

test("local prompts respect every selected provider cap and preserve exact dialogue and action", () => {
  for (const provider of ["youtube-create", "google-flow", "dreamina"]) {
    const [prompt] = makeLocalPromptDrafts(provider, characters, [scene]);
    assert.ok(Array.from(prompt.text).length <= PLATFORM_GUIDES[provider].absoluteChars,
      provider + " exceeded its editorial cap");
    assert.ok(prompt.text.includes(scene.action), "The scene action must never be clipped");
    for (const line of scene.dialogue)
      assert.ok(prompt.text.includes(line.speaker + ': "' + line.text + '"'),
        "Character speech must be preserved exactly");
    assert.ok(prompt.text.includes("Limonada") && prompt.text.includes("Morcegão"));
    assert.ok(!prompt.text.includes("private-image"), "Never put private storage paths in prompts");
  }
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
