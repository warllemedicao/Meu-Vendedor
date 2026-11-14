import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("explore catalog appears before expanding connected account products", () => {
  const page = read("src/components/marketplace/ProductsWorkspace.tsx");
  assert.ok(page.indexOf('<PublicProductCatalog excludeShopee={connected} />') < page.indexOf('<ProductCatalog />'));
});
test("marketplace filters remain sticky while scrolling results", () => {
  const catalog = read("src/components/marketplace/PublicProductCatalog.tsx");
  assert.ok(catalog.includes('className="sticky top-0 z-20 space-y-3'));
  assert.ok(catalog.indexOf('aria-label="Controles de exploração de produtos"') < catalog.indexOf('aria-label="Filtrar por loja"'));
});
