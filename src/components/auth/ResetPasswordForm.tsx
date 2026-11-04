"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { authErrorMessage } from "@/lib/auth-errors";
export function ResetPasswordForm() {
  const { user, loading, configured } = useAuth();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [done,setDone]=useState(false);
  const [recovery,setRecovery]=useState(false);
  useEffect(() => {
    const client=getSupabase(); if (!client) return;
    const {data:{subscription}}=client.auth.onAuthStateChange((event) => {if(event === "PASSWORD_RECOVERY")setRecovery(true);});
    return () => subscription.unsubscribe();
  },[]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;
    const form=event.currentTarget;const data=new FormData(form);const password=String(data.get("password"));
    if(password !== data.get("confirmation")){setError("As senhas precisam ser iguais.");return;}
    setBusy(true);setError("");
    try {
      const client=getSupabase();if(!client)throw Error();
      const {error}=await client.auth.updateUser({password});
      if(error)setError(authErrorMessage(error.code));else {form.reset();setDone(true);}
    } catch {setError("Não foi possível atualizar sua senha. Solicite um novo link se necessário.");}
    finally {setBusy(false);}
  }
  if(loading)return <p role="status">Validando acesso…</p>;
  if(done)return <p role="status">Senha atualizada. <Link href="/afiliados" className="text-primary underline">Acessar meus links</Link></p>;
  if(!configured || (!user && !recovery))return <p>Abra o link recebido por e-mail para redefinir sua senha. <Link href="/entrar" className="text-primary underline">Solicitar outro link</Link></p>;
  return <form onSubmit={submit} className="max-w-md space-y-4 rounded-xl border border-border bg-surface p-5">
    <label className="block text-sm">Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"/></label>
    <label className="block text-sm">Confirme a nova senha<input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"/></label>
    <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-background disabled:opacity-50">{busy ? "Salvando…" : "Atualizar senha"}</button>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </form>;
}
