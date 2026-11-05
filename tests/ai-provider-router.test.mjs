import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIProviderFailure,
  AIProviderRouter,
  AIRoutingError,
} from '../supabase/functions/video-generation/_shared/ai-provider-router.ts';

const capability = (id, task = 'video', overrides = {}) => ({
  id,
  task,
  model: `${id}-model`,
  inputModes: ['image-reference'],
  maxReferenceImages: 2,
  durationsSeconds: [6],
  aspectRatios: ['9:16'],
  maxResolution: '720p',
  nativeAudio: false,
  lipSync: false,
  commercialUse: 'confirmed',
  freeTier: 'confirmed',
  supportsBalanceQuery: true,
  costUsdPerUnit: 0.01,
  costUnit: 'image',
  ...overrides,
});

const requirement = {
  task: 'video',
  inputModes: ['image-reference'],
  referenceImageCount: 1,
  durationSeconds: 6,
  aspectRatio: '9:16',
  commercialUse: true,
};

const policy = (overrides = {}) => ({
  allowPaidGeneration: false,
  allowUnconfirmedCommercialUse: false,
  maxCostUsdPerTask: 1,
  remainingDailyBudgetUsd: 1,
  paidProviders: new Set(),
  ...overrides,
});

function harness(providerDefinitions, policyOverrides = {}) {
  const records = [];
  const cooldowns = [];
  const reservations = [];
  const settlements = [];
  const store = {
    async record(attempt) { records.push(attempt); },
    async reserve(providerId, costUsd) {
      reservations.push({ providerId, costUsd });
      return true;
    },
    async settle(providerId, costUsd) { settlements.push({ providerId, costUsd }); },
    async release() {},
    async setCooldown(providerId, until) { cooldowns.push({ providerId, until }); },
  };
  const providers = providerDefinitions.map((definition) => ({
    capabilities: capability(definition.id, definition.task, definition.capabilities),
    async readiness() {
      return {
        authenticated: true,
        available: true,
        funding: 'free-confirmed',
        balanceUnits: 1_000,
        ...definition.readiness,
      };
    },
    async estimate(request) {
      return { units: 1, usd: 0.1, ...definition.estimate?.(request) };
    },
    async generate(request, key) {
      definition.calls = (definition.calls ?? 0) + 1;
      return definition.generate ? definition.generate(request, key) : { ok: true };
    },
  }));
  return {
    router: new AIProviderRouter(providers, store, policy(policyOverrides), () => 10_000),
    records,
    cooldowns,
    reservations,
    settlements,
    definitions: providerDefinitions,
  };
}

test('usa o primeiro provedor compatível e preserva a chave idempotente', async () => {
  const state = harness([{ id: 'first', generate: async (_request, key) => ({ key }) }]);
  const result = await state.router.generate(requirement, { prompt: 'test' }, 'job-1:image');
  assert.equal(result.providerId, 'first');
  assert.deepEqual(result.result, { key: 'job-1:image' });
});

test('registra consumo informado pelo provedor em vez de somente a estimativa inicial', async () => {
  const state = harness([
    { id: 'metered', generate: async () => ({ estimatedCostUsd: 0.08 }) },
  ]);
  await state.router.generate(requirement, {}, 'job-metered:video');
  assert.deepEqual(state.settlements, [{ providerId: 'metered', costUsd: 0.08 }]);
});

test('cai para o próximo quando o provedor rejeita por falta de créditos', async () => {
  const state = harness([
    { id: 'empty', generate: async () => { throw new AIProviderFailure('insufficient_credits', 'credits'); } },
    { id: 'next' },
  ]);
  const result = await state.router.generate(requirement, {}, 'job-2:video');
  assert.equal(result.providerId, 'next');
  assert.ok(state.cooldowns[0].until > 10_000);
});

test('HTTP 429 respeita Retry-After no circuito antes do fallback', async () => {
  const state = harness([
    { id: 'limited', generate: async () => { throw new AIProviderFailure('rate_limited', 'rate-limit', 'rejected', 120_000); } },
    { id: 'next' },
  ]);
  assert.equal((await state.router.generate(requirement, {}, 'job-3:video')).providerId, 'next');
  assert.equal(state.cooldowns[0].until, 130_000);
});

test('fallback para outro provedor após falha transitória confirmada', async () => {
  const state = harness([
    { id: 'broken', generate: async () => { throw new AIProviderFailure('provider_5xx', 'transient'); } },
    { id: 'next' },
  ]);
  assert.equal((await state.router.generate(requirement, {}, 'job-4:video')).providerId, 'next');
});

test('falha de autenticação invalida temporariamente o provedor e continua', async () => {
  const state = harness([
    { id: 'bad-auth', generate: async () => { throw new AIProviderFailure('unauthorized', 'auth'); } },
    { id: 'next' },
  ]);
  assert.equal((await state.router.generate(requirement, {}, 'job-5:video')).providerId, 'next');
  assert.equal(state.cooldowns[0].providerId, 'bad-auth');
});

test('não repete nem troca provedor quando o envio remoto ficou incerto', async () => {
  const state = harness([
    { id: 'uncertain', generate: async () => { throw new AIProviderFailure('timeout_after_submit', 'uncertain', 'unknown'); } },
    { id: 'must-not-run' },
  ]);
  await assert.rejects(
    state.router.generate(requirement, {}, 'job-6:video'),
    (error) => error instanceof AIRoutingError && error.code === 'provider_submission_uncertain',
  );
  assert.equal(state.definitions[1].calls ?? 0, 0);
});

test('descarta incompatibilidade de duração, proporção e número de referências', async () => {
  const state = harness([{
    id: 'incompatible',
    capabilities: { durationsSeconds: [5], aspectRatios: ['16:9'], maxReferenceImages: 0 },
  }]);
  await assert.rejects(state.router.generate(requirement, {}, 'job-7:video'), (error) => error.code === 'no_eligible_provider');
  assert.equal(state.reservations.length, 0);
});

test('tarefa incompatível de imagem não seleciona um modelo de vídeo', async () => {
  const state = harness([{ id: 'video-only' }]);
  await assert.rejects(
    state.router.generate({ ...requirement, task: 'image' }, {}, 'job-8:image'),
    (error) => error.code === 'no_eligible_provider',
  );
});

test('não seleciona provedor sem autenticação válida', async () => {
  const state = harness([{ id: 'unauthenticated', readiness: { authenticated: false } }]);
  await assert.rejects(state.router.generate(requirement, {}, 'job-9:video'), (error) => error.code === 'all_providers_failed');
  assert.equal(state.reservations.length, 0);
});

test('desconhecimento de saldo ou custo bloqueia geração por padrão', async () => {
  const state = harness([{
    id: 'unknown-funding',
    readiness: { funding: 'unknown' },
    estimate: () => ({ units: 1, usd: null }),
  }]);
  await assert.rejects(state.router.generate(requirement, {}, 'job-10:video'), (error) => error.code === 'all_providers_failed');
  assert.equal(state.reservations.length, 0);
});

test('não autoriza provedor pago apenas porque há saldo', async () => {
  const state = harness([{
    id: 'paid',
    readiness: { funding: 'paid-authorized' },
  }]);
  await assert.rejects(state.router.generate(requirement, {}, 'job-11:video'), (error) => error.code === 'all_providers_failed');
  assert.equal(state.reservations.length, 0);
});

test('provedor pago exige autorização explícita e inclusão na allowlist', async () => {
  const state = harness([{ id: 'paid', readiness: { funding: 'paid-authorized' } }], {
    allowPaidGeneration: true,
    paidProviders: new Set(['paid']),
  });
  assert.equal((await state.router.generate(requirement, {}, 'job-12:video')).providerId, 'paid');
});

test('bloqueia custos acima do limite por tarefa ou período', async () => {
  for (const budget of [{ maxCostUsdPerTask: 0.05 }, { remainingDailyBudgetUsd: 0.05 }]) {
    const state = harness([{ id: 'over-budget' }], budget);
    await assert.rejects(state.router.generate(requirement, {}, 'job-13:video'), (error) => error.code === 'all_providers_failed');
    assert.equal(state.reservations.length, 0);
  }
});

test('bloqueia uso comercial quando a licença do provedor não foi confirmada', async () => {
  const state = harness([{ id: 'unknown-license', capabilities: { commercialUse: 'not-confirmed' } }]);
  await assert.rejects(state.router.generate(requirement, {}, 'job-14:video'), (error) => error.code === 'all_providers_failed');
  assert.equal(state.reservations.length, 0);
});

test('circuit breaker já aberto exclui o provedor sem chamada', async () => {
  const state = harness([{ id: 'cooldown', readiness: { cooldownUntil: 20_000 } }]);
  await assert.rejects(state.router.generate(requirement, {}, 'job-15:video'), (error) => error.code === 'all_providers_failed');
  assert.equal(state.definitions[0].calls ?? 0, 0);
});

test('falha de reserva concorrente impede a geração', async () => {
  const state = harness([{ id: 'raced-budget' }]);
  state.reservations.length = 0;
  state.router = new AIProviderRouter(
    [{
      capabilities: capability('raced-budget'),
      readiness: async () => ({ authenticated: true, available: true, funding: 'free-confirmed', balanceUnits: 20 }),
      estimate: async () => ({ units: 1, usd: 0.1 }),
      generate: async () => assert.fail('não deveria gerar sem reserva'),
    }],
    {
      record: async () => {},
      reserve: async () => false,
      settle: async () => {},
      release: async () => {},
      setCooldown: async () => {},
    },
    policy(),
  );
  await assert.rejects(state.router.generate(requirement, {}, 'job-16:video'), (error) => error.code === 'all_providers_failed');
});

test('registra provedores pulados e tentativas sem registrar segredos', async () => {
  const state = harness([
    { id: 'unknown-license', capabilities: { commercialUse: 'not-confirmed' } },
    { id: 'usable' },
  ]);
  await state.router.generate(requirement, { prompt: 'private prompt' }, 'job-17:video');
  assert.ok(state.records.some((entry) => entry.status === 'skipped' && entry.reason === 'commercial_use_unconfirmed'));
  assert.doesNotMatch(JSON.stringify(state.records), /private prompt|token|secret/i);
});
