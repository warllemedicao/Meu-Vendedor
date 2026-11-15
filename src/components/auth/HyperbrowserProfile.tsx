"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { formatFlowDiagnostic, readFlowDiagnostic, missingFlowDiagnostic } from "@/lib/flow-diagnostics";

type Result = { traceId?:string; diagnostics?:unknown; referencesIncluded?:boolean; referencesVerified?:boolean; configured?:boolean; profileReady?:boolean; loginSaved?:boolean; sessionActive?:boolean; navigationReady?:boolean; liveViewUrl?:string; error?:string; inspectionReady?:boolean; controls?:Array<{role:string;label:string}>; visibleCount?:number; frameCount?:number; inspectedFrames?:number; scanErrors?:number; flowPage?:boolean; projectClicked?:boolean; promptStaged?:boolean; imageAttached?:boolean; imageCount?:number; editorControls?:Array<{role:string;label:string;kind:string;accept?:string}>; editorFrames?:number; editorErrors?:number; settingsInspection?:{opened:boolean;vertical916:boolean;singleOutput:boolean;settingsText:Array<{label:string;selected:string}>;referencesVerified?:boolean;readyToGenerate?:boolean;generationStarted?:boolean} };
const errors:Record<string,string>={unauthorized:"Entre novamente no Meu Vendedor.",confirmed_account_required:"Confirme seu e-mail antes de conectar.",hyperbrowser_key_missing:"A conexão remota ainda não foi configurada.",hyperbrowser_unavailable:"Não foi possível abrir o navegador remoto. Tente novamente mais tarde.",no_active_session:"Abra o navegador antes de salvar o acesso.",live_view_unavailable:"O navegador abriu, mas não forneceu uma janela interativa.",flow_navigation_unavailable:"O Hyperbrowser não confirmou a conexão com o navegador. A sessão foi preservada; tente novamente mais tarde.",flow_inspection_unavailable:"Falha na leitura do navegador remoto. Verifique se o Modal está publicado e a sessão continua ativa.",flow_project_not_active:"Abra um projeto no Google Flow antes de preencher o texto.",prompt_field_not_unique:"O campo do prompt não foi identificado de forma única. Mapeie a interface do editor novamente.",new_project_button_not_found:"O botão Novo projeto não foi encontrado na tela atual.",image_input_not_found:"O Flow não disponibilizou um campo de anexo de imagem. Nenhum vídeo foi gerado.",invalid_image:"Escolha uma imagem PNG, JPG ou WebP de até 2,5 MB."};
const diagnosticModes:Record<string,string>={"create-flow-project":"create-project","inspect-flow-editor":"inspect-editor","stage-flow-prompt":"stage-prompt","prepare-flow-draft":"prepare-draft","prepare-flow-image":"prepare-image","inspect-flow-settings":"inspect-settings"};
Object.assign(errors,{flow_images_not_ready:"As imagens foram enviadas, mas o carregamento não foi confirmado no prazo. Copie o relatório abaixo.",flow_upload_action_not_found:"O botão Fazer upload não foi encontrado. Copie o relatório abaixo.",flow_file_chooser_unavailable:"O seletor de arquivos não confirmou o envio. Copie o relatório abaixo.",image_rights_dialog_unresolved:"Não foi possível confirmar o aviso de direitos. Copie o relatório abaixo.",flow_executor_timeout:"O tempo de resposta do executor esgotou. O resultado remoto é desconhecido; copie o relatório antes de tentar novamente."});
function safeLive(url:string){try{const u=new URL(url);return u.protocol==="https:"&&u.searchParams.has("token")&&((u.hostname==="app.hyperbrowser.ai"&&u.pathname==="/live")||(/^dp-[a-z0-9-]+\.hxproxy\.io$/.test(u.hostname)&&/^\/browser\/[0-9a-f-]{36}\/live\/vnc\.html$/.test(u.pathname)&&u.searchParams.has("path")));}catch{return false;}}
export function HyperbrowserProfile(){
 const [reports,setReports]=useState<string[]>([]);
 const [copyMessage,setCopyMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [draftPrompt,setDraftPrompt]=useState("");
 const [draftImages,setDraftImages]=useState<File[]>([]);
 const [imageRightsConfirmed,setImageRightsConfirmed]=useState(false);
 const [message,setMessage]=useState("");
 const [view,setView]=useState("");
 const [saved,setSaved]=useState(false);
 const [controls,setControls]=useState<Array<{role:string;label:string}>>([]);
 const [inspection,setInspection]=useState<Result|null>(null);
 async function act(action:"status"|"start-login"|"save-login"|"create-flow-project"|"inspect-flow-editor"|"stage-flow-prompt"|"prepare-flow-draft"|"prepare-flow-image"|"inspect-flow-settings"){
  if(busy)return;
  setBusy(true);setMessage("");setInspection(null);setControls([]);setCopyMessage("");
  const startedAt=new Date().toISOString(), started=Date.now(), localTraceId=crypto.randomUUID();
  let reportRecorded=false, requestSent=false;
  function recordReport(payload:Result|null,reason:string){
   const mode=diagnosticModes[action];
   if(!mode)return;
   const traceId=typeof payload?.traceId==="string"&&/^[0-9a-f-]{36}$/.test(payload.traceId)?payload.traceId:localTraceId;
   const diagnostic=readFlowDiagnostic(payload?.diagnostics,traceId,mode)??missingFlowDiagnostic(traceId,mode,reason,Date.now()-started);
   const text=formatFlowDiagnostic(diagnostic,startedAt);
   setReports(previous=>[text,...previous].slice(0,5));
   reportRecorded=true;
  }
  try{
   const client=getSupabase();
   if(!client)throw new Error("O serviço de autenticação está indisponível.");
   const {data:auth}=await client.auth.getSession();
   if(!auth.session)throw new Error("Entre no Meu Vendedor para continuar.");
   let imagePayload:{images?:Array<{mime:string;data:string}>}={};
   if(action==="prepare-flow-draft"&&draftImages.length){
    if(!imageRightsConfirmed)throw new Error("Confirme que você possui os direitos de uso das imagens antes de enviá-las.");
    if(draftImages.length>3||draftImages.reduce((sum,file)=>sum+file.size,0)>2500000||draftImages.some(file=>!["image/png","image/jpeg","image/webp"].includes(file.type)))throw new Error("Selecione até 3 imagens PNG, JPG ou WebP, com tamanho total de até 2,5 MB.");
    imagePayload={images:await Promise.all(draftImages.map(async file=>{
     const bytes=new Uint8Array(await file.arrayBuffer());
     let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
     return {mime:file.type,data:btoa(binary)};
    }))};
   }
   requestSent=true;
   const {data,error}=await client.functions.invoke<Result>("hyperbrowser-profile",{body:{action,...(["prepare-flow-draft","prepare-flow-image"].includes(action)?{prompt:draftPrompt}:{}),...imagePayload,...(action==="prepare-flow-draft"&&draftImages.length?{imageRightsConfirmed}:{})}});
   // Supabase HTTP failures keep the response body in error.context, not data.
   let payload=data;
   if(error?.context instanceof Response) payload=await error.context.clone().json().catch(()=>null);
   recordReport(payload,payload?.error??(error?"client_response_unavailable":"executor_report_unavailable"));
   if(error||!payload||payload.error)throw new Error(errors[payload?.error??""]??"A conexão não respondeu. Copie o relatório desta tentativa abaixo.");
   const response=payload;
   if(action==="create-flow-project"||action==="inspect-flow-editor"||action==="stage-flow-prompt"||action==="prepare-flow-draft"||action==="prepare-flow-image"||action==="inspect-flow-settings"){
    setControls(Array.from(new Map((response.controls??[]).map(item=>[`${item.role}:${item.label}`,item])).values()));
    setInspection(response);
    setMessage(action==="inspect-flow-settings"?(response.settingsInspection?.opened?"Painel de configurações aberto. Confira os parâmetros detectados abaixo; nenhuma geração iniciada.":"Não foi possível identificar o botão de configurações. Nenhuma geração iniciada."):action==="prepare-flow-draft"?(response.promptStaged?(draftImages.length?(response.imageAttached?`Texto preenchido e ${response.imageCount??draftImages.length} imagem(ns) enviada(s) ao Flow. Configurações inspecionadas quando disponíveis; ${response.referencesVerified?"Referências confirmadas no comando.":response.referencesIncluded?"Inclusão acionada; referências ainda não verificadas.":"Inclusão das imagens ainda pendente; consulte o próximo passo no relatório."} Nenhuma geração iniciada.`:"Texto preenchido, mas o anexo das imagens não foi confirmado."):"Projeto pronto e texto preenchido no Flow. Configurações inspecionadas quando disponíveis; nenhuma geração iniciada."):"Não foi possível confirmar o preenchimento do texto."):action==="inspect-flow-editor"?(response.editorControls?.length?"Interface mapeada: controles e campos de edição encontrados.":"Interface mapeada. Se os campos do editor não aparecerem, abra um projeto no Flow e tente novamente."):action==="create-flow-project"?(response.projectClicked?"Novo projeto aberto. Controles do editor identificados abaixo; nenhum vídeo foi gerado.":"Não foi possível confirmar a abertura do novo projeto."):(response.inspectionReady?(response.controls?.length?"Controles relevantes identificados sem iniciar geração.":"Inspeção concluída, mas nenhum controle relevante foi encontrado. Veja o diagnóstico abaixo."):"Não foi possível inspecionar a interface."));
    return;
   }
   setSaved(Boolean(response.loginSaved));
   if(response.liveViewUrl){
    if(!safeLive(response.liveViewUrl))throw new Error("Endereço do navegador remoto inválido.");
    setView(response.liveViewUrl);
    setMessage(response.navigationReady?"Google Flow aberto automaticamente no navegador remoto.":"Navegador remoto aberto. Se o Flow não aparecer, acesse https://flow.google.com manualmente.");
   }else if(action==="save-login"){setView("");setMessage("Sessão encerrada e perfil salvo. A permanência do login será confirmada ao reabrir.");}
   else if(action==="status"){setMessage(response.profileReady?"Perfil preparado. Clique em Abrir Google Flow para acessar.":"Perfil ainda não criado. Clique em Abrir Google Flow para preparar e acessar.");}
  }catch(e){if(!reportRecorded)recordReport(null,requestSent?"client_response_unavailable":"client_request_not_sent");setMessage(e instanceof Error?e.message:"Falha ao abrir Google Flow.");}
  finally{setBusy(false);}
 }
 async function copyReports(){
  try{
   if(!navigator.clipboard)throw new Error("clipboard_unavailable");
   await navigator.clipboard.writeText(reports.join("\n\n---\n\n"));
   setCopyMessage("Relatórios copiados.");
  }catch{setCopyMessage("Selecione e copie o texto abaixo manualmente.");}
 }
 return <article className="rounded-xl border border-border bg-surface p-4 space-y-3 sm:col-span-2">
  <h3 className="font-semibold">Google Flow · Acesso remoto</h3>
  <p className="text-sm text-muted">O navegador remoto tentará abrir https://flow.google.com automaticamente. Entre na sua conta Google somente se necessário. O acesso é realizado diretamente no navegador; não informe sua senha ao Meu Vendedor.</p>
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={busy} onClick={()=>void act("start-login")} className="rounded-lg bg-primary px-3 py-2 text-sm text-background disabled:opacity-50">{busy?"Aguarde…":"Abrir Google Flow para login"}</button>
   <button type="button" disabled={busy||!view} onClick={()=>void act("save-login")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Salvar acesso e fechar</button>
   <button type="button" disabled={busy||!view} onClick={()=>void act("inspect-flow-editor")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Mapear interface do Google Flow (sem gerar)</button>
   <button type="button" disabled={busy} onClick={()=>void act("status")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Verificar conexão</button>
  </div>
  <div className="space-y-2"><label htmlFor="flow-test-prompt" className="block text-sm font-medium">Texto de teste para o Flow (sem gerar)</label><textarea id="flow-test-prompt" value={draftPrompt} onChange={e=>setDraftPrompt(e.target.value)} maxLength={4000} rows={3} placeholder="Cole aqui o prompt do produto para preencher no editor" className="w-full rounded-lg border border-border bg-background p-2 text-sm" /><label htmlFor="flow-test-image" className="block text-sm font-medium">Adicionar imagens (opcional; até 3 imagens, total de 2,5 MB)</label><input id="flow-test-image" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e=>{setDraftImages(Array.from(e.target.files??[]));setImageRightsConfirmed(false);}} className="block w-full text-sm" />{draftImages.length>0&&<><p className="text-xs text-muted">{draftImages.length} imagem(ns) selecionada(s).</p><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={imageRightsConfirmed} onChange={e=>setImageRightsConfirmed(e.target.checked)} />Confirmo que tenho direitos ou autorização para usar estas imagens e autorizo a confirmação do aviso de direitos no Google Flow.</label></>}<button type="button" disabled={busy||!view||!draftPrompt.trim()||(draftImages.length>0&&!imageRightsConfirmed)} onClick={()=>void act("prepare-flow-draft")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Preparar projeto e preencher texto (sem gerar)</button><p className="text-xs text-muted">A mesma ação prepara o projeto, preenche o texto e tenta anexar as imagens selecionadas, sem iniciar geração. Confira a prévia no Flow.</p></div>
  {inspection?.settingsInspection&&<div className="rounded-lg border border-border p-3 text-xs space-y-1"><p>Verificação automática das configurações: {inspection.settingsInspection.opened?"painel localizado":"painel não localizado"}</p><p>Formato 9:16: {inspection.settingsInspection.vertical916?"confirmado":"não confirmado"}</p><p>Quantidade x1: {inspection.settingsInspection.singleOutput?"confirmada":"não confirmada"}</p><p>Referências das imagens: {inspection.settingsInspection.referencesVerified?"confirmadas":"ainda não confirmadas no comando"}</p><p>Geração: não iniciada</p></div>}
  {saved&&<p className="text-xs text-muted">Perfil salvo anteriormente. O Google ainda pode solicitar autenticação novamente.</p>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  {reports.length>0&&<section className="space-y-2 rounded-lg border border-border p-3" aria-label="Relatórios das tentativas do Flow">
   <p className="text-sm font-semibold">Relatório para suporte · últimas {reports.length} tentativa(s)</p>
   <p className="text-xs text-muted">Copie e envie este texto no atendimento. O preparo anterior permanece no relatório após mapear a interface. Os relatórios ficam nesta página até recarregar.</p>
   <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={()=>void copyReports()}>Copiar relatórios do Flow</button>
   {copyMessage&&<p role="status" className="text-xs">{copyMessage}</p>}
   <textarea aria-label="Texto dos relatórios do Flow" readOnly value={reports.join("\n\n---\n\n")} rows={14} className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs" />
  </section>}
  {inspection&&<p className="text-xs text-muted">Diagnóstico: página Flow {inspection.flowPage?"sim":"não"}; frames {inspection.inspectedFrames??0}/{inspection.frameCount??0}; controles visíveis {inspection.visibleCount??0}; falhas de leitura {inspection.scanErrors??0}; rótulos relevantes {controls.length}.</p>}
  {inspection?.editorControls&&<div className="rounded-lg border border-border p-3"><p className="text-sm font-semibold">Campos do editor ({inspection.editorControls.length}) · frames {inspection.editorFrames??0}, falhas {inspection.editorErrors??0}</p><ul className="mt-2 list-disc pl-5 text-xs">{inspection.editorControls.map((item,i)=><li key={i}>{item.kind} · {item.role}{item.label?` · ${item.label}`:""}{item.accept?` · aceita: ${item.accept}`:""}</li>)}</ul></div>}
  {controls.length>0&&<div className="rounded-lg border border-border p-3"><p className="text-sm font-semibold">Controles encontrados ({controls.length})</p><ul className="mt-2 list-disc pl-5 text-xs">{controls.map((item,i)=><li key={i}>{item.label}</li>)}</ul></div>}
  {view&&<div className="space-y-2">
   <iframe title="Navegador privado para login Google Flow" src={view} referrerPolicy="no-referrer" className="h-[520px] w-full rounded-lg border border-border bg-background" />
   <a href={view} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-sm text-primary underline">Abrir navegador em tela cheia</a>
  </div>}
  <p className="text-xs text-muted">Após concluir o login, clique em Salvar acesso e fechar para gravar o perfil. A janela remota pode consumir créditos do provedor. A geração automática de vídeos ainda não está habilitada.</p>
 </article>;
}
