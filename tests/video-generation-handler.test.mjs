import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVideoGenerationHandler,
  requestGeminiScript,
  VideoJobError,
} from '../supabase/functions/video-generation/_shared/service.ts';

const request = (body, options = {}) => new Request('https://example.test/video-generation', {
  method: 'POST',
  headers: { Authorization: 'Bearer valid-session', Origin: 'http://localhost:3000', 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  body: JSON.stringify(body),
  ...options,
});

const defaultDependencies = (overrides = {}) => ({
  authenticate: async token => token === 'valid-session' ? 'user-id' : null,
  geminiApiKey: () => undefined,
  geminiScriptEnabled: () => false,
  videoJobsEnabled: () => false,
  videoProcessorAvailable: () => false,
  generateScript: async () => 'Roteiro de teste válido com conteúdo suficiente.',
  enqueueJob: async () => ({ id: 'job-id', status: 'queued' }),
  getJob: async () => ({ id: 'job-id', status: 'processing' }),
  cancelJob: async () => ({ id: 'job-id', status: 'cancelled' }),
  saveDemoResult: async (_userId, resultStoragePath) => ({ id: 'demo-project', result_storage_path: resultStoragePath }),
  ...overrides,
});

const scriptConfiguration = {
  templateId: 'wearing-product',
  scenePresetId: 'fashion-studio',
  durationSeconds: 8,
  format: '9:16',
  targetAudience: 'pessoas que procuram roupas leves',
  product: { name: 'Blusa', description: 'Blusa de linho', price: 'R$ 89,90', features: 'tecido de linho' },
};

const jobRequest = {
  templateId: 'wearing-product',
  scenePresetId: 'fashion-studio',
  durationSeconds: 8,
  format: '9:16',
  presenterId: 'ana',
  voiceGender: 'feminina',
  voiceProfileId: 'natural',
  emotionalToneId: 'alegre',
  advertisingStyleId: 'tradicional',
  narrationMode: 'voiceover',
  motionMode: 'poses',
  mode: 'economy',
  targetAudience: '',
  script: 'Roteiro validado com conteúdo suficiente para o anúncio.',
  product: {
    name: 'Blusa',
    description: 'Blusa leve',
    price: 'R$ 89,90',
    features: 'tecido de linho',
    clothingSize: '',
    imageStoragePath: 'user-id/inputs/photo.webp',
  },
};

test('backend exige autenticação e informa capacidades sem revelar configuração sensível', async () => {
  const handler = createVideoGenerationHandler(defaultDependencies({
    geminiApiKey: () => 'server-only-test-key',
  }));
  const unauthorized = await handler(new Request('https://example.test/video-generation', { method: 'POST', body: '{}' }));
  assert.equal(unauthorized.status, 401);
  const capabilities = await handler(request({ action: 'capabilities' }));
  assert.equal(capabilities.status, 200);
  const data = await capabilities.json();
  assert.deepEqual(data.script, {
    provider: 'google-gemini',
    model: 'gemini-3.8-flash',
    configured: true,
    enabled: false,
    available: false,
  });
  assert.equal(data.video.available, false);
  assert.equal(data.jobs.enabled, false);
  assert.doesNotMatch(JSON.stringify(data), /server-only-test-key/);
});

test('roteiro Gemini requer configuração explícita e valida template/cenário', async () => {
  let calls = 0;
  const disabled = createVideoGenerationHandler(defaultDependencies({
    geminiApiKey: () => 'server-only-test-key',
    generateScript: async () => { calls += 1; return 'Roteiro de teste válido com conteúdo suficiente.'; },
  }));
  assert.equal((await disabled(request({ action: 'generate-script', configuration: scriptConfiguration }))).status, 503);
  assert.equal(calls, 0);

  const enabled = createVideoGenerationHandler(defaultDependencies({
    geminiApiKey: () => 'server-only-test-key',
    geminiScriptEnabled: () => true,
    generateScript: async input => {
      calls += 1;
      assert.equal(input.scenePresetId, 'fashion-studio');
      return 'Uma apresentação segura e clara da blusa para quem procura roupas leves.';
    },
  }));
  const result = await enabled(request({ action: 'generate-script', configuration: scriptConfiguration }));
  assert.equal(result.status, 200);
  assert.match((await result.json()).script, /apresentação segura/);
  assert.equal(calls, 1);
  const invalid = await enabled(request({
    action: 'generate-script',
    configuration: { ...scriptConfiguration, scenePresetId: 'cleaning-kitchen' },
  }));
  assert.equal(invalid.status, 400);
});

test('cliente Gemini usa endpoint fixo, header e resposta sanitizada sem chamada real nos testes', async () => {
  let calledUrl = '';
  let calledOptions;
  const script = await requestGeminiScript(scriptConfiguration, 'server-only-test-key', async (url, options) => {
    calledUrl = String(url);
    calledOptions = options;
    return new Response(JSON.stringify({ output_text: 'Roteiro válido e fiel aos dados do produto recebido.' }), { status: 200 });
  });
  assert.equal(script, 'Roteiro válido e fiel aos dados do produto recebido.');
  assert.equal(calledUrl, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(calledOptions.headers['x-goog-api-key'], 'server-only-test-key');
  assert.equal(JSON.parse(calledOptions.body).model, 'gemini-3.8-flash');

  await assert.rejects(
    requestGeminiScript(scriptConfiguration, 'server-only-test-key', async () => new Response('private response', { status: 429 })),
    error => error.code === 'gemini_rate_limited' && !error.message.includes('server-only-test-key'),
  );
});

test('fila exige flag, imagem privada do usuário e chave idempotente', async () => {
  let enqueues = 0;
  const disabled = createVideoGenerationHandler(defaultDependencies({
    enqueueJob: async () => { enqueues += 1; return {}; },
  }));
  assert.equal((await disabled(request({ action: 'enqueue-job', idempotencyKey: 'request-key-00000001', request: jobRequest }))).status, 503);
  assert.equal(enqueues, 0);

  const enabled = createVideoGenerationHandler(defaultDependencies({
    videoJobsEnabled: () => true,
    videoProcessorAvailable: () => true,
    enqueueJob: async (userId, projectId, key, data) => {
      enqueues += 1;
      assert.equal(userId, 'user-id');
      assert.equal(projectId, null);
      assert.equal(key, 'request-key-00000001');
      assert.deepEqual(data, jobRequest);
      return { id: 'job-id', status: 'queued' };
    },
  }));
  const accepted = await enabled(request({ action: 'enqueue-job', idempotencyKey: 'request-key-00000001', request: jobRequest }));
  assert.equal(accepted.status, 202);
  assert.deepEqual((await accepted.json()).job, { id: 'job-id', status: 'queued' });
  assert.equal(enqueues, 1);
  const wrongOwnerPath = await enabled(request({
    action: 'enqueue-job',
    idempotencyKey: 'request-key-00000002',
    request: { ...jobRequest, product: { ...jobRequest.product, imageStoragePath: 'another-user/inputs/photo.webp' } },
  }));
  assert.equal(wrongOwnerPath.status, 400);

  const limited = createVideoGenerationHandler(defaultDependencies({
    videoJobsEnabled: () => true,
    videoProcessorAvailable: () => true,
    enqueueJob: async () => { throw new VideoJobError(429, 'video_daily_limit', 'Limite diário atingido.'); },
  }));
  assert.equal((await limited(request({ action: 'enqueue-job', idempotencyKey: 'request-key-00000003', request: jobRequest }))).status, 429);
});

test('consulta e cancelamento de jobs usam o usuário autenticado', async () => {
  const seenUsers = [];
  const handler = createVideoGenerationHandler(defaultDependencies({
    videoJobsEnabled: () => true,
    videoProcessorAvailable: () => true,
    getJob: async userId => { seenUsers.push(userId); return { id: 'job-id', status: 'processing' }; },
    cancelJob: async userId => { seenUsers.push(userId); return { id: 'job-id', status: 'cancelled' }; },
  }));
  const status = await handler(request({ action: 'job-status', jobId: '11111111-1111-4111-8111-111111111111' }));
  assert.equal(status.status, 200);
  const cancelled = await handler(request({ action: 'cancel-job', jobId: '11111111-1111-4111-8111-111111111111' }));
  assert.equal(cancelled.status, 200);
  assert.deepEqual(seenUsers, ['user-id', 'user-id']);
});

test('salvar MP4 de teste exige autenticação e caminho privado da própria conta', async () => {
  let savedPath = '';
  const handler = createVideoGenerationHandler(defaultDependencies({
    saveDemoResult: async (userId, resultStoragePath) => {
      assert.equal(userId, 'user-id');
      savedPath = resultStoragePath;
      return { id: 'demo-project', result_storage_path: resultStoragePath };
    },
  }));
  const ownPath = 'user-id/outputs/test.mp4';
  const response = await handler(request({ action: 'save-demo-result', resultStoragePath: ownPath }));
  assert.equal(response.status, 201);
  assert.equal(savedPath, ownPath);
  assert.deepEqual((await response.json()).project, {
    id: 'demo-project',
    result_storage_path: ownPath,
  });
  const wrongOwner = await handler(request({
    action: 'save-demo-result',
    resultStoragePath: 'another-user/outputs/test.mp4',
  }));
  assert.equal(wrongOwner.status, 400);
});

test('geração real de vídeo continua bloqueada e handler rejeita origem, método e corpo inválidos', async () => {
  const handler = createVideoGenerationHandler(defaultDependencies({
    geminiApiKey: () => 'server-only-test-key',
    geminiScriptEnabled: () => true,
  }));
  const generation = await handler(request({ action: 'generate' }));
  assert.equal(generation.status, 501);
  assert.doesNotMatch(await generation.text(), /server-only-test-key/);
  assert.equal((await handler(request({ action: 'capabilities' }, { headers: { Origin: 'https://evil.test' } }))).status, 403);
  assert.equal((await handler(new Request('https://example.test/video-generation', { method: 'GET' }))).status, 405);
  assert.equal((await handler(request({ invalid: true }))).status, 400);
});
