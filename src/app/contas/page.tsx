import type { Metadata } from "next";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { connectorCatalog } from "@/lib/connectors/catalog";

export const metadata: Metadata = { title: "Contas Conectadas" };

export default function Page() {
  return (
    <>
      <PageHeader titulo="Contas Conectadas" descricao="Requisitos e disponibilidade das futuras integrações externas.">
        <Badge tone="neutral">5 plataformas</Badge>
      </PageHeader>
      <div className="mb-6 rounded-xl border border-border bg-accent-soft p-4 text-sm">
        <p className="font-semibold">Nenhuma plataforma está conectada.</p>
        <p className="mt-1">Acesse os portais oficiais para entrar ou conhecer a afiliação. As conexões por API ainda não estão implementadas. Senhas das lojas são informadas somente nos sites das próprias plataformas.</p>
      </div>
      <section aria-label="Plataformas de integração" className="grid items-start gap-4 xl:grid-cols-2">
        {connectorCatalog.map((connector) => <IntegrationCard key={connector.id} connector={connector} />)}
      </section>
    </>
  );
}
