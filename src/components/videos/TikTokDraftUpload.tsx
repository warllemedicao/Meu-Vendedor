"use client";
import {useState} from "react";
import {getSupabase} from "@/lib/supabase/client";
type Video={blob:Blob;filename:string};
const MAX=64*1024*1024;
async function invoke(action:string,extra:Record<string,unknown>={}){
 const client=getSupabase();if(!client)throw Error("Supabase indisponível.");
 const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Entre na sua conta e conecte o TikTok em Conta e conexões.");
 const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tiktok-connect`,{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"","Content-Type":"application/json"},body:JSON.stringify({action,...extra})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.code==="not_connected"?"Conecte o TikTok em Conta e conexões.":result.code==="scope_not_granted"?"Reconecte o TikTok para autorizar o envio de vídeos.":`TikTok recusou a operação (${result.detail??result.code??response.status}).`);
 return result;
}
export function TikTokDraftUpload({video}:{video:Video|null}){
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function upload(){
  if(!video||busy)return;
  setError("");setMessage("");setProgress(0);
  if(!video.filename.toLowerCase().endsWith(".mp4")||video.blob.type && video.blob.type!=="video/mp4"){setError("O TikTok exige um vídeo MP4 válido. Arquivos WebM precisam ser convertidos.");return;}
  if(!video.blob.size||video.blob.size>MAX){setError("O envio aceita MP4 de até 64 MB nesta versão.");return;}
  if(!window.confirm("Enviar este vídeo ao TikTok como rascunho? Você finalizará a publicação no aplicativo TikTok."))return;
  setBusy(true);
  try{
   const init=await invoke("upload_init",{size:video.blob.size,mime_type:"video/mp4"});
   const url=new URL(init.upload_url);
   if(url.protocol!=="https:"||!url.hostname.endsWith(".tiktokapis.com")&&!url.hostname.endsWith(".tiktok.com")&&!url.hostname.endsWith(".byteoversea.com")&&!url.hostname.endsWith(".bytecdn.cn"))throw Error("O TikTok retornou um endereço de upload não reconhecido.");
   const size=init.chunk_size as number,total=init.total_chunk_count as number;
   if(!Number.isSafeInteger(size)||size<=0||!Number.isSafeInteger(total)||total<1||total!==Math.ceil(video.blob.size/size))throw Error("Parâmetros de upload inválidos.");
   for(let i=0;i<total;i++){
    const start=i*size,end=Math.min(video.blob.size,start+size);
    const response=await fetch(url.href,{method:"PUT",headers:{"Content-Type":"video/mp4","Content-Length":String(end-start),"Content-Range":`bytes ${start}-${end-1}/${video.blob.size}`},body:video.blob.slice(start,end,"video/mp4")});
    if(!response.ok)throw Error(`Falha ao transferir o bloco ${i+1} de ${total} (HTTP ${response.status}).`);
    setProgress(Math.round((i+1)/total*100));
   }
   setMessage("Vídeo enviado! Abra o TikTok para localizar o rascunho e concluir a publicação. ID: "+init.publish_id);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível enviar o vídeo. Verifique a conexão e tente novamente.");}
  finally{setBusy(false);}
 }
 return <div className="rounded-xl border border-border p-3 space-y-2"><p className="text-sm font-semibold">Enviar ao TikTok como rascunho</p><p className="text-xs text-muted">Requer conta conectada e permissão video.upload. O TikTok solicitará que você conclua a publicação no aplicativo.</p><button type="button" disabled={!video||busy} onClick={()=>void upload()} className="rounded-xl border border-border px-3 py-2 text-sm font-medium disabled:opacity-50">{busy?`Enviando… ${progress}%`:"Enviar vídeo ao TikTok"}</button>{busy&&<progress value={progress} max={100} aria-label="Progresso do upload" className="block w-full"/>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{message&&<p role="status" className="text-sm text-primary">{message}</p>}</div>;
}
