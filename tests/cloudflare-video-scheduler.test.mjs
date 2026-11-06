import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.ts';

const originalFetch = globalThis.fetch;
const marketplaceSecret = 'marketplace-test-secret';
const videoSecret = 'video-worker-test-secret';
const publishableKey = 'sb_publishable_test_key';
const env = {
  ASSETS: { fetch: async request => new Response(request.url) },
  MV_SYNC_JOB_TOKEN: marketplaceSecret,
  MV_VIDEO_WORKER_SECRET: videoSecret,
  MV_SUPABASE_PUBLISHABLE_KEY: publishableKey,
};

test('marketplace cron invokes only the marketplace endpoint with its existing token', async () => {
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(null, { status: 200 });
  };
  try {
    await worker.scheduled({ cron: '*/30 * * * *' }, env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(captured.url, 'https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/marketplace');
  assert.equal(captured.init.headers['x-mv-job-token'], marketplaceSecret);
  assert.equal(captured.init.headers['x-worker-secret'], undefined);
});

test('minute cron invokes only the authenticated video worker endpoint', async () => {
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ accepted: true }), { status: 202 });
  };
  try {
    await worker.scheduled({ cron: '* * * * *' }, env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(captured.url, 'https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/video-generation-worker');
  assert.equal(captured.init.headers.apikey, publishableKey);
  assert.equal(captured.init.headers['x-worker-secret'], videoSecret);
  assert.equal(captured.init.headers['x-mv-job-token'], undefined);
  assert.equal(captured.init.body, '{}');
});

test('disabled video processor is reported without treating a no-op as a processed job', async () => {
  let warning;
  const originalWarn = console.warn;
  globalThis.fetch = async () => new Response('{"error":"processor_disabled"}', { status: 503 });
  console.warn = message => { warning = message; };
  try {
    await worker.scheduled({ cron: '* * * * *' }, env);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
  assert.equal(warning, 'video_processor_disabled');
});

test('unexpected scheduler failures are surfaced without response bodies or tokens', async () => {
  globalThis.fetch = async () => new Response('private response body', { status: 502 });
  try {
    await assert.rejects(
      worker.scheduled({ cron: '* * * * *' }, env),
      error => error.message === 'video_scheduler_http_502' &&
        !error.message.includes(videoSecret) &&
        !error.message.includes('private response body'),
    );
    globalThis.fetch = async () => {
      throw new Error(`network failure containing ${videoSecret}`);
    };
    await assert.rejects(
      worker.scheduled({ cron: '* * * * *' }, env),
      error => error.message === 'video_scheduler_request_failed' && !error.message.includes(videoSecret),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unknown cron schedules fail instead of invoking either workflow', async () => {
  globalThis.fetch = async () => {
    throw new Error('unexpected_fetch');
  };
  try {
    await assert.rejects(worker.scheduled({ cron: '0 * * * *' }, env), /unsupported_cron_trigger/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
