"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { Badge } from "@/components/ui/Badge";

type View = { state: "disconnected" | "browser_open" | "login_required" | "account_unverified" | "account_mismatch" | "connected"; email: string | null; credits: number | null; checkedAt: string; expiresAt?: string; saved?: boolean; liveViewUrl?: string };
const labels: Record<View["state"], string> = { disconnected: "Desconectado", browser_open: "Navegador aberto · verificando conta", login_required: "Entre no Google no navegador abaixo", account_unverified: "Conta ainda não confirmada", account_mismatch: "Conta diferente", connected: "Conectado ao Flow" };
const connectionErrors: Record<string, string> = {
  flow_daily_limit: "O tempo diário do navegador remoto foi esgotado na Cloudflare. Aguarde a renovação da cota. Sua conta Google não é a causa desse bloqueio.",
  flow_executor_rate_limited: "O executor externo limitou a abertura de navegadores. Aguarde antes de tentar novamente.",
  flow_browser_rate_limited: "A Cloudflare limitou a abertura do navegador remoto. Aguarde antes de tentar novamente. Esse limite é separado dos créditos Google.",
  flow_session_busy: "Já existe uma verificação em andamento. Aguarde alguns segundos e tente novamente.",
  flow_session_expired: "A sessão do navegador expirou. Clique em Conectar / reabrir Flow para abrir outra janela.",
  unauthorized: "Sua sessão no Meu Vendedor expirou. Entre novamente para conectar o Flow.",
  confirmed_account_required: "Confirme o e-mail da sua conta no Meu Vendedor antes de conectar o Flow.",
  auth_unavailable: "Não foi possível verificar seu acesso ao Meu Vendedor agora. Tente novamente mais tarde.",
};
export function GoogleFlowConnection() {
  const { user } = useAuth();
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const activeRequest = useRef(false);
  const cooldownUntil = useRef(0);
  const act = useCallback(async (action: string, quiet = false) => {
    if (activeRequest.current || action !== "disconnect" && Date.now() < cooldownUntil.current) return;
    activeRequest.current = true;
    if (!quiet) { setBusy(true); setError(""); }
    try {
      const { data } = await getSupabase()!.auth.getSession();
      if (!data.session) throw new Error("unauthorized");
      const response = await fetch(`/api/google-flow/${action}`, { method: "POST", headers: {
        "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`,
      }, body: "{}", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(action === "start" ? 120_000 : 45_000) });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({})) as { error?: string };
        const code = typeof failure.error === "string" && connectionErrors[failure.error] ? failure.error : "flow_request_failed";
        const seconds = Number(response.headers.get("Retry-After"));
        if (Number.isFinite(seconds) && seconds > 0) { cooldownUntil.current = Date.now() + Math.min(seconds, 86400) * 1000; setRetryAt(cooldownUntil.current); }
        if (code === "flow_daily_limit") {
          const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0); cooldownUntil.current = tomorrow.getTime(); setRetryAt(cooldownUntil.current);
        }
        if (response.status === 410) setView(null);
        throw new Error(code);
      }
      const body = await response.json() as View;
      if (body.liveViewUrl) {
        const live = new URL(body.liveViewUrl);
        if (live.protocol !== "https:" || !(live.hostname === "live.browser.run" || (live.hostname.endsWith(".modal.host") && live.pathname === "/view" && /^#[A-Za-z0-9_-]{32,128}$/.test(live.hash)))) throw new Error("invalid_live_view");
      }
      setView(previous => ({ ...body, liveViewUrl: body.state === "disconnected" ? undefined : body.liveViewUrl ?? previous?.liveViewUrl }));
    } catch (failure) { if (!quiet || failure instanceof Error && ["flow_daily_limit", "flow_browser_rate_limited", "flow_executor_rate_limited"].includes(failure.message)) setError(failure instanceof Error ? connectionErrors[failure.message] ?? "O navegador remoto está indisponível agora. Tente novamente mais tarde. Nenhuma geração foi enviada." : "Falha de conexão com o navegador remoto. Tente novamente."); }
    finally { activeRequest.current = false; if (!quiet) setBusy(false); }
  }, []);
  const expiresAt = view?.expiresAt;
  const hasBrowser = Boolean(view?.liveViewUrl);
  useEffect(() => {
    if (!retryAt) return;
    const timeout = setTimeout(() => { cooldownUntil.current = 0; setRetryAt(null); }, Math.max(0, retryAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [retryAt]);
  useEffect(() => {
    if (!expiresAt || !hasBrowser) return;
    const expires = new Date(expiresAt).getTime();
    if (!Number.isFinite(expires)) return;
    const first = setTimeout(() => void act("verify", true), 2500);
    const timer = setInterval(() => { if (Date.now() < expires) void act("verify", true); }, 15_000);
    const expiry = setTimeout(() => setView(previous => previous ? { ...previous, state: "disconnected", email: null, credits: null, liveViewUrl: undefined, expiresAt: undefined } : null), Math.max(0, expires - Date.now()));
    return () => { clearTimeout(first); clearInterval(timer); clearTimeout(expiry); };
  }, [expiresAt, hasBrowser, act]);
  return <article className="rounded-xl border border-border bg-surface p-4 space-y-3 sm:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Google Flow</h3><div role="status" aria-live="polite"><Badge>{view ? labels[view.state] : "Desconectado"}</Badge></div></div>
    <p className="text-sm text-muted">Conecte a mesma conta {user?.email ? `(${user.email})` : "Google"} no navegador remoto. O Flow usará os benefícios dessa conta. O acesso ao Meu Vendedor e o saldo da API Gemini são separados.</p>
    {user && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || retryAt !== null} onClick={() => void act("start")} className="rounded-lg bg-primary px-3 py-2 text-sm text-background disabled:opacity-50">{busy ? "Aguarde…" : retryAt ? "Aguardando disponibilidade" : "Conectar / reabrir Flow"}</button>
      <button type="button" disabled={busy || retryAt !== null} onClick={() => void act("verify")} className="rounded-lg border border-border px-3 py-2 text-sm">Verificar conta e créditos</button>
      <button type="button" disabled={busy} onClick={() => void act("disconnect")} className="rounded-lg border border-border px-3 py-2 text-sm">Desconectar</button>
    </div>}
    {view?.liveViewUrl && view.state !== "connected" && <div className="rounded-lg border border-border bg-background p-3 text-sm space-y-2">
      <p className="font-semibold">O navegador está aberto. Sua conta no Flow ainda não foi confirmada.</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Na janela abaixo, clique em <strong>Sign in / Fazer login</strong> e conclua o acesso à conta Google indicada acima.</li>
        <li>Se já entrou, abra sua foto de perfil no Flow para exibir a conta e os créditos.</li>
        <li>Clique em <strong>Verificar conta e créditos</strong>. O estado também atualiza automaticamente a cada 15 segundos.</li>
      </ol>
      {view.state === "account_unverified" && <p>O app ainda não conseguiu identificar a conta na página. Isso não significa que você foi desconectado do Google.</p>}
    </div>}
    {view?.state === "account_mismatch" && <p role="alert" className="text-sm text-danger">A conta aberta no Flow é diferente do seu acesso ao Meu Vendedor. Troque a conta no navegador remoto antes de sincronizar.</p>}
    {view?.state === "connected" && <div className="space-y-2 text-sm">
      <p>{view.email} · {view.credits === null ? "Créditos ainda não identificados; abra o menu da conta no Flow e verifique novamente." : `${view.credits} créditos observados no Flow`}</p>
      <p className="text-muted">Consulta: {new Date(view.checkedAt).toLocaleString("pt-BR")}. O saldo pode mudar.</p>
      <button type="button" disabled={busy} onClick={() => void act("save")} className="text-primary underline">{view.saved ? "Atualizar sessão salva" : "Autorizar salvar sessão por até 7 dias"}</button>
      <p className="text-xs text-muted">A sessão fica cifrada no servidor. Desconectar apaga a sessão salva. O Google pode pedir novo login antes desse prazo.</p>
    </div>}
    {view?.liveViewUrl && <div className="space-y-2">
      <iframe src={view.liveViewUrl} title="Seu navegador privado do Google Flow" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" className="h-[480px] w-full rounded-lg border border-border bg-background" />
      <a href={view.liveViewUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-block text-sm text-primary underline">Ampliar navegador privado do Flow</a>
    </div>}
    <p className="text-xs text-muted">{view?.expiresAt ? `Esta janela fecha às ${new Date(view.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. ` : "A janela de acesso fica aberta por até 10 minutos. "}A conexão só estará confirmada quando aparecer “Conectado ao Flow”, com sua conta. A geração automática pelo Flow ainda está em preparação.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {retryAt && <p role="status" className="text-xs text-muted">Nova tentativa liberada a partir de {new Date(retryAt).toLocaleString("pt-BR")}. Nenhuma nova tentativa será enviada automaticamente.</p>}
  </article>;
}
