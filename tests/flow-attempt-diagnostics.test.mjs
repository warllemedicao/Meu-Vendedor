import test from 'node:test';
import assert from 'node:assert/strict';
import {readFlowDiagnostic, formatFlowDiagnostic, missingFlowDiagnostic} from '../supabase/functions/_shared/flow-diagnostics.ts';
import {requestFlowExecutor} from '../supabase/functions/_shared/flow-executor-diagnostics.ts';

const traceId='11111111-2222-4333-8444-555555555555';
const options={target:'https://owner.modal.run/hyperbrowser-navigate',secret:'private-control-secret',endpoint:'wss://browser.hyperbrowser.ai/?token=private-session',mode:'prepare-draft',traceId,prompt:'private-prompt'};
const report=(overrides={})=>({schemaVersion:1,traceId,action:'prepare-draft',executorRevision:'abcdef123456',elapsedMs:45000,stopReason:'flow_images_not_ready',lastStage:'images_wait',events:[{stage:'images_wait',status:'waiting',atMs:44000,metrics:{expected:2,visible:1,busy:true,stable:0,required:3,frameErrors:0}}],...overrides});

test('relatório identifica espera parcial e remove conteúdo privado e campos arbitrários',()=>{
 const raw=report({prompt:'private-prompt',url:'private-session',events:[{stage:'images_wait',status:'waiting',atMs:44000,metrics:{expected:2,visible:1,busy:true,prompt:'private-prompt',token:'private-session'}},{stage:'private-prompt',status:'ok',atMs:1,metrics:{}}]});
 const safe=readFlowDiagnostic(raw,traceId,'prepare-draft');
 const text=formatFlowDiagnostic(safe,'2026-11-15T18:00:00.000Z');
 assert.match(text,/imagens esperadas=2; imagens detectadas pelo nome=1/);
 assert.match(text,/flow_images_not_ready/);
 assert.doesNotMatch(JSON.stringify(safe)+text,/private-prompt|private-session/);
 assert.equal(safe.events.length,1);
 assert.equal(readFlowDiagnostic(raw,'22222222-2222-4333-8444-555555555555','prepare-draft'),null);
 assert.equal(readFlowDiagnostic(raw,traceId,'inspect-editor'),null);
});

test('HTTP 502 mantém etapa, motivo seguro e trace da tentativa em vez de erro genérico',async()=>{
 const result=await requestFlowExecutor(options,async(_url,init)=>{
  const sent=JSON.parse(init.body);
  assert.equal(sent.traceId,traceId);
  assert.equal(sent.prompt,'private-prompt');
  assert.equal(init.redirect,'error');
  return Response.json({detail:{code:'flow_images_not_ready',diagnostics:report()}},{status:502});
 });
 assert.equal(result.error,'flow_images_not_ready');
 assert.equal(result.diagnostics.lastStage,'images_wait');
 assert.equal(result.diagnostics.events[0].metrics.visible,1);
 assert.equal(result.diagnostics.traceId,traceId);
});

test('sucesso parcial explica falta de implementação e não anuncia geração pronta',async()=>{
 const result=await requestFlowExecutor(options,async()=>Response.json({inspectionReady:true,promptStaged:true,imageAttached:true,diagnostics:report({stopReason:'references_not_implemented',lastStage:'finished'})}));
 const text=formatFlowDiagnostic(result.diagnostics,'2026-11-15T18:00:00.000Z');
 assert.match(text,/Incluir no comando ainda não foi implementado/);
 assert.equal(result.diagnostics.referencesVerified,false);
 assert.equal(result.diagnostics.generationStarted,false);
});

test('executor antigo sem relatório é distinguido de upload confirmado',async()=>{
 const result=await requestFlowExecutor(options,async()=>Response.json({inspectionReady:true,imageAttached:true}));
 assert.equal(result.diagnostics.stopReason,'executor_report_unavailable');
 assert.equal(result.diagnostics.executorRevision,'unknown');
 assert.deepEqual(result.diagnostics.events,[]);
});

test('timeout e erros desconhecidos preservam incerteza sem publicar mensagens do provedor',async()=>{
 const result=await requestFlowExecutor(options,async()=>{throw new DOMException('private-session','TimeoutError');});
 assert.equal(result.error,'flow_executor_timeout');
 assert.match(formatFlowDiagnostic(result.diagnostics,''),/estado final remoto é desconhecido/);
 const unknown=await requestFlowExecutor(options,async()=>Response.json({detail:'private-session'},{status:502}));
 assert.equal(unknown.error,'flow_inspection_unavailable');
 assert.doesNotMatch(JSON.stringify(unknown),/private-session/);
 const legacy=await requestFlowExecutor(options,async()=>Response.json({detail:'image_rights_dialog_unresolved'},{status:502}));
 assert.equal(legacy.error,'image_rights_dialog_unresolved');
});

test('mapeamento separado não pode ser interpretado como nova tentativa de upload',()=>{
 const safe=readFlowDiagnostic(report({action:'inspect-editor',stopReason:'inspection_only'}),traceId,'inspect-editor');
 assert.match(formatFlowDiagnostic(safe,''),/esta ação não executa o envio de imagens/);
 const missing=missingFlowDiagnostic(traceId,'prepare-draft','client_response_unavailable',1234);
 assert.match(formatFlowDiagnostic(missing,''),/Nenhuma etapa remota recebida/);
});

test('falha não fatal de configurações preserva confirmação de upload e motivo específico',async()=>{
 const result=await requestFlowExecutor(options,async()=>Response.json({inspectionReady:true,promptStaged:true,imageAttached:true,imageCount:2,diagnostics:report({stopReason:'flow_settings_blocked',events:[{stage:'images_wait',status:'ok',atMs:17755,metrics:{visible:2,stable:3}},{stage:'settings',status:'error',atMs:19000,metrics:{matches:1,trial:true,clickTimedOut:true}}]})}));
 assert.equal(result.error,undefined);
 assert.equal(result.imageCount,2);
 assert.equal(result.diagnostics.stopReason,'flow_settings_blocked');
 const text=formatFlowDiagnostic(result.diagnostics,'2026-11-15T19:11:38.360Z');
 assert.match(text,/tempo esgotado para acessar configurações=sim/);
 assert.match(text,/preparo anterior foi preservado/);
});

test('relatório mostra o estado atual e a ação que falta, além da cronologia',()=>{
 const safe=readFlowDiagnostic(report({stopReason:'flow_draft_ready',referencesIncluded:true,referencesVerified:true,nextAction:'generate_video',events:[{stage:'inspection',status:'ok',atMs:100,metrics:{includeVisible:0,includeEnabled:0,submitVisible:1,submitEnabled:1,settingsCandidates:1,composerForms:1,composerFields:1,frameErrors:0}}]}),traceId,'prepare-draft');
 const text=formatFlowDiagnostic(safe,'');
 assert.match(text,/ESTADO ATUAL E PRÓXIMO PASSO/);
 assert.match(text,/botões Enviar\/Gerar habilitados: 1/);
 assert.match(text,/Falta executar agora: acionar Enviar\/Gerar vídeo/);
 assert.match(text,/Referências anexadas ao comando: verificadas/);
 assert.equal(safe.generationStarted,false);
 const unsafe=readFlowDiagnostic(report({nextAction:'private-account@example.com'}),traceId,'prepare-draft');
 assert.doesNotMatch(formatFlowDiagnostic(unsafe,''),/private-account/);
});
