import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAffiliateLink} from '../src/lib/affiliate-links.ts';
import {authErrorMessage} from '../src/lib/auth-errors.ts';
const base={platform_id:'amazon',title:'Meu produto',url:'https://amzn.to/example',campaign:'',notes:''};
test('links aceitam HTTPS e bloqueiam scripts, credenciais, tamanho e plataforma inválida',()=>{
 assert.equal(validateAffiliateLink(base),null);
 for(const url of ['javascript:alert(1)','http://example.com','data:text/html,example','https://user:pass@example.com','https://example.com/a b','not-a-url','https://example.com/'+ 'x'.repeat(2048)])assert.ok(validateAffiliateLink({...base,url}));
 assert.ok(validateAffiliateLink({...base,platform_id:'other'}));
 assert.ok(validateAffiliateLink({...base,title:'   '}));
 assert.ok(validateAffiliateLink({...base,campaign:'x'.repeat(101)}));
 assert.ok(validateAffiliateLink({...base,notes:'x'.repeat(1001)}));
});
test('erros de autenticação não expõem respostas internas',()=>{
 assert.match(authErrorMessage('invalid_credentials'),/inválidos/);
 assert.match(authErrorMessage('email_not_confirmed'),/Confirme/);
 assert.equal(authErrorMessage('unexpected-secret-value'),authErrorMessage());
});
