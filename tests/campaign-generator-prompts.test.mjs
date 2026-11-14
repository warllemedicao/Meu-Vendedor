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
test("product campaign emits exactly one prompt for 6, 8 and 10 seconds", async () => {
  const { buildGeneratorPrompts } = await import("../src/lib/campaign-generator-prompts.ts");
  for (const durationSeconds of [6, 8, 10]) {
    for (const provider of ["youtube-create", "google-flow", "dreamina"]) {
      const prompts = buildGeneratorPrompts(provider, {
        title: "Caneca", details: "vermelha", scene: "cozinha",
        speech: "Conheça esta caneca!", durationSeconds,
        presentation: "presenter", presenterName: "Ana",
        presenterIdentity: "blazer claro", presenterVoice: "natural",
        masterPrompt: "ROTEIRO MESTRE: roupa e voz fixas."
      });
      assert.equal(prompts.length, 1);
      assert.ok(prompts[0].includes("Conheça esta caneca!"));
      if (provider !== "youtube-create") assert.ok(prompts[0].includes("ROTEIRO MESTRE: roupa e voz fixas."));
      else assert.ok(prompts[0].length <= 900);
    }
  }
});
test("product campaign refuses long dialogue or duration above ten seconds", async () => {
  const { buildGeneratorPrompts } = await import("../src/lib/campaign-generator-prompts.ts");
  const brief = { title: "Caneca", details: "", scene: "cozinha", speech: "Olá!",
    durationSeconds: 15, presentation: "voiceover", masterPrompt: "direção" };
  assert.throws(() => buildGeneratorPrompts("google-flow", brief), /1 a 10 segundos/);
  assert.throws(() => buildGeneratorPrompts("dreamina", {
    ...brief, durationSeconds: 8, speech: "palavra ".repeat(60)
  }), /fala está longa/);
});
test("canonical presenter profiles are included in Flow and Dreamina", async () => {
  const { presenterIdentityPrompt, virtualPresenters } = await import("../src/lib/video-studio.ts");
  const { buildGeneratorPrompts } = await import("../src/lib/campaign-generator-prompts.ts");
  for (const presenter of virtualPresenters.filter(item => item.referenceStatus === "ready")) {
    const identity = presenterIdentityPrompt(presenter.id);
    assert.ok(identity.includes(presenter.image));
    assert.ok(identity.includes(presenter.visualIdentity));
    const brief = { title: "Caneca", details: "", scene: "cozinha",
      speech: "Veja esta caneca!", durationSeconds: 8,
      presentation: "presenter", presenterName: presenter.name,
      presenterIdentity: presenter.visualIdentity, presenterVoice: presenter.defaultVoiceProfile,
      masterPrompt: "Anúncio", continuityBible: identity };
    for (const provider of ["google-flow", "dreamina"]) {
      const prompts = buildGeneratorPrompts(provider, brief);
      assert.equal(prompts.length, 1);
      assert.ok(prompts[0].includes(identity));
    }
  }
});

test("Supabase campaign analysis accepts the same short durations as the product editor", () => {
  const edge = readFileSync(new URL("../supabase/functions/campaign-content/index.ts", import.meta.url), "utf8");
  assert.ok(edge.includes("[6, 7, 8, 10].includes(Number(body.seconds))"));
  assert.ok(campaign.includes("<option value={10}>10 segundos</option>"));
  assert.ok(campaign.includes("<option value={6}>6 segundos</option>"));
});

test("generator links avoid nonexistent YouTube Create desktop page", async () => {
  const { GENERATOR_LINKS } = await import("../src/lib/campaign-generator-prompts.ts");
  assert.ok(GENERATOR_LINKS["youtube-create"].includes("support.google.com/youtube/"));
  assert.ok(!GENERATOR_LINKS["youtube-create"].includes("youtube.com/create"));
});
test("product and presenter references are actually converted to JPEG", () => {
  assert.ok(campaign.includes('canvas.toBlob(result => result ? resolve(result)'));
  assert.ok(campaign.includes('"image/jpeg", 0.94'));
  assert.ok(campaign.includes('".jpg"'));
});
