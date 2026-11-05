import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advertisingStyles,
  buildAdvertisingScript,
  buildVideoPrompt,
  createVideoLibraryRecord,
  emotionalTones,
  estimateSceneCount,
  motionModes,
  narrationModes,
  validateVideoConfiguration,
  validateVideoProduct,
  videoDurations,
  videoScenePresets,
  videoTemplates,
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
    clothingSize: '',
  },
  templateId: 'wearing-product',
  scenePresetId: 'fashion-studio',
  presenterId: 'ana',
  voiceGender: 'feminina',
  voiceProfileId: 'natural',
  emotionalToneId: 'alegre',
  advertisingStyleId: 'tradicional',
  narrationMode: 'voiceover',
  motionMode: 'poses',
  durationSeconds: 8,
  format: '9:16',
  mode: 'ai-video',
  targetAudience: 'pessoas que procuram roupas leves',
};

test('catálogos do estúdio oferecem apresentadores, vozes, emoções, estilos e durações solicitados', () => {
  assert.deepEqual(virtualPresenters.map(item => item.name), ['Ana', 'Lucas', 'Carla', 'Rafael']);
  assert.deepEqual(virtualPresenters.map(item => item.id), ['ana', 'lucas', 'carla', 'rafael']);
  assert.deepEqual(virtualPresenters.map(item => item.bodyType), ['esguio', 'esguio', 'plus-size', 'plus-size']);
  assert.deepEqual(virtualPresenters.map(item => item.referenceStatus), ['ready', 'ready', 'pending', 'pending']);
  assert.equal(voiceProfiles.length, 7);
  assert.equal(emotionalTones.length, 8);
  assert.equal(advertisingStyles.length, 6);
  assert.equal(videoTemplates.length, 3);
  assert.ok(videoScenePresets.every(scene => videoTemplates.some(template => template.id === scene.templateId)));
  assert.deepEqual(narrationModes.map(option => option.id), ['character-speech', 'voiceover']);
  assert.deepEqual(motionModes.map(option => option.id), ['poses', 'continuous']);
  assert.deepEqual(videoDurations, [6, 7, 8]);
  assert.ok(virtualPresenters.filter(item => item.image).every(item => item.image.startsWith('/presenters/')));
  for (const template of videoTemplates) {
    const scenePresetId = videoScenePresets.find(scene => scene.templateId === template.id).id;
    for (const presenter of virtualPresenters) {
      assert.equal(validateVideoConfiguration({
        ...configuration,
        templateId: template.id,
        scenePresetId,
        presenterId: presenter.id,
      }, 'roteiro válido com conteúdo suficiente'), null);
    }
  }
});

test('produto e configuração rejeitam links inseguros e entradas incompletas', () => {
  assert.equal(validateVideoProduct(configuration.product), null);
  assert.match(validateVideoProduct({ ...configuration.product, affiliateLink: 'javascript:alert(1)' }), /HTTPS/);
  assert.match(validateVideoProduct({ ...configuration.product, affiliateLink: 'https://user:pass@example.com' }), /credenciais/);
  assert.match(validateVideoProduct({ ...configuration.product, name: '' }), /nome do produto/);
  assert.match(validateVideoProduct({ ...configuration.product, clothingSize: 'tamanho informado com mais de quarenta caracteres e inválido' }), /tamanho informado/);
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
  assert.match(prompt, /Preserve rosto, corpo, cabelo, roupa/);
  assert.match(prompt, /Preserve cor, estampa, formato, embalagem/);
  assert.match(prompt, /Não invente desconto, preço, benefício/);
  assert.match(prompt, /Personagem vestindo a roupa/);
  assert.match(prompt, /Cenário desejado: Estúdio de moda/);
  assert.match(prompt, /narração externa/i);
  assert.match(prompt, /Planeje 1 cena\(s\)/);
  assert.equal(estimateSceneCount(8), 1);
  assert.equal(estimateSceneCount(6), 1);
  assert.throws(() => estimateSceneCount(10, 0), RangeError);
});

test('tamanho de roupa informado é preservado sem inferir medidas', () => {
  const product = { ...configuration.product, clothingSize: 'G (informado pelo fabricante)' };
  const script = buildAdvertisingScript({ ...configuration, product });
  const prompt = buildVideoPrompt({ ...configuration, product }, script);
  assert.match(script, /tamanho informado é G \(informado pelo fabricante\)/);
  assert.match(prompt, /Tamanho informado pelo usuário: G \(informado pelo fabricante\)/);
  assert.match(prompt, /Não infira medidas nem numeração a partir do biotipo/);
});

test('personagem sem referência não recebe imagem de outro personagem no prompt', () => {
  const carla = virtualPresenters.find(item => item.id === 'carla');
  assert.equal(carla.image, null);
  const prompt = buildVideoPrompt({ ...configuration, presenterId: 'carla' }, 'roteiro válido com conteúdo suficiente');
  assert.match(prompt, /imagem de referência original de Carla está pendente/i);
  assert.match(prompt, /Não use a imagem de outro personagem/);
});

test('configuração exige vertical 9:16 e cenário compatível com template', () => {
  const script = 'roteiro válido com conteúdo suficiente';
  assert.equal(validateVideoConfiguration(configuration, script), null);
  assert.match(validateVideoConfiguration({ ...configuration, format: '1:1' }, script), /9:16/);
  assert.match(validateVideoConfiguration({ ...configuration, templateId: 'demonstrating-product' }, script), /cenário compatível/);
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
