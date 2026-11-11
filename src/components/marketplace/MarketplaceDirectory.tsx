import Link from "next/link";
import { marketplaceDirectory } from "@/lib/marketplace-directory";

export function MarketplaceDirectory() {
  return <section aria-label="Marketplaces / Lojas" className="mb-6 space-y-4">
    <div><h2 className="text-xl font-semibold">Marketplaces / Lojas</h2><p className="mt-2 text-sm text-muted">Escolha uma loja para preparar vídeos e materiais de divulgação com seu link oficial. O fluxo manual não exige API da loja; a conexão automática depende das permissões de cada conta.</p></div>
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{marketplaceDirectory.map(item => <li key={item.id} className="flex flex-col rounded-xl border border-border bg-surface p-4">
      <h3 className="font-semibold">{item.name}</h3><p className="mt-2 text-xs font-medium text-primary">{item.status}</p><p className="mt-2 flex-1 text-sm text-muted">{item.description}</p>
      <Link href={item.href} className="mt-4 inline-block rounded-lg border border-primary px-3 py-2 text-center text-sm font-semibold text-primary">Abrir {item.name}</Link>
    </li>)}</ul>
  </section>;
}
