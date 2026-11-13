"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMarketplace } from "@/components/marketplace/MarketplaceProvider";
import { Badge } from "@/components/ui/Badge";
import { displayDate, marketplaceAction } from "@/lib/marketplace";

interface MarketplaceStatus {
  connected: boolean;
  credentialsStored: boolean;
  status: "connected" | "error" | "disconnected" | "not_configured";
  lastSyncAt: string | null;
  lastErrorCode: string | null;
}

function isMarketplaceStatus(value: unknown): value is MarketplaceStatus["status"] {
  return value === "connected" || value === "error" || value === "disconnected" || value === "not_configured";
}

export function AutomationWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const marketplace = useMarketplace();
  const [status, setStatus] = useState<MarketplaceStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [statusUserId, setStatusUserId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    if (!user) return () => { active = false; };

    void marketplaceAction("status").then((result) => {
      if (!active) return;
      if (typeof result.credentialsStored !== "boolean" || typeof result.connected !== "boolean"
        || !isMarketplaceStatus(result.status)) {
        throw new Error("O serviço retornou um estado de conexão inválido.");
      }
      setStatus({
        connected: result.connected,
        credentialsStored: result.credentialsStored,
        status: result.status,
        lastSyncAt: result.lastSyncAt ?? null,
        lastErrorCode: result.lastErrorCode ?? null,
      });
      setStatusError("");
    }).catch((failure: unknown) => {
      if (active) {
        setStatus(null);
        setStatusError(failure instanceof Error ? failure.message : "Não foi possível verificar a conexão Shopee.");
      }
    }).finally(() => {
      if (active) setStatusUserId(user.id);
    });

    return () => { active = false; };
  }, [user, revision]);

  const currentStatus = user && statusUserId === user.id ? status : null;
  const currentStatusError = user && statusUserId === user.id ? statusError : "";
  const statusLoading = Boolean(user && statusUserId !== user.id);

  async function synchronize() {
    if (!user || !currentStatus?.credentialsStored || syncing) return;
    setSyncing(true);
    setNotice("");
    setError("");
    try {
      const result = await marketplaceAction("sync");
      const count = typeof result.productsCount === "number" ? result.productsCount : null;
      setNotice(count === null
        ? "Sincronização concluída. Atualize o catálogo para consultar os produtos."
        : `Sincronização concluída: ${count} produto(s) consultado(s).`);
      marketplace.refresh();
      setStatusUserId(null);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível sincronizar a Shopee.");
    } finally {
      setSyncing(false);
    }
  }

  const connectionLabel = authLoading || !user
    ? authLoading ? "Verificando sua conta" : "Entre para consultar"
    : statusLoading
      ? "Verificando conexão"
      : currentStatusError
        ? "Estado desconhecido"
        : currentStatus?.credentialsStored
          ? currentStatus.status === "error" ? "Credencial armazenada · verificar" : "Credencial armazenada"
          : "Sem credencial confirmada";

  return <div className="space-y-5">
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Sincronização de produtos Shopee</h2>
        <Badge>{connectionLabel}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted">
        O Worker está configurado no código para consultar contas Shopee conectadas a cada 30 minutos,
        quando a última sincronização tiver mais de 25 minutos. A execução do cron na versão atualmente
        publicada não foi confirmada; este painel não afirma que ela esteja ativa.
      </p>
      {currentStatus?.lastSyncAt && <p className="mt-3 text-xs text-muted">Última sincronização registrada: {displayDate(currentStatus.lastSyncAt)}.</p>}
      {currentStatus?.lastErrorCode && <p className="mt-2 text-sm text-danger">A última execução registrou um erro de integração. Verifique a conexão antes de substituir credenciais.</p>}
      {currentStatusError && <p role="alert" className="mt-3 text-sm text-danger">{currentStatusError} A falha de consulta não comprova ausência de credenciais.</p>}
      {marketplace.error && <p role="alert" className="mt-3 text-sm text-danger">{marketplace.error}</p>}
      {authLoading
        ? <p role="status" className="mt-4 text-sm">Verificando sua conta…</p>
        : !user
          ? <Link href="/entrar" className="mt-4 inline-block text-sm text-primary underline">Entre para consultar suas automações</Link>
          : <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={statusLoading || syncing || !currentStatus?.credentialsStored}
              onClick={() => void synchronize()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {syncing ? "Sincronizando…" : "Sincronizar agora"}
            </button>
            <button type="button" disabled={statusLoading || syncing}
              onClick={() => { setStatusUserId(null); setRevision((value) => value + 1); }}
              className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">
              Verificar estado
            </button>
            {!statusLoading && !currentStatusError && !currentStatus?.credentialsStored && <Link href="/entrar#lojas" className="self-center text-sm text-primary underline">Ver conexão Shopee</Link>}
          </div>}
      {notice && <p role="status" className="mt-3 text-sm text-primary">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </section>

    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">Agendamentos assistidos</h2>
      <p className="mt-2 text-sm text-muted">
        Publicações programadas aguardam sua ação manual no horário escolhido. O Meu Vendedor não publica
        automaticamente em redes sociais. A disponibilidade do agendador em produção depende das migrations
        e da publicação do backend, ainda pendentes.
      </p>
      <Link href="/publicacoes" className="mt-4 inline-block text-sm text-primary underline">Abrir painel de publicações</Link>
    </section>

    <p className="text-xs text-muted">
      Esta página não inicia geração de vídeo nem serviços pagos. A sincronização manual usa somente a conexão Shopee
      confirmada para sua conta.
    </p>
  </div>;
}
