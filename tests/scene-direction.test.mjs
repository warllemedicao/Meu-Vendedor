import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneDirection} from '../supabase/functions/video-generation/_shared/scene-direction.ts';
test('direção descreve um ambiente concreto para cada cenário e substitui fundos de catálogo',()=>{
 for(const [id,word] of [['fashion-studio','showroom'],['everyday-outfit','sofá'],['beauty-counter','espelho'],['neutral-product-table','madeira'],['electronics-studio','monitor'],['cleaning-kitchen','pia'],['bathroom-counter','azulejos']]) {
  const prompt=sceneDirection(id);assert.ok(prompt.includes(word));assert.ok(prompt.includes('não copie fundo branco'));
 }
 assert.equal(sceneDirection('unknown'),sceneDirection('neutral-product-table'));
});
