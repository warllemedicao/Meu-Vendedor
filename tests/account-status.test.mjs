import assert from "node:assert/strict";
import test from "node:test";
import { accountIntegrationNotes, marketplaceIntegrationNotes } from "../src/lib/account-integrations.ts";
import { shopeeCredentialAction, shopeeSummaryState } from "../src/lib/marketplace-status.ts";

test("ação Shopee não solicita credenciais quando a consulta não confirmou seu estado", () => {
  assert.equal(shopeeCredentialAction(false, false), "connect");
  assert.equal(shopeeCredentialAction(true, false), "configure");
  assert.equal(shopeeCredentialAction(true, true), "verify");
  assert.equal(shopeeCredentialAction(false, true), "verify");
  assert.equal(shopeeCredentialAction(true, null), "checking");
  assert.equal(shopeeCredentialAction(false, null), "checking");
});

test("falha ao consultar Shopee permanece desconhecida, não vira credencial ausente", () => {
  assert.equal(shopeeSummaryState({ authenticated: true, loading: false, error: true, status: null }), "unknown");
  assert.equal(shopeeSummaryState({ authenticated: true, loading: true, error: false, status: null }), "checking");
  assert.equal(shopeeSummaryState({ authenticated: true, loading: false, error: false, status: null }), "unknown");
  assert.equal(shopeeSummaryState({ authenticated: true, loading: false, error: false, status: {
    connected: false, credentialsStored: false, status: "not_configured", lastSyncAt: null, lastErrorCode: null, syncScope: null,
  } }), "not_connected");
});

test("estado salvo da Shopee mantém credencial cifrada visível sem expor conteúdo", () => {
  assert.equal(shopeeSummaryState({ authenticated: true, loading: false, error: false, status: {
    connected: true, credentialsStored: true, status: "connected", lastSyncAt: "2026-11-13T00:00:00Z", lastErrorCode: null, syncScope: "ofertas",
  } }), "connected");
  assert.equal(shopeeSummaryState({ authenticated: true, loading: false, error: false, status: {
    connected: true, credentialsStored: true, status: "error", lastSyncAt: null, lastErrorCode: "provider_rejected", syncScope: "ofertas",
  } }), "attention");
});

test("resposta pública de status nunca inclui ciphertext nem segredos", async () => {
  const { publicConnectionStatus } = await import("../supabase/functions/marketplace/_shared/status.ts");
  const response = publicConnectionStatus({
    status: "error",
    last_sync_at: "2026-11-13T00:00:00Z",
    last_error_code: "provider_rejected",
    sync_scope: "ofertas",
  }, true);
  assert.equal(response.credentialsStored, true);
  assert.equal(response.status, "error");
  assert.deepEqual(Object.keys(response).sort(), ["connected", "credentialsStored", "lastErrorCode", "lastSyncAt", "status", "syncScope"].sort());
  assert.equal(shopeeSummaryState({ authenticated: true, loading: false, error: false, status: {
    ...response, connected: false,
  } }), "attention");
});

test("central lista os canais pedidos e descreve pendências sem sugerir conexão fictícia", () => {
  const all = [...accountIntegrationNotes, ...marketplaceIntegrationNotes].map((item) => item.name);
  for (const name of ["Pinterest", "Shopee Video", "TikTok", "TikTok Shop", "Instagram", "Facebook", "Kwai", "ElevenLabs", "AliExpress", "SHEIN"]) {
    assert.ok(all.includes(name), `${name} deve aparecer na central`);
  }
  for (const item of [...accountIntegrationNotes, ...marketplaceIntegrationNotes]) {
    assert.ok(item.status && item.completed && item.pending && item.next, `${item.name} precisa informar status e pendências`);
  }
});
