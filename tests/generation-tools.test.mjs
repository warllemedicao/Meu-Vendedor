import test from 'node:test';
import assert from 'node:assert/strict';
import { allowsVideoProvider, generationTools } from '../supabase/functions/video-generation/_shared/generation-tools.ts';

test('explicit tool selection never falls back to another provider', () => {
  for (const selected of ['google-gemini', 'magic-hour', 'replicate']) {
    for (const provider of ['google-gemini', 'magic-hour', 'replicate']) {
      assert.equal(allowsVideoProvider(selected, provider), selected === provider);
    }
  }
  assert.equal(allowsVideoProvider('auto', 'magic-hour'), true);
  assert.equal(allowsVideoProvider(undefined, 'google-gemini'), true);
  for (const tool of ['google-flow', 'youtube-create', 'unknown']) {
    assert.equal(allowsVideoProvider(tool, 'google-gemini'), false);
  }
});

test('unimplemented tools cannot become available through Google API credentials', () => {
  const tools = generationTools([{ id: 'google-gemini', configured: true }]);
  assert.equal(tools.find(t => t.id === 'google-gemini').available, true);
  assert.equal(tools.find(t => t.id === 'google-flow').available, false);
  assert.equal(tools.find(t => t.id === 'youtube-create').available, false);
  assert.equal(tools.find(t => t.id === 'magic-hour').available, false);
  assert.equal(generationTools([]).find(t => t.id === 'auto').available, false);
});
