"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMarketplace } from "./MarketplaceProvider";
import { marketplaceAction, displayDate } from "@/lib/marketplace";
import { Badge } from "@/components/ui/Badge";
export function ConnectionControls({platform}:{platform:string}) {
  const {user,loading:authLoading}=useAuth();const {connections,loading,error:loadError,refresh}=useMarketplace();
  const [formOpen,setFormOpen]=useState(false);const [busy,setBusy]=useState(false);const [confirm,setConfirm]=useState(false);
  const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const connection=connections.find(x=>x.platform_id===platform);
  async function connect(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;const form=event.currentTarget;const values=new FormData(form);
    const appId=String(values.get("appId")??"");const secret=String(values.get("secret")??"");
    // Não manter o Secret em estado React, armazenamento local, URL ou logs.
    form.reset();setBusy(true);setError("");setNotice("");
    try{const result=await marketplaceAction("connect",{appId,secret});setFormOpen(false);setNotice(`Conta validada pela API. ${result.productsCount??0} ofertas recebidas.`);refresh();}
    catch(err){setError(err instanceof Error?err.message:"Não foi possível conectar.");}
    finally{setBusy(false);}
  }
  async function act(action:"sync"|"disconnect") {
    if(busy)return;setBusy(true);setError("");setNotice("");
    try{const result=await marketplaceAction(action);setConfirm(false);setNotice(action==="sync"?`${result.productsCount??0} ofertas atualizadas.`:result.message??"Conexão removida.");refresh();}
    catch(err){setError(err instanceof Error?err.message:"Operação não concluída.");}finally{setBusy(false);}
  }
  if(platform!=="shopee")return <div className="mt-3"><Badge tone="neutral">Integração em preparação</Badge><p className="mt-2 text-xs text-muted">O acesso ao portal abaixo serve para cadastro e consulta externa. A conexão por API ainda depende do contrato e da liberação desta plataforma.</p></div>;
  if(authLoading)return <p role="status" className="mt-3 text-sm">Carregando conta…</p>;
  if(!user)return <div className="mt-3"><Badge tone="neutral">Não conectado</Badge><Link href="/entrar" className="ml-3 text-sm text-primary underline">Entrar para conectar Shopee</Link></div>;
  return <div className="mt-4 space-y-3">
    {loading?<p role="status" className="text-sm">Verificando conexão…</p>:loadError?<p role="alert" className="text-sm text-danger">{loadError} <button type="button" onClick={refresh} className="underline">Tentar novamente</button></p>:<Badge tone={connection?.status==="error"?"danger":"neutral"}>{connection?.status==="connected"?"Conta conectada":connection?.status==="error"?"Conexão precisa de atenção":"Não conectado"}</Badge>}
    {connection && <div className="text-xs text-muted"><p>Última atualização: {displayDate(connection.last_sync_at)}</p><p className="mt-1">{connection.sync_scope}</p>{connection.last_error_code&&<p className="mt-1 text-danger">A última sincronização falhou. Os dados anteriores podem estar desatualizados.</p>}</div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy||loading||Boolean(loadError)} onClick={()=>{setFormOpen(x=>!x);setError("");}} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background disabled:opacity-50">{connection?"Atualizar credenciais":"Conectar Shopee"}</button>
      {connection && <><button type="button" disabled={busy||loading} onClick={()=>act("sync")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Atualizar produtos</button><Link href="/produtos" className="rounded-lg border border-border px-3 py-2 text-sm">Ver produtos</Link><button type="button" disabled={busy||loading} onClick={()=>setConfirm(true)} className="px-2 text-sm text-danger underline">Desconectar</button></>}
    </div>
    {formOpen && <form onSubmit={connect} className="space-y-3 rounded-lg border border-border bg-background p-4">
      <p className="text-sm">Use as credenciais da <a href="https://affiliate.shopee.com.br/open_api/home" target="_blank" rel="noopener noreferrer" className="text-primary underline">Open API oficial de afiliados</a>. A senha da conta Shopee não é solicitada.</p>
      <label className="block text-sm">App ID<input name="appId" pattern="[A-Za-z0-9_-]+" maxLength={128} autoComplete="off" required disabled={busy} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"/></label>
      <label className="block text-sm">Secret da API<input name="secret" type="password" minLength={4} maxLength={512} autoComplete="new-password" required disabled={busy} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"/></label>
      <p className="text-xs text-muted">Enviado por HTTPS ao backend e armazenado cifrado após validação. Não fica salvo no navegador. A Shopee precisa liberar a API para sua conta.</p>
      <button disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-sm text-background disabled:opacity-50">{busy?"Validando e sincronizando…":"Validar conta e sincronizar"}</button>
    </form>}
    {confirm&&<div className="rounded-lg bg-danger-soft p-3 text-sm"><p>Remover esta conexão e os produtos sincronizados do Meu Vendedor? Links já salvos em Meus links serão preservados. A chave não será revogada no portal Shopee.</p><button type="button" disabled={busy} onClick={()=>act("disconnect")} className="mt-2 text-danger underline">Confirmar desconexão</button><button type="button" disabled={busy} onClick={()=>setConfirm(false)} className="ml-4 underline">Cancelar</button></div>}
    {busy&&!formOpen&&<p role="status" className="text-sm text-muted">Processando…</p>}
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}{notice&&<p role="status" className="text-sm text-primary">{notice}</p>}
  </div>;
}
