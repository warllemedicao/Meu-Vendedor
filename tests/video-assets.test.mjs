import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVideoAssetUrl,
  MAX_VIDEO_IMAGE_BYTES,
  uploadVideoProductImage,
  VIDEO_ASSET_BUCKET,
} from '../src/lib/video-assets.ts';

const userId = '11111111-1111-4111-8111-111111111111';

function fakeClient(result = { data: { signedUrl: 'https://storage.example/signed' }, error: null }) {
  const calls = [];
  return {
    calls,
    storage: {
      from(bucket) {
        return {
          async upload(path, file, options) {
            calls.push({ operation: 'upload', bucket, path, file, options });
            return { data: { path }, error: null };
          },
          async createSignedUrl(path, expiresIn) {
            calls.push({ operation: 'signed-url', bucket, path, expiresIn });
            return result;
          },
        };
      },
    },
  };
}

test('imagem de produto usa bucket privado, caminho do usuário e sem sobrescrita', async () => {
  const client = fakeClient();
  const path = await uploadVideoProductImage(client, userId, { type: 'image/webp', size: 1024, name: 'produto.webp' });
  assert.match(path, new RegExp(`^${userId}/inputs/[0-9a-f-]+\\.webp$`));
  assert.equal(client.calls[0].bucket, VIDEO_ASSET_BUCKET);
  assert.equal(client.calls[0].options.upsert, false);
  assert.equal(client.calls[0].options.contentType, 'image/webp');
});

test('upload valida MIME, tamanho e identidade antes de acessar Storage', async () => {
  const client = fakeClient();
  await assert.rejects(uploadVideoProductImage(client, userId, { type: 'image/gif', size: 100 }), /PNG, JPEG ou WebP/);
  await assert.rejects(uploadVideoProductImage(client, userId, { type: 'image/png', size: MAX_VIDEO_IMAGE_BYTES + 1 }), /10 MB/);
  await assert.rejects(uploadVideoProductImage(client, 'bad-user', { type: 'image/png', size: 100 }), /conta autenticada/);
  assert.equal(client.calls.length, 0);
});

test('URL assinada é temporária e não aceita caminho de outro usuário ou traversal', async () => {
  const client = fakeClient();
  const path = `${userId}/inputs/product.webp`;
  assert.equal(await createVideoAssetUrl(client, userId, path), 'https://storage.example/signed');
  assert.equal(client.calls[0].expiresIn, 300);
  assert.equal(await createVideoAssetUrl(client, userId, `${userId}/outputs/result.mp4`), 'https://storage.example/signed');
  await assert.rejects(createVideoAssetUrl(client, userId, '22222222-2222-4222-8222-222222222222/inputs/product.webp'), /não pertence/);
  await assert.rejects(createVideoAssetUrl(client, userId, `${userId}/inputs/../product.webp`), /não pertence/);
});
