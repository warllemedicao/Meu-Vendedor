import type { ReactNode } from "react";

export function Card({ titulo, acao, children, className = "" }: { titulo?: string; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface ${className}`}>
      {titulo && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {acao}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
