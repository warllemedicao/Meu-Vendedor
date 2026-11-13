import assert from "node:assert/strict";
import test from "node:test";
import { isStandalonePublicRoute } from "../src/lib/public-routes.ts";

test("the public homepage and privacy policy use the standalone layout", () => {
  assert.equal(isStandalonePublicRoute("/"), true);
  assert.equal(isStandalonePublicRoute("/politica-de-privacidade"), true);
});

test("other app routes keep the existing application shell", () => {
  for (const pathname of ["/produtos", "/videos", "/afiliados", "/configuracoes", "/entrar"]) {
    assert.equal(isStandalonePublicRoute(pathname), false, pathname);
  }
  assert.equal(isStandalonePublicRoute("/politica-de-privacidade/extra"), false);
  assert.equal(isStandalonePublicRoute(null), false);
});
