"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type BrowserResponse = {
  running?: boolean;
  pages?: number;
  status?: string;
  viewUrl?: string;
  error?: string;
};

export function PrivateBrowserConnection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [viewUrl, setViewUrl] = useState("");
  const [running, setRunning] = useState(false);

  async function act(action: "status" | "start" | "stop" | "view") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Autenticação indisponível.");
      const { data, error } = await supabase.functions.invoke<BrowserResponse>("private-browser", {
        body: { action },
      });
      if (error || !data || data.error) throw new Error(
        data?.error === "browser_not_configured"
          ? "Navegador ainda não configurado no servidor."
          : "Não foi possível acessar o navegador privado."
      );
      if (action === "status") {
        setRunning(Boolean(data.running));
        setMessage(data.running ? "Navegador ativo." : "Navegador desligado.");
      } else if (action === "start") {
        setRunning(true);
        setMessage("Navegador iniciado. Abra a visualização para entrar no Flow.");
      } else if (action === "stop") {
        setRunning(false);
        setViewUrl("");
        setMessage("Navegador encerrado.");
      } else if (action === "view") {
        const url = new URL(data.viewUrl ?? "");
        if (url.protocol !== "https:" || !url.pathname.endsWith("/viewer") || !url.searchParams.has("ticket")) {
          throw new Error("Endereço de visualização inválido.");
        }
        setViewUrl(url.toString());
        setMessage("Visualização liberada temporariamente.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro desconhecido.");
    } finally {
      setBusy(false);
    }
  }

  return <article className="space-y-3 rounded-xl border border-border bg-surface p-4 sm:col-span-2">
    <h3 className="font-semibold">Google Flow · Navegador próprio (prévia)</h3>
    <p className="text-sm text-muted">Use somente após a implantação segura do Chromium. Faça login diretamente na página oficial do Google; não informe sua senha ao Meu Vendedor.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void act("status")} className="rounded-lg border border-border px-3 py-2 text-sm">Consultar</button>
      <button type="button" disabled={busy} onClick={() => void act("start")} className="rounded-lg border border-border px-3 py-2 text-sm">Iniciar</button>
      <button type="button" disabled={busy || !running} onClick={() => void act("view")} className="rounded-lg border border-border px-3 py-2 text-sm">Abrir tela</button>
      <button type="button" disabled={busy} onClick={() => void act("stop")} className="rounded-lg border border-border px-3 py-2 text-sm">Encerrar</button>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {viewUrl && <div className="space-y-2">
      <iframe title="Tela privada do Chromium" src={viewUrl} referrerPolicy="no-referrer" className="h-[480px] w-full rounded-lg border border-border" />
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-sm underline">Abrir em tela cheia</a>
    </div>}
  </article>;
}
