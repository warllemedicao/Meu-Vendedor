import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductMedia, productTimeline, productVideoFilename, ownedProductVideoPath } from '../src/lib/product-video.ts';

test('montagem limita formatos e tamanho de fotos e clipes antes da decodificação', () => {
  assert.equal(validateProductMedia({ type: 'image/png', size: 100 }), 'image');
  assert.equal(validateProductMedia({ type: 'video/mp4', size: 100 }), 'video');
  for (const file of [{ type: 'image/svg+xml', size: 100 }, { type: 'image/png', size: 0 }, { type: 'image/png', size: 11 * 1024 * 1024 }, { type: 'video/mp4', size: 51 * 1024 * 1024 }]) {
    assert.throws(() => validateProductMedia(file));
  }
});
test('transição termina na próxima cena e o último quadro permanece no intervalo válido', () => {
  assert.equal(productTimeline(2, 3, 2).mix, 0);
  assert.ok(Math.abs(productTimeline(2, 3, 2.775).mix - 0.5) < 0.001);
  assert.equal(productTimeline(2, 3, 3).index, 1);
  assert.equal(productTimeline(2, 3, 100).index, 1);
  assert.equal(productTimeline(2, 3, 100).mix, 0);
  assert.equal(productTimeline(2, 3, -1).local, 0);
  for (const args of [[0,3,0], [9,3,0], [2,120,0], [2,3,NaN]]) assert.throws(() => productTimeline(...args));
});
test('nomes de saída são seguros e caminhos privados recusam traversal', () => {
  const user = '11111111-1111-4111-8111-111111111111';
  const id = '22222222-2222-4222-8222-222222222222';
  const name = productVideoFilename('../Câmera / <oferta>', id, 'mp4');
  assert.equal(name, `camera-oferta--${id}.mp4`);
  assert.equal(ownedProductVideoPath(user, name), `${user}/product-videos/${name}`);
  assert.throws(() => ownedProductVideoPath(user, '../' + name));
  assert.throws(() => ownedProductVideoPath(user, `${user}/${name}`));
  assert.throws(() => ownedProductVideoPath('bad-user', name));
  assert.throws(() => productVideoFilename('produto', '../../x', 'mp4'));
});
