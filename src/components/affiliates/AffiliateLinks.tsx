"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { connectorCatalog } from "@/lib/connectors/catalog";
import { validateAffiliateLink, type AffiliateLink, type AffiliateLinkInput } from "@/lib/affiliate-links";

const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
export function AffiliateLinks() {
  const { user, loading: authLoading, configured } = useAuth();
  if(authLoading)return <p role="status">Carregando sua conta…</p>;
  if(!configured)return <div className="rounded-xl border border-border bg-accent-soft p-5"><p className="font-semibold">Seus links em um só lugar</p><p className="mt-2 text-sm">O armazenamento da sua conta ainda está em preparação nesta publicação. O catálogo das plataformas já pode ser consultado.</p><Link href="/entrar#lojas" className="mt-3 inline-block text-primary underline">Ver plataformas</Link></div>;
  if(!user)return <div className="rounded-xl border border-border bg-surface p-5"><p>Entre ou crie sua conta para guardar e organizar seus links.</p><Link href="/entrar" className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-background">Entrar ou criar conta</Link></div>;
  return <UserLinks key={user.id} userId={user.id}/>;
}

function UserLinks({userId}:{userId:string}) {
  const [rows,setRows] = useState<AffiliateLink[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [editing,setEditing] = useState<AffiliateLink | null>(null);
  const [filter,setFilter] = useState("");
  const [removeId,setRemoveId] = useState<string | null>(null);
  const [revision,setRevision] = useState(0);
  const mounted = useRef(false);
  useEffect(() => {mounted.current=true;return () => {mounted.current=false;};},[]);
  useEffect(() => {
    const client=getSupabase();
    if(!client) return;
    let active=true;
    void client.from("mv_affiliate_links").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(200)
      .then(({data,error}) => {
        if(!active)return;
        if(error) setError("Não foi possível carregar seus links. Tente novamente. Se persistir, a configuração do banco precisa ser verificada.");
        else setRows(data ?? []);
        setLoading(false);
      });
    return () => {active=false;};
  },[userId,revision]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return;
    const client=getSupabase();if(!client)return;
    const uid=userId;const form=event.currentTarget;const data=new FormData(form);
    const input:AffiliateLinkInput={platform_id:String(data.get("platform_id")), title:String(data.get("title")).trim(), url:String(data.get("url")).trim(), campaign:String(data.get("campaign") ?? "").trim(), notes:String(data.get("notes") ?? "").trim()};
    const invalid=validateAffiliateLink(input);if(invalid){setError(invalid);return;}
    setBusy(true);setError("");setNotice("");
    try {
      const result=editing ? await client.from("mv_affiliate_links").update(input).eq("id",editing.id).eq("user_id",uid).select("id").single() : await client.from("mv_affiliate_links").insert(input).select("id").single();
      if(!mounted.current)return;
      if(result.error) {setError("Não foi possível salvar o link. Verifique sua sessão e tente novamente.");return;}
      form.reset();setEditing(null);setNotice(editing ? "Link atualizado." : "Link salvo na sua conta.");setLoading(true);setRevision(x=>x+1);
    } catch {if(mounted.current)setError("Falha de conexão ao salvar.");}
    finally {setBusy(false);}
  }
  async function remove(id:string) {
    if(busy)return;const client=getSupabase();if(!client)return;const uid=userId;
    setBusy(true);setError("");setNotice("");
    try {
      const {data,error}=await client.from("mv_affiliate_links").delete().eq("id",id).eq("user_id",uid).select("id").single();
      if(!mounted.current)return;
      if(error || !data){setError("Não foi possível excluir o link. Tente novamente.");return;}
      setRows(items=>items.filter(x=>x.id!==id));setRemoveId(null);if(editing?.id===id)setEditing(null);setNotice("Link excluído.");
    } catch {if(mounted.current)setError("Falha de conexão ao excluir.");}
    finally {setBusy(false);}
  }
  const visible = rows.filter(row=>!filter || row.platform_id===filter);
  return <div className="space-y-5">
    <p className="rounded-xl border border-border bg-accent-soft p-4 text-sm">Guarde links que você obteve nos programas oficiais. O cadastro é manual; não conecta sua conta à loja e não consulta vendas ou comissões.</p>
    <form key={`${userId}-${editing?.id ?? 'new'}`} onSubmit={save} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">{editing ? "Editar link" : "Adicionar link de afiliado"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Plataforma<select name="platform_id" required disabled={busy} defaultValue={editing?.platform_id ?? 'shopee'} className={inputClass}>{connectorCatalog.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="block text-sm">Título<input name="title" maxLength={160} required disabled={busy} defaultValue={editing?.title} className={inputClass} placeholder="Ex.: Fone de ouvido"/></label>
      </div>
      <label className="block text-sm">Seu link de afiliado (HTTPS)<input name="url" type="url" maxLength={2048} required disabled={busy} defaultValue={editing?.url} className={inputClass} placeholder="https://…"/></label>
      <label className="block text-sm">Campanha (opcional)<input name="campaign" maxLength={100} disabled={busy} defaultValue={editing?.campaign} className={inputClass}/></label>
      <label className="block text-sm">Observações (opcional)<textarea name="notes" maxLength={1000} rows={2} disabled={busy} defaultValue={editing?.notes} className={inputClass}/></label>
      <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm text-background disabled:opacity-50">{busy ? "Salvando…" : editing ? "Salvar alterações" : "Salvar link"}</button>{editing && <button type="button" disabled={busy} onClick={()=>setEditing(null)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar edição</button>}</div>
    </form>
    {error && <div role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{error} <button type="button" disabled={busy || loading} onClick={()=>{setLoading(true);setError("");setRevision(x=>x+1);}} className="underline">Tentar carregar novamente</button></div>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Meus links</h2><label className="text-sm">Filtrar por plataforma<select value={filter} onChange={e=>setFilter(e.target.value)} className={inputClass}><option value="">Todas</option>{connectorCatalog.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
    {loading ? <p role="status">Carregando links…</p> : visible.length ? <ul className="space-y-3">{visible.map(row=><li key={row.id} className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-medium">{row.title}</h3><p className="mt-1 text-xs text-muted">{connectorCatalog.find(p=>p.id===row.platform_id)?.name}{row.campaign ? ` · ${row.campaign}` : ''} · Cadastro manual</p>
      <a href={row.url} target="_blank" rel="noopener noreferrer sponsored" className="mt-2 block break-all text-sm text-primary underline">Abrir link <span className="sr-only">(nova aba)</span></a>
      {row.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{row.notes}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><button type="button" disabled={busy} onClick={()=>{setEditing(row);setError("");setNotice("");window.scrollTo({top:0,behavior:'smooth'});}} className="text-primary underline">Editar</button>{removeId===row.id ? <><span>Excluir este link?</span><button type="button" disabled={busy} onClick={()=>remove(row.id)} className="text-danger underline">Confirmar exclusão</button><button type="button" disabled={busy} onClick={()=>setRemoveId(null)} className="underline">Cancelar</button></> : <button type="button" disabled={busy} onClick={()=>setRemoveId(row.id)} className="text-danger underline">Excluir</button>}</div>
    </li>)}</ul> : !error && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">{filter ? "Nenhum link desta plataforma." : "Você ainda não cadastrou links. Adicione o primeiro acima."}</p>}
    {rows.length===200 && <p className="text-xs text-muted">Exibindo os 200 links mais recentes.</p>}
  </div>;
}
