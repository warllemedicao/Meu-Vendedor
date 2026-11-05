import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIProviderFailure,
} from '../supabase/functions/video-generation/_shared/ai-provider-router.ts';
import {
  createCloudflareWorkersAIProvider,
} from '../supabase/functions/video-generation/_shared/providers/cloudflare-workers-ai.ts';
import {
  createMagicHourVideoProvider,
} from '../supabase/functions/video-generation/_shared/providers/magic-hour.ts';
import {
  createReplicateVideoProvider,
} from '../supabase/functions/video-generation/_shared/providers/replicate.ts';

const ready = async () => ({
  authenticated: true,
  available: true,
  funding: 'paid-authorized',
  balanceUnits: 10_000,
});

test('Cloudflare FLUX.2 envia duas referências como multipart e calcula custo documentado', async () => {
  let url = '';
  let init;
  const provider = createCloudflareWorkersAIProvider({
    accountId: 'account-id',
    apiToken: 'server-only-token',
    readiness: ready,
    fetcher: async (target, options) => {
      url = String(target);
      init = options;
      return new Response(JSON.stringify({
        result: { image: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64') },
      }), { status: 200 });
    },
  });
  const request = {
    prompt: 'Preserve o produto e o personagem de referência.',
    references: [
      { bytes: new Uint8Array([1]), mimeType: 'image/webp', width: 512, height: 512 },
      { bytes: new Uint8Array([2]), mimeType: 'image/jpeg', width: 256, height: 512 },
    ],
    outputWidth: 512,
    outputHeight: 910,
    steps: 25,
  };
  assert.deepEqual(await provider.estimate(request), { units: 2819, usd: 0.031 });
  const result = await provider.generate(request, 'job-1:image');
  assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/account-id/ai/run/@cf/black-forest-labs/flux-2-dev');
  assert.equal(init.headers.Authorization, 'Bearer server-only-token');
  assert.ok(init.body instanceof FormData);
  assert.equal(init.body.get('input_image_0').name, 'reference-0.webp');
  assert.equal(result.estimatedCostUsd, 0.031);
  assert.equal(result.mimeType, 'image/jpeg');
});

test('Cloudflare trata saída que não é imagem como submissão incerta', async () => {
  const provider = createCloudflareWorkersAIProvider({
    accountId: 'account-1',
    apiToken: 'server-only-token',
    readiness: ready,
    fetcher: async () => new Response(JSON.stringify({ result: { image: Buffer.from('not-an-image').toString('base64') } }), { status: 200 }),
  });
  const imageRequest = {
    prompt: 'Preserve the provided references.',
    references: [{ bytes: new Uint8Array([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg', width: 512, height: 512 }],
    outputWidth: 512,
    outputHeight: 910,
    steps: 25,
  };
  await assert.rejects(
    provider.generate(imageRequest, 'job-image'),
    (error) => error instanceof AIProviderFailure &&
      error.code === 'cloudflare_output_image_invalid' &&
      error.submission === 'accepted',
  );
});

test('Cloudflare recusa imagens maiores que o limite documentado antes de chamar a API', async () => {
  let calls = 0;
  const provider = createCloudflareWorkersAIProvider({
    accountId: 'account-id',
    apiToken: 'server-only-token',
    readiness: ready,
    fetcher: async () => { calls += 1; return new Response('{}'); },
  });
  await assert.rejects(
    provider.estimate({
      prompt: 'test',
      references: [{ bytes: new Uint8Array([1]), mimeType: 'image/webp', width: 640, height: 800 }],
      outputWidth: 512,
      outputHeight: 910,
      steps: 25,
    }),
    (error) => error instanceof AIProviderFailure && error.code === 'reference_image_dimensions_unsupported',
  );
  assert.equal(calls, 0);
});

test('Cloudflare converte erro 429 em cooldown com Retry-After', async () => {
  const provider = createCloudflareWorkersAIProvider({
    accountId: 'account-id',
    apiToken: 'server-only-token',
    readiness: ready,
    fetcher: async () => new Response('{}', { status: 429, headers: { 'Retry-After': '12' } }),
  });
  await assert.rejects(
    provider.generate({
      prompt: 'test',
      references: [],
      outputWidth: 512,
      outputHeight: 512,
      steps: 1,
    }, 'job-2:image'),
    (error) => error instanceof AIProviderFailure && error.category === 'rate-limit' && error.retryAfterMs === 12_000,
  );
});

test('Magic Hour faz preflight de saldo e não considera créditos gratuitos automaticamente', async () => {
  let calls = 0;
  const provider = createMagicHourVideoProvider({
    apiKey: 'server-only-token',
    creditUsd: null,
    commercialUseConfirmed: false,
    freeCreditsConfirmed: false,
    paidSpendAuthorized: false,
    fetcher: async () => {
      calls += 1;
      return new Response(JSON.stringify({ tier: 'free', credits: 500 }), { status: 200 });
    },
  });
  assert.deepEqual(await provider.getAccount(), { tier: 'free', credits: 500 });
  const readiness = await provider.readiness();
  assert.equal(readiness.funding, 'unknown');
  assert.equal(readiness.balanceUnits, 500);
  assert.equal((await provider.estimate({ durationSeconds: 6 })).units, 144);
  assert.equal((await provider.estimate({ durationSeconds: 6 })).usd, null);
  assert.equal(calls, 2);
});

test('Magic Hour recusa duração diferente de 6 segundos sem criar job', async () => {
  const provider = createMagicHourVideoProvider({
    apiKey: 'server-only-token',
    creditUsd: 0.01,
    commercialUseConfirmed: true,
    freeCreditsConfirmed: true,
    paidSpendAuthorized: false,
    fetcher: async () => assert.fail('não deveria chamar provedor'),
  });
  await assert.rejects(
    provider.generate({
      image: new Uint8Array([1]),
      imageMimeType: 'image/webp',
      prompt: 'test',
      durationSeconds: 7,
      aspectRatio: '9:16',
    }, 'job-3:video'),
    (error) => error instanceof AIProviderFailure && error.category === 'incompatible',
  );
});

test('Magic Hour envia imagem e submete vídeo de 6s em 480p usando modelo fixado', async () => {
  const calls = [];
  const provider = createMagicHourVideoProvider({
    apiKey: 'server-only-token',
    creditUsd: 0.01,
    commercialUseConfirmed: true,
    freeCreditsConfirmed: true,
    paidSpendAuthorized: false,
    fetcher: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/v1/files/upload-urls')) {
        return new Response(JSON.stringify({
          items: [{ upload_url: 'https://videos.magichour.ai/api-assets/id/input.webp?sig=test', file_path: 'api-assets/id/input.webp' }],
        }), { status: 200 });
      }
      if (String(url).startsWith('https://videos.magichour.ai/')) return new Response('', { status: 200 });
      return new Response(JSON.stringify({ id: 'mh-job-1', credits_charged: 144 }), { status: 200 });
    },
  });
  const result = await provider.generate({
    image: new Uint8Array([1, 2, 3]),
    imageMimeType: 'image/webp',
    prompt: 'Animate the prepared vertical image.',
    durationSeconds: 6,
    aspectRatio: '9:16',
  }, 'job-4:video');
  const createRequest = calls.at(-1);
  assert.equal(createRequest.url, 'https://api.magichour.ai/v1/image-to-video');
  assert.equal(JSON.parse(createRequest.init.body).end_seconds, 6);
  assert.equal(JSON.parse(createRequest.init.body).model, 'ltx-2.5');
  assert.equal(JSON.parse(createRequest.init.body).resolution, '480p');
  assert.deepEqual(result, { providerJobId: 'mh-job-1', creditsCharged: 144, estimatedCostUsd: 1.44 });
});

test('Magic Hour nunca envia arquivos a domínios inesperados', async () => {
  let calls = 0;
  const provider = createMagicHourVideoProvider({
    apiKey: 'server-only-token',
    creditUsd: 0.01,
    commercialUseConfirmed: true,
    freeCreditsConfirmed: false,
    paidSpendAuthorized: true,
    fetcher: async (url) => {
      calls += 1;
      if (String(url).endsWith('/v1/files/upload-urls')) {
        return new Response(JSON.stringify({
          items: [{ upload_url: 'https://attacker.example/upload', file_path: 'asset.webp' }],
        }), { status: 200 });
      }
      return new Response('{}');
    },
  });
  await assert.rejects(provider.generate({
    image: new Uint8Array([1]),
    imageMimeType: 'image/webp',
    prompt: 'test',
    durationSeconds: 6,
    aspectRatio: '9:16',
  }, 'job-5:video'), (error) => error.code === 'magichour_invalid_asset_url');
  assert.equal(calls, 1);
});

test('Magic Hour não permite retry/fallback após timeout de submissão ambíguo', async () => {
  const provider = createMagicHourVideoProvider({
    apiKey: 'server-only-token',
    creditUsd: 0.01,
    commercialUseConfirmed: true,
    freeCreditsConfirmed: true,
    paidSpendAuthorized: false,
    fetcher: async (url) => {
      if (String(url).endsWith('/v1/files/upload-urls')) {
        return new Response(JSON.stringify({
          items: [{ upload_url: 'https://videos.magichour.ai/api-assets/id/input.webp?sig=test', file_path: 'api-assets/id/input.webp' }],
        }), { status: 200 });

        test('Replicate envia previsão assíncrona HappyHorse com imagem privada e parâmetros compatíveis', async () => {
          let url = '';
          let options;
          const provider = createReplicateVideoProvider({
            apiToken: 'server-only-replicate-token',
            supabaseUrl: 'https://project.supabase.co',
            paidSpendAuthorized: true,
            commercialUseConfirmed: true,
            fetcher: async (target, init) => {
              url = String(target);
              options = init;
              return new Response(JSON.stringify({ id: 'prediction-id-1234', status: 'starting' }), { status: 201 });
            },
          });
          const request = {
            imageUrl: 'https://project.supabase.co/storage/v1/object/sign/mv-video-assets/user/outputs/frame.webp?token=signed',
            prompt: 'Apresentadora mostra o produto com movimentos leves.',
            durationSeconds: 6,
            aspectRatio: '9:16',
          };
          assert.deepEqual(await provider.estimate(request), { units: 6, usd: 0.84 });
          const result = await provider.generate(request, 'job-1:video');
          assert.equal(url, 'https://api.replicate.com/v1/models/alibaba/happyhorse-1.0/predictions');
          assert.equal(options.headers.Authorization, 'Bearer server-only-replicate-token');
          assert.equal(JSON.parse(options.body).input.duration, 6);
          assert.equal(JSON.parse(options.body).input.resolution, '720p');
          assert.equal(result.providerJobId, 'prediction-id-1234');
          assert.doesNotMatch(JSON.stringify(options), /server-only-replicate-token/);
        });

        test('Replicate rejeita URL externa e parâmetros incompatíveis antes de submeter', async () => {
          let calls = 0;
          const provider = createReplicateVideoProvider({
            apiToken: 'server-only-token',
            supabaseUrl: 'https://project.supabase.co',
            paidSpendAuthorized: true,
            commercialUseConfirmed: true,
            fetcher: async () => { calls += 1; return new Response('{}', { status: 201 }); },
          });
          const request = {
            imageUrl: 'https://attacker.example/file.webp',
            prompt: 'Animação de produto.',
            durationSeconds: 6,
            aspectRatio: '9:16',
          };
          await assert.rejects(provider.generate(request, 'job-2:video'), (error) =>
            error instanceof AIProviderFailure && error.code === 'replicate_input_url_invalid');
          await assert.rejects(provider.estimate({ ...request, durationSeconds: 5 }), (error) =>
            error instanceof AIProviderFailure && error.code === 'replicate_video_parameters_unsupported');
          assert.equal(calls, 0);
        });

        test('Replicate monitora, cancela e baixa apenas um resultado MP4 confiável', async () => {
          const calls = [];
          const mp4 = new Uint8Array(16);
          mp4.set([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70]);
          const provider = createReplicateVideoProvider({
            apiToken: 'server-only-token',
            supabaseUrl: 'https://project.supabase.co',
            paidSpendAuthorized: true,
            commercialUseConfirmed: true,
            fetcher: async (target, options) => {
              calls.push({ url: String(target), method: options?.method ?? 'GET' });
              if (String(target).endsWith('/cancel')) return new Response(null, { status: 200 });
              if (String(target).startsWith('https://api.replicate.com/')) {
                return new Response(JSON.stringify({
                  status: 'succeeded',
                  output: ['https://files.replicate.delivery/output.mp4'],
                }), { status: 200 });
              }
              return new Response(mp4, { status: 200, headers: { 'Content-Type': 'video/mp4' } });
            },
          });
          const status = await provider.status('prediction-id-1234');
          assert.equal(status.status, 'completed');
          assert.equal(status.outputUrl, 'https://files.replicate.delivery/output.mp4');
          await provider.cancel('prediction-id-1234');
          assert.deepEqual(Array.from(await provider.download(status.outputUrl)), Array.from(mp4));
          assert.equal(calls[1].method, 'POST');
          await assert.rejects(provider.download('https://evil.example/output.mp4'), (error) =>
            error instanceof AIProviderFailure && error.code === 'replicate_output_url_invalid');
        });
      }
      if (String(url).startsWith('https://videos.magichour.ai/')) return new Response('', { status: 200 });
      throw new Error('timeout after request');
    },
  });
  await assert.rejects(provider.generate({
    image: new Uint8Array([1]),
    imageMimeType: 'image/webp',
    prompt: 'test',
    durationSeconds: 6,
    aspectRatio: '9:16',
  }, 'job-6:video'), (error) => error.category === 'uncertain' && error.submission === 'unknown');
});
