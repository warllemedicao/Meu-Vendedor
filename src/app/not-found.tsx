import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-xl border border-border bg-surface p-6 text-center">
      <h1 className="text-lg font-semibold">Página não encontrada</h1>
      <p className="mt-1 text-sm text-muted">O endereço digitado não existe no Meu Vendedor.</p>
      <Link
        href="/dashboard"
        className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Ir para o Dashboard
      </Link>
    </div>
  );
}
