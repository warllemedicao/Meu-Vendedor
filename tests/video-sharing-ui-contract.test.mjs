import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Shopee and other marketplaces use explicit sharing destinations", () => {
  const share = read("src/lib/publication-share.ts");
  const composer = read("src/components/videos/PublicationComposer.tsx");
  const center = read("src/components/videos/PublicationCenter.tsx");
  assert.ok(share.includes('id: "shopee_video"'));
  assert.ok(share.includes('? "shopee_video" : "other_app"'));
  assert.ok(composer.includes("defaultShareTarget(product.platform)"));
  assert.ok(center.includes('useState<PublicationPlatform | "">("")'));
  assert.ok(center.includes("Escolha primeiro o destino da publicação."));
});

test("AI studio keeps technical controls secondary", () => {
  const studio = read("src/components/videos/VideoStudio.tsx");
  assert.ok(studio.includes("Configurações avançadas · voz, movimento e formato"));
  assert.ok(studio.includes("Etapa {studioStep + 1} de 3"));
});
