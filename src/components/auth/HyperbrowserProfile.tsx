"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type Result = { configured?:boolean; profileReady?:boolean; loginSaved?:boolean; sessionActive?:boolean; navigationReady?:boolean; liveViewUrl?:string; error?:string };
const errors:Record<string,string>={unauthorized:"Entre novamente no Meu Vendedor.",confirmed_account_required:"Confirme seu e-mail antes de conectar.",hyperbrowser_key_missing:"A conexão remota ainda não foi configurada.",hyperbrowser_unavailable:"Não foi possível abrir o navegador remoto. Tente novamente mais tarde.",no_active_session:"Abra o navegador antes de salvar o acesso.",live_view_unavailable:"O navegador abriu, mas não forneceu uma janela interativa."};
function safeLive(url:string){try{const u=new URL(url);return u.protocol==="https:"&&u.searchParams.has("token")&&((u.hostname==="app.hyperbrowser.ai"&&u.pathname==="/live")||(/^dp-[a-z0-9-]+\.hxproxy\.io$/.test(u.hostname)&&/^\/browser\/[0-9a-f-]{36}\/live\/vnc\.html$/.test(u.pathname)&&u.searchParams.has("path")));}catch{return false;}}
export function HyperbrowserProfile(){
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [view,setView]=useState("");
 const [saved,setSaved]=useState(false);
 async function act(action:"status"|"start-login"|"save-login"){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const client=getSupabase();
   if(!client)throw new Error("O serviço de autenticação está indisponível.");
   const {data:auth}=await client.auth.getSession();
   if(!auth.session)throw new Error("Entre no Meu Vendedor para continuar.");
   const {data,error}=await client.functions.invoke<Result>("hyperbrowser-profile",{body:{action}});
   if(error||!data||data.error)throw new Error(errors[data?.error??""]??"A conexão não respondeu. Consulte os registros do Supabase.");
   setSaved(Boolean(data.loginSaved));
   if(data.liveViewUrl){
    if(!safeLive(data.liveViewUrl))throw new Error("Endereço do navegador remoto inválido.");
    setView(data.liveViewUrl);
    setMessage(data.navigationReady?"Google Flow aberto automaticamente no navegador remoto.":"Navegador remoto aberto. Se o Flow não aparecer, acesse https://flow.google.com manualmente.");
   }else if(action==="save-login"){setView("");setMessage("Sessão encerrada e perfil salvo. A permanência do login será confirmada ao reabrir.");}
   else if(action==="status"){setMessage(data.profileReady?"Perfil preparado. Clique em Abrir Google Flow para acessar.":"Perfil ainda não criado. Clique em Abrir Google Flow para preparar e acessar.");}
  }catch(e){setMessage(e instanceof Error?e.message:"Falha ao abrir Google Flow.");}
  finally{setBusy(false);}
 }
 return <article className="rounded-xl border border-border bg-surface p-4 space-y-3 sm:col-span-2">
  <h3 className="font-semibold">Google Flow · Acesso remoto</h3>
  <p className="text-sm text-muted">O navegador remoto tentará abrir https://flow.google.com automaticamente. Entre na sua conta Google somente se necessário. O acesso é realizado diretamente no navegador; não informe sua senha ao Meu Vendedor.</p>
  <div className="flex flex-wrap gap-2">
   <button type="button" disabled={busy} onClick={()=>void act("start-login")} className="rounded-lg bg-primary px-3 py-2 text-sm text-background disabled:opacity-50">{busy?"Aguarde…":"Abrir Google Flow para login"}</button>
   <button type="button" disabled={busy||!view} onClick={()=>void act("save-login")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Salvar acesso e fechar</button>
   <button type="button" disabled={busy} onClick={()=>void act("status")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Verificar conexão</button>
  </div>
  {saved&&<p className="text-xs text-muted">Perfil salvo anteriormente. O Google ainda pode solicitar autenticação novamente.</p>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  {view&&<div className="space-y-2">
   <iframe title="Navegador privado para login Google Flow" src={view} referrerPolicy="no-referrer" className="h-[520px] w-full rounded-lg border border-border bg-background" />
   <a href={view} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-sm text-primary underline">Abrir navegador em tela cheia</a>
  </div>}
  <p className="text-xs text-muted">Após concluir o login, clique em Salvar acesso e fechar para gravar o perfil. A janela remota pode consumir créditos do provedor. A geração automática de vídeos ainda não está habilitada.</p>
 </article>;
}
