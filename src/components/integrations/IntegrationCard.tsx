import type { ConnectorDefinition } from "@/types/connectors";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { getUnconfiguredSnapshot } from "@/lib/connectors/catalog";

export function IntegrationCard({ connector }: { connector: ConnectorDefinition }) {
  const snapshot = getUnconfiguredSnapshot(connector.id);
  return (
    <Card titulo={connector.name} acao={<Badge tone="neutral">Não conectado</Badge>}>
      <p className="text-sm text-muted">{connector.description}</p>
      <p className="mt-3 rounded-lg bg-accent-soft p-3 text-sm text-accent">{connector.availabilityMessage}</p>
      <dl className="mt-4 space-y-4 text-sm">
        <div><dt className="font-semibold">Conta necessária</dt><dd className="mt-1 text-muted">{connector.accountRequirement}</dd></div>
        <div>
          <dt className="font-semibold">Recursos pretendidos</dt>
          <dd><ul className="mt-2 space-y-3">{connector.capabilities.map((capability) => (
            <li key={capability.id}>
              <p className="font-medium">{capability.label}</p>
              <Badge tone="neutral">{capability.evidence === "documented" ? "Documentado na plataforma" : "A confirmar na plataforma"}</Badge>
              <p className="mt-1 text-muted">{capability.limitation}</p>
              <p className="text-xs text-muted">Indisponível no Meu Vendedor nesta etapa.</p>
            </li>
          ))}</ul></dd>
        </div>
        <div><dt className="font-semibold">Permissões necessárias</dt><dd><ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{connector.permissions.map((p) => <li key={p}>{p}</li>)}</ul></dd></div>
        <div><dt className="font-semibold">Dependências de aprovação</dt><dd><ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{connector.approvals.map((p) => <li key={p}>{p}</li>)}</ul></dd></div>
        <div><dt className="font-semibold">Sincronização</dt><dd className="mt-1 text-muted">{snapshot.synchronization.status === "not_started" ? "Não iniciada. Nenhuma conta autorizada e nenhum dado sincronizado." : "Indisponível nesta etapa."}</dd></div>
        <div><dt className="font-semibold">Documentação oficial</dt><dd><ul className="mt-1 space-y-2">{connector.documentation.map((doc) => <li key={doc.url}><a className="break-words text-primary underline underline-offset-2" href={doc.url} target="_blank" rel="noopener noreferrer">{doc.label} <span className="sr-only">(abre em nova aba)</span></a></li>)}</ul></dd></div>
      </dl>
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted">Configuração indisponível até existir um fluxo seguro de autorização. Referências revisadas em <time dateTime={connector.reviewedAt}>04/11/2026</time>.</p>
    </Card>
  );
}
