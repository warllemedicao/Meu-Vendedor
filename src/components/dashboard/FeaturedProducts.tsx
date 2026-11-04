import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { DemoProduct } from "@/types";

export function FeaturedProducts({ produtos }: { produtos: DemoProduct[] }) {
  return (
    <Card titulo="Produtos em destaque" acao={<Badge tone="demo">Dados demonstrativos</Badge>}>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {produtos.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-lg border border-border">
            <div className="flex h-24 items-center justify-center bg-surface-muted text-muted" aria-hidden>
              <ImageOff className="size-6" />
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium">{p.nome}</p>
              <p className="text-xs text-muted">{p.categoria}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
