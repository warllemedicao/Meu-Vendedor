import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { House } from "lucide-react";
import { marketplaceDirectory } from "../src/lib/marketplace-directory.ts";
import { mainNavItems, navItems } from "../src/lib/navigation.ts";

test("Início is the first main navigation item and uses the home route and icon", () => {
  assert.equal(mainNavItems[0].href, "/");
  assert.equal(mainNavItems[0].label, "Início");
  assert.equal(mainNavItems[0].icon, House);
  assert.equal(navItems[0].href, "/");
});

test("Products and marketplace routes remain available", () => {
  assert.ok(mainNavItems.some(item => item.href === "/produtos" && item.label === "Produtos"));
  for (const marketplace of marketplaceDirectory) {
    assert.ok(
      existsSync(new URL(`../src/app${marketplace.href}/page.tsx`, import.meta.url)),
      `missing route for ${marketplace.name}`,
    );
  }
});
