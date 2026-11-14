import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Início remains visible in the main sidebar and preserves the public app description", () => {
  const navigation = read("src/lib/navigation.ts");
  const home = read("src/app/page.tsx");
  assert.match(navigation, /href: "\/",\s*label: "Início"/);
  assert.doesNotMatch(navigation.match(/export const mainNavItems =[^;]+;/)?.[0] ?? "", /\["\/"/);
  assert.match(home, /Produtos, conteúdo e divulgação em um só lugar/);
  assert.match(home, /Sobre o aplicativo/);
});

test("Produtos shows catalogs only, never the store directory or connection forms", () => {
  const products = read("src/components/marketplace/ProductsWorkspace.tsx");
  assert.match(products, /PublicProductCatalog/);
  assert.doesNotMatch(products, /marketplaceDirectory|Todas as lojas|ManualMarketplaceCampaign|RemoteCatalog|Filtrar marketplaces/);
});
