import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeFunctionMessage, filterAlternativeVoices, videoSubmissionIssue } from '../src/lib/video-submission.ts';

const ready={signedIn:true,validationError:null,hasImage:true,presenterReady:true,presenterName:'Ana',duration:6};
test('generation reports actionable field errors instead of silently disabling the button',()=>{
 assert.equal(videoSubmissionIssue(ready),null);
 assert.equal(videoSubmissionIssue({...ready,signedIn:false}).message,'Entre na sua conta para gerar e guardar o vídeo.');
 assert.deepEqual(videoSubmissionIssue({...ready,validationError:'Informe o nome do produto.'}),{message:'Informe o nome do produto.',step:0});
 assert.equal(videoSubmissionIssue({...ready,hasImage:false}).step,0);
 assert.match(videoSubmissionIssue({...ready,presenterReady:false,presenterName:'Carla'}).message,/Selecione Ana ou Lucas/);
 assert.equal(videoSubmissionIssue({...ready,validationError:'Revise o roteiro.'}).step,2);
 assert.equal(videoSubmissionIssue({...ready,duration:8}).step,1);
});
test('queue errors retain the authenticated backend explanation and handle expired sessions',async()=>{
 const error={context:Response.json({error:{message:'Já existem tarefas em processamento para esta conta.'}},{status:429})};
 assert.equal(await edgeFunctionMessage(error,'fallback'),'Já existem tarefas em processamento para esta conta.');
 assert.match(await edgeFunctionMessage({context:new Response('{}',{status:401})},'fallback'),/sessão expirou/);
 assert.equal(await edgeFunctionMessage(new Error('private error'),'fallback'),'fallback');
});
test('alternative voices follow the selected gender and retain neutral voices',()=>{
 const voices=[{id:'female',gender:'female'},{id:'male',gender:'male'},{id:'neutral',gender:'neutral'},{id:'unknown',gender:''}];
 assert.deepEqual(filterAlternativeVoices(voices,'feminina').map(v=>v.id),['female','neutral','unknown']);
 assert.deepEqual(filterAlternativeVoices(voices,'masculina').map(v=>v.id),['male','neutral','unknown']);
 assert.equal(filterAlternativeVoices([],'feminina').length,0);
});
