import test from 'node:test';
import assert from 'node:assert/strict';
import { imageCacheKey } from '../supabase/functions/video-generation/_shared/image-cache.ts';
import { productionServiceInventory } from '../supabase/functions/video-generation/_shared/provider-inventory.ts';
import { createCloudflareWorkersAIProvider } from '../supabase/functions/video-generation/_shared/providers/cloudflare-workers-ai.ts';

const request = () => ({
  prompt: 'Preserve o produto e a identidade do apresentador.',
  references: [{ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg', width: 512, height: 384 }],
  outputWidth: 512, outputHeight: 910, steps: 25,
});

test('cache reconhece conteúdo igual e invalida mudanças de imagem, cenário e parâmetros', async () => {
  const original = request();
  const key = await imageCacheKey(original);
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key, await imageCacheKey(request()));
  for (const changed of [
    { ...original, prompt: 'Outra cena e outro personagem' },
    { ...original, steps: 20 },
    { ...original, outputWidth: 768 },
    { ...original, references: [{ ...original.references[0], bytes: new Uint8Array([1, 2, 4]) }] },
  ]) assert.notEqual(key, await imageCacheKey(changed));
});

test('inventário distingue credencial presente de adaptador integrado, sem incluir valores', () => {
  const configuredNames = new Set(['GEMINI_API_KEY', 'REPLICATE_API_TOKEN', 'HF_TOKEN']);
  const inventory = productionServiceInventory((name) => configuredNames.has(name));
  assert.equal(inventory.find((service) => service.id === 'huggingface').configured, true);
  assert.equal(inventory.find((service) => service.id === 'huggingface').integrated, false);
  assert.equal(inventory.find((service) => service.id === 'replicate').integrated, true);
  assert.equal(inventory.find((service) => service.id === 'magic-hour').configured, false);
  assert.ok(inventory.every((service) => Object.keys(service).sort().join(',') === 'configured,id,integrated,name,stage'));
});

test('adaptador de imagem respeita confirmação comercial do backend', () => {
  const options = { accountId: 'account', apiToken: 'token', readiness: async () => ({ authenticated: true, available: true, funding: 'paid-authorized', balanceUnits: null }) };
  assert.equal(createCloudflareWorkersAIProvider(options).capabilities.commercialUse, 'not-confirmed');
  assert.equal(createCloudflareWorkersAIProvider({ ...options, commercialUseConfirmed: true }).capabilities.commercialUse, 'confirmed');
});
