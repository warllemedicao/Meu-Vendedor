import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const campaign = readFileSync(new URL("../src/components/videos/ProductCampaign.tsx", import.meta.url), "utf8");
test("campaign chooses between speaking presenter and external narration before script", () => {
  assert.ok(campaign.indexOf("Como será a divulgação?") < campaign.indexOf("Analisar foto e criar roteiro com IA"));
  assert.ok(campaign.includes('presentation === "presenter"'));
  assert.ok(campaign.includes('presentation === "voiceover"'));
});
test("campaign reuses stable presenter references and preserves manual sharing", () => {
  assert.ok(campaign.includes("virtualPresenters"));
  assert.ok(campaign.includes("presenter.visualIdentity"));
  assert.ok(campaign.includes("presenter.image"));
  assert.ok(campaign.includes("<PublicationComposer"));
  assert.ok(campaign.includes("<ProductVideoStudio"));
  assert.ok(campaign.includes("ManualChatGPTPrompt"));
});
