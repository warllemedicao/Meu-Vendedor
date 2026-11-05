import test from 'node:test';
import assert from 'node:assert/strict';
import { googleVideoProvider, mockVideoProvider } from '../src/lib/video-provider.ts';

test('provedor mock simula estados sem criar URL de vídeo ou custo', async () => {
  const capabilities = await mockVideoProvider.capabilities();
  assert.equal(capabilities.available, true);
  assert.equal(await mockVideoProvider.estimateCost({}), 0);
  const job = await mockVideoProvider.start({});
  assert.equal(job.status, 'generating');
  assert.equal(job.resultUrl, null);
  assert.equal(job.simulated, true);
  const status = await mockVideoProvider.status(job.id);
  assert.equal(status.status, 'processing');
  assert.equal(status.resultUrl, null);
});

test('provedor Google declara modelo oficial, mas permanece bloqueado', async () => {
  const capabilities = await googleVideoProvider.capabilities();
  assert.equal(capabilities.available, false);
  assert.equal(capabilities.model, 'gemini-omni-1.1-flash');
  assert.equal(await googleVideoProvider.estimateCost({}), null);
  await assert.rejects(googleVideoProvider.start({}), /google_provider_disabled/);
});
