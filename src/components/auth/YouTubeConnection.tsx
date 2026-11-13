"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { Play } from "lucide-react";

type Channel = { id: string; title: string };
type ConnectionView = { configured: boolean; connected: boolean; status: string; email?: string; channel?: Channel; channels?: Channel[]; checkedAt?: string; uploadAuthorized?: boolean };
const callbackMessages: Record<string, string> = {
  connected: "Canal conectado ao Meu Vendedor. Confira o canal abaixo.",
  cancelled: "A autorização foi cancelada. Sua conexão anterior foi preservada.",
  youtube_account_mismatch: "Selecione a mesma conta Google usada no Meu Vendedor.",
  youtube_channel_missing: "A conta escolhida não retornou um canal YouTube. Confira se ela possui um canal.",
  youtube_permissions_missing: "Conceda as permissões de consultar a conta e enviar vídeos na autorização do Google.",
  youtube_offline_access_missing: "O Google não concedeu acesso renovável. Conecte novamente e aceite as permissões solicitadas.",
  youtube_browser_mismatch: "Abra e conclua a autorização no mesmo navegador. Cookies precisam estar permitidos.",
  youtube_authorization_expired: "A autorização expirou ou já foi utilizada. Inicie a conexão novamente.",
  youtube_client_rejected: "O Google recusou as credenciais OAuth do aplicativo. A configuração precisa ser revisada.",
  youtube_access_denied: "O Google recusou o acesso ao canal. Confira a API ativada e as permissões concedidas.",
};

async function invoke(body: Record<string, unknown>) {
  const client = getSupabase();
  if (!client) throw new Error("Entre na sua conta para conectar o YouTube.");
  const { data, error } = await client.functions.invoke("youtube-connection", { body });
  if (error) {
    if (error.context instanceof Response) {
      const failure = await error.context.json().catch(() => null);
      if (typeof failure?.error?.message === "string") throw new Error(failure.error.message);
    }
    throw new Error("Não foi possível consultar a conexão YouTube agora.");
  }
  if (data?.error?.message) throw new Error(data.error.message);
  return data;
}

export function YouTubeConnection({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [view, setView] = useState<ConnectionView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try { setView(await invoke({ action: "status" })); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Consulta indisponível."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    if (!user) return;
    const url = new URL(window.location.href);
    const result = url.searchParams.get("youtube");
    void Promise.resolve().then(() => {
      if (result) {
        if (result === "connected" || result === "cancelled") setNotice(callbackMessages[result]);
        else setNotice(callbackMessages[result] ?? "Não foi possível concluir a autorização Google. Tente conectar novamente.");
        url.searchParams.delete("youtube"); window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
      void refresh();
    });
  }, [user, refresh]);
  async function act(action: "start" | "verify" | "disconnect" | "select-channel", channelId?: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await invoke({ action, ...(channelId ? { channelId } : {}) });
      if (action === "start") {
        const url = new URL(data.url);
        const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!configured || url.origin !== new URL(configured).origin || url.pathname !== "/functions/v1/youtube-connection" || !/^[a-f0-9]{64}$/.test(url.searchParams.get("begin") ?? "")) throw new Error("O endereço de autorização não é válido.");
        window.location.assign(url.href);
        return;
      }
      setView(data);
      setNotice(action === "disconnect" ? "Conexão removida do Meu Vendedor. O login Google do aplicativo foi preservado." : "Conexão consultada no YouTube.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível concluir esta ação."); }
    finally { setBusy(false); }
  }
  if (compact) return <article className="rounded-xl border border-border bg-surface p-4">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white"><Play className="h-6 w-6" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h3 className="font-semibold">YouTube</h3><p className="truncate text-xs text-muted">{view?.channel?.title ?? (view?.connected ? "Conectado" : "Não conectado")}</p></div>
      <button type="button" disabled={!user || busy || !view?.configured} onClick={() => void act("start")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">{busy ? "Aguarde…" : view?.connected ? "Reconectar" : "Conectar"}</button>
    </div>
    {view?.channels && view.channels.length > 1 && <label className="mt-2 block text-xs">Canal<select aria-label="Canal YouTube" value={view.channel?.id ?? ""} disabled={busy} onChange={event => void act("select-channel", event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2">{view.channels.map(channel => <option key={channel.id} value={channel.id}>{channel.title}</option>)}</select></label>}
    {view?.connected && <button type="button" disabled={busy} onClick={() => void act("disconnect")} className="mt-2 text-xs text-muted underline">Desconectar</button>}
    {notice && <p role="status" className="mt-2 text-xs text-muted">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
  </article>;
  return <article className="rounded-xl border border-border bg-surface p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">YouTube</h3><Badge>{view?.connected ? "Canal conectado" : view?.status === "reauthorization_required" ? "Renovar autorização" : "Não conectado"}</Badge></div>
    <p className="text-sm text-muted">Autorize sua conta na página oficial do Google para identificar o canal e preparar o envio de vídeos. O acesso fica salvo de forma cifrada no servidor.</p>
    {view?.channel && <div className="rounded-lg border border-border bg-background p-3 text-sm space-y-1">
      <p className="font-semibold">{view.channel.title}</p><p className="break-all text-muted">{view.email}</p>
      <a href={`https://www.youtube.com/channel/${encodeURIComponent(view.channel.id)}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">Abrir canal</a>
      {view.checkedAt && <p className="text-xs text-muted">Última consulta: {new Date(view.checkedAt).toLocaleString("pt-BR")}</p>}
      <p className="text-xs text-muted">Envio de vídeos: {view.uploadAuthorized ? "autorizado no Google" : "permissão pendente"}. Publicação no aplicativo ainda em preparação.</p>
    </div>}
    {view?.channels && view.channels.length > 1 && <label className="block text-sm">Canal selecionado<select aria-label="Canal YouTube selecionado" value={view.channel?.id ?? ""} disabled={busy} onChange={event => void act("select-channel", event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2">{view.channels.map(channel => <option key={channel.id} value={channel.id}>{channel.title}</option>)}</select></label>}
    {user ? <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !view?.configured} onClick={() => void act("start")} className="rounded-lg bg-primary px-3 py-2 text-sm text-background disabled:opacity-50">{busy ? "Aguarde…" : view?.channel ? "Autorizar novamente" : "Conectar YouTube"}</button>
      {view?.channel && <><button type="button" disabled={busy} onClick={() => void act("verify")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Verificar canal</button><button type="button" disabled={busy} onClick={() => void act("disconnect")} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Desconectar YouTube</button></>}
      <button type="button" disabled={busy} onClick={() => void refresh()} className="text-xs text-primary underline disabled:opacity-50">Atualizar estado</button>
    </div> : <p className="text-sm text-muted">Entre na sua conta para autorizar o canal.</p>}
    {view && !view.configured && <p className="text-xs text-muted">A configuração das credenciais Google no backend ainda está pendente.</p>}
    <p className="text-xs text-muted">Você escolhe a conta e concede as permissões no Google. Em modo de teste, a autorização pode exigir renovação após sete dias. Conectar não publica vídeos automaticamente.</p>
    {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </article>;
}
