import test from 'node:test';
import assert from 'node:assert/strict';
import { getMarketplaceSelection, marketplaceDirectory, officialAffiliateUrl, manualCampaignSpeech } from '../src/lib/marketplace-directory.ts';
import { campaignCaption } from '../src/lib/product-campaign.ts';

test('manual campaigns preserve signed affiliate URLs for every marketplace', () => {
  const links = { shopee: 'https://s.shopee.com.br/AbC?sub_id=a%2Fb&src=x+y', amazon: 'https://www.amazon.com.br/dp/B000001?tag=owner-20&ref_=a%2Fb', mercadolivre: 'https://meli.la/AbC?matt_tool=123&signature=a%2Bz', aliexpress: 'https://s.click.aliexpress.com/e/AbC?af=123&aff_fcid=a%2Fb', tiktok: 'https://vt.tiktok.com/AbC/?k=a%2Bz', magalu: 'https://www.magazinevoce.com.br/magazineowner/p/123?partner_id=1', shein: 'https://br.shein.com/item.html?aff_id=abc&code=a%2Bz' };
  for (const item of marketplaceDirectory) {
    const url = links[item.id];
    assert.equal(officialAffiliateUrl(item.id, url), true, item.name);
    assert.ok(campaignCaption(item.name, url, '#Publicidade').includes(url));
    for (const bad of ['http://'+item.hosts[0]+'/x', 'https://'+item.hosts[0]+'.evil.test/x', 'https://'+item.hosts[0]+'@evil.test/x', 'https://user:password@'+item.hosts[0]+'/x', 'https://'+item.hosts[0]+'/a b', 'javascript:alert(1)']) assert.equal(officialAffiliateUrl(item.id, bad), false, bad);
  }
});

test('manual campaign script identifies advertising and avoids invented price or performance claims', () => {
  const speech = manualCampaignSpeech('Cafeteira elétrica');
  assert.ok(speech.includes('Cafeteira elétrica'));
  assert.match(speech, /Publicidade/);
  assert.match(speech, /comissão/);
  assert.doesNotMatch(speech, /R\$|\d+%|mais vendido|últimas unidades/i);
});

test('Products selects a single marketplace and maps legacy aggregate values to Shopee', () => {
  assert.equal(getMarketplaceSelection('all'), 'shopee');
  assert.equal(getMarketplaceSelection(null), 'shopee');
  assert.equal(getMarketplaceSelection('unknown'), 'shopee');
  assert.ok(marketplaceDirectory.every(item => item.id !== 'all'));
  for (const item of marketplaceDirectory) {
    assert.equal(getMarketplaceSelection(item.id), item.id);
  }
});
