"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { authErrorMessage } from "@/lib/auth-errors";
import { googleAuthAvailability, googleSignInOptions, type GoogleAuthAvailability } from "@/lib/google-auth";

type Mode = "login" | "signup" | "reset";
const input = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2";
export function AuthForm() {
  const { user, configured, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [googleAvailability, setGoogleAvailability] = useState<GoogleAuthAvailability | "loading">("loading");
  const [googleRevision, setGoogleRevision] = useState(0);
  useEffect(() => {
    if (!configured || user) return;
    let active = true;
    void googleAuthAvailability(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
      .then((availability) => { if (active) setGoogleAvailability(availability); });
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (query.has("error") || hash.has("error")) {
      void Promise.resolve().then(() => { if (active) setError("O acesso Google não foi concluído. Tente novamente ou entre com e-mail."); });
      // Não exibir nem persistir a descrição bruta retornada pelo provedor.
      window.history.replaceState(null, "", "/entrar");
    }
    return () => { active = false; };
  }, [configured, user, googleRevision]);
  async function enterWithGoogle() {
    const supabase = getSupabase();
    if (!supabase || busy || googleAvailability !== "enabled") return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth(googleSignInOptions(window.location.origin));
      if (error) { setError("Não foi possível iniciar o login Google. Tente novamente ou entre com e-mail."); setBusy(false); }
    } catch { setError("Falha de conexão ao iniciar o login Google."); setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabase(); if (!supabase || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` });
        if (error) setError(authErrorMessage(error.code));
        else setMessage("Se houver uma conta com esse e-mail, você receberá as instruções de recuperação.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/entrar` } });
        if (error) setError(authErrorMessage(error.code));
        else { form.reset(); setMessage(data.session ? "Conta criada. Você já pode organizar seus links." : "Confira seu e-mail para confirmar o cadastro. Se já tiver uma conta, use Entrar ou Recupere sua senha."); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(authErrorMessage(error.code));
        else { form.reset(); setMessage("Você entrou no Meu Vendedor."); }
      }
    } catch { setError("Falha de conexão. Tente novamente."); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Carregando conta…</p>;
  if (!configured) return <div role="status" className="rounded-xl border border-border bg-accent-soft p-5 text-sm"><p className="font-semibold">Acesso de usuários em preparação</p><p className="mt-2">A configuração do banco ainda não foi ativada nesta publicação. Você pode explorar o catálogo de plataformas.</p><Link href="/entrar#lojas" className="mt-3 inline-block text-primary underline">Ver plataformas</Link></div>;
  if (user) return <div className="rounded-xl border border-border bg-surface p-5"><p>Você está conectado como <strong>{user.email}</strong>.</p><Link href="/afiliados" className="mt-3 inline-block text-primary underline">Organizar meus links</Link></div>;
  return <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5">
    <div className="mb-5 flex gap-2">{([['login','Entrar'],['signup','Criar conta']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={mode===value} disabled={busy} onClick={() => {setMode(value);setError("");setMessage("");}} className={`rounded-lg px-3 py-2 text-sm ${mode===value ? 'bg-primary text-background' : 'border border-border'}`}>{label}</button>)}</div>
    <h2 className="text-lg font-semibold">{mode === "reset" ? "Recuperar senha" : mode === "signup" ? "Sua conta no Meu Vendedor" : "Bem-vindo de volta"}</h2>
    <p className="mt-1 text-sm text-muted">Entre no Meu Vendedor e gerencie suas conexões nesta página.</p>
    {mode !== "reset" && <div className="mt-5">
      <button type="button" disabled={busy || googleAvailability !== "enabled"} onClick={() => void enterWithGoogle()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
        <span aria-hidden className="text-lg font-bold text-primary">G</span>Continuar com Google
      </button>
      <p role="status" className="mt-2 text-xs text-muted">{googleAvailability === "loading" ? "Verificando acesso Google…" : googleAvailability === "disabled" ? "Login Google em preparação. Você pode entrar com e-mail." : googleAvailability === "unavailable" ? "Não foi possível verificar o acesso Google." : "Permite entrar com sua conta Google. Outros serviços pedem autorização quando necessário."}</p>
      {(googleAvailability === "disabled" || googleAvailability === "unavailable") && <button type="button" disabled={busy} onClick={() => setGoogleRevision((value) => value + 1)} className="mt-2 text-xs text-primary underline">Verificar novamente</button>}
      <p className="mt-4 text-center text-xs text-muted">ou use seu e-mail</p>
    </div>}
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-sm">E-mail<input className={input} name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy}/></label>
      {mode !== "reset" && <label className="block text-sm">Senha<input className={input} name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : 1} maxLength={128} required disabled={busy}/></label>}
      <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-background disabled:opacity-50">{busy ? "Aguarde…" : mode === "reset" ? "Enviar recuperação" : mode === "signup" ? "Criar minha conta" : "Entrar"}</button>
    </form>
    <button type="button" disabled={busy} onClick={() => {setMode(mode === "reset" ? "login" : "reset");setError("");setMessage("");}} className="mt-4 text-sm text-primary underline">{mode === "reset" ? "Voltar para entrar" : "Esqueci minha senha"}</button>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-primary">{message}</p>}
  </div>;
}
