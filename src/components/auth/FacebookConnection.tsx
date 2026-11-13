"use client";

import { useCallback, useEffect, useState } from "react";
import { Facebook } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { getSupabase } from "@/lib/supabase/client";

type Status = { connected: boolean; page?: { page_name?: string } | null };
const messages: Record<string, string> = {
  connected: "Facebook conectado.",
  cancelled: "Autorização cancelada.",
  invalid_state: "A autorização expirou. Tente novamente.",
  authorization_failed: "A Meta não concluiu a autorização.",
  page_not_authorized: "A Página esperada não foi autorizada. Verifique as permissões no Facebook.",
  storage_failed: "Não foi possível salvar a conexão.",
};
async function invoke(action: "start" | "status" | "disconnect") {
  const client = getSupabase();
  if (!client) throw new Error("Supabase indisponível.");
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("Entre na sua conta antes de conectar o Facebook.");
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/facebook-connect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.code === "oauth_not_configured"
    ? "A configuração do Facebook no servidor está incompleta."
    : "Não foi possível consultar o Facebook.");
  return result;
}
export function FacebookConnection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!user) { setStatus(null); return; }
    try { setStatus(await invoke("status")); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha na consulta."); }
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const url = new URL(window.location.href);
    const result = url.searchParams.get("facebook");
    if (result) {
      setMessage(messages[result] ?? "Não foi possível concluir a autorização.");
      url.searchParams.delete("facebook");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    void refresh();
  }, [user, refresh]);
  async function act(action: "start" | "disconnect") {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await invoke(action);
      if (action === "start") {
        const destination = new URL(result.authorization_url);
        if (destination.protocol !== "https:" || destination.hostname !== "www.facebook.com" || !destination.pathname.endsWith("/dialog/oauth")) throw new Error("URL de autorização inválida.");
        window.location.assign(destination.href);
        return;
      }
      setStatus({ connected: false });
      setMessage("Facebook desconectado do Meu Vendedor.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir a ação."); }
    finally { setBusy(false); }
  }
  return <article className="rounded-xl border border-border bg-surface p-4">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><Facebook className="h-6 w-6" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">Facebook</h3>
        <p className="truncate text-xs text-muted">{status?.connected ? status.page?.page_name ?? "Conectado" : "Não conectado"}</p>
      </div>
      <button type="button" disabled={!user || busy} onClick={() => void act(status?.connected ? "disconnect" : "start")}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50">
        {busy ? "Aguarde…" : status?.connected ? "Desconectar" : "Conectar"}
      </button>
    </div>
    {!user && <p className="mt-2 text-xs text-muted">Entre na sua conta para conectar.</p>}
    {message && <p role="status" className="mt-2 text-xs text-muted">{message}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
  </article>;
}
