"use client";

import { useMarketplace } from "@/components/marketplace/MarketplaceProvider";
import { connectorCatalog } from "@/lib/connectors/catalog";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { IntegrationState } from "@/types";

export function IntegrationStatus({ integracoes }: { integracoes: IntegrationState[] }) {
  const {connections,loading,error}=useMarketplace();
  return (
    <Card titulo="Estado das integrações">
      <ul className="space-y-3">
        {integracoes.map((i) => (
          <li key={i.nome} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{i.nome}</p>
              <p className="truncate text-xs text-muted">{i.descricao}</p>
            </div>
            <Badge tone="neutral">{loading?"Verificando…":error?"Não verificado":connections.find(c=>c.platform_id===connectorCatalog.find(p=>p.name===i.nome)?.id)?.status==="connected"?"Conectado":connections.find(c=>c.platform_id===connectorCatalog.find(p=>p.name===i.nome)?.id)?.status==="error"?"Atenção":"Não conectado"}</Badge>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">
        Gerencie suas conexões e confira os requisitos em{" "}
        <Link href="/entrar#lojas" className="font-medium text-primary underline underline-offset-2">
          Conta e conexões
        </Link>
        .
      </p>
    </Card>
  );
}
