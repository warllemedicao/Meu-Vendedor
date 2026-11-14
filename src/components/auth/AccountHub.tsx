"use client";

import { useEffect, useState } from "react";
import { AuthForm } from "./AuthForm";
import { useAuth } from "./AuthProvider";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { useMarketplace } from "@/components/marketplace/MarketplaceProvider";
import { connectorCatalog } from "@/lib/connectors/catalog";
import { marketplaceAction, displayDate } from "@/lib/marketplace";
import { shopeeSummaryState } from "@/lib/marketplace-status";
import { Badge } from "@/components/ui/Badge";
import { YouTubeConnection } from "./YouTubeConnection";
import { FacebookConnection } from "./FacebookConnection";
import { TikTokConnection } from "./TikTokConnection";
import { Camera, Pin, Video, Sparkles, ExternalLink } from "lucide-react";

const sections = [{ id: "acesso", label: "Meu acesso" }, { id: "google", label: "Lojas e redes" }] as const;
type Section = typeof sections[number]["id"];
function sectionFromHash(): Section {
  const value = window.location.hash.slice(1);
  if (value === "lojas") return "google";
  return sections.some((section) => section.id === value) ? value as Section : "acesso";
}

export function AccountHub() {
  const { user } = useAuth();
  const { connections, loading: connectionsLoading, error: connectionsError } = useMarketplace();
  const userId = user?.id;
  const shopeeConnection = connections.find((item) => item.platform_id === "shopee");
  const [section, setSection] = useState<Section>("acesso");
  const [shopeeStatus, setShopeeStatus] = useState<{
    userId: string; error: boolean; status: Awaited<ReturnType<typeof marketplaceAction>> | null;
  } | null>(null);
  const [statusRevision, setStatusRevision] = useState(0);
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  useEffect(() => {
    let active = true;
    if (!userId) return () => { active = false; };
    void marketplaceAction("status").then((status) => {
      if (active) {
        setShopeeStatus({ userId, error: false, status });
        setStatusRefreshing(false);
      }
    }).catch(() => {
      if (active) {
        setShopeeStatus({ userId, error: true, status: null });
        setStatusRefreshing(false);
      }
    });
    return () => { active = false; };
  }, [userId, statusRevision, shopeeConnection?.id, shopeeConnection?.status, shopeeConnection?.last_sync_at]);
  const currentShopeeStatus = shopeeStatus?.userId === userId ? shopeeStatus : null;
  const shopeeCredentialsStored = currentShopeeStatus?.error
    ? null
    : typeof currentShopeeStatus?.status?.credentialsStored === "boolean"
      ? currentShopeeStatus.status.credentialsStored
      : null;
  function retryShopeeStatus() {
    setStatusRefreshing(true);
    setStatusRevision((revision) => revision + 1);
  }
  const shopeeState = shopeeSummaryState({
    authenticated: Boolean(user),
    loading: Boolean(userId) && (!currentShopeeStatus || statusRefreshing),
    error: currentShopeeStatus?.error ?? false,
    status: currentShopeeStatus?.status?.connected !== undefined
      ? {
          connected: currentShopeeStatus.status.connected,
          credentialsStored: currentShopeeStatus.status.credentialsStored ?? false,
          status: currentShopeeStatus.status.status ?? "not_configured",
          lastSyncAt: currentShopeeStatus.status.lastSyncAt ?? null,
          lastErrorCode: currentShopeeStatus.status.lastErrorCode ?? null,
          syncScope: currentShopeeStatus.status.syncScope ?? null,
        }
      : null,
  });
  const shopeeLabels = {
    sign_in: "Entre para consultar",
    checking: "Verificando estado",
    unknown: "Estado desconhecido",
    not_connected: "Não configurada nesta conta",
    credentials_missing: "Credencial não localizada",
    attention: "Conexão precisa de atenção",
    connected: "Credenciais cadastradas",
  } as const;
  useEffect(() => {
    const update = () => setSection(sectionFromHash());
    void Promise.resolve().then(update);
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => { window.removeEventListener("hashchange", update); window.removeEventListener("popstate", update); };
  }, []);
  return <div className="space-y-5">
    <div role="tablist" aria-label="Conta e conexões" className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-2">
      {sections.map((item) => <button key={item.id} role="tab" type="button" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={section === item.id}
        onClick={() => { window.location.hash = item.id; setSection(item.id); }}
        className={`rounded-lg px-4 py-2 text-sm font-medium ${section === item.id ? "bg-primary text-background" : "text-muted hover:bg-surface-muted"}`}>{item.label}</button>)}
    </div>
    <section role="tabpanel" id="panel-acesso" aria-labelledby="tab-acesso" hidden={section !== "acesso"}><AuthForm /></section>
    <section role="tabpanel" id="panel-google" aria-labelledby="tab-google" hidden={section !== "google"} className="space-y-4">
      {!user && <p className="text-sm text-muted">Entre em Meu acesso para conectar suas redes.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <FacebookConnection key={`facebook:${user?.id ?? "anonymous"}`} />
        <YouTubeConnection key={`youtube:${user?.id ?? "anonymous"}`} compact />
        <TikTokConnection key={`tiktok:${user?.id ?? "anonymous"}`} />
        {[
          { name: "Instagram", icon: Camera, href: "/videos", status: "Publicação manual" },
          { name: "Pinterest", icon: Pin, href: "https://www.pinterest.com/pin-builder/", status: "Publicação manual" },
          { name: "Kwai", icon: Video, href: "/videos", status: "Publicação manual" },
          { name: "Gemini", icon: Sparkles, href: "/videos", status: "Serviço do estúdio" },
        ].map((item) => <article key={item.name} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"><item.icon className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h3 className="font-semibold">{item.name}</h3><p className="text-xs text-muted">{item.status}</p></div>
          <a href={item.href} target={item.href.startsWith("https:") ? "_blank" : undefined} rel={item.href.startsWith("https:") ? "noopener noreferrer" : undefined} className="rounded-lg border border-border p-2" aria-label={`Abrir ${item.name}`}><ExternalLink className="h-4 w-4" /></a>
        </article>)}
      </div>
      <div className="mt-5 space-y-3">
        <h2 className="text-sm font-semibold">Marketplaces e afiliados</h2>
      <div className="rounded-xl border border-border bg-surface p-4"><h2 className="font-semibold">Suas lojas e programas de afiliados</h2><p className="mt-1 text-sm text-muted">Selecione uma plataforma para conectar ou revisar o acesso. O catálogo público continua disponível antes da conexão.</p></div>
      {connectorCatalog.filter((connector) => connector.id !== "tiktok").map((connector) => {
        const connection = connections.find((item) => item.platform_id === connector.id);
        const statusLabel = connector.id === "shopee"
          ? shopeeLabels[shopeeState]
          : connectionsLoading
            ? "Verificando estado"
            : connectionsError
              ? "Estado desconhecido"
          : connector.id === "tiktok"
            ? "Conexão TikTok disponível"
            : connection?.status === "connected" ? "Conectada"
              : connection?.status === "error" ? "Estado a revisar"
                : "Em preparação";
        return <details key={connector.id} name="marketplace-connections" open={connector.id === "tiktok" ? true : undefined} className="rounded-xl border border-border bg-surface">
          <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-semibold"><span>{connector.name === "shopee" ? "Shopee Affiliate" : connector.name}</span><Badge>{statusLabel}</Badge></summary>
          <div className="border-t border-border p-3">
            {connector.id === "shopee" && shopeeState === "unknown" && <div role="alert" className="mb-3 rounded-lg border border-border bg-accent-soft p-3 text-sm">
              A consulta falhou; isso não comprova que suas credenciais estejam ausentes. Nenhuma credencial foi alterada. <button type="button" onClick={retryShopeeStatus} className="text-primary underline">Verificar novamente</button>
            </div>}
            {connector.id === "shopee" && currentShopeeStatus?.status?.credentialsStored && <div className="mb-3 rounded-lg border border-border bg-background p-3 text-sm">
              <p><strong>Shopee Affiliate — credenciais cadastradas</strong></p>
              <p className="mt-1">App Secret armazenado cifrado no servidor; seu conteúdo não é exibido.</p>
              <p className="mt-1">Última validação registrada: {displayDate(currentShopeeStatus.status.lastSyncAt ?? null)}.</p>
              {currentShopeeStatus.status.syncScope && <p className="mt-1">{currentShopeeStatus.status.syncScope}</p>}
              {currentShopeeStatus.status.status === "error" && <p className="mt-1 text-danger">A última conexão requer atenção. Verifique a API antes de atualizar credenciais.</p>}
            </div>}
            {connector.id === "shopee" && shopeeState === "credentials_missing" && <p role="status" className="mb-3 text-sm text-muted">O registro da conexão existe, mas o backend não localizou credenciais cifradas. Verifique a conexão antes de cadastrar dados novamente.</p>}
            <IntegrationCard connector={connector} credentialsStored={connector.id === "shopee" ? shopeeCredentialsStored : undefined} />
          </div>
        </details>;
      })}
      </div>
    </section>
  </div>;
}
