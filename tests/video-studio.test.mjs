import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advertisingStyles,
  buildAdvertisingScript,
  buildVideoPrompt,
  createVideoLibraryRecord,
  emotionalTones,
  estimateSceneCount,
  validateVideoConfiguration,
  validateVideoProduct,
  videoDurations,
  virtualPresenters,
  voiceProfiles,
} from '../src/lib/video-studio.ts';

const configuration = {
  product: {
    sourceProductId: null,
    name: 'Blusa feminina',
    description: 'Blusa leve com modelagem reta.',
    price: 'R$ 89,90',
    features: 'tecido de linho\nfechamento frontal',
    affiliateLink: 'https://example.com/produto',
    imageUrl: '',
    imageName: 'blusa.webp',
  },
  presenterId: 'ana',
  voiceGender: 'feminina',
  voiceProfileId: 'natural',
  emotionalToneId: 'alegre',
  advertisingStyleId: 'tradicional',
  durationSeconds: 15,
  format: '9:16',
  mode: 'ai-video',
  targetAudience: 'pessoas que procuram roupas leves',
};

test('catálogos do estúdio oferecem apresentadores, vozes, emoções, estilos e durações solicitados', () => {
  assert.deepEqual(virtualPresenters.map(item => item.name), ['Ana', 'Lucas', 'Carla', 'Rafael']);
  assert.equal(voiceProfiles.length, 7);
  assert.equal(emotionalTones.length, 8);
  assert.equal(advertisingStyles.length, 6);
  assert.deepEqual(videoDurations, [10, 15, 20, 30, 45, 60]);
  assert.ok(virtualPresenters.every(item => item.image.startsWith('/presenters/')));
});

test('produto e configuração rejeitam links inseguros e entradas incompletas', () => {
  assert.equal(validateVideoProduct(configuration.product), null);
  assert.match(validateVideoProduct({ ...configuration.product, affiliateLink: 'javascript:alert(1)' }), /HTTPS/);
  assert.match(validateVideoProduct({ ...configuration.product, affiliateLink: 'https://user:pass@example.com' }), /credenciais/);
  assert.match(validateVideoProduct({ ...configuration.product, name: '' }), /nome do produto/);
  assert.equal(validateVideoConfiguration(configuration, 'roteiro válido com conteúdo suficiente'), null);
  assert.match(validateVideoConfiguration(configuration, 'curto'), /roteiro/);
});

test('roteiro e prompt usam somente dados informados e preservam personagem e produto', () => {
  const script = buildAdvertisingScript(configuration);
  const prompt = buildVideoPrompt(configuration, script);
  assert.match(script, /Blusa feminina/);
  assert.match(script, /tecido de linho/);
  assert.match(script, /R\$ 89,90/);
  assert.doesNotMatch(script, /desconto|garantia|comprovado/i);
  assert.match(prompt, /Preserve rosto, cabelo, roupa/);
  assert.match(prompt, /Preserve cor, estampa, formato, embalagem/);
  assert.match(prompt, /Não invente desconto, preço, benefício/);
  assert.match(prompt, /2 cena\(s\)/);
  assert.equal(estimateSceneCount(60), 8);
  assert.throws(() => estimateSceneCount(10, 0), RangeError);
});

test('registro de demonstração nunca afirma que existe um vídeo real', () => {
  const script = buildAdvertisingScript(configuration);
  const prompt = buildVideoPrompt(configuration, script);
  const record = createVideoLibraryRecord(configuration, script, prompt, {
    id: '11111111-1111-4111-8111-111111111111',
    now: '2026-11-05T12:00:00.000Z',
    providerJobId: 'mock-job',
  });
  assert.equal(record.status, 'simulation_completed');
  assert.equal(record.provider, 'mock');
  assert.equal(record.resultUrl, null);
  assert.equal(record.product.name, 'Blusa feminina');
});
