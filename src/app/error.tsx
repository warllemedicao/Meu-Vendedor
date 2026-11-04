"use client";

import { TriangleAlert } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-12 max-w-md rounded-xl border border-border bg-danger-soft p-6 text-center">
      <TriangleAlert className="mx-auto size-8 text-danger" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold">Não foi possível carregar esta página</h1>
      <p className="mt-1 text-sm text-muted">Ocorreu um erro inesperado. Tente carregar novamente.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Tentar novamente
      </button>
    </div>
  );
}
