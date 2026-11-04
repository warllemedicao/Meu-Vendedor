"use client";

import { useState } from "react";
import Link from "next/link";
import { productSources } from "@/lib/product-sources";
import { ProductCatalog } from "./ProductCatalog";
import { RemoteCatalog } from "./RemoteCatalog";

export function OpportunityCatalog() {
  const [platform, setPlatform] = useState("all");
  const selected = productSources.find(source => source.id === platform);

  return <div className="space-y-6">
    <section aria-label="Escolher plataforma" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="font-semibold">Suas oportunidades, em um só lugar</h2>
      <p className="mt-1 text-sm text-muted">Selecione uma plataforma para consultar os produtos disponíveis e o estado da integração.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[{ id: "all", name: "Todas" }, ...productSources].map(source => <button
          key={source.id} type="button" aria-pressed={platform === source.id}
          onClick={() => setPlatform(source.id)}
          className={`rounded-full border px-4 py-2 text-sm transition-colors ${platform === source.id ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-surface-muted"}`}
        >{source.name}</button>)}
      </div>
    </section>

    {selected && <section aria-label={`Disponibilidade ${selected.name}`} className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">{selected.name}</h2><span className="rounded-full bg-accent-soft px-3 py-1 text-xs">{selected.status}</span></div>
      <p className="mt-3 text-sm text-muted">{selected.summary}</p>
      <p className="mt-2 text-xs text-muted">{selected.ranking}</p>
    </section>}

    <RemoteCatalog platform={platform} />
    {(!selected || selected.id === "shopee") && <ProductCatalog discovery />}

    {!selected && <section aria-label="Disponibilidade das plataformas">
      <h2 className="text-lg font-semibold">Disponibilidade por plataforma</h2>
      <p className="mt-1 text-sm text-muted">O catálogo reúne somente dados sincronizados. Acesso à documentação não significa que a conta esteja conectada.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{productSources.map(source => <li key={source.id} className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-semibold">{source.name}</h3><p className="mt-1 text-xs text-primary">{source.status}</p>
        <p className="mt-3 text-sm text-muted">{source.summary}</p>
        <button type="button" onClick={() => {setPlatform(source.id); window.scrollTo({top: 0, behavior: "smooth"});}} className="mt-3 text-sm text-primary underline">Ver disponibilidade<span className="sr-only"> de {source.name}</span></button>
      </li>)}</ul>
    </section>}
    <p className="text-xs text-muted">Preço e disponibilidade podem mudar. Confira as condições finais na loja. <Link href="/contas" className="text-primary underline">Gerenciar conexões</Link></p>
  </div>;
}
