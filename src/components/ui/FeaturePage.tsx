import { Construction } from "lucide-react";
import { getNavItem } from "@/lib/navigation";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { PageHeader } from "./PageHeader";

/** Página padrão de módulo ainda não implementado. Não contém formulários nem botões de ação. */
export function FeaturePage({ href }: { href: string }) {
  const item = getNavItem(href);
  return (
    <>
      <PageHeader titulo={item.titulo} descricao={item.descricao}>
        <Badge tone="neutral">Previsto para: {item.etapaPrevista}</Badge>
      </PageHeader>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-accent-soft p-4">
        <Construction className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="text-sm font-semibold">Este recurso ainda não está implementado.</p>
          <p className="mt-1 text-sm text-muted">
            A página existe para completar a navegação. Nenhuma função, dado ou conexão real está disponível aqui.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card titulo="O que está planejado">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {item.recursosPlanejados.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
        <Card titulo="Depende de">
          {item.dependencias.length === 0 ? (
            <p className="text-sm text-muted">Nenhum serviço externo é necessário.</p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {item.dependencias.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
