// Fixed-input, expiring continuation job. Capabilities are injected outside Git.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const gateHash='__GATE_HASH__';
const expires='2026-11-09T23:59:00Z';
const id='ana-six-20261109-r3';
const slug='mv-ana-six-20261109-r3';
const source=__SOURCE__;
const supervisor=__SUPERVISOR__;
const prefix='operator/ana-vidi-20261108/';
const inputs={reference:{path:prefix+'motion/1d1ca4cd-685c-415a-82eb-419dacb3705f.png',hash:'5df249ae228a9c7b6658fd4fd80a281c66a037ce87980f7b69682f5202ba4182'},product:{path:prefix+'inputs/product-vidi.jpg',hash:'f8369d01d66b48319d3e4878e0bdd410d46923f96acbe410b1c8074423ce1c6b'},driver:{path:prefix+'inputs/ana-driver.mp4',hash:'268918740bf2de47870c52ae4767551e8ac673fa371fc1557bab891d3371c65e'},seed_video:{path:'operator/ana-midi-20261109/hunyuan-r2.mp4',hash:'e10729e4c41528e2109db1a0dc10da0b7fd6a411250f7ad47c0d78995dcf3a81'}};
const videoPath='operator/ana-six-20261109/final-six-seconds-r3.mp4';
const archivePath='operator/ana-six-20261109/diagnostics-r3.zip';
const json=(b:unknown,s=200)=>Response.json(b,{status:s});
async function hash(v:string|ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof v==='string'?new TextEncoder().encode(v):v)),b=>b.toString(16).padStart(2,'0')).join('');}
async function kg(method:string,body:unknown){const r=await fetch('https://api.kaggle.com/v1/'+method,{method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('KAGGLE_API_TOKEN'),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(method.endsWith('SaveKernel')?60000:30000)});if(!r.ok){await r.body?.cancel();throw Error('kaggle_http_'+r.status);}return r.json();}
async function current(){const {data,error}=await admin.from('mv_ai_provider_audits').select('report').eq('provider_id',id).maybeSingle();if(error)throw error;return data?.report;}
async function save(report:unknown){const {error}=await admin.from('mv_ai_provider_audits').update({report,checked_at:new Date().toISOString()}).eq('provider_id',id);if(error)throw error;}
Deno.serve(async req=>{
 if(Date.now()>Date.parse(expires)||gateHash.startsWith('__'))return json({error:'closed'},410);
 if(req.method!=='POST')return json({error:'unauthorized'},401);
 try{
 const raw=await req.text();if(raw.length>18000)return json({error:'too_large'},413);const b=JSON.parse(raw);
 if(b.action==='callback'){
  const p=await current();if(!p||b.id!==id||await hash(req.headers.get('x-job-token')??'')!==p.callback_hash)return json({error:'unauthorized'},401);
  if(p.terminal)return json({cancel:true});
  const f=JSON.parse(JSON.stringify(b.report??{}).replace(/https?:\/\/[^\s"<>]+/g,'[url]'));
  const terminal=['finished','finished_without_archive'].includes(f.phase);if(p.cancel&&!terminal)return json({cancel:true});
  await save({...p,...f,state:terminal?f.state:'running',terminal,phase:f.phase==='supervising'?p.phase:(f.phase??p.phase),heartbeat:new Date().toISOString()});return json({cancel:false});
 }
 if(await hash(req.headers.get('x-control')??'')!==gateHash)return json({error:'unauthorized'},401);
 if(b.action==='status'){const p=await current();if(!p)return json({state:'not_started'});const {callback_hash,...safe}=p;return json(safe);}
 if(b.action==='cancel'){const p=await current();if(p)await save({...p,cancel:true});return json({cancel_requested:true});}
 if(b.action==='download'){
  const p=await current();if(!p?.terminal&&!p?.cancel)return json({error:'not_finished'},409);
  const out:Record<string,string>={};for(const [kind,bucket,path]of [['video','mv-video-assets',videoPath],['archive','mv-video-research',archivePath]]){const {data}=await admin.storage.from(bucket).createSignedUrl(path,600);if(data)out[kind]=data.signedUrl;}return json(out);
 }
 const who=await kg('security.OAuthService/IntrospectToken',{token:Deno.env.get('KAGGLE_API_TOKEN')});if(!who.active||!/^[-\w]{1,100}$/.test(who.username))throw Error('identity_invalid');
 if(b.action==='probe'){
  const states=[];for(const s of ['mv-ana-midi-20261109-hunyuan-r2','mv-ana-midi-20261109-wan-r2',slug]){try{states.push({slug:s,...await kg('kernels.KernelsApiService/GetKernelSessionStatus',{userName:who.username,kernelSlug:s})});}catch(e){states.push({slug:s,error:String(e)});}}
  const q=await kg('kernels.KernelsApiService/GetAcceleratorQuotaStatistics',{});return json({states,quota:q.gpuQuota});
 }
 if(b.action==='cancel-previous'){let cancellation;try{cancellation=await kg('kernels.KernelsApiService/DeleteKernel',{userName:who.username,kernelSlug:'mv-ana-six-20261109-r2'});}catch(e){cancellation={error:String(e)};}let state;try{state=await kg('kernels.KernelsApiService/GetKernelSessionStatus',{userName:who.username,kernelSlug:'mv-ana-six-20261109-r2'});}catch(e){state={error:String(e)};}return json({cancellation,status:state});}
 if(b.action==='preserve'){const out:Record<string,string>={};for(const [kind,path]of [['raw','operator/ana-six-20261109/resume/continuation-2-raw-49frames.mp4'],['resume','operator/ana-six-20261109/resume/resume-four-seconds.mp4']]){const {data,error}=await admin.storage.from('mv-video-assets').createSignedUploadUrl(path,{upsert:false});if(error)throw error;out[kind]=data.signedUrl;}return json(out);}
 if(b.action==='stop-finished'){const p=await current();if(!p?.terminal)return json({error:'not_terminal'},409);let cancellation;try{cancellation=await kg('kernels.KernelsApiService/DeleteKernel',{userName:who.username,kernelSlug:slug});}catch(e){cancellation={error:String(e)};}let status;try{status=await kg('kernels.KernelsApiService/GetKernelSessionStatus',{userName:who.username,kernelSlug:slug});}catch(e){status={error:String(e)};}return json({cancellation,status});}
 if(b.action==='preview'){const r=await kg('kernels.KernelsApiService/ListKernelSessionOutput',{userName:who.username,kernelSlug:slug});const f=r.files?.find((f:{fileName:string})=>f.fileName==='continuation_2-raw.mp4')??r.files?.find((f:{fileName:string})=>f.fileName==='continuation_2.mp4');if(!f)return json({error:'preview_not_ready'},409);return json({video:f.url});}
 if(b.action==='outputs'){const r=await kg('kernels.KernelsApiService/ListKernelSessionOutput',{userName:who.username,kernelSlug:slug});const state=await kg('kernels.KernelsApiService/GetKernelSessionStatus',{userName:who.username,kernelSlug:slug});const saved=await kg('kernels.KernelsApiService/GetKernel',{userName:who.username,kernelSlug:slug});const versionState=await kg('kernels.KernelsApiService/GetKernelSessionStatus',{userName:who.username,kernelSlug:slug,versionLabel:'v1'});return json({status:state,version_status:versionState,metadata:saved.metadata,source_length:saved.blob?.source?.length,files:r.files?.map((f:{fileName:string})=>f.fileName),log:String(r.log??'').replace(/https?:\/\/\S+/g,'[url]').slice(-8000)});}
 if(b.action!=='submit')return json({error:'invalid_action'},400);
 const p=await current();if(p)return json({already_claimed:true,state:p.state});
 for(const table of ['mv_motion_jobs','mv_hybrid_jobs']){const {count,error}=await admin.from(table).select('id',{count:'exact',head:true}).in('status',['submitting','running','uncertain']).gt('expires_at',new Date().toISOString());if(error)throw error;if(count)return json({error:'gpu_busy'},409);}
 const q=(await kg('kernels.KernelsApiService/GetAcceleratorQuotaStatistics',{})).gpuQuota;
 const sec=(v:string)=>/^\d+(\.\d+)?s$/.test(v)?Number(v.slice(0,-1)):NaN;
 if(!Number.isFinite(sec(q.timeUsed))||sec(q.totalTimeAllowed)-sec(q.timeUsed)-sec(q.timeReserved)<4200)return json({error:'quota_unavailable'},409);
 const cfg:Record<string,unknown>={id,engine:'hunyuan',budget_seconds:3900};
 for(const [kind,input]of Object.entries(inputs)){
  const {data,error}=await admin.storage.from('mv-video-assets').createSignedUrl(input.path,7200);if(error)throw error;
  const r=await fetch(data.signedUrl);if(!r.ok)throw Error('input_missing');const bytes=await r.arrayBuffer();if(bytes.byteLength>40000000||await hash(bytes)!==input.hash)throw Error('input_hash_mismatch');
  cfg[kind]=data.signedUrl;cfg[kind+'_sha256']=input.hash;
 }
 cfg.seed_sha256=inputs.seed_video.hash;
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
 const initial={state:'claimed',terminal:false,slug,started:new Date().toISOString(),callback_hash:await hash(token),inputs,quota_before:q};
 const {error}=await admin.from('mv_ai_provider_audits').insert({provider_id:id,status:'checked',report:initial});if(error)return json({error:'already_claimed'},409);
 const v=await admin.storage.from('mv-video-assets').createSignedUploadUrl(videoPath,{upsert:false});const a=await admin.storage.from('mv-video-research').createSignedUploadUrl(archivePath,{upsert:false});
 if(v.error||a.error){await save({...initial,state:'failed',terminal:true,error:'upload_preparation_failed'});return json({error:'upload_preparation_failed'},500);}
 Object.assign(cfg,{gate:token,callback:Deno.env.get('SUPABASE_URL')+'/functions/v1/ana-six-test',video_upload:v.data.signedUrl,archive_upload:a.data.signedUrl});
 const text='import json\nTEST_CONFIG=json.loads('+JSON.stringify(JSON.stringify(cfg))+')\nTEST_SOURCE='+JSON.stringify(source)+'\n'+supervisor;
 await save({...initial,state:'submitting'});
 try{const result=await kg('kernels.KernelsApiService/SaveKernel',{slug:who.username+'/'+slug,newTitle:slug,text,language:'python',kernelType:'script',kernelExecutionType:'SAVE_AND_RUN_ALL',isPrivate:true,enableGpu:true,enableInternet:true,machineShape:'NvidiaTeslaP100',sessionTimeoutSeconds:4200});if(result.error||(!result.ref&&!result.kernelId))throw Error('submission_uncertain');const latest=await current();await save({...latest,state:latest?.state==='submitting'?'submitted':latest?.state,remote_ref:result.ref,kernel_id:result.kernelId});return json({state:'submitted',remote_ref:result.ref,kernel_id:result.kernelId},202);}
 catch(e){await save({...initial,state:'uncertain',error:String(e)});return json({state:'uncertain',error:String(e)},503);}
 }catch(e){return json({error:String(e).replace(/https?:\/\/\S+/g,'[url]').slice(0,250)},500);}
});
