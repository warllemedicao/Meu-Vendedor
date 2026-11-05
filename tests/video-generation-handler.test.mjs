import test from 'node:test';
import assert from 'node:assert/strict';
import { createVideoGenerationHandler } from '../supabase/functions/video-generation/_shared/service.ts';

const request = (body, options = {}) => new Request('https://example.test/video-generation', {
  method: 'POST',
  headers: { Authorization: 'Bearer valid-session', Origin: 'http://localhost:3000', 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  body: JSON.stringify(body),
  ...options,
});

test('backend de vídeo exige autenticação e mantém geração real desativada', async () => {
  const handler = createVideoGenerationHandler({
    authenticate: async token => token === 'valid-session' ? 'user-id' : null,
    googleApiKey: () => undefined,
    googleEnabled: () => false,
  });
  const unauthorized = await handler(new Request('https://example.test/video-generation', { method: 'POST', body: '{}' }));
  assert.equal(unauthorized.status, 401);
  const capabilities = await handler(request({ action: 'capabilities' }));
  assert.equal(capabilities.status, 200);
  const data = await capabilities.json();
  assert.equal(data.model, 'gemini-omni-1.1-flash');
  assert.equal(data.available, false);
  assert.equal(data.configured, false);
  const generation = await handler(request({ action: 'generate' }));
  assert.equal(generation.status, 503);
  assert.equal((await generation.json()).error.code, 'provider_not_configured');
});

test('presença futura de credencial não libera chamadas sem implementação validada', async () => {
  const handler = createVideoGenerationHandler({
    authenticate: async () => 'user-id',
    googleApiKey: () => 'server-only-test-key',
    googleEnabled: () => true,
  });
  const response = await handler(request({ action: 'generate' }));
  assert.equal(response.status, 501);
  const text = await response.text();
  assert.match(text, /provider_implementation_pending/);
  assert.doesNotMatch(text, /server-only-test-key/);
});

test('backend recusa origem, método e corpo inválidos antes de processar', async () => {
  const handler = createVideoGenerationHandler({ authenticate: async () => 'user-id', googleApiKey: () => undefined, googleEnabled: () => false });
  assert.equal((await handler(request({ action: 'capabilities' }, { headers: { Origin: 'https://evil.test' } }))).status, 403);
  assert.equal((await handler(new Request('https://example.test/video-generation', { method: 'GET' }))).status, 405);
  assert.equal((await handler(request({ invalid: true }))).status, 400);
});
