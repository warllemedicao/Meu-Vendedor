"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
type Asset={id:string;presenter_id:string;name:string;scene:string;kind:string};
type Job={id:string;status:string;url?:string;error?:string;report?:{phase?:string;total_seconds?:number}};
const voices:Record<string,string>={ana:"Aoede",carla:"Kore",rafael:"Charon",lucas:"Puck"};
async function invoke(name:string,body:Record<string,unknown>) {
 const client=getSupabase();if(!client)throw new Error("Entre na sua conta.");
 const {data,error}=await client.functions.invoke(name,{body});
 if(error||data?.error)throw new Error(data?.error==="hybrid_busy"?"O Kaggle está ocupado. Aguarde a tarefa atual.":"Não foi possível concluir esta etapa. Consulte o estado antes de tentar novamente.");
 return data;
}
export function HybridVideo({presenterId,script}:{presenterId:string;script:string}) {
 const [assets,setAssets]=useState<Asset[]>([]),[asset,setAsset]=useState("");
 const [job,setJob]=useState<Job|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;void invoke("hybrid-video",{action:"capabilities"}).then(r=>{if(active)setAssets(r.assets??[]);}).catch(()=>{if(active)setError("Não foi possível consultar as bases aprovadas.");});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(!job||!["submitting","running","uncertain"].includes(job.status))return;
  let active=true;
  const timer=setInterval(()=>{void invoke("hybrid-video",{action:"result",id:job.id}).then(r=>{if(active){setJob(r);setError("");}}).catch(()=>{if(active)setError("Consulta interrompida; a tarefa continua no servidor.");});},15000);
  return()=>{active=false;clearInterval(timer);};
 },[job]);
 const choices=assets.filter(a=>a.presenter_id===presenterId);
 const selected=choices.find(a=>a.id===asset)??choices[0];
 async function generate(){
  if(!selected)return;setBusy(true);setError("");
  try{
   const audio=await invoke("audio-generation",{action:"generate",text:script,voiceId:`pt-BR-Chirp3-HD-${voices[presenterId]}`,purpose:"commercial"});
   const next=await invoke("hybrid-video",{action:"generate",assetId:selected.id,audioId:audio.id});setJob(next);
   localStorage.setItem("mv-hybrid-job",next.id);
  }catch(e){setError(e instanceof Error?e.message:"Falha no processamento.");}finally{setBusy(false);}
 }
 useEffect(()=>{const id=localStorage.getItem("mv-hybrid-job");if(id)void invoke("hybrid-video",{action:"result",id}).then(setJob).catch(()=>{});},[]);
 const active=Boolean(job&&["submitting","running","uncertain"].includes(job.status));
 return <div className="mt-4 rounded-xl border border-border p-4 text-sm">
  <p className="font-semibold">Vídeo com voz fixa · piloto Kaggle</p>
  <p className="mt-2 text-xs text-muted">Reutiliza uma base aprovada do personagem e aplica a fala Google com sincronização labial. Mantém roupa, cenário e gestos da base. Roteiro de até 15 segundos. Qualidade e velocidade nas T4 em validação.</p>
  {choices.length===0?<p className="mt-2 text-xs text-muted">Ainda não há bases aprovadas para este personagem. O piloto técnico precisa ser validado antes da liberação.</p>:<>
   <select aria-label="Base do personagem" className="mt-2 w-full rounded-lg border border-border bg-background p-2" value={selected?.id??""} onChange={e=>setAsset(e.target.value)}>{choices.map(a=><option key={a.id} value={a.id}>{a.name} · {a.scene}</option>)}</select>
   <button type="button" disabled={busy||active||script.trim().length<2||script.length>180} onClick={()=>void generate()} className="mt-2 text-primary underline disabled:opacity-50">{busy?"Preparando voz e tarefa…":active?"Processando no Kaggle…":"Gerar voz e sincronizar personagem"}</button>
  </>}
  {job&&<p className="mt-2 text-xs text-muted">Estado: {job.status}{job.report?.phase?` · ${job.report.phase}`:""}{job.report?.total_seconds?` · ${Math.round(job.report.total_seconds)} s`:""}</p>}
  {job?.url&&<><video controls playsInline src={job.url} className="mt-2 max-h-96 w-full"/><a className="mt-2 inline-block text-primary underline" href={job.url} target="_blank" rel="noreferrer">Abrir MP4 final</a></>}
  {error&&<p role="status" className="mt-2 text-xs text-muted">{error}</p>}
 </div>;
}
