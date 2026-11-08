"use client";

import { ExternalLink, RefreshCw } from "lucide-react";

export interface ProductionServiceView {
  id: string;
  name: string;
  configured: boolean;
  integrated: boolean;
  balanceCredits?: number | null;
  balanceUnit?: "credits" | "USD";
  balanceScope?: "account" | "key-limit";
  balanceStatus?: string;
  balanceCheckedAt?: string;
  balanceMessage?: string;
  balanceUrl?: string;
}

export function ProductionServices({ services, refreshing, onRefresh }: {
  services: ProductionServiceView[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return <section aria-label="Saldos dos serviços de produção" className="mt-3 rounded-xl border border-border bg-background p-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Saldos e disponibilidade</h3>
      <button type="button" disabled={refreshing} onClick={onRefresh} className="inline-flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-50">
        <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} aria-hidden />{refreshing ? "Consultando…" : "Atualizar saldos"}
      </button>
    </div>
    <p className="mt-2 text-xs text-muted">Consulta as contas sem gerar conteúdo. Cada serviço tem sua unidade de crédito.</p>
    <dl className="mt-2 divide-y divide-border" aria-live="polite" aria-busy={refreshing}>
      {services.filter(service => service.id !== "elevenlabs").map((service) => <div key={service.id} className="py-2.5">
        <div className="flex items-start justify-between gap-2 text-xs">
          <dt className="font-semibold">{service.name}</dt>
          <dd className="text-right font-medium">
            {typeof service.balanceCredits === "number"
              ? service.balanceUnit === "USD"
                ? `${service.balanceCredits.toLocaleString("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 4 })}${service.balanceScope === "key-limit" ? " · limite da chave" : ""}`
                : `${service.balanceCredits.toLocaleString("pt-BR")} créditos`
              : !service.configured ? "Sem configuração"
              : service.balanceStatus === "permission_missing" ? "Sem permissão de consulta"
              : service.balanceStatus === "invalid_credentials" ? "Credencial recusada"
              : service.balanceStatus === "unavailable" ? "Consulta indisponível"
              : "Saldo no painel"}
          </dd>
        </div>
        <dd className="mt-1 text-[11px] leading-relaxed text-muted">
          {service.balanceMessage ?? "Saldo não verificado."}
          {!service.integrated && <span className="block">Geração ainda não integrada.</span>}
          {service.balanceCheckedAt && <span className="block">Conta consultada em {new Date(service.balanceCheckedAt).toLocaleString("pt-BR")}</span>}
          {service.balanceUrl && <a href={service.balanceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary underline">Ver painel<ExternalLink className="size-2.5" aria-hidden /></a>}
        </dd>
      </div>)}
    </dl>
  </section>;
}
