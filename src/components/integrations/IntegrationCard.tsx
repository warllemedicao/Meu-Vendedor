import type { ConnectorDefinition } from "@/types/connectors";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConnectionControls } from "@/components/marketplace/ConnectionControls";

export function IntegrationCard({ connector }: { connector: ConnectorDefinition }) {
  return (
    <Card titulo={connector.name}>
      <p className="text-sm text-muted">{connector.description}</p>
      <ConnectionControls platform={connector.id}/>
      <details className="mt-4"><summary className="cursor-pointer text-sm text-primary">Requisitos e documentação da plataforma</summary>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={connector.portalUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background">Acessar portal <span className="sr-only">oficial de {connector.name} (nova aba)</span></a>
        <a href={connector.affiliationUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2 text-sm">Como se afiliar <span className="sr-only">a {connector.name} (nova aba)</span></a>
      </div>
      <p className="mt-2 text-xs text-muted">Você será encaminhado ao site oficial. Esse acesso não conecta a loja ao Meu Vendedor.</p>
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
              <p className="text-xs text-muted">{capability.available ? "Disponível quando a conta possui autorização válida." : "Ainda indisponível no Meu Vendedor."}</p>
            </li>
          ))}</ul></dd>
        </div>
        <div><dt className="font-semibold">Permissões necessárias</dt><dd><ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{connector.permissions.map((p) => <li key={p}>{p}</li>)}</ul></dd></div>
        <div><dt className="font-semibold">Dependências de aprovação</dt><dd><ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{connector.approvals.map((p) => <li key={p}>{p}</li>)}</ul></dd></div>

        <div><dt className="font-semibold">Documentação oficial</dt><dd><ul className="mt-1 space-y-2">{connector.documentation.map((doc) => <li key={doc.url}><a className="break-words text-primary underline underline-offset-2" href={doc.url} target="_blank" rel="noopener noreferrer">{doc.label} <span className="sr-only">(abre em nova aba)</span></a></li>)}</ul></dd></div>
      </dl>
      </details>
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted">Referências revisadas em <time dateTime={connector.reviewedAt}>04/11/2026</time>.</p>
    </Card>
  );
}
