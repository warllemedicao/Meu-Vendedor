import type { DemoStat } from "@/types";

export function StatCard({ stat }: { stat: DemoStat }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{stat.rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{stat.valor}</p>
      <p className="mt-1 text-xs text-accent">Valor de {stat.detalhe}</p>
    </div>
  );
}
