import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const campaign = readFileSync(new URL("../src/components/videos/ProductCampaign.tsx", import.meta.url), "utf8");
const flow = readFileSync(new URL("../src/components/videos/FlowProductGenerator.tsx", import.meta.url), "utf8");
const images = [
  "browser-service/flow_references/single_image.py",
  "browser-service/flow_references/two_images.py",
  "browser-service/flow_references/three_images.py",
];

test("product campaign selects a platform before AI analysis", () => {
  const choice = campaign.indexOf("Escolha onde gerar o vídeo antes da análise");
  const analyze = campaign.indexOf("Analisar foto e criar roteiro com IA");
  assert.ok(choice >= 0 && analyze > choice);
  assert.match(campaign, /!generatorChosen/);
  for (const platform of ["google-flow", "dreamina", "youtube-create"]) {
    assert.ok(campaign.includes('chooseGenerator("' + platform + '")'));
  }
});

test("Flow launch is hidden, generation is explicit, and video flows to publication", () => {
  assert.match(campaign, /prepareFlowBrowser\(\)/);
  assert.match(flow, /invoke\("start", \{ purpose: "flow" \}\)/);
  assert.match(flow, /configureAndGenerate: true/);
  assert.match(flow, /video_generation_error/);
  assert.match(flow, /video_generated_ready/);
  assert.match(flow, /video_train/);
  assert.match(flow, /video_download/);
  assert.match(flow, /uploadVideoResult/);
  assert.match(flow, /invoke\("stop"\)/);
  assert.match(campaign, /<PublicationComposer/);
  assert.match(campaign, /Aprovar vídeo e compartilhar na Shopee/);
  assert.ok(!flow.includes('window.open("https://flow.google.com'));
});

test("Progress is explicitly estimated, retry errors are surfaced to the user", () => {
  assert.match(flow, /Estimativa de etapas, não percentual real do Google/);
  assert.match(flow, /Tentar de novo/);
  assert.match(flow, /Nenhuma repetição automática/);
  assert.match(flow, /aspect-\[9\/16\]/);
});

test("Protected reference scripts remain separate", () => {
  for (const file of images) assert.ok(file.endsWith(".py"));
});
