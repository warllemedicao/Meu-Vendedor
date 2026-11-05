import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowPrompt, buildStoryScript, estimateVideoCount, flowCreditCost } from '../src/lib/video-studio.ts';

const input = {
  characterName: 'Mimi Morango',
  characterDescription: 'um morango fictício, alegre e expressivo',
  productName: 'garrafa térmica',
  productBenefit: 'mantém a bebida fria por 8 horas',
  storyKind: 'discovery',
  action: 'demonstra o uso',
  mood: 'engraçado e acolhedor',
  voice: 'feminina, animada e natural',
  durationSeconds: 8,
};

test('estimate Flow credit costs for reference-friendly video settings', () => {
  assert.equal(flowCreditCost('omni360', 8), 6);
  assert.equal(flowCreditCost('omni720', 8), 12);
  assert.equal(flowCreditCost('veoLite', 8), 10);
  assert.equal(flowCreditCost('veoFast', 8), 20);
  assert.throws(() => flowCreditCost('veoLite', 6), RangeError);
  assert.equal(estimateVideoCount(50, 6), 8);
  assert.equal(estimateVideoCount(0, 6), 0);
  assert.throws(() => estimateVideoCount(-1, 6), RangeError);
});

test('build a story and product-safe Flow prompt from chosen options', () => {
  const script = buildStoryScript(input);
  const prompt = buildFlowPrompt(input);
  assert.match(script, /Mimi Morango/);
  assert.match(script, /garrafa térmica/);
  assert.match(script, /mantém a bebida fria por 8 horas/);
  assert.match(prompt, /vertical 9:16 de 8 segundos/);
  assert.match(prompt, /Preserve formato, cores, embalagem, rótulo, logotipo e texto/);
  assert.match(prompt, /não invente detalhes nem características/);
});
