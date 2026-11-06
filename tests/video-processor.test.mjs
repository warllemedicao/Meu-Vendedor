import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIProviderFailure,
  initialProviderCapabilities,
} from '../supabase/functions/video-generation/_shared/ai-provider-router.ts';
import { freeOnlyAdapter } from '../supabase/functions/video-generation/_shared/free-only.ts';
import { createVideoProcessor } from '../supabase/functions/video-generation/_shared/processor.ts';

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function box(type, contents) {
  const result = new Uint8Array(8 + contents.length);
  result.set(uint32(result.length), 0);
  result.set(new TextEncoder().encode(type), 4);
  result.set(contents, 8);
  return result;
}

function concat(...parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function makeValidMp4() {
  const mvhd = new Uint8Array(20);
  mvhd.set(uint32(1000), 12);
  mvhd.set(uint32(6000), 16);
  const tkhd = new Uint8Array(84);
  tkhd.set(uint32(512 * 65536), 76);
  tkhd.set(uint32(910 * 65536), 80);
  const hdlr = new Uint8Array(12);
  hdlr.set(new TextEncoder().encode('vide'), 8);
  const ftyp = box('ftyp', new TextEncoder().encode('isom0000'));
  const trak = box('trak', concat(box('tkhd', tkhd), box('mdia', box('hdlr', hdlr))));
  return concat(ftyp, box('moov', concat(box('mvhd', mvhd), trak)));
}

const policy = (overrides = {}) => ({
  allowPaidGeneration: true,
  allowUnconfirmedCommercialUse: false,
  maxCostUsdPerTask: 2,
  remainingDailyBudgetUsd: 10,
  paidProviders: new Set(['cloudflare-workers-ai', 'magic-hour', 'replicate']),
  ...overrides,
});

function provider(id, generate, { cost = 0.1 } = {}) {
  const capabilities = initialProviderCapabilities.find((item) => item.id === id);
  return {
    capabilities: { ...capabilities, commercialUse: 'confirmed' },
    readiness: async () => ({
      authenticated: true,
      available: true,
      funding: 'paid-authorized',
      balanceUnits: 1000,
    }),
    estimate: async () => ({ units: 1, usd: cost }),
    generate,
  };
}

function harness(initialJob, overrides = {}) {
  const job = {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    status: 'processing',
    stage: 'queued',
    lease_token: 'lease-token',
    request_data: {
      presenterId: 'ana',
      script: 'Uma apresentação segura e clara do produto.',
      product: { name: 'Blusa' },
    },
    provider: 'pending',
    provider_job_id: null,
    intermediate_image_path: null,
    result_object_path: null,
    cancel_requested_at: null,
    progress: 0,
    status_poll_attempts: 0,
    ...initialJob,
  };
  const calls = { image: 0, magicHour: 0, replicate: 0, status: [], cancel: [], records: [], stored: [] };
  const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const mp4 = makeValidMp4();
  const attemptStore = {
    record: async (record) => calls.records.push(record),
    reserve: async () => true,
    settle: async () => {},
    release: async () => {},
    setCooldown: async () => {},
  };
  const dependencies = {
    claim: async () => job,
    createImageRequest: async () => ({
      prompt: 'Create a product reference',
      references: [],
      outputWidth: 512,
      outputHeight: 910,
      steps: 25,
    }),
    createImageRouter: () => provider('cloudflare-workers-ai', async () => {
      calls.image += 1;
      return { bytes: image, mimeType: 'image/jpeg', model: '@cf/black-forest-labs/flux-2-dev', estimatedCostUsd: 0.1 };
    }),
    storeIntermediate: async () => '22222222-2222-4222-8222-222222222222/intermediate/frame.jpg',
    loadIntermediate: async () => ({ bytes: image, mimeType: 'image/jpeg' }),
    createVideoRequest: async () => ({
      image,
      imageMimeType: 'image/jpeg',
      imageUrl: 'https://storage.example/signed/reference.jpg',
      prompt: 'Animate the product reference.',
      durationSeconds: 6,
      aspectRatio: '9:16',
    }),
    createVideoRouter: () => [
      provider('magic-hour', async () => {
        calls.magicHour += 1;
        throw new AIProviderFailure('magichour_insufficient_credits', 'credits', 'rejected');
      }, { cost: 1 }),
      provider('replicate', async () => {
        calls.replicate += 1;
        return { providerJobId: 'remote-prediction-1', estimatedCostUsd: 0.84 };
      }, { cost: 0.84 }),
    ],
    videoStatus: async (providerId, id) => {
      calls.status.push({ providerId, id });
      return { status: 'completed', progress: 100, outputUrl: 'https://files.replicate.delivery/result.mp4' };
    },
    cancelVideo: async (providerId, id) => calls.cancel.push({ providerId, id }),
    downloadVideo: async () => mp4,
    storeResult: async (_job, path) => calls.stored.push(path),
    readStoredResult: async () => null,
    outputUrl: async () => 'https://files.replicate.delivery/result.mp4',
    triedVideoProviders: async () => new Set(),
    recordVideoStatusFailure: async (_job, code) => calls.records.push({ status: 'failed', reason: code }),
    advance: async (current, update) => {
      Object.assign(current, {
        stage: update.stage,
        progress: update.progress,
        provider: update.provider ?? current.provider,
        provider_job_id: update.providerJobId ?? current.provider_job_id,
        intermediate_image_path: update.intermediateImagePath ?? current.intermediate_image_path,
        result_object_path: update.resultObjectPath ?? current.result_object_path,
        stage_message: update.errorCode ?? update.stage,
        status_poll_attempts: current.status_poll_attempts + (update.stage === 'video_processing' ? 1 : 0),
        status: ['completed', 'failed', 'cancelled', 'uncertain'].includes(update.stage)
          ? update.stage === 'completed' ? 'completed' : update.stage === 'cancelled' ? 'cancelled' : 'failed'
          : 'processing',
      });
    },
    createAttemptStore: () => attemptStore,
    routingPolicy: () => policy(),
    ...overrides,
  };
  return { job, calls, dependencies, processor: createVideoProcessor(dependencies) };
}

test('processa a tarefa até MP4 e usa fallback Magic Hour para Replicate sem reiniciar referências', async () => {
  const state = harness({});
  assert.equal(await state.processor.processNext(), 'image_ready');
  assert.equal(state.job.intermediate_image_path, '22222222-2222-4222-8222-222222222222/intermediate/frame.jpg');
  assert.equal(await state.processor.processNext(), 'video_processing');
  assert.equal(state.job.provider, 'replicate');
  assert.equal(state.job.provider_job_id, 'remote-prediction-1');
  assert.equal(await state.processor.processNext(), 'validating');
  assert.equal(await state.processor.processNext(), 'completed');
  assert.equal(state.calls.image, 1);
  assert.equal(state.calls.magicHour, 1);
  assert.equal(state.calls.replicate, 1);
  assert.deepEqual(state.calls.stored, [
    '22222222-2222-4222-8222-222222222222/outputs/11111111-1111-4111-8111-111111111111.mp4',
  ]);
  assert.equal(state.job.result_object_path, state.calls.stored[0]);
});

test('retoma timeout de consulta pelo mesmo job remoto sem submeter geração novamente', async () => {
  let pollingFailsOnce = true;
  const state = harness({
    stage: 'video_processing',
    provider: 'replicate',
    provider_job_id: 'remote-prediction-1',
  }, {
    videoStatus: async (_providerId, id) => {
      assert.equal(id, 'remote-prediction-1');
      if (pollingFailsOnce) {
        pollingFailsOnce = false;
        throw new Error('temporary status timeout');
      }
      return { status: 'completed', progress: 100, outputUrl: 'https://files.replicate.delivery/result.mp4' };
    },
  });
  assert.equal(await state.processor.processNext(), 'video_processing');
  assert.equal(state.job.status_poll_attempts, 1);
  assert.equal(await state.processor.processNext(), 'validating');
  assert.equal(state.calls.replicate, 0);
  assert.equal(await state.processor.processNext(), 'completed');
});

test('cancela prediction Replicate sem baixar o vídeo', async () => {
  const state = harness({
    stage: 'video_processing',
    provider: 'replicate',
    provider_job_id: 'remote-prediction-1',
    cancel_requested_at: '2026-11-05T00:00:00Z',
  });
  assert.equal(await state.processor.processNext(), 'cancelled');
  assert.deepEqual(state.calls.cancel, [{ providerId: 'replicate', id: 'remote-prediction-1' }]);
  assert.equal(state.calls.status.length, 0);
  assert.equal(state.calls.stored.length, 0);
});

test('bloqueia a submissão se a reserva exceder orçamento e pede autorização', async () => {
  const state = harness({
    stage: 'image_ready',
    intermediate_image_path: '22222222-2222-4222-8222-222222222222/intermediate/frame.jpg',
  }, {
    createVideoRouter: () => [provider('replicate', async () => {
      state.calls.replicate += 1;
      return { providerJobId: 'should-not-run', estimatedCostUsd: 0.84 };
    }, { cost: 0.84 })],
    routingPolicy: () => policy({ maxCostUsdPerTask: 0.5 }),
  });
  assert.equal(await state.processor.processNext(), 'awaiting_authorization', state.job.stage_message);
  assert.equal(state.calls.replicate, 0);
  assert.equal(state.job.stage_message, 'budget_authorization_required');
});


test('referência em cache pula a geração de imagem e segue para o vídeo', async () => {
  const path = '22222222-2222-4222-8222-222222222222/intermediate/previous-reference.jpg';
  const state = harness({}, { findCachedImage: async () => path });
  assert.equal(await state.processor.processNext(), 'image_ready');
  assert.equal(state.calls.image, 0);
  assert.equal(state.job.intermediate_image_path, path);
  assert.equal(await state.processor.processNext(), 'video_processing');
});

test('falha ao atualizar o cache não repete uma imagem já produzida', async () => {
  const state = harness({}, { rememberImage: async () => { throw new Error('cache temporarily unavailable'); } });
  assert.equal(await state.processor.processNext(), 'image_ready');
  assert.equal(state.calls.image, 1);
  assert.equal(await state.processor.processNext(), 'video_processing');
  assert.equal(state.calls.image, 1);
});

test('tarefa aguardando configuração retoma automaticamente preservando a referência', async () => {
  const state = harness({ stage: 'awaiting_authorization', intermediate_image_path: 'private-reference.jpg' });
  assert.equal(await state.processor.processNext(), 'image_ready');
  assert.equal(state.calls.image, 0);
  const initial = harness({ stage: 'awaiting_authorization' });
  assert.equal(await initial.processor.processNext(), 'queued');
});

test('provedor preso em processamento termina como incerto sem outra submissão', async () => {
  const state = harness({ stage: 'video_processing', provider: 'replicate', provider_job_id: 'known-remote-job', status_poll_attempts: 120 }, {
    videoStatus: async () => ({ status: 'processing', progress: 5 }),
  });
  assert.equal(await state.processor.processNext(), 'uncertain');
  assert.equal(state.calls.replicate, 0);
  assert.equal(state.calls.magicHour, 0);
});


test('download ou Storage temporariamente indisponível retoma a finalização sem gerar novamente', async () => {
  let broken = true;
  const state = harness({ stage: 'validating', provider: 'replicate', provider_job_id: 'finished-video' }, {
    downloadVideo: async () => { if (broken) throw new AIProviderFailure('replicate_download_unavailable', 'transient', 'accepted'); return makeValidMp4(); },
  });
  assert.equal(await state.processor.processNext(), 'validating');
  broken = false;
  assert.equal(await state.processor.processNext(), 'completed');
  assert.equal(state.calls.image, 0);
  assert.equal(state.calls.replicate, 0);
});

test('vídeo com formato inválido tenta outro provedor preservando a imagem', async () => {
  const state = harness({ stage: 'validating', provider: 'magic-hour', provider_job_id: 'invalid-video', intermediate_image_path: 'owned-reference.jpg' }, {
    downloadVideo: async () => new Uint8Array([0, 1, 2]),
  });
  assert.equal(await state.processor.processNext(), 'image_ready');
  assert.equal(state.job.stage_message, 'trying_another_provider');
  assert.equal(state.calls.image, 0);
});

test('falhas persistentes de finalização encerram após o limite de tentativas', async () => {
  const state = harness({ stage: 'validating', provider: 'replicate', provider_job_id: 'finished-video', finalization_attempts: 10 }, {
    downloadVideo: async () => { throw new Error('unavailable'); },
  });
  assert.equal(await state.processor.processNext(), 'failed');
  assert.equal(state.calls.replicate, 0);
});


test('modo gratuito aguarda saldo e retoma automaticamente a mesma etapa sem recriar imagem',async()=>{
 let units=0;
 const state=harness({stage:'image_ready',intermediate_image_path:'owned-reference.jpg'},{
  routingPolicy:()=>policy({billingMode:'free-only',allowPaidGeneration:false,maxCostUsdPerTask:0,remainingDailyBudgetUsd:0}),
  createVideoRouter:()=>[freeOnlyAdapter(provider('replicate',async()=>({providerJobId:'free-remote-job',estimatedCostUsd:0.84})),async()=>({provider_id:'replicate',model:'alibaba/happyhorse-1.0',enabled:true,billing_guard:'free-plan-hard-stop',remaining_units:units,valid_until:new Date(Date.now()+86400000).toISOString(),commercial_use_confirmed:true}))],
 });
 state.dependencies.createAttemptStore().reserveFree=async()=>true;
 assert.equal(await state.processor.processNext(),'awaiting_free_credits');
 assert.equal(state.calls.image,0);
 units=100;
 assert.equal(await state.processor.processNext(),'image_ready');
 assert.equal(await state.processor.processNext(),'video_processing');
 assert.equal(state.job.provider_job_id,'free-remote-job');assert.equal(state.calls.image,0);
});

test('cancelar espera por créditos não volta a consultar o provedor',async()=>{
 const state=harness({stage:'awaiting_free_credits',provider:'replicate',provider_job_id:'old-failed-job',cancel_requested_at:'2026-11-06T00:00:00Z'});
 assert.equal(await state.processor.processNext(),'cancelled');assert.equal(state.calls.status.length,0);assert.equal(state.calls.cancel.length,0);
});

test('créditos da conta aguardam e retomam sem cota gratuita nem perda da imagem',async()=>{
 let available=false;
 const state=harness({stage:'image_ready',intermediate_image_path:'owned-reference.jpg'},{
  routingPolicy:()=>policy({billingMode:'account-credits'}),
  createVideoRouter:()=>[{...provider('replicate',async()=>({providerJobId:'account-job',estimatedCostUsd:null})),readiness:async()=>({authenticated:true,available,funding:'unknown',balanceUnits:null})}],
 });
 assert.equal(await state.processor.processNext(),'awaiting_free_credits');
 assert.equal(state.job.stage_message,'waiting_for_resources');
 available=true;
 assert.equal(await state.processor.processNext(),'image_ready');
 assert.equal(await state.processor.processNext(),'video_processing');
 assert.equal(state.job.provider_job_id,'account-job');assert.equal(state.calls.image,0);
});
