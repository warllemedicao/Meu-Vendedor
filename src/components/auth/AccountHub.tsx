"use client";

import { useEffect, useState } from "react";
import { AuthForm } from "./AuthForm";
import { useAuth } from "./AuthProvider";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { useMarketplace } from "@/components/marketplace/MarketplaceProvider";
import { connectorCatalog } from "@/lib/connectors/catalog";
import { Badge } from "@/components/ui/Badge";
import { GoogleFlowConnection } from "./GoogleFlowConnection";

const sections = [{ id: "acesso", label: "Meu acesso" }, { id: "google", label: "Google e redes" }, { id: "lojas", label: "Lojas" }] as const;
type Section = typeof sections[number]["id"];
function sectionFromHash(): Section {
  const value = window.location.hash.slice(1);
  return sections.some((section) => section.id === value) ? value as Section : "acesso";
}

export function AccountHub() {
  const { user } = useAuth();
  const { connections } = useMarketplace();
  const [section, setSection] = useState<Section>("acesso");
  const googleIdentity = user?.identities?.some((identity) => identity.provider === "google") ?? false;
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
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Conta Google</h2><Badge>{googleIdentity ? "Identidade Google vinculada" : user ? "Acesso por e-mail" : "Entre na sua conta"}</Badge></div>
        <p className="mt-2 text-sm text-muted">O login Google dá acesso à sua conta no Meu Vendedor. Cada serviço solicita as permissões necessárias para conectar e sincronizar seus dados.</p>
        {!user && <button type="button" onClick={() => { window.location.hash = "acesso"; setSection("acesso"); }} className="mt-3 text-sm text-primary underline">Ir para meu acesso</button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <GoogleFlowConnection key={user?.id ?? "anonymous"} />
        {[
          ["YouTube Create / Google vídeo", "Alternativa por API implementada", "O editor YouTube Create não possui API pública identificada. A geração por Gemini Omni foi adicionada ao pipeline; usa a chave e o faturamento do aplicativo, separados dos benefícios do YouTube e Flow. O acesso real ao modelo ainda será validado."],
          ["YouTube", "Publicação em preparação", "A autorização do canal será solicitada aqui quando a publicação estiver disponível."],
          ["Instagram e Facebook", "Conexão em preparação", "As contas e páginas serão autorizadas nesta central, com as permissões de publicação de cada rede."],
          ["TikTok", "Publicação em preparação", "A conexão para publicar vídeos depende da integração oficial e da aprovação do aplicativo."],
        ].map(([name, state, description]) => <article key={name} className="rounded-xl border border-border bg-surface p-4"><h3 className="font-semibold">{name}</h3><div className="mt-2"><Badge>{state}</Badge></div><p className="mt-2 text-sm text-muted">{description}</p></article>)}
      </div>
    </section>
    <section role="tabpanel" id="panel-lojas" aria-labelledby="tab-lojas" hidden={section !== "lojas"} className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-4"><h2 className="font-semibold">Suas lojas e programas de afiliados</h2><p className="mt-1 text-sm text-muted">Selecione uma plataforma para conectar ou revisar o acesso. O catálogo público continua disponível antes da conexão.</p></div>
      {connectorCatalog.map((connector) => {
        const connection = connections.find((item) => item.platform_id === connector.id);
        return <details key={connector.id} name="marketplace-connections" className="rounded-xl border border-border bg-surface">
          <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-semibold"><span>{connector.name}</span><Badge>{connector.id !== "shopee" ? "Em preparação" : connection?.status === "connected" ? "Conectada" : connection?.status === "error" ? "Revisar conexão" : "Não conectada"}</Badge></summary>
          <div className="border-t border-border p-3"><IntegrationCard connector={connector} /></div>
        </details>;
      })}
    </section>
  </div>;
}
