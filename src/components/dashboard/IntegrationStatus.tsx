import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { IntegrationState } from "@/types";

export function IntegrationStatus({ integracoes }: { integracoes: IntegrationState[] }) {
  return (
    <Card titulo="Estado das integrações">
      <ul className="space-y-3">
        {integracoes.map((i) => (
          <li key={i.nome} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{i.nome}</p>
              <p className="truncate text-xs text-muted">{i.descricao}</p>
            </div>
            <Badge tone="neutral">Não conectado</Badge>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">
        Nenhuma integração existe nesta etapa. Veja o planejamento em{" "}
        <Link href="/contas" className="font-medium text-primary underline underline-offset-2">
          Contas Conectadas
        </Link>
        .
      </p>
    </Card>
  );
}
