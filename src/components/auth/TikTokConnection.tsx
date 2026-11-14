"use client";

import { useEffect, useState } from "react";
import { Music2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

type Status = { connected: boolean; account?: { display_name?: string | null; scopes?: string } | null };

async function call(action: string, sandbox = false) {
  const client = getSupabase();
  if (!client) throw Error("Supabase não configurado.");
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw Error("Entre na sua conta primeiro.");
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${sandbox ? "tiktok-connect-sandbox" : "tiktok-connect"}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Error(result.code === "oauth_not_configured"
      ? "TikTok ainda não configurado no servidor."
      : "Falha na integração TikTok (" + (result.code ?? response.status) + ").");
  }
  return result;
}

export function TikTokConnection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const sandboxResult = url.searchParams.get("tiktok_sandbox");
    const result = sandboxResult ?? url.searchParams.get("tiktok");
    if (result) {
      url.searchParams.delete("tiktok");
      url.searchParams.delete("tiktok_sandbox");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      Promise.resolve().then(() => {
        if (active) setMessage(result === "connected" ? (sandboxResult ? "TikTok Sandbox conectado." : "TikTok conectado.") : result === "cancelled" ? "Autorização cancelada." : "Falha ao autorizar TikTok: " + result);
      });
    }
    if (user) {
      void call("status", true).then(data => {
        if (active) setSandboxStatus(data);
      }).catch(() => { /* Sandbox is optional. */ });
      void call("status").then(data => {
        if (active) setStatus(data);
      }).catch(error => {
        if (active) setMessage(error instanceof Error ? error.message : "Falha na consulta.");
      });
    }
    return () => { active = false; };
  }, [user]);

  async function act(action: "start" | "disconnect", sandbox = false) {
    setBusy(true);
    setMessage("");
    try {
      const result = await call(action, sandbox);
      if (action === "start") {
        const url = new URL(result.authorization_url);
        if (url.protocol !== "https:" || url.hostname !== "www.tiktok.com" || url.pathname !== "/v2/auth/authorize/") {
          throw Error("Destino OAuth inválido.");
        }
        window.location.assign(url.href);
        return;
      }
      if (sandbox) setSandboxStatus(await call("status", true));
      else setStatus(await call("status"));
      setMessage(sandbox ? "TikTok Sandbox desconectado." : "TikTok desconectado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na conexão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <Music2 className="h-6 w-6" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">TikTok</h3>
          <p className="text-xs text-muted">{status?.connected ? status.account?.display_name ?? "Conta conectada" : "Não conectado"}</p>
        </div>
        <button type="button" disabled={!user || busy} onClick={() => void act(status?.connected ? "disconnect" : "start")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
          {busy ? "Aguarde…" : status?.connected ? "Desconectar" : "Conectar"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted">Sandbox (teste): {sandboxStatus?.connected ? sandboxStatus.account?.display_name ?? "Conectado" : "Não conectado"}</span>
        <button type="button" disabled={!user || busy} onClick={() => void act(sandboxStatus?.connected ? "disconnect" : "start", true)} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">{busy ? "Aguarde…" : sandboxStatus?.connected ? "Desconectar Sandbox" : "Conectar Sandbox"}</button>
      </div>
      {!user && <p className="mt-2 text-xs text-muted">Entre na sua conta antes de conectar.</p>}
      {message && <p role="status" className="mt-2 text-xs text-muted">{message}</p>}
      <p className="mt-2 text-xs text-muted">Publicação via API requer permissões e aprovação do TikTok.</p>
    </article>
  );
}
