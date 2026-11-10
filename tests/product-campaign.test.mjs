import test from 'node:test';
import assert from 'node:assert/strict';
import { affiliateUrlValid, campaignCaption, campaignPrompt } from '../src/lib/product-campaign.ts';
test('publicação mantém link e hashtags sem substituir o endereço do afiliado pelo anúncio', () => {
  const link = 'https://shope.ee/abc?sub_id=campanha';
  assert.equal(campaignCaption(' Camisa preta ', link, '#Moda #Publicidade'), `Camisa preta\n\n${link}\n\n#Moda #Publicidade`);
});
test('publicação recusa protocolos executáveis, links sem HTTPS e credenciais na URL', () => {
  for (const link of ['', 'javascript:alert(1)', 'http://shope.ee/a', 'https://login:senha@shope.ee/a']) assert.equal(affiliateUrlValid(link), false);
  assert.equal(affiliateUrlValid('https://shope.ee/a'), true);
});
test('instrução exige foto exata, variantes e fala preservada nos dois idiomas sem inventar características', () => {
  const prompt = campaignPrompt({id:'a', title:'Camisa do anúncio', platform:'Shopee'}, 'Gola vermelha', 'Sala', 'Confira no link!', 'Homem adulto');
  for (const value of ['Camisa do anúncio', 'Gola vermelha', 'Sala', 'Confira no link!', 'Homem adulto', 'PORTUGUÊS', 'ENGLISH', 'mais de uma variante', 'Não invente características']) assert.ok(prompt.includes(value));
});
