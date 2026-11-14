"use client";
import {useCallback,useEffect,useState} from "react";
import {Music2} from "lucide-react";
import {getSupabase} from "@/lib/supabase/client";
import {useAuth} from "./AuthProvider";
type Status={connected:boolean;account?:{display_name?:string|null;scopes?:string}|null};
async function call(action:string){
 const client=getSupabase();if(!client)throw Error("Supabase não configurado.");
 const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Entre na sua conta primeiro.");
 const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tiktok-connect`,{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"","Content-Type":"application/json"},body:JSON.stringify({action})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.code==="oauth_not_configured"?"TikTok ainda não configurado no servidor.":"Falha na integração TikTok ("+(result.code??response.status)+").");
 return result;
}
export function TikTokConnection(){
 const {user}=useAuth();const [status,setStatus]=useState<Status|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const refresh=useCallback(async()=>{if(!user){setStatus(null);return;}try{setStatus(await call("status"));}catch(e){setMessage(e instanceof Error?e.message:"Falha na consulta.");}},[user]);
 useEffect(()=>{const url=new URL(window.location.href);const result=url.searchParams.get("tiktok");if(result){queueMicrotask(()=>setMessage(result==="connected"?"TikTok conectado.":result==="cancelled"?"Autorização cancelada.":"Falha ao autorizar TikTok: "+result));url.searchParams.delete("tiktok");window.history.replaceState({}, "",url.pathname+url.search+url.hash);}void refresh();},[refresh]);
 async function act(action:"start"|"disconnect"){setBusy(true);setMessage("");try{const result=await call(action);if(action==="start"){const url=new URL(result.authorization_url);if(url.protocol!=="https:"||url.hostname!=="www.tiktok.com"||url.pathname!=="/v2/auth/authorize/")throw Error("Destino OAuth inválido.");window.location.assign(url.href);return;}await refresh();setMessage("TikTok desconectado.");}catch(e){setMessage(e instanceof Error?e.message:"Falha na conexão.");}finally{setBusy(false);}}
 return <article className="rounded-xl border border-border bg-surface p-4"><div className="flex items-center gap-3"><Music2 className="h-6 w-6"/><div className="min-w-0 flex-1"><h3 className="font-semibold">TikTok</h3><p className="text-xs text-muted">{status?.connected?status.account?.display_name??"Conta conectada":"Não conectado"}</p></div><button type="button" disabled={!user||busy} onClick={()=>void act(status?.connected?"disconnect":"start")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">{busy?"Aguarde…":status?.connected?"Desconectar":"Conectar"}</button></div>{!user&&<p className="mt-2 text-xs text-muted">Entre na sua conta antes de conectar.</p>}{message&&<p role="status" className="mt-2 text-xs text-muted">{message}</p>}<p className="mt-2 text-xs text-muted">Publicação via API requer permissões e aprovação do TikTok.</p></article>;
}
