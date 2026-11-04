"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { getSupabase } from "@/lib/supabase/client";

export function ProfileForm() {
  const {user,loading,configured}=useAuth();
  if(loading)return <p role="status">Carregando conta…</p>;
  if(!configured)return <p>O perfil estará disponível após ativar a configuração do banco nesta publicação.</p>;
  if(!user)return <p><Link href="/entrar" className="text-primary underline">Entre na sua conta</Link> para gerenciar seu perfil.</p>;
  return <UserProfile key={user.id} userId={user.id} email={user.email ?? ''}/>;
}
function UserProfile({userId,email}:{userId:string;email:string}) {
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;const client=getSupabase();if(!client)return;
    void client.from('mv_profiles').select('display_name').eq('id',userId).single().then(({data,error})=>{
      if(!active)return;
      if(error)setError('Não foi possível carregar o perfil.');else setName(data.display_name);
      setLoading(false);
    });
    return()=>{active=false;};
  },[userId,revision]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy || loading)return;setBusy(true);setError('');setNotice('');
    try{
      const client=getSupabase();if(!client)throw Error();
      const {error}=await client.from('mv_profiles').update({display_name:name.trim()}).eq('id',userId).select('id').single();
      if(error)setError('Não foi possível salvar o perfil.');else setNotice('Perfil atualizado.');
    }catch{setError('Falha de conexão. Tente novamente.');}finally{setBusy(false);}
  }
  return <form onSubmit={submit} className="max-w-lg space-y-4 rounded-xl border border-border bg-surface p-5">
    <h2 className="font-semibold">Seu perfil no Meu Vendedor</h2><p className="break-all text-sm text-muted">{email}</p>
    {loading ? <p role="status">Carregando perfil…</p> : <label className="block text-sm">Como deseja ser chamado?<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} disabled={busy || Boolean(error)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"/></label>}
    <button disabled={busy || loading || Boolean(error)} className="rounded-lg bg-primary px-4 py-2 text-sm text-background disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar perfil'}</button>
    {error && <p role="alert" className="text-sm text-danger">{error} <button type="button" onClick={()=>{setLoading(true);setError('');setRevision(n=>n+1);}} className="underline">Tentar novamente</button></p>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
  </form>;
}
