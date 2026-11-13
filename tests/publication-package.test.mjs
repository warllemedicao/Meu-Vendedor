import test from "node:test";
import assert from "node:assert/strict";
import { publicationCaption, publicationPackageText, PUBLICATION_DESTINATIONS } from "../src/lib/publication-package.ts";
test("legenda preserva link e hashtags válidas sem inventar dados", () => {
  assert.equal(publicationCaption("Produto A", "https://loja.example/p?id=1", "#Oferta #Achadinhos"), "Produto A\n\nConfira a oferta: https://loja.example/p?id=1\n\n#Oferta #Achadinhos");
  assert.equal(publicationCaption("Produto", "", "texto #Valida"), "Produto\n\n#Valida");
});
test("recusa link inválido e nunca converte o formato do vídeo por nome", () => {
  assert.throws(() => publicationCaption("Produto", "javascript:alert(1)", "#Oferta"));
  assert.equal(PUBLICATION_DESTINATIONS.kwai.url, "https://www.kwai.com/");
  assert.match(publicationPackageText("tiktok", "Produto", "", "#Oferta", "video.webm"), /video\.webm/);
});
