import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCatalogHandler } from '../supabase/functions/catalog/_shared/public-catalog.ts';

const json = body => new Response(JSON.stringify(body));
const request = (platform, options={}) => new Request(`https://example.test/catalog-public?platform=${platform}`,options);
const config=JSON.stringify({amazon:{clientId:'test-client',clientSecret:'test-secret',partnerTag:'test-owner-20'}});
const item={asin:'B000000001',detailPageURL:'https://www.amazon.com.br/dp/B000000001?tag=test-owner-20',itemInfo:{title:{displayValue:'Produto de teste'}},offersV2:{listings:[{price:{money:{amount:90,currency:'BRL'},savings:{percentage:10}}}]}};

test('vitrine: só três plataformas, sem login, sem configuração não inventa produtos nem consulta acessos pessoais',async()=>{
 let calls=0;
 const handler=createPublicCatalogHandler({configuration:()=>undefined,fetcher:async()=>{calls++;return json({});}});
 for(const platform of ['shopee','amazon','tiktok']){
  const response=await handler(request(platform));assert.equal(response.status,503);
  const data=await response.json();assert.equal(data.error.code,'catalog_not_configured');assert.equal(data.products,undefined);
 }
 for(const platform of ['mercadolivre','magalu','shein','aliexpress','../private'])assert.equal((await handler(request(platform))).status,400);
 assert.equal(calls,0);
 assert.equal((await handler(request('amazon',{method:'POST',body:'{}'}))).status,405);
 const preflight=await handler(request('amazon',{method:'OPTIONS'}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'*');
});

test('vitrine: consulta sem sessão, não encaminha token do visitante e remove tag de afiliado dos links Amazon',async()=>{
 const handler=createPublicCatalogHandler({configuration:()=>config,fetcher:async(url,init)=>{
  assert.notEqual(init.headers?.Authorization,'Bearer visitor-session');
  return url.includes('/auth/')?json({access_token:'test-api-token'}):json({searchResult:{items:[item]}});
 }});
 const response=await handler(request('amazon',{headers:{Authorization:'Bearer visitor-session'}}));
 assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.products[0].productUrl,'https://www.amazon.com.br/dp/B000000001');assert.equal(data.products[0].price,90);
 for(const privateValue of ['test-secret','test-api-token','test-owner-20','visitor-session'])assert.ok(!JSON.stringify(data).includes(privateValue));
});

test('vitrine: cache de dez minutos e coalescência evitam repetir chamadas por visitante; configuração nova invalida resultados',async()=>{
 let now=1700000000000,calls=0,current=config;
 const handler=createPublicCatalogHandler({configuration:()=>current,now:()=>now,fetcher:async(url)=>{calls++;return url.includes('/auth/')?json({access_token:'test-api-token'}):json({searchResult:{items:[item]}});}});
 const responses=await Promise.all(Array.from({length:8},()=>handler(request('amazon'))));
 assert.ok(responses.every(response=>response.status===200));assert.equal(calls,2);
 now+=599999;assert.equal((await handler(request('amazon'))).status,200);assert.equal(calls,2);
 now+=2;assert.equal((await handler(request('amazon'))).status,200);assert.equal(calls,4);
 current=undefined;assert.equal((await handler(request('amazon'))).status,503);assert.equal(calls,4);
});

test('vitrine: falha de provedor não serve catálogo vencido como atual e impõe espera de 30 segundos',async()=>{
 let now=1700000000000,fail=false,calls=0;
 const handler=createPublicCatalogHandler({configuration:()=>config,now:()=>now,fetcher:async(url)=>{calls++;return fail?new Response('test-secret',{status:503}):url.includes('/auth/')?json({access_token:'test-api-token'}):json({searchResult:{items:[item]}});}});
 assert.equal((await handler(request('amazon'))).status,200);
 now+=600001;fail=true;const response=await handler(request('amazon'));assert.equal(response.status,503);assert.ok(!(await response.text()).includes('test-secret'));
 assert.equal((await handler(request('amazon'))).status,429);assert.equal(calls,3);
 now+=30001;assert.equal((await handler(request('amazon'))).status,503);assert.equal(calls,4);
});

test('vitrine Shopee: produtos reais normalizados sem acessar banco, credenciais ou links pessoais de usuários',async()=>{
 const handler=createPublicCatalogHandler({configuration:()=>JSON.stringify({shopee:{appId:'1234',secret:'test-secret'}}),fetcher:async(url)=>{
  assert.equal(url,'https://open-api.affiliate.shopee.com.br/graphql');
  return json({data:{productOfferV2:{nodes:[{itemId:'1234567',shopId:'9876',productName:'Produto teste',productLink:'https://shopee.com.br/product/9876/1234567?tracking=remove',price:'20',priceDiscountRate:10,sales:'55'}],pageInfo:{hasNextPage:false}}}});
 }});
 const response=await handler(request('shopee'));assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.products[0].platform,'shopee');assert.equal(data.products[0].price,20);assert.equal(data.products[0].currency,'BRL');assert.equal(data.products[0].sales,'55');assert.equal(data.products[0].productUrl,'https://shopee.com.br/product/9876/1234567');
});
