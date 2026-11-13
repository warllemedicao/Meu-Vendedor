import assert from "node:assert/strict";
import test from "node:test";
import { getPublicCatalogSources } from "../src/lib/public-product-catalog.ts";

test("filtered product views load only the selected public catalog", () => {
  assert.deepEqual(getPublicCatalogSources("amazon").map(source => source.id), ["amazon"]);
  assert.deepEqual(getPublicCatalogSources("tiktok").map(source => source.id), ["tiktok"]);
});

test("unfiltered views retain all public catalogs and honor the connected Shopee exclusion", () => {
  assert.deepEqual(getPublicCatalogSources().map(source => source.id), ["shopee", "amazon", "tiktok"]);
  assert.deepEqual(getPublicCatalogSources(undefined, true).map(source => source.id), ["amazon", "tiktok"]);
  assert.deepEqual(getPublicCatalogSources("shopee", true), []);
});
