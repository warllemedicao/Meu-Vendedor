import assert from 'node:assert/strict';
import test from 'node:test';
import { connectorCatalog, getUnconfiguredSnapshot } from '../src/lib/connectors/catalog.ts';

test('catálogo cobre as quatro plataformas sem oferecer capacidades implementadas', () => {
  assert.deepEqual(connectorCatalog.map((c) => c.id).sort(), ['mercado-livre', 'shopee', 'tiktok', 'tiktok-shop']);
  for (const connector of connectorCatalog) {
    assert.ok(connector.capabilities.length > 0);
    assert.ok(connector.capabilities.every((capability) => !capability.available));
    assert.ok(connector.permissions.length && connector.approvals.length);
  }
});

test('estado inicial nunca afirma autorização, sincronização ou conta real', () => {
  for (const { id } of connectorCatalog) {
    const snapshot = getUnconfiguredSnapshot(id);
    assert.equal(snapshot.platform, id);
    assert.equal(snapshot.authorization.status, 'not_connected');
    assert.deepEqual(snapshot.authorization.grantedPermissions, []);
    assert.equal(snapshot.synchronization.status, 'not_started');
    assert.equal(snapshot.synchronization.lastSuccessAt, undefined);
    assert.equal(snapshot.metadata, null);
  }
  const first = getUnconfiguredSnapshot('tiktok');
  first.authorization.grantedPermissions.push('unexpected');
  assert.deepEqual(getUnconfiguredSnapshot('tiktok').authorization.grantedPermissions, []);
});

test('referências usam HTTPS e apenas domínios oficiais permitidos', () => {
  const officialHosts = new Set(['affiliate.shopee.com.br', 'help.shopee.sg', 'developers.tiktok.com', 'partner.tiktokshop.com', 'developers.mercadolivre.com.br']);
  for (const connector of connectorCatalog) {
    assert.ok(connector.documentation.length > 0);
    for (const doc of connector.documentation) {
      const url = new URL(doc.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(officialHosts.has(url.hostname));
      assert.equal(url.username, '');
      assert.equal(url.password, '');
    }
  }
});
