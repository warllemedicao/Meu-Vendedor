import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { DemoProduct } from "@/types";

export function Top10List({ produtos }: { produtos: DemoProduct[] }) {
  return (
    <Card titulo="Top 10 do dia" acao={<Badge tone="demo">Dados demonstrativos</Badge>}>
      {/* A numeração aqui é informação real: é um ranking. */}
      <ol className="divide-y divide-border">
        {produtos.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.nome}</p>
              <p className="truncate text-xs text-muted">
                {p.categoria} · {p.plataforma}
              </p>
            </div>
            <div className="flex w-24 shrink-0 items-center gap-2 sm:w-32">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
                role="img"
                aria-label={`Pontuação de exemplo: ${p.pontuacao} de 100`}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${p.pontuacao}%` }} />
              </div>
              <span className="w-6 text-right text-xs tabular-nums text-muted">{p.pontuacao}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
