import type { ReactNode } from "react";

export function PageHeader({ titulo, descricao, children }: { titulo: string; descricao: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">{descricao}</p>
      </div>
      {children}
    </div>
  );
}
