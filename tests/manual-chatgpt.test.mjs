import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatGPTBrief, publicProductText, promptDraftKey, CHATGPT_URL } from '../src/lib/manual-chatgpt.ts';

test('ChatGPT brief copies only explicit product fields and strips sensitive URLs and credentials',()=>{
 const brief=buildChatGPTBrief({name:'Cafeteira',description:'500 ml\nCor preta',features:'Aço',benefits:'Capacidade informada na embalagem',store:'Amazon',videoType:'Demonstração',duration:'8 segundos',format:'9:16',character:'Carla',presentationStyle:'Natural',instructions:'Confira a imagem',session:{access_token:'never-copy'},affiliateLink:'https://amzn.to/private-tag'});
 for(const text of ['Cafeteira','500 ml\nCor preta','Aço','Amazon','Demonstração','8 segundos','9:16','Carla','Natural','DIREÇÃO VISUAL','FALA/NARRAÇÃO'])assert.ok(brief.includes(text));
 assert.ok(!brief.includes('never-copy'));assert.ok(!brief.includes('private-tag'));assert.equal(CHATGPT_URL,'https://chatgpt.com/');
 const safe=publicProductText('api_key=privatevalue sb_secret_privatevalue sk-privatevalue user@example.com https://private.test/a?token=privatevalue eyJabc.def.ghi');
 for(const secret of ['privatevalue','user@example.com','eyJabc.def.ghi'])assert.ok(!safe.includes(secret));
});
test('manual prompt drafts are isolated by account and product without putting signed URLs in storage keys',()=>{
 const context='https://meli.la/abc?signature=private-tag';
 assert.notEqual(promptDraftKey('account-a',context),promptDraftKey('account-b',context));
 assert.notEqual(promptDraftKey(undefined,context),promptDraftKey('account-a',context));
 assert.notEqual(promptDraftKey('account-a','product-1'),promptDraftKey('account-a','product-2'));
 assert.ok(!promptDraftKey('account-a',context).includes('private-tag'));
});
