import test from 'node:test';
import assert from 'node:assert/strict';
import { sharePublication, shopeeProductDestination } from '../src/lib/publication-share.ts';

test('compartilhamento consulta suporte ao pacote completo e preserva vídeo, nome e texto', async () => {
  const data = {files: [new File(['video'], 'produto.mp4', {type: 'video/mp4'})], title: 'Produto certo', text: 'Legenda\n#Produto\nhttps://shope.ee/abc'};
  let checked, sent;
  const result = await sharePublication({canShare: value => { checked = value; return true; }, share: async value => {sent = value;}}, data);
  assert.equal(result, 'shared');
  assert.equal(checked, data);
  assert.equal(sent, data);
});

test('ausência de suporte não descarta vídeo nem envia somente um link', async () => {
  let calls = 0;
  assert.equal(await sharePublication({canShare: () => false, share: async () => {calls++;}}, {text: 'Texto', files: []}), 'unsupported');
  assert.equal(await sharePublication({}, {text: 'Texto'}), 'unsupported');
  assert.equal(calls, 0);
});

test('cancelamento não é entrega e falha não é publicação', async () => {
  for (const [name, expected] of [['AbortError', 'cancelled'], ['NotAllowedError', 'failed']]) {
    const error = new Error('Sem entrega'); error.name = name;
    assert.equal(await sharePublication({canShare: () => true, share: async () => {throw error;}}, {text: 'Texto'}), expected);
  }
  assert.equal(await sharePublication({canShare: () => {throw new Error('Falha de suporte');}, share: async () => {}}, {text: 'Texto'}), 'failed');
});

test('destino de produto aceita apenas HTTPS na Shopee brasileira sem credenciais', () => {
  const url = 'https://shopee.com.br/product/123/456';
  assert.equal(shopeeProductDestination(url), url);
  for (const invalid of [undefined, '', 'javascript:alert(1)', 'http://shopee.com.br/a', 'https://shopee.com.br.evil.test/a', 'https://user:pass@shopee.com.br/a']) assert.equal(shopeeProductDestination(invalid), null);
});
