import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateTimeToIso, isoToLocalDateTime } from '../src/lib/publication-time.ts';
import { createPublicationScheduleHandler } from '../supabase/functions/publication-schedule/_shared/handler.ts';

const alice = '11111111-1111-4111-8111-111111111111';
const publicationId = '33333333-3333-4333-8333-333333333333';
const key = '44444444-4444-4444-8444-444444444444';
const mediaPath = `${alice}/publications/55555555-5555-4555-8555-555555555555.mp4`;

function request(token, body) {
  return new Request('https://example.test/functions/v1/publication-schedule', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides = {}) {
  return {
    action: 'create',
    idempotencyKey: key,
    destinations: ['pinterest'],
    productId: 'public-product-1',
    productTitle: 'Produto de teste',
    sourceMarketplace: 'Shopee',
    affiliateUrl: 'https://shopee.com.br/product/123/456',
    publicationTitle: 'Título de teste',
    caption: 'Descrição preparada',
    hashtags: '#Publicidade',
    destination: 'pinterest',
    mediaPath,
    mediaType: 'video/mp4',
    mediaFilename: 'produto.mp4',
    status: 'scheduled',
    scheduledAt: '2099-01-15T15:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    ...overrides,
  };
}

function createHandler(calls) {
  return createPublicationScheduleHandler({
    authenticate: async token => token === 'alice-token' ? alice : token === 'bob-token' ? '22222222-2222-4222-8222-222222222222' : null,
    list: async userId => { calls.push(['list', userId]); return [{ userId }]; },
    create: async (userId, input, destinations) => { calls.push(['create', userId, input, destinations]); return [{ userId, input, destinations }]; },
    update: async (userId, id, input) => { calls.push(['update', userId, id, input]); return { userId, id }; },
    cancel: async (userId, id) => { calls.push(['cancel', userId, id]); return { userId, id }; },
    action: async (userId, id, action, requestKey) => { calls.push(['action', userId, id, action, requestKey]); return { userId, id, action }; },
  }, ['https://example.test']);
}

test('data e horário convertem do fuso selecionado para UTC e voltam sem deslocamento', () => {
  const iso = localDateTimeToIso('2030-01-15T12:00', 'America/Sao_Paulo', new Date('2029-01-01T00:00:00Z'));
  assert.equal(iso, '2030-01-15T15:00:00.000Z');
  assert.equal(isoToLocalDateTime(iso, 'America/Sao_Paulo'), '2030-01-15T12:00');
});

test('rejeita data passada, formato inválido, fuso desconhecido e horário inexistente por DST', () => {
  const now = new Date('2030-01-15T16:00:00Z');
  assert.throws(() => localDateTimeToIso('2030-01-15T12:00', 'America/Sao_Paulo', now), /futuro/);
  assert.throws(() => localDateTimeToIso('2030-02-30T12:00', 'UTC', now), /data e um horário válidos/);
  assert.throws(() => localDateTimeToIso('2030-01-16T12:00', 'Not/A_Timezone', now), /fuso horário válido/);
  assert.throws(() => localDateTimeToIso('2026-03-08T02:30', 'America/New_York', new Date('2026-01-01T00:00:00Z')), /não existe/);
});

test('Edge Function exige sessão e valida proprietário, mídia, destino e horário futuro', async () => {
  const calls = [];
  const handler = createHandler(calls);
  const unauthenticated = await handler(request('bad-token', validBody()));
  assert.equal(unauthenticated.status, 401);
  const wrongOwnerPath = await handler(request('alice-token', validBody({
    mediaPath: '22222222-2222-4222-8222-222222222222/publications/55555555-5555-4555-8555-555555555555.mp4',
  })));
  assert.equal(wrongOwnerPath.status, 400);
  const invalidDestination = await handler(request('alice-token', validBody({ destinations: ['tiktok'] })));
  assert.equal(invalidDestination.status, 400);
  const shopeeForOtherMarketplace = await handler(request('alice-token', validBody({
    sourceMarketplace: 'Amazon', destination: 'shopee_video', destinations: ['shopee_video'],
  })));
  assert.equal(shopeeForOtherMarketplace.status, 400);
  const past = await handler(request('alice-token', validBody({ scheduledAt: '2000-01-01T00:00:00.000Z' })));
  assert.equal(past.status, 400);
  assert.equal(calls.length, 0);
});

test('operações do painel são sempre vinculadas à identidade autenticada', async () => {
  const calls = [];
  const handler = createHandler(calls);
  const created = await handler(request('alice-token', validBody()));
  assert.equal(created.status, 201);
  assert.equal(calls[0][1], alice);
  assert.equal(calls[0][3][0], 'pinterest');

  const listed = await handler(request('bob-token', { action: 'list' }));
  assert.equal(listed.status, 200);
  assert.deepEqual(calls[1], ['list', '22222222-2222-4222-8222-222222222222']);

  const attempt = await handler(request('alice-token', {
    action: 'interaction', id: publicationId, interaction: 'manual_published',
    requestKey: '66666666-6666-4666-8666-666666666666',
  }));
  assert.equal(attempt.status, 200);
  assert.deepEqual(calls[2].slice(0, 4), ['action', alice, publicationId, 'manual_published']);
});

test('edição e cancelamento passam apenas pelo serviço autenticado do proprietário', async () => {
  const calls = [];
  const handler = createHandler(calls);
  const edited = await handler(request('alice-token', validBody({
    action: 'update',
    id: publicationId,
    status: 'scheduled',
    scheduledAt: '2099-01-16T15:00:00.000Z',
    caption: 'Descrição alterada',
  })));
  assert.equal(edited.status, 200);
  assert.equal(calls[0][0], 'update');
  assert.equal(calls[0][1], alice);
  assert.equal(calls[0][3].caption, 'Descrição alterada');

  const cancelled = await handler(request('alice-token', { action: 'cancel', id: publicationId }));
  assert.equal(cancelled.status, 200);
  assert.deepEqual(calls[1], ['cancel', alice, publicationId]);
});
