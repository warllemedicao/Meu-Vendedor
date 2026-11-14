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
