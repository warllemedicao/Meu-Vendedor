import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { DemoActivity } from "@/types";

export function RecentActivity({ atividades }: { atividades: DemoActivity[] }) {
  return (
    <Card titulo="Atividades recentes" acao={<Badge tone="demo">Dados demonstrativos</Badge>}>
      <ul className="space-y-3">
        {atividades.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
            <span>{a.texto}</span>
            <span className="shrink-0 text-xs text-muted">{a.quando}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
