import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/lib/campaign-generator-prompts.ts", import.meta.url), "utf8");
const campaign = readFileSync(new URL("../src/components/videos/ProductCampaign.tsx", import.meta.url), "utf8");
test("video generator prompt adapter supports three providers and validates YouTube 900 character cap", () => {
  for (const id of ["youtube-create", "google-flow", "dreamina"]) assert.ok(source.includes(id));
  assert.ok(source.includes("YOUTUBE_PROMPT_LIMIT = 900"));
  assert.ok(source.includes("splitCampaignSpeech"));
  assert.ok(source.includes("throw new Error"));
});
test("campaign provides compact accessible generator icons, per-scene prompt and reference downloads", () => {
  for (const label of ["Selecionar Google Flow", "Selecionar Dreamina", "Selecionar YouTube Create"]) assert.ok(campaign.includes(label));
  assert.ok(campaign.includes("buildGeneratorPrompts"));
  assert.ok(campaign.includes("saveReference"));
  assert.ok(campaign.includes("Foto do produto"));
  assert.ok(campaign.includes("Foto de {presenter.name}"));
  assert.ok(campaign.includes("Copiar prompt"));
  assert.ok(campaign.includes("Baixar prompts"));
});
test("YouTube scenes remain within 900 characters with long inputs and retain speech", async () => {
  const { buildGeneratorPrompts } = await import("../src/lib/campaign-generator-prompts.ts");
  const speech = Array.from({ length: 65 }, (_, i) => `palavra${i}`).join(" ");
  const prompts = buildGeneratorPrompts("youtube-create", {
    title: "Caneca", details: "detalhes ".repeat(200), scene: "cozinha ".repeat(200),
    speech, durationSeconds: 30, presentation: "presenter",
    presenterName: "Ana", masterPrompt: "roteiro completo"
  });
  assert.ok(prompts.length >= 4);
  assert.ok(prompts.every(prompt => prompt.length <= 900));
  for (const word of speech.split(" ")) assert.ok(prompts.some(prompt => prompt.includes(word)));
});
test("all three generators produce one prompt per planned scene", async () => {
  const { buildGeneratorPrompts } = await import("../src/lib/campaign-generator-prompts.ts");
  const brief = { title: "Caneca", details: "", scene: "cozinha", speech: "Bom dia, conheça esta caneca.",
    durationSeconds: 15, presentation: "voiceover", masterPrompt: "direção" };
  for (const generator of ["youtube-create", "google-flow", "dreamina"]) {
    const prompts = buildGeneratorPrompts(generator, brief);
    assert.equal(prompts.length, 2);
    assert.ok(prompts.every(prompt => prompt.includes("português brasileiro") || prompt.includes("português brasileiro")));
  }
});

test("Flow and Dreamina repeat full story bible but isolate the scene action and dialogue", async () => {
  const { buildGeneratorPrompts } = await import("../src/lib/campaign-generator-prompts.ts");
  const brief = {
    title: "Produto", details: "vermelho", scene: "cozinha",
    speech: "Olá mundo. Este é um teste.", durationSeconds: 15,
    presentation: "presenter", presenterName: "Ana",
    presenterIdentity: "cabelo escuro, blazer claro",
    presenterVoice: "voz feminina natural",
    masterPrompt: "Bíblia: roupa coral, iluminação suave, mesma voz, mesmo rosto.",
    sceneActions: ["Levanta o produto.", "Mostra o produto."],
  };
  for (const provider of ["google-flow", "dreamina"]) {
    const prompts = buildGeneratorPrompts(provider, brief);
    assert.equal(prompts.length, 2);
    assert.ok(prompts.every(prompt => prompt.includes(brief.masterPrompt)));
    assert.ok(prompts.every(prompt => prompt.includes(brief.presenterIdentity)));
    assert.ok(prompts[0].includes("Levanta o produto."));
    assert.ok(prompts[1].includes("Mostra o produto."));
    assert.ok(!prompts[0].includes("AÇÃO EXCLUSIVA DESTA CENA: Mostra o produto."));
  }
});
